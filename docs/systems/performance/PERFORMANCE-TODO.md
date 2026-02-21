---
title: Performance Optimization TODO List
status: reference
last_verified: 2026-02-20
---

# Performance Optimization TODO List

> Consolidated action items from all performance investigations
> **Priority Order: Phase 0 → Phase 1 → Phase 2 → Phase 3**

**Last Updated:** 2026-02-20

## 2026-02-20 Runtime Stability + Stitching Update

### Completed
- Added shared fixed-step spike guard in `src/utils/fixedStepGuard.ts` and integrated it into:
  - `src/pages/GamePage.tsx`
  - `src/engine/GameLoop.ts`
  - `src/hooks/useGameLoop.ts`
  - `src/hooks/useUnifiedGameLoop.ts`
- Added resume-safe timing defaults in `src/config/timing.ts`:
  - `RESUME_RESET_THRESHOLD_MS`
  - `MAX_SIMULATION_DELTA_MS`
  - `MAX_CATCHUP_STEPS_PER_TICK`
- Added explicit tab lifecycle clock resync in `src/pages/GamePage.tsx` via `visibilitychange` + `pageshow`.
- Hardened WebGL context restore in:
  - `src/rendering/webgl/WebGLRenderPipeline.ts`
  - `src/pages/GamePage.tsx` (resource recreation + reupload + controlled fallback reload).
- Implemented two-phase world stitching in `src/game/WorldManager.ts`:
  - blocking initialize depth defaults to `1`
  - background stitching continues to depth `2`
  - per-map event churn is suppressed during blocking initialize
  - concurrent connected-load runs are guarded.
- Added cooperative stitching yields in `src/game/WorldManager.ts` so connected/background map loads yield back to the browser between chunks.
- Added background loading signal event:
  - `WorldManagerEvent` now includes `loadingStateChanged`
  - wired through `src/game/worldManagerEvents.ts`
  - consumed by `src/game/overworld/load/loadSelectedOverworldMap.ts` and `src/pages/GamePage.tsx`.
- Coalesced `mapsChanged` object-event reload churn in `src/game/worldManagerEvents.ts` and enabled cooperative object parsing/upload chunks in `src/game/loadObjectEventsFromSnapshot.ts`.
- Added non-blocking stitch progress chip (`Stitching nearby maps... X/Y`) in `src/pages/GamePage.tsx` + `src/pages/GamePage.css`.
- Added map-graph helper for stable target counts in `src/game/mapGraph.ts`.
- Added unit coverage:
  - `src/utils/__tests__/fixedStepGuard.test.ts`
  - `src/game/__tests__/mapGraph.test.ts`

---

## Phase 0: Critical Bug Fixes (Commit a495638e Regressions)

These are **bugs introduced by the refactoring commit** that should be fixed immediately. They provide the biggest bang-for-buck since they restore previously-working optimizations.

| # | Task | File | Status | Impact | Effort |
|---|------|------|--------|--------|--------|
| 0.1 | **Remove `needsFullRender: true`** | `GamePage.tsx` | ✅ DONE | **20-40%** | 5 min |
| 0.2 | **Remove `needsFullRender: true`** | `GameRenderer.tsx` | ✅ DONE | **20-40%** | 5 min |
| 0.3 | **Remove console.log statements** | `GamePage.tsx` | ✅ DONE | **1-5%** | 5 min |
| 0.4 | **Fix surf blob array spread** | `compositeWebGLFrame.ts` | ✅ DONE | **3-5%** | 10 min |

### Status Notes:
- **0.1 & 0.2**: Changed to `needsFullRender: false` at lines 1010 and 470 respectively
- **0.3**: Removed console.logs from render loop (warp action logs at lines 892, 905)
- **0.4**: Now uses in-place splice() instead of array spread. Also fixed bug where compositeStandard used wrong array

### Detailed Fix Instructions

#### 0.1 & 0.2: Remove `needsFullRender: true`

**Current (broken):**
```typescript
pipeline.render(
  null as any,
  view,
  playerElevation,
  { gameFrame: state.gbaFrame, needsFullRender: true, animationChanged: state.animationFrameChanged }
);
```

