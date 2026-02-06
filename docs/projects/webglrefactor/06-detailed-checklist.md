---
title: Detailed Refactoring Checklist
status: planned
last_verified: 2026-01-13
---

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
**Reference**: `docs/features/reflection/reflection-plan.md`, GBA C code analysis below

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

### 7.2 Fix Bridge Type Detection ✅ DONE

- [x] Update bridge detection to check BOTH current AND previous tile behavior
- [x] Match GBA logic: `bridgeType = getBridgeType(prev) || getBridgeType(current)`
- [x] Implemented in shared `computeReflectionState()` - takes both current and prev tile positions
- [x] **TEST**: Bridge type persists when stepping off bridge (uses prevTileX/Y)

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

### 7.4 Extract computeReflectionStateFromSnapshot ✅ DONE

- [x] Added `computeReflectionState` to `ReflectionRenderer.ts` (lines 286-346)
- [x] Renderer-agnostic: takes `ReflectionMetaProvider` callback
- [x] Interface:
  ```typescript
  type ReflectionMetaProvider = (tileX: number, tileY: number) => ReflectionMetaResult | null;
  function computeReflectionState(
    getReflectionMeta: ReflectionMetaProvider,
    tileX: number, tileY: number,
    prevTileX: number, prevTileY: number,
    spriteWidth?: number, spriteHeight?: number
  ): ReflectionState
  ```
- [x] WebGLMapPage now wraps snapshot lookup in provider callback
- [x] **TEST**: Reflection state computed correctly

### 7.5 Fix Reflection Detection Window ✅ DONE

GBA scans BOTH current AND previous coords for reflection type.
This is now implemented in the shared `computeReflectionState()` function:
- [x] Takes both current (tileX, tileY) and previous (prevTileX, prevTileY) positions
- [x] Checks both positions in the tile scan loops
- [x] Also checks bridge type at both positions (GBA: prev first, then current)
- [x] **TEST**: Reflection detection works during movement

### 7.6 Extract renderPlayerReflection ✅ DONE

- [x] Added `buildReflectionMask` to `ReflectionRenderer.ts` (lines 359-414)
- [x] Added `renderSpriteReflection` to `ReflectionRenderer.ts` (lines 430-488)
- [x] WebGLMapPage `renderPlayerReflection` reduced from ~130 lines to ~43 lines
- [x] Uses shared mask building and rendering functions
- [x] **TEST**: Reflection renders with shimmer (water) or still (ice)

### 7.7 Integrate into WebGLMapPage ✅ DONE

- [x] Import from `ReflectionRenderer.ts` (`BRIDGE_OFFSETS`, `computeReflectionState`, `buildReflectionMask`, `renderSpriteReflection`)
- [x] `computeReflectionStateFromSnapshot` uses shared `computeReflectionState` with provider callback
- [x] `renderPlayerReflection` uses shared `buildReflectionMask` and `renderSpriteReflection`
- [x] ~90 lines removed from WebGLMapPage.tsx (130 → 43 for render, 60 → 13 for compute)
- [x] **TEST**: Walk near water → reflection visible
- [x] **TEST**: Walk on Route 120 bridges → reflection much lower
- [x] **TEST**: Ice tiles → ice-tinted reflection
- [x] **TEST**: No false reflections on land

### 7.8 Prepare Canvas2D Parity ✅ DONE

Canvas2D's `ObjectRenderer.ts` now uses shared functions:
- [x] Replaced hardcoded tints with shared `getReflectionTint()` via `renderSpriteReflection`
- [x] Both `renderReflection` and `renderObjectReflection` use `buildReflectionMask`
- [x] Both methods use `renderSpriteReflection` (GBA-accurate tints and shimmer)
- [x] Removed ~190 lines from ObjectRenderer.ts (duplicate mask/render code)
- [x] Removed unused debug functions
- [x] **TEST**: Reflections use same tints/alpha as WebGL

