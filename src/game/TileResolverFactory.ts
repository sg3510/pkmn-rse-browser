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
import { resolveMetatileIndex } from '../utils/mapLoader';
import type { TileResolver as PlayerTileResolver } from './PlayerController';
import { buildSnapshotSpatialIndex } from './snapshotSpatialIndex';

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
    const spatialIndex = buildSnapshotSpatialIndex(snapshot);

    // Helper to convert tileset pair array index to GPU slot.
    const getGpuSlot = (pairIndex: number): number | null => {
      const pair = tilesetPairs[pairIndex];
      if (!pair) return null;
      return pairIdToGpuSlot.get(pair.id) ?? null;
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
    const mapIdsWithGpuTilesets = new Set(
      maps
        .filter((map) => isMapTilesetInGpu(map))
        .map((map) => map.entry.id)
    );

    return (worldX: number, worldY: number): ResolvedTile | null => {
      const map = spatialIndex.getMapAt(worldX, worldY);
      if (map) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
        const pair = tilesetPairs[pairIndex];
        if (!pair) return null;

        const idx = localY * map.entry.width + localX;
        const mapTile = map.mapData.layout[idx];
        if (!mapTile) return null;
        const metatileId = mapTile.metatileId;

        const { isSecondary, index: attrIndex } = resolveMetatileIndex(metatileId);
        const metatile = isSecondary
          ? pair.secondaryMetatiles[attrIndex]
          : pair.primaryMetatiles[metatileId];

        if (!metatile) return null;

        const attrArray = isSecondary
          ? pair.secondaryAttributes
          : pair.primaryAttributes;
        const attributes: MetatileAttributes = attrArray[attrIndex] ?? {
          behavior: 0,
          layerType: 0,
        };

        // Use GPU slot index (0 or 1), not array index
        const gpuSlot = getGpuSlot(pairIndex);
        if (gpuSlot === null) return null;

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

      // Out of bounds.
      // C parity: sample border metatiles from the current anchor map first so
      // edge visuals (e.g. Littleroot infinite trees) stay stable at map seams.
      // Reference: public/pokeemerald/src/fieldmap.c (GetBorderBlockAt)
      let borderMap = anchorMap ?? null;
      let borderPairIndex = anchorPairIndex;
      let borderPair = anchorPair ?? null;
      let borderMetatiles = anchorBorderMetatiles;

      const anchorReady =
        borderMap !== null
        && borderPair !== null
        && borderMetatiles.length > 0
        && pairIdToGpuSlot.has(borderPair.id);

      if (!anchorReady) {
        // Fallback for rare cases where anchor tileset is not in GPU.
        const nearestMap = mapIdsWithGpuTilesets.size > 0
          ? spatialIndex.getNearestMap(worldX, worldY, mapIdsWithGpuTilesets)
          : null;
        if (!nearestMap) return null;

        const nearestPairIndex = mapTilesetPairIndex.get(nearestMap.entry.id);
        if (nearestPairIndex === undefined) return null;
        const nearestPair = tilesetPairs[nearestPairIndex];
        if (!nearestPair || !pairIdToGpuSlot.has(nearestPair.id)) return null;

        borderMap = nearestMap;
        borderPairIndex = nearestPairIndex;
        borderPair = nearestPair;
        borderMetatiles =
          nearestMap.borderMetatiles.length > 0
            ? nearestMap.borderMetatiles
            : anchorBorderMetatiles;
      }

      if (!borderMap || !borderPair || borderMetatiles.length === 0) return null;

      const borderLocalX = worldX - borderMap.offsetX;
      const borderLocalY = worldY - borderMap.offsetY;
      const borderIndex =
        ((borderLocalX & 1) + ((borderLocalY & 1) * 2)) % borderMetatiles.length;
      const borderMetatileId = borderMetatiles[borderIndex];

      const { isSecondary, index: attrIndex } = resolveMetatileIndex(borderMetatileId);
      const metatile = isSecondary
        ? borderPair.secondaryMetatiles[attrIndex]
        : borderPair.primaryMetatiles[borderMetatileId];

      if (!metatile) return null;

      const attrArray = isSecondary
        ? borderPair.secondaryAttributes
        : borderPair.primaryAttributes;
      const attributes: MetatileAttributes = attrArray[attrIndex] ?? {
        behavior: 0,
        layerType: 0,
      };

      // Use GPU slot index (0, 1, or 2) of the selected border map's tileset pair.
      const gpuSlot = getGpuSlot(borderPairIndex);
      if (gpuSlot === null) return null;

      if (shouldLog) {
        log(
          `[RESOLVE:${resolverId}] world(${worldX},${worldY}) -> BORDER map:${borderMap.entry.id} metatile:${borderMetatileId} gpuSlot:${gpuSlot} pair:${borderPair.id}`
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
    const { tilesetPairs, mapTilesetPairIndex } = snapshot;
    const spatialIndex = buildSnapshotSpatialIndex(snapshot);

    return (worldX: number, worldY: number): PlayerTileResult | null => {
      const map = spatialIndex.getMapAt(worldX, worldY);
      if (map) {
        const localX = worldX - map.offsetX;
        const localY = worldY - map.offsetY;

        const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
        const pair = tilesetPairs[pairIndex];

        const idx = localY * map.entry.width + localX;
        const mapTile = map.mapData.layout[idx];
        if (!mapTile) return null;
        const metatileId = mapTile.metatileId;
        const { isSecondary, index: attrIndex } = resolveMetatileIndex(metatileId);
        const attrArray = isSecondary
          ? pair.secondaryAttributes
          : pair.primaryAttributes;
        const attributes: MetatileAttributes = attrArray[attrIndex] ?? {
          behavior: 0,
          layerType: 0,
        };

        return { mapTile, attributes };
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
