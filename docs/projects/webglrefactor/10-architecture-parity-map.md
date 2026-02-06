---
title: 10 - Architecture Parity Map: Unifying WebGLMapPage & MapRenderer
status: reference
last_verified: 2026-01-13
---

# 10 - Architecture Parity Map: Unifying WebGLMapPage & MapRenderer

This document tracks the effort to merge `src/pages/WebGLMapPage.tsx` and `src/components/MapRenderer.tsx` into a unified `GameRenderer` component with pluggable WebGL/Canvas2D backends.

> **Last Updated:** 2025-12-02
> **Status:** Phase 6 nearly complete - GameRenderer has full WebGL implementation, Canvas2D path pending

## OKR: Unified Renderer Architecture

**Objective:** Merge `WebGLMapPage.tsx` and `MapRenderer.tsx` into a single `GameRenderer` component with pluggable backends.

**Key Results:**
1. ✅ **KR1:** Reduce combined LOC of both files by 40%+ through shared abstractions
2. ⬜ **KR2:** Both renderers use identical game logic (sorting, warps, effects)
3. ⬜ **KR3:** Single source file for each game system (no duplicate implementations)

**Baseline Metrics (measure before each task):**
- `WebGLMapPage.tsx`: ~1800 lines
- `MapRenderer.tsx` + hooks: ~1200 lines (MapRenderer + useCompositeScene + useRunUpdate)
- **Total:** ~3000 lines → **Target:** <1800 lines

---

## Goals

1. **Single source of truth** for game logic (movement, warps, NPCs, etc.)
2. **Pluggable renderers** - WebGL or Canvas2D selected at runtime
3. **Reduce maintenance burden** - changes only need to happen once
4. **Preserve GBA accuracy** - no compromises on timing or visuals

---

## 1. Current Architecture

```
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│        WebGLMapPage.tsx             │  │        MapRenderer.tsx              │
│        (1800+ lines)                │  │        (800+ lines)                 │
├─────────────────────────────────────┤  ├─────────────────────────────────────┤
│ - 844-line monolithic render loop   │  │ - Hook-based architecture           │
│ - Direct ref access                 │  │ - useRunUpdate, useCompositeScene   │
│ - WorldManager + snapshots          │  │ - MapManager + RenderContext        │
│ - WebGLRenderPipeline               │  │ - IRenderPipeline (Canvas2D)        │
│ - WebGLSpriteRenderer               │  │ - ObjectRenderer                    │
│ - WebGLFadeRenderer                 │  │ - Canvas2D fade                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

| Feature | Canvas2D (`MapRenderer`) | WebGL (`WebGLMapPage`) | Target |
|---------|--------------------------|------------------------|--------|
| **Entry Point** | `MapRenderer.tsx` | `WebGLMapPage.tsx` | `GameRenderer.tsx` |
| **Game Loop** | `useRunUpdate` + `useCompositeScene` | Custom `requestAnimationFrame` | `useGameLoop` |
| **World State** | `MapManager` + `RenderContext` | `WorldManager` + `WorldSnapshot` | `IWorldProvider` |
| **Tile Resolution** | `resolveTileAt` (Direct) | `TileResolverFactory` (Snapshot) | `ITileResolver` |
| **Rendering** | `RenderPipeline` (Canvas 2D) | `WebGLRenderPipeline` (WebGL2) | `IRenderPipeline` |
| **Sprites** | `ObjectRenderer` (Canvas 2D) | `WebGLSpriteRenderer` | `ISpriteRenderer` |
| **Fade** | Inline Canvas2D | `WebGLFadeRenderer` | `IFadeRenderer` |
| **Animations** | `useTilesetAnimations` | `WebGLAnimationManager` | `TilesetAnimator` |

---

## 2. Shared Components (Already Unified)

These are successfully reused across both pipelines. **Do not duplicate.**

| Component | Location | Purpose |
|-----------|----------|---------|
| `PlayerController` | `src/game/` | Movement, animation, input |
| `CameraController` | `src/game/` | Camera bounds, target following |
| `ObjectEventManager` | `src/game/` | NPC/item management |
| `useDoorAnimations` | `src/hooks/` | Door sprite loading & animation |
| `useArrowOverlay` | `src/hooks/` | Arrow warp indicator |
| `useDoorSequencer` | `src/hooks/` | Door entry/exit state machine |
| `useFieldSprites` | `src/hooks/` | Grass, sand, splash, ripple sprites |
| `WarpHandler` | `src/field/` | Warp cooldown, state tracking |
| `FadeController` | `src/field/` | Fade timing state |
| `WarpExecutor` | `src/game/` | Warp execution logic |
| `DoorActionDispatcher` | `src/game/` | Door sequence orchestration |
| `ReflectionShimmer` | `src/field/` | GBA-accurate shimmer (48-frame) |
| `computeReflectionState()` | `src/field/` | Reflection detection |
| `detectWarpTrigger()` | `src/components/map/utils.ts` | Warp event detection |
| `DebugPanel` | `src/components/debug/` | Debug overlay UI |

---

## 3. Divergent Imports (Need Reconciliation)

| WebGLMapPage Only | MapRenderer Only |
|-------------------|------------------|
| `WebGLRenderPipeline` | `IRenderPipeline` (Canvas2D impl) |
| `WebGLSpriteRenderer` | `ObjectRenderer` |
| `WebGLFadeRenderer` | (inline Canvas2D) |
| `WorldManager` | `MapManager` |
| `uploadTilesetsFromSnapshot` | `TilesetCanvasCache` |
| `spriteUtils.*` | (inline in hooks) |
| — | `useRunUpdate` |
| — | `useCompositeScene` |
| — | `useWarpExecution` |
| — | `GameLoop`, `UpdateCoordinator` |

---

## 4. Duplicated Logic (Must Extract)

### 4.1 Object Collision Checker Setup

**WebGLMapPage (lines 464-468):**
```typescript
player.setObjectCollisionChecker((tileX, tileY) => {
  const objectManager = objectEventManagerRef.current;
  const playerElev = player.getCurrentElevation();
  return objectManager.hasObjectCollisionAt(tileX, tileY, playerElev);
});
```

**MapRenderer:** Identical pattern in `initializeGame()`.

**Extract to:** `src/game/setupObjectCollisionChecker.ts`

---

### 4.2 Player Spawn Position Finding

**WebGLMapPage (lines 1663-1685):**
```typescript
const spawnFinder = new SpawnPositionFinder();
const spawnResult = spawnFinder.findSpawnPosition(
  mapData.width, mapData.height,
  (x, y) => {
    const tile = mapData.layout[y * mapData.width + x];
    if (!tile || tile.collision !== 0) return false;
    if (isSurfableBehavior(attrs.behavior)) return false;
    return true;
  },
  warpPoints
);
```

**MapRenderer:** Similar logic in initialization.

**Extract to:** `src/game/findPlayerSpawnPosition.ts`

---

### 4.3 Warp Trigger Detection & Processing

**WebGLMapPage (lines 805-857):**
```typescript
const tileChanged = !lastChecked ||
  lastChecked.tileX !== player.tileX ||
  lastChecked.tileY !== player.tileY ||
  lastChecked.mapId !== currentMapId;

