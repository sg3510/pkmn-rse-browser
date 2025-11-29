/**
 * TileResolverFactory
 *
 * Creates tile resolver functions from different world state representations.
 * Extracted from WebGLMapPage.tsx to enable reuse across rendering backends.
 *
 * Supports:
 * - WorldSnapshot (WebGL with WorldManager)
 * - RenderContext (Canvas2D with MapManager) - future
 */

import type {
  TileResolverFn,
  ResolvedTile,
  RenderContext,
} from '../rendering/types';
import type { WorldSnapshot } from './WorldManager';
import { resolveTileAt } from '../components/map/utils';
import type { MetatileAttributes } from '../utils/mapLoader';
import { SECONDARY_TILE_OFFSET } from '../utils/mapLoader';
import type { TileResolver as PlayerTileResolver } from './PlayerController';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of player tile resolution (for collision/behavior checks)
 */
export interface PlayerTileResult {
  mapTile: { metatileId: number; collision: number; elevation: number };
  attributes: MetatileAttributes;
}

/**
 * Debug logger for tile resolution (disabled by default)
 */
type ResolverLogger = (message: string) => void;

// =============================================================================
// TileResolverFactory
// =============================================================================

export class TileResolverFactory {
  /**
   * Create a tile resolver from a WorldManager snapshot.
   * Used by WebGLMapPage for GPU-based rendering with multiple tileset pairs.
   *
   * @param snapshot - WorldSnapshot from WorldManager
   * @param resolverId - Optional ID for debug logging
   * @param logger - Optional logger function for debug output
   */
  static fromSnapshot(
    snapshot: WorldSnapshot,
    resolverId?: number,
    logger?: ResolverLogger
  ): TileResolverFn {
    const {
      maps,
      tilesetPairs,
      mapTilesetPairIndex,
      anchorBorderMetatiles,
      pairIdToGpuSlot,
      anchorMapId,
    } = snapshot;

    const shouldLog = !!logger;
    const log = logger ?? (() => {});

    // Helper to convert tileset pair array index to GPU slot (0 or 1)
    const getGpuSlot = (pairIndex: number): number => {
      const pair = tilesetPairs[pairIndex];
      if (!pair) return 0;
      return pairIdToGpuSlot.get(pair.id) ?? 0;
    };

    // Get anchor map's tileset pair for border rendering
    const anchorMap = maps.find((m) => m.entry.id === anchorMapId) ?? maps[0];
    const anchorPairIndex = anchorMap
      ? (mapTilesetPairIndex.get(anchorMap.entry.id) ?? 0)
      : 0;
    const anchorPair = tilesetPairs[anchorPairIndex] ?? tilesetPairs[0];

    // Helper to check if a map's tileset is in GPU
    const isMapTilesetInGpu = (map: (typeof maps)[0]): boolean => {
      const pairIndex = mapTilesetPairIndex.get(map.entry.id);
      if (pairIndex === undefined) return false;
      const pair = tilesetPairs[pairIndex];
      if (!pair) return false;
      return pairIdToGpuSlot.has(pair.id);
    };

    return (worldX: number, worldY: number): ResolvedTile | null => {
      // Find which map contains this world tile
      for (const map of maps) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        if (
          localX >= 0 &&
          localX < map.entry.width &&
          localY >= 0 &&
          localY < map.entry.height
        ) {
          const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
          const pair = tilesetPairs[pairIndex];

          const idx = localY * map.entry.width + localX;
          const mapTile = map.mapData.layout[idx];
          const metatileId = mapTile.metatileId;

          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const metatile = isSecondary
            ? pair.secondaryMetatiles[metatileId - SECONDARY_TILE_OFFSET]
            : pair.primaryMetatiles[metatileId];

          if (!metatile) return null;

          const attrIndex = isSecondary
            ? metatileId - SECONDARY_TILE_OFFSET
            : metatileId;
          const attrArray = isSecondary
            ? pair.secondaryAttributes
            : pair.primaryAttributes;
          const attributes: MetatileAttributes = attrArray[attrIndex] ?? {
            behavior: 0,
            layerType: 0,
          };

          // Use GPU slot index (0 or 1), not array index
          const gpuSlot = getGpuSlot(pairIndex);

          if (shouldLog) {
            log(
              `[RESOLVE:${resolverId}] world(${worldX},${worldY}) -> map:${map.entry.id} local(${localX},${localY}) metatile:${metatileId} gpuSlot:${gpuSlot} pair:${pair.id}`
            );
          }

          return {
            metatile,
            attributes,
            mapTile,
            map: null as any,
            tileset: null as any,
            isSecondary,
            isBorder: false,
            tilesetPairIndex: gpuSlot,
          };
        }
      }

      // Out of bounds - find NEAREST map whose tileset pair is IN GPU and use its border tiles
      // CRITICAL: We can only render tiles from tilesets that are currently in GPU!
      // If nearest map's tileset isn't in GPU, fall back to a map whose tileset IS in GPU
      let nearestMap: (typeof maps)[0] | null = null;
      let nearestDist = Infinity;

      for (const map of maps) {
        // ONLY consider maps whose tileset pair is currently in GPU
        if (!isMapTilesetInGpu(map)) continue;

        // Calculate distance from (worldX, worldY) to map's bounding box
        const mapLeft = map.offsetX;
        const mapRight = map.offsetX + map.entry.width;
        const mapTop = map.offsetY;
        const mapBottom = map.offsetY + map.entry.height;

        // Horizontal distance (0 if inside map's X range)
        const dx =
          worldX < mapLeft
            ? mapLeft - worldX
            : worldX >= mapRight
              ? worldX - mapRight + 1
              : 0;
        // Vertical distance (0 if inside map's Y range)
        const dy =
          worldY < mapTop
            ? mapTop - worldY
            : worldY >= mapBottom
              ? worldY - mapBottom + 1
              : 0;

        // Euclidean distance to bounding box (squared for comparison, no need for sqrt)
        const dist = dx * dx + dy * dy;

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestMap = map;
        }
      }