**Fixed:**
```typescript
// Track view changes
const viewChanged =
  view.startTileX !== lastViewRef.current.startTileX ||
  view.startTileY !== lastViewRef.current.startTileY;
const elevationChanged = playerElevation !== lastElevationRef.current;

lastViewRef.current = { startTileX: view.startTileX, startTileY: view.startTileY };
lastElevationRef.current = playerElevation;

pipeline.render(
  renderContext,  // Or null if not available
  view,
  playerElevation,
  {
    gameFrame: state.gbaFrame,
    needsFullRender: viewChanged || elevationChanged,
    animationChanged: state.animationFrameChanged
  }
);
```

#### 0.3: Remove console.log Statements

**Delete or comment out these lines in `GameRenderer.tsx`:**
```typescript
// Line 418-425: console.log('[RENDER] Skipping - missing:', {...})
// Line 430: console.log('[RENDER] Frame', state.gbaFrame, ...)
// Line 467: console.log('[RENDER] WebGL skip - webglCanvas:', ...)
// Line 473: console.log('[RENDER] WebGL rendering, view:', ...)
```

Or gate behind development check:
```typescript
if (import.meta.env.DEV && state.gbaFrame % 300 === 0) {
  console.log('[RENDER] Frame', state.gbaFrame);
}
```

#### 0.4: Fix Surf Blob Array Spread

**Current (slow):**
```typescript
const allSpritesWithBlob = surfBlobSprite ? [...allSprites, surfBlobSprite] : allSprites;
allSpritesWithBlob.sort((a, b) => a.sortKey - b.sortKey);
```

**Fixed:**
```typescript
// Mutate in place instead of creating new array
if (surfBlobSprite) {
  // Insert in sorted position using binary search
  const insertIndex = allSprites.findIndex(s => s.sortKey > surfBlobSprite.sortKey);
  if (insertIndex === -1) {
    allSprites.push(surfBlobSprite);
  } else {
    allSprites.splice(insertIndex, 0, surfBlobSprite);
  }
}
// No re-sort needed - already sorted, just inserted in order
```

---

## Phase 1: Low-Hanging Fruit (Quick Wins)

These are easy fixes with good impact-to-effort ratio.

| # | Task | File | Status | Impact | Effort |
|---|------|------|--------|--------|--------|
| 1.1 | **Fix door canvas creation** | `useWebGLSpriteBuilder.ts` | ✅ DONE | **5-10%** | 30 min |
| 1.2 | **Gate debug computations** | `GamePage.tsx` | ✅ DONE | **5-15%** | 15 min |
| 1.3 | **Remove redundant sprite sort** | `useWebGLSpriteBuilder.ts` | ❌ NOT SAFE | **2-3%** | 10 min |
| 1.4 | **Throttle scheduler.update** | `GamePage.tsx` | N/A | **1-2%** | 5 min |

### Status Notes:
- **1.1**: ✅ Canvas only created on first upload per door type (guarded by `doorSpritesUploaded.has()`)
- **1.2**: ✅ Added throttling with `gbaFrameRef.current % 6 === 0` at line 1160
- **1.3**: ❌ NOT SAFE - The sort at line 425 IS needed because reflections/grass effects added during iteration have different sortKeys
- **1.4**: scheduler.update no longer exists in codebase - this optimization is N/A

### Detailed Fix Instructions

#### 1.1: Fix Door Canvas Creation (CRITICAL)

**Current (creates canvas every frame):**
```typescript
// Lines 151-154 in useWebGLSpriteBuilder.ts
const canvas = document.createElement('canvas');  // DOM allocation!
canvas.width = spriteData.width;
canvas.height = spriteData.height;
const canvasCtx = canvas.getContext('2d');  // Context creation!
```

**Fixed (pre-allocate scratch canvas):**
```typescript
// At module level or in a ref
const scratchCanvas = document.createElement('canvas');
scratchCanvas.width = 64;  // Max expected door size
scratchCanvas.height = 64;
const scratchCtx = scratchCanvas.getContext('2d')!;

// In render loop
function getDoorFrame(spriteData: DoorSpriteData): HTMLCanvasElement {
  // Resize only if needed (rare)
  if (scratchCanvas.width < spriteData.width || scratchCanvas.height < spriteData.height) {
    scratchCanvas.width = Math.max(scratchCanvas.width, spriteData.width);
    scratchCanvas.height = Math.max(scratchCanvas.height, spriteData.height);
  }
  scratchCtx.clearRect(0, 0, spriteData.width, spriteData.height);
  // ... draw door frame ...
  return scratchCanvas;
}
```