if (tileChanged && !warpHandler.isOnCooldown()) {
  const trigger = detectWarpTrigger(renderContext, player);
  if (trigger) {
    if (trigger.kind === 'arrow') { /* ... */ }
    else if (isNonAnimatedDoorBehavior(trigger.behavior)) { /* ... */ }
    else { /* walk-over warp */ }
  }
}
```

**MapRenderer:** Similar logic in `useRunUpdate` hook.

**Extract to:** `src/game/WarpTriggerProcessor.ts`

---

### 4.4 Arrow Animation Frame Calculation

**WebGLMapPage (lines 1135-1147):**
```typescript
const ARROW_FRAME_DURATION_MS = 533;
const ARROW_FRAME_SEQUENCES: Record<CardinalDirection, number[]> = {
  south: [0, 1, 2, 1],
  north: [3, 4, 5, 4],
  west: [6, 7, 8, 7],
  east: [9, 10, 11, 10],
};
const elapsed = nowTime - arrowState.startedAt;
const seqIndex = Math.floor(elapsed / ARROW_FRAME_DURATION_MS) % frameSequence.length;
```

**MapRenderer:** Similar logic in `useCompositeScene`.

**Extract to:** `src/field/ArrowAnimationConstants.ts`

---

### 4.5 Viewport Constants

**WebGLMapPage (lines 120-121):**
```typescript
const VIEWPORT_TILES_WIDE = 20;
const VIEWPORT_TILES_HIGH = 20;
```

**MapRenderer:** Uses `VIEWPORT_CONFIG` from config.

**Fix:** Standardize on `src/config/viewport.ts`

---

### 4.6 Camera View Building

**WebGLMapPage (lines 965-976):**
```typescript
const view: WorldCameraView = {
  cameraX: camView.x,
  cameraY: camView.y,
  startTileX: camView.startTileX,
  // ... 10+ more fields
};
```

**MapRenderer:** Similar view construction in hooks.

**Extract to:** `src/game/buildWorldCameraView.ts`

---

## 5. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GameRenderer                             │
│            (single component, ~400 lines)                       │
├─────────────────────────────────────────────────────────────────┤
│                      Shared Game Logic                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │ useGameLoop  │ │ useWarpFlow  │ │ useSceneComposition  │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                    Renderer Interfaces                          │
│         IRenderPipeline              ISpriteRenderer            │
│         (tiles)                      (sprites)                  │
│                        IFadeRenderer                            │
├────────────────────────┬────────────────────────────────────────┤
│    WebGL Backend       │         Canvas2D Backend               │
│  WebGLRenderPipeline   │       RenderPipeline                   │
│  WebGLSpriteRenderer   │       Canvas2DSpriteRenderer (new)     │
│  WebGLFadeRenderer     │       Canvas2DFadeRenderer (new)       │
└────────────────────────┴────────────────────────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1: Extract Shared Utilities (Low Risk)

Quick wins - extract duplicated functions without changing architecture.

> **⚠️ IMPORTANT:** For each task, ensure the shared abstraction is integrated into BOTH:
> - `src/pages/WebGLMapPage.tsx` (WebGL renderer)
> - `src/components/MapRenderer.tsx` / `src/hooks/useCompositeScene.ts` (Canvas2D renderer)
>
> Mark the **PARITY** checkbox only when both renderers use the shared code.

- [x] **1.1** Create `src/game/setupObjectCollisionChecker.ts` ✅ DONE
  - [x] Extract collision checker setup from WebGLMapPage:464-468
  - [x] Update WebGLMapPage to use it (2 locations)
  - [x] Update MapRendererInit to use it
  - [x] **PARITY:** Both renderers use shared utility
  - [x] **TEST:** Build passes, collision works in both modes

- [x] **1.2** Create `src/game/findPlayerSpawnPosition.ts` ✅ DONE
  - [x] Extract spawn logic with BehaviorProvider callback pattern
  - [x] Update WebGLMapPage to use it (provides tileset-based behavior lookup)
  - [x] Update MapRendererInit to use it (provides renderContext-based behavior lookup)
  - [x] **PARITY:** Both renderers use shared utility
  - [x] **TEST:** Player spawns correctly on map load

- [x] **1.3** Create `src/field/ArrowAnimationConstants.ts` ✅ DONE
  - [x] Move `ARROW_FRAME_DURATION_MS` and `ARROW_FRAME_SEQUENCES`
  - [x] Add `getArrowAnimationFrame(direction, elapsedMs)` function
  - [x] Add `getArrowAtlasCoords(frameIndex, framesPerRow)` function
  - [x] Update WebGLMapPage to use it
  - [x] Update ObjectRenderer to use it
  - [x] **PARITY:** Both renderers use shared utility
  - [x] **TEST:** Build passes, arrow animation works

- [x] **1.4** Standardize viewport config ✅ DONE
  - [x] `src/config/viewport.ts` already has canonical values
  - [x] Update WebGLMapPage to import `DEFAULT_VIEWPORT_CONFIG`, `getViewportPixelSize`
  - [x] Replace inline constants with shared config references
  - [x] Use `VIEWPORT_PIXEL_SIZE` for pixel calculations
  - [x] **PARITY:** Both renderers use shared config
  - [x] **TEST:** Build passes, viewport dimensions match

- [x] **1.5** Create `src/game/buildWorldCameraView.ts` ✅ DONE
  - [x] Extract camera view construction with world offset support
  - [x] Update WebGLMapPage to use it
  - [x] Consolidated 5 duplicate `WorldCameraView` type definitions
  - [x] Canonical definition now in `src/rendering/types.ts`
  - [x] Removed unused `CameraView` imports
  - [x] **PARITY:** Canvas2D path uses `buildWorldCameraView()` in `useRunUpdate.ts`
  - [x] **TEST:** Build passes, camera view correct

- [x] **1.6** Fix WebGL sprite renderer Y-sort order ✅ DONE (2025-12-02)
  - [x] **BUG FOUND:** `WebGLSpriteRenderer.renderBatch()` was grouping sprites by atlas name before rendering
  - [x] This destroyed the Y-sort order (all NPCs grouped together, player separate)
  - [x] **FIX:** Changed to batch consecutive sprites with same atlas, preserving sort order
  - [x] Also fixed grass sortKey using wrong Y offset (+8 instead of +16)
  - [x] **TEST:** Build passes, NPC Y-sorting works, grass renders correctly
  - **Root cause:** Atlas grouping was done for "efficiency" but broke the fundamental Y-sort contract

- [x] **1.7** Canonical player coordinates (feet baseline) ✅ DONE (2025-12-02)
  - [x] Created `src/game/playerCoords.ts` with helpers: `getPlayerFeetY`, `getPlayerCenterY`, `getPlayerSortKey`, `getNPCSortKey`, `calculateSortKey`
  - [x] Updated WebGLMapPage to use shared utilities
  - [x] Updated `useCompositeScene.ts` (Canvas2D path) to use `getPlayerCenterY()` for field effect layering
  - [x] **BUG FIXED:** Canvas2D was using `player.y` (sprite top) instead of `player.y + 16` (sprite center) for effect comparison
  - [x] `spriteUtils.ts` now re-exports `calculateSortKey` from `playerCoords.ts`
  - [x] **PARITY:** Both renderers use shared utility
  - [x] **TEST:** Build passes, both renderers use identical Y coordinate for field effect layering

- [x] **1.8** Precomputed field-effect layers + sortKeys ✅ SUPERSEDED by 1.9
  - [x] SpriteBatcher now handles field effect layer computation via `computeFieldEffectLayer()`
  - [x] Sort keys computed in `buildSpriteBatches()` using `calculateSortKey()`
  - [x] Both renderers use SpriteBatcher for layer/sort decisions
  - [x] **PARITY:** Both renderers use SpriteBatcher (see 1.9)
  - [x] **TEST:** WebGL and Canvas show identical grass/sand/ripple ordering

- [x] **1.9** Unified SpriteBatcher for render order consistency ✅ DONE (2025-12-02)
  - [x] Created `src/rendering/SpriteBatcher.ts` with `buildSpriteBatches()` function
  - [x] Takes: player, NPCs, field effects, options → Returns: `SpriteBatchResult` with `lowPriority`, `ySorted`, `highPriority` batches
  - [x] Returns renderer-agnostic `SortableSpriteInfo` objects (not WebGL-specific `SpriteInstance`)
  - [x] Includes utility functions: `splitAroundPlayer()`, `getEffectsForLayer()`, `getNPCsFromBatch()`
  - [x] **Integrated into WebGLMapPage.tsx** - replaced ~160 lines of manual sprite batching
  - [x] Removed unused imports: `getNPCRenderLayer`, `getNPCSortKey` (now handled by SpriteBatcher)
  - [x] **Integrated into useCompositeScene.ts** - uses SpriteBatcher for field effect layer decisions
  - [x] Added `ObjectRenderer.renderSingleFieldEffect()` for rendering pre-filtered effects
  - [x] **PARITY:** ✅ Both renderers use SpriteBatcher for field effect sorting
  - [x] **TEST:** Build passes, both renderers use SpriteBatcher

- [ ] **1.10** Regression test for grass ordering
  - [ ] Add a small headless Jest/Vitest test that builds a tall-grass effect and asserts:
        - front layer sortKey > player sortKey when idle/facing down
        - behind layer when `renderBehindPlayer` is true (moving down)
  - [ ] **TEST:** CI fails if baselines drift
  - **Why:** The 8px baseline slip would have been caught by a cheap unit test. Locking in the contract with an automated check prevents future regressions as we refactor.

---

### Phase 2: Extract Warp Logic (Medium Risk)

Warp handling is complex - extract carefully.

- [x] **2.1** Create `src/game/WarpTriggerProcessor.ts` ✅ DONE (2025-12-02)
  - [x] Extract tile-change detection logic
  - [x] Extract warp trigger classification (arrow, door, walk-over)
  - [x] Return action descriptor (`WarpAction` type), don't execute directly
  - [x] Integrated into `useRunUpdate.ts` (Canvas2D)
  - [x] Integrated into `WebGLMapPage.tsx` (WebGL)
  - [x] Removed `isNonAnimatedDoorBehavior` import from WebGLMapPage (now internal to processor)
  - [x] **PARITY:** Both renderers use shared warp detection
  - [x] **TEST:** Build passes, both renderers use WarpTriggerProcessor

- [x] **2.2** Create `src/game/DoorSequenceRunner.ts` ✅ DONE (2025-12-02)
  - [x] Created shared door entry/exit update functions (simpler than a full hook)
  - [x] `runDoorEntryUpdate(deps, nowTime)` - advances door entry sequence
  - [x] `runDoorExitUpdate(deps, nowTime)` - advances door exit sequence
  - [x] Both use `DoorActionDispatcher` internally
  - [x] Integrated into `WebGLMapPage.tsx` - replaced ~50 lines of inline code
  - [x] Integrated into `useWarpExecution.ts` - simplified advanceDoorEntry/Exit
  - [x] **PARITY:** Both renderers use shared DoorSequenceRunner functions
  - [x] **TEST:** Build passes, both renderers use shared door update logic

- [x] **2.3** Reconcile `useWarpExecution` with door sequence unification ✅ DONE (2025-12-02)
  - [x] Decided: Keep `useWarpExecution` for Canvas2D, use shared functions for door updates
  - [x] Updated `useWarpExecution` to use `DoorSequenceRunner` functions
  - [x] Removed duplicate `DoorActionDeps` imports from both renderers
  - [x] **PARITY:** Single door sequence update path for both renderers
  - [x] **TEST:** No regression in Canvas2D warps

---

### Phase 3: Unify World Management (Medium-High Risk)

`WorldManager` vs `MapManager` is the biggest divergence.

- [x] **3.1** Document differences between WorldManager and MapManager ✅ DONE (2025-12-02)
  - [x] WorldManager: snapshot-based, dynamic loading, GPU scheduling
  - [x] MapManager: one-shot BFS loading, simpler types
  - [x] See detailed comparison below

#### 3.1.1 WorldManager vs MapManager Comparison

| Feature | WorldManager (WebGL) | MapManager (Canvas2D) |
|---------|---------------------|----------------------|
| **Lines** | ~1000 | ~240 |
| **Location** | `src/game/WorldManager.ts` | `src/services/MapManager.ts` |
| **Loading** | Dynamic incremental (BFS each frame) | One-shot BFS (`buildWorld`) |
| **Tileset Format** | `TilesetPairInfo` (indexed PNG for GPU) | `TilesetResources` (Uint8Array) |
| **GPU Scheduling** | `TilesetPairScheduler` (max 2 pairs in GPU) | None (no GPU limits) |
| **Re-anchoring** | Yes (prevents coordinate overflow) | No (coordinates stay small) |
| **Events** | `mapsChanged`, `tilesetsChanged`, `reanchored`, `gpuSlotsSwapped` | None (sync return) |
| **Epoch Tracking** | Yes (invalidates stale async ops during warps) | No |
| **Animations** | Loaded with tilesets (`LoadedAnimation[]`) | Empty array (handled elsewhere) |
| **Output Type** | `WorldSnapshot` | `WorldState` |

**Key Type Differences:**

```typescript
// WorldManager output
interface WorldSnapshot {
  maps: LoadedMapInstance[];
  tilesetPairs: TilesetPairInfo[];
  mapTilesetPairIndex: Map<string, number>;
  anchorBorderMetatiles: number[];
  pairIdToGpuSlot: Map<string, 0 | 1>;  // GPU-specific
  anchorMapId: string;
  worldBounds: { minX, minY, maxX, maxY, width, height };
}

