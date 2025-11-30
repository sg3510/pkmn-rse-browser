# Detailed Refactoring Checklist

This document provides bite-sized, testable steps for refactoring WebGLMapPage.tsx.
Each checkbox represents a single change that can be tested independently.

> **Testing Protocol**: After each checkbox, verify:
> - Game loads without errors
> - Player can move
> - No console errors
> - FPS stable at ~60

---

## Phase 1: Extract Debug Panel Components

**Risk Level**: Very Low
**Estimated Impact**: -150 lines from WebGLMapPage.tsx
**Dependencies**: None

### 1.1 Create Debug Components Directory

- [x] Create `src/components/debug/` directory *(already existed)*
- [x] Create `src/components/debug/index.ts` with empty exports *(already existed with full exports)*
- [x] Verify build still works

### 1.2-1.4 Merge WebGL Debug into Existing DebugPanel

> **Note**: Instead of creating separate components, WebGL debug info was merged into
> the existing `DebugPanel` as a new "WebGL" tab. This avoids duplication and provides
> a unified debug experience.

- [x] Add WebGL-specific types to `src/components/debug/types.ts`:
  - `LoadedMapDebugInfo`, `ConnectionDebugInfo`, `TilesetBoundaryDebugInfo`
  - `MapStitchingDebugInfo`, `WarpDebugInfo`, `WebGLDebugState`
- [x] Add `webglState?: WebGLDebugState` prop to DebugPanel
- [x] Add "WebGL" tab to DebugPanel (conditionally shown when webglState provided)
- [x] Create `WebGLTab` component with:
  - GPU Tileset Slots (Slot 0, Slot 1)
  - World State (current map, anchor, player pos)
  - Resolver State (version, bounds, last warp)
  - Loaded Maps list with GPU status
  - Connections with ✓/✗ status
  - Tileset Boundaries
- [x] Export new types from index.ts
- [x] **TEST**: WebGL tab shows GPU slots correctly
- [x] **TEST**: WebGL tab shows loaded maps and connections
- [x] **TEST**: WebGL tab updates after warping

### 1.5 Integrate DebugPanel into WebGLMapPage

