/**
 * findPlayerSpawnPosition
 *
 * Shared utility for finding optimal player spawn positions on maps.
 * Used by both WebGLMapPage and MapRendererInit to avoid code duplication.
 *
 * Uses SpawnPositionFinder to search for walkable positions that:
 * - Have no collision
 * - Are not water/surfable tiles
 * - Are preferably near warp exits for indoor maps
 */

import { SpawnPositionFinder } from '../utils/spawnPositionFinder';
import { isSurfableBehavior } from '../utils/metatileBehaviors';

/**
 * Minimal map data needed for spawn position finding
 */
export interface SpawnMapData {
  width: number;
  height: number;
  layout: Array<{ metatileId: number; collision: number }>;
}

/**
 * Callback to get tile behavior at a position.
 * Returns the behavior value or undefined if not available.
 */
export type BehaviorProvider = (x: number, y: number, metatileId: number) => number | undefined;

/**
 * Find an optimal spawn position for the player on a map.
 *
 * @param mapData - Map dimensions and tile layout
 * @param warpEvents - Warp events on the map (for exit reachability)
 * @param getBehavior - Callback to get tile behavior (for surfability check)
 * @returns Spawn position { x, y }
 */
export function findPlayerSpawnPosition(
  mapData: SpawnMapData,
  warpEvents: Array<{ x: number; y: number }> | undefined,
  getBehavior: BehaviorProvider
): { x: number; y: number } {
  const spawnFinder = new SpawnPositionFinder();

  // Extract warp points for exit reachability (important for indoor maps)
  const warpPoints = warpEvents?.map(w => ({ x: w.x, y: w.y })) ?? [];

  const spawnResult = spawnFinder.findSpawnPosition(
    mapData.width,
    mapData.height,
    (x, y) => {
      const index = y * mapData.width + x;
      const tile = mapData.layout[index];
      if (!tile || tile.collision !== 0) return false;

      // Check for water tiles (require surf to traverse)
      const behavior = getBehavior(x, y, tile.metatileId);
      if (behavior !== undefined && isSurfableBehavior(behavior)) {
        return false;
      }

      return true;
    },
    warpPoints
  );

  return { x: spawnResult.x, y: spawnResult.y };
}
