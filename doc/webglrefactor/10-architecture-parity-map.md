# 10 - Architecture Parity Map: Unifying WebGLMapPage & MapRenderer

This document tracks the effort to merge `src/pages/WebGLMapPage.tsx` and `src/components/MapRenderer.tsx` into a unified `GameRenderer` component with pluggable WebGL/Canvas2D backends.

> **Last Updated:** 2025-12-02
> **Status:** Phase 1 in progress - extracting shared utilities

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
  - [ ] **PARITY:** Canvas2D path should also use `buildWorldCameraView()` (TODO)
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

- [ ] **1.8** Precomputed field-effect layers + sortKeys
  - [ ] Extend `FieldEffectManager.getEffectsForRendering(playerFeetY?)` to return `layer` + `sortKey`
  - [ ] Wire WebGL renderer to use returned values (drop local compute)
  - [ ] Wire Canvas renderer to optional use (keeps two-pass draw but same data)
  - [ ] **PARITY:** Both renderers use same precomputed values
  - [ ] **TEST:** WebGL and Canvas show identical grass/sand/ripple ordering
  - **Why:** Today, ordering is recomputed differently per renderer (WebGL sorts; Canvas draws in fixed passes). Centralizing the sort data in the manager guarantees parity and reduces renderer logic/bugs.

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

- [ ] **2.1** Create `src/game/WarpTriggerProcessor.ts`
  - [ ] Extract tile-change detection logic
  - [ ] Extract warp trigger classification (arrow, door, walk-over)
  - [ ] Return action descriptor, don't execute directly
  - [ ] **PARITY:** Both renderers use shared warp detection
  - [ ] **TEST:** All warp types detected correctly

- [ ] **2.2** Create `src/hooks/useWarpFlow.ts` hook
  - [ ] Combine warp detection + execution in single hook
  - [ ] Accept renderer-agnostic dependencies
  - [ ] Handle fade, door sequencer, warp executor coordination
  - [ ] **PARITY:** Both renderers use unified hook
  - [ ] **TEST:** Warps work identically in both modes

- [ ] **2.3** Reconcile `useWarpExecution` with new hook
  - [ ] Decide: merge or keep separate
  - [ ] Ensure MapRenderer uses unified approach
  - [ ] **PARITY:** Single warp execution path for both renderers
  - [ ] **TEST:** No regression in Canvas2D warps

---

### Phase 3: Unify World Management (Medium-High Risk)

`WorldManager` vs `MapManager` is the biggest divergence.

- [ ] **3.1** Document differences between WorldManager and MapManager
  - [ ] WorldManager: snapshot-based, supports stitched worlds
  - [ ] MapManager: event-based, single map focus
  - [ ] Identify which features each provides

- [ ] **3.2** Create unified `IWorldProvider` interface
  ```typescript
  interface IWorldProvider {
    getCurrentSnapshot(): WorldSnapshot;
    loadMap(mapId: string): Promise<WorldSnapshot>;
    getTileAt(worldX: number, worldY: number): ResolvedTile | null;
    getObjectsInView(view: WorldCameraView): ObjectEvent[];
  }
  ```

- [ ] **3.3** Implement `WorldManager` adapter for interface
  - [ ] Wrap existing WorldManager
  - [ ] **PARITY:** WebGLMapPage uses adapter
  - [ ] **TEST:** WebGLMapPage works with adapter

- [ ] **3.4** Implement `MapManager` adapter for interface
  - [ ] Wrap existing MapManager
  - [ ] **PARITY:** MapRenderer uses adapter
  - [ ] **TEST:** MapRenderer works with adapter

- [ ] **3.5** Decide on long-term world management strategy
  - [ ] Option A: Migrate MapRenderer to WorldManager
  - [ ] Option B: Migrate WebGLMapPage to MapManager
  - [ ] Option C: Keep both behind interface
  - [ ] **PARITY:** Both renderers use same world provider interface

---

### Phase 4: Create Renderer Interfaces (Medium Risk)

Define clean interfaces for rendering backends.

- [ ] **4.1** Finalize `ISpriteRenderer` interface
  ```typescript
  interface ISpriteRenderer {
    uploadSpriteSheet(name: string, source: CanvasImageSource): void;
    hasSpriteSheet(name: string): boolean;
    renderBatch(sprites: SpriteInstance[], view: SpriteView): void;
    dispose(): void;
  }
  ```

- [ ] **4.2** Create `Canvas2DSpriteRenderer` implementing `ISpriteRenderer`
  - [ ] Wrap `ObjectRenderer` functionality
  - [ ] Match WebGLSpriteRenderer API
  - [ ] **PARITY:** Both renderers use ISpriteRenderer interface
  - [ ] **TEST:** Sprites render correctly via interface

- [ ] **4.3** Create `IFadeRenderer` interface
  ```typescript
  interface IFadeRenderer {
    render(alpha: number, r?: number, g?: number, b?: number): void;
    dispose(): void;
  }
  ```

