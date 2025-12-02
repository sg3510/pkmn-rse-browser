# Smart Player Spawn Position Algorithm

## Problem Statement

When changing maps via the map selector (both WebGL and Canvas2D modes), the player is currently placed at the exact center of the map. This can result in:
- Spawning on a collision tile where the player is stuck
- Spawning in a position surrounded by walls on all sides
- Spawning on water tiles (requiring surf to move)
- Spawning on small isolated islands disconnected from map exits
- Poor initial exploration experience

## Implemented Solution

A reusable `SpawnPositionFinder` utility that finds the optimal spawn tile near the map center based on:
1. **Walkability** - No collision, no water
2. **Open directions** - Multiple paths available
3. **Edge reachability** - Connected to map boundaries (where connections are)

## Algorithm Overview

### Phase 1: Candidate Search (BFS from Center)

```
1. Start at map center tile (width/2, height/2)
2. BFS outward within a search radius (default: 8 tiles)
3. For each tile, check if it's a valid spawn candidate:
   - collision bit = 0 (passable)
   - Not a water/surf tile (checked via isSurfableBehavior)
   - Has at least 1 open direction
```

### Phase 2: Walkability Scoring

For each candidate tile, calculate a walkability score:

```typescript
interface SpawnResult {
  x: number;
  y: number;
  score: number;

  // How many of the 4 cardinal directions are immediately walkable
  immediateDirections: number;  // 0-4

  // Maximum contiguous walkable distance in each direction (capped at 5)
  walkDistance: {
    up: number;
    down: number;
    left: number;
    right: number;
  };

  // Which map edges are reachable via flood fill
  edgeReachability: {
    north: boolean;
    south: boolean;
    east: boolean;
    west: boolean;
    count: number;  // 0-4
  };

  // Which warp points are reachable (for indoor maps without connections)
  warpReachability: {
    reachableCount: number;
    totalCount: number;
    hasAnyReachable: boolean;
  };

  // True if fallback to center was used
  isCenter: boolean;
}
```

### Phase 3: Edge Reachability Check

For each candidate, a flood fill determines which map edges are reachable:
- North edge (y = 0)
- South edge (y = height - 1)
- East edge (x = width - 1)
- West edge (x = 0)

This heavily penalizes tiles on small isolated islands and rewards tiles on the main walkable area connected to map exits.

### Phase 4: Warp Reachability Check

For indoor maps without edge connections, the algorithm also checks if warp points (exits) are reachable:
- Flood fill tracks which warp points are reached
- Maps with no reachable warps get heavily penalized
- This ensures the player can always exit the map

### Phase 5: Scoring Formula

The scoring strategy depends on whether the map has connections (outdoor) or not (indoor):

**For connected maps (no warps provided):**
```
totalScore = (immediateDirections * 25)           // 0-100 for open neighbors
           + sum(walkDistance[dir]) * 5           // 0-100 for walkability depth
           + (edgeReachability.count * 50)        // 0-200 for edge connectivity
           - (distanceFromCenter * 2)             // Penalty for distance from center
```

**For unconnected maps (warps provided):**
```
totalScore = (immediateDirections * 25)           // 0-100 for open neighbors
           + sum(walkDistance[dir]) * 5           // 0-100 for walkability depth
           + warpScore                            // +100 if reachable, -300 if not
           - (distanceFromCenter * 2)             // Penalty for distance from center
```

Edge reachability is **ignored** for unconnected maps because reaching map edges doesn't help the player exit - only warps do.

**Warp scoring logic:**
- If at least one warp is reachable: **+100 bonus**
- If NO warps are reachable: **-300 penalty** (avoid disconnected areas!)

**Score weights rationale:**
- `immediateDirections`: Important - player shouldn't feel trapped
- `walkDistance`: Secondary - indicates exploration potential
- `edgeReachability`: Only for outdoor/connected maps - ensures player can reach stitched map connections
- `warpReachability`: Only for indoor/unconnected maps - ensures player can exit via warps
- `distanceFromCenter`: Small penalty to prefer central positions when scores are equal

### Phase 6: Selection

1. Sort candidates by `totalScore` descending
2. Return the highest scoring tile
3. Fallback to map center if no valid candidates found

## Implementation

### File: `src/utils/spawnPositionFinder.ts`