// MapManager output
interface WorldState {
  anchorId: string;
  maps: WorldMapInstance[];
  bounds: { minX, minY, maxX, maxY };  // No width/height
}
```

**Shared Logic (90% overlap):**
- Map loading from JSON index
- Tileset loading (palettes, metatiles, attributes)
- Connection offset computation (`computeOffset`/`computeConnectionOffset`)
- BFS world building
- Bounds calculation

**Unification Strategy:**
1. Create `IWorldProvider` interface both can implement
2. Extract shared loading into `MapLoaderService`
3. Keep GPU-specific logic in WorldManager
4. Canvas2D can use WorldManager in "simple mode" OR keep MapManager behind interface

- [x] **3.2** Create unified `IWorldProvider` interface ✅ DONE (2025-12-02)
  - [x] Created `src/services/IWorldProvider.ts`
  - [x] Unified types: `WorldMapData`, `WorldTilesetData`, `WorldBounds`, `WorldStateSnapshot`
  - [x] Interface methods: `initialize`, `getSnapshot`, `findMapAtPosition`, `getTilesetForMap`
  - [x] Optional methods: `update` (for dynamic loading), `onStateChange` (for events)
  - [x] Helper functions: `computeWorldBounds`, `getTilesetPairId`
  - [x] **TEST:** Build passes

- [x] **3.3** Implement `WorldManager` adapter for interface ✅ DONE (2025-12-02)
  - [x] Created `src/services/WorldManagerAdapter.ts`
  - [x] Wraps WorldManager, converts types to IWorldProvider format
  - [x] Forwards state change events from WorldManager
  - [x] Provides `getWorldManager()` for WebGL-specific access (GPU slots, animations)
  - [x] **TEST:** Build passes

- [x] **3.4** Implement `MapManager` adapter for interface ✅ DONE (2025-12-02)
  - [x] Created `src/services/MapManagerAdapter.ts`
  - [x] Wraps MapManager, converts types to IWorldProvider format
  - [x] Static loading (update() is no-op, onStateChange returns no-op)
  - [x] Provides `getMapManager()` for direct access
  - [x] **TEST:** Build passes

**Note:** Adapters are created but not yet integrated into renderers. Integration
will happen in Phase 4/5 when we migrate renderers to use IWorldProvider.

- [x] **3.5** Decide on long-term world management strategy ✅ DONE (2025-12-02)
  - [x] **Decision: Option C - Keep both behind interface (for now)**

  **Analysis:**
  - Option A (Canvas2D → WorldManager): Requires making GPU scheduling optional,
    adds complexity Canvas2D doesn't need, but gains dynamic loading
  - Option B (WebGL → MapManager): Loses dynamic loading, re-anchoring, GPU
    scheduling - significant downgrade for WebGL
  - Option C (Keep both): Both work independently, minimal risk, allows
    gradual consolidation

  **Rationale:**
  - WorldManager has WebGL-specific optimizations (TilesetPairScheduler, GPU
    slots) that Canvas2D doesn't benefit from
  - MapManager's simpler one-shot loading is sufficient for Canvas2D
  - IWorldProvider interface provides the abstraction layer for unified code
  - Future consolidation can happen when GameRenderer unification is complete

  **Path forward:**
  1. Use adapters in Phase 4/5 when migrating to unified hooks
  2. Shared game logic uses IWorldProvider, not specific managers
  3. Renderer-specific code can access underlying managers via adapter methods
  4. Consider Option A (Canvas2D → WorldManager) once interface stabilizes
  - [x] **PARITY:** Both renderers can use IWorldProvider interface

---

### Phase 4: Create Renderer Interfaces (Medium Risk)

Define clean interfaces for rendering backends.

- [x] **4.1** Finalize `ISpriteRenderer` interface ✅ Already complete
  - [x] Interface at `src/rendering/ISpriteRenderer.ts`
  - [x] `WebGLSpriteRenderer` implements it
  - [x] Full API: uploadSpriteSheet, hasSpriteSheet, renderBatch, setWaterMask, dispose

- [x] **4.2** Create `Canvas2DSpriteRenderer` implementing `ISpriteRenderer` ✅ DONE (2025-12-02)
  - [x] Created `src/rendering/Canvas2DSpriteRenderer.ts`
  - [x] Implements full ISpriteRenderer API
  - [x] Handles flips, alpha, and per-pixel tinting for reflections
  - [x] Note: Water mask clipping not yet implemented (stored for future)
  - [x] **TEST:** Build passes

- [x] **4.3** Create `IFadeRenderer` interface ✅ DONE (2025-12-02)
  - [x] Created `src/rendering/IFadeRenderer.ts`
  - [x] Methods: render(alpha, r?, g?, b?), isValid(), dispose()
  - [x] Both fade renderers implement it

- [x] **4.4** Create `Canvas2DFadeRenderer` implementing `IFadeRenderer` ✅ DONE (2025-12-02)
  - [x] Created `src/rendering/Canvas2DFadeRenderer.ts`
  - [x] Simple fullscreen rect with rgba fill
  - [x] Updated `WebGLFadeRenderer` to also implement IFadeRenderer
  - [x] **TEST:** Build passes

- [x] **4.5** Verify `IRenderPipeline` is sufficient ✅ Already complete
  - [x] `CanvasRenderPipelineAdapter` in RenderPipelineFactory.ts
  - [x] `WebGLRenderPipelineAdapter` in RenderPipelineFactory.ts
  - [x] Both implement full IRenderPipeline interface
  - [x] **PARITY:** Both renderers use IRenderPipeline via adapters

---

### Phase 5: Create Unified Hooks (Medium Risk)

Replace per-file logic with shared hooks.

- [x] **5.0** Extract WebGL render loop to reduce WebGLMapPage.tsx size ✅ DONE (2025-12-02)
  - [x] Created `src/hooks/useWebGLSpriteBuilder.ts` (357 lines)
    - Extracts sprite building: player, NPCs, field effects, doors, arrows
    - Returns sorted sprite batches ready for compositing
  - [x] Created `src/rendering/compositeWebGLFrame.ts` (252 lines)
    - Extracts layer compositing logic
    - Handles reflection layer splitting, water masks, priority batches
  - [x] Integrated extracted code into WebGLMapPage.tsx
    - Replaced inline sprite building with `buildSprites()` from useWebGLSpriteBuilder
    - Replaced inline compositing with `compositeWebGLFrame()`
    - Cleaned up ~15 unused imports
  - [x] **RESULT:** WebGLMapPage reduced from 1835 to 1467 lines (368 lines removed)
  - [x] **TEST:** Build passes, no visual regression in WebGL mode

- [x] **5.1** Create `src/hooks/useGameLoop.ts` ✅ DONE (2025-12-02)
  - [x] GBA-accurate frame timing (59.7275 Hz)
  - [x] Shimmer animation updates via `getGlobalShimmer().update()`
  - [x] Returns: `{ gbaFrame, animationFrame, deltaTime, timestamp, animationFrameChanged }`
  - [x] **PARITY:** Available for both renderers
  - [x] **TEST:** Build passes

- [x] **5.2** Existing `useRunUpdate` hook ✅ ALREADY EXISTS
  - [x] Already handles player updates, warp detection, camera, etc.
  - [x] Used by Canvas2D renderer (MapRenderer)
  - [x] **Note:** WebGLMapPage has inline version, will be unified in Phase 6

- [x] **5.3** Existing `useCompositeScene` hook ✅ ALREADY EXISTS
  - [x] Already handles sprite batch building, layer sorting
  - [x] Used by Canvas2D renderer (MapRenderer)
  - [x] **Note:** WebGL uses `compositeWebGLFrame`, both achieve same result

- [ ] **5.4** Migrate WebGLMapPage to use unified hooks
  - [ ] Deferred to Phase 6 - GameRenderer will use unified hooks
  - [ ] WebGLMapPage will be deprecated once GameRenderer is complete

- [ ] **5.5** Migrate MapRenderer to use unified hooks
  - [ ] Deferred to Phase 6 - GameRenderer will use unified hooks
  - [ ] MapRenderer will be deprecated once GameRenderer is complete

---

### Phase 6: Create GameRenderer Component (High Risk)

Final unification step - **OKR completion checkpoint**.

- [x] **6.1** Create `src/components/GameRenderer.tsx` ✅ DONE (2025-12-02)
  - [x] Detect WebGL2 support on mount via `detectRendererType()`
  - [x] Instantiate appropriate pipeline + sprite + fade renderers via `RendererFactory`
  - [x] Use `useGameLoop` hook for GBA-accurate timing
  - [x] Full WebGL rendering implementation with player, NPCs, field effects, doors, arrows
  - [x] Full game logic: player updates, warp detection, camera following
  - [x] Uses extracted hooks: `useWebGLSpriteBuilder`, `compositeWebGLFrame`
  - [ ] **TODO:** Canvas2D rendering path (placeholder only)

- [x] **6.2** Create `src/rendering/RendererFactory.ts` ✅ DONE (2025-12-02)
  - [x] `createRenderers()` - creates complete renderer set
  - [x] `detectRendererType()` - auto-detect WebGL/Canvas2D
  - [x] `getRendererTypeFromURL()` - read `?renderer=` param
  - [x] Returns: `{ pipeline, spriteRenderer, fadeRenderer, webglCanvas, dispose }`

- [x] **6.3** Wire up routing ✅ DONE (2025-12-02)
  - [x] `/#/play` → GameRenderer (auto-detect backend)
  - [x] `/#/play?renderer=webgl` → Force WebGL
  - [x] `/#/play?renderer=canvas2d` → Force Canvas2D
  - [x] Added to `src/main.tsx` Router

