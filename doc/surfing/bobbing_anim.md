# Surfing Bobbing Animation Analysis

## Issue Summary

Three issues have been identified with the surfing bobbing animation:

1. **Player-to-Blob Vertical Offset** - Player may not be positioned correctly relative to the surf blob
2. **Sprite Cutoff** - May's surfing sprite appears to have hair cut off
3. **Synchronization Flickering** - Player and blob don't stay in perfect sync, causing visual judder

---

## Issue 1: Player-to-Blob Vertical Offset

### C Code Analysis

**File:** `src/field_effect_helpers.c` (lines 1107-1135)

```c
static void UpdateBobbingEffect(struct ObjectEvent *playerObj, struct Sprite *playerSprite, struct Sprite *sprite)
{
    // Update vertical position of surf blob
    if (((u16)(++sprite->sTimer) & intervals[sprite->sIntervalIdx]) == 0)
        sprite->y2 += sprite->sVelocity;

    // Reverse bob direction
    if ((sprite->sTimer & 15) == 0)
        sprite->sVelocity = -sprite->sVelocity;

    if (bobState != BOB_JUST_MON)
    {
        // Update vertical position of player
        if (!GetSurfBlob_HasPlayerOffset(sprite))
            playerSprite->y2 = sprite->y2;              // Player matches blob exactly
        else
            playerSprite->y2 = sprite->sPlayerOffset + sprite->y2;  // Player offset from blob
        
        sprite->x = playerSprite->x;
        sprite->y = playerSprite->y + 8;                // **BLOB IS 8 PIXELS BELOW PLAYER BASE**
    }
}
```

### Critical Finding: Blob Position

**Line 1132:** `sprite->y = playerSprite->y + 8;`

**This means:**
- The surf blob's **base Y position** is 8 pixels **below** the player's base Y position
- The blob and player bob together via `y2` offset
- When `sPlayerOffset` is 0, they bob in perfect sync
- When `sPlayerOffset` is set, the player bobs at an offset relative to the blob

### User Observation Verification

**User claim:** "Player should be 1 pixel higher than the blob"

**C code shows:** Blob is positioned **8 pixels below** player's base position (`sprite->y = playerSprite->y + 8`)

This is the OPPOSITE of what the user observed! The player is actually positioned HIGHER than the blob by 8 pixels at the base position. However, this could appear differently depending on sprite anchor points.

### React Implementation Check

The React code needs to verify:
1. Is the blob being rendered 8 pixels below the player's base Y?
2. Are both applying the same bobbing offset?

---

## Issue 2: Sprite Cutoff Analysis

### Sprite File

**File:** `public/pokeemerald/graphics/object_events/pics/people/may/surfing.png`

This is a 192x32 sprite sheet containing **6 frames** of 32x32 each:
- Frame 0: Down idle
- Frame 1: Down walk/action
- Frame 2: Up idle
- Frame 3: Up walk/action
- Frame 4: Left/Right idle
- Frame 5: Left/Right walk/action

### Expected Behavior

For a 32x32 surfing sprite, the player character should fit within the 32-pixel height. However, if hair extends above this, it would be cut off.

### C Code Sprite Rendering

The GBA uses 32x32 sprites for surfing state, with a 32-pixel tall sprite. If the artwork extends beyond this, the GBA would also clip it.

### Verification Needed

Need to check:
1. Does the May surfing sprite artwork extend beyond 32 pixels in height?
2. Is the React code applying correct sprite dimensions and Y offsets?
3. Is there a Y-offset issue causing the sprite to render too low?

---

## Issue 3: Synchronization Flickering (CRITICAL BUG FOUND)

### The Problem

The React code uses **smooth sine wave interpolation** while the GBA uses **discrete stepped bobbing**.

### C Code Bobbing Implementation

**File:** `src/field_effect_helpers.c` (lines 1109-1116)

```c
// The frame interval at which to update the blob's y movement.
// Normally every 4th frame, but every 8th frame while dismounting.
u16 intervals[] = {0x3, 0x7};

// Update vertical position of surf blob
if (((u16)(++sprite->sTimer) & intervals[sprite->sIntervalIdx]) == 0)
    sprite->y2 += sprite->sVelocity;  // **DISCRETE STEPS, NOT SMOOTH**

// Reverse bob direction every 16 frames
if ((sprite->sTimer & 15) == 0)
    sprite->sVelocity = -sprite->sVelocity;
```

**Key Points:**
1. **Update frequency:** Every 4 frames (`intervals[0] = 0x3` means update when `timer & 0x3 == 0`)
2. **Velocity:** `±1` pixel per update (initialized in `FldEff_SurfBlob`)
3. **Direction reversal:** Every 16 frames (`timer & 15 == 0`)
4. **Result:** Bob moves in DISCRETE 1-pixel steps, not smooth interpolation

