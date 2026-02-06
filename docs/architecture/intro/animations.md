---
title: Animation System
status: reference
last_verified: 2026-01-13
---

# Animation System

## Logo Shine Effect

The most complex animation - a diagonal light streak that moves across the Pokemon logo.

### Shine Modes

#### Mode 1: SHINE_MODE_SINGLE_NO_BG_COLOR
```
Configuration:
├── Sprites: 1 visible shine sprite
├── Speed: 4 pixels/frame
├── Background: No color modulation
└── Duration: Until X > 272 (DISPLAY_WIDTH + 32)

Movement:
├── Start Position: X = 0, Y = 68
├── Direction: Left to right
└── End Position: X = 272+ (off-screen right)
```

#### Mode 2: SHINE_MODE_SINGLE
```
Configuration:
├── Sprites: 1 visible shine sprite
├── Speed: 4 pixels/frame
├── Background: Dynamic grayscale modulation
└── Duration: Until X > 272

Background Color Effect:
├── Left half (X < 120):
│   └── Brightness increases: +2 per frame, max 31
├── Center (near X = 120):
│   └── Green flash: RGB(24, 31, 12)
└── Right half (X >= 120):
    └── Brightness decreases: -2 per frame, min 0

Color Formula:
  intensity = clamp(0, 31, base_intensity ± 2)
  color = RGB(intensity, intensity, intensity)
```

#### Mode 3: SHINE_MODE_DOUBLE
```
Configuration:
├── Sprites: 3 total (1 invisible + 2 visible)
├── Speed: 8 pixels/frame (double speed)
└── Duration: Until lead sprite off-screen

Sprite Positions:
├── Sprite 1: X = 0, Y = 68 (invisible, drives BG color)
├── Sprite 2: X = 0, Y = 68 (visible shine)
└── Sprite 3: X = -80, Y = 68 (trailing shine)

Effect:
└── Creates double-streak trailing effect
```

### Shine Animation Parameters
```c
// Sprite dimensions
#define SHINE_WIDTH   64
#define SHINE_HEIGHT  64

// Movement
#define SHINE_START_X      0
#define SHINE_START_Y      68
#define SHINE_SPEED        4   // pixels per frame
#define SHINE_DOUBLE_SPEED 8   // pixels per frame
#define SHINE_END_X        272 // DISPLAY_WIDTH + 32

// Double shine offset
#define SHINE_TRAIL_OFFSET -80 // trailing sprite X offset

// BG color modulation
#define SHINE_CENTER_X     120 // center of screen
#define SHINE_COLOR_STEP   2   // brightness change per frame
#define SHINE_MAX_BRIGHT   31  // max grayscale value
#define SHINE_GREEN_FLASH  RGB(24, 31, 12)
```

## Version Banner Animation

### Slide Animation (Phase 2)
```
Movement Path:
├── Start: Y = 2
├── End: Y = 66
├── Distance: 64 pixels
├── Speed: 1 pixel per frame
└── Duration: 64 frames

Alpha Blend:
├── Uses gTitleScreenAlphaBlend[64] lookup table
├── Index decrements each frame: 64 → 0
└── Effect: Fades from transparent to opaque
```

### Alpha Blend Table Structure
```c
// gTitleScreenAlphaBlend[64]
// Each entry is BLDALPHA_BLEND(EVA, EVB)

[0-15]:   Opaque → Semi-transparent
          EVA: 16, EVB: 0→15

[16-31]:  Semi-transparent → Transparent
          EVA: 15→1, EVB: 16

[32-63]:  Fully transparent (hold)
          EVA: 0, EVB: 16
```

### Sprite Positioning
```
Left Banner ("Emerald"):
├── X: 98 (fixed)
├── Y: 2 → 66 (animated)
├── Size: 64×32
└── Blend: Yes (alpha fade)

Right Banner ("Version"):
├── X: 162 (fixed)
├── Y: 2 → 66 (animated)
├── Size: 64×32
└── Blend: No (always opaque)
```

## Press Start Blink Animation

### Visibility Toggle
```
Blink Pattern:
├── Cycle: 16 frames
├── Visible: frames 0-7
└── Hidden: frames 8-15

Implementation:
  if (frameCounter % 16 < 8) {
    show_sprite();
  } else {
    hide_sprite();
  }
```

