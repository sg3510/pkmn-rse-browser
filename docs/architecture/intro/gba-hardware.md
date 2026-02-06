---
title: GBA Hardware Details
status: reference
last_verified: 2026-01-13
---

# GBA Hardware Details

## Display Configuration

### Display Control (DISPCNT)

```c
// During init (state 4)
SetGpuReg(REG_OFFSET_DISPCNT, DISPCNT_MODE_1
                            | DISPCNT_OBJ_1D_MAP
                            | DISPCNT_BG2_ON
                            | DISPCNT_OBJ_ON
                            | DISPCNT_WIN0_ON
                            | DISPCNT_OBJWIN_ON);

// After Phase 1 → Phase 2
SetGpuReg(REG_OFFSET_DISPCNT, DISPCNT_MODE_1
                            | DISPCNT_OBJ_1D_MAP
                            | DISPCNT_BG2_ON
                            | DISPCNT_OBJ_ON);

// Phase 3 (all layers visible)
SetGpuReg(REG_OFFSET_DISPCNT, DISPCNT_MODE_1
                            | DISPCNT_OBJ_1D_MAP
                            | DISPCNT_BG0_ON
                            | DISPCNT_BG1_ON
                            | DISPCNT_BG2_ON
                            | DISPCNT_OBJ_ON);
```

### Display Mode 1

Mode 1 is a mixed mode supporting:
- BG0: Text/tile mode (256×256)
- BG1: Text/tile mode (256×256)
- BG2: Affine/rotation mode (256×256)
- BG3: Not available in Mode 1

## Background Layer Configuration

### BG0 - Rayquaza Silhouette

```c
SetGpuReg(REG_OFFSET_BG0CNT,
    BGCNT_PRIORITY(3)         // Lowest priority (back)
    | BGCNT_CHARBASE(2)       // Character base at 0x0600_4000
    | BGCNT_SCREENBASE(26)    // Screen base at 0x0600_D000
    | BGCNT_16COLOR           // 4 BPP mode
    | BGCNT_TXT256x256);      // 256×256 pixel map

// Graphics loading
LZ77UnCompVram(sTitleScreenRayquazaGfx, (void *)(BG_CHAR_ADDR(2)));
LZ77UnCompVram(sTitleScreenRayquazaTilemap, (void *)(BG_SCREEN_ADDR(26)));
```

### BG1 - Clouds

```c
SetGpuReg(REG_OFFSET_BG1CNT,
    BGCNT_PRIORITY(2)         // Middle-back priority
    | BGCNT_CHARBASE(3)       // Character base at 0x0600_6000
    | BGCNT_SCREENBASE(27)    // Screen base at 0x0600_D800
    | BGCNT_16COLOR           // 4 BPP mode
    | BGCNT_TXT256x256);      // 256×256 pixel map

// Graphics loading
LZ77UnCompVram(sTitleScreenCloudsGfx, (void *)(BG_CHAR_ADDR(3)));
LZ77UnCompVram(gTitleScreenCloudsTilemap, (void *)(BG_SCREEN_ADDR(27)));
```

### BG2 - Pokemon Logo (Affine)

```c
SetGpuReg(REG_OFFSET_BG2CNT,
    BGCNT_PRIORITY(1)         // Middle priority
    | BGCNT_CHARBASE(0)       // Character base at 0x0600_0000
    | BGCNT_SCREENBASE(9)     // Screen base at 0x0600_4800
    | BGCNT_256COLOR          // 8 BPP mode
    | BGCNT_AFF256x256);      // 256×256 affine map

// Graphics loading
LZ77UnCompVram(gTitleScreenPokemonLogoGfx, (void *)(BG_CHAR_ADDR(0)));
LZ77UnCompVram(gTitleScreenPokemonLogoTilemap, (void *)(BG_SCREEN_ADDR(9)));

// Initial affine position
SetGpuReg(REG_OFFSET_BG2X_L, -29 * 256);  // X offset in 8.8 fixed-point
SetGpuReg(REG_OFFSET_BG2X_H, -1);         // High bits (sign extension)
SetGpuReg(REG_OFFSET_BG2Y_L, -32 * 256);  // Y offset in 8.8 fixed-point
SetGpuReg(REG_OFFSET_BG2Y_H, -1);         // High bits (sign extension)
```

## VRAM Memory Map

### Character (Tile) Data