      // Fall back to anchor if no maps with GPU tilesets found
      if (!nearestMap) {
        if (anchorBorderMetatiles.length === 0 || !anchorPair) return null;
        // Use anchor map's borders with anchor's tileset (should be in GPU)
        nearestMap = anchorMap;
      }

      // Get border tiles from the nearest map
      const borderMetatiles =
        nearestMap.borderMetatiles.length > 0
          ? nearestMap.borderMetatiles
          : anchorBorderMetatiles;

      if (borderMetatiles.length === 0) return null;

      // Get tileset pair for the nearest map
      const nearestPairIndex =
        mapTilesetPairIndex.get(nearestMap.entry.id) ?? anchorPairIndex;
      const nearestPair = tilesetPairs[nearestPairIndex] ?? anchorPair;

      if (!nearestPair) return null;

      // Verify the pair is actually in GPU - if not, we can't render these borders
      if (!pairIdToGpuSlot.has(nearestPair.id)) {
        // Tileset not in GPU, cannot render border
        return null;
      }

      const borderIndex =
        ((worldX & 1) + ((worldY & 1) * 2)) % borderMetatiles.length;
      const borderMetatileId = borderMetatiles[borderIndex];

      const isSecondary = borderMetatileId >= SECONDARY_TILE_OFFSET;
      const metatile = isSecondary
        ? nearestPair.secondaryMetatiles[borderMetatileId - SECONDARY_TILE_OFFSET]
        : nearestPair.primaryMetatiles[borderMetatileId];

      if (!metatile) return null;

      const attrIndex = isSecondary
        ? borderMetatileId - SECONDARY_TILE_OFFSET
        : borderMetatileId;
      const attrArray = isSecondary
        ? nearestPair.secondaryAttributes
        : nearestPair.primaryAttributes;
      const attributes: MetatileAttributes = attrArray[attrIndex] ?? {
        behavior: 0,
        layerType: 0,
      };

      // Use GPU slot index (0 or 1) of the nearest map's tileset pair
      const gpuSlot = getGpuSlot(nearestPairIndex);

      if (shouldLog) {
        log(
          `[RESOLVE:${resolverId}] world(${worldX},${worldY}) -> BORDER nearestMap:${nearestMap.entry.id} metatile:${borderMetatileId} gpuSlot:${gpuSlot} pair:${nearestPair.id}`
        );
      }

      return {
        metatile,
        attributes,
        mapTile: { metatileId: borderMetatileId, collision: 1, elevation: 0 },
        map: null as any,
        tileset: null as any,
        isSecondary,
        isBorder: true,
        tilesetPairIndex: gpuSlot,
      };
    };
  }

  /**
   * Create a player tile resolver from a WorldManager snapshot.
   * Used for collision detection and behavior checks.
   *
   * @param snapshot - WorldSnapshot from WorldManager
   */
  static createPlayerResolver(snapshot: WorldSnapshot): PlayerTileResolver {
    const { maps, tilesetPairs, mapTilesetPairIndex } = snapshot;

    return (worldX: number, worldY: number): PlayerTileResult | null => {
      for (const map of maps) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        if (
          localX >= 0 &&
          localX < map.entry.width &&
          localY >= 0 &&
          localY < map.entry.height
        ) {
          const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
          const pair = tilesetPairs[pairIndex];

          const idx = localY * map.entry.width + localX;
          const mapTile = map.mapData.layout[idx];
          const metatileId = mapTile.metatileId;
          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const attrIndex = isSecondary
            ? metatileId - SECONDARY_TILE_OFFSET
            : metatileId;
          const attrArray = isSecondary
            ? pair.secondaryAttributes
            : pair.primaryAttributes;
          const attributes: MetatileAttributes = attrArray[attrIndex] ?? {
            behavior: 0,
            layerType: 0,
          };

          return { mapTile, attributes };
        }
      }
      return null;
    };
  }

  /**
   * Create a tile resolver from a Canvas2D RenderContext.
   * Used by MapRenderer for single-tileset rendering.
   *
   * @param ctx - RenderContext from MapManager
   */
  static fromRenderContext(ctx: RenderContext): TileResolverFn {
    // Use the resolveTileAt utility function which works with RenderContext
    return (worldX: number, worldY: number): ResolvedTile | null => {
      return resolveTileAt(ctx, worldX, worldY);
    };
  }
}

// =============================================================================
// Convenience exports
// =============================================================================

export { type PlayerTileResolver };
