# Palette & Color Data

## Palette Organization

### Background Palettes (BG_PLTT)

GBA has 16 background palettes × 16 colors each (256 total BG colors).

```
Palette 0-14: Combined pokemon_logo.gbapal + rayquaza_and_clouds.gbapal
Palette 15: Unused in title screen

Memory: BG_PLTT (0x0500_0000) - 512 bytes
```

#### Pokemon Logo Palette
- **File:** `pokemon_logo.gbapal`
- **Colors:** 256 (8 BPP mode, uses palettes 0-15)
- **Usage:** BG2 (Pokemon logo)
- **Notable:** Contains gradients for the metallic logo effect

#### Rayquaza/Clouds Shared Palette
- **File:** `rayquaza_and_clouds.gbapal`
- **Colors:** 16 (4 BPP mode)
- **Usage:** BG0 (Rayquaza) and BG1 (Clouds)

```
Color Index | RGB (0-31 scale) | Usage
------------|------------------|-------
0           | 189, 106, 8      | Brown background
1           | 0, 139, 74       | Dark green (Rayquaza body)
2           | 255, 255, 255    | White (highlights)
3           | 16, 172, 98      | Bright green (Rayquaza)
...         | ...              | ...
14-15       | Dynamic          | Rayquaza marking (animated)
```

### Sprite Palettes (OBJ_PLTT)

GBA has 16 sprite palettes × 16 colors each.

```
Palette 0: Emerald Version banner
Palette 1: Press Start / Copyright text
Palette 2: Logo shine effect

Memory: OBJ_PLTT (0x0500_0200) - 512 bytes
```

#### Emerald Version Palette
- **File:** `emerald_version.gbapal`
- **Size:** 32 bytes (16 colors)
- **Usage:** Version banner sprites

#### Press Start Palette
- **File:** `press_start.gbapal`
- **Size:** 32 bytes (16 colors)
- **Usage:** Press Start and Copyright sprites

## Dynamic Color Effects

### Rayquaza Marking Pulse

The marking on Rayquaza's head pulses with a color cycling effect.

```c
// Update every 4 frames
void UpdateLegendaryMarkingColor(u16 frameNum) {
    // Calculate intensity using cosine wave
    u16 intensity = Cos(frameNum, 128) + 128;  // Range: 0-256

    // Calculate RGB components
    u16 red   = 31 - ((intensity * 32 - intensity) / 256);
    u16 green = 31 - (intensity * 22 / 256);
    u16 blue  = 12;  // constant

    // Apply to palette
    gPlttBufferFaded[BG_PLTT_ID(14) + 15] = RGB(red, green, blue);
}
```

**Color Range:**
| Intensity | Red | Green | Blue | Result |
|-----------|-----|-------|------|--------|
| 0 (min)   | 31  | 31    | 12   | Yellow-green |
| 128 (mid) | 15  | 20    | 12   | Olive |
| 256 (max) | 0   | 9     | 12   | Dark teal |

### Logo Shine Background Modulation

During shine animation, background color (palette 0, index 0) is modified:

```c
// Left side of screen (X < 120): brighten
if (shineX < SCREEN_CENTER_X) {
    bgIntensity = min(31, bgIntensity + 2);
}

// Right side of screen (X >= 120): darken
else {
    bgIntensity = max(0, bgIntensity - 2);
}

// Apply grayscale
bgColor = RGB(bgIntensity, bgIntensity, bgIntensity);

// Special green flash near center
if (abs(shineX - SCREEN_CENTER_X) < 8) {
    bgColor = RGB(24, 31, 12);  // Green tint
}

gPlttBufferFaded[0] = bgColor;
```

## Color Blending Effects

### Blend Control Register (BLDCNT)

```c
// Version Banner fade-in
REG_BLDCNT = BLDCNT_TGT1_OBJ | BLDCNT_EFFECT_BLEND;

// Logo shine lighten effect
REG_BLDCNT = BLDCNT_TGT1_BG2 | BLDCNT_EFFECT_LIGHTEN;

// Cloud layer subtle blend
REG_BLDCNT = BLDCNT_TGT1_BG1 | BLDCNT_EFFECT_BLEND;
```