- [ ] **6.4** Deprecate old components
  - [ ] Mark WebGLMapPage as deprecated
  - [ ] Mark MapRenderer as deprecated
  - [ ] Add console warnings if accessed directly

- [ ] **6.5** Final cleanup & OKR verification
  - [ ] Complete GameRenderer rendering implementation
  - [ ] Remove duplicate code
  - [ ] Update documentation
  - [ ] **MEASURE:** Count final LOC - target <1800 combined (down from ~3000)
  - [ ] **TEST:** Full game works in both modes via GameRenderer
  - [ ] **OKR CHECK:** Verify all Key Results met

---

## 7. Risk Assessment

| Phase | Risk | Effort | Mitigation |
|-------|------|--------|------------|
| Phase 1 | Low | 1-2 days | Pure extraction, no behavior change |
| Phase 2 | Medium | 2-3 days | Warp logic is complex, test thoroughly |
| Phase 3 | Medium-High | 3-5 days | World management is fundamental |
| Phase 4 | Medium | 2-3 days | Interface design affects flexibility |
| Phase 5 | Medium | 3-4 days | Hook dependencies can be tricky |
| Phase 6 | High | 3-5 days | Full integration, many moving parts |

**Total estimated effort:** 2-3 weeks

---

## 8. File Changes Summary

