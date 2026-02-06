---
title: WebGL Map Stitching Implementation
status: reference
last_verified: 2026-01-13
---

# WebGL Map Stitching Implementation

## Overview

WebGLMapPage automatically stitches together connected maps that share the same tileset pair (primary + secondary). This allows seamless walking between connected outdoor areas without needing to reload textures.

## Current Implementation

### Always-On Stitching

Map stitching is always enabled. When a map is selected:

1. The anchor map is loaded
2. All connected maps with matching tilesets are discovered via BFS
3. Maps are positioned using connection offsets
4. A unified world is created with shared tileset assets

### Tileset Constraint

**Key insight**: WebGL can only have one tileset pair uploaded at a time (limited GPU texture slots).

- Maps with matching `primaryTilesetId` AND `secondaryTilesetId` can be rendered together
- Maps with different tilesets are **skipped during stitching**
- To reach different-tileset areas, player must use warps/doors

### Depth Limiting

Stitching uses `maxDepth = 3` by default to limit memory usage:
- Depth 0: Anchor map only
- Depth 1: Direct neighbors
- Depth 2: Neighbors of neighbors
- Depth 3: One more level out

This prevents loading the entire game world when maps share tilesets across large regions.

## Example: Petalburg Area

The starting area chain all use `gTileset_General` + `gTileset_Petalburg`:
- LittlerootTown
- Route101
- OldaleTown
- Route102
- PetalburgCity

All these maps are stitched into one seamless world when any is selected.

## Data Structures

```typescript
type StitchedMapInstance = {
  entry: MapIndexEntry;
  mapData: MapData;
  offsetX: number;  // World tile offset (can be negative)
  offsetY: number;
};

type StitchedWorldData = {
  maps: StitchedMapInstance[];
  anchorId: string;
  worldBounds: { minX, minY, maxX, maxY, width, height };
  // Shared tileset assets (loaded once)
  primaryMetatiles, secondaryMetatiles,
  primaryAttributes, secondaryAttributes,
  primaryImage, secondaryImage,
  primaryPalettes, secondaryPalettes,
  animations, borderMetatiles
};
```

## Connection Offset Calculation

Offsets are computed based on connection direction:
- **Up/North**: `offsetX = base.offsetX + conn.offset`, `offsetY = base.offsetY - neighbor.height`
- **Down/South**: `offsetX = base.offsetX + conn.offset`, `offsetY = base.offsetY + base.height`
- **Left/West**: `offsetX = base.offsetX - neighbor.width`, `offsetY = base.offsetY + conn.offset`
- **Right/East**: `offsetX = base.offsetX + base.width`, `offsetY = base.offsetY + conn.offset`

## Tile Resolution

The stitched tile resolver searches through loaded maps to find which map contains each world coordinate:

```typescript
function createStitchedTileResolver(world: StitchedWorldData): TileResolverFn {
  return (worldX, worldY) => {
    for (const map of world.maps) {
      const localX = worldX - map.offsetX;
      const localY = worldY - map.offsetY;
      if (localX >= 0 && localX < map.entry.width &&
          localY >= 0 && localY < map.entry.height) {
        // Resolve tile from this map
        return resolvedTile;
      }
    }
    // Out of bounds - return border tile
    return borderTile;
  };
}
```

## Future: Dynamic Tileset Switching

For seamless crossing into different-tileset areas:

### Option A: Block at Boundary (Current)
- Don't stitch maps with different tilesets
- Player can only warp to change tileset areas

### Option B: Dynamic Tileset Switch
- Detect when player approaches tileset boundary
- Preload new tileset textures
- Switch tilesets when player crosses
- Reload stitched world from new anchor
- May cause brief loading/flicker

### Option C: Multi-Tileset Atlas (Complex)
- Pre-load multiple tilesets into a texture atlas
- Use UV coordinates to select correct tileset per tile
- Requires shader modifications

## Files

- `src/pages/WebGLMapPage.tsx` - Main implementation
- `src/rendering/webgl/WebGLRenderPipeline.ts` - WebGL rendering

## Reference

Key functions from main Canvas 2D implementation:
- `MapManager.buildWorld()` - BFS map loading with offsets
- `MapManager.computeOffset()` - Direction-based offset calculation
- `resolveTileAt()` in `src/components/map/utils.ts` - Multi-map tile lookup
