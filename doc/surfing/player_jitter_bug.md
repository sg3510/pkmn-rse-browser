# Player Surfing Movement Jitter Bug

## Problem Description

When surfing and moving (up/down/left/right), the player sprite jitters/flickers on top of the surf blob, even though the blob itself bobs smoothly.

## Root Cause

The issue is a **coordinate rounding mismatch** between how the player position and bob offset are calculated.

### Current Code Flow

**File:** `src/game/PlayerController.ts`

1. **Player position calculation** (`calculateSurfingFrameInfo` lines 1121-1123):
```typescript
const renderX = Math.floor(this.x) - 8;
const renderY = Math.floor(this.y);
```

2. **Bob offset added** (`SurfingState.getFrameInfo` line 377):
```typescript
const bobOffset = controller.surfBlobRenderer.getBobOffset();  // Floating-point
frame.renderY += bobOffset;
```

3. **Final render position**:
```typescript
renderY = Math.floor(this.y) + Math.sin(bobPhase) * 2
```

### The Problem

During movement, `this.x` and `this.y` change smoothly in sub-pixel increments:
```
Frame 1: this.y = 100.00 → renderY = floor(100.00) + bobOffset = 100 + bobOffset
Frame 2: this.y = 100.12 → renderY = floor(100.12) + bobOffset = 100 + bobOffset
Frame 3: this.y = 100.24 → renderY = floor(100.24) + bobOffset = 100 + bobOffset
...
Frame 9: this.y = 100.96 → renderY = floor(100.96) + bobOffset = 100 + bobOffset
Frame 10: this.y = 101.08 → renderY = floor(101.08) + bobOffset = 101 + bobOffset  ← JUMP!
```

**The `Math.floor()` causes sudden 1-pixel jumps when `this.y` crosses an integer boundary, breaking the smooth movement.**

Additionally, the bob offset is a floating-point sine wave, which creates further sub-pixel rendering issues.

## Compounding Issue: Blob vs Player Rendering

The surf blob is rendered with:
```typescript
// SurfBlobRenderer.render()
const bobOffset = this.getBobOffset();  // Smooth sine wave
ctx.drawImage(..., x, y + bobOffset, ...);
```

The player is rendered with:
```typescript
// PlayerController.render()
const destY = frame.renderY - cameraY;  // frame.renderY includes Math.floor(this.y)
ctx.drawImage(..., destX, destY, ...);
```

**Result:** 
- Blob bobs smoothly at floating-point positions
- Player position has `Math.floor()` applied to base position, then bob added
- They desync because of the floor() operation on player but not blob

## Solution

### Option 1: Remove Math.floor() from Surfing Player Position

The player should render at smooth sub-pixel positions while surfing, just like the blob does.

**Fix in `calculateSurfingFrameInfo()`:**

```typescript
public calculateSurfingFrameInfo(): FrameInfo | null {
  const sprite = this.sprites['surfing'];
  if (!sprite) {
    return this.calculateFrameInfo('walking');
  }

  const SURF_FRAME_WIDTH = 32;
  const SURF_FRAME_HEIGHT = 32;

  // DO NOT floor while surfing - allow smooth sub-pixel positioning
  const renderX = this.x - 8;  // Remove Math.floor()
  const renderY = this.y;      // Remove Math.floor()

  // ... rest of function
}
```

### Option 2: Floor Both Player AND Bob Offset Together

Apply flooring AFTER adding the bob offset, not before.

**Fix in `SurfingState.getFrameInfo()`:**

```typescript
getFrameInfo(controller: PlayerController): FrameInfo | null {
  const frame = controller.calculateSurfingFrameInfo();
  if (frame) {
    const bobOffset = controller.surfBlobRenderer.getBobOffset();
    // Apply bob offset, THEN floor the final result
    frame.renderY = Math.floor(frame.renderY + bobOffset);
    frame.renderX = Math.floor(frame.renderX);
  }
  return frame;
}
```

**And update `calculateSurfingFrameInfo()` to NOT floor:**

```typescript
const renderX = this.x - 8;  // No Math.floor()
const renderY = this.y;      // No Math.floor()
```

### Option 3: Ensure Blob Uses Same Rounding

Make the blob also use `Math.floor()` on its final position.

**Fix in `SurfBlobRenderer.render()`:**

```typescript
public render(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: SurfBlobDirection
): void {
  if (!this.sprite) return;
  
  const bobOffset = this.getBobOffset();
  const frameIndex = this.getFrameIndex(direction);
  const sourceX = frameIndex * this.FRAME_WIDTH;
  const flip = direction === 'right';
  
  // Floor the final position to match player rounding
  const finalX = Math.floor(x);
  const finalY = Math.floor(y + bobOffset);
  
  ctx.save();
  
  if (flip) {
    ctx.translate(finalX + this.FRAME_WIDTH, finalY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      this.sprite,
      sourceX, 0,
      this.FRAME_WIDTH, this.FRAME_HEIGHT,
      0, 0,
      this.FRAME_WIDTH, this.FRAME_HEIGHT
    );
  } else {
    ctx.drawImage(
      this.sprite,
      sourceX, 0,
      this.FRAME_WIDTH, this.FRAME_HEIGHT,
      finalX, finalY,
      this.FRAME_WIDTH, this.FRAME_HEIGHT
    );
  }
  
  ctx.restore();
}
```

## Recommended Solution

**Option 1 is recommended** - remove `Math.floor()` from surfing player position calculation.

**Reasoning:**
1. Simpler - only changes one location
2. Allows smooth movement during surfing (matching the smooth bob)
3. GBA sprites render at sub-pixel positions during movement
4. Only floor when rendering to screen (which canvas does automatically)

**However**, we need to verify this doesn't break anything else. If image smoothing is enabled, sub-pixel rendering will cause blurriness.

**Implementation:**

1. Update `calculateSurfingFrameInfo()` to remove `Math.floor()`
2. Ensure `ctx.imageSmoothingEnabled = false` is set before rendering (already done in `PlayerController.render()` line 1202)
3. Let the canvas handle final pixel snapping

##Files to Modify

- `/Users/seb/Documents/GitHub/pkmn-rse-browser/src/game/PlayerController.ts`
  - Method: `calculateSurfingFrameInfo()` (lines 1121-1123)
  - Change: Remove `Math.floor()` from `renderX` and `renderY`
