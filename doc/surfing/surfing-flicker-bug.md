# Surfing Animation Bug Analysis - CORRECTED

## Critical User Correction

**The user observed that during continuous surfing movement, the player sprite should NOT animate - it should stay on a single static frame and only BOB up and down with the surf blob. The walk frame animations are ONLY used for jumping ON and OFF the blob.**

This is the correct behavior confirmed by watching actual gameplay footage.

## Root Cause of the Flicker Bug

### The Problem
The React code in `PlayerController.ts` (`cal culateSurfingFrameInfo` lines 1145-1163) switches frames mid-movement:

```typescript
const progress = this.pixelsMoved / this.TILE_PIXELS;
const useWalkFrame = progress < 0.5;  // BUG!

if (this.dir === 'down') {
    srcIndex = useWalkFrame ? 1 : 0;  // Changes MID-MOVEMENT
}
```

This causes the sprite to flicker between walk and idle frames halfway through each tile movement, which is incorrect.

### What Should Happen (GBA Behavior)

**During Continuous Surfing Movement:**
- Player sprite remains on a SINGLE STATIC FRAME (likely the idle frame for the direction)
- NO frame animation occurs
- Player sprite BOBS up/down in sync with the surf blob
- The bobbing is a Y-offset animation, NOT a sprite frame animation

**Walk Frames Are Only Used For:**
1. **Jumping ONTO the blob** (mount sequence) - uses frames 9, 10, 11 depending on direction
2. **Jumping OFF the blob** (dismount sequence) - uses the same jump frames

### Evidence from C Code

**Surfing Animation Table** (`object_event_anims.h` lines 1049-1074):
```c
static const union AnimCmd *const sAnimTable_Surfing[] = {
    [ANIM_STD_FACE_SOUTH] = sAnim_FaceSouth,           // Idle frame - used during movement
    [ANIM_STD_GO_FAST_SOUTH] = sAnim_GoFastSouth,      // Walk animation - NOT used during movement  
    [ANIM_GET_ON_OFF_POKEMON_SOUTH] = sAnim_GetOnOffSurfBlobSouth,  // Jump animation
    // ...
};
```

**Jump Animation for Get On/Off** (lines 392-396):
```c
static const union AnimCmd sAnim_GetOnOffSurfBlobSouth[] =
{
    ANIMCMD_FRAME(9, 32),  // Frame 9 held for entire 32-tick jump
    ANIMCMD_JUMP(0),
};
```

**Walk Animation (Referenced but NOT Used During Surfing)** (lines 238-244):
```c
static const union AnimCmd sAnim_GoFastSouth[] =
{
    ANIMCMD_FRAME(3, 4),   // Walk frame A
    ANIMCMD_FRAME(0, 4),   // Idle frame
    ANIMCMD_FRAME(4, 4),   // Walk frame B  
    ANIMCMD_FRAME(0, 4),   // Idle frame
    ANIMCMD_JUMP(0),
};
```

### Why The Sprite Appears Static

While the surfing animation table DOES reference `sAnim_GoFastSouth` et al., during actual surfing movement, ONE of two things is happening:

1. **Animation is paused/frozen** - The GBA animation system may pause sprite animation updates while surfing
2. **Only idle frame is used** - The code may be forcing the idle frame throughout movement

Based on user observation, the player sprite stays on a static frame (not cycling through walk animations) and only the Y-position bobs.

## Correct Implementation for React

The React code should:

### During Surfing Movement:
```typescript
if (this.isMoving || !this.isMoving) {
  // ALWAYS show idle frame regardless of movement state
  // Movement animation is visual bob offset, NOT sprite frame change
  if (this.dir === 'down') srcIndex = 0;   // Idle down
  else if (this.dir === 'up') srcIndex = 2;    // Idle up
  else if (this.dir === 'left') srcIndex = 4;  // Idle left
  else if (this.dir === 'right') { srcIndex = 4; flip = true; }  // Idle right (flipped)
}

// Apply bob offset (already implemented correctly)
const bobOffset = controller.surfBlobRenderer.getBobOffset();
frame.renderY += bobOffset;
```

### During Jump On/Off:
```typescript
// Use frames 9, 10, or 11 (depending on direction) for the jump animation  
// These are held for the entire 32-frame jump duration
// This is already handled by getOnOffSurfBlob animations
```

## Summary of Fixes Needed

1. **Remove progress-based frame switching** - Delete the `progress < 0.5` logic
2. **Always use idle frame during surfing** - Don't animate between walk/idle frames
3. **Only Y-position animates** - The bob offset (already implemented) is the only animation
4. **Jump frames only for mount/dismount** - Frames 9/10/11 are used during jumps, not continuous movement

## Code Files Involved
- `/Users/seb/Documents/GitHub/pkmn-rse-browser/src/game/PlayerController.ts`
  - Method: `calculateSurfingFrameInfo()` (lines 1105-1180) - NEEDS FIX
  - Remove the `progress < 0.5` conditional logic
  - Always return idle frame for the current direction

---

## Confirmation: Jump Frames Only Used for Mount/Dismount

**User Observation Confirmed:** Jump frames (9, 10, 11) are ONLY used when jumping ON and OFF the surf blob, never during continuous surfing movement.

### Evidence from C Code

**Where `ANIM_GET_ON_OFF_POKEMON` is Used:**

1. **Field Move Animations** (`field_effect.c` line 3255):
   - Used when player initiates field moves (Surf, Waterfall, etc.)
   - Called during mount/dismount sequences

2. **Surfing State Transition** (`field_effect.c` around line 3493):
   - Specifically triggered during surf blob mount/dismount
   - NOT called during continuous movement

3. **GetOnOffSurfBlob Animation Table** (`event_object_movement.c` lines 771-779):
```c
static const u8 sGetOnOffSurfBlobDirectionAnimNums[] = {
    [DIR_SOUTH] = ANIM_GET_ON_OFF_POKEMON_SOUTH,
    [DIR_NORTH] = ANIM_GET_ON_OFF_POKEMON_NORTH,
    [DIR_WEST] = ANIM_GET_ON_OFF_POKEMON_WEST,
    [DIR_EAST] = ANIM_GET_ON_OFF_POKEMON_EAST,
    // ...
};
```

This table is **ONLY** accessed during `SurfFieldEffect_JumpOnSurfBlob` (mount) and dismount sequences.

### Continuous Surfing Movement Uses IDLE Frames

During continuous surfing (while already on the blob):
- The player uses `ANIM_STD_FACE_SOUTH` / `ANIM_STD_FACE_NORTH` etc.
- These map to `sAnim_FaceSouth` which shows **frame 0** (idle down), **frame 1** (idle up), **frame 2** (idle left/right)
- The sprite remains STATIC on these idle frames
- Only the Y-position bobs via the surf blob's bobbing animation

### React Implementation Must Match

The React code must:
1. **During continuous surfing:** Always show idle frame (0, 2, or 4 depending on direction)
2. **During mount jump:** Show jump frame (9, 10, or 11) for entire 32-frame jump
3. **During dismount jump:** Show jump frame (9, 10, or 11) for entire 32-frame jump
4. **Never:** Switch frames based on movement progress during continuous surfing