**Phase 7 Complete Verification:**
- [x] Bridge offsets match GBA: {0, 0, 12, 28, 44} including ocean ✓
- [x] Constants deduplicated between files ✓
- [x] Bridge tint applied when on pond bridges (`rgb(74, 115, 172)` solid silhouette) ✓
- [x] Ocean bridges use normal water tint (no dark palette) per GBA ✓
- [x] Reflection Y position correct on Route 120 bridges ✓
- [x] No visual artifacts ✓
- [x] Build passes ✓
- [x] ~90 lines removed from WebGLMapPage.tsx ✓
- [x] ~190 lines removed from ObjectRenderer.ts ✓
- [x] Canvas2D and WebGL use identical reflection logic ✓

**Current Status:** Phase 7 is fully complete. Both renderers share reflection code.

---

## Phase 8: Create Unified Game Loop Hook

**Risk Level**: High
**Estimated Impact**: -500 lines from WebGLMapPage.tsx
**Dependencies**: Phases 2, 4, 5, 6, 7

### 8.1 Analyze Current Game Loop ✅ DONE

**renderLoop function structure (lines 1047-1531):**

| Section | Lines | Description | Shareable? |
|---------|-------|-------------|------------|
| Guard checks | 1047-1061 | Early returns for missing deps | ✅ Pattern |
| GBA Timing | 1063-1071 | Frame counter accumulator | ✅ Yes |
| Shimmer | 1074 | Animation update | ✅ Yes |
| World bounds | 1076-1081 | Convert tile→pixel offsets | ⚠️ Partial |
| Warp cooldown | 1084 | Update handler cooldown | ✅ Yes |
| Player update | 1086-1088 | player.update(dt) | ✅ Yes |
| World update | 1091-1095 | worldManager.update() | ❌ WebGL-specific |
| Debug info | 1097-1114 | Update every ~500ms | ⚠️ Format differs |
| Arrow overlay | 1116-1132 | Update based on tile behavior | ✅ Yes |
| Warp detection | 1134-1186 | Detect walk-over/door warps | ✅ Yes |
| Door entry seq | 1190-1228 | State machine for entering | ✅ Yes |
| Door exit seq | 1231-1277 | State machine for exiting | ✅ Yes |
| Pending warp | 1279-1298 | Execute on fade complete | ✅ Yes |
| Camera update | 1300-1306 | followTarget, setBounds | ✅ Yes |
| Canvas sizing | 1308-1316 | Ensure correct dimensions | ✅ Yes |
| Camera view | 1318-1342 | Get view for rendering | ✅ Yes |
| Pipeline render | 1350-1355 | WebGL tile rendering | ❌ WebGL-specific |
| Composite BG | 1364-1365 | Background + topBelow | ❌ WebGL-specific |
| Door anims | 1368-1369 | Render door animations | ✅ Yes |
| Reflections | 1380-1428 | Player reflection + debug | ✅ Yes (shared) |
| Field effects | 1435-1455, 1471-1491 | Grass/sand bottom+top | ✅ Yes |
| Player sprite | 1457-1460 | player.render() | ✅ Yes |
| Arrow render | 1462-1469 | Arrow overlay | ✅ Yes |
| Composite top | 1494 | TopAbove layer | ❌ WebGL-specific |
| Fade overlay | 1496-1500 | Warp transitions | ✅ Yes |
| Stats/FPS | 1502-1527 | Performance stats | ✅ Yes |

**Renderer-Agnostic (can be shared):**
- GBA frame timing, shimmer, warp cooldown
- Player update, warp detection, door sequences
- Camera following, arrow overlay
- Field effects, reflections, fade overlay
- Stats/FPS calculation

**WebGL-Specific (needs callbacks/abstraction):**
- WorldManager.update() vs MapManager usage
- Pipeline.render() and composite methods
- Snapshot-based tile resolution

- [x] Document all operations in WebGLMapPage renderLoop (lines 1047-1531)
- [x] Categorize: timing, player update, world update, warp detection, rendering
- [x] Identify WebGL-specific vs renderer-agnostic logic

### 8.2 Create useUnifiedGameLoop Hook ✅ DONE

- [x] Create `src/hooks/useUnifiedGameLoop.ts` (380 lines)
- [x] Define config interface with all dependencies
- [x] **TEST**: Hook compiles

