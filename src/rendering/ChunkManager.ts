import { METATILE_SIZE } from '../utils/mapLoader';

// Debug options that can be set from DebugPanel
export interface ChunkDebugOptions {
  showBorders: boolean;
  logOperations: boolean;
}

const DEFAULT_DEBUG_OPTIONS: ChunkDebugOptions = {
  showBorders: false,
  logOperations: false,
};

// Global debug options (set by DebugPanel)
let chunkDebugOptions: ChunkDebugOptions = { ...DEFAULT_DEBUG_OPTIONS };

export const setChunkDebugOptions = (options: Partial<ChunkDebugOptions>) => {
  chunkDebugOptions = { ...chunkDebugOptions, ...options };
};

export const getChunkDebugOptions = () => chunkDebugOptions;

// Chunk statistics for debugging
export interface ChunkStats {
  visibleChunks: number;
  cachedChunks: number;
  cacheHits: number;
  cacheMisses: number;
  lastExtraHash: string;
  visibleChunkKeys: string[];
  recentMisses: string[];  // Last N cache misses
  // World bounds info (set externally)
  worldBounds?: { minX: number; minY: number; maxX: number; maxY: number };
  loadedMapCount?: number;
  // Detailed map info (set externally)
  loadedMaps?: Array<{ id: string; offsetX: number; offsetY: number; width: number; height: number }>;
}

const MAX_RECENT_MISSES = 10;

// Minimal view shape consumed by the chunk manager. Structural typing allows
// passing the fuller WorldCameraView used elsewhere.
export interface ChunkCameraView {
  cameraWorldX: number;
  cameraWorldY: number;
  pixelWidth: number;
  pixelHeight: number;
}

const CHUNK_SIZE_TILES = 16;
const CHUNK_SIZE_PX = CHUNK_SIZE_TILES * METATILE_SIZE; // 256px
// Raised cache budget to reduce evictions during scrolling; ~120 chunks ≈ 28–30MB at 256x256x4 bytes.
const MAX_CACHE_SIZE = 120;

export interface RenderRegion {
  startTileX: number;
  startTileY: number;
  width: number;
  height: number;
}

export type ChunkRenderCallback = (
  ctx: CanvasRenderingContext2D,
  region: RenderRegion
) => void;

export class ChunkManager {
  private cache = new Map<string, HTMLCanvasElement>();
  private accessHistory: string[] = [];

  // Statistics tracking
  private stats: ChunkStats = {
    visibleChunks: 0,
    cachedChunks: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastExtraHash: '',
    visibleChunkKeys: [],
    recentMisses: [],
  };

  private getCacheKey(chunkX: number, chunkY: number, layer: string, extraHash: string): string {
    return `${chunkX}:${chunkY}:${layer}:${extraHash}`;
  }

  /**
   * Get current chunk statistics for debugging
   */
  getStats(): ChunkStats {
    return {
      ...this.stats,
      cachedChunks: this.cache.size,
    };
  }

  /**
   * Reset hit/miss counters (call at start of frame)
   */
  resetFrameStats() {
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
    this.stats.visibleChunkKeys = [];
  }

  /**
   * Draw the world using cached chunks.
   * 
   * @param ctx - Destination canvas context
   * @param view - Current camera view (provides cameraWorldX/Y)
   * @param layer - Layer identifier (e.g., "bg", "top_below", "top_above")
   * @param extraHash - String representing changing state (animation frame, player elevation)
   * @param renderCallback - Function to call if a chunk needs to be rendered
   */
  drawLayer(
    ctx: CanvasRenderingContext2D,
    view: ChunkCameraView,
    layer: string,
    extraHash: string,
    renderCallback: ChunkRenderCallback,
    prewarmPadding: number = 1
  ) {
    // Track extraHash for debugging
    this.stats.lastExtraHash = extraHash;

    // Calculate visible chunks
    // cameraWorldX is the left-most pixel visible
    const startChunkX = Math.floor(view.cameraWorldX / CHUNK_SIZE_PX);
    const startChunkY = Math.floor(view.cameraWorldY / CHUNK_SIZE_PX);

    // Determine how many chunks cover the viewport
    // We add 1 extra to handle partial coverage at the edges
    const endChunkX = Math.floor((view.cameraWorldX + view.pixelWidth) / CHUNK_SIZE_PX) + 1;
    const endChunkY = Math.floor((view.cameraWorldY + view.pixelHeight) / CHUNK_SIZE_PX) + 1;

    // Count visible chunks
    let visibleCount = 0;

    for (let cy = startChunkY; cy <= endChunkY; cy++) {
      for (let cx = startChunkX; cx <= endChunkX; cx++) {
        this.drawChunk(ctx, cx, cy, view, layer, extraHash, renderCallback);
        visibleCount++;
      }
    }

    this.stats.visibleChunks = visibleCount;

    // Prewarm a small ring of chunks around the viewport to avoid hitching when stepping across boundaries.
    if (prewarmPadding > 0) {
      for (let cy = startChunkY - prewarmPadding; cy <= endChunkY + prewarmPadding; cy++) {
        for (let cx = startChunkX - prewarmPadding; cx <= endChunkX + prewarmPadding; cx++) {
          const isAlreadyDrawn = cy >= startChunkY && cy <= endChunkY && cx >= startChunkX && cx <= endChunkX;
          if (isAlreadyDrawn) continue;
          this.ensureChunkCached(cx, cy, layer, extraHash, renderCallback);
        }
      }
    }

    this.pruneCache();
  }

