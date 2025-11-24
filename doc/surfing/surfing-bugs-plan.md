# Surfing System Bug Investigation & Fix Plan

**Date:** 2025-11-23
**Status:** Investigation Complete - Ready for Implementation

---

## Executive Summary

This document details 9 surfing-related bugs identified through code investigation and comparison with the pokeemerald C source code. Each bug includes root cause analysis and proposed fixes.

---

## Bug #1: Dialog Confirmation (X/A Button) Issue

### Problem
Pressing X key (A button in Pokemon) when dialog shows YES/NO doesn't confirm the selection. User must **click** YES for it to work.

### Root Cause
In `src/components/dialog/types.ts:67`, the `advanceKeys` array contains:
```typescript
advanceKeys: ['Space', 'Enter', 'KeyZ'],
cancelKeys: ['Escape', 'KeyX'],
```

**X key is mapped to CANCEL, not CONFIRM.** In Pokemon games, A button confirms selections.

### Investigation Evidence
- `DialogContext.tsx:313` - Keyboard handler uses `config.advanceKeys.includes(e.code)` for confirmation
- X (KeyX) is in `cancelKeys`, which triggers cancel behavior, not confirm

### Fix
Add `'KeyX'` to `advanceKeys` in `DEFAULT_DIALOG_CONFIG`:
```typescript
advanceKeys: ['Space', 'Enter', 'KeyZ', 'KeyX'],
cancelKeys: ['Escape'],  // Remove KeyX from cancel
```

### Affected Files
- `src/components/dialog/types.ts`

---

## Bug #2: Dialog Text Should Say "LAPRAS used SURF!"

### Problem
Dialog currently says:
> "The water is a deep blue... Would you like to SURF?"

It should say:
> "LAPRAS used SURF!" (or similar Pokemon-style message)

### Root Cause
In `src/components/MapRenderer.tsx:2164-2166`:
```typescript
const wantToSurf = await dialog.showYesNo(
  "The water is a deep blue...\nWould you like to SURF?",
  { defaultYes: true }
);
```

Text is hardcoded and doesn't match Pokemon Emerald format.

### Investigation Evidence
From `public/pokeemerald/data/text/surf.inc:6`:
```
.string "{STR_VAR_1} used SURF!$"
```

The original game shows the Pokemon name that knows Surf.

### Fix
Change dialog text to:
```typescript
const wantToSurf = await dialog.showYesNo(
  "LAPRAS used SURF!",  // Placeholder Pokemon name for now
  { defaultYes: true }
);
```

### Affected Files
- `src/components/MapRenderer.tsx`

---

## Bug #3: Surf Animation Has No Transparency

### Problem
The surf blob sprite renders with its background color (cyan) instead of being transparent.

### Root Cause
In `src/game/surfing/SurfBlobRenderer.ts:22-35`, the sprite is loaded directly:
```typescript
private async loadSprite(): Promise<void> {
  const img = new Image();
  img.onload = () => {
    this.sprite = img;  // No transparency processing!
    resolve();
  };
  img.src = '/pokeemerald/graphics/field_effects/pics/surf_blob.png';
}
```

Compare with `PlayerController.loadSprite()` which removes background color:
```typescript
// Assume top-left pixel is the background color
const bgR = data[0];
const bgG = data[1];
const bgB = data[2];
// Replace all matching pixels with transparent
for (let i = 0; i < data.length; i += 4) {
  if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
    data[i + 3] = 0; // Alpha 0
  }
}
```

### Fix
Add background color removal to `SurfBlobRenderer.loadSprite()`:
```typescript
private async loadSprite(): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = data[0], bgG = data[1], bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      this.sprite = canvas;
      resolve();
    };
    img.onerror = reject;
    img.src = '/pokeemerald/graphics/field_effects/pics/surf_blob.png';
  });
}
```

### Affected Files
- `src/game/surfing/SurfBlobRenderer.ts`

---

## Bug #4: Bob Animation Offset From Player (Centering)

### Problem
The surf blob appears offset from the player, not centered under them.

### Root Cause
In `src/components/MapRenderer.tsx:1929-1937`:
```typescript
const blobWorldX = player.x; // Player's current pixel X
const blobWorldY = player.y + 16; // Player's feet position
const screenX = Math.round(blobWorldX - view.cameraWorldX);
const screenY = Math.round(blobWorldY - view.cameraWorldY);
blobRenderer.render(mainCtx, screenX, screenY, player.dir);
```

**Issue:** Surf blob is 32px wide, player sprite is 16px wide. The blob is left-aligned with player instead of centered.

### Fix
Center the blob horizontally:
```typescript
// Center blob under player: blob is 32px wide, player is 16px wide
// Offset by (32 - 16) / 2 = 8 pixels to the left
const screenX = Math.round(blobWorldX - 8 - view.cameraWorldX);
```