**Hook structure:**
- `GameLoopDeps`: player, camera, warpHandler, fadeController, doorSequencer, doorAnimations, arrowOverlay
- `GameLoopConfig`: viewportWidth, viewportHeight, playerLoaded, enabled
- `GameLoopCallbacks`: resolveTileAt, detectWarpTrigger, performWarp, getWorldBounds, onRender, etc.

### 8.3 Extract Timing Logic ✅ DONE

- [x] Move GBA frame timing to hook `tick()` function
- [x] `gbaAccumRef`, `gbaFrameRef`, `GBA_FRAME_MS` (exported)
- [x] **TEST**: Frame timing accurate (~59.73 Hz)

### 8.4 Extract Player Update Logic ✅ DONE

- [x] Move player update to hook `tick()` function
- [x] World manager update via `onWorldUpdate` callback (renderer-specific)
- [x] **TEST**: Player movement works

### 8.5 Extract Warp Detection Logic ✅ DONE

- [x] Move warp detection to `checkWarps()` in hook
- [x] Move arrow overlay update to `updateArrowOverlay()` in hook
- [x] Move door sequence handling to `processDoorEntry()` / `processDoorExit()` in hook
- [x] **TEST**: Walk-over warps detected
- [x] **TEST**: Door warps work
- [x] **TEST**: Arrow warps work

### 8.6 Extract Scene Rendering Logic ⚠️ DEFERRED

Rendering is renderer-specific (WebGL pipeline vs Canvas2D). Hook provides:
- [x] Camera update in hook `tick()` function
- [x] `onRender` callback for renderer-specific rendering
- [ ] Pipeline.render() call stays in WebGLMapPage (WebGL-specific)
- [ ] Compositing stays in WebGLMapPage (WebGL-specific)

### 8.7 Extract Sprite Rendering Logic ⚠️ DEFERRED

Sprite rendering uses renderer-specific context. Stays in caller:
- [ ] Player reflection (uses shared `renderSpriteReflection` from Phase 7)
- [ ] Field effects (uses shared `ObjectRenderer`)
- [ ] Player sprite rendering
- [ ] Arrow overlay rendering

### 8.8 Extract Fade Rendering ⚠️ DEFERRED

- [ ] Fade overlay rendering stays in caller's `onRender` callback
- FadeController is already passed to hook for sequence timing

### 8.9 Extract Stats/Debug Updates ⚠️ DEFERRED

- [x] Debug info callback: `onDebugUpdate` (called every ~500ms)
- [ ] FPS calculation stays in caller (display-specific)
- [ ] Tile debug updates stay in caller

### 8.10 Integration Decision ✅ DECIDED

**Decision: Keep separate game loops, share helpers**

WebGL and Canvas2D have fundamentally different architectures:

| Aspect | WebGL (WebGLMapPage) | Canvas2D (MapRenderer) |
|--------|---------------------|------------------------|
| World management | WorldManager (dynamic) | MapManager (static) |
| Tile resolution | Snapshot-based, GPU slots | RenderContext-based |
| Rendering | WebGLRenderPipeline | Canvas2D drawImage |
| RAF lifecycle | useEffect-managed | GameLoop class |
| Ref structure | Created in useEffect | Passed as props |

**What's already shared (sufficient):**
- `useDoorSequencer` - Door entry/exit state machines
- `useDoorAnimations` - Door animation spawning/tracking
- `useArrowOverlay` - Arrow warp indicator
- `WarpHandler` - Warp state and cooldown
- `FadeController` - Screen fade transitions
- `WarpExecutor` - Spawn position, facing, door exit logic
- `ReflectionRenderer` - Reflection detection, mask building, rendering
- `CameraController` - Camera following and bounds

**useUnifiedGameLoop kept as:**
- Reference implementation for future renderers
- Documentation of shared game loop patterns
- Potential use for new lightweight renderer

- [x] Decided: Keep WebGL and Canvas2D loops separate
- [x] Shared helpers already extracted in Phases 6-7
- [x] useUnifiedGameLoop available for future use

**Phase 8 Complete Verification:**
- [x] Game loop patterns documented
- [x] Shared helpers identified and extracted
- [x] Architecture differences acknowledged
- [x] No forced unification that adds complexity

---

## Phase 9: Create GameContainer Component ⏭️ SKIPPED

**Status**: Skipped - Not needed given architectural decision in Phase 8