### Alpha Blend Coefficients (BLDALPHA)

```c
// Version banner fade table
const u16 gTitleScreenAlphaBlend[64] = {
    // Indices 0-15: Full opacity → Semi-transparent
    BLDALPHA_BLEND(16, 0),   // [0] Fully opaque
    BLDALPHA_BLEND(16, 1),
    BLDALPHA_BLEND(16, 2),
    ...
    BLDALPHA_BLEND(16, 15),  // [15] Semi-transparent

    // Indices 16-31: Semi-transparent → Transparent
    BLDALPHA_BLEND(15, 16),  // [16]
    BLDALPHA_BLEND(14, 16),
    ...
    BLDALPHA_BLEND(1, 16),   // [31] Nearly transparent

    // Indices 32-63: Fully transparent (hold)
    BLDALPHA_BLEND(0, 16),   // [32-63] Invisible
    ...
};

// Usage: gTitleScreenAlphaBlend[blendIndex]
// blendIndex decrements 64 → 0 during Phase 2
```

### Brightness Effect (BLDY)

Used for logo shine lightening effect:

```c
// During shine pass
REG_BLDY = shineIntensity;  // 0-12 range

// shineIntensity increases as shine passes through
```

## Fade Effects

### White Fade In (Initialization)

```c
BeginNormalPaletteFade(
    PALETTES_ALL,        // Affect all palettes
    0,                   // No delay
    16,                  // Start: fully white
    0,                   // End: normal colors
    RGB_WHITEALPHA       // Fade from white
);
```

### Black Fade Out (Exit)

```c
BeginNormalPaletteFade(
    PALETTES_ALL,
    0,
    0,                   // Start: normal
    16,                  // End: fully black
    RGB_BLACK
);
```

## GBA Color Format

### RGB555 Format

GBA uses 15-bit color (5 bits per channel):

```
Bit:  15  14 13 12 11 10  9  8  7  6  5  4  3  2  1  0
      X   B  B  B  B  B   G  G  G  G  G  R  R  R  R  R

R: bits 0-4   (0-31)
G: bits 5-9   (0-31)
B: bits 10-14 (0-31)
Bit 15: unused (sometimes alpha in special modes)
```

### Color Macros

```c
// Create color from components (0-31 each)
#define RGB(r, g, b) ((r) | ((g) << 5) | ((b) << 10))

// Named colors
#define RGB_WHITE    RGB(31, 31, 31)  // 0x7FFF
#define RGB_BLACK    RGB(0, 0, 0)     // 0x0000

// With alpha (bit 15 set)
#define RGB_WHITEALPHA ((1 << 15) | RGB_WHITE)  // 0xFFFF
```

## Converting to Web Colors

### GBA (5-bit) to Web (8-bit) Conversion

```javascript
function gbaToWeb(gbaColor) {
    const r5 = gbaColor & 0x1F;
    const g5 = (gbaColor >> 5) & 0x1F;
    const b5 = (gbaColor >> 10) & 0x1F;

    // Scale 0-31 to 0-255
    const r8 = Math.round(r5 * 255 / 31);
    const g8 = Math.round(g5 * 255 / 31);
    const b8 = Math.round(b5 * 255 / 31);

    return `rgb(${r8}, ${g8}, ${b8})`;
}
```

### Key Colors Reference

| GBA Value | RGB (0-31) | Web RGB (0-255) | Usage |
|-----------|------------|-----------------|-------|
| 0x7FFF | 31,31,31 | 255,255,255 | White |
| 0x0000 | 0,0,0 | 0,0,0 | Black |
| 0x2D89 | 9,12,11 | 74,99,90 | Rayquaza dark |
| 0x56F3 | 19,23,21 | 156,189,172 | Rayquaza light |
| Brown BG | 24,13,1 | 197,107,8 | Background |

## Palette File Formats

### .gbapal Format
- Binary 16-bit values
- Little-endian
- 16 or 256 colors × 2 bytes each

### .pal (JASC) Format
```
JASC-PAL
0100
16
R G B
R G B
...
```
- Text format
- RGB values 0-255
- One color per line