| CharBase | Address | Content | Size |
|----------|---------|---------|------|
| 0 | 0x0600_0000 | Pokemon logo tiles (8bpp) | ~16 KB |
| 2 | 0x0600_4000 | Rayquaza tiles (4bpp) | ~8 KB |
| 3 | 0x0600_6000 | Cloud tiles (4bpp) | ~4 KB |

### Screen (Tilemap) Data

| ScreenBase | Address | Content | Size |
|------------|---------|---------|------|
| 9 | 0x0600_4800 | Pokemon logo map | 2 KB |
| 26 | 0x0600_D000 | Rayquaza map | 2 KB |
| 27 | 0x0600_D800 | Clouds map | 2 KB |

### Sprite (OBJ) VRAM

```
OBJ VRAM (0x0601_0000 - 0x0601_7FFF):
├── Emerald Version: 0x1000 bytes (tag 1000)
├── Press Start:     0x0520 bytes (tag 1001)
└── Logo Shine:      0x0800 bytes (tag 1002)
```

## Palette Memory

### Background Palettes (BG_PLTT: 0x0500_0000)

```c
// Load 15 palettes (palettes 0-14)
LoadPalette(gTitleScreenBgPalettes, BG_PLTT_ID(0), 15 * PLTT_SIZE_4BPP);

// Dynamic color update (Rayquaza marking)
LoadPalette(&color, BG_PLTT_ID(14) + 15, sizeof(color));
```

| Palette | Usage |
|---------|-------|
| 0-14 | Pokemon logo (256 colors across 15 palettes) |
| 14, index 15 | Rayquaza marking pulse |
| 15 | Unused |

### Sprite Palettes (OBJ_PLTT: 0x0500_0200)

```c
LoadPalette(gTitleScreenEmeraldVersionPal, OBJ_PLTT_ID(0), PLTT_SIZE_4BPP);
LoadSpritePalette(&sSpritePalette_PressStart[0]);  // tag 1001
```

| Palette | Tag | Usage |
|---------|-----|-------|
| 0 | 1000 | Emerald Version banner |
| 1 | 1001 | Press Start / Logo Shine |

## Window System

### Window Configuration

```c
// Window dimensions (disabled initially)
SetGpuReg(REG_OFFSET_WIN0H, 0);
SetGpuReg(REG_OFFSET_WIN0V, 0);
SetGpuReg(REG_OFFSET_WIN1H, 0);
SetGpuReg(REG_OFFSET_WIN1V, 0);

// Window inside/outside settings
SetGpuReg(REG_OFFSET_WININ,
    WININ_WIN0_BG_ALL | WININ_WIN0_OBJ |  // WIN0 shows all BGs + OBJ
    WININ_WIN1_BG_ALL | WININ_WIN1_OBJ);  // WIN1 shows all BGs + OBJ

SetGpuReg(REG_OFFSET_WINOUT,
    WINOUT_WIN01_BG_ALL | WINOUT_WIN01_OBJ |  // Outside shows all
    WINOUT_WINOBJ_ALL);                        // OBJ window shows all
```

### Object Window Usage

The logo shine uses object window mode:
```c
gSprites[spriteId].oam.objMode = ST_OAM_OBJ_WINDOW;
```

This creates a masking effect where the shine sprite defines a window region.

## Blend Effects (BLDCNT, BLDALPHA, BLDY)

### Phase 1: Logo Lighten Effect

```c
SetGpuReg(REG_OFFSET_BLDCNT, BLDCNT_TGT1_BG2 | BLDCNT_EFFECT_LIGHTEN);
SetGpuReg(REG_OFFSET_BLDALPHA, 0);
SetGpuReg(REG_OFFSET_BLDY, 12);  // Lighten BG2 by 12/16
```

### Phase 2: Version Banner Blend

```c
SetGpuReg(REG_OFFSET_BLDCNT,
    BLDCNT_TGT1_OBJ |           // Blend sprites (first target)
    BLDCNT_EFFECT_BLEND |       // Alpha blend mode
    BLDCNT_TGT2_ALL);           // Against all layers

SetGpuReg(REG_OFFSET_BLDALPHA, BLDALPHA_BLEND(16, 0));  // Start opaque
// Updates each frame using gTitleScreenAlphaBlend[index]
```

### Phase 3: Cloud Blend

