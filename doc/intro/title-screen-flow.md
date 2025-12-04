# Title Screen Flow & State Machine

## Overview

The title screen uses a task-based state machine with three main phases after initialization.

## Initialization (CB2_InitTitleScreen)

6 sequential states that prepare the title screen:

```
State 0: Hardware Reset
├── Clear VRAM, OAM, palette RAM
├── Reset DMA, sound, interrupt handlers
└── Clear all BG/sprite registers

State 1: Load Graphics
├── Decompress Pokemon logo (8bpp) → BG2 VRAM
├── Decompress Rayquaza (4bpp) → BG0 VRAM
├── Decompress Clouds (4bpp) → BG1 VRAM
├── Load tilemaps for all three layers
└── Load palettes

State 2: Create Main Task
├── CreateTask(Task_TitleScreenPhase1)
└── Initialize task counter = 256

State 3: Start Fade
├── BeginNormalPaletteFade (white fade in)
└── Set blend targets

State 4: Configure Display
├── Set GPU mode (MODE_1)
├── Configure BG control registers
├── Set affine camera position
├── Enable windows (WIN0, OBJWIN)
└── Start title music (MUS_TITLE)

State 5: Wait & Start Effects
├── Wait for fade completion
├── Start logo shine effect (SHINE_MODE_DOUBLE)
└── Initialize scanline wave effect on clouds
```

## Phase 1: Logo Shine (Task_TitleScreenPhase1)

**Duration:** 256 frames (~4.27 seconds at 60fps)

### Timeline

```
Frame 256 (Start)
    └── Initial double shine effect active

Frame 176
    └── Trigger new SHINE_MODE_DOUBLE

Frame 64
    └── Trigger SHINE_MODE_SINGLE (with BG color modulation)

Frame 0
    ├── Create Version Banner sprites
    ├── Create Press Start sprite (hidden initially)
    └── Transition to Phase2
```

### User Input
- **A/B/Start/Select:** Skip to Phase 2 immediately

### Shine Effect States
```c
enum ShineMode {
    SHINE_INACTIVE = 0,
    SHINE_MODE_SINGLE_NO_BG_COLOR = 1,  // Single shine, no BG tint
    SHINE_MODE_SINGLE = 2,               // Single shine with BG color mod
    SHINE_MODE_DOUBLE = 3                // Double shine effect (3 sprites)
};
```

## Phase 2: Version Banner (Task_TitleScreenPhase2)

**Duration:** 144 frames (~2.4 seconds)

### Animation Sequence

```
Start State:
├── Version Banner Y = 2
├── Blend alpha = maximum (transparent)
├── BG2 (Logo) offset = -32 * 256

Every Frame:
├── Banner Y += 1 (slides down: 2 → 66)
├── Blend index -= 1 (fade in effect)
├── BG2 Y offset increases (logo slides up)
└── BG1 scrolls (cloud movement begins)

End State (Frame 0):
├── Version Banner Y = 66 (final position)
├── Blend = opaque
├── Make Press Start sprite visible
└── Transition to Phase3
```

### Version Banner Positioning
```
Left Banner:   X = 98,  Y = 2 → 66
Right Banner:  X = 162, Y = 2 → 66
Travel Distance: 64 pixels vertical
```

## Phase 3: Interactive (Task_TitleScreenPhase3)

**Duration:** Infinite (until user input or music end)

### Continuous Animations

```
Every Frame:
├── Check user input
└── Update sprite animations

Every 2 Frames:
├── Scroll BG1 (clouds)
└── Update BG2 offset if needed

Every 4 Frames:
├── Update Rayquaza marking color (pulse effect)
└── Cycle through color intensity

Every 16 Frames:
└── Toggle Press Start visibility (blink effect)

Periodic:
└── Restart shine effect (loops)
```

### Input Handling

| Input | Action |
|-------|--------|
| A or Start | Fade out → Main Menu |
| B + Select + Up | Clear Save Data screen |
| B + Select + Left | Reset RTC screen (debug) |
| B + Select | Berry Fix Program |
| Music ends | Fade → Copyright Screen |

### State Transitions
```
User presses A/Start
    └── SetMainCallback2(CB2_GoToMainMenu)
        ├── FadeOutBGM(4)
        └── BeginNormalPaletteFade(black)

Music track ends
    └── SetMainCallback2(CB2_GoToCopyrightScreen)
```

## Timing Constants

```c
// Phase durations (frames)
#define PHASE1_DURATION     256
#define PHASE2_DURATION     144

// Animation timing
#define SHINE_SPEED         4     // pixels per frame
#define DOUBLE_SHINE_SPEED  8     // pixels per frame (2x)
#define VERSION_SLIDE_RATE  1     // pixels per frame
#define CLOUD_SCROLL_RATE   2     // frames between scroll updates
#define RAYQUAZA_PULSE_RATE 4     // frames between color updates
#define PRESS_START_BLINK   16    // frames per blink cycle

// Shine trigger frames
#define SHINE_TRIGGER_1     176   // First double shine
#define SHINE_TRIGGER_2     64    // Single shine with color

// Position constants
#define VERSION_BANNER_Y_START  2
#define VERSION_BANNER_Y_END    66
#define VERSION_BANNER_LEFT_X   98
#define VERSION_BANNER_RIGHT_X  162
#define PRESS_START_Y           108
#define COPYRIGHT_Y             148
```

## Callback Structure

```
Main Callbacks:
├── CB2_InitTitleScreen     (initialization)
├── MainCB2                 (main loop during display)
├── CB2_GoToMainMenu        (transition out)
├── CB2_GoToCopyrightScreen (auto-transition)
└── CB2_GoToClearSaveData   (debug option)

VBlank Callback:
└── VBlankCB
    ├── ProcessSpriteCopyRequests
    ├── LoadOam
    ├── ProcessPaletteRequests
    └── TransferPlttBuffer
```
