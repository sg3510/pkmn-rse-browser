/**
 * TileInstanceBuilder - Builds tile instances from map data
 *
 * Converts metatile data into flat arrays of TileInstance objects
 * suitable for WebGL instanced rendering.
 *
 * Handles:
 * - Layer extraction (background layer 0, top layer 1)
 * - Layer type handling (COVERED, NORMAL, SPLIT)
 * - Elevation filtering for top pass splitting
 * - Tile packing for GPU upload
 */

import type { TileInstance } from './types';
import type { WorldCameraView, TileResolverFn, ElevationFilterFn } from '../types';
import type { Metatile } from '../../utils/mapLoader';
import {
  METATILE_SIZE,
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_SPLIT,
} from '../../utils/mapLoader';

/** Tile size in pixels */
const TILE_SIZE = 8;

/** Secondary tileset tile ID offset */
const SECONDARY_TILE_OFFSET = 512;

/**
 * Builder for creating tile instance arrays from map data
 */
export class TileInstanceBuilder {
  // Reusable array to avoid allocation per frame
  private instanceBuffer: TileInstance[] = [];

  /**
   * Build tile instances for the background pass
   *
   * Background includes:
   * - Layer 0 of all metatiles
   * - Layer 1 of COVERED metatiles (always behind sprites)
   *
   * @param view - Camera view defining visible area
   * @param resolveTile - Function to resolve tile data at world coordinates
   * @returns Array of tile instances
   */
  buildBackgroundInstances(
    view: WorldCameraView,
    resolveTile: TileResolverFn
  ): TileInstance[] {
    this.instanceBuffer.length = 0;

    this.forEachVisibleTile(view, (worldX, worldY, screenX, screenY) => {
      const resolved = resolveTile(worldX, worldY);
      if (!resolved?.metatile) return;

      const layerType = resolved.attributes?.layerType ?? METATILE_LAYER_TYPE_COVERED;
      const tilesetPairIndex = resolved.tilesetPairIndex ?? 0;

      // Background: always draw layer 0
      this.addMetatileLayer(resolved.metatile, screenX, screenY, 0, tilesetPairIndex);

      // COVERED: also draw layer 1 in background
      if (layerType === METATILE_LAYER_TYPE_COVERED) {
        this.addMetatileLayer(resolved.metatile, screenX, screenY, 1, tilesetPairIndex);
      }
    });

    return this.instanceBuffer;
  }

  /**
   * Build tile instances for the top layer pass
   *
   * Top layer includes:
   * - Layer 1 of NORMAL and SPLIT metatiles
   * - Filtered by elevation for player above/below splitting
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver
   * @param elevationFilter - Filter function for elevation-based layer splitting
   * @returns Array of tile instances
   */
  buildTopLayerInstances(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    elevationFilter?: ElevationFilterFn
  ): TileInstance[] {
    this.instanceBuffer.length = 0;

    this.forEachVisibleTile(view, (worldX, worldY, screenX, screenY) => {
      const resolved = resolveTile(worldX, worldY);
      if (!resolved?.metatile) return;

      const layerType = resolved.attributes?.layerType ?? METATILE_LAYER_TYPE_COVERED;
      const tilesetPairIndex = resolved.tilesetPairIndex ?? 0;

      // Top pass: only NORMAL and SPLIT have layer 1 here
      if (layerType === METATILE_LAYER_TYPE_COVERED) return;

      // Apply elevation filter if provided
      if (elevationFilter && !elevationFilter(resolved.mapTile, worldX, worldY)) {
        return;
      }

      // Draw layer 1
      if (layerType === METATILE_LAYER_TYPE_NORMAL ||
          layerType === METATILE_LAYER_TYPE_SPLIT) {
        this.addMetatileLayer(resolved.metatile, screenX, screenY, 1, tilesetPairIndex);
      }
    });

    return this.instanceBuffer;
  }

  /**
   * Build all tile instances for a full render (no layer splitting)
   *
   * Useful for simple rendering or debugging.
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver
   * @returns Array of all tile instances
   */
  buildAllInstances(
    view: WorldCameraView,
    resolveTile: TileResolverFn
  ): TileInstance[] {
    this.instanceBuffer.length = 0;

    this.forEachVisibleTile(view, (worldX, worldY, screenX, screenY) => {
      const resolved = resolveTile(worldX, worldY);
      if (!resolved?.metatile) return;

      const tilesetPairIndex = resolved.tilesetPairIndex ?? 0;

      // Draw both layers
      this.addMetatileLayer(resolved.metatile, screenX, screenY, 0, tilesetPairIndex);
      this.addMetatileLayer(resolved.metatile, screenX, screenY, 1, tilesetPairIndex);
    });

    return this.instanceBuffer;
  }

