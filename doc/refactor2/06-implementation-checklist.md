# Refactor 2.6: Implementation Checklist

## Phase 1: Rendering Pipeline (Week 1)

### Create New Modules
- [x] `src/rendering/types.ts` - Shared types
- [x] `src/rendering/TileRenderer.ts` - Single tile drawing
- [x] `src/rendering/PassRenderer.ts` - Render pass logic
- [x] `src/rendering/ElevationFilter.ts` - Elevation filtering
- [x] `src/rendering/LayerCompositor.ts` - Layer composition
- [x] `src/rendering/RenderPipeline.ts` - Main orchestrator

### Migrate Code
- [x] Extract `drawTileToCanvas` → `TileRenderer.drawTile` (implemented in new module)
- [x] Extract `renderPassCanvas` → `PassRenderer.renderBackground/renderTopLayer` (implemented in new module)
- [x] Extract elevation filter callbacks → `ElevationFilter.createFilter` (implemented in new module)
- [x] Extract layer drawing → `LayerCompositor.composite` (implemented in new module)
- [x] Wire up RenderPipeline in MapRenderer.tsx
- [x] Add tile resolver adapters for pipeline

NOTE: Original functions retained in MapRenderer.tsx per requirement to remove NO function.
The new modular pipeline is initialized alongside existing code and can be switched via feature flag.

### Testing
- [ ] Unit tests for `ElevationFilter`
- [ ] Unit tests for `TileRenderer`
- [ ] Integration test for `RenderPipeline`
- [ ] Visual regression snapshot baseline

### Verification
- [x] Build passes with new modules
- [x] RenderPipeline initializes correctly (logged in console)
- [x] Game runs without errors from refactor
- [x] No functions removed (kept existing implementation)
- [ ] Rendering output identical to original (when pipeline used)
- [ ] No performance regression
- [ ] All tile types render correctly

---

## Phase 2: Game Engine (Week 2)

### Create New Modules
- [x] `src/engine/GameState.ts` - State container
- [x] `src/engine/AnimationTimer.ts` - Animation timing
- [x] `src/engine/GameLoop.ts` - Main loop
- [x] `src/engine/UpdateCoordinator.ts` - Update orchestration

### Migrate Code
- [x] Extract animation timing from useEffect → `AnimationTimer`
- [x] Extract state variables → `GameState`
- [x] Extract update logic → `UpdateCoordinator`
- [x] Create `GameLoop` with fixed timestep

### Create Hooks
- [x] `src/hooks/useGameEngine.ts` - Engine lifecycle
- [x] `src/hooks/useInput.ts` - Input handling

### Testing
- [x] Unit tests for `AnimationTimer`
- [x] Unit tests for `GameState`
- [x] Unit tests for `UpdateCoordinator`

### Verification
- [ ] Game loop runs at 60fps
- [ ] Player movement identical
- [ ] Animations play at correct speed

---

## Phase 3: Field Effects (Week 3)

### Create New Modules
- [x] `src/field/types.ts` - Shared field types
- [x] `src/field/DoorSequencer.ts` - Door state machine
- [x] `src/field/WarpHandler.ts` - Warp detection
- [x] `src/field/FadeController.ts` - Fade transitions
- [x] `src/field/ArrowOverlay.ts` - Arrow indicators
- [x] `src/field/ReflectionRenderer.ts` - Reflections
- [x] `src/field/index.ts` - Module exports

### Migrate Code
- [x] Extract `DoorEntrySequence` → `DoorSequencer` (state machine created, original retained)
- [x] Extract `DoorExitSequence` → `DoorSequencer` (state machine created, original retained)
- [x] Extract warp detection → `WarpHandler` - **INTEGRATED** into MapRenderer.tsx
- [x] Extract `FadeState` → `FadeController` - **INTEGRATED** into MapRenderer.tsx
- [x] Extract arrow overlay → `ArrowOverlay` - **INTEGRATED** into MapRenderer.tsx
- [x] Extract reflection rendering → `ReflectionRenderer` (utilities module created)

NOTE: FadeController, ArrowOverlay, WarpHandler, and DoorSequencer have been fully integrated into
MapRenderer.tsx, replacing all inline state management. Door entry/exit sequences now use
useDoorSequencer hook with action-based state machine pattern.

### Testing
- [ ] Unit tests for `DoorSequencer` (entry + exit)
- [ ] Unit tests for `WarpHandler`
- [ ] Unit tests for `FadeController`
- [ ] Integration test for door→warp→fade flow

### Verification
- [x] Build passes with new modules
- [x] No functions removed (kept existing implementation)
- [x] All door types animate correctly (when new modules used)
- [x] All warp types work (door, teleport)
- [x] Fade timing matches original
- [x] Reflections render correctly

---

## Phase 4: Thin Component (Week 4)

### Create Support Files
- [x] `src/components/MapRendererTypes.ts` - Props, Handle, PlayerPosition types
- [x] `src/hooks/map/useMapAssets.ts` - Already exists (417 lines)
- [x] `src/hooks/map/useMapLogic.ts` - Already exists (96 lines)
- [x] `src/hooks/useInput.ts` - Already exists from Phase 2
- [x] `src/hooks/useGameEngine.ts` - Already exists from Phase 2
- [x] `src/hooks/index.ts` - Module exports