**Even better:** Upload all door animation frames to texture atlas at map load time.

#### 1.2: Gate Debug Computations

**Current (runs every frame even when panel closed):**
```typescript
// GamePage.tsx - builds massive debug objects unconditionally
const sortedSpritesDebug = allSprites.map(s => ({ ... }));
setPriorityDebugInfo({
  player: { ... },
  sortedSprites: sortedSpritesDebug,
  // ...
});
```

**Fixed:**
```typescript
// Only compute when debug panel is actually open AND visible
if (debugOptionsRef.current.enabled && debugOptionsRef.current.showPriority) {
  // ... expensive debug computations ...
  if (gbaFrameRef.current % 10 === 0) {  // 6fps is enough for debug
    setPriorityDebugInfo({ ... });
  }
}
```

#### 1.3: Remove Redundant Sprite Sort

Sprites are sorted in `buildSpriteBatches()` in `SpriteBatcher.ts`, then sorted AGAIN in `compositeWebGLFrame.ts`. Remove the second sort:

```typescript
// compositeWebGLFrame.ts - REMOVE THIS LINE:
// allSpritesWithBlob.sort((a, b) => a.sortKey - b.sortKey);
// Sprites are already sorted by buildSpriteBatches
```

#### 1.4: Throttle Scheduler Update

```typescript
// GamePage.tsx render loop
// Current: runs every frame
worldManagerRef.current.getScheduler().update(player.tileX, player.tileY);

// Fixed: run every 10 frames (map loading doesn't need 60fps)
if (gbaFrameRef.current % 10 === 0) {
  worldManagerRef.current.getScheduler().update(player.tileX, player.tileY);
}
```

---

## Phase 2: Memory & GC Optimizations (Medium Effort)

These reduce garbage collection pressure and memory churn.

| # | Task | File(s) | Status | Impact | Effort |
|---|------|---------|--------|--------|--------|
| 2.1 | **SpriteInstance object pooling** | `useWebGLSpriteBuilder.ts` | ❌ TODO | **5-10%** | 2 hr |
| 2.2 | **Cache water mask** | `compositeWebGLFrame.ts` | ❌ TODO | **3-8%** | 1 hr |
| 2.3 | **Reuse WorldCameraView** | `GamePage.tsx` | ❌ TODO | **1-2%** | 15 min |
| 2.4 | **Pre-allocate sprite arrays** | `useWebGLSpriteBuilder.ts` | ⚠️ PARTIAL | **2-5%** | 30 min |

### Status Notes:
- **2.1**: No object pooling implemented for SpriteInstance objects
- **2.2**: Water mask rebuilt every frame at compositeWebGLFrame.ts:183 - no caching
- **2.3**: buildWorldCameraView() creates new object each frame - not reusing via ref
- **2.4**: TileInstanceBuilder has reusable instanceBuffer, but sprite arrays in useWebGLSpriteBuilder are fresh each call

### Detailed Instructions

#### 2.1: SpriteInstance Object Pooling

```typescript
// Create a pool class
class SpriteInstancePool {
  private pool: SpriteInstance[] = [];
  private index = 0;

  acquire(): SpriteInstance {
    if (this.index < this.pool.length) {
      return this.pool[this.index++];
    }
    const instance = { worldX: 0, worldY: 0, ... };  // Default values
    this.pool.push(instance);
    this.index++;
    return instance;
  }

  reset(): void {
    this.index = 0;
  }
}

// Usage in useWebGLSpriteBuilder
const poolRef = useRef(new SpriteInstancePool());

// At start of buildSprites:
poolRef.current.reset();

// Instead of: const sprite = { worldX, worldY, ... };
// Do: const sprite = poolRef.current.acquire();
// Then assign values: sprite.worldX = worldX; sprite.worldY = worldY; ...
```

#### 2.2: Cache Water Mask