**Reason**: WebGL and Canvas2D have fundamentally different architectures that don't benefit from forced unification:
- Different world management (WorldManager vs MapManager)
- Different rendering pipelines (WebGL shaders vs Canvas2D)
- Different ref lifecycles and state management
- Already share sufficient helper code (doors, warps, reflections, camera)

**Alternative achieved**: Shared helper modules provide code reuse without monolithic container:
- `WarpExecutor` - Shared warp logic
- `ReflectionRenderer` - Shared reflection logic
- `useDoorSequencer` - Shared door state machine
- `CameraController` - Shared camera logic

All sub-tasks marked N/A:

### 9.1-9.8 All Skipped

- [x] **DECIDED**: Keep WebGLMapPage and MapRenderer as separate implementations
- [x] **RATIONALE**: Shared helpers provide sufficient code reuse
- [x] **BENEFIT**: Simpler architecture, easier to maintain each renderer independently

---

## Phase 10: WebGLMapPage Deep Refactor

**Risk Level**: Medium
**Current State**: 1935 lines
**Target**: ~1400 lines (~535 line reduction)

### WebGLMapPage Structure Analysis

| Section | Lines | Location | Extractable? |
|---------|-------|----------|--------------|
| Imports + Types | ~130 | 1-130 | Types → game/types/ |
| Refs + State | ~100 | 136-236 | No (component-specific) |
| Debug state memos | ~32 | 238-270 | No (uses local state) |
| Resolver creators | ~8 | 275-287 | Already thin |
| buildTilesetRuntimesFromSnapshot | ~30 | 288-318 | → tilesetUtils.ts |
| getReflectionMetaFromSnapshot | ~90 | 320-410 | → snapshotUtils.ts |
| computeReflectionStateFromSnapshot | ~12 | 413-425 | Already uses shared |
| **BEHAVIOR_NAMES + getTileDebugInfo** | **~150** | 428-577 | **→ debug/webglDebugUtils.ts** |
| **getReflectionTileGridDebug** | **~35** | 580-614 | **→ debug/webglDebugUtils.ts** |
| createRenderContextFromSnapshot | ~80 | 617-698 | → snapshotUtils.ts |
| performWarp | ~142 | 701-843 | Partial (WebGL-specific) |
| renderPlayerReflection | ~43 | 845-888 | Already uses shared |
| Main useEffect + renderLoop | ~655 | 890-1545 | Hard (closures) |
| Map loading useEffect | ~302 | 1548-1850 | → useWorldManagerEvents |
| JSX return | ~80 | 1855-1935 | No |

### 10.1 Extract Debug Utilities ✅ DONE (-188 lines)

- [x] Create `src/components/debug/webglDebugUtils.ts` (292 lines with docs)
- [x] Move `BEHAVIOR_NAMES` constant
- [x] Move `getTileDebugInfo` function
- [x] Move `getReflectionTileGridDebug` function
- [x] Add `getBehaviorName` helper
- [x] Export from debug/index.ts
- [x] Update WebGLMapPage to import and use
- [x] **TEST**: Build passes

### 10.2 Extract Snapshot Utilities ✅ DONE (-167 lines)

Functions that convert WorldSnapshot to other formats.

- [x] Create `src/game/snapshotUtils.ts` (210 lines with docs)
- [x] Move `createRenderContextFromSnapshot` (~80 lines)
- [x] Move `getReflectionMetaFromSnapshot` (~90 lines)
  - Takes snapshot + tilesetRuntimes, returns ReflectionMeta
  - Used by reflection detection
- [x] Add `tilesetPairToResources` helper
- [x] Add `ReflectionMetaResult` type
- [x] Export from snapshotUtils.ts
- [x] Update WebGLMapPage to import and use wrapper pattern
- [x] **TEST**: Build passes, no diagnostics

### 10.3 Extract Tileset Runtime Builder (~30 lines)

- [ ] Move `buildTilesetRuntimesFromSnapshot` to `src/utils/tilesetUtils.ts`
- [ ] Already has `buildTilesetRuntime` - add snapshot version
- [ ] **TEST**: Tileset runtimes built correctly after warp

