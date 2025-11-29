# Game Types

Shared type definitions for world management across different rendering backends.

## Overview

This module defines interfaces that allow WebGLMapPage and MapRenderer to share
game logic while using different underlying implementations for world management.

## WorldManager vs MapManager

| Feature | WorldManager (WebGL) | MapManager (Canvas2D) |
|---------|---------------------|----------------------|
| **File** | `src/game/WorldManager.ts` | `src/services/MapManager.ts` |
| **Used by** | WebGLMapPage | MapRenderer |
| **Map loading** | Dynamic (load/unload as player moves) | Static (load connections at init) |
| **Tileset handling** | Shared tileset pairs with GPU slots | Embedded per-map tilesets |
| **GPU constraints** | Max 2 tileset pairs in GPU | No GPU constraints |
| **World origin** | Can be negative (reanchoring) | Always (0,0) |
| **Infinite world** | Yes (via reanchoring) | No (fixed connection bounds) |
| **Border tiles** | 4 tiles max (GPU buffer limit) | Full border rendering |

### WorldManager Details

- **GPU Slot Management**: Only 2 tileset pairs can be in GPU at once
- **Tileset Pair Scheduling**: `TilesetPairScheduler` manages which pairs are loaded
- **Epoch Tracking**: Cancels stale async operations when world changes
- **Reanchoring**: When player moves far, world re-centers to prevent coordinate overflow
- **Events**: Emits `mapsChanged`, `tilesetsChanged`, `reanchored`, `gpuSlotsSwapped`

### MapManager Details

- **Connection Loading**: Loads all connected maps at initialization
- **No GPU Limits**: Canvas2D can render any tileset without upload limits
- **Simpler Bounds**: World always starts at (0,0), no negative coordinates
- **Object Events**: Tracks NPCs and items (not yet in WorldManager)

## Interface Hierarchy

```
IWorldState (base)
├── IWebGLWorldState (+ pairIdToGpuSlot, anchorBorderMetatiles)
└── ICanvas2DWorldState (+ embedded tilesets, object events)

IWorldProvider (base)
├── IWebGLWorldProvider (+ subscribe, getDebugInfo)
└── ICanvas2DWorldProvider (future)

ILoadedMapInstance (base)
├── IWebGLMapInstance (+ tilesetPairIndex)
└── ICanvas2DMapInstance (+ tilesets, objectEvents)
```

## Future: Unified GameContainer

The goal is to create a `GameContainer` component that accepts an `IWorldProvider`
and works with either implementation:

```tsx
<GameContainer
  worldProvider={isWebGL ? worldManager : mapManagerAdapter}
  renderer={isWebGL ? 'webgl' : 'canvas2d'}
/>
```

For this to work:
1. MapManager needs an adapter implementing `IWorldProvider`
2. Game loop logic needs to work with `IWorldState` (not implementation-specific types)
3. Rendering logic uses the appropriate pipeline based on renderer type

## Migration Path

1. **Phase 3** (current): Define shared interfaces
2. **Phase 4-8**: Extract components using shared interfaces
3. **Phase 9**: Create GameContainer using `IWorldProvider`
4. **Future**: MapManager adapter for full unification
