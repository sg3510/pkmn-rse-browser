import type { Palette } from '../utils/mapLoader';

/**
 * Pre-rendered canvas for a tileset with a specific palette applied
 *
 * This cache system converts indexed color tilesets into RGB canvases
 * with specific palettes applied, enabling hardware-accelerated rendering.
 */
export class TilesetCanvasCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private accessOrder: string[] = []; // LRU tracking
  private maxCacheSize = 64; // Limit memory usage (~8 MB)

  // OPTIMIZATION: Cache tileset hashes to avoid recalculating
  // Key = Uint8Array reference (uses WeakMap for auto-cleanup)
  private tilesetHashCache = new WeakMap<Uint8Array, string>();
  // Palette hash cache (palettes are usually stable objects)
  private paletteHashCache = new WeakMap<Palette, string>();

  /**
   * Generate cache key string
   */
  private getCacheKey(
    tilesetId: string,
    tilesetDataHash: string,
    paletteHash: string
  ): string {
    return `${tilesetId}:${tilesetDataHash}:${paletteHash}`;
  }

  /**
   * Generate a simple hash for Uint8Array (for cache invalidation)
   *
   * OPTIMIZED: Caches hash results to avoid recalculating every frame
   * Uses WeakMap so hashes are garbage collected when tilesets change
   */
  private hashTilesetData(data: Uint8Array): string {
    // Check cache first
    const cached = this.tilesetHashCache.get(data);
    if (cached !== undefined) {
      return cached;
    }

    // Calculate hash - samples every 1000th byte
    let hash = data.length;
    for (let i = 0; i < data.length; i += 1000) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    const result = hash.toString(36);

    // Cache for future calls
    this.tilesetHashCache.set(data, result);
    return result;
  }

  /**
   * Generate hash for palette (for cache invalidation)
   *
   * OPTIMIZED: Caches hash results
   */
  private hashPalette(palette: Palette): string {
    // Check cache first
    const cached = this.paletteHashCache.get(palette);
    if (cached !== undefined) {
      return cached;
    }

    const result = palette.colors.join(',');
    this.paletteHashCache.set(palette, result);
    return result;
  }

  /**
   * Render a tileset with a specific palette applied
   * 
   * CRITICAL: This must produce IDENTICAL output to the original drawTileToImageData
   * 
   * @param tilesetId - Identifier for the tileset ("primary" or "secondary")
   * @param indexedTiles - 4bpp indexed color data (128px wide)
   * @param palette - 16 colors (palette.colors[0] = transparent)
   * @param width - Tileset width in pixels (always 128)
   * @param height - Tileset height in pixels (variable)
   * @returns Canvas with palette applied, ready for drawImage calls
   */
  getPalettizedCanvas(
    tilesetId: string,
    indexedTiles: Uint8Array,
    palette: Palette,
    width: number,
    height: number
  ): HTMLCanvasElement {
    const tilesetHash = this.hashTilesetData(indexedTiles);
    const paletteHash = this.hashPalette(palette);
    const cacheKey = this.getCacheKey(tilesetId, tilesetHash, paletteHash);

    // Return cached canvas if available (with LRU touch)
    if (this.cache.has(cacheKey)) {
      this.touchCacheEntry(cacheKey);
      return this.cache.get(cacheKey)!;
    }

    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { 
      alpha: true,
      willReadFrequently: false // Performance hint: we won't read pixels back
    })!;

    // Create ImageData buffer
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Pre-parse palette colors to RGB arrays (avoid repeated parseInt in loop)
    // This optimization is CRITICAL for performance
    const paletteRGB = new Uint8Array(16 * 3);
    for (let i = 0; i < 16; i++) {
      const hex = palette.colors[i];
      if (hex) {
        paletteRGB[i * 3] = parseInt(hex.slice(1, 3), 16);      // R
        paletteRGB[i * 3 + 1] = parseInt(hex.slice(3, 5), 16);  // G
        paletteRGB[i * 3 + 2] = parseInt(hex.slice(5, 7), 16);  // B
      }
    }

    // Apply palette to indexed tiles
    // This is the ONLY place where software rendering happens (one-time per palette)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const paletteIndex = indexedTiles[y * width + x];
        const pixelIndex = (y * width + x) * 4;

        if (paletteIndex === 0) {
          // Transparent pixel (RGBA = 0,0,0,0)
          // This matches the original behavior: palette index 0 = skip pixel
          data[pixelIndex + 3] = 0;
        } else {
          // Opaque pixel - copy RGB from pre-parsed palette
          data[pixelIndex] = paletteRGB[paletteIndex * 3];
          data[pixelIndex + 1] = paletteRGB[paletteIndex * 3 + 1];
          data[pixelIndex + 2] = paletteRGB[paletteIndex * 3 + 2];
          data[pixelIndex + 3] = 255;
        }
      }
    }

    // Put pixels to canvas (one-time operation)
    // After this, all subsequent draws use GPU-accelerated drawImage
    ctx.putImageData(imageData, 0, 0);

    // Cache the result with proper LRU tracking
    this.cache.set(cacheKey, canvas);
    this.accessOrder.push(cacheKey);

    // Evict oldest entries if cache is too large (proper LRU)
    while (this.cache.size > this.maxCacheSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    return canvas;
  }

  /**
   * Touch a cache entry to mark it as recently used
   */
  private touchCacheEntry(cacheKey: string): void {
    const idx = this.accessOrder.indexOf(cacheKey);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(cacheKey);
  }

  /**
   * Clear entire cache (e.g., on map change)
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics (for debugging)
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }
}