```c
SetGpuReg(REG_OFFSET_BLDCNT,
    BLDCNT_TGT1_BG1 |           // Clouds as first target
    BLDCNT_EFFECT_BLEND |       // Alpha blend
    BLDCNT_TGT2_BG0 |           // Blend with Rayquaza
    BLDCNT_TGT2_BD);            // And backdrop

SetGpuReg(REG_OFFSET_BLDALPHA, BLDALPHA_BLEND(6, 15));  // Semi-transparent clouds
```

## Scanline Effects (HBlank DMA)

### Cloud Wave Effect

```c
ScanlineEffect_InitWave(
    0,                           // Start at scanline 0
    DISPLAY_HEIGHT,              // End at scanline 160
    4,                           // Amplitude: 4 pixels
    4,                           // Wavelength: 4 scanlines
    0,                           // Initial phase
    SCANLINE_EFFECT_REG_BG1HOFS, // Target: BG1 horizontal offset
    TRUE                         // Enable
);
```

Creates a subtle horizontal wave on the cloud layer by modifying BG1HOFS per-scanline.

### VBlank Processing

```c
static void VBlankCB(void)
{
    ScanlineEffect_InitHBlankDmaTransfer();  // Setup scanline DMA
    LoadOam();                               // Copy sprite data to OAM
    ProcessSpriteCopyRequests();             // Handle sprite VRAM updates
    TransferPlttBuffer();                    // Update palette RAM
    SetGpuReg(REG_OFFSET_BG1VOFS, gBattle_BG1_Y);  // Update cloud scroll
}
```

## Sprite (OAM) Configuration

### Version Banner Sprites

```c
static const struct OamData sVersionBannerLeftOamData =
{
    .y = DISPLAY_HEIGHT,         // Start off-screen
    .affineMode = ST_OAM_AFFINE_OFF,
    .objMode = ST_OAM_OBJ_NORMAL, // Changes to blend during animation
    .bpp = ST_OAM_8BPP,          // 256-color sprite
    .shape = SPRITE_SHAPE(64x32),
    .size = SPRITE_SIZE(64x32),
    .priority = 0,               // Highest priority (in front)
};
```

### Press Start / Copyright Sprites

```c
static const struct OamData sOamData_CopyrightBanner =
{
    .bpp = ST_OAM_4BPP,          // 16-color sprite
    .shape = SPRITE_SHAPE(32x8),
    .size = SPRITE_SIZE(32x8),
    .priority = 0,
};
```

### Logo Shine Sprite

```c
static const struct OamData sPokemonLogoShineOamData =
{
    .bpp = ST_OAM_4BPP,
    .shape = SPRITE_SHAPE(64x64),
    .size = SPRITE_SIZE(64x64),
    .priority = 0,
    // objMode set to ST_OAM_OBJ_WINDOW at runtime
};
```

## Affine Transformations

### Camera Setup

```c
PanFadeAndZoomScreen(
    DISPLAY_WIDTH / 2,   // Center X (120)
    DISPLAY_HEIGHT / 2,  // Center Y (80)
    0x100,               // Scale factor (1.0 in 8.8 fixed-point)
    0                    // Rotation angle
);
```

### 8.8 Fixed-Point Format

GBA affine BG positions use 8.8 fixed-point:
- Upper 8 bits: integer portion
- Lower 8 bits: fractional portion
- Multiply pixel value by 256 for register value

```c
// Example: Set BG2 Y to -32 pixels
yPos = -32 * 256;  // = -8192 in register
SetGpuReg(REG_OFFSET_BG2Y_L, yPos & 0xFFFF);
SetGpuReg(REG_OFFSET_BG2Y_H, yPos >> 16);
```

## Timing and Frame Rate

```
GBA Frame Rate: 59.7275 Hz (~16.74ms per frame)
CPU Frequency: 16.78 MHz

Scanlines per frame: 228
  - Visible: 160 (VDraw)
  - VBlank: 68

Cycles per scanline: 1232
  - HDraw: 960 cycles
  - HBlank: 272 cycles
```

## Interrupt Configuration

```c
EnableInterrupts(INTR_FLAG_VBLANK);
SetVBlankCallback(VBlankCB);
```

Only VBlank interrupt is used for:
- Sprite DMA transfers
- Palette updates
- Scanline effect setup

## Compression

All graphics use LZ77 compression (Nintendo's variant):
- Decompressed directly to VRAM
- Function: `LZ77UnCompVram(src, dest)`
- Reduces ROM usage by ~50-60%
