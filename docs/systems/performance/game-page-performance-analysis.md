---
title: GamePage.tsx Performance Analysis
status: reference
last_verified: 2026-01-13
---

# GamePage.tsx Performance Analysis

> Deep investigation of performance bottlenecks in the WebGL game renderer

## Executive Summary

The `GamePage.tsx` component exhibits several significant performance issues that impact smoothness, especially on lower-end devices. The most impactful issues are:

1. **Hybrid WebGL/Canvas2D Compositing** - Multiple GPU→CPU texture copies per frame
2. **React State Updates in Render Loop** - Triggering React reconciliation during RAF
3. **Per-Frame Object Allocations** - Creating arrays and objects every frame
4. **Debug Panel Overhead** - Heavy computations even when panel is closed

### Recent Performance Regression

**Commit `a495638e`** ("Add unified GameRenderer and GBA-accurate game loop") introduced a significant performance regression estimated at **25-55% slower frame times**. The primary cause is `needsFullRender: true` being hardcoded, which bypasses all dirty tracking and forces full tile rebuilds every frame. See [Appendix B](#appendix-b-commit-analysis---a495638e-performance-regression) for detailed analysis.

**Current Status (verified):**
- `needsFullRender: true` is present in both `GamePage.tsx:998` and `GameRenderer.tsx:487`
- Console.log statements still present in `GameRenderer.tsx:418, 430, 467, 473`
- Surf blob array operations still present in `compositeWebGLFrame.ts`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GamePage.tsx                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  RAF Loop (inline in useEffect)                          │   │
│  │  ├─ GBA Frame Accumulator (59.7275 Hz)                   │   │
│  │  ├─ Player Update                                        │   │
│  │  ├─ Camera Update                                        │   │
│  │  ├─ Warp/Door Sequence Updates                           │   │
│  │  ├─ WebGL Pipeline Render (3 passes)                     │   │
│  │  │   ├─ Background Pass → Framebuffer                    │   │
│  │  │   ├─ TopBelow Pass → Framebuffer                      │   │
│  │  │   └─ TopAbove Pass → Framebuffer                      │   │
│  │  ├─ Sprite Building (useWebGLSpriteBuilder)              │   │
│  │  ├─ compositeWebGLFrame()                                │   │
│  │  │   ├─ drawImage(webglCanvas) × 5-8 times!              │   │
│  │  └─ setStats() / setDebugInfo() (React state updates)    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Critical Performance Issues

### 1. Hybrid WebGL/Canvas2D Compositing (CRITICAL)

**Location:** `src/rendering/compositeWebGLFrame.ts:86-149`

**Problem:** The current architecture renders WebGL to a hidden canvas, then copies it to a visible Canvas2D context multiple times per frame:

```typescript
// This happens 5-8 times per frame!
ctx2d.drawImage(webglCanvas, 0, 0);
```

**Why this is slow:**
- Each `drawImage()` from a WebGL canvas forces a GPU→CPU texture readback
- These readbacks stall the GPU pipeline and block until data is transferred
- On a typical 240×160 viewport, this is ~150KB of pixel data per copy
- At 60fps with 6 copies = ~54MB/s of unnecessary memory bandwidth

**Measured locations:**
| Pass | File:Line | Description |
|------|-----------|-------------|
| 1 | `compositeWebGLFrame.ts:188` | Reflection sprites |
| 2 | `compositeWebGLFrame.ts:194` | Low priority sprites |
| 3 | `compositeWebGLFrame.ts:204` | Door/arrow overlays |
| 4 | `compositeWebGLFrame.ts:211` | Normal sprites |
| 5 | `compositeWebGLFrame.ts:131` | TopAbove layer |
| 6 | `compositeWebGLFrame.ts:137` | Priority 0 sprites |
| 7 | `compositeWebGLFrame.ts:147` | Fade overlay |

**Root cause:** The renderer needs to interleave tile layers with sprites, but WebGL can't easily composite with the existing tile framebuffers.

**Solutions:**
1. **Full WebGL compositing (Best):** Render sprites directly to WebGL framebuffers, composite all passes in a final WebGL shader. Eliminates ALL CPU copies.
2. **Offscreen canvas (Medium):** Use `OffscreenCanvas` with `transferToImageBitmap()` for async transfers.
3. **Single copy (Minimal):** Render everything to one WebGL framebuffer, copy once at end.

**Estimated impact:** 30-50% frame time reduction

---

### 2. React State Updates in RAF Loop (HIGH)

**Location:** `src/pages/GamePage.tsx:823-843, 1046-1059, 1115-1227, 1274-1287`

**Problem:** Multiple `setState` calls happen inside the render loop:

```typescript
// Every ~500ms (30 frames at 60fps)
if (gbaFrameRef.current % 30 === 0) {
  setMapDebugInfo(debugInfo);        // Line 825
  setPlayerDebugInfo({...});         // Line 828-843
}

// Every ~100ms (6 frames at 60fps)
if (debugOptionsRef.current.enabled && gbaFrameRef.current % 6 === 0) {
  setReflectionTileGridDebug(gridDebug);  // Line 1059
}

// EVERY FRAME when debug panel is open!
if (debugOptionsRef.current.enabled && player) {
  setPriorityDebugInfo({...});       // Lines 1115-1227
}

// Every 500ms
setStats((s) => ({...}));            // Line 1274
setCameraDisplay({...});             // Line 1281
```

**Why this is slow:**
- `setState` triggers React reconciliation
- Even with refs for most state, debug state causes re-renders
- React's virtual DOM diffing adds overhead
- The `useMemo` computations re-run when debug state changes

**The debug panel issue is particularly severe:**
```typescript
// This builds MASSIVE debug objects every single frame
setPriorityDebugInfo({
  player: { /* 8 fields */ },
  sortedSprites: sortedSpritesDebug,    // Array of ALL sprites
  fieldEffects: { effects: fieldEffectsDebug },
  npcs: { list: npcsDebug },
  comparison: { nearbySprites },
});
```

**Solutions:**
1. **Move debug to separate RAF:** Debug panel should have its own animation frame that doesn't block game rendering
2. **Use refs for all render-loop state:** Only trigger React renders when user interacts
3. **Throttle debug updates:** Even when panel is open, update at 5-10fps not 60fps
4. **Remove debug computations when panel closed:** Currently `priorityDebugInfo` still runs heavy calculations

**Estimated impact:** 10-20% frame time reduction (more when debug panel is open)

---

### 3. Per-Frame Object Allocations (MEDIUM-HIGH)

**Location:** Multiple files in render loop

**Problem:** JavaScript garbage collection pauses when too many short-lived objects are created:

```typescript
// compositeWebGLFrame.ts:98-106 - Creates new arrays every frame
const allSpritesWithBlob = surfBlobSprite ? [...allSprites, surfBlobSprite] : allSprites;
allSpritesWithBlob.sort((a, b) => a.sortKey - b.sortKey);

const reflectionLayerSprites = allSpritesWithBlob.filter((s) => s.isReflection || s.isReflectionLayer);
const normalSprites = allSpritesWithBlob.filter((s) => !s.isReflection && !s.isReflectionLayer);
const lowPriorityReflections = lowPrioritySprites.filter((s) => s.isReflection || s.isReflectionLayer);
const normalLowPrioritySprites = lowPrioritySprites.filter((s) => !s.isReflection && !s.isReflectionLayer);
const overlaySprites = [...doorSprites];
```

```typescript
// useWebGLSpriteBuilder.ts:133-139 - Fresh arrays every frame
const lowPrioritySprites: SpriteInstance[] = [];
const allSprites: SpriteInstance[] = [];
const priority0Sprites: SpriteInstance[] = [];
const doorSprites: SpriteInstance[] = [];
```

```typescript
// GamePage.tsx:1019 - Array literals
let lowPrioritySprites: SpriteInstance[] = [];
let priority0Sprites: SpriteInstance[] = [];
```

**Other allocations per frame:**
- `buildSpriteBatches()` creates 3 new arrays
- `SortableSpriteInfo` objects for each sprite
- `SpriteBuildResult` object
- Water mask `Uint8Array` (when reflections visible)
- Door animation canvas elements

**Solutions:**
1. **Object pooling:** Reuse sprite arrays between frames (like `TileInstanceBuilder.instanceBuffer`)
2. **Pre-allocated result buffers:** Create result objects once, reset each frame
3. **Avoid spread operators in hot paths:** Use `push()` or pre-sized arrays
4. **Cache sorted sprite lists:** Only re-sort when sprites change

**Estimated impact:** 5-15% frame time reduction, fewer GC pauses

---

### 4. Sprite Sorting Every Frame (MEDIUM)

**Location:** `src/rendering/compositeWebGLFrame.ts:100`, `src/hooks/useWebGLSpriteBuilder.ts:425`

**Problem:** Full array sort runs every frame:

```typescript
// compositeWebGLFrame.ts:100
allSpritesWithBlob.sort((a, b) => a.sortKey - b.sortKey);

// useWebGLSpriteBuilder.ts:425
allSprites.sort((a, b) => a.sortKey - b.sortKey);
```

**Why this is slow:**
- JavaScript's `sort()` is O(n log n)
- With 20-50 sprites, this adds up
- Sort runs TWICE (once in builder, once in compositor)

**Solutions:**
1. **Insertion sort for nearly-sorted data:** Sprites rarely change order dramatically
2. **Dirty flag:** Only re-sort when sprite list actually changes
3. **Remove redundant sort:** One sort should be sufficient
4. **Pre-sorted insertion:** Insert sprites in sorted order during building

**Estimated impact:** 2-5% frame time reduction

---

### 5. Water Mask Texture Upload (MEDIUM)

**Location:** `src/rendering/compositeWebGLFrame.ts:174-184`

**Problem:** Creates and uploads new texture data every frame when reflections are visible:

```typescript
const waterMask = buildWaterMaskFromView(
  view.pixelWidth,
  view.pixelHeight,
  view.cameraWorldX,
  view.cameraWorldY,
  (tileX, tileY) => { /* callback */ }
);
spriteRenderer.setWaterMask(waterMask);  // GPU upload
```

**`buildWaterMaskFromView` creates:**
- New `Uint8Array(width * height)` (~38KB for 240×160)
- Iterates every pixel calling the callback

**Solutions:**
1. **Cache mask:** Only rebuild when camera moves to new tile
2. **Tile-based mask:** Store mask per tile, composite on GPU
3. **Incremental updates:** Only update changed tiles
4. **Lower resolution mask:** Use 1/4 resolution, sample in shader

**Estimated impact:** 3-8% frame time reduction

---

### 6. Tile Instance Building Iterations (MEDIUM)

**Location:** `src/rendering/webgl/TileInstanceBuilder.ts`, `src/rendering/webgl/WebGLPassRenderer.ts`

**Problem:** Iterates over ALL visible tiles 3 times per frame:

```typescript
// WebGLPassRenderer.ts
this.passRenderer.renderBackground(view, resolveTile, ...);   // Iteration 1
this.passRenderer.renderTopBelow(view, resolveTile, ...);     // Iteration 2
this.passRenderer.renderTopAbove(view, resolveTile, ...);     // Iteration 3
```

Each iteration:
- Calls `resolveTile()` for every visible tile
- `TileResolverFactory.fromSnapshot()` does map lookups per tile

For a 15×10 viewport (+1 border = 17×12 = 204 tiles):
- 204 × 3 = **612 tile resolutions per frame**

**Solutions:**
1. **Single-pass instance building:** Build all 3 pass arrays in one iteration
2. **Cache resolved tiles:** Store resolution results for the current view
3. **Dirty rectangles:** Only rebuild changed regions

**Estimated impact:** 5-10% frame time reduction

---

### 7. Console Logging in Production (LOW-MEDIUM)

**Location:** Throughout GamePage.tsx

**Problem:** Console statements in performance-critical paths:

```typescript
// GamePage.tsx - Multiple console.log calls
console.log('[DOOR_HANDLER] Called with request:', request);
console.log('[DOOR_HANDLER] Rejected: no snapshot');
console.log('[WARP] ========== WARP START ==========');
console.log(`[WebGL] Uploaded sprite sheet: ${atlasName}`);
```

**Why this matters:**
- `console.log()` involves string formatting
- Logs are synchronous and can block
- DevTools serializes logged objects

**Solutions:**
1. **Strip in production:** Use build-time removal of console statements
2. **Conditional logging:** Only log when `isDebugMode()` is true
3. **Debug build flag:** Use `process.env.NODE_ENV` checks

**Estimated impact:** 1-3% frame time reduction

---

### 8. useMemo with Debug Dependencies (LOW)

**Location:** `src/pages/GamePage.tsx:276-295, 298-347`

**Problem:** Expensive `useMemo` computations re-run when debug state changes:

```typescript
const webglDebugState = useMemo<WebGLDebugState>(() => ({
  // ... complex object construction
}), [mapDebugInfo, warpDebugInfo, stats, cameraDisplay, worldSize,
    stitchedMapCount, reflectionTileGridDebug, priorityDebugInfo]);

const debugState = useMemo<DebugState>(() => {
  // ... reads refs and builds complex object
}, [playerDebugInfo]);
```

**Solutions:**
1. **Separate debug from render state:** Debug state shouldn't affect main render
2. **Lazy evaluation:** Only compute debug state when panel is open
3. **Move to debug component:** Let DebugPanel compute its own state

---

## Performance Impact Summary

| Issue | Severity | Est. Impact | Effort to Fix |
|-------|----------|-------------|---------------|
| Hybrid WebGL/Canvas2D | CRITICAL | 30-50% | High |
| React State in RAF | HIGH | 10-20% | Medium |
| Per-Frame Allocations | MEDIUM-HIGH | 5-15% | Medium |
| Sprite Sorting | MEDIUM | 2-5% | Low |
| Water Mask Upload | MEDIUM | 3-8% | Medium |
| Tile Building Iterations | MEDIUM | 5-10% | Medium |
| Console Logging | LOW-MEDIUM | 1-3% | Low |
| useMemo Dependencies | LOW | 1-2% | Low |

**Total potential improvement: 50-100%+ frame time reduction**

---

## Recommended Priority Order

### Phase 1: Quick Wins (1-2 days)
1. Remove console.log statements from hot paths
2. Gate debug computations behind `debugOptions.enabled` check
3. Throttle debug state updates to 10fps
4. Remove redundant sprite sort

### Phase 2: Memory/GC Improvements (2-3 days)
1. Implement sprite array pooling
2. Cache sorted sprite lists with dirty flag
3. Cache water mask, update only on tile change

### Phase 3: Architecture Improvements (1-2 weeks)
1. **Full WebGL compositing** - Eliminate all `drawImage()` calls
   - Render sprites directly to layer framebuffers
   - Final composite pass in WebGL
2. Single-pass tile instance building
3. Move debug to separate RAF loop

---

## Profiling Methodology

To measure these issues:

```javascript
// Add to render loop for basic frame time measurement
const frameStart = performance.now();
// ... render code ...
const frameEnd = performance.now();
console.log('Frame time:', frameEnd - frameStart, 'ms');
// Target: < 16.67ms for 60fps
```

**Chrome DevTools:**
1. Performance tab → Record during gameplay
2. Look for:
   - Long "Composite Layers" (GPU→CPU copies)
   - "Minor GC" events (memory allocations)
   - "Recalculate Style" (React re-renders)
   - Yellow "Scripting" blocks (JS execution)

**Key metrics to track:**
- Frame time (ms)
- GC pause frequency
- Draw calls per frame
- Texture uploads per frame

---

## Appendix: Code References

| File | Lines | Description |
|------|-------|-------------|
| `src/pages/GamePage.tsx` | 772-1291 | Main render loop |
| `src/rendering/compositeWebGLFrame.ts` | 86-259 | Layer compositing |
| `src/hooks/useWebGLSpriteBuilder.ts` | 114-438 | Sprite building |
| `src/rendering/webgl/WebGLRenderPipeline.ts` | 217-322 | Tile pass rendering |
| `src/rendering/webgl/TileInstanceBuilder.ts` | 48-177 | Tile instance iteration |
| `src/rendering/SpriteBatcher.ts` | 145-256 | Sprite batch building |
| `src/hooks/useGameLoop.ts` | 98-136 | RAF loop |

---

## Appendix B: Commit Analysis - a495638e (Performance Regression)

> **Commit:** `a495638e6a75033d16c99b2c491bc686c36140b9`
> **Date:** Wed Dec 3 08:36:53 2025
> **Title:** "Add unified GameRenderer and GBA-accurate game loop"

This large refactoring commit introduced several performance regressions while unifying the WebGL and Canvas2D renderers. Below is a detailed analysis of the changes that likely caused the performance drop.

### Critical Regression #1: `needsFullRender: true` Hardcoded

**File:** `src/components/GameRenderer.tsx:658`

```typescript
// BEFORE: Pipeline had dirty tracking, only rendered when needed
pipeline.render(ctx, view, playerElevation, {
  gameFrame,
  needsFullRender: false,  // Let dirty tracking decide
  animationChanged
});

// AFTER: Forces full render EVERY FRAME
pipeline.render(
  null as any,
  view,
  playerElevation,
  { gameFrame: state.gbaFrame, needsFullRender: true, animationChanged: state.animationFrameChanged }
);
```

**Impact:**
- Completely bypasses the dirty region tracking system
- All 3 tile passes rebuild every frame even when camera hasn't moved
- ~204 tiles × 3 passes × 16 tiles/metatile = **9,792 tile instances rebuilt per frame** unnecessarily
- Estimated performance cost: **20-40% of frame time**

**Root cause:** The new `GameRenderer` component passes `null` for RenderContext, forcing `needsFullRender: true` as a workaround.

---

### Critical Regression #2: Console.log in Render Loop

**File:** `src/components/GameRenderer.tsx:589-644`

The commit added multiple console.log statements that fire during rendering:

```typescript
// Fires every 60 frames (once per second)
if (state.gbaFrame % 60 === 0) {
  console.log('[RENDER] Skipping - missing:', { canvas, renderers, player, snapshot, playerLoaded });
}

if (state.gbaFrame % 60 === 0) {
  console.log('[RENDER] Frame', state.gbaFrame, 'type:', renderers.type, 'player:', player.tileX, player.tileY);
}

if (state.gbaFrame % 60 === 0) {
  console.log('[RENDER] WebGL skip - webglCanvas:', !!webglCanvas, 'tilesetsUploaded:', tilesetsUploadedRef.current);
}

if (state.gbaFrame % 60 === 0) {
  console.log('[RENDER] WebGL rendering, view:', view.startTileX, view.startTileY, ...);
}
```

**Impact:**
- These still execute the conditional check EVERY frame
- Object literals created for logging even when not logging
- String interpolation overhead
- Estimated cost: **1-3% per console.log call**

---

### Critical Regression #3: Surf Blob Sprite Array Operations

**File:** `src/rendering/compositeWebGLFrame.ts:89-107`

The commit added surf blob sprite handling which creates new arrays every frame:

```typescript
// ADDED: Creates new array with spread operator EVERY FRAME
const allSpritesWithBlob = surfBlobSprite ? [...allSprites, surfBlobSprite] : allSprites;

// ADDED: Re-sorts the entire array EVERY FRAME
allSpritesWithBlob.sort((a, b) => a.sortKey - b.sortKey);

// These filter operations were already there, but now run on larger array
const reflectionLayerSprites = allSpritesWithBlob.filter((s) => s.isReflection || s.isReflectionLayer);
const normalSprites = allSpritesWithBlob.filter((s) => !s.isReflection && !s.isReflectionLayer);
```

**Impact:**
- Spread operator `[...allSprites, surfBlobSprite]` creates a new array copy (~20-50 elements)
- Additional sort operation O(n log n) even when blob sprite is null
- More elements to filter in subsequent operations
- Estimated cost: **3-5% of frame time**

---

### Critical Regression #4: Surf Blob Position Calculations

**File:** `src/hooks/useWebGLSpriteBuilder.ts:224-300`

Added ~80 lines of surf blob position calculations that run every frame when surfing:

```typescript
if (playerLoaded && !playerHidden && spriteRenderer.hasSpriteSheet('surf-blob')) {
  const surfCtrl = player.getSurfingController();
  const shouldRenderBlob = player.isSurfing() || surfCtrl.isJumping();

  if (shouldRenderBlob) {
    const blobRenderer = surfCtrl.getBlobRenderer();
    const bobOffset = blobRenderer.getBobOffset();

    // Multiple conditional branches with tile coordinate calculations
    if (surfCtrl.isJumpingOn()) {
      const targetPos = surfCtrl.getTargetPosition();
      // ... calculations
    } else if (surfCtrl.isJumpingOff()) {
      const fixedPos = surfCtrl.getBlobFixedPosition();
      // ... calculations
    } else {
      // ... calculations
    }
    // ... frame calculation, sprite instance creation
  }
}
```

**Impact:**
- Multiple method calls on SurfingController every frame
- Object allocations for target positions
- Adds complexity to already-hot sprite building path
- Estimated cost: **1-2% of frame time** (only when surfing)

---

### Critical Regression #5: New useGameLoop Hook Overhead

**File:** `src/hooks/useGameLoop.ts` (new file)

The commit introduced a new game loop abstraction:

```typescript
export function useGameLoop(
  onUpdate: GameUpdateFn,
  onRender: GameRenderFn,
  options: UseGameLoopOptions = {}
): UseGameLoopReturn {
  // Refs for callbacks (avoid stale closures)
  const onUpdateRef = useRef(onUpdate);
  const onRenderRef = useRef(onRender);
  onUpdateRef.current = onUpdate;  // Assignment EVERY render
  onRenderRef.current = onRender;  // Assignment EVERY render

  const tick = useCallback((currentTime: number) => {
    // ...
    onUpdateRef.current(frameMs, currentTime);  // Indirect call through ref
    onRenderRef.current(frameState);            // Indirect call through ref
  }, [frameMs]);
```

**Impact:**
- Extra ref assignments on every React render
- Indirect function calls through refs (minor overhead)
- Additional `useCallback` wrapper around tick function
- Object construction for `GameFrameState` every frame

**Mitigation:** This is minor overhead, but adds up with other issues.

---

### Critical Regression #6: Separate Update and Render Phases

**File:** `src/components/GameRenderer.tsx:522-744`

The commit separated update logic from render logic:

```typescript
// BEFORE: Single inline function did everything
useEffect(() => {
  const tick = () => {
    // Update player, camera, etc.
    // Render immediately after
  };
});

// AFTER: Separate callbacks with additional overhead
const handleUpdate = useCallback((deltaMs: number, timestamp: number) => {
  // Update logic only
}, [/* 4 dependencies */]);

const handleRender = useCallback((state: GameFrameState) => {
  // Render logic only
}, [/* 6 dependencies */]);

useGameLoop(handleUpdate, handleRender, { running: !loading && !error });
```

**Impact:**
- Two separate `useCallback` wrappers with dependency arrays
- React must track and compare dependencies each render
- Additional function call overhead (update called, then render called)
- More opportunity for stale closure bugs

---

### Summary: Commit Impact Estimate

| Change | Location | Estimated Impact |
|--------|----------|------------------|
| `needsFullRender: true` | GameRenderer.tsx:658 | **20-40%** |
| Console.log statements | GameRenderer.tsx:589-644 | 1-5% |
| Surf blob array ops | compositeWebGLFrame.ts:89-107 | 3-5% |
| Surf blob calculations | useWebGLSpriteBuilder.ts:224-300 | 1-2% |
| useGameLoop overhead | useGameLoop.ts | 1-2% |
| Separate update/render | GameRenderer.tsx | 1-2% |

**Total estimated regression: 25-55% slower frame times**

---

### Recommended Fixes for This Commit

1. **Remove `needsFullRender: true`:**
   ```typescript
   // Pass proper RenderContext or implement view-change detection
   pipeline.render(ctx, view, playerElevation, {
     gameFrame: state.gbaFrame,
     needsFullRender: viewChanged || elevationChanged,
     animationChanged: state.animationFrameChanged
   });
   ```

2. **Remove or gate console.log statements:**
   ```typescript
   if (process.env.NODE_ENV === 'development' && state.gbaFrame % 60 === 0) {
     console.log('[RENDER] Frame', state.gbaFrame);
   }
   ```

3. **Avoid array spread for surf blob:**
   ```typescript
   // Instead of: const allSpritesWithBlob = [...allSprites, surfBlobSprite];
   // Do: Push to existing array or use pre-allocated buffer
   if (surfBlobSprite) {
     allSprites.push(surfBlobSprite);
   }
   // Sort in place (already sorted, just insert surf blob in order)
   ```

4. **Cache surf blob sprite instance:**
   ```typescript
   // Reuse sprite instance, only update position/frame
   const surfBlobSpriteRef = useRef<SpriteInstance | null>(null);
   if (shouldRenderBlob) {
     if (!surfBlobSpriteRef.current) {
       surfBlobSpriteRef.current = createSurfBlobSprite(...);
     }
     updateSurfBlobPosition(surfBlobSpriteRef.current, ...);
   }
   ```

5. **Implement proper dirty tracking in GameRenderer:**
   - Track camera position changes
   - Track elevation changes
   - Only pass `needsFullRender: true` when truly needed
