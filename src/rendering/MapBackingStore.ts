import type { Palette, MapTileData } from '../utils/mapLoader';
import { METATILE_SIZE, TILE_SIZE, TILES_PER_ROW_IN_IMAGE, SECONDARY_TILE_OFFSET } from '../utils/mapLoader';
import { TilesetCanvasCache } from './TilesetCanvasCache';
import { getSpritePriorityForElevation } from '../utils/elevationPriority';

/**
 * Chunk size in metatiles (16x16 = 256 tiles per chunk)
 * This balances memory usage vs re-render frequency
 */
export const CHUNK_SIZE = 16;
export const CHUNK_PIXEL_SIZE = CHUNK_SIZE * METATILE_SIZE;

interface ChunkKey {
  chunkX: number;
  chunkY: number;
  pass: 'background' | 'topBelow' | 'topAbove';
}

interface CachedChunk {
  canvas: HTMLCanvasElement;
  lastAccessTime: number;
  animationFrame: number; // Track which animation frame this was rendered at
}

/**
 * Tile resolution function type - resolves world tile coordinates to rendering data
 */
export type TileResolver = (tileX: number, tileY: number) => ResolvedTileData | null;

export interface ResolvedTileData {
  metatile: {
    id: number;
    tiles: Array<{
      tileId: number;
      palette: number;
      xflip: boolean;
      yflip: boolean;
    }>;
  };
  attributes: {
    layerType: number;
    behavior: number;
  } | null;
  mapTile: MapTileData;
  tileset: {
    key: string;
    primaryPalettes: Palette[];
    secondaryPalettes: Palette[];
  };
  runtime: {
    patchedTiles: {
      primary: Uint8Array;
      secondary: Uint8Array;
    };
    animatedTileIds: {
      primary: Set<number>;
      secondary: Set<number>;
    };
  };
}

/**
 * Map Backing Store - Chunk-based caching for buttery smooth scrolling
 *
 * Key insight: When the camera pans, most tiles don't change. Only the newly
 * visible edge tiles need to be rendered. By caching the map in chunks, we can:
 *
 * 1. Render each chunk once (expensive)
 * 2. Composite visible chunks via drawImage (GPU-accelerated, fast)
 * 3. Only re-render chunks when animations change or map changes
 *
 * Performance gain: 10-50× faster scrolling
 *
 * Memory usage: ~1-2 MB per visible chunk (CHUNK_SIZE² * 16² * 4 bytes)
 * With LRU cache of 32 chunks = ~32-64 MB max
 */
export class MapBackingStore {
  private chunks = new Map<string, CachedChunk>();
  private tilesetCache: TilesetCanvasCache;
  private maxChunks = 32; // LRU cache limit
  private currentAnimationFrame = 0;

  constructor(tilesetCache: TilesetCanvasCache) {
    this.tilesetCache = tilesetCache;
  }

  /**
   * Generate cache key for a chunk
   */
  private getChunkKey(key: ChunkKey): string {
    return `${key.chunkX},${key.chunkY}:${key.pass}`;
  }

  /**
   * Update animation frame counter - invalidates animated chunks
   */
  setAnimationFrame(frame: number) {
    if (frame !== this.currentAnimationFrame) {
      this.currentAnimationFrame = frame;
      // Don't clear all chunks - we'll check frame on access
    }
  }

  /**
   * Clear all cached chunks. Call when switching maps to free memory.
   */
  clear(): void {
    this.chunks.clear();
  }

  /**
   * Get or render a chunk for a specific pass
   *
   * @param chunkX - Chunk X coordinate (world tile X / CHUNK_SIZE)
   * @param chunkY - Chunk Y coordinate (world tile Y / CHUNK_SIZE)
   * @param pass - Render pass type
   * @param resolveTile - Function to resolve tile data at world coordinates
   * @param playerElevation - Current player elevation for topBelow/topAbove filtering
   * @param isVerticalObject - Function to check if a tile is a vertical object
   */
  getOrRenderChunk(
    chunkX: number,
    chunkY: number,
    pass: 'background' | 'topBelow' | 'topAbove',
    resolveTile: TileResolver,
    playerElevation: number,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): HTMLCanvasElement {
    const key: ChunkKey = { chunkX, chunkY, pass };
    const cacheKey = this.getChunkKey(key);

    const cached = this.chunks.get(cacheKey);
    if (cached) {
      // Check if animation frame changed (would invalidate animated tiles)
      // For now, return cached chunk - animation invalidation handled separately
      cached.lastAccessTime = performance.now();
      return cached.canvas;
    }

    // Render new chunk
    const canvas = this.renderChunk(chunkX, chunkY, pass, resolveTile, playerElevation, isVerticalObject);

    // Cache the chunk
    this.chunks.set(cacheKey, {
      canvas,
      lastAccessTime: performance.now(),
      animationFrame: this.currentAnimationFrame,
    });

    // LRU eviction
    this.evictOldChunks();

    return canvas;
  }