```typescript
export interface SpawnFinderConfig {
  searchRadius?: number;         // Default: 8 tiles from center
  walkDistanceCap?: number;      // Default: 5 tiles per direction
  requireMinDirections?: number; // Default: 1 (at least one open direction)
  reachabilityLimit?: number;    // Default: 500 tiles for flood fill
  edgeReachabilityBonus?: number; // Default: 50 points per reachable edge
  warpReachabilityBonus?: number; // Default: 100 points for having reachable warps
}

export interface WarpPoint {
  x: number;
  y: number;
}

export class SpawnPositionFinder {
  findSpawnPosition(
    mapWidth: number,
    mapHeight: number,
    isPassable: (x: number, y: number) => boolean,
    warpPoints?: WarpPoint[]  // Optional warp locations for exit reachability
  ): SpawnResult;
}
```

### Integration Points

#### Canvas2D Mode (`src/components/MapRendererInit.ts`)

```typescript
const spawnFinder = new SpawnPositionFinder();
const renderCtxForSpawn = refs.renderContextRef.current;
// Extract warp points for exit reachability (important for indoor maps)
const warpPoints = anchor.warpEvents?.map(w => ({ x: w.x, y: w.y })) ?? [];
const spawnResult = spawnFinder.findSpawnPosition(
  anchor.mapData.width,
  anchor.mapData.height,
  (x, y) => {
    const index = y * anchor.mapData.width + x;
    const tile = anchor.mapData.layout[index];
    if (!tile || tile.collision !== 0) return false;
    // Also check for water tiles
    if (renderCtxForSpawn) {
      const resolved = resolveTileAt(renderCtxForSpawn, x, y);
      if (resolved?.attributes && isSurfableBehavior(resolved.attributes.behavior)) {
        return false;
      }
    }
    return true;
  },
  warpPoints
);
player.setPositionAndDirection(spawnResult.x, spawnResult.y, 'down');
```

#### WebGL Mode (`src/pages/WebGLMapPage.tsx`)

```typescript
const anchorMap = snapshot.maps.find(m => m.entry.id === entry.id) ?? snapshot.maps[0];
const tilesetPairIndex = snapshot.mapTilesetPairIndex.get(anchorMap.entry.id);
const tilesetPair = tilesetPairIndex !== undefined ? snapshot.tilesetPairs[tilesetPairIndex] : null;
// Extract warp points for exit reachability (important for indoor maps)
const warpPoints = anchorMap.warpEvents?.map(w => ({ x: w.x, y: w.y })) ?? [];
const spawnFinder = new SpawnPositionFinder();
const spawnResult = spawnFinder.findSpawnPosition(
  anchorMap.mapData.width,
  anchorMap.mapData.height,
  (x, y) => {
    const index = y * anchorMap.mapData.width + x;
    const tile = anchorMap.mapData.layout[index];
    if (!tile || tile.collision !== 0) return false;
    // Also check for water tiles
    if (tilesetPair) {
      const metatileId = tile.metatileId;
      const attrs = metatileId < 512
        ? tilesetPair.primaryAttributes[metatileId]
        : tilesetPair.secondaryAttributes[metatileId - 512];
      if (attrs && isSurfableBehavior(attrs.behavior)) {
        return false;
      }
    }
    return true;
  },
  warpPoints
);
player.setPosition(spawnResult.x, spawnResult.y);
```

## Edge Cases

| Case | Handling |
|------|----------|
| Entire map is blocked | Return center (fallback) |
| Center is the only passable tile | Return center with score based on edges |
| Multiple tiles with equal score | Prefer the one closer to center (BFS order) |
| Very small maps (< 5x5) | Reduce search radius proportionally |
| Map has water in center | Skip water tiles, find nearby land |
| Isolated island near center | Low score due to poor edge reachability |
| Map with no connections | Warp reachability becomes critical |
| Indoor map with warps | Tiles near reachable warps score +100 |
| No reachable warps | Heavily penalized, prefer any exit path |

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/spawnPositionFinder.ts` | **Created** - Core algorithm |
| `src/utils/metatileBehaviors.ts` | Used for `isSurfableBehavior` |
| `src/components/MapRendererInit.ts` | Integrated spawn finder with water check |
| `src/pages/WebGLMapPage.tsx` | Integrated spawn finder with water check |

## Performance

- BFS candidate search: O(radius²) ~64 tiles max
- Edge reachability per candidate: O(500) tiles max (configurable)
- Total worst case: ~64 candidates × 500 flood fill = 32,000 tile checks
- In practice: Early exit when all 4 edges found, typically < 5,000 checks
- Runs once per map change, imperceptible delay
