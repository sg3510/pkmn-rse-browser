# Implementation Phases

## Phase 1: Extract Debug Panels (Low Risk)

**Goal**: Remove ~150 lines of inline JSX from WebGLMapPage.tsx

### Tasks
1. Create `src/components/debug/TileDebugPanel.tsx`
2. Create `src/components/debug/MapStitchingDebugPanel.tsx`
3. Create `src/components/debug/WarpDebugPanel.tsx`
4. Update WebGLMapPage to import and use these components

### Before/After

```tsx
// BEFORE (inline in WebGLMapPage.tsx)
{debugTile && (
  <div style={{ marginTop: 12, padding: 8, ... }}>
    <div><strong>Position:</strong> ({debugTile.tileX}, {debugTile.tileY})</div>
    {/* 50+ more lines */}
  </div>
)}

// AFTER
<TileDebugPanel tile={debugTile} />
```

### Files Changed
- `WebGLMapPage.tsx` (-150 lines)
- New: `src/components/debug/*.tsx` (+150 lines total)

---

## Phase 2: Extract Camera Controller (Low Risk)

**Goal**: Unify camera logic

### Tasks
1. Create `src/game/CameraController.ts`
2. Extract camera positioning from both renderers
3. Add `followPlayer()` and `getView()` methods

### Current Camera Logic (WebGLMapPage lines 1435-1479)

```typescript
// Currently inline:
const cameraX = cameraRef.current.x;
const cameraY = cameraRef.current.y;
const startTileX = Math.floor(cameraX / METATILE_SIZE);
// ... 40+ lines
```

### New API

```typescript
const camera = new CameraController();
camera.followPlayer(player, worldBounds);
const view = camera.getView(VIEWPORT_CONFIG);
```

### Files Changed
- New: `src/game/CameraController.ts` (+100 lines)
- `WebGLMapPage.tsx` (-40 lines)
- `MapRenderer.tsx` (-20 lines from useCompositeScene)

---

## Phase 3: Unify Tile Resolution (Medium Risk)

**Goal**: Single pattern for accessing tile data

### Tasks
1. Create `src/game/TileResolverFactory.ts`
2. Refactor `createSnapshotTileResolver` (WebGL) and RenderContext resolution (Canvas2D)
3. Create common `IWorldState` interface

### Current Duplication

**WebGLMapPage** (lines 245-413):
```typescript
const createSnapshotTileResolver = useCallback((snapshot: WorldSnapshot): TileResolverFn => {
  // 170 lines of tile resolution logic
});
```

**MapRenderer** (via RenderContext):
```typescript
// Similar logic scattered across hooks
```

### New Pattern

```typescript
// Both renderers use:
const resolver = TileResolverFactory.create(worldState);
pipeline.setTileResolver(resolver);
player.setTileResolver(TileResolverFactory.createPlayerResolver(worldState));
```

### Files Changed
- New: `src/game/TileResolverFactory.ts` (+200 lines)
- `WebGLMapPage.tsx` (-170 lines)
- Update hooks that do tile resolution

---

## Phase 4: Extract Game Loop Hook (Medium Risk)

**Goal**: Unified game loop for both renderers

### Tasks
1. Create `src/hooks/useUnifiedGameLoop.ts`
2. Merge WebGLMapPage's inline loop with MapRenderer's `useRunUpdate`
3. Handle both RAF-based (WebGL) and GameLoop-based (Canvas2D) timing

### Current State

**WebGLMapPage** (lines 1183-1700):
```typescript
const renderLoop = () => {
  // 500+ lines inline
  rafRef.current = requestAnimationFrame(renderLoop);
};
```

**MapRenderer**:
```typescript
const { createRunUpdate } = useRunUpdate({ refs, ... });
// Uses GameLoop class
```

### New Hook

```typescript
function useUnifiedGameLoop(config: {
  pipeline: IRenderPipeline;
  player: PlayerController;
  worldState: IWorldState;
  onFrame?: (dt: number) => void;
}) {
  // Unified timing (GBA frame accurate)
  // Handles both WebGL and Canvas2D pipelines
}
```

### Files Changed
- New: `src/hooks/useUnifiedGameLoop.ts` (+300 lines)
- `WebGLMapPage.tsx` (-500 lines)
- `useRunUpdate.ts` (refactor to use unified loop)

---

## Phase 5: Unify Warp System (High Risk)

**Goal**: Single warp implementation for both renderers

### Tasks
1. Create `src/game/WarpExecutor.ts`
2. Merge `performWarp` (WebGL) with `useWarpExecution` (Canvas2D)
3. Handle different world providers (WorldManager vs MapManager)

### Current Duplication

**WebGLMapPage** `performWarp` (lines 707-891):
- Reinitializes WorldManager
- Updates tile resolvers
- Handles door sequences
- Manages fade transitions

**MapRenderer** `useWarpExecution`:
- Similar but uses MapManager
- Different initialization pattern

### New Pattern

```typescript
const warpExecutor = new WarpExecutor({
  worldProvider,  // WorldManager or MapManager
  player,
  pipeline,
  doorSequencer,
  fadeController,
});

// Both renderers call:
await warpExecutor.execute(trigger, { fromDoor: true });
```

### Files Changed
- New: `src/game/WarpExecutor.ts` (+250 lines)
- `WebGLMapPage.tsx` (-190 lines)
- `useWarpExecution.ts` (refactor to use WarpExecutor)

---

## Phase 6: Create GameContainer Component (High Risk)

**Goal**: Unified game container that works with both renderers

### Tasks
1. Create `src/components/game/GameContainer.tsx`
2. Abstracts pipeline creation (WebGL vs Canvas2D)
3. Provides consistent API for map pages

### New Component

```tsx
<GameContainer
  mapId={selectedMapId}
  renderer="webgl"  // or "canvas2d"
  viewport={VIEWPORT_CONFIG}
  onMapChange={handleMapChange}
>
  {({ player, worldState, debugInfo }) => (
    <>
      <DebugPanels info={debugInfo} />
    </>
  )}
</GameContainer>
```

### Files Changed
- New: `src/components/game/GameContainer.tsx` (+400 lines)
- `WebGLMapPage.tsx` refactored to use GameContainer (-1000 lines)
- `MapRenderer.tsx` refactored to use GameContainer

---

## Phase 7: Final Cleanup

### Tasks
1. Remove `StitchedWorldData` type (replace with `IWorldState`)
2. Consolidate viewport configs
3. Update all imports
4. Add integration tests

### Expected Final State

| File | Before | After |
|------|--------|-------|
| `WebGLMapPage.tsx` | 2154 | ~400 |
| `MapRenderer.tsx` | 466 | ~200 |
| Shared code | ~0 | ~1500 |

---

## Risk Mitigation

### Testing Strategy
1. **Phase 1-2**: Low risk, test manually
2. **Phase 3-4**: Write unit tests for TileResolverFactory and game loop
3. **Phase 5-6**: Integration tests for warp system
4. **Phase 7**: Full regression testing

### Rollback Plan
- Each phase is a separate PR
- Feature flag for new GameContainer: `USE_UNIFIED_GAME_CONTAINER`
- Old code preserved until new code is stable

### Performance Monitoring
- Track FPS before/after each phase
- Ensure WebGL path maintains 60 FPS
- Memory profiling for leak detection