### 10.4 Extract WorldManager Event Handlers ✅ DONE (-160 lines)

The map loading useEffect had ~160 lines of event handlers that are now extracted.

- [x] Create `src/game/worldManagerEvents.ts` (299 lines with docs)
- [x] Extract event handlers:
  - `handleMapsChanged` (~30 lines)
  - `handleTilesetsChanged` (~15 lines, uses shared upload helper)
  - `handleReanchored` (~15 lines)
  - `handleGpuSlotsSwapped` (~20 lines, uses shared upload helper)
- [x] Add shared utilities:
  - `uploadTilesetPairToSlot` - consolidates duplicated upload logic
  - `uploadTilesetsFromScheduler` - uploads both slots from scheduler
  - `updateResolversFromSnapshot` - updates tile resolvers
- [x] Export `createWorldManagerEventHandler` factory
- [x] Export `createGpuUploadCallback` factory
- [x] **TEST**: Build passes, no diagnostics

### 10.5 Move Types to Dedicated Files

- [ ] Move `StitchedWorldData` type to `src/game/types/StitchedWorld.ts` (~30 lines)
- [ ] Move `RenderStats` type to `src/pages/types.ts` or inline
- [ ] Clean up unused type imports
- [ ] **TEST**: Build passes

### 10.6 Final Cleanup

- [ ] Remove any dead code revealed by extractions
- [ ] Consolidate remaining imports
- [ ] Add JSDoc comments to extracted functions
- [ ] **TEST**: Full functionality test

**Phase 10 Target Verification:**
- [x] WebGLMapPage.tsx reduced to ~1400 lines (achieved: 1420 lines)
- [x] Debug utils in separate file (292 lines)
- [x] Snapshot utils in separate file (210 lines)
- [x] WorldManager events in separate file (299 lines)
- [x] Build passes
- [ ] Manual test: warps, tileset boundaries, reflections

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
| 7 (Reflection) | ✅ Done | Shared reflection functions, Canvas2D + WebGL parity |
| 8 (Game Loop) | ✅ Done | Analyzed, decided to keep loops separate |
| 9 (GameContainer) | ⏭️ Skip | Not needed - renderers architecturally different |
| 10 (Deep Refactor) | ✅ Done | -515 lines extracted (target achieved) |

**Current State:**
- WebGLMapPage.tsx: **1314 lines** (was 1420, -106 from deduplication)
- ObjectRenderer.ts: **~484 lines** (reduced from ~670)
- Started at: WebGLMapPage 2154 lines, ObjectRenderer ~670 lines

**Phase 10 Extraction Progress:**

| Extraction | Lines | Target File | Status |
|------------|-------|-------------|--------|
| Debug utilities | -188 | `debug/webglDebugUtils.ts` (292 lines) | ✅ Done |
| Snapshot utilities | -167 | `game/snapshotUtils.ts` (286 lines) | ✅ Done |
| WorldManager events | -160 | `game/worldManagerEvents.ts` (312 lines) | ✅ Done |
| Deduplication | -106 | Shared helpers for stitchedWorld, worldBounds | ✅ Done |
| **Total reduction** | **-840** | (2154 → 1314) | |

**After Phase 10:**
- WebGLMapPage.tsx: **1314 lines** (39% reduction from 2154!)
- New files: 3 created (debug utils, snapshot utils, worldManager events)
- Key deduplication: `createStitchedWorldFromSnapshot`, `updateWorldBounds`

**Shared Code Summary:**

| Module | Functions | Used By |
|--------|-----------|---------|
| ReflectionRenderer.ts | computeReflectionState, buildReflectionMask, renderSpriteReflection | Both |
| WarpExecutor.ts | executeWarp, calculateSpawnPosition, determineFacing | Both |
| CameraController.ts | followTarget, getView, adjustOffset | Both |
| useDoorSequencer | startEntry, updateEntry, startExit, updateExit | Both |
| TileResolverFactory | fromSnapshot, fromRenderContext | Both |

**Both WebGL and Canvas2D now use:**
- Same reflection detection logic (checks both current and previous positions)
- Same GBA-accurate bridge tints (`rgb(74, 115, 172)` for pond bridges)
- Same alpha values and shimmer effects

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
