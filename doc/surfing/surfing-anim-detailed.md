# Surfing Animation: Pixel-Perfect Implementation Guide

This document provides frame-by-frame, pixel-level details for implementing the surfing animation in Pokémon Emerald.

---

## Table of Contents
1. [Field Move Animation (Player Throws Poké Ball)](#1-field-move-animation)
2. [Cut-In Banner Effect (Window Manipulation)](#2-cut-in-banner-effect)
3. [Pokémon Slide-In Animation](#3-pokémon-slide-in)
4. [Jump Physics (Player Jumps onto Surf Blob)](#4-jump-physics)
5. [Surf Blob Behavior](#5-surf-blob-behavior)
6. [Dismount Sequence](#6-dismount-sequence)

---

## 1. Field Move Animation

**File:** `src/data/object_events/object_event_anims.h`  
**Animation:** `sAnim_FieldMove` (lines 382-390)

### Frame Sequence
```c
ANIMCMD_FRAME(0, 4),  // Frame 0 for 4 ticks
ANIMCMD_FRAME(1, 4),  // Frame 1 for 4 ticks
ANIMCMD_FRAME(2, 4),  // Frame 2 for 4 ticks
ANIMCMD_FRAME(3, 4),  // Frame 3 for 4 ticks
ANIMCMD_FRAME(4, 8),  // Frame 4 for 8 ticks
ANIMCMD_END,
```

### Timing
- **Total Duration:** 24 frames (4+4+4+4+8)
- **Frame Rate:** GBA runs at 59.7275 Hz
- **Real Time:** ~402ms

### Player Sprite Files
- **Brendan:** `graphics/object_events/pics/people/brendan/field_move.4bpp`
- **May:** `graphics/object_events/pics/people/may/field_move.4bpp`

Each sprite sheet should have 5 frames (indexed 0-4) showing the "taking out Poké Ball" animation.

---

## 2. Cut-In Banner Effect

**File:** `src/field_effect.c`  
**Functions:** `FieldMoveShowMonOutdoorsEffect_CreateBanner` (lines 2641-2670) and `FieldMoveShowMonOutdoorsEffect_ShrinkBanner` (lines 2680-2700)

### Initial Window State
```c
WIN_RANGE(DISPLAY_WIDTH, DISPLAY_WIDTH + 1)      // Horizontal: 240 to 241 (collapsed)
WIN_RANGE(DISPLAY_HEIGHT / 2, DISPLAY_HEIGHT / 2 + 1)  // Vertical: 80 to 81 (collapsed)
```

### Banner Expansion (Create Phase)

**Per-Frame Changes:**
- `horiz -= 16` (left edge moves left by 16 pixels)
- `vertHi -= 2` (top edge moves up by 2 pixels)
- `vertLo += 2` (bottom edge moves down by 2 pixels)

**Target Values:**
- `horiz = 0` (left edge reaches left screen edge)
- `vertHi = DISPLAY_HEIGHT / 4` = 40 (top edge at 1/4 screen height)
- `vertLo = DISPLAY_WIDTH / 2` = 120 (bottom edge at 1/2 screen WIDTH, note: this appears to be a bug/typo in the original code, likely should be DISPLAY_HEIGHT)

**Expansion Frames:**
- Horizontal: 240 / 16 = **15 frames**
- Vertical: 40 / 2 = **20 frames**
- **Expansion completes after 20 frames** (limited by vertical constraint)

### Banner Shrink (Close Phase)

**Per-Frame Changes:**
- `vertHi += 6` (top edge moves down by 6 pixels)
- `vertLo -= 6` (bottom edge moves up by 6 pixels)
- `horiz -= 16` (background continues scrolling left)

**Target Values:**
- `vertHi = DISPLAY_HEIGHT / 2` = 80
- `vertLo = DISPLAY_HEIGHT / 2 + 1` = 81

**Shrink Frames:**
- Vertical: (80 - 40) / 6 = 40 / 6 = **~7 frames** (ceil)

### Banner Assets
- **Tiles:** `graphics/field_effects/pics/field_move_streaks.4bpp`
- **Palette:** `graphics/field_effects/pics/field_move_streaks.gbapal`

### Window Masking
The banner uses **WIN0** (Window 0) to create a masked region:
- **WININ** (inside window): All backgrounds + objects + color effects
- **WINOUT** (outside window): BG1, BG2, BG3 + objects + color effects (BG0 is hidden outside the window)

This creates the "cut-in" effect where the streaks and Pokémon appear in the center band.

---

## 3. Pokémon Slide-In

**File:** `src/field_effect_helpers.c`  
**Function:** `SpriteCB_FieldMoveMonSlideOnscreen`

### Initial Position
- **X:** 320 (off-screen right)
- **Y:** 80 (vertical center)

### Slide Movement
The Pokémon sprite slides from right to left until it reaches the screen center. The exact slide speed and distance depend on the callback implementation, but the sprite moves horizontally until centered.

### Cry Playback
The Pokémon's cry is played during the slide-in (via `PlayCry_Normal`).

---

## 4. Jump Physics

**File:** `src/event_object_movement.c`

### Jump Parameters
- **Distance:** `JUMP_DISTANCE_NORMAL` = 1 tile (16 pixels)
- **Type:** `JUMP_TYPE_HIGH`
- **Duration:** 32 frames

### Vertical Offset Table (`sJumpY_High`)
```c
static const s8 sJumpY_High[] = {
     -4,  -6,  -8, -10, -11, -12, -12, -12,
    -11, -10,  -9,  -8,  -6,  -4,   0,   0
};
```

Each value represents the Y offset (in pixels) for each frame (timer >> 1).

### Horizontal Movement
For `JUMP_DISTANCE_NORMAL`:
- Horizontal movement occurs **every other frame** (`!(sprite->sTimer & 1)`)
- Total horizontal distance: 1 tile = 16 pixels
- Horizontal movement per frame (when moving): **1 pixel**
- Total frames with horizontal movement: 16 frames (out of 32 total)

### Frame-by-Frame Breakdown (32 frames @ 60fps)

| Frame | Timer | Y Index | Y Offset | X Offset | Notes |
|-------|-------|---------|----------|----------|-------|
| 0 | 0 | 0 | -4 | 0 | Jump start |
| 1 | 1 | 0 | -4 | 1 | Move right 1px |
| 2 | 2 | 1 | -6 | 1 | |
| 3 | 3 | 1 | -6 | 2 | |
| 4 | 4 | 2 | -8 | 2 | |
| 5 | 5 | 2 | -8 | 3 | |
| 6 | 6 | 3 | -10 | 3 | |
| 7 | 7 | 3 | -10 | 4 | |
| 8 | 8 | 4 | -11 | 4 | |
| 9 | 9 | 4 | -11 | 5 | |
| 10 | 10 | 5 | -12 | 5 | Peak #1 |
| 11 | 11 | 5 | -12 | 6 | |
| 12 | 12 | 6 | -12 | 6 | Peak #2 (halfway) |
| 13 | 13 | 6 | -12 | 7 | |
| 14 | 14 | 7 | -12 | 7 | Peak #3 |
| 15 | 15 | 7 | -12 | 8 | |
| 16 | 16 | 8 | -11 | 8 | HALFWAY - grid shift occurs |
| 17 | 17 | 8 | -11 | 9 | |
| 18 | 18 | 9 | -10 | 9 | |
| 19 | 19 | 9 | -10 | 10 | |
| 20 | 20 | 10 | -9 | 10 | |
| 21 | 21 | 10 | -9 | 11 | |
| 22 | 22 | 11 | -8 | 11 | |
| 23 | 23 | 11 | -8 | 12 | |
| 24 | 24 | 12 | -6 | 12 | |
| 25 | 25 | 12 | -6 | 13 | |
| 26 | 26 | 13 | -4 | 13 | |
| 27 | 27 | 13 | -4 | 14 | |
| 28 | 28 | 14 | 0 | 14 | Landing #1 |
| 29 | 29 | 14 | 0 | 15 | |
| 30 | 30 | 15 | 0 | 15 | Landing #2 |
| 31 | 31 | 15 | 0 | 16 | Final position |

### Grid Coordinate System
- At **frame 16** (halfway), the object event's grid coordinates shift forward by 1 tile
- The sprite's visual position (x2, y2) continues to interpolate smoothly
- This creates the illusion of a continuous 1-tile jump

### Jump Special Animation
The jump uses directional animations defined in `sAnim_GetOnOffSurfBlobXXXX` (lines 392-414 in `object_event_anims.h`):
```c
// Example for South direction
ANIMCMD_FRAME(9, 32),  // Show frame 9 for the entire 32-frame jump
ANIMCMD_JUMP(0),
```

---

## 5. Surf Blob Behavior

**File:** `src/field_effect_helpers.c`  
**Function:** `FldEff_SurfBlob` and `UpdateSurfBlobFieldEffect`

### Sprite Creation
- **Template:** `gFieldEffectObjectTemplate_SurfBlob`
- **Graphics:** `graphics/field_effects/pics/surf_blob.4bpp` (32x32 pixels)
- **Size:** 32x32 pixels
- **Priority:** 150 (rendered under player but above water tiles)
- **Palette:** Tag 0 (dynamic/system palette)

### Positioning
The blob is created at the **destination coordinates** (1 tile ahead of the player's current position in the direction they're facing).

```c
SetSpritePosToOffsetMapCoords(&gFieldEffectArguments[0], &gFieldEffectArguments[1], 8, 8);
```

This centers the 32x32 blob sprite on the 16x16 tile grid.

### Bobbing Animation
After the player lands on the blob, the bobbing state is set to `BOB_PLAYER_AND_MON`, causing both the player and blob sprites to bob up and down in sync.

The exact bobbing pattern is implementation-specific but typically involves a small sinusoidal vertical offset (e.g., ±1-2 pixels) over a ~30-60 frame cycle.

---

## 6. Dismount Sequence

**File:** `src/field_player_avatar.c`  
**Functions:** `CreateStopSurfingTask`, `Task_StopSurfingInit`, `Task_WaitStopSurfing`

### Trigger Condition
- Player is surfing (`PLAYER_AVATAR_FLAG_SURFING`)
- Player attempts to move to a tile with **elevation 3** (land)
- No object is blocking the target tile

### Dismount Sequence

1. **Lock Controls**
   - `LockPlayerFieldControls()`
   - `gPlayerAvatar.preventStep = TRUE`

2. **Update Flags**
   - Clear `PLAYER_AVATAR_FLAG_SURFING`
   - Set `PLAYER_AVATAR_FLAG_ON_FOOT`

3. **Blob Bobbing**
   - `SetSurfBlob_BobState(BOB_JUST_MON)`
   - Stops player from bobbing, blob continues (or stops) bobbing

4. **Jump Off Water**
   - Execute `GetJumpSpecialMovementAction` in the movement direction
   - Same jump physics as mounting (32 frames, `JUMP_TYPE_HIGH`)
   - Player sprite remains in surfing pose during jump

5. **Wait for Jump Completion**
   - Task waits for `ObjectEventClearHeldMovementIfFinished` to return TRUE

6. **Change to Walking Sprite**
   - `ObjectEventSetGraphicsId(PLAYER_AVATAR_STATE_NORMAL)`
   - Switches from surfing sprite to walking sprite

7. **Cleanup**
   - `DestroySprite(&gSprites[playerObjEvent->fieldEffectSpriteId])`
   - Removes the surf blob sprite from the scene

8. **Unlock Controls**
   - `gPlayerAvatar.preventStep = FALSE`
   - `UnlockPlayerFieldControls()`

### Total Dismount Time
- **Jump:** 32 frames (~535ms)
- **Sprite change + cleanup:** 1-2 frames
- **Total:** ~34 frames (~570ms)

---

## Implementation Constants

### Display Constants
```c
#define DISPLAY_WIDTH  240
#define DISPLAY_HEIGHT 160
```

### Jump Constants
```c
#define JUMP_DISTANCE_NORMAL 1    // Index for 1-tile jump
#define JUMP_TYPE_HIGH       0    // High jump arc
#define JUMP_HALFWAY         1    // Return value at halfway point
#define JUMP_FINISHED        0xFF // Return value when complete
```

### Timing Constants
- **Jump Duration (Normal):** 32 frames
- **Jump Duration (Far):** 64 frames
- **Jump Duration (In Place):** 32 frames
- **Field Move Anim:** 24 frames
- **Banner Expansion:** ~20 frames
- **Banner Shrink:** ~7 frames
- **Pokémon Slide-In:** Variable (until centered)

### Total Surfing Start Sequence
1. Field Move Animation: **24 frames**
2. Banner Expansion: **20 frames**
3. Pokémon Visible + Cry: **~60 frames** (wait for cry + delay)
4. Banner Shrink: **7 frames**
5. Jump onto Blob: **32 frames**

**Total:** ~143 frames (~2.4 seconds)

---

## React/Canvas Implementation Notes

### Coordinate System
- GBA uses a 240x160 screen resolution
- Map coordinates are in 16x16 tiles
- Sprite positions are in pixels relative to the camera
- Objects have both grid coordinates (tile-based) and visual coordinates (pixel-based)

### Rendering Layers (Bottom to Top)
1. **BG2/BG3:** Map tiles (water, grass, etc.)
2. **Surf Blob Sprite:** Priority 150
3. **Player Sprite:** Priority 1-2
4. **BG1:** UI elements
5. **BG0/WIN0:** Cut-in banner (only during field move cutscene)

### Jump Implementation
```typescript
interface JumpState {
  timer: number;           // 0-31 for normal jump
  direction: Direction;
  type: JumpType;
  distance: JumpDistance;
  startX: number;         // Grid coordinates
  startY: number;
  targetX: number;
  targetY: number;
}

function updateJump(state: JumpState): { x: number, y: number, complete: boolean } {
  const yIndex = state.timer >> 1;  // Divide timer by 2
  const yOffset = JUMP_Y_HIGH[yIndex] || 0;
  
  let xOffset = 0;
  // Move horizontally every other frame
  if (state.distance !== JUMP_DISTANCE_IN_PLACE && (state.timer & 1)) {
    xOffset = Math.floor(state.timer / 2);
  }
  
  // At halfway point, shift grid coordinates
  if (state.timer === 16) {
    state.startX = state.targetX;
    state.startY = state.targetY;
  }
  
  state.timer++;
  
  return {
    x: xOffset,
    y: yOffset,
    complete: state.timer >= 32
  };
}
```

### Window Masking
For the banner effect, you'll need to implement a clipping region that expands/shrinks:

```typescript
interface WindowState {
  left: number;    // 0-240
  top: number;     // 0-160
  right: number;   // 0-240
  bottom: number;  // 0-160
}

function updateBannerExpansion(state: WindowState): boolean {
  state.left = Math.max(0, state.left - 16);
  state.top = Math.max(40, state.top - 2);
  state.bottom = Math.min(120, state.bottom + 2);
  
  return state.left === 0 && state.top === 40 && state.bottom === 120;
}

function updateBannerShrink(state: WindowState): boolean {
  state.top = Math.min(80, state.top + 6);
  state.bottom = Math.max(81, state.bottom - 6);
  
  return state.top === 80 && state.bottom === 81;
}
```

---

## Asset Checklist

- [ ] `brendan/field_move.4bpp` - 5 frames
- [ ] `may/field_move.4bpp` - 5 frames
- [ ] `brendan/surfing.4bpp` - Full sprite sheet
- [ ] `may/surfing.4bpp` - Full sprite sheet
- [ ] `field_effects/pics/surf_blob.4bpp` - 32x32 sprite
- [ ] `field_effects/pics/field_move_streaks.4bpp` - Banner tiles
- [ ] `field_effects/pics/field_move_streaks.gbapal` - Banner palette
- [ ] Pokémon sprite for the field move mon (species-specific)

---

## Testing Checklist

- [ ] Field move animation plays for 24 frames
- [ ] Banner expands smoothly over 20 frames
- [ ] Pokémon slides in from x=320 to center
- [ ] Pokémon cry plays during slide-in
- [ ] Banner shrinks over ~7 frames
- [ ] Player jumps with correct arc (32 frames)
- [ ] Player lands on blob at correct position
- [ ] Blob renders under player
- [ ] Player and blob bob together while surfing
- [ ] Dismount jump has same physics as mount jump
- [ ] Blob disappears after landing on shore
- [ ] Player switches back to walking sprite after landing
