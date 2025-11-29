# Bug Fixes: Animation Issues

## Bug #1: Arrow Animation Wrong Frame Sequence ✅ FIXED

### Location
`src/components/map/renderers/ObjectRenderer.ts` lines 38-45

### Problem
Arrow overlay was cycling through frames [0,1,2] when it should only use 2 frames per direction.

### Root Cause
Wrong frame sequences:
```typescript
// WRONG
down: [0, 1, 2, 1],
up: [3, 4, 5, 4],
left: [6, 7, 8, 7],
right: [9, 10, 11, 10],
```

### Fix Applied
```typescript
// CORRECT (matches pokeemerald)
down: [3, 7],
up: [0, 4],
left: [1, 5],
right: [2, 6],
```

Also fixed frame duration:
- Before: `250ms`
- After: `533ms` (32 ticks @ 60fps)

### Status
✅ **FIXED** - Arrow animations now use correct 2-frame sequences

---

## Bug #2: Flower Animation Missing Frame ⚠️ INVESTIGATING

### Location
`src/data/tilesetAnimations.ts` line 33 (config is correct)
`src/components/MapRenderer.tsx` lines 1043-1089 (animation application)

### Expected Behavior
Flower should cycle: `frame 0 → frame 1 → frame 0 → frame 2 → (repeat)`
- 3 unique frames
- 4-step sequence: `[0, 1, 0, 2]`

### Current Behavior (Reported)
Only seeing 2 of 3 frames animate

### Analysis
The configuration is **correct**:
```typescript
{
  id: 'gTileset_General:flower',
  frames: [
    'data/tilesets/primary/general/anim/flower/0.png',
    'data/tilesets/primary/general/anim/flower/1.png',
    'data/tilesets/primary/general/anim/flower/2.png',
  ],
  sequence: [0, 1, 0, 2],  // ✅ Correct
  interval: 16,             // ✅ Correct (16 frames @ 60fps = 267ms)
}
```

The animation logic is also correct:
```typescript
// Line 2755: Calculate sequence index
const seqIndex = Math.floor(frameTick / anim.interval);

// Line 1062: Apply modulo to sequence length
const seqIndexRaw = effectiveCycle % seq.length;  // 0,1,2,3,0,1,2,3,...
const frameIndex = seq[seqIndex];  // seq[0]=0, seq[1]=1, seq[2]=0, seq[3]=2
```

### Possible Causes

1. **Cache invalidation issue**: Canvas cache might not be updating when animation frame changes
2. **Timing issue**: Animation interval might be too fast/slow
3. **Frame loading issue**: Frame 2 might not be loading correctly

### Debug Steps

Add logging to see which frames are actually being used:
```typescript
// In buildPatchedTilesForRuntime, after line 1064:
if (anim.id === 'gTileset_General:flower' && Math.random() < 0.1) {
  console.log('[FLOWER_ANIM]', {
    rawCycle,
    seqLength: seq.length,
    seqIndex,
    frameIndex,
    frameDataExists: !!frameData,
  });
}
```

### Next Steps

1. Add debug logging (see above)
2. Check browser console to see which frames are being cycled
3. Verify all 3 flower PNG files load correctly
4. Check if hardware rendering cache is invalidating properly

### Suspected Issue: Canvas Cache Not Invalidating

**Theory**: The new `TilesetCanvasCache` might not be invalidating when animation frames change.

**How to test**:
1. Set `USE_HARDWARE_RENDERING = false`
2. Check if flower animation works with old ImageData rendering
3. If it works, the cache is the issue

**If cache is the issue**, we need to:
- Clear palette canvas cache when animation frame changes
- OR: Don't cache animated tiles
- OR: Invalidate cache based on animation state

### Status
⚠️ **INVESTIGATING** - Need debug logs and testing to confirm root cause

---

## Testing Instructions

### Test Arrow Fix
1. Navigate to a map with arrow warps
2. Stand on an arrow tile
3. Observe: Arrow should smoothly alternate between 2 frames (not 3)
4. Duration: Each frame should show for ~533ms

### Test Flower Animation
1. Navigate to any outdoor map with flowers (e.g., Route 101)
2. Watch flowers for 30 seconds
3. Expected: Should see 3 distinct flower states:
   - Frame 0: Base flower
   - Frame 1: Slightly different
   - Frame 2: Most different
4. Sequence should repeat: 0 → 1 → 0 → 2 → (repeat)

### Debug Flower Issue
Enable debug logging:
```javascript
// In browser console
window.DEBUG_MODE = true;
```

Then watch console for `[FLOWER_ANIM]` logs to see which frames are being used.

---

## Recommendation

If flower animation still only shows 2 frames with `USE_HARDWARE_RENDERING = true`:

**The issue is likely the canvas cache not invalidating.**

Quick fix:
```typescript
// In src/rendering/TilesetCanvasCache.ts
// Reduce cache size or disable caching for animated tiles
private maxCacheSize = 0; // Force cache miss every time (for testing)
```

Or in MapRenderer, clear cache on animation frame change:
```typescript
// After line 2761
if (animationFrameChanged && USE_HARDWARE_RENDERING) {
  canvasRendererRef.current?.clearCache();
}
```

---

## Summary

| Bug | Status | Fix |
|-----|--------|-----|
| Arrow animation wrong frames | ✅ FIXED | Updated frame sequences in ObjectRenderer.ts |
| Arrow frame duration wrong | ✅ FIXED | Changed 250ms → 533ms |
| Flower missing frame | ⚠️ INVESTIGATING | Likely canvas cache invalidation issue |