### Affected Files
- `src/components/MapRenderer.tsx`

---

## Bug #5: Blob Size - Only ~50% Height Renders

### Problem
The surf blob sprite appears cropped, showing only part of its height.

### Root Cause
In `src/game/surfing/SurfBlobRenderer.ts:14-16`:
```typescript
private readonly FRAME_WIDTH = 32;
private readonly FRAME_HEIGHT = 16;  // WRONG!
```

Inspecting `surf_blob.png`: The sprite sheet is 96x32 (3 frames of 32x32), NOT 32x16.

### Investigation Evidence
Visual inspection of surf_blob.png shows it's taller than 16 pixels - the blob has water ripple effects that extend below.

### Fix
Update dimensions in SurfBlobRenderer:
```typescript
private readonly FRAME_WIDTH = 32;
private readonly FRAME_HEIGHT = 32;  // Correct height
```

Also update the positioning in MapRenderer.tsx to account for the taller sprite.

### Affected Files
- `src/game/surfing/SurfBlobRenderer.ts`
- `src/components/MapRenderer.tsx` (positioning adjustment)

---

## Bug #6: Player Sprite Doesn't Bob With Blob

### Problem
The blob bobbing animation works but the player sprite doesn't bob with it - player appears to float stationary above the bobbing water.

### Root Cause
In `src/game/PlayerController.ts:359-362`:
```typescript
getFrameInfo(controller: PlayerController): FrameInfo | null {
  // TODO: Use surfing sprite when available
  return controller.calculateFrameInfo('walking');
  // No bob offset applied to player!
}
```

The bob offset from `SurfBlobRenderer.getBobOffset()` is only used for rendering the blob, not the player.

### Fix
Apply bob offset to player sprite when surfing:
```typescript
getFrameInfo(controller: PlayerController): FrameInfo | null {
  const frame = controller.calculateFrameInfo('surfing');
  if (frame) {
    // Apply bob offset to player Y position
    const bobOffset = controller.surfBlobRenderer.getBobOffset();
    frame.renderY += bobOffset;
  }
  return frame;
}
```

### Affected Files
- `src/game/PlayerController.ts` (SurfingState.getFrameInfo)

---

## Bug #7: Player Sprite Doesn't Change to Surfing Sprite

### Problem
Player uses walking.png instead of brendan/surfing.png or may/surfing.png while surfing.

### Root Cause

1. **Surfing sprite never loaded:**
   In `MapRenderer.tsx:2226-2228`:
   ```typescript
   await player.loadSprite('walking', '/pokeemerald/.../brendan/walking.png');
   await player.loadSprite('running', '/pokeemerald/.../brendan/running.png');
   // Missing: surfing sprite!
   ```

2. **SurfingState uses wrong sprite:**
   In `PlayerController.ts:359-362`:
   ```typescript
   getFrameInfo(controller: PlayerController): FrameInfo | null {
     return controller.calculateFrameInfo('walking');  // Hardcoded 'walking'!
   }
   ```

3. **calculateFrameInfo doesn't handle surfing sprite layout:**
   The surfing sprite has different frame organization than walking sprite.

### Investigation Evidence
From `public/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png`:
- Sprite sheet shows player riding a Pokemon (Lapras-like shape)
- 4 directional frames (down, up, left/right with flip)
- Sprite is 32x32 per frame

### Fix
1. Load surfing sprite in MapRenderer:
   ```typescript
   await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
   ```

2. Update SurfingState.getFrameInfo:
   ```typescript
   getFrameInfo(controller: PlayerController): FrameInfo | null {
     return controller.calculateFrameInfo('surfing');
   }
   ```

3. Update calculateFrameInfo to handle 32x32 surfing frames with different layout.

### Affected Files
- `src/components/MapRenderer.tsx` (load surfing sprite)
- `src/game/PlayerController.ts` (SurfingState.getFrameInfo, calculateFrameInfo)

---

## Bug #8: No Speed Increase While Surfing

### Problem
Surfing uses the same speed as walking. In the original game, surfing is faster (same as running).

### Root Cause
In `src/game/PlayerController.ts:262-263`:
```typescript
class SurfingState implements PlayerState {
  private readonly SPEED = 0.06; // Same as walking!
```

### Investigation Evidence
From `public/pokeemerald/src/event_object_movement.c:48`:
```c
enum {
    MOVE_SPEED_NORMAL, // walking
    MOVE_SPEED_FAST_1, // running / surfing / sliding (ice tile)
    MOVE_SPEED_FAST_2, // water current / acro bike
    ...
};
```

**Surfing uses `MOVE_SPEED_FAST_1`** - same as running!

