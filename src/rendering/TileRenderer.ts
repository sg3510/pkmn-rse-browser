/**
 * TileRenderer - Draws individual tiles to canvas
 *
 * A metatile is 16x16 pixels, composed of 8 tiles (8x8 each):
 * - Layer 0: tiles[0-3] (2x2 grid, bottom layer)
 * - Layer 1: tiles[4-7] (2x2 grid, top layer)
 *
 * This renderer handles:
 * - Tile flipping (horizontal/vertical)
 * - Palette selection (primary vs secondary based on palette index)
 * - Hardware-accelerated rendering via cached palette canvases
 *
 * Reference: pokeemerald/include/fieldmap.h, Porymap metatile format
 */

import { TilesetCanvasCache } from './TilesetCanvasCache';
import { PrerenderedAnimations } from './PrerenderedAnimations';
import {
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  SECONDARY_TILE_OFFSET,
  type Palette,
  type Metatile,
} from '../utils/mapLoader';
import type { TilesetBuffers, TileDrawCall } from './types';

/** Number of palettes in the primary tileset */
const NUM_PALS_IN_PRIMARY = 6;

/**
 * Parameters for drawing a metatile layer
 */
export interface MetatileDrawParams {
  /** The metatile to draw */
  metatile: Metatile;
  /** Screen X position for the metatile */
  screenX: number;
  /** Screen Y position for the metatile */
  screenY: number;
  /** Layer to draw (0 = bottom, 1 = top) */
  layer: 0 | 1;
  /** Patched tile buffers with current animation frame */
  patchedTiles: TilesetBuffers;
  /** Primary tileset palettes */
  primaryPalettes: Palette[];
  /** Secondary tileset palettes */
  secondaryPalettes: Palette[];
  /** Optional: set of animated tile IDs to skip */
  animatedTileIds?: { primary: Set<number>; secondary: Set<number> };
  /** Whether to skip animated tiles */
  skipAnimated?: boolean;
  /** Pre-rendered animation frames (for optimized animated tile rendering) */
  prerenderedAnimations?: PrerenderedAnimations | null;
  /** Current animation cycle count (required if prerenderedAnimations is set) */
  animationCycle?: number;
}

/**
 * TileRenderer - Low-level tile drawing to canvas
 *
 * Uses hardware-accelerated rendering by caching palette-applied
 * tileset canvases and using drawImage for all tile draws.
 */
export class TileRenderer {
  private cache: TilesetCanvasCache;

  constructor(cache: TilesetCanvasCache) {
    this.cache = cache;
  }

  /**
   * Draw one layer (4 tiles) of a metatile
   *
   * @param ctx - Canvas context to draw to
   * @param params - Drawing parameters
   */
  drawMetatileLayer(
    ctx: CanvasRenderingContext2D,
    params: MetatileDrawParams
  ): void {
    const {
      metatile,
      screenX,
      screenY,
      layer,
      patchedTiles,
      primaryPalettes,
      secondaryPalettes,
      animatedTileIds,
      skipAnimated,
      prerenderedAnimations,
      animationCycle = 0,
    } = params;

    for (let i = 0; i < 4; i++) {
      const tileIndex = layer * 4 + i;
      const tile = metatile.tiles[tileIndex];
      if (!tile) continue;

      const tileSource = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';

      // Skip animated tiles if requested
      if (skipAnimated && animatedTileIds) {
        const shouldSkip =
          tileSource === 'primary'
            ? animatedTileIds.primary.has(tile.tileId)
            : animatedTileIds.secondary.has(tile.tileId);
        if (shouldSkip) continue;
      }

      const subX = (i % 2) * TILE_SIZE;
      const subY = Math.floor(i / 2) * TILE_SIZE;

      // CRITICAL: Palette selection matches original pokeemerald logic
      // Choose tileset based on palette index, NOT tile source
      const palette = tile.palette < NUM_PALS_IN_PRIMARY
        ? primaryPalettes[tile.palette]
        : secondaryPalettes[tile.palette];
      if (!palette) continue;

      const destX = screenX + subX;
      const destY = screenY + subY;

      // Try to use pre-rendered animation frames for animated tiles
      if (prerenderedAnimations) {
        const drawn = prerenderedAnimations.drawAnimatedTile(
          ctx,
          tile.tileId,
          tileSource,
          destX,
          destY,
          tile.xflip,
          tile.yflip,
          palette,
          animationCycle
        );
        if (drawn) continue; // Successfully drew from prerendered frame
      }

      // Fall back to normal tile drawing (patched tileset)
      this.drawTile(
        ctx,
        {
          tileId: tile.tileId,
          destX,
          destY,
          palette,
          xflip: tile.xflip,
          yflip: tile.yflip,
          source: tileSource,
          layer,
        },
        patchedTiles.primary,
        patchedTiles.secondary
      );
    }
  }

  /**
   * Draw a single 8x8 tile to canvas
   *
   * This is the core rendering function. It uses the tileset cache
   * to get a pre-rendered canvas with the palette applied, then
   * uses hardware-accelerated drawImage for fast rendering.
   *
   * @param ctx - Canvas context to draw to
   * @param params - Tile drawing parameters
   * @param primaryTiles - Primary tileset indexed color data
   * @param secondaryTiles - Secondary tileset indexed color data
   */
  drawTile(
    ctx: CanvasRenderingContext2D,
    params: TileDrawCall,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ): void {
    const { tileId, destX, destY, palette, xflip, yflip, source } = params;

    // Get the appropriate tileset data
    const tiles = source === 'primary' ? primaryTiles : secondaryTiles;

    // Handle secondary tile offset (tiles 512+ are in secondary tileset)
    const effectiveTileId = source === 'secondary' ? tileId % SECONDARY_TILE_OFFSET : tileId;

    // Get or create palettized canvas for this tileset + palette
    // This is cached, so subsequent calls with the same palette are FAST
    const tilesetCanvas = this.cache.getPalettizedCanvas(
      source,
      tiles,
      palette,
      128, // Width is always 128px (16 tiles * 8px)
      Math.ceil(tiles.length / 128) // Height based on data size
    );

    // Calculate source position in tileset (8x8 tile grid)
    const srcX = (effectiveTileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const srcY = Math.floor(effectiveTileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;

    // OPTIMIZATION: Skip save/restore for non-flipped tiles (vast majority)
    // This saves ~2 expensive canvas state operations per tile
    if (!xflip && !yflip) {
      // Fast path: direct draw without transforms
      ctx.drawImage(
        tilesetCanvas,
        srcX, srcY, TILE_SIZE, TILE_SIZE,
        destX, destY, TILE_SIZE, TILE_SIZE
      );
      return;
    }

    // Slow path: flipped tiles need transforms
    ctx.save();
    ctx.translate(destX, destY);

    const scaleX = xflip ? -1 : 1;
    const scaleY = yflip ? -1 : 1;
    const offsetX = xflip ? -TILE_SIZE : 0;
    const offsetY = yflip ? -TILE_SIZE : 0;

    ctx.scale(scaleX, scaleY);
    ctx.translate(offsetX, offsetY);

    ctx.drawImage(
      tilesetCanvas,
      srcX, srcY, TILE_SIZE, TILE_SIZE,
      0, 0, TILE_SIZE, TILE_SIZE
    );

    ctx.restore();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}