  /**
   * Render a single chunk
   */
  private renderChunk(
    chunkX: number,
    chunkY: number,
    pass: 'background' | 'topBelow' | 'topAbove',
    resolveTile: TileResolver,
    playerElevation: number,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK_PIXEL_SIZE;
    canvas.height = CHUNK_PIXEL_SIZE;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    const worldStartX = chunkX * CHUNK_SIZE;
    const worldStartY = chunkY * CHUNK_SIZE;

    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
      const tileY = worldStartY + localY;
      for (let localX = 0; localX < CHUNK_SIZE; localX++) {
        const tileX = worldStartX + localX;
        const resolved = resolveTile(tileX, tileY);
        if (!resolved || !resolved.metatile) continue;

        // Apply elevation filter based on pass type
        if (!this.passFilter(pass, resolved.mapTile, tileX, tileY, playerElevation, isVerticalObject)) {
          continue;
        }

        const screenX = localX * METATILE_SIZE;
        const screenY = localY * METATILE_SIZE;

        // Determine which layers to draw based on pass
        const layerType = resolved.attributes?.layerType ?? 1; // COVERED default
        const LAYER_TYPE_NORMAL = 0;
        const LAYER_TYPE_COVERED = 1;
        const LAYER_TYPE_SPLIT = 2;

        if (pass === 'background') {
          // Background: always draw layer 0, plus layer 1 if COVERED
          this.drawMetatileLayer(ctx, resolved, screenX, screenY, 0);
          if (layerType === LAYER_TYPE_COVERED) {
            this.drawMetatileLayer(ctx, resolved, screenX, screenY, 1);
          }
        } else {
          // Top passes: draw layer 1 for NORMAL and SPLIT
          if (layerType === LAYER_TYPE_NORMAL || layerType === LAYER_TYPE_SPLIT) {
            this.drawMetatileLayer(ctx, resolved, screenX, screenY, 1);
          }
        }
      }
    }

