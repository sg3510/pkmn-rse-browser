# Refactor 2.6: Implementation Checklist

## Phase 1: Rendering Pipeline (Week 1)

### Create New Modules
- [ ] `src/rendering/types.ts` - Shared types
- [ ] `src/rendering/TileRenderer.ts` - Single tile drawing
- [ ] `src/rendering/PassRenderer.ts` - Render pass logic
- [ ] `src/rendering/ElevationFilter.ts` - Elevation filtering
- [ ] `src/rendering/LayerCompositor.ts` - Layer composition
- [ ] `src/rendering/RenderPipeline.ts` - Main orchestrator

### Migrate Code
- [ ] Extract `drawTileToCanvas` → `TileRenderer.drawTile`
- [ ] Extract `renderPassCanvas` → `PassRenderer.renderBackground/renderTopLayer`
- [ ] Extract elevation filter callbacks → `ElevationFilter.createFilter`
- [ ] Extract layer drawing → `LayerCompositor.composite`

### Testing
- [ ] Unit tests for `ElevationFilter`
- [ ] Unit tests for `TileRenderer`
- [ ] Integration test for `RenderPipeline`
- [ ] Visual regression snapshot baseline

### Verification
- [ ] Rendering output identical to original
- [ ] No performance regression
- [ ] All tile types render correctly

---

## Phase 2: Game Engine (Week 2)

### Create New Modules
- [ ] `src/engine/GameState.ts` - State container
- [ ] `src/engine/AnimationTimer.ts` - Animation timing
- [ ] `src/engine/GameLoop.ts` - Main loop
- [ ] `src/engine/UpdateCoordinator.ts` - Update orchestration

### Migrate Code
- [ ] Extract animation timing from useEffect → `AnimationTimer`
- [ ] Extract state variables → `GameState`
- [ ] Extract update logic → `UpdateCoordinator`
- [ ] Create `GameLoop` with fixed timestep

### Create Hooks
- [ ] `src/hooks/useGameEngine.ts` - Engine lifecycle
- [ ] `src/hooks/useInput.ts` - Input handling

### Testing
- [ ] Unit tests for `AnimationTimer`
- [ ] Unit tests for `GameState`
- [ ] Unit tests for `UpdateCoordinator`

### Verification
- [ ] Game loop runs at 60fps
- [ ] Player movement identical
- [ ] Animations play at correct speed

---

## Phase 3: Field Effects (Week 3)

### Create New Modules
- [ ] `src/field/DoorSequencer.ts` - Door state machine
- [ ] `src/field/WarpHandler.ts` - Warp detection
- [ ] `src/field/FadeController.ts` - Fade transitions
- [ ] `src/field/ArrowOverlay.ts` - Arrow indicators
- [ ] `src/field/ReflectionRenderer.ts` - Reflections

### Migrate Code
- [ ] Extract `DoorEntrySequence` → `DoorSequencer`
- [ ] Extract `DoorExitSequence` → `DoorSequencer`
- [ ] Extract warp detection → `WarpHandler`
- [ ] Extract `FadeState` → `FadeController`
- [ ] Extract reflection rendering → `ReflectionRenderer`

### Testing
- [ ] Unit tests for `DoorSequencer` (entry + exit)
- [ ] Unit tests for `WarpHandler`
- [ ] Unit tests for `FadeController`
- [ ] Integration test for door→warp→fade flow

### Verification
- [ ] All door types animate correctly
- [ ] All warp types work (door, teleport)
- [ ] Fade timing matches original
- [ ] Reflections render correctly

---

## Phase 4: Thin Component (Week 4)

### Create Support Files
- [ ] `src/components/MapRendererTypes.ts`
- [ ] `src/hooks/useMapAssets.ts`

### Rewrite MapRenderer
- [ ] Replace rendering with `RenderPipeline`
- [ ] Replace game loop with `useGameEngine`
- [ ] Replace input with `useInput`
- [ ] Replace assets with `useMapAssets`

### Delete Old Code
- [ ] Remove `renderPass` function
- [ ] Remove `renderPassCanvas` function
- [ ] Remove `compositeScene` function
- [ ] Remove inline state machines
- [ ] Remove inline input handlers

### Final Verification
- [ ] MapRenderer.tsx < 250 lines
- [ ] All features work identically
- [ ] No console errors
- [ ] Performance maintained or improved

---

## Success Criteria

### Code Quality
- [ ] No file > 400 lines
- [ ] Each module has single responsibility
- [ ] Clear interfaces between modules
- [ ] JSDoc comments on public APIs

### Functionality
- [ ] Player movement works
- [ ] NPCs render and move
- [ ] Doors animate and warp
- [ ] Elevations render correctly
- [ ] Reflections work
- [ ] Field effects work (grass, sand, water)
- [ ] Surfing works
- [ ] Save/load works

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