### New Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/components/GameRenderer.tsx` | Unified game component | ~400 |
| `src/hooks/useGameLoop.ts` | Frame timing | ~80 |
| `src/hooks/usePlayerUpdate.ts` | Player logic | ~150 |
| `src/hooks/useWarpFlow.ts` | Warp orchestration | ~200 |
| `src/hooks/useSceneComposition.ts` | Sprite building | ~250 |
| `src/game/WarpTriggerProcessor.ts` | Unified warp detection | ~250 |
| `src/game/DoorSequenceRunner.ts` | Unified door update loops | ~140 |
| `src/services/IWorldProvider.ts` | Unified world provider interface | ~175 |
| `src/services/WorldManagerAdapter.ts` | WorldManager → IWorldProvider | ~170 |
| `src/services/MapManagerAdapter.ts` | MapManager → IWorldProvider | ~175 |
| `src/rendering/IFadeRenderer.ts` | Fade renderer interface | ~55 |
| `src/rendering/Canvas2DFadeRenderer.ts` | Canvas2D fade implementation | ~60 |
| `src/rendering/Canvas2DSpriteRenderer.ts` | Canvas2D sprite implementation | ~260 |
| `src/hooks/useWebGLSpriteBuilder.ts` | WebGL sprite batch building | ~320 |
| `src/rendering/compositeWebGLFrame.ts` | WebGL layer compositing | ~230 |
| `src/game/setupObjectCollisionChecker.ts` | Collision setup | ~20 |
| `src/game/findPlayerSpawnPosition.ts` | Spawn logic | ~50 |
| `src/game/buildWorldCameraView.ts` | Camera view | ~40 |
| `src/game/playerCoords.ts` | Canonical player Y coords | ~127 |
| `src/rendering/SpriteBatcher.ts` | Unified sprite batching | ~315 |
| `src/field/ArrowAnimationConstants.ts` | Arrow timing | ~30 |
| `src/rendering/Canvas2DSpriteRenderer.ts` | Canvas2D sprites | ~150 |
| `src/rendering/Canvas2DFadeRenderer.ts` | Canvas2D fade | ~30 |
| **Total new** | | **~1500** |