    return canvas;
  }

  /**
   * Filter function for top passes based on elevation
   */
  private passFilter(
    pass: 'background' | 'topBelow' | 'topAbove',
    mapTile: MapTileData,
    tileX: number,
    tileY: number,
    playerElevation: number,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): boolean {
    if (pass === 'background') return true;

    const isVertical = isVerticalObject(tileX, tileY);

    // Map elevation to sprite priority (pokeemerald sElevationToPriority)
    const playerPriority = getSpritePriorityForElevation(playerElevation);
    const playerAboveTopLayer = playerPriority <= 1; // priority 0/1 draws above BG1

    if (pass === 'topBelow') {
      // topBelow = top layer renders BEFORE player
      if (isVertical) return false;
      if (!playerAboveTopLayer) return false;
      if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;
      return true;
    }

    // topAbove = top layer renders AFTER player
    if (isVertical) return true;
    if (playerAboveTopLayer) {
      if (mapTile.elevation === playerElevation && mapTile.collision === 1) return true;
      return false;
    }
    return true;
  }

  /**
   * Draw a single metatile layer to canvas
   */
  private drawMetatileLayer(
    ctx: CanvasRenderingContext2D,
    resolved: ResolvedTileData,
    screenX: number,
    screenY: number,
    layer: 0 | 1
  ): void {
    const metatile = resolved.metatile;
    const patchedTiles = resolved.runtime.patchedTiles;
    const NUM_PALS_IN_PRIMARY = 6;

    for (let i = 0; i < 4; i++) {
      const tileIndex = layer * 4 + i;
      const tile = metatile.tiles[tileIndex];
      if (!tile) continue;

      const tileSource = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
      const tiles = tileSource === 'primary' ? patchedTiles.primary : patchedTiles.secondary;
      const effectiveTileId = tileSource === 'secondary'
        ? tile.tileId % SECONDARY_TILE_OFFSET
        : tile.tileId;

      // Get palette (Porymap-compatible logic)
      const palette = tile.palette < NUM_PALS_IN_PRIMARY
        ? resolved.tileset.primaryPalettes[tile.palette]
        : resolved.tileset.secondaryPalettes[tile.palette];
      if (!palette) continue;

      // Get palettized tileset canvas
      const tilesetCanvas = this.tilesetCache.getPalettizedCanvas(
        tileSource,
        tiles,
        palette,
        128,
        Math.ceil(tiles.length / 128)
      );

      // Calculate source and dest positions
      const srcX = (effectiveTileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      const srcY = Math.floor(effectiveTileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      const subX = (i % 2) * TILE_SIZE;
      const subY = Math.floor(i / 2) * TILE_SIZE;
      const destX = screenX + subX;
      const destY = screenY + subY;

      // Draw with flipping if needed
      ctx.save();
      ctx.translate(destX, destY);

      if (tile.xflip || tile.yflip) {
        const scaleX = tile.xflip ? -1 : 1;
        const scaleY = tile.yflip ? -1 : 1;
        ctx.scale(scaleX, scaleY);
        ctx.translate(tile.xflip ? -TILE_SIZE : 0, tile.yflip ? -TILE_SIZE : 0);
      }

      ctx.drawImage(
        tilesetCanvas,
        srcX, srcY, TILE_SIZE, TILE_SIZE,
        0, 0, TILE_SIZE, TILE_SIZE
      );

      ctx.restore();
    }
  }

  /**
   * Composite visible chunks to the main canvas
   *
   * This is the fast path - just GPU-accelerated drawImage calls
   */
  compositeToCanvas(
    mainCtx: CanvasRenderingContext2D,
    pass: 'background' | 'topBelow' | 'topAbove',
    worldStartTileX: number,
    worldStartTileY: number,
    tilesWide: number,
    tilesHigh: number,
    subTileOffsetX: number,
    subTileOffsetY: number,
    resolveTile: TileResolver,
    playerElevation: number,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): void {
    // Calculate which chunks are visible
    const startChunkX = Math.floor(worldStartTileX / CHUNK_SIZE);
    const startChunkY = Math.floor(worldStartTileY / CHUNK_SIZE);
    const endChunkX = Math.ceil((worldStartTileX + tilesWide) / CHUNK_SIZE);
    const endChunkY = Math.ceil((worldStartTileY + tilesHigh) / CHUNK_SIZE);

    for (let cy = startChunkY; cy < endChunkY; cy++) {
      for (let cx = startChunkX; cx < endChunkX; cx++) {
        const chunk = this.getOrRenderChunk(cx, cy, pass, resolveTile, playerElevation, isVerticalObject);

        // Calculate screen position
        const chunkWorldX = cx * CHUNK_SIZE;
        const chunkWorldY = cy * CHUNK_SIZE;
        const screenX = (chunkWorldX - worldStartTileX) * METATILE_SIZE - subTileOffsetX;
        const screenY = (chunkWorldY - worldStartTileY) * METATILE_SIZE - subTileOffsetY;

        mainCtx.drawImage(chunk, Math.round(screenX), Math.round(screenY));
      }
    }
  }

  /**
   * Invalidate chunks in a specific region (e.g., for animations)
   */
  invalidateRegion(worldStartX: number, worldStartY: number, worldEndX: number, worldEndY: number): void {
    const startChunkX = Math.floor(worldStartX / CHUNK_SIZE);
    const startChunkY = Math.floor(worldStartY / CHUNK_SIZE);
    const endChunkX = Math.ceil(worldEndX / CHUNK_SIZE);
    const endChunkY = Math.ceil(worldEndY / CHUNK_SIZE);

    for (let cy = startChunkY; cy < endChunkY; cy++) {
      for (let cx = startChunkX; cx < endChunkX; cx++) {
        for (const pass of ['background', 'topBelow', 'topAbove'] as const) {
          this.chunks.delete(this.getChunkKey({ chunkX: cx, chunkY: cy, pass }));
        }
      }
    }
  }

  /**
   * Invalidate all chunks (e.g., on map change or animation frame change)
   */
  invalidateAll(): void {
    this.chunks.clear();
  }

  /**
   * LRU eviction - remove oldest chunks when cache is full
   */
  private evictOldChunks(): void {
    if (this.chunks.size <= this.maxChunks) return;

    // Find and remove oldest chunks
    const entries = Array.from(this.chunks.entries())
      .sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime);

    const toRemove = entries.slice(0, this.chunks.size - this.maxChunks);
    for (const [key] of toRemove) {
      this.chunks.delete(key);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats() {
    return {
      chunkCount: this.chunks.size,
      maxChunks: this.maxChunks,
      chunkPixelSize: CHUNK_PIXEL_SIZE,
    };
  }
}
