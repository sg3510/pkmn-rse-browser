# MapRenderer Refactoring Plan

## Goal
Reduce the size and complexity of `src/components/MapRenderer.tsx` (currently ~3300 lines) by extracting logical components into separate files and hooks. This will improve maintainability and readability without changing functionality.

## Analysis
`MapRenderer.tsx` currently handles:
1.  **Tileset Processing**: Building runtimes, reflection metadata, and patching tiles for animations.
2.  **Rendering**: Core rendering loop, layer composition, and hardware acceleration logic.
3.  **Door System**: Asset mapping, animation state management, and rendering.
4.  **Warp System**: Complex state machine for door entry/exit sequences and map transitions.
5.  **Field Effects**: Loading and managing sprites for grass, sand, etc.
6.  **Input Handling**: 'X' key for surf, debug clicks.
7.  **Debug Overlays**: Rendering debug info.

## Proposed Changes

### 1. Extract Tileset Logic
Move tileset processing functions to `src/components/map/logic/TilesetProcessing.ts`.
-   `buildTilesetRuntime`
-   `buildReflectionMeta`
-   `buildTileTransparencyLUT`
-   `buildPaletteRgbLUT`
-   `isWaterColor`
-   `applyWaterMaskToMetatile`

### 2. Extract Door System
Create `src/components/map/logic/DoorManager.ts` (or `useDoorManager` hook).
-   `DOOR_ASSET_MAP` and helper `getDoorAssetForMetatile`
-   `spawnDoorAnimation`
-   `renderDoorAnimations`
-   `pruneDoorAnimations`
-   `ensureDoorSprite`
-   State: `doorAnimsRef`, `doorSpriteCacheRef`

### 3. Extract Warp Logic
Create `src/components/map/hooks/useWarpSystem.ts`.
-   State: `warpState`, `doorEntry`, `doorExitRef`, `fadeRef`
-   Functions: `startAutoDoorWarp`, `performWarp`, `handleDoorWarpAttempt`, `advanceDoorEntry`
-   This hook will need access to `playerController`, `mapManager`, `renderContext`, and `doorManager`.

### 4. Extract Field Effect Assets
Move asset loading to `src/components/map/logic/FieldEffectAssets.ts` or `src/game/FieldEffectManager.ts`.
-   `ensureGrassSprite`
-   `ensureLongGrassSprite`
-   `ensureSandSprite`
-   `ensureArrowSprite`

### 5. Extract Rendering Core
Create `src/components/map/renderers/MapCanvasRenderer.ts` (class or hook).
-   `renderPass`
-   `renderPassCanvas`
-   `drawTileToCanvas`
-   `drawRegionToContext`
-   `compositeScene` (this might stay in the main component but delegate heavy lifting)

### 6. Extract Input Handling
Create `src/components/map/hooks/useMapInput.ts`.
-   'X' key handler for surf.
-   Debug click handler.

## Refactoring Steps

1.  **Phase 1: Utilities & Assets**
    -   Extract `TilesetProcessing.ts`.
    -   Extract `FieldEffectAssets.ts`.
    -   Extract `DoorManager.ts` (logic and constants).

2.  **Phase 2: Hooks**
    -   Create `useDoorSystem` hook to wrap `DoorManager` and state.
    -   Create `useWarpSystem` hook.

3.  **Phase 3: Rendering**
    -   Move `renderPass` and related helpers to `MapRenderUtils.ts` or `MapCanvasRenderer`.

## Verification Plan
-   **Manual Testing**:
    -   Walk around to verify rendering is identical.
    -   Test animations (water, flowers).
    -   Test door entry/exit (animated and non-animated).
    -   Test warping (arrow warps, stairs).
    -   Test surfing (mounting/dismounting).
    -   Test debug overlay.
-   **Automated Testing**:
    -   Existing tests should pass (if any).
    -   Since this is a refactor, no behavior change is expected.

## Directory Structure
```
src/components/map/
  ├── MapRenderer.tsx       (Main component, significantly smaller)
  ├── hooks/
  │   ├── useDoorSystem.ts
  │   ├── useWarpSystem.ts
  │   ├── useMapInput.ts
  │   └── useMapRendering.ts
  ├── logic/
  │   ├── TilesetProcessing.ts
  │   ├── DoorManager.ts
  │   └── FieldEffectAssets.ts
  ├── renderers/
  │   ├── MapCanvasRenderer.ts
  │   ├── ObjectRenderer.tsx
  │   └── DebugRenderer.tsx
  ├── types.ts
  └── utils.ts
```
