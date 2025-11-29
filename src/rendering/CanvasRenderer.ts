import type { Palette } from '../utils/mapLoader';
import { TILE_SIZE, TILES_PER_ROW_IN_IMAGE, SECONDARY_TILE_OFFSET } from '../utils/mapLoader';
import { TilesetCanvasCache } from './TilesetCanvasCache';

export interface TileDrawParams {
  tileId: number;
  destX: number;
  destY: number;
  palette: Palette;
  xflip: boolean;
  yflip: boolean;
  source: 'primary' | 'secondary';
}

/**
 * Hardware-accelerated tile renderer using Canvas 2D API
 * 
 * CRITICAL: Must produce IDENTICAL visual output to the original drawTileToImageData
 * 
 * Performance gain: 5-10× faster by using GPU-accelerated drawImage
 * instead of manual pixel manipulation.
 */
export class CanvasRenderer {
  private cache: TilesetCanvasCache;

  constructor() {
    this.cache = new TilesetCanvasCache();
  }

  /**
   * Draw a single 8x8 tile to a canvas context
   *
   * This replaces drawTileToImageData with GPU-accelerated drawImage.
   *
   * Key features preserved from original:
   * - Palette-based color lookup
   * - Transparency (palette index 0)
   * - Horizontal and vertical flipping
   * - Primary vs secondary tileset handling
   *
   * OPTIMIZED: Avoids save()/restore() for non-flipped tiles (majority of cases)
   *
   * @param ctx - Canvas rendering context to draw to
   * @param params - Tile drawing parameters
   * @param primaryTiles - Primary tileset indexed color data
   * @param secondaryTiles - Secondary tileset indexed color data
   */
  drawTile(
    ctx: CanvasRenderingContext2D,
    params: TileDrawParams,
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
   * Clear cache (e.g., on map change or animation frame that invalidates tilesets)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging and performance monitoring)
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}