### Bobbing Pattern

```
Frame:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19...
y2:     0  0  0  0 +1  0  0  0 +2  0  0  0 +3  0   0   0  +2  0  0  0 ...
        (no change on frames 1-3, changes frame 0,4,8,12...)
```

Actually, let me recalculate with the bitmask:
- `timer & 0x3 == 0` means timer values 0, 4, 8, 12, 16... trigger updates
- Updates every 4 frames
- Velocity is ±1
- Reverses every 16 frames

**Actual Pattern:**
```
Timer:  0   4   8  12  16  20  24  28  32...
y2:     0  +1  +2  +3  +4  +3  +2  +1   0...
        (goes up 4 pixels, then back down)
```

The bob range is -4 to +4 pixels over a 32-frame cycle.

### React Implementation (INCORRECT)

**File:** `src/game/surfing/SurfBlobRenderer.ts` (lines 63-78)

```typescript
public update(): void {
  this.bobPhase += this.BOB_SPEED;  // Continuous smooth increment
  if (this.bobPhase >= Math.PI * 2) {
    this.bobPhase -= Math.PI * 2;
  }
}

public getBobOffset(): number {
  return Math.sin(this.bobPhase) * this.BOB_AMPLITUDE;  // SMOOTH SINE WAVE
}
```

**Problems:**
1. Uses smooth `Math.sin()` instead of discrete steps
2. `BOB_AMPLITUDE = 2` (should be 4 to match GBA range of ±4)
3. `BOB_SPEED = 0.15` radians/frame = continuous smooth motion
4. No frame-based stepping (updates every frame, not every 4th)

### Why This Causes Flickering

**Root Cause:**
- Player bobbing offset is applied in `calculateSurfingFrameInfo()` using `getBobOffset()`
- Blob is rendered with same `getBobOffset()`
- However, `Math.sin()` produces **floating-point values**
- Player sprite rendering uses `Math.floor(this.y)` in various places
- Blob rendering may round differently
- **Rounding mismatch causes desyncing between player and blob**

Example:
```
Frame 1: bobOffset = 1.234 → player Y = floor(100.234) = 100, blob Y = floor(200.234) = 200
Frame 2: bobOffset = 1.567 → player Y = floor(100.567) = 100, blob Y = floor(200.567) = 200
Frame 3: bobOffset = 1.891 → player Y = floor(100.891) = 100, blob Y = floor(200.891) = 200
Frame 4: bobOffset = 2.001 → player Y = floor(102.001) = 102, blob Y = floor(202.001) = 202
```

If player and blob apply rounding at different points, they desync.

---

## Fixes Required

### Fix 1: Implement Discrete Stepped Bobbing

Replace smooth sine wave with GBA-accurate discrete stepping:

```typescript
export class SurfBlobRenderer {
  private bobTimer: number = 0;
  private bobVelocity: number = 1;  // +1 or -1
  private bobOffset: number = 0;    // Current Y offset (-4 to +4)
  
  public update(): void {
    this.bobTimer++;
    
    // Update bob position every 4 frames (timer & 0x3 == 0)
    if ((this.bobTimer & 0x3) === 0) {
      this.bobOffset += this.bobVelocity;
    }
    
    // Reverse direction every 16 frames (timer & 15 == 0)
    if ((this.bobTimer & 15) === 0) {
      this.bobVelocity = -this.bobVelocity;
    }
  }
  
  public getBobOffset(): number {
    return this.bobOffset;  // Returns integer, no floating point
  }
}
```

### Fix 2: Ensure Blob Positioned 8 Pixels Below Player

In the render code, ensure:
```typescript
const blobY = playerBaseY + 8 + bobOffset;
const playerY = playerBaseY + bobOffset;
```

### Fix 3: Check Sprite Cutoff

Verify May's surfing sprite rendering:
1. Ensure sprite is rendered from correct source Y (should be 0)
2. Ensure full 32-pixel height is rendered
3. Check if hair extends above 32 pixels in original sprite

---

## Summary of Findings

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Player-to-Blob Offset | Blob should be 8px below player base | Verify React renders blob at `playerY + 8` |
| Sprite Cutoff | May's sprite may extend beyond 32px | Check sprite dimensions and rendering rect |
| Sync Flickering | **Smooth sine wave vs discrete steps** + **Floating-point rounding** | **Replace with integer-based stepping** |

The synchronization issue is the most critical - the GBA uses discrete 1-pixel steps every 4 frames, NOT smooth interpolation. This causes the floating-point rounding mismatches that create visual judder.