### Sprite Layout
```
5 sprites arranged horizontally:
├── Sprite 0: X = 64,  "PR"
├── Sprite 1: X = 96,  "ESS"
├── Sprite 2: X = 128, " ST"
├── Sprite 3: X = 160, "ART"
└── Sprite 4: X = 192, ""

Y Position: 108 (Press Start) or 148 (Copyright)
```

## Cloud Scrolling (BG1)

### Horizontal Scroll
```
Configuration:
├── Update Rate: Every 2 frames
├── Direction: Right to left (negative X offset)
├── Speed: Variable based on scanline effect
└── Wrapping: Seamless tile wrap

Offset Calculation:
  bg1XOffset -= 1;  // every 2 frames
  BG1HOFS = bg1XOffset;
```

### Scanline Wave Effect
```c
ScanlineEffect_InitWave(
  startLine: 0,
  endLine: 160,      // DISPLAY_HEIGHT
  amplitude: 4,      // pixels
  wavelength: 4,     // pixels
  phase: 0,
  targetReg: BG1HOFS,
  enabled: TRUE
);

Effect:
└── Creates subtle horizontal wave distortion
    Each scanline has slightly different X offset
    Creates "heat shimmer" or "underwater" look
```

## Logo Slide (BG2)

### Vertical Pan Animation
```
Phase 2 Animation:
├── Start: BG2Y = -32 * 256 (affine units)
├── End: BG2Y = 0
├── Update: Every 2 frames
└── Duration: ~144 frames

Affine Coordinates:
  GBA uses 8.8 fixed-point for affine BG positions
  Real pixels = affine_value / 256

Movement:
  tBg2Y increments by 1 every 2 frames
  BG2Y = tBg2Y * 256  // convert to affine units
```

## Rayquaza Marking Color Pulse

### Color Cycling Animation
```
Update Rate: Every 4 frames
Target: BG palette 14, color index 15
Effect: Pulsing reddish glow on Rayquaza marking

Color Calculation:
  frameNum = (gba_frame / 4) % 256
  intensity = Cos(frameNum, 128) + 128  // Range: 0-256

  red   = 31 - ((intensity * 32 - intensity) / 256)
  green = 31 - (intensity * 22 / 256)
  blue  = 12  // constant

  Result: Oscillates between bright and dim reddish color
```

### Cosine Table Lookup
```
Cos(angle, amplitude):
  Returns cosine wave value scaled by amplitude
  Used for smooth oscillation effects

  angle: 0-255 maps to 0-360 degrees
  amplitude: scales output range
```

## Animation Timing Summary

| Animation | Update Rate | Duration | Speed |
|-----------|-------------|----------|-------|
| Shine (single) | Every frame | ~68 frames | 4 px/frame |
| Shine (double) | Every frame | ~34 frames | 8 px/frame |
| Version slide | Every frame | 64 frames | 1 px/frame |
| Version fade | Every frame | 64 frames | 1 index/frame |
| Press Start blink | Every frame | Continuous | 16 frame cycle |
| Cloud scroll | Every 2 frames | Continuous | ~0.5 px/frame |
| Logo slide | Every 2 frames | 144 frames | ~0.5 px/frame |
| Rayquaza pulse | Every 4 frames | Continuous | 256 frame cycle |

## Frame-by-Frame Sequence

```
Frame 0 (Init complete):
├── All graphics loaded
├── White fade beginning
└── Double shine starting

Frame 80 (During Phase 1):
├── Shine effect active
├── BG colors modulating
└── No version banner yet

Frame 176 (Phase 1 midpoint):
└── New double shine triggered

Frame 192 (Late Phase 1):
└── Single shine with color mod triggered

Frame 256 (Phase 1 → Phase 2):
├── Version banner sprites created
├── Press Start sprite created (hidden)
└── Begin version slide animation

Frame 320 (Mid Phase 2):
├── Version banner at Y = 34
├── Alpha blend halfway
└── Logo sliding upward

Frame 400 (Phase 2 → Phase 3):
├── Version banner at Y = 66
├── Press Start visible
└── All continuous animations active

Frame 400+ (Phase 3):
├── Rayquaza color pulsing
├── Clouds scrolling
├── Press Start blinking
└── Periodic shine effects
```