NOTE: Support files created. Additionally, redundant type definitions were removed from
MapRenderer.tsx (FadeState, ArrowOverlayState, WarpRuntimeState, DIRECTION_VECTORS,
DOOR_FRAME_HEIGHT, DOOR_FRAME_DURATION_MS, DOOR_FADE_DURATION) - now imported from field/types.ts.

### Rewrite MapRenderer (IN PROGRESS)
Incremental migration following doc/refactor2/04-a-detailed-migration-plan.md:
- [x] Step 1: Remove duplicate helper functions (260 lines removed, now using tilesetUtils.ts)
- [x] Step 2: Extract door warp logic to useDoorSequencer (COMPLETE)
  - [x] Created `src/hooks/useDoorSequencer.ts` hook wrapping DoorSequencer class
  - [x] Replaced inline `isDoorAnimDone` with imported `isDoorAnimationDone`
  - [x] Full integration into MapRenderer.tsx (entry + exit sequences)
  - [x] Added `startAutoWarp` for non-animated door warps
  - [x] Removed `DoorEntrySequence`, `DoorExitSequence` interfaces, `doorEntry`, `doorExitRef`
  - [x] Fixed door animation race conditions with `-1` sentinel value
  - [x] Matched pokeemerald exit sequence: door starts fully open, then animates closed
- [x] Step 3: Switch to RenderPipeline exclusively
  - [x] Fixed type conflicts between rendering/types.ts and tilesetUtils.ts
  - [x] Added USE_RENDER_PIPELINE feature flag
  - [x] Added RenderPipeline code path in compositeScene (background, topBelow, topAbove)
  - [x] Enabled flag and verified identical rendering output
  - [x] Remove old renderPassCanvas/renderPass code (COMPLETED - ~170 lines removed)
- [x] Step 4: Extract game loop to useGameEngine (COMPLETE)
  - [x] Engine modules already in use (GameLoop, UpdateCoordinator, AnimationTimer)
  - [x] useGameEngine hook exists in src/hooks/useGameEngine.ts
  - [x] Created useRunUpdate hook (~377 lines) - extracts main game update loop
  - [x] Created useCompositeScene hook (~290 lines) - extracts scene rendering
  - [x] Created useTilesetAnimations hook (~125 lines) - extracts animation loading
  - [x] Created useDebugCallbacks hook (~100 lines) - extracts debug functions
- [x] Step 5: Consolidate asset loading
  - [x] Moved DOOR_ASSET_MAP (~100 lines) to src/data/doorAssets.ts
  - [x] Moved getDoorAssetForMetatile function to src/data/doorAssets.ts
  - [x] Moved ARROW_SPRITE_PATH to src/data/doorAssets.ts
  - [x] Created useFieldSprites hook for future sprite consolidation
  - [x] Created useDoorAnimations hook (~142 lines extracted)
  - [x] Created useArrowOverlay hook (~94 lines extracted)
  - [x] Extracted warp execution + door warp handlers into `useWarpExecution` hook
  - [x] MapRenderer now calls `useWarpExecution` (no inline warp logic)
  - [ ] Full sprite loading consolidation (deferred to Step 6)
- [ ] Step 6: Create thin MapRenderer component

### Delete Old Code (PARTIALLY COMPLETE)
Old rendering code removed with user approval:
- [x] Remove `renderPass` function
- [x] Remove `renderPassCanvas` function
- [x] Remove `drawTileToImageData` function
- [x] Remove `drawTileToCanvas` function (removed earlier)
- [x] Remove unused ImageData refs
- [x] Remove CanvasRenderer initialization
- [x] Remove `compositeScene` function (extracted to useCompositeScene hook)
- [x] Remove inline door state machines (DoorEntrySequence, DoorExitSequence)
- [x] Remove remaining inline state machines (all extracted to classes: WarpHandler, FadeController, ArrowOverlay)
- [ ] Remove inline input handlers (deferred - complex)

### Verification
- [x] Build passes with new support files
- [x] Old rendering code removed (~170 lines)
- [x] Door asset config moved (~124 lines)
- [ ] MapRenderer.tsx < 250 lines (current: ~1041 lines - reduced from 2362 via hook extractions; warp logic now in hook)
- [x] All features work identically (verified by user)
- [x] No console errors
- [x] Performance maintained

---

## Success Criteria

### Code Quality
- [ ] No file > 400 lines
- [ ] Each module has single responsibility
- [ ] Clear interfaces between modules
- [ ] JSDoc comments on public APIs

### Functionality
- [x] Player movement works
- [x] NPCs render and move
- [x] Doors animate and warp
- [x] Elevations render correctly
- [x] Reflections work
- [x] Field effects work (grass, sand, water)
- [x] Surfing works
- [ ] Save/load works (not tested)

### Performance
- [ ] Frame time < 16ms average
- [ ] No increased memory usage
- [ ] Scrolling is smooth

### Testing
- [ ] Unit test coverage > 80%
- [ ] Visual regression tests pass
- [ ] Performance benchmarks green

---

## Rollback Plan

If issues are discovered:

1. **Git history preserved** - Can revert any commit
2. **Feature flags** - Can toggle between old/new rendering
3. **Incremental extraction** - Each module can be reverted independently

---

## Notes

- Do NOT change any game logic during refactor
- Preserve exact visual output
- Preserve exact timing behavior
- Document any discovered bugs (fix later)
- Keep commits small and focused
