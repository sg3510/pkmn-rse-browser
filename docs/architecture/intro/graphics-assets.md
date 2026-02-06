---
title: Graphics Assets
status: reference
last_verified: 2026-01-13
---

# Graphics Assets

All assets are located in `public/pokeemerald/graphics/title_screen/`

## Background Graphics

### Pokemon Logo (BG2)
| Property | Value |
|----------|-------|
| **File** | `pokemon_logo.png` |
| **Compressed** | `pokemon_logo.8bpp.lz` |
| **Dimensions** | 256 × 64 pixels |
| **Bit Depth** | 8 BPP (256 colors) |
| **Tilemap** | `pokemon_logo.bin.lz` (1.0 KB) |
| **Palette** | `pokemon_logo.gbapal` (256 colors) |
| **Layer** | BG2 (Affine mode) |
| **Priority** | 1 (middle layer) |

**Notes:**
- Uses affine transformation for slide animation
- 256-color palette allows detailed gradients
- Tilemap is 256×256 (32×32 tiles of 8×8 pixels)

### Rayquaza Silhouette (BG0)
| Property | Value |
|----------|-------|
| **File** | `rayquaza.png` |
| **Compressed** | `rayquaza.4bpp.lz` |
| **Dimensions** | 128 × 128 pixels |
| **Bit Depth** | 4 BPP (16 colors) |
| **Tilemap** | `rayquaza.bin.lz` (2.0 KB) |
| **Palette** | `rayquaza_and_clouds.gbapal` (shared, 16 colors) |
| **Layer** | BG0 (Text mode) |
| **Priority** | 3 (back layer) |

**Notes:**
- Shares palette with clouds layer
- Color index 14/15 used for dynamic marking color
- Static background - no scrolling

### Clouds (BG1)
| Property | Value |
|----------|-------|
| **File** | `clouds.png` |
| **Compressed** | `clouds.4bpp.lz` |
| **Dimensions** | 128 × 56 pixels |
| **Bit Depth** | 4 BPP (16 colors) |
| **Tilemap** | `clouds.bin.lz` (2.0 KB) |
| **Palette** | `rayquaza_and_clouds.gbapal` (shared) |
| **Layer** | BG1 (Text mode) |
| **Priority** | 2 |

**Notes:**
- Horizontal scrolling with wave effect
- Wraps seamlessly for continuous scroll
- Scanline effect adds subtle wave distortion

## Sprite Graphics

### Emerald Version Banner
| Property | Value |
|----------|-------|
| **File** | `emerald_version.png` |
| **Compressed** | `emerald_version.8bpp.lz` |
| **Dimensions** | 128 × 32 pixels |
| **Bit Depth** | 8 BPP (256 colors) |
| **Palette** | `emerald_version.gbapal` |
| **Sprite Tag** | 1000 (TAG_VERSION) |
| **VRAM Size** | 0x1000 bytes (4KB) |

**Sprite Layout:**
```
┌─────────────────────────────────────┐
│  "Emerald"  │  "Version"            │
│  64×32 px   │   64×32 px            │
│  Left half  │   Right half          │
└─────────────────────────────────────┘
```

**Positioning:**
- Left sprite: X=98, Y=2→66
- Right sprite: X=162, Y=2→66 (offset by 64 tiles in atlas)

### Press Start / Copyright
| Property | Value |
|----------|-------|
| **File** | `press_start.png` |
| **Compressed** | `press_start.4bpp.lz` |
| **Dimensions** | 128 × 24 pixels (10 frames) |
| **Frame Size** | 32 × 8 pixels each |
| **Bit Depth** | 4 BPP (16 colors) |
| **Palette** | `press_start.gbapal` |
| **Sprite Tag** | 1001 (TAG_PRESS_START_COPYRIGHT) |
| **VRAM Size** | 0x520 bytes |

**Frame Layout:**
```
Frame 0-4:  "PRESS START" (5 segments)
Frame 5-9:  "©2002-2004 POKEMON" (5 segments)

Each frame: 32×8 pixels
Total: 10 frames × 32×8 = 160×8 logical layout
```

**Positioning:**
```
Press Start (Y=108):
├── Frame 0: X = 64
├── Frame 1: X = 96
├── Frame 2: X = 128
├── Frame 3: X = 160
└── Frame 4: X = 192

Copyright (Y=148):
├── Frame 5: X = 64
├── Frame 6: X = 96
├── Frame 7: X = 128
├── Frame 8: X = 160
└── Frame 9: X = 192
```

### Logo Shine Effect
| Property | Value |
|----------|-------|
| **File** | `logo_shine.png` |
| **Compressed** | `logo_shine.4bpp.lz` |
| **Dimensions** | 64 × 64 pixels |
| **Bit Depth** | 4 BPP (16 colors) |
| **Palette** | Uses logo palette |
| **Sprite Tag** | 1002 (TAG_LOGO_SHINE) |
| **VRAM Size** | 0x800 bytes |

**Notes:**
- Semi-transparent diagonal streak effect
- Moves left-to-right across logo
- Uses object window for masking effect
- Speed: 4 pixels/frame (normal), 8 pixels/frame (double)

## VRAM Layout

### Background Character Data
```
CharBase 0 (0x0600_0000): Pokemon Logo tiles
CharBase 2 (0x0600_4000): Rayquaza tiles
CharBase 3 (0x0600_6000): Clouds tiles
```

### Background Screen Data (Tilemaps)
```
ScreenBase 9  (0x0600_E000): Pokemon Logo tilemap
ScreenBase 26 (0x0600_D000): Rayquaza tilemap
ScreenBase 27 (0x0600_D800): Clouds tilemap
```

### Sprite VRAM
```
OBJ VRAM Usage:
├── Emerald Version: 0x1000 bytes (4 KB)
├── Press Start:     0x0520 bytes (~1.3 KB)
├── Logo Shine:      0x0800 bytes (2 KB)
└── Total:           0x2320 bytes (~9 KB of 32 KB available)
```

## Asset File Sizes

| Asset | PNG Size | Compressed (.lz) | Decompressed |
|-------|----------|------------------|--------------|
| pokemon_logo | ~8 KB | ~4 KB | 16 KB |
| rayquaza | ~3 KB | ~2 KB | 8 KB |
| clouds | ~2 KB | ~1 KB | 3.5 KB |
| emerald_version | ~4 KB | ~2 KB | 4 KB |
| press_start | ~2 KB | ~1 KB | 1.3 KB |
| logo_shine | ~1 KB | ~0.5 KB | 2 KB |

## Coordinate System

### GBA Screen Coordinates
```
(0,0) ─────────────────────────────────► X (240)
  │
  │    ┌───────────────────────────┐
  │    │                           │
  │    │      Visible Area         │
  │    │       240 × 160           │
  │    │                           │
  │    └───────────────────────────┘
  │
  ▼ Y (160)
```

### Background Layer Positions
```
BG0 (Rayquaza): Static, covers full 256×256
BG1 (Clouds):   Scrolls horizontally, wave effect
BG2 (Logo):     Affine, slides vertically during Phase 2
```

### Sprite Anchor Points
- Sprites are positioned from top-left corner
- OAM coordinates are signed 9-bit for X, 8-bit for Y
- Off-screen positioning: X can be negative for entry animations
