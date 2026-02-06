---
title: Current State Analysis
status: reference
last_verified: 2026-01-13
---

# Current State Analysis

## WebGLMapPage.tsx Structure (2154 lines)

### Breakdown by Section

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & Types | 1-120 | Type definitions, constants |
| Helper Functions | 121-145 | `combineTilesetPalettes` |
| Component Start | 146-243 | Refs, state declarations |
| Tile Resolvers | 244-443 | `createSnapshotTileResolver`, `createSnapshotPlayerTileResolver` |
| Tileset Helpers | 444-600 | `uploadTilesetsFromSnapshot`, `buildTilesetRuntimesFromSnapshot`, reflection helpers |
| Render Context | 601-705 | `createRenderContextFromSnapshot` |
| Warp Execution | 706-895 | `performWarp` callback |
| Reflection Rendering | 896-1000 | `renderPlayerReflection` |
| Door Warp Handler | 1001-1165 | Player sprite loading, door handler setup |
| Game Loop | 1180-1440 | Main render loop |
| Compositing & Rendering | 1440-1700 | Scene compositing, sprite rendering |
| WorldManager Setup | 1700-1990 | Event handlers, initialization |
| JSX Render | 2000-2154 | UI components, debug panels |

### Code Smell Indicators

1. **Inline Game Loop** (lines 1183-1700) - ~500 lines of render loop logic
2. **Duplicate Tile Resolution** - Same pattern as MapRenderer but reimplemented
3. **Monolithic performWarp** - 190 lines in one callback
4. **Embedded Debug UI** - 150+ lines of inline JSX for debug panels
5. **No Hook Extraction** - MapRenderer uses hooks, WebGLMapPage doesn't

## MapRenderer.tsx Structure (466 lines)

### Clean Hook-Based Architecture

```tsx
// Hooks used:
const doorAnimations = useDoorAnimations();
const arrowOverlay = useArrowOverlay();
const fieldSprites = useFieldSprites();
const doorSequencer = useDoorSequencer({ warpHandler });
const { createRunUpdate } = useRunUpdate({ refs, ... });
const { createWarpExecutors } = useWarpExecution({ refs, ... });
const { compositeScene } = useCompositeScene({ refs, ... });
```

### Why MapRenderer is Cleaner

1. **Initialization extracted** to `MapRendererInit.ts`
2. **Game loop** in `useRunUpdate` hook
3. **Scene compositing** in `useCompositeScene` hook
4. **Warp logic** in `useWarpExecution` hook
5. **Debug callbacks** in `useDebugCallbacks` hook

## Shared Code Already Exists

Both files use these hooks:
- `useDoorAnimations` - Door open/close animations
- `useArrowOverlay` - Arrow warp indicators
- `useDoorSequencer` - Door entry/exit sequences
- `useFieldSprites` - Grass, sand, splash effects

## Key Differences

| Feature | WebGLMapPage | MapRenderer |
|---------|--------------|-------------|
| World Management | WorldManager class | MapManager class |
| Tile Resolution | Snapshot-based | RenderContext-based |
| Pipeline | WebGLRenderPipeline | IRenderPipeline (Canvas2D) |
| Game Loop | Inline RAF | GameLoop class |
| Map Loading | Dynamic (WorldManager) | Connection-based (MapManager) |

## Critical Finding

WebGLMapPage's `WorldManager` is more sophisticated:
- Handles infinite world with dynamic loading
- Tileset pair scheduling for GPU
- Epoch-based async operation cancellation

MapRenderer's `MapManager` is simpler:
- Loads connected maps at initialization
- Single tileset pair

**Recommendation**: Port `WorldManager` pattern to shared abstraction.
