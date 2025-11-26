# GBA Rendering Pipeline (pokeemerald)

This document describes how the original Game Boy Advance rendering pipeline works in pokeemerald.

## Overview

The GBA rendering pipeline is **interrupt-driven** and **hardware-accelerated**, operating at a fixed 60 Hz refresh rate. The architecture leverages specialized hardware features:

- **4 background layers** (BG0-BG3) with hardware scrolling and priority
- **128 OAM sprites** with affine transformations
- **DMA transfers** for fast memory operations
- **Scanline-based effects** via HBlank interrupts

## Interrupt-Driven Architecture

### Key Interrupts

```
┌─────────────────────────────────────────────────────────┐
│  Frame Timeline (60 Hz = 16.67ms per frame)             │
├─────────────────────────────────────────────────────────┤
│  Lines 0-159:   Active Display (visible scanlines)      │
│  Line 160:      VBlank Start                            │
│  Lines 161-227: VBlank Period (safe for updates)        │
│  Line 228:      Frame Complete                          │
└─────────────────────────────────────────────────────────┘
```

**VBlank Interrupt** (`main.c`):
- Triggered when screen finishes drawing all 160 visible scanlines
- Safe window to modify VRAM, OAM, and GPU registers
- All rendering state updates happen here

**HBlank Interrupt**:
- Triggered during each scanline gap (160 times per frame)
- Used for per-scanline effects (wave distortion, palette changes)
- DMA-driven for zero CPU overhead

### Main Loop Structure

```c
static void VBlankIntr(void)
{
    gMain.vblankCounter1++;
    if (gMain.vblankCallback)
        gMain.vblankCallback();
    CopyBufferedValuesToGpuRegs();  // Apply queued register changes
    ProcessDma3Requests();           // Execute DMA transfers
    m4aSoundMain();
}
```

## GPU Register Buffering

The engine implements **double-buffered GPU register writes** to prevent visual artifacts:

### Problem Solved
Modifying GPU registers mid-scanline causes tearing/glitches. The buffering system ensures changes only apply during safe windows.

### Implementation (`gpu_regs.c`)

```c
void SetGpuReg(u8 regOffset, u16 value)
{
    GPU_REG_BUF(regOffset) = value;  // Buffer the value
    u16 vcount = REG_VCOUNT & 0xFF;

    // Apply immediately only if in safe window
    if ((vcount >= 161 && vcount <= 225) ||
        (REG_DISPCNT & DISPCNT_FORCED_BLANK))
        CopyBufferedValueToGpuReg(regOffset);
    else
        // Queue for next VBlank
        sGpuRegWaitingList[i] = regOffset;
}
```

## Background System

### 4-Layer Architecture

| Layer | Typical Use | Priority |
|-------|-------------|----------|
| BG0 | Text/UI | Highest (0) |
| BG1 | Top tiles (trees, roofs) | 1 |
| BG2 | Base terrain | 2 |
| BG3 | Far background | Lowest (3) |

### Background Configuration

```c
struct BgConfig {
    u8 visible:1;
    u8 screenSize:2;        // 256x256 to 512x512
    u8 priority:2;          // 0-3 (0=highest)
    u8 mosaic:1;
    u8 wraparound:1;
    u8 charBaseIndex:2;     // Tile graphics VRAM block
    u8 mapBaseIndex:5;      // Tilemap VRAM block
    u8 paletteMode:1;       // 4bpp (16 colors) or 8bpp (256 colors)
};
```

### Tileset Structure

```
┌─────────────────────────────────────────────────────────┐
│  Primary Tileset (512 metatiles)                        │
│  - Common tiles: water, grass, generic terrain          │
│  - Shared across all maps                               │
├─────────────────────────────────────────────────────────┤
│  Secondary Tileset (512 metatiles)                      │
│  - Location-specific: city themes, dungeon styles       │
│  - Swapped per map group                                │
├─────────────────────────────────────────────────────────┤
│  Total: 1024 metatiles available                        │
│  Each metatile = 2x2 tiles = 16x16 pixels               │
│  Each tile = 8x8 pixels                                 │
└─────────────────────────────────────────────────────────┘
```

## Tileset Animations

### DMA-Driven Tile Replacement

Animated tiles (water, lava, flowers) work by **replacing tile graphics in VRAM** during VBlank:

```c
// Water animation frames
const u16 *const gTilesetAnims_General_Water[] = {
    gTilesetAnims_General_Water_Frame0,
    gTilesetAnims_General_Water_Frame1,
    // ... 8 frames total
    gTilesetAnims_General_Water_Frame7
};
```

### Animation Queue System

```c
struct {
    const u16 *src;   // Source: ROM animation frame
    u16 *dest;        // Destination: VRAM tile address
    u16 size;         // Transfer size in bytes
} sTilesetDMA3TransferBuffer[20];  // Up to 20 transfers per frame
```

### Frame Timing

- **Frame counter**: `sPrimaryTilesetAnimCounter` increments each VBlank
- **Interval**: Typically 8-16 frames between animation steps
- **Processing**: All queued DMA transfers execute during VBlank

## Sprite/OAM System

### OAM Structure

The GBA has **Object Attribute Memory** for 128 sprites:

```c
struct OamData {
    // Attribute 0
    u16 y:8;              // Y position (0-255)
    u16 affineMode:2;     // 0=normal, 1=affine, 2=double-size affine
    u16 objMode:2;        // 0=normal, 1=blend, 2=window
    u16 mosaic:1;
    u16 bpp:1;            // 4bpp or 8bpp
    u16 shape:2;          // Square, horizontal rect, vertical rect

    // Attribute 1
    u16 x:9;              // X position (0-511, wraps)
    u16 matrixNum:5;      // Affine matrix index (0-31)
    u16 hFlip:1;
    u16 vFlip:1;
    u16 size:2;           // 8x8, 16x16, 32x32, 64x64

    // Attribute 2
    u16 tileNum:10;       // Starting tile in VRAM
    u16 priority:2;       // Priority vs backgrounds (0-3)
    u16 paletteNum:4;     // Palette bank (0-15)
};
```

### Sprite Rendering Pipeline

```c
void BuildOamBuffer(void)
{
    UpdateOamCoords();          // Calculate screen positions
    BuildSpritePriorities();    // Compute sort keys
    SortSprites();              // Y-coordinate + priority sort
    AddSpritesToOamBuffer();    // Write to OAM buffer
    CopyMatricesToOamBuffer();  // Write affine matrices
}
```

### Priority System

1. **OAM Priority** (2 bits): Determines layer vs backgrounds
2. **Subpriority** (8 bits): Sort order among sprites
3. **Y-Sorting**: Sprites sorted by Y for depth illusion

## Scanline Effects

### Per-Scanline Register Modification

Used for wave effects, water distortion, and special visual effects:

```c
// Double-buffered scanline data
EWRAM_DATA u16 gScanlineEffectRegBuffers[2][0x3C0] = {0};

u8 ScanlineEffect_InitWave(u8 startLine, u8 endLine,
                           u8 frequency, u8 amplitude,
                           u8 delayInterval, u8 regOffset)
{
    // Generate sine wave
    GenerateWave(&buffer[320], frequency, amplitude, 0);

    // Setup HBlank DMA to transfer one value per scanline
    DmaSet(0, dmaSrc, regOffset, SCANLINE_EFFECT_DMACNT_16BIT);
}
```

### How It Works

1. Pre-compute 160 register values (one per scanline)
2. Setup DMA to trigger on each HBlank
3. Each HBlank: DMA automatically writes next value
4. Result: Register changes every scanline with zero CPU cost

## Weather System

### Implementation Methods

| Weather Type | Method | Notes |
|--------------|--------|-------|
| Rain/Snow | Sprites | Actual OAM sprites with animations |
| Fog | Palette | Color mapping applied to all palettes |
| Drought | Palette | 6 LUTs (4KB each) for color transformation |
| Sandstorm | Sprites + Palette | Combined approach |

### Palette-Based Effects

```c
static const u8 sBasePaletteColorMapTypes[32] = {
    COLOR_MAP_DARK_CONTRAST,  // BG palettes (0-13)
    COLOR_MAP_CONTRAST,       // Sprite palettes (16-31)
};
```

## Memory Layout

### VRAM Organization (96 KB)

```
┌─────────────────────────────────────────┐
│ 0x06000000 - Character Blocks (64 KB)   │
│   Block 0: BG tiles                     │
│   Block 1: BG tiles                     │
│   Block 2: Sprite tiles                 │
│   Block 3: Sprite tiles                 │
├─────────────────────────────────────────┤
│ 0x06010000 - Tilemap Blocks (32 KB)     │
│   Screens for BG0-3                     │
└─────────────────────────────────────────┘
```

### Palette RAM (1 KB)

```
┌─────────────────────────────────────────┐
│ 0x05000000 - BG Palettes (512 bytes)    │
│   16 palettes × 16 colors × 2 bytes     │
├─────────────────────────────────────────┤
│ 0x05000200 - OBJ Palettes (512 bytes)   │
│   16 palettes × 16 colors × 2 bytes     │
└─────────────────────────────────────────┘
```

## Optimization Techniques

### DMA Usage
- **All bulk transfers use DMA3**: Faster than CPU, non-blocking
- **HBlank DMA**: Scanline effects with zero CPU overhead
- **VBlank batching**: Queue transfers, execute all at once

### Memory Efficiency
- **LZ77 compression**: Graphics compressed in ROM
- **Shared tilesets**: Primary/secondary reduces duplication
- **Palette reuse**: 256 total colors across 16 palettes

### Processing Efficiency
- **Buffered writes**: Batch register changes
- **Task scheduling**: Spread work across frames
- **OAM limit**: Cap at 64 sprites to prevent slowdown

## Rendering Order (Back to Front)

1. Backdrop color (palette entry 0)
2. Background 3 (priority 3)
3. Background 2 (priority 2)
4. Background 1 (priority 1)
5. Background 0 (priority 0)
6. Sprites (sorted by priority + Y)
7. Blending effects (if enabled)
8. Window masking (if enabled)

## Key Takeaways for Browser Implementation

1. **Hardware did the heavy lifting**: DMA, HBlank, affine transforms are "free"
2. **Fixed 60 Hz cadence**: All updates synchronized to VBlank
3. **Tile-based everything**: Maps, sprites, animations all tile-based
4. **Limited but efficient**: 128 sprites, 4 BGs, 96KB VRAM - constraints drove optimization
5. **Interrupt-driven**: CPU does minimal work during active display