- [x] Import DebugPanel and types in WebGLMapPage
- [x] Add `debugOptions` state
- [x] Create `webglDebugState` from existing `mapDebugInfo` and `warpDebugInfo`
- [x] Create minimal `debugState` for player info
- [x] Add `<DebugPanel>` component to JSX
- [x] Remove old inline debug JSX (~80 lines)
- [x] Remove unused `debugTile` state and gathering code
- [x] Remove unused `DebugTileInfo` local type
- [x] Verify build still works
- [x] **TEST**: Press ` to toggle debug panel
- [x] **TEST**: WebGL tab displays all debug info
- [x] **TEST**: Walk around, verify info updates

**Phase 1 Complete Verification:**
- [x] WebGLMapPage.tsx reduced by ~83 lines (2154 → 2071)
- [x] All debug info displays in unified DebugPanel
- [x] No regression in game functionality

---

## Phase 2: Extract Camera Controller

**Risk Level**: Low
**Estimated Impact**: -40 lines from WebGLMapPage.tsx (actual: -7 lines, but logic is now reusable)
**Dependencies**: Phase 1 (recommended but not required)

### 2.1 Create CameraController Class

- [x] Create `src/game/CameraController.ts`
- [x] Define `CameraView` interface
- [x] Implement `setPosition(x, y)` method
- [x] Implement `getPosition()` method
- [x] Export class
- [x] Add `createWebGLCameraController()` factory with 3-tile border overscan
- [x] Add `createCanvas2DCameraController()` factory for future Canvas2D use
- [x] **TEST**: Import in a test file, verify instantiation works

### 2.2 Implement followTarget Method

- [x] Add `followTarget(target: CameraTarget)` method (accepts player-like objects)
- [x] Add `setBounds(bounds: WorldBounds)` for dynamic world bounds
- [x] Implement clamping with configurable `borderOverscanTiles`
- [x] Support negative world coordinates (for stitched worlds)
- [x] **TEST**: Unit test with mock player at various positions
- [x] **TEST**: Verify clamping at world boundaries

### 2.3 Implement getView Method

- [x] Add `getView(extraTiles: number): CameraView` method
- [x] Calculate startTileX, startTileY from position
- [x] Calculate subTileOffsetX, subTileOffsetY
- [x] **TEST**: Unit test view calculation

### 2.4 Implement adjustOffset Method

- [x] Add `adjustOffset(dx, dy)` for world re-anchoring
- [x] **TEST**: Verify offset adjustment works correctly

### 2.5 Integrate into WebGLMapPage

- [x] Replace `cameraRef = useRef<CameraState>` with `useRef<CameraController | null>`
- [x] Initialize CameraController with `createWebGLCameraController()` on map load
- [x] Replace camera position updates with `camera.followTarget(player)`
- [x] Replace view calculation with `camera.getView(1)`
- [x] Update `setCameraDisplay()` to use `camera.getPosition()`
- [x] **TEST**: Camera follows player correctly
- [x] **TEST**: Camera clamps at world edges
- [x] **TEST**: Smooth movement, no jitter

### 2.6 Update Reanchor Handler

- [x] Use `camera.adjustOffset()` in reanchored event handler
- [x] **TEST**: Walk far from anchor, verify re-anchoring works
- [x] **TEST**: Camera position adjusts correctly after reanchor

**Phase 2 Complete Verification:**
- [x] CameraController fully integrated
- [x] Build passes
- [x] No camera-related bugs
- [x] Code is cleaner and testable (camera logic now in reusable class)

> **Note on MapRenderer**: Canvas2D uses `computeCameraView()` from `src/utils/camera.ts` which is
> simpler (no negative coords, no overscan, stateless). Keeping separate for now since Canvas2D
> doesn't need the extra complexity. Can unify in Phase 9 (GameContainer) if needed.

---

## Phase 3: Create Shared Type Definitions

**Risk Level**: Low
**Estimated Impact**: Better type safety, foundation for later phases
**Dependencies**: None

### 3.1 Define IWorldState Interface

- [x] Create `src/game/types/IWorldState.ts`
- [x] Define `ILoadedMapInstance` base interface with:
  - `entry: MapIndexEntry`, `mapData: MapData`
  - `offsetX`, `offsetY` (world tile offsets, can be negative)
  - `borderMetatiles`, `warpEvents`
- [x] Define `WorldBounds` type with minX/minY/maxX/maxY/width/height
- [x] Define `IWorldState` interface with:
  - `maps: ILoadedMapInstance[]`
  - `anchorMapId: string`
  - `worldBounds: WorldBounds`
- [x] Define WebGL extensions: `IWebGLMapInstance`, `IWebGLWorldState` (pairIdToGpuSlot, etc.)
- [x] Define Canvas2D extensions: `ICanvas2DMapInstance` (embedded tilesets, objectEvents)
- [x] Create `src/game/types/index.ts` with exports
- [x] Create `src/game/types/typecheck.ts` - compile-time type compatibility assertions
  - Verifies ILoadedMapInstance matches WorldManager's LoadedMapInstance
  - Verifies IWebGLWorldState matches WorldManager's WorldSnapshot
  - Build fails if interfaces drift from actual implementation
- [x] **TEST**: Types compile without errors

### 3.2 Define IWorldProvider Interface

- [x] Add `IWorldProvider` interface to same file:
  - `initialize(mapId: string): Promise<IWorldState>`
  - `update(tileX, tileY, direction?): void`
  - `getSnapshot(): IWorldState`
  - `getAnchorMapId(): string`
  - `dispose(): void`
- [x] Add `IWebGLWorldProvider` extension (subscribe, getDebugInfo)
- [x] **TEST**: Interface compiles

### 3.3 Extend WorldManager to Implement IWorldProvider

- [ ] Add `implements IWorldProvider` to WorldManager class (if compatible)
- [ ] Or create adapter: `WorldManagerAdapter implements IWorldProvider`
- [ ] **TEST**: WorldManager still works as before
- [ ] **TEST**: Type checking passes

> **Note**: 3.3 deferred to Phase 9 (GameContainer) when we unify providers

### 3.4 Document Differences: WorldManager vs MapManager

- [x] Create `src/game/types/README.md` documenting:
  - WorldManager: Dynamic loading, GPU tileset scheduling, epoch tracking, reanchoring
  - MapManager: Static loading, embedded tilesets, simpler bounds
  - Comparison table: file locations, map loading, tileset handling, GPU constraints, etc.
  - Interface hierarchy diagram
  - Future unification plan (GameContainer with IWorldProvider)
- [x] Note: MapManager may need wrapper to conform to IWorldProvider

**Phase 3 Complete Verification:**
- [x] Shared types defined and documented
- [x] No breaking changes to existing code
- [x] Build passes
- [x] Foundation ready for TileResolverFactory

---

## Phase 4: Extract TileResolverFactory

**Risk Level**: Medium
**Estimated Impact**: -170 lines from WebGLMapPage.tsx (actual: -187 lines)
**Dependencies**: Phase 3

### 4.1 Create TileResolverFactory File

- [x] Create `src/game/TileResolverFactory.ts`
- [x] Import necessary types (ResolvedTile, TileResolverFn, etc.)
- [x] Create class with static methods
- [x] **TEST**: File compiles

### 4.2 Extract Snapshot-Based Tile Resolution

- [x] Move `createSnapshotTileResolver` logic to `TileResolverFactory.fromSnapshot(snapshot, resolverId?, logger?)`
- [x] Keep WebGL-specific logic (GPU slot mapping, multi-tileset)
- [x] Support optional debug logging via logger parameter
- [x] **TEST**: Create resolver from snapshot, verify tile lookup works

### 4.3 Handle In-Bounds Tile Resolution

- [x] Map lookup logic preserved (iterate maps, check bounds)
- [x] Metatile resolution (primary vs secondary with SECONDARY_TILE_OFFSET)
- [x] GPU slot index calculation via pairIdToGpuSlot
- [x] **TEST**: Resolve tile at known position, verify metatileId

### 4.4 Handle Out-of-Bounds (Border) Tile Resolution

- [x] Nearest-map-with-GPU-tileset logic preserved
- [x] Border metatile selection (2x2 repeating pattern)
- [x] Fallback to anchor map borders
- [x] **TEST**: Resolve tile outside all maps, verify border tile returned

### 4.5 Extract Player Tile Resolver

- [x] Move to `TileResolverFactory.createPlayerResolver(snapshot)`
- [x] Returns `PlayerTileResult` with mapTile and attributes
- [x] **TEST**: Player resolver returns correct attributes

### 4.6 Integrate into WebGLMapPage

- [x] Replace inline `createSnapshotTileResolver` with `TileResolverFactory.fromSnapshot`
- [x] Replace inline `createSnapshotPlayerTileResolver` with `TileResolverFactory.createPlayerResolver`
- [x] Remove old functions from WebGLMapPage (~187 lines removed)
- [x] Keep debug logging (resolverId) in wrapper
- [x] **TEST**: Player can walk around
- [x] **TEST**: Tile collision works
- [x] **TEST**: Border tiles render correctly
- [x] **TEST**: Multi-tileset areas render correctly

### 4.7 Add RenderContext-Based Resolver (for MapRenderer)

- [x] Add `TileResolverFactory.fromRenderContext(ctx: RenderContext)`
- [x] Uses existing `resolveTileAt` utility from `components/map/utils.ts`
- [x] **TEST**: Can create resolver from RenderContext
- [x] Note: This enables MapRenderer to use same factory later

**Phase 4 Complete Verification:**
- [x] All tile resolution goes through TileResolverFactory
- [x] WebGLMapPage reduced by 187 lines (2068 → 1881)
- [x] Build passes
- [x] No tile rendering regressions
- [x] Border tiles work correctly
- [x] Tileset boundaries work correctly

---

## Phase 5: Extract Tileset Upload Helpers ✓

**Risk Level**: Medium
**Estimated Impact**: -50 lines, cleaner GPU management → **Actual: -68 lines (1834 → 1766)**
**Dependencies**: Phase 4

### 5.1 Create TilesetUploader ✓

- [x] Create `src/rendering/webgl/TilesetUploader.ts`
- [x] Define upload methods that work with WebGLRenderPipeline
- [x] **TEST**: File compiles

### 5.2 Extract uploadTilesetsFromSnapshot ✓

- [x] Move `uploadTilesetsFromSnapshot` from WebGLMapPage (was lines 292-337)
- [x] Made it a standalone function: `uploadTilesetsFromSnapshot(pipeline, snapshot)`
- [x] Keep GPU slot logic (slot 0 vs slot 1)
- [x] **TEST**: Tilesets upload correctly on map load

### 5.3 Extract combineTilesetPalettes ✓

- [x] Move `combineTilesetPalettes` from WebGLMapPage (was lines 125-141)
- [x] Moved to `src/rendering/webgl/TilesetUploader.ts`
- [x] Constants `NUM_PALS_IN_PRIMARY` and `NUM_PALS_TOTAL` moved to module
- [x] **TEST**: Palettes combine correctly

### 5.4 Integrate into WebGLMapPage ✓

- [x] Replace inline upload callback with imported function
- [x] Import `uploadTilesetsFromSnapshot` and `combineTilesetPalettes` from TilesetUploader
- [x] Removed inline `combineTilesetPalettes` function
- [x] Removed inline `uploadTilesetsFromSnapshot` callback
- [x] Removed unused `NUM_PALS_*` constants
- [x] **TEST**: Initial map load works
- [x] **TEST**: Tileset change events work
- [x] **TEST**: GPU slot swap events work

**Phase 5 Complete Verification:**
- [x] Tileset upload logic centralized in TilesetUploader.ts
- [x] Build passes
- [x] No visual regressions
- [x] GPU slots assigned correctly

---

## Phase 6: Extract WarpExecutor (Shared Warp Logic)

**Risk Level**: Medium
**Estimated Impact**: -60 lines from WebGLMapPage.tsx, -60 lines from useWarpExecution.ts
**Dependencies**: Phases 3, 4

> **Design Principle**: Only unify logic that is EXACTLY the same between WebGL and Canvas2D.
> Renderer-specific code (GPU uploads, WorldManager vs MapManager) stays in each implementation.
> The executor takes callbacks for world initialization, keeping it renderer-agnostic.

### Current State Analysis

| File | Role | Warp Lines |
|------|------|------------|
| `WarpHandler.ts` | State only (cooldown, inProgress, lastTile) | 244 (keep as-is) |
| `useWarpExecution.ts` | Canvas2D warp execution | ~180 |
| `WebGLMapPage.tsx` | WebGL warp execution | ~190 |

**Duplicated Logic (UNIFY):**
- Spawn position calculation (~15 lines each)
- Facing direction determination (~20 lines each)
- Door exit sequence decision (~30 lines each)
- Warp completion (cooldown, lastTile update)

**Renderer-Specific (DO NOT UNIFY):**
- WebGL: `worldManager.initialize()`, tileset upload, GPU slots, snapshot resolvers
- Canvas2D: `mapManager.buildWorld()`, `rebuildContextForWorld()`, generation tracking

### 6.1 Create WarpExecutor Utility Module

- [x] Create `src/game/WarpExecutor.ts` (347 lines)
- [x] Define types:
  - `WarpDestinationMap` - minimal map info needed
  - `TileBehaviorResolver` - function to resolve tile behavior
  - `WarpDestination` - map + resolver
  - `WarpExecutorDeps` - player, doorSequencer, fadeController, warpHandler, etc.
  - `WarpOptions` - force, fromDoor, defaultNonDoorFacing
- [x] **TEST**: Types compile

### 6.2 Extract Spawn Position Logic

- [x] Create `calculateSpawnPosition(destMap, destWarpId): SpawnPosition`
- [x] Logic: find warp by ID, calc world coords, fallback to first warp, fallback to map center
- [x] This is IDENTICAL in both implementations
- [x] **TEST**: Spawn position calculated correctly ✓

### 6.3 Extract Facing Direction Logic

- [x] Create `determineFacing(trigger, destBehavior, options): CardinalDirection`
- [x] Logic handles all cases:
  - Door + fromDoor + destIsDoor → 'down'
  - Door + fromDoor + destIsArrow → preserve trigger.facing
  - Door + fromDoor + other → `defaultNonDoorFacing` option
  - Arrow → preserve trigger.facing
  - Default door → 'down'
- [x] Handle 'up' vs 'down' difference with `defaultNonDoorFacing` config option
- [x] **TEST**: Facing correct for door exits, arrow warps, stairs ✓

### 6.4 Extract Door Exit Sequence Logic

- [x] Create `handleDoorExitSequence(deps, spawnPos, destBehavior, destMetatileId, trigger, options)`
- [x] Logic:
  - Check `requiresDoorExitSequence(destBehavior)`
  - If yes: hide player, start doorSequencer.startExit(), start fadeIn
  - If no: show player, start fadeIn, unlock input, reset sequencer
- [x] This is IDENTICAL in both implementations (just different refs)
- [x] **TEST**: Door exit sequence starts correctly ✓
- [x] **TEST**: Non-door destinations skip sequence ✓

### 6.5 Create Main Execute Method

- [x] Create `executeWarp(deps, trigger, destination, options): void`
- [x] Orchestrates the shared logic:
  1. `calculateSpawnPosition()`
  2. Resolve destination tile behavior
  3. `determineFacing()`
  4. `player.setPositionAndDirection()`
  5. `handleDoorExitSequence()` (if fromDoor) or simple fadeIn
  6. `warpHandler.completeWarp()` / `setCooldown()`
  7. `onClearDoorAnimations()` callback
- [x] Does NOT handle world initialization (caller does that)
- [x] **TEST**: Full shared flow works ✓

### 6.6 Integrate into WebGLMapPage

- [x] Import WarpExecutor utilities
- [x] Refactor `performWarp` to use `executeWarp()` for shared logic
- [x] Keep WebGL-specific code: world init, tileset upload, resolver setup
- [x] Remove duplicated spawn/facing/door logic (~52 lines)
- [x] Build passes
- [x] **TEST**: All warp types work in WebGL ✓

### 6.7 Integrate into useWarpExecution (Optional - Future)

- [ ] Can be done later when unifying MapRenderer
- [ ] Same pattern: keep Canvas2D-specific world setup, use shared warp logic
- [ ] **TEST**: All warp types work in Canvas2D

### 6.8 Manual Testing

- [x] **TEST**: Walk into house (animated door) ✓
- [x] **TEST**: Walk out of house (door exit sequence) ✓
- [x] **TEST**: Use stairs (non-animated door) ✓
- [x] **TEST**: Arrow warp (cave entrance) ✓
- [x] **TEST**: Walk-over warp (map edge) ✓
- [x] **TEST**: Warp to map with different tileset ✓
- [x] **TEST**: Rapid warp attempts (cooldown works) ✓

**Phase 6 Complete Verification:**
- [x] Shared warp logic extracted to WarpExecutor.ts (347 lines)
- [x] WebGLMapPage uses shared utilities
- [x] No GPU/tileset code in WarpExecutor (renderer-agnostic)
- [x] Build passes
- [x] WebGLMapPage reduced by 52 lines (1886 → 1834)
- [x] All warp types work correctly ✓
- [x] Door animations play at right times ✓

---

## Phase 7: Unify Reflection Logic (GBA-Faithful)

**Risk Level**: Medium
**Estimated Impact**: -100 lines from WebGLMapPage.tsx, GBA-accurate reflections
**Dependencies**: Phase 4
**Reference**: `doc/reflect/reflection-plan.md`, GBA C code analysis below

### GBA C Code Reference (Source of Truth)

**Files:**
- `field_effect_helpers.c`: `UpdateObjectReflectionSprite`, `LoadObjectReflectionPalette`, `GetReflectionVerticalOffset`
- `event_object_movement.c`: `ObjectEventGetNearbyReflectionType`, `GetGroundEffectFlags_Reflection`
- `metatile_behavior.c`: `MetatileBehavior_GetBridgeType`, `MetatileBehavior_IsReflective`, `MetatileBehavior_IsIce`

**Key GBA Logic:**

1. **Bridge Types** (`metatile_behavior.h`):
   - `BRIDGE_TYPE_OCEAN` (0) - Routes 110/119 log bridges
   - `BRIDGE_TYPE_POND_LOW` (1) - Unused
   - `BRIDGE_TYPE_POND_MED` (2) - Route 120 south
   - `BRIDGE_TYPE_POND_HIGH` (3) - Route 120 north

2. **Bridge Vertical Offsets** (`field_effect_helpers.c:78-82`):
   ```c
   bridgeReflectionVerticalOffsets[] = {
     [BRIDGE_TYPE_POND_LOW - 1] = 12,
     [BRIDGE_TYPE_POND_MED - 1] = 28,
     [BRIDGE_TYPE_POND_HIGH - 1] = 44
   };
   ```
   ✅ FIXED: Now using `{none: 0, ocean: 0, pondLow: 12, pondMed: 28, pondHigh: 44}`

3. **Reflection Y Position** (`field_effect_helpers.c:143`):
   ```c
   reflectionSprite->y = mainSprite->y + GetReflectionVerticalOffset(objectEvent) + reflectionSprite->sReflectionVerticalOffset;
   // GetReflectionVerticalOffset = height - 2
   // sReflectionVerticalOffset = bridge offset (0, 12, 28, or 44)
   ```

4. **Bridge Type Detection** (`field_effect_helpers.c:84-86`):
   ```c
   // Check BOTH previous AND current metatile behavior
   if ((bridgeType = MetatileBehavior_GetBridgeType(objectEvent->previousMetatileBehavior))
    || (bridgeType = MetatileBehavior_GetBridgeType(objectEvent->currentMetatileBehavior)))
   ```
   We currently only check current position.

5. **Bridge Palette** (`field_effect_helpers.c:112-122`):
   - Non-bridge: Regular reflection palette (water tint)
   - On pond bridge: Solid blue palette `RGB(74, 115, 172)` from `bridge_reflection.pal`
   - This is a SOLID color (all 16 palette entries identical) - reflection becomes silhouette
   - Purpose: Blend with dark water under high Route 120 bridges
   - ✅ IMPLEMENTED: Using `rgb(74, 115, 172)` in `BRIDGE_REFLECTION_TINT`

6. **Reflection Detection** (`event_object_movement.c:7625-7652`):
   - Footprint math: `width = (spriteWidth + 8) >> 4`, `height = (spriteHeight + 8) >> 4`
   - Scans from y+1 downward for `height` rows
   - Checks BOTH `currentCoords` AND `previousCoords` (we only check current)
   - Returns: `REFL_TYPE_ICE` if ice, `REFL_TYPE_WATER` if reflective, else `REFL_TYPE_NONE`

### 7.1 Fix Bridge Offsets (CRITICAL BUG FIX) ✅ DONE

- [x] Update `BRIDGE_OFFSETS` in `ReflectionRenderer.ts`:
  ```typescript
  export const BRIDGE_OFFSETS: Record<BridgeType, number> = {
    none: 0,      // No bridge
    ocean: 0,     // Ocean bridges (Routes 110/119) - NO extra offset
    pondLow: 12,  // Low pond bridge (unused in game)
    pondMed: 28,  // Medium pond bridge (Route 120 south)
    pondHigh: 44, // High pond bridge (Route 120 north)
  };
  ```
- [x] Add `ocean` to `BridgeType` in `metatileBehaviors.ts`
- [x] Update `getBridgeTypeFromBehavior()` to handle `MB_BRIDGE_OVER_OCEAN`
- [x] Add `isPondBridge()` helper to check if bridge needs dark tint (excludes ocean)
- [x] **TEST**: Route 120 bridges show reflection ~28-44px below player

### 7.2 Fix Bridge Type Detection

- [ ] Update bridge detection to check BOTH current AND previous tile behavior
- [ ] Match GBA logic: `bridgeType = getBridgeType(prev) || getBridgeType(current)`
- [ ] Add `previousMetatileBehavior` tracking to PlayerController or reflection state
- [ ] **TEST**: Reflection persists one frame when stepping off bridge

### 7.3 Unify Constants (Deduplicate) ✅ DONE

~~Current drift between `ReflectionRenderer.ts` and `WebGLMapPage.tsx`:~~

| Constant | ReflectionRenderer.ts | WebGLMapPage.tsx | Status |
|----------|----------------------|------------------|--------|
| Water tint | `rgba(70, 120, 200, 0.35)` | Uses `getReflectionTint()` | ✅ Unified |
| Ice tint | `rgba(180, 220, 255, 0.35)` | Uses `getReflectionTint()` | ✅ Unified |
| Bridge offsets | `{0, 0, 12, 28, 44}` | Uses imported `BRIDGE_OFFSETS` | ✅ Unified |
| Bridge tint | `rgb(74, 115, 172)` (GBA solid) | Uses `getReflectionTint()` | ✅ GBA-accurate |

- [x] Pick canonical tint values (using ReflectionRenderer.ts)
- [x] Import constants in WebGLMapPage.tsx instead of hardcoding
- [x] Use `getReflectionTint()` and `getReflectionAlpha()` helpers
- [x] Use `BRIDGE_REFLECTION_TINT` for pond bridges only (ocean uses normal water tint per GBA)
- [x] Also update ObjectRenderer.ts to use shared `BRIDGE_OFFSETS`
- [x] **TEST**: Colors match between renderers

### 7.4 Extract computeReflectionStateFromSnapshot

- [ ] Move from WebGLMapPage.tsx (currently ~50 lines at lines 356-407)
- [ ] Create `ReflectionStateComputer.ts` or add to `ReflectionRenderer.ts`
- [ ] Interface:
  ```typescript
  function computeReflectionState(
    resolveTile: (x: number, y: number) => ReflectionMeta | null,
    tileX: number,
    tileY: number,
    spriteWidth: number,
    spriteHeight: number,
    previousBehavior?: number  // For bridge persistence
  ): ReflectionState
  ```
- [ ] Make renderer-agnostic (works with callback, not WorldSnapshot)
- [ ] **TEST**: Reflection state matches for WebGL and Canvas2D

### 7.5 Fix Reflection Detection Window

GBA scans BOTH current AND previous coords for reflection type:
```c
RETURN_REFLECTION_TYPE_AT(objEvent->currentCoords.x, objEvent->currentCoords.y + 1 + i)
RETURN_REFLECTION_TYPE_AT(objEvent->previousCoords.x, objEvent->previousCoords.y + 1 + i)
```

- [ ] Track previous tile position in PlayerController or reflection state
- [ ] Check both positions in `computeReflectionState()`
- [ ] This causes reflection to "linger" one frame when stepping off water
- [ ] **TEST**: Reflection visible for one frame after stepping off water (optional, low priority)

### 7.6 Extract renderPlayerReflection

- [ ] Move from WebGLMapPage.tsx (currently ~130 lines at lines 638-767)
- [ ] Create shared `renderReflection()` function or class method
- [ ] Parameters:
  ```typescript
  function renderReflection(
    ctx: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    spriteFrame: { sx, sy, sw, sh, flip },
    worldX: number,
    worldY: number,
    spriteHeight: number,
    reflectionState: ReflectionState,
    reflectiveMask?: HTMLCanvasElement  // Optional for masked rendering
  ): void
  ```
- [ ] Use unified constants for tint/alpha/offset
- [ ] **TEST**: Reflection renders identically

### 7.7 Integrate into WebGLMapPage ✅ PARTIALLY DONE

**Constants unified, extraction pending:**
- [x] Import from `ReflectionRenderer.ts` (`BRIDGE_OFFSETS`, `getReflectionTint`, `getReflectionAlpha`)
- [x] Remove hardcoded constants (uses imports)
- [x] WebGLMapPage line 42-44: imports shared constants
- [x] WebGLMapPage line 652, 735, 745: uses shared functions
- [ ] Replace inline `computeReflectionStateFromSnapshot` with shared function (pending 7.4)
- [ ] Replace inline `renderPlayerReflection` with shared function (pending 7.6)
- [x] **TEST**: Walk near water → reflection visible
- [x] **TEST**: Walk on Route 120 bridges → reflection much lower
- [x] **TEST**: Ice tiles → ice-tinted reflection
- [x] **TEST**: No false reflections on land

### 7.8 Prepare Canvas2D Parity (Optional)

- [ ] Ensure `computeReflectionState()` in `map/utils.ts` uses same logic
- [ ] Use shared constants from `ReflectionRenderer.ts`
- [ ] **TEST**: Reflections match between renderers

**Phase 7 Complete Verification:**
- [x] Bridge offsets match GBA: {0, 0, 12, 28, 44} including ocean ✓
- [x] Constants deduplicated between files ✓
- [x] Bridge tint applied when on pond bridges (`rgb(74, 115, 172)` solid silhouette) ✓
- [x] Ocean bridges use normal water tint (no dark palette) per GBA ✓
- [x] Reflection Y position correct on Route 120 bridges ✓
- [x] No visual artifacts ✓
- [x] Build passes ✓
- [ ] ~180 lines removed from WebGLMapPage.tsx (pending: 7.4 ~50 lines, 7.6 ~130 lines)

**Current Status:** Phase 7 is ~60% complete. Constants unified, but inline code not yet extracted.

---

## Phase 8: Create Unified Game Loop Hook

**Risk Level**: High
**Estimated Impact**: -500 lines from WebGLMapPage.tsx
**Dependencies**: Phases 2, 4, 5, 6, 7

### 8.1 Analyze Current Game Loop

- [ ] Document all operations in WebGLMapPage renderLoop (lines 1183-1700)
- [ ] Categorize: timing, player update, world update, warp detection, rendering
- [ ] Identify WebGL-specific vs renderer-agnostic logic

### 8.2 Create useUnifiedGameLoop Hook

- [ ] Create `src/hooks/useUnifiedGameLoop.ts`
- [ ] Define config interface with all dependencies
- [ ] **TEST**: Hook compiles

### 8.3 Extract Timing Logic

- [ ] Move GBA frame timing (lines 1199-1207)
- [ ] `gbaAccumRef`, `gbaFrameRef`, `GBA_FRAME_MS`
- [ ] **TEST**: Frame timing accurate (~59.73 Hz)

### 8.4 Extract Player Update Logic

- [ ] Move player update (lines 1219-1221)
- [ ] Move world manager update (lines 1224-1234)
- [ ] **TEST**: Player movement works

### 8.5 Extract Warp Detection Logic

- [ ] Move warp detection (lines 1254-1300)
- [ ] Move arrow overlay update (lines 1236-1251)
- [ ] Move door sequence handling (lines 1302-1430)
- [ ] **TEST**: Walk-over warps detected
- [ ] **TEST**: Door warps work
- [ ] **TEST**: Arrow warps work

### 8.6 Extract Scene Rendering Logic

- [ ] Move camera update
- [ ] Move pipeline.render() call
- [ ] Move compositing calls (background, topBelow, sprites, topAbove)
- [ ] **TEST**: Scene renders correctly

### 8.7 Extract Sprite Rendering Logic

- [ ] Move player reflection rendering
- [ ] Move field effect rendering (grass, sand)
- [ ] Move player sprite rendering
- [ ] Move arrow overlay rendering
- [ ] **TEST**: All sprites render in correct order

### 8.8 Extract Fade Rendering

- [ ] Move fade overlay rendering
- [ ] **TEST**: Fade transitions work

### 8.9 Extract Stats/Debug Updates

- [ ] Move FPS calculation
- [ ] Move debug info updates
- [ ] Move tile debug updates
- [ ] **TEST**: Stats display correctly

### 8.10 Integrate into WebGLMapPage

- [ ] Replace inline renderLoop with useUnifiedGameLoop
- [ ] Pass all dependencies to hook
- [ ] **TEST**: Full game loop works
- [ ] **TEST**: 60 FPS maintained
- [ ] **TEST**: No memory leaks (check with DevTools)

**Phase 8 Complete Verification:**
- [ ] Game loop extracted to hook
- [ ] WebGLMapPage significantly smaller
- [ ] All game functionality works
- [ ] Performance unchanged

---

## Phase 9: Create GameContainer Component

**Risk Level**: High
**Estimated Impact**: Final unification
**Dependencies**: All previous phases

### 9.1 Design GameContainer API

- [ ] Define props interface:
  - `mapId: string`
  - `renderer: 'webgl' | 'canvas2d'`
  - `viewport?: ViewportConfig`
  - `children?: (state) => ReactNode`
- [ ] Document expected behavior

### 9.2 Create GameContainer Shell

- [ ] Create `src/components/game/GameContainer.tsx`
- [ ] Set up canvas refs
- [ ] Set up basic state (loading, error)
- [ ] **TEST**: Component renders empty canvas

### 9.3 Implement Pipeline Selection

- [ ] Create pipeline based on `renderer` prop
- [ ] WebGL: Use WebGLRenderPipeline
- [ ] Canvas2D: Use existing Canvas2D pipeline
- [ ] Handle WebGL fallback if not supported
- [ ] **TEST**: Correct pipeline created for each type

### 9.4 Implement World Provider Selection

- [ ] WebGL: Use WorldManager (dynamic loading, GPU scheduling)
- [ ] Canvas2D: Use MapManager (or WorldManager in simple mode)
- [ ] **TEST**: World loads correctly for each renderer

### 9.5 Wire Up Game Loop

- [ ] Use useUnifiedGameLoop with correct pipeline
- [ ] Pass all dependencies
- [ ] **TEST**: Game runs in GameContainer

### 9.6 Expose State to Children

- [ ] Define `GameState` type with player, debug info, etc.
- [ ] Pass to children render prop
- [ ] **TEST**: Children receive correct state

### 9.7 Integrate into WebGLMapPage

- [ ] Replace most of WebGLMapPage with GameContainer
- [ ] Keep: Map selector, page layout
- [ ] Move: All game logic to GameContainer
- [ ] **TEST**: WebGLMapPage works with GameContainer

### 9.8 Integrate into MapRenderer

- [ ] Refactor MapRenderer to use GameContainer
- [ ] Keep: forwardRef handle, DebugPanel, DialogBox
- [ ] **TEST**: MapRenderer works with GameContainer

**Phase 9 Complete Verification:**
- [ ] Both renderers use GameContainer
- [ ] Switching renderer prop changes pipeline
- [ ] All features work in both modes
- [ ] Code significantly reduced

---

## Phase 10: Final Cleanup

**Risk Level**: Low
**Estimated Impact**: Code quality improvement

### 10.1 Remove Dead Code

- [ ] Remove unused imports from WebGLMapPage
- [ ] Remove unused types (StitchedWorldData if replaced)
- [ ] Remove unused refs
- [ ] **TEST**: Build succeeds with no warnings

### 10.2 Consolidate Types

- [ ] Move shared types to `src/game/types/`
- [ ] Remove duplicate type definitions
- [ ] **TEST**: Types compile correctly

### 10.3 Update Documentation

- [ ] Update component READMEs
- [ ] Document GameContainer API
- [ ] Document extension points

### 10.4 Performance Verification

- [ ] Profile WebGL path: maintain 60 FPS
- [ ] Profile Canvas2D path: acceptable performance
- [ ] Check memory usage over time
- [ ] **TEST**: No memory leaks after 10 minutes of play

### 10.5 Final Testing

- [ ] Test all maps load correctly
- [ ] Test all warp types
- [ ] Test all door types
- [ ] Test tileset boundaries
- [ ] Test world re-anchoring
- [ ] Test save/load (MapRenderer)

**Phase 10 Complete Verification:**
- [ ] Codebase clean and organized
- [ ] Documentation up to date
- [ ] No performance regressions
- [ ] All features working

---

## Summary: Line Count Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 (Debug Panel) | ✅ Done | Extracted to DebugPanel component |
| 2 (Camera) | ✅ Done | Created CameraController class |
| 3 (Types) | ✅ Done | Created IWorldState interfaces |
| 4 (TileResolver) | ✅ Done | Extracted to TileResolverFactory |
| 5 (Tileset Upload) | ✅ Done | Extracted to TilesetUploader |
| 6 (Warp Executor) | ✅ Done | Extracted shared warp logic |
| 7 (Reflection) | 🔄 60% | Constants unified, extraction pending |
| 8 (Game Loop) | ⬜ Pending | ~500 lines to extract |
| 9 (GameContainer) | ⬜ Pending | ~500 lines to extract |
| 10 (Cleanup) | ⬜ Pending | Final cleanup |

**Current State:**
- WebGLMapPage.tsx: **1791 lines**
- Started at: 2154 lines
- Net reduction: 363 lines (17%)
- Note: Some features added (shimmer, debug improvements) offset extraction gains

**Remaining Extraction Targets (Phase 7):**
- `computeReflectionStateFromSnapshot`: ~50 lines (lines 356-407)
- `renderPlayerReflection`: ~130 lines (lines 638-767)

**Target**: ~400-600 lines after Phases 8-10

---

## Notes on WorldManager vs MapManager

### WorldManager (WebGL Path) - More Complex

Required features for WebGL:
- [ ] Dynamic map loading/unloading
- [ ] Tileset pair scheduling (max 2 in GPU)
- [ ] GPU slot management (slot 0, slot 1)
- [ ] Epoch tracking for async operation cancellation
- [ ] Tileset boundary detection for preloading
- [ ] Re-anchoring for infinite world support

### MapManager (Canvas2D Path) - Simpler

Can be simpler because:
- [ ] No GPU slot constraints
- [ ] Can keep more tilesets in memory
- [ ] Simpler tile resolution (no GPU slot lookup)
- [ ] Static connection loading is sufficient

### Bridging Strategy

For GameContainer to support both:
1. Create `IWorldProvider` interface (Phase 3)
2. WorldManager implements IWorldProvider (native)
3. MapManager gets thin adapter to IWorldProvider
4. GameContainer uses IWorldProvider, doesn't know which implementation

This allows:
- WebGL path to use full WorldManager capabilities
- Canvas2D path to use simpler MapManager
- Future: MapManager could be enhanced without breaking WebGL