### Files to Deprecate/Remove

| File | Current Lines | After |
|------|---------------|-------|
| `WebGLMapPage.tsx` | ~1800 | Deprecated |
| `MapRenderer.tsx` | ~800 | Deprecated |
| `useCompositeScene.ts` | ~400 | Merged |
| `useRunUpdate.ts` | ~300 | Merged |
| **Total removed** | **~3300** | 0 |

**Net change:** ~1800 fewer lines, cleaner architecture

---

## 9. Code Parity Checklist

| Logic | Status | Notes |
|-------|--------|-------|
| Warp Detection | ✅ Shared | `detectWarpTrigger`, `WarpTriggerProcessor.processWarpTrigger()` |
| Warp Execution | ✅ Shared | `executeWarp` |
| Warp Processing | ✅ Shared | `WarpTriggerProcessor.ts` - unified tile-change detection & classification |
| Door Sequence Updates | ✅ Shared | `DoorSequenceRunner.ts` - unified door entry/exit update loops |
| Reflection Math | ✅ Shared | `ReflectionRenderer` |
| Shimmer Effect | ✅ Shared | `ReflectionShimmer` |
| Door Sequences | ✅ Shared | `DoorActionDispatcher` |
| Door Animations | ✅ Shared | `useDoorAnimations` hook |
| Arrow Overlay | ✅ Shared | `useArrowOverlay` hook |
| Field Sprites | ✅ Shared | `useFieldSprites` hook |
| Fade Timing | ✅ Shared | `FadeController` |
| Tile Lookup | ⚠️ Divergent | `TileResolverFactory` vs `resolveTileAt` |
| Anim Timing | ⚠️ Divergent | `WebGLAnimationManager` vs `useTilesetAnimations` |
| Map Loading | ✅ Interface | `IWorldProvider` interface with adapters for both managers |
| Spawn Position | ✅ Shared | `findPlayerSpawnPosition()` |
| Collision Setup | ✅ Shared | `setupObjectCollisionChecker()` |
| Arrow Frame Calc | ✅ Shared | `ArrowAnimationConstants.ts` |
| Camera View Build | ✅ Shared | `buildWorldCameraView()` |
| Y-Sort Key Calc | ✅ Shared | `calculateSortKey()` in `playerCoords.ts` (re-exported from `spriteUtils.ts`) |
| Player Coords | ✅ Shared | `getPlayerCenterY()`, `getPlayerFeetY()` in `playerCoords.ts` |
| Field Effect Layer | ✅ Shared | `computeFieldEffectLayer()` in `fieldEffectUtils.ts` |
| Sprite Batching | ✅ Shared | `buildSpriteBatches()` in `SpriteBatcher.ts` - used by both renderers |
| NPC Render Layer | ✅ Shared | `getNPCRenderLayer()` in `elevationPriority.ts` |
| WebGL Y-Sort Order | ✅ Fixed | `WebGLSpriteRenderer.renderBatch()` now preserves order |