### Fix
Update SurfingState.SPEED to match running:
```typescript
class SurfingState implements PlayerState {
  private readonly SPEED = 0.12; // Same as running (MOVE_SPEED_FAST_1)
```

### Affected Files
- `src/game/PlayerController.ts`

---

## Bug #9: Can Surf on Land / Dismount Doesn't Work

### Problem
Player can continue surfing on land tiles. The game should automatically dismount when player moves onto a non-water walkable tile.

### Root Cause
In `src/game/PlayerController.ts:299-356`, the `SurfingState.handleInput()` method:

1. Checks `canDismount()` but doesn't block movement to non-surfable tiles
2. If target is NOT surfable AND NOT dismountable, movement is still blocked via `isSurfableBehavior(behavior)` check - but this just prevents starting movement, not properly handling the collision

3. The issue is that `isCollisionAt` (line 997-1014) blocks water tiles for NON-surfing players:
   ```typescript
   const surfBlockers = new Set([MB_POND_WATER, ...]);
   if (surfBlockers.has(behavior)) {
     return true; // BLOCKED
   }
   ```

   But there's no corresponding check that blocks LAND tiles for SURFING players.

### Investigation Evidence
From `public/pokeemerald/src/field_player_avatar.c`:
- Surfing state should only allow movement on surfable tiles
- When moving toward land, player should dismount automatically

### Fix
Update `SurfingState.handleInput()` to properly handle movement:

```typescript
handleInput(controller: PlayerController, keys: { [key: string]: boolean }): void {
  // ... direction detection code ...

  if (attemptMove) {
    controller.dir = newDir;
    const targetTileX = controller.tileX + dx;
    const targetTileY = controller.tileY + dy;

    const resolved = controller.tileResolver?.(targetTileX, targetTileY);
    const behavior = resolved?.attributes?.behavior ?? -1;

    if (isSurfableBehavior(behavior)) {
      // Target is water - allow movement
      controller.isMoving = true;
      controller.pixelsMoved = 0;
    } else if (this.surfingController.canDismount(targetTileX, targetTileY, controller.tileResolver ?? undefined)) {
      // Target is land we can walk on - trigger dismount
      this.surfingController.startDismountSequence();
      controller.isMoving = true;
      controller.pixelsMoved = 0;
      // After movement completes, change state to NormalState
    } else {
      // Target is blocked (not water, not walkable land)
      // Do nothing - player can't move there
    }
  }
}
```

Also need to handle the state transition when dismount completes.

### Affected Files
- `src/game/PlayerController.ts` (SurfingState)
- `src/game/surfing/SurfingController.ts` (dismount completion callback)

---

## Implementation Priority Order

Recommended order based on severity and dependencies:

| Priority | Bug | Severity | Effort |
|----------|-----|----------|--------|
| 1 | #1 Dialog X key confirm | High | Low |
| 2 | #3 Transparency | High | Low |
| 3 | #5 Blob height | High | Low |
| 4 | #4 Bob centering | Medium | Low |
| 5 | #6 Player bobbing | Medium | Low |
| 6 | #8 Speed increase | Medium | Low |
| 7 | #2 Dialog text | Low | Low |
| 8 | #7 Surfing sprite | Medium | Medium |
| 9 | #9 Dismount logic | High | High |

---

## Files To Modify

1. **`src/components/dialog/types.ts`** - Bug #1 (advanceKeys)
2. **`src/game/surfing/SurfBlobRenderer.ts`** - Bugs #3, #5 (transparency, height)
3. **`src/components/MapRenderer.tsx`** - Bugs #2, #4, #7 (dialog text, centering, load sprite)
4. **`src/game/PlayerController.ts`** - Bugs #6, #7, #8, #9 (bobbing, sprite, speed, dismount)
5. **`src/game/surfing/SurfingController.ts`** - Bug #9 (dismount callback)

---

## Testing Checklist

- [ ] Press X on YES/NO dialog to confirm selection
- [ ] Dialog shows "LAPRAS used SURF!" message
- [ ] Surf blob has transparent background (no cyan)
- [ ] Surf blob centered under player
- [ ] Surf blob full height visible
- [ ] Player sprite bobs with surf blob
- [ ] Player uses surfing sprite while surfing
- [ ] Surfing speed matches running speed
- [ ] Player dismounts when moving to land
- [ ] Player cannot surf onto non-water non-walkable tiles

---

## References

- `public/pokeemerald/src/event_object_movement.c` - Speed constants
- `public/pokeemerald/src/field_player_avatar.c` - Surfing state logic
- `public/pokeemerald/data/text/surf.inc` - Dialog text
- `public/pokeemerald/graphics/field_effects/pics/surf_blob.png` - Sprite dimensions
- `public/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png` - Player surfing sprite