```typescript
// compositeWebGLFrame.ts
const waterMaskCacheRef = useRef<{
  mask: Uint8Array | null;
  cameraX: number;
  cameraY: number;
}>({ mask: null, cameraX: -1, cameraY: -1 });

// Only rebuild when camera moves to new tile
const cameraTileX = Math.floor(view.cameraWorldX / METATILE_SIZE);
const cameraTileY = Math.floor(view.cameraWorldY / METATILE_SIZE);

if (cameraTileX !== waterMaskCacheRef.current.cameraX ||
    cameraTileY !== waterMaskCacheRef.current.cameraY) {
  waterMaskCacheRef.current.mask = buildWaterMaskFromView(...);
  waterMaskCacheRef.current.cameraX = cameraTileX;
  waterMaskCacheRef.current.cameraY = cameraTileY;
  spriteRenderer.setWaterMask(waterMaskCacheRef.current.mask);
}
```

#### 2.3: Reuse WorldCameraView Object

```typescript
// GamePage.tsx
const worldCameraViewRef = useRef<WorldCameraView>({
  cameraWorldX: 0,
  cameraWorldY: 0,
  // ... all other fields
});

// In render loop - mutate instead of create new object
const view = worldCameraViewRef.current;
view.cameraWorldX = camView.x;
view.cameraWorldY = camView.y;
// ... update all fields
```

#### 2.4: Pre-allocate Sprite Arrays

```typescript
// useWebGLSpriteBuilder.ts
const arraysRef = useRef({
  lowPriority: [] as SpriteInstance[],
  allSprites: [] as SpriteInstance[],
  priority0: [] as SpriteInstance[],
  door: [] as SpriteInstance[],
});

// At start of buildSprites - clear arrays instead of creating new ones
arraysRef.current.lowPriority.length = 0;
arraysRef.current.allSprites.length = 0;
arraysRef.current.priority0.length = 0;
arraysRef.current.door.length = 0;
```

---

## Phase 3: Architectural Improvements (High Effort, High Impact)

These are larger refactors that fundamentally improve the architecture.

| # | Task | Status | Impact | Effort |
|---|------|--------|--------|--------|
| 3.1 | **Pure WebGL compositing** | ❌ TODO | **30-50%** | 1-2 weeks |
| 3.2 | **Single-pass tile building** | ❌ TODO | **5-10%** | 2-3 days |
| 3.3 | **Separate debug RAF loop** | ❌ TODO | **5-10%** | 1 day |

### Status Notes:
- **3.1**: Still using ctx2d.drawImage(webglCanvas) for compositing - 9 calls per frame in compositeWebGLFrame.ts
- **3.2**: Tile building still uses separate passes (buildBackgroundInstances, buildTopLayerInstances, etc.)
- **3.3**: Debug panel has no separate RAF loop - shares main game loop

### 3.1: Pure WebGL Compositing (Highest Impact)

**Goal:** Eliminate ALL `ctx2d.drawImage(webglCanvas)` calls.

**Current Architecture:**
```
WebGL Framebuffers → drawImage → Canvas2D (display)
                  ↑ (GPU→CPU copy, 6-8 times/frame!)
```

**Target Architecture:**
```
WebGL Framebuffers → WebGL Compositor Shader → Screen
                   ↑ (all on GPU, zero CPU copies)
```

**Implementation Steps:**

1. **Make WebGL canvas the visible canvas**
   - Remove `displayCanvasRef`
   - Set `webglCanvas` as the visible element
   - Layer UI (DialogBox, DebugPanel) on top with CSS z-index

2. **Create WebGLCompositor class**
   ```typescript
   class WebGLCompositor {
     private quadVAO: WebGLVertexArrayObject;
     private compositeShader: WebGLProgram;

     // Draw a framebuffer texture to screen
     compositeToScreen(texture: WebGLTexture, x: number, y: number): void {
       gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // Draw to screen
       gl.useProgram(this.compositeShader);
       gl.bindTexture(gl.TEXTURE_2D, texture);
       gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
     }
   }
   ```