---

## 10. Success Criteria

1. **Single component** handles both WebGL and Canvas2D rendering
2. **Zero visual regression** - both modes look identical
3. **GBA timing preserved** - 59.7275 Hz frame rate, shimmer animation
4. **Code reduction** - at least 30% fewer total lines
5. **Maintainability** - game logic changes only need to happen once
6. **Performance** - WebGL mode maintains 60fps, Canvas2D acceptable fallback

---

## 11. Bugs Found & Fixed During Parity Work

### 11.1 WebGL Y-Sort Order Bug (Fixed 2025-12-02)

**Symptoms:**
- Player always rendered on top of NPCs regardless of Y position
- Tall grass frame 4 always rendered behind player (should be in front when at rest)

**Root Cause:**
`WebGLSpriteRenderer.renderBatch()` was grouping ALL sprites by atlas name:
```typescript
// OLD CODE - BROKEN
const atlasGroups = this.groupByAtlas(sprites);
for (const [atlasName, atlasSprites] of atlasGroups) {
  // All NPC sprites rendered together, then player...
}
```

This destroyed the carefully computed Y-sort order. If the sorted array was:
```
[NPC_A (sortKey=100), Player (sortKey=150), NPC_B (sortKey=200)]
```

It would be regrouped as:
```
{"npc-BOY": [NPC_A, NPC_B], "player-walking": [Player]}
```

And rendered as: `NPC_A → NPC_B → Player` (wrong!)

**Fix:**
Changed to batch **consecutive** sprites with the same atlas, preserving sort order:
```typescript
// NEW CODE - CORRECT
while (batchStart < sprites.length) {
  // Find consecutive sprites with same atlas
  // Render that batch, then continue to next
  // This preserves Y-sort order while still batching when possible
}
```

**Also Fixed:**
- Grass sortKey was using `playerWorldY + 8` instead of `playerWorldY + 16`
- This caused 8-pixel Y offset that put grass behind player

**Why Canvas2D Worked:**
Canvas2D uses separate render passes (bottom effects → player → top effects) without sortKey batching, so the atlas grouping bug didn't affect it.

**Files Changed:**
- `src/rendering/webgl/WebGLSpriteRenderer.ts` - Fixed batching logic
- `src/rendering/spriteUtils.ts` - Fixed grass sortKey Y offset

---

## 12. Related Documentation

- `docs/projects/webglrefactor/09-webgl-sprite-renderer.md` - WebGL sprite implementation
- `src/rendering/ISpriteRenderer.ts` - Existing sprite interface
- `src/rendering/IRenderPipeline.ts` - Existing pipeline interface
- `src/rendering/types.ts` - Shared rendering types