  /**
   * Extract individual tiles from a metatile layer
   *
   * Each metatile layer has 4 tiles (2x2 grid of 8x8 tiles).
   * - Layer 0: tiles[0-3] (background)
   * - Layer 1: tiles[4-7] (foreground)
   *
   * @param metatile - The metatile to extract from
   * @param screenX - Screen X position of metatile
   * @param screenY - Screen Y position of metatile
   * @param layer - Which layer (0 or 1)
   * @param tilesetPairIndex - Which tileset pair (0 or 1) for multi-tileset worlds
   */
  private addMetatileLayer(
    metatile: Metatile,
    screenX: number,
    screenY: number,
    layer: 0 | 1,
    tilesetPairIndex: number = 0
  ): void {
    for (let i = 0; i < 4; i++) {
      const tileIndex = layer * 4 + i;
      const tile = metatile.tiles[tileIndex];
      if (!tile) continue;

      // Calculate position within metatile (2x2 grid of 8x8 tiles)
      const subX = (i % 2) * TILE_SIZE;
      const subY = Math.floor(i / 2) * TILE_SIZE;

      // Determine tileset (primary vs secondary)
      const isSecondary = tile.tileId >= SECONDARY_TILE_OFFSET;
      const tilesetIndex = isSecondary ? 1 : 0;

      // Adjust tile ID for secondary tileset (remove offset)
      const effectiveTileId = isSecondary
        ? tile.tileId - SECONDARY_TILE_OFFSET
        : tile.tileId;

      this.instanceBuffer.push({
        x: screenX + subX,
        y: screenY + subY,
        tileId: effectiveTileId,
        paletteId: tile.palette,
        xflip: tile.xflip,
        yflip: tile.yflip,
        tilesetIndex,
        tilesetPairIndex,
      });
    }
  }

  /**
   * Iterate over all visible tiles in the view
   */
  private forEachVisibleTile(
    view: WorldCameraView,
    callback: (
      worldX: number,
      worldY: number,
      screenX: number,
      screenY: number
    ) => void
  ): void {
    for (let ty = 0; ty < view.tilesHigh; ty++) {
      for (let tx = 0; tx < view.tilesWide; tx++) {
        const worldX = view.worldStartTileX + tx;
        const worldY = view.worldStartTileY + ty;
        const screenX = tx * METATILE_SIZE;
        const screenY = ty * METATILE_SIZE;

        callback(worldX, worldY, screenX, screenY);
      }
    }
  }

  /**
   * Get the current buffer capacity
   */
  getBufferCapacity(): number {
    return this.instanceBuffer.length;
  }

  /**
   * Pre-allocate buffer for expected instance count
   *
   * Reduces allocation during rendering.
   *
   * @param expectedCount - Expected number of instances
   */
  preallocate(expectedCount: number): void {
    if (this.instanceBuffer.length < expectedCount) {
      this.instanceBuffer.length = expectedCount;
    }
  }
}

/**
 * Pack tile instances into a Float32Array for direct GPU upload
 *
 * This is more efficient than using updateInstanceBuffer when
 * you're building instances from scratch each frame.
 *
 * @param tiles - Array of tile instances
 * @returns Float32Array ready for GPU upload
 */
export function packTileInstances(tiles: TileInstance[]): Float32Array {
  const data = new Float32Array(tiles.length * 4);

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const offset = i * 4;

    // Pack flags: yflip(1) | xflip(1) | tilesetIndex(1) | paletteId(4) | tilesetPairIndex(1)
    const flags =
      (tile.yflip ? 1 : 0) |
      (tile.xflip ? 2 : 0) |
      (tile.tilesetIndex << 2) |
      (tile.paletteId << 3) |
      ((tile.tilesetPairIndex ?? 0) << 7);

    data[offset] = tile.x;
    data[offset + 1] = tile.y;
    data[offset + 2] = tile.tileId;
    data[offset + 3] = flags;
  }

  return data;
}