3. **Rewrite compositeWebGLFrame**
   ```typescript
   function compositeWebGLFrame(gl: WebGL2RenderingContext, ...) {
     gl.bindFramebuffer(gl.FRAMEBUFFER, null);  // Target screen
     gl.clear(gl.COLOR_BUFFER_BIT);

     // 1. Draw background layer (textured quad)
     compositor.drawTexture(backgroundTexture);

     // 2. Draw low priority sprites (direct to screen)
     spriteRenderer.renderBatch(lowPrioritySprites);

     // 3. Draw topBelow layer
     compositor.drawTexture(topBelowTexture);

     // 4. Draw main sprites
     spriteRenderer.renderBatch(mainSprites);

     // 5. Draw topAbove layer
     compositor.drawTexture(topAboveTexture);

     // 6. Draw priority 0 sprites
     spriteRenderer.renderBatch(priority0Sprites);

     // 7. Draw fade overlay
     fadeRenderer.render(fadeAlpha);
   }
   ```

### 3.2: Single-Pass Tile Building

Currently iterates visible tiles 3 times (background, topBelow, topAbove). Combine into one pass:

```typescript
buildAllPassInstances(view: WorldCameraView, resolveTile: TileResolverFn): {
  background: TileInstance[];
  topBelow: TileInstance[];
  topAbove: TileInstance[];
} {
  const background: TileInstance[] = [];
  const topBelow: TileInstance[] = [];
  const topAbove: TileInstance[] = [];

  this.forEachVisibleTile(view, (worldX, worldY, screenX, screenY) => {
    const resolved = resolveTile(worldX, worldY);
    if (!resolved?.metatile) return;

    // Build all three passes in one iteration
    this.addMetatileLayer(background, resolved.metatile, screenX, screenY, 0);

    if (resolved.layerType !== COVERED) {
      if (shouldRenderBelow(resolved)) {
        this.addMetatileLayer(topBelow, resolved.metatile, screenX, screenY, 1);
      } else {
        this.addMetatileLayer(topAbove, resolved.metatile, screenX, screenY, 1);
      }
    }
  });

  return { background, topBelow, topAbove };
}
```

### 3.3: Separate Debug RAF Loop

Move debug panel updates to a separate, lower-priority animation loop:

```typescript
// DebugPanel.tsx or a new useDebugLoop hook
useEffect(() => {
  if (!enabled) return;

  let frameId: number;
  const tick = () => {
    // Poll game state refs (not React state)
    const debugInfo = buildDebugInfo(playerRef.current, cameraRef.current, ...);
    setDebugState(debugInfo);
    frameId = requestAnimationFrame(tick);
  };

  // Run at 10fps, not 60fps
  const intervalId = setInterval(() => {
    frameId = requestAnimationFrame(tick);
  }, 100);

  return () => {
    clearInterval(intervalId);
    cancelAnimationFrame(frameId);
  };
}, [enabled]);
```

---

## Summary: Expected Impact by Phase

| Phase | Status | Cumulative Impact | Effort |
|-------|--------|-------------------|--------|
| **Phase 0** | ✅ 4/4 done | 25-55% faster | 30 min |
| **Phase 1** | ✅ 3/4 done | 35-75% faster | 1-2 hr |
| **Phase 2** | ❌ 0/4 done | 45-90% faster | 4-6 hr |
| **Phase 3** | ❌ 0/3 done | 70-150%+ faster | 1-2 weeks |

### Overall Progress: ~50% complete

**Phase 1 Status:**
- ✅ 1.1: Door canvas creation already guarded (was not an issue)
- ✅ 1.2: Debug computation throttling added
- ❌ 1.3: NOT SAFE to remove sort (reflections/grass need it)
- N/A 1.4: scheduler.update doesn't exist

**Recommendation:** Complete Phases 0 and 1 first. They take minimal time and should restore performance to pre-commit levels. Phase 2 provides diminishing returns but reduces stutter. Phase 3 is the long-term architectural fix for truly smooth 60fps on all devices.

---

## Quick Reference: Files to Modify

| File | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|---------|
| `GamePage.tsx` | ✅ done | ⚠️ partial | ❌ todo | ❌ todo |
| `GameRenderer.tsx` | ✅ done | | | |
| `compositeWebGLFrame.ts` | ✅ done | | ❌ todo | ❌ todo |
| `useWebGLSpriteBuilder.ts` | | ❌ todo | ❌ todo | |
| `TileInstanceBuilder.ts` | | | | ❌ todo |
| `WebGLPassRenderer.ts` | | | | ❌ todo |
| `DebugPanel.tsx` | | ⚠️ partial | | ❌ todo |
| `SpriteBatcher.ts` | | (sort is here) | | |