- [ ] **4.4** Create `Canvas2DFadeRenderer` implementing `IFadeRenderer`
  - [ ] Simple fullscreen rect with alpha
  - [ ] **PARITY:** Both renderers use IFadeRenderer interface
  - [ ] **TEST:** Fade works via interface

- [ ] **4.5** Verify `IRenderPipeline` is sufficient
  - [ ] Check WebGLRenderPipeline implements it fully
  - [ ] Check RenderPipeline implements it fully
  - [ ] Add any missing methods to interface
  - [ ] **PARITY:** Both renderers use IRenderPipeline interface

---

### Phase 5: Create Unified Hooks (Medium Risk)

Replace per-file logic with shared hooks.

- [ ] **5.1** Create `src/hooks/useGameLoop.ts`
  - [ ] GBA-accurate frame timing (59.7275 Hz)
  - [ ] Shimmer animation updates
  - [ ] Returns: `{ gbaFrame, deltaTime, shimmerState }`
  - [ ] **PARITY:** Both renderers use shared hook
  - [ ] **TEST:** Frame timing matches GBA

- [ ] **5.2** Create `src/hooks/usePlayerUpdate.ts`
  - [ ] Input handling
  - [ ] Movement updates
  - [ ] Tile change detection
  - [ ] Returns: `{ player, tileChanged, currentTile }`
  - [ ] **PARITY:** Both renderers use shared hook
  - [ ] **TEST:** Player movement works

- [ ] **5.3** Create `src/hooks/useSceneComposition.ts`
  - [ ] Sprite batch building (player, NPCs, effects)
  - [ ] Layer sorting
  - [ ] Reflection handling
  - [ ] Returns: `{ sprites, reflectionSprites, priority0Sprites }`
  - [ ] **PARITY:** Both renderers use shared hook
  - [ ] **TEST:** Sprite ordering correct

- [ ] **5.4** Migrate WebGLMapPage to use new hooks
  - [ ] Replace inline logic with hook calls
  - [ ] Verify no visual regression
  - [ ] **PARITY:** WebGLMapPage uses unified hooks
  - [ ] **TEST:** Full playthrough in WebGL mode

- [ ] **5.5** Migrate MapRenderer to use new hooks
  - [ ] Replace/merge existing hooks
  - [ ] Verify no visual regression
  - [ ] **PARITY:** MapRenderer uses unified hooks
  - [ ] **TEST:** Full playthrough in Canvas2D mode

---

### Phase 6: Create GameRenderer Component (High Risk)

Final unification step - **OKR completion checkpoint**.

- [ ] **6.1** Create `src/components/GameRenderer.tsx`
  - [ ] Detect WebGL2 support on mount
  - [ ] Instantiate appropriate pipeline + sprite renderer
  - [ ] Use unified hooks for game logic
  - [ ] Single render loop calling renderer interfaces
  - [ ] **PARITY:** Single component serves both backends

- [ ] **6.2** Create renderer factory
  ```typescript
  function createRenderers(canvas: HTMLCanvasElement): {
    pipeline: IRenderPipeline;
    spriteRenderer: ISpriteRenderer;
    fadeRenderer: IFadeRenderer;
  }
  ```

- [ ] **6.3** Wire up routing
  - [ ] `/#/play` → GameRenderer (auto-detect backend)
  - [ ] `/#/play?renderer=webgl` → Force WebGL
  - [ ] `/#/play?renderer=canvas2d` → Force Canvas2D

- [ ] **6.4** Deprecate old components
  - [ ] Mark WebGLMapPage as deprecated
  - [ ] Mark MapRenderer as deprecated
  - [ ] Add console warnings if accessed directly

- [ ] **6.5** Final cleanup & OKR verification
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
| `src/game/WarpTriggerProcessor.ts` | Warp detection | ~100 |
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
| Warp Detection | ✅ Shared | `detectWarpTrigger` |
| Warp Execution | ✅ Shared | `executeWarp` |
| Reflection Math | ✅ Shared | `ReflectionRenderer` |
| Shimmer Effect | ✅ Shared | `ReflectionShimmer` |
| Door Sequences | ✅ Shared | `DoorActionDispatcher` |
| Door Animations | ✅ Shared | `useDoorAnimations` hook |
| Arrow Overlay | ✅ Shared | `useArrowOverlay` hook |
| Field Sprites | ✅ Shared | `useFieldSprites` hook |
| Fade Timing | ✅ Shared | `FadeController` |
| Tile Lookup | ⚠️ Divergent | `TileResolverFactory` vs `resolveTileAt` |
| Anim Timing | ⚠️ Divergent | `WebGLAnimationManager` vs `useTilesetAnimations` |
| Map Loading | ⚠️ Divergent | `WorldManager` vs `MapManager` |
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

- `doc/webglrefactor/09-webgl-sprite-renderer.md` - WebGL sprite implementation
- `src/rendering/ISpriteRenderer.ts` - Existing sprite interface
- `src/rendering/IRenderPipeline.ts` - Existing pipeline interface
- `src/rendering/types.ts` - Shared rendering types