  private ensureChunkCached(
    cx: number,
    cy: number,
    layer: string,
    extraHash: string,
    renderCallback: ChunkRenderCallback,
    isVisible: boolean = false
  ): HTMLCanvasElement {
    const key = this.getCacheKey(cx, cy, layer, extraHash);
    let canvas = this.cache.get(key);
    if (!canvas) {
      // Cache miss - need to render
      this.stats.cacheMisses++;

      // Track recent misses for debugging
      this.stats.recentMisses.push(`${key} @ ${Date.now() % 100000}`);
      if (this.stats.recentMisses.length > MAX_RECENT_MISSES) {
        this.stats.recentMisses.shift();
      }

      canvas = document.createElement('canvas');
      canvas.width = CHUNK_SIZE_PX;
      canvas.height = CHUNK_SIZE_PX;
      const chunkCtx = canvas.getContext('2d', { alpha: true });
      if (chunkCtx) {
        renderCallback(chunkCtx, {
          startTileX: cx * CHUNK_SIZE_TILES,
          startTileY: cy * CHUNK_SIZE_TILES,
          width: CHUNK_SIZE_TILES,
          height: CHUNK_SIZE_TILES
        });
      }
      this.cache.set(key, canvas);
      if (chunkDebugOptions.logOperations) {
        console.log(`[CHUNK MISS] Creating ${key} (visible: ${isVisible})`);
      }
    } else {
      // Cache hit
      this.stats.cacheHits++;
    }

    // Track visible chunk keys
    if (isVisible) {
      this.stats.visibleChunkKeys.push(key);
    }

    this.updateAccess(key);
    return canvas;
  }

  private drawChunk(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    view: ChunkCameraView,
    layer: string,
    extraHash: string,
    renderCallback: ChunkRenderCallback
  ) {
    const canvas = this.ensureChunkCached(cx, cy, layer, extraHash, renderCallback, true);

    // Calculate screen position
    // Precise math: Chunk Origin (World Px) - Camera Origin (World Px)
    const chunkWorldX = cx * CHUNK_SIZE_PX;
    const chunkWorldY = cy * CHUNK_SIZE_PX;

    // Round to integers to prevent sub-pixel rendering artifacts (white lines between chunks)
    const destX = Math.round(chunkWorldX - view.cameraWorldX);
    const destY = Math.round(chunkWorldY - view.cameraWorldY);

    // Debug log if enabled
    if (chunkDebugOptions.logOperations && Math.random() < 0.01) {
      console.log(`[CHUNK DEBUG] cx:${cx} cy:${cy} worldX:${chunkWorldX} destX:${destX} camX:${view.cameraWorldX.toFixed(2)}`);
    }

    // Disable image smoothing to prevent anti-aliasing artifacts at chunk edges
    ctx.imageSmoothingEnabled = false;

    // We assume context is already cleared or we are drawing over
    ctx.drawImage(canvas, destX, destY);

    // Draw debug outline if enabled
    if (chunkDebugOptions.showBorders) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(destX + 0.5, destY + 0.5, CHUNK_SIZE_PX - 1, CHUNK_SIZE_PX - 1);
      // Draw chunk coordinates
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.font = '10px monospace';
      ctx.fillText(`${cx},${cy}`, destX + 4, destY + 12);
    }
  }

  private updateAccess(key: string) {
    // Remove if exists
    const idx = this.accessHistory.indexOf(key);
    if (idx !== -1) {
      this.accessHistory.splice(idx, 1);
    }
    // Push to end (most recently used)
    this.accessHistory.push(key);
  }

  private pruneCache() {
    if (this.cache.size <= MAX_CACHE_SIZE) return;

    while (this.cache.size > MAX_CACHE_SIZE) {
      const lruKey = this.accessHistory.shift(); // Remove least recently used
      if (lruKey) {
        this.cache.delete(lruKey);
      } else {
        break; // Should not happen
      }
    }
  }

  /**
   * Invalidate cached chunks around a world position (in pixels).
   * This avoids clearing the entire cache when crossing map boundaries.
   */
  invalidateAround(worldX: number, worldY: number, radiusChunks: number = 2) {
    const centerChunkX = Math.floor(worldX / CHUNK_SIZE_PX);
    const centerChunkY = Math.floor(worldY / CHUNK_SIZE_PX);
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      const [cxStr, cyStr] = key.split(':');
      const cx = Number(cxStr);
      const cy = Number(cyStr);
      if (
        Number.isFinite(cx) &&
        Number.isFinite(cy) &&
        Math.abs(cx - centerChunkX) <= radiusChunks &&
        Math.abs(cy - centerChunkY) <= radiusChunks
      ) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length === 0) return;

    for (const key of keysToDelete) {
      this.cache.delete(key);
      const idx = this.accessHistory.indexOf(key);
      if (idx !== -1) {
        this.accessHistory.splice(idx, 1);
      }
    }

    if (chunkDebugOptions.logOperations) {
      console.log(
        `[CHUNK] Invalidated ${keysToDelete.length} chunks around (${centerChunkX},${centerChunkY}) radius ${radiusChunks}`
      );
    }
  }

  /**
   * Clear all caches (useful when map changes)
   */
  clear() {
    this.cache.clear();
    this.accessHistory = [];
  }
}
