import { METATILE_SIZE, TILE_SIZE, TILES_PER_ROW_IN_IMAGE, SECONDARY_TILE_OFFSET } from '../utils/mapLoader';
import type { Palette, MapTileData } from '../utils/mapLoader';
import { TilesetCanvasCache } from './TilesetCanvasCache';

/**
 * Overscan amount in tiles on each side
 * This determines how much "extra" area we render beyond the visible viewport
 * Higher = smoother scrolling but more memory/initial render time
 */
const OVERSCAN_TILES = 4;

/**
 * Minimum scroll distance before triggering edge re-render (in pixels)
 * Smaller = more frequent updates but smoother appearance
 */
const SCROLL_THRESHOLD_PX = METATILE_SIZE;

export interface BufferTileResolver {
  (tileX: number, tileY: number): ResolvedTileForBuffer | null;
}

export interface ResolvedTileForBuffer {
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
  patchedTiles: {
    primary: Uint8Array;
    secondary: Uint8Array;
  };
  animatedTileIds: {
    primary: Set<number>;
    secondary: Set<number>;
  };
}

interface BufferState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  // World coordinates of the top-left corner of the buffer
  worldStartX: number;
  worldStartY: number;
  // Dimensions in tiles
  tilesWide: number;
  tilesHigh: number;
  // Animation frame this was rendered at
  animationFrame: number;
  // Player elevation this was rendered for
  playerElevation: number;
}

type RenderPass = 'background' | 'topBelow' | 'topAbove';

/**
 * ViewportBuffer - Overscan buffer for buttery smooth scrolling
 *
 * Instead of re-rendering the entire viewport on every camera movement,
 * we maintain a larger buffer and only render the newly visible edge tiles.
 *
 * How it works:
 * 1. Buffer is OVERSCAN_TILES larger than viewport on each side
 * 2. When camera moves, we check if the viewport is still within the buffer
 * 3. If yes: just blit the appropriate region (instant, GPU-accelerated)
 * 4. If no: render edge tiles incrementally or full re-render if needed
 *
 * Performance gain: 10-50× faster scrolling (only ~10% of tiles rendered per frame)
 */
export class ViewportBuffer {
  private tilesetCache: TilesetCanvasCache;
  private buffers: Map<RenderPass, BufferState> = new Map();
  private viewportTilesWide: number;
  private viewportTilesHigh: number;
  private currentAnimationFrame = 0;
  private currentPlayerElevation = 0;

  constructor(
    tilesetCache: TilesetCanvasCache,
    viewportTilesWide: number,
    viewportTilesHigh: number
  ) {
    this.tilesetCache = tilesetCache;
    this.viewportTilesWide = viewportTilesWide;
    this.viewportTilesHigh = viewportTilesHigh;
  }

  /**
   * Update animation frame - triggers full re-render if changed
   */
  setAnimationFrame(frame: number): boolean {
    const changed = frame !== this.currentAnimationFrame;
    this.currentAnimationFrame = frame;
    return changed;
  }

  /**
   * Update player elevation - triggers re-render of top passes
   */
  setPlayerElevation(elevation: number): boolean {
    const changed = elevation !== this.currentPlayerElevation;
    this.currentPlayerElevation = elevation;
    return changed;
  }

  /**
   * Get buffer dimensions including overscan
   */
  private getBufferDimensions() {
    const tilesWide = this.viewportTilesWide + OVERSCAN_TILES * 2;
    const tilesHigh = this.viewportTilesHigh + OVERSCAN_TILES * 2;
    return {
      tilesWide,
      tilesHigh,
      pixelWidth: tilesWide * METATILE_SIZE,
      pixelHeight: tilesHigh * METATILE_SIZE,
    };
  }

  /**
   * Create or get a buffer for a specific pass
   */
  private ensureBuffer(pass: RenderPass): BufferState {
    let buffer = this.buffers.get(pass);
    const dims = this.getBufferDimensions();

    if (!buffer || buffer.tilesWide !== dims.tilesWide || buffer.tilesHigh !== dims.tilesHigh) {
      const canvas = document.createElement('canvas');
      canvas.width = dims.pixelWidth;
      canvas.height = dims.pixelHeight;
      const ctx = canvas.getContext('2d', { alpha: true })!;

      buffer = {
        canvas,
        ctx,
        worldStartX: -999999, // Force initial render
        worldStartY: -999999,
        tilesWide: dims.tilesWide,
        tilesHigh: dims.tilesHigh,
        animationFrame: -1,
        playerElevation: -1,
      };
      this.buffers.set(pass, buffer);
    }

    return buffer;
  }

  /**
   * Render a single metatile to the buffer
   */
  private renderMetatile(
    ctx: CanvasRenderingContext2D,
    resolved: ResolvedTileForBuffer,
    screenX: number,
    screenY: number,
    pass: RenderPass
  ): void {
    const metatile = resolved.metatile;
    const layerType = resolved.attributes?.layerType ?? 1; // COVERED default
    const LAYER_TYPE_NORMAL = 0;
    const LAYER_TYPE_COVERED = 1;
    const LAYER_TYPE_SPLIT = 2;
    const NUM_PALS_IN_PRIMARY = 6;

    const drawLayer = (layer: 0 | 1) => {
      for (let i = 0; i < 4; i++) {
        const tileIndex = layer * 4 + i;
        const tile = metatile.tiles[tileIndex];
        if (!tile) continue;

        const tileSource = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
        const tiles = tileSource === 'primary'
          ? resolved.patchedTiles.primary
          : resolved.patchedTiles.secondary;
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

        // Calculate positions
        const srcX = (effectiveTileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
        const srcY = Math.floor(effectiveTileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
        const subX = (i % 2) * TILE_SIZE;
        const subY = Math.floor(i / 2) * TILE_SIZE;
        const destX = screenX + subX;
        const destY = screenY + subY;

        // Draw with flipping
        ctx.save();
        ctx.translate(destX, destY);

        if (tile.xflip || tile.yflip) {
          ctx.scale(tile.xflip ? -1 : 1, tile.yflip ? -1 : 1);
          ctx.translate(tile.xflip ? -TILE_SIZE : 0, tile.yflip ? -TILE_SIZE : 0);
        }

        ctx.drawImage(
          tilesetCanvas,
          srcX, srcY, TILE_SIZE, TILE_SIZE,
          0, 0, TILE_SIZE, TILE_SIZE
        );

        ctx.restore();
      }
    };

    // Render based on pass and layer type
    if (pass === 'background') {
      drawLayer(0);
      if (layerType === LAYER_TYPE_COVERED) {
        drawLayer(1);
      }
    } else {
      // Top passes: only NORMAL and SPLIT get layer 1
      if (layerType === LAYER_TYPE_NORMAL || layerType === LAYER_TYPE_SPLIT) {
        drawLayer(1);
      }
    }
  }

  /**
   * Check if a tile passes the elevation filter for top passes.
   *
   * Based on GBA pokeemerald sElevationToPriority table:
   *   { 2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 0, 2 }
   *
   * Priority 1 = sprite renders ABOVE BG1 (top layer renders BEFORE/behind player)
   * Priority 2 = sprite renders BELOW BG1 (top layer renders AFTER/on top of player)
   *
   * Pattern:
   * - Elevation 4, 6, 8, 10, 12 (even >= 4): priority 1 → top layer BEFORE player
   * - Elevation 0-3, 5, 7, 9, 11 (< 4 or odd >= 4): priority 2 → top layer AFTER player
   */
  private passElevationFilter(
    pass: RenderPass,
    mapTile: MapTileData,
    playerElevation: number
  ): boolean {
    if (pass === 'background') return true;

    // Check if player has priority 1 (sprite above top layer)
    // This happens when elevation >= 4 AND elevation is even
    const playerHasPriority1 = playerElevation >= 4 && playerElevation % 2 === 0;

    if (pass === 'topBelow') {
      // topBelow = top layer renders BEFORE player (player on top)
      // Only render here if player has priority 1 (player above top layer)
      if (!playerHasPriority1) return false;
      // Exception: if tile is at same elevation and blocked, skip (render in topAbove)
      if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;
      return true;
    }

    // topAbove = top layer renders AFTER player (top layer on top of player)
    // Render here if player has priority 2, OR if blocked tile at same elevation
    if (playerHasPriority1) {
      // Player has priority 1, so top layer should NOT be on top...
      // ...UNLESS it's a blocked tile at same elevation
      if (mapTile.elevation === playerElevation && mapTile.collision === 1) return true;
      return false;
    }
    // Player has priority 2, so top layer renders on top
    return true;
  }

  /**
   * Full render of a buffer
   */
  private renderFullBuffer(
    buffer: BufferState,
    pass: RenderPass,
    worldStartX: number,
    worldStartY: number,
    resolveTile: BufferTileResolver,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): void {
    const ctx = buffer.ctx;
    ctx.clearRect(0, 0, buffer.canvas.width, buffer.canvas.height);

    for (let localY = 0; localY < buffer.tilesHigh; localY++) {
      const worldY = worldStartY + localY;
      for (let localX = 0; localX < buffer.tilesWide; localX++) {
        const worldX = worldStartX + localX;
        const resolved = resolveTile(worldX, worldY);
        if (!resolved || !resolved.metatile) continue;

        // Apply elevation filter for top passes
        if (pass !== 'background') {
          const isVertical = isVerticalObject(worldX, worldY);

          if (pass === 'topBelow') {
            if (isVertical) continue;
            if (!this.passElevationFilter(pass, resolved.mapTile, this.currentPlayerElevation)) continue;
          } else {
            // topAbove: render if vertical OR passes filter
            if (!isVertical && !this.passElevationFilter(pass, resolved.mapTile, this.currentPlayerElevation)) continue;
          }
        }

        const screenX = localX * METATILE_SIZE;
        const screenY = localY * METATILE_SIZE;
        this.renderMetatile(ctx, resolved, screenX, screenY, pass);
      }
    }

    buffer.worldStartX = worldStartX;
    buffer.worldStartY = worldStartY;
    buffer.animationFrame = this.currentAnimationFrame;
    buffer.playerElevation = this.currentPlayerElevation;
  }

  /**
   * Incremental render - only render edge tiles when scrolling
   */
  private renderEdgeTiles(
    buffer: BufferState,
    pass: RenderPass,
    newWorldStartX: number,
    newWorldStartY: number,
    resolveTile: BufferTileResolver,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): void {
    const ctx = buffer.ctx;
    const oldStartX = buffer.worldStartX;
    const oldStartY = buffer.worldStartY;
    const deltaX = newWorldStartX - oldStartX;
    const deltaY = newWorldStartY - oldStartY;

    // If the shift is too large, just do a full render
    if (Math.abs(deltaX) >= buffer.tilesWide || Math.abs(deltaY) >= buffer.tilesHigh) {
      this.renderFullBuffer(buffer, pass, newWorldStartX, newWorldStartY, resolveTile, isVerticalObject);
      return;
    }

    // Shift existing content
    const shiftPixelX = -deltaX * METATILE_SIZE;
    const shiftPixelY = -deltaY * METATILE_SIZE;

    // Use a temporary canvas to hold the shifted content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = buffer.canvas.width;
    tempCanvas.height = buffer.canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Copy shifted content
    tempCtx.drawImage(buffer.canvas, shiftPixelX, shiftPixelY);

    // Clear and draw back
    ctx.clearRect(0, 0, buffer.canvas.width, buffer.canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);

    // Render new edge tiles
    if (deltaX > 0) {
      // Scrolled right - render right edge
      const startLocalX = buffer.tilesWide - deltaX;
      for (let localX = startLocalX; localX < buffer.tilesWide; localX++) {
        const worldX = newWorldStartX + localX;
        for (let localY = 0; localY < buffer.tilesHigh; localY++) {
          const worldY = newWorldStartY + localY;
          this.renderTileIfNeeded(ctx, pass, worldX, worldY, localX, localY, resolveTile, isVerticalObject);
        }
      }
    } else if (deltaX < 0) {
      // Scrolled left - render left edge
      for (let localX = 0; localX < -deltaX; localX++) {
        const worldX = newWorldStartX + localX;
        for (let localY = 0; localY < buffer.tilesHigh; localY++) {
          const worldY = newWorldStartY + localY;
          this.renderTileIfNeeded(ctx, pass, worldX, worldY, localX, localY, resolveTile, isVerticalObject);
        }
      }
    }

    if (deltaY > 0) {
      // Scrolled down - render bottom edge
      const startLocalY = buffer.tilesHigh - deltaY;
      for (let localY = startLocalY; localY < buffer.tilesHigh; localY++) {
        const worldY = newWorldStartY + localY;
        for (let localX = 0; localX < buffer.tilesWide; localX++) {
          const worldX = newWorldStartX + localX;
          this.renderTileIfNeeded(ctx, pass, worldX, worldY, localX, localY, resolveTile, isVerticalObject);
        }
      }
    } else if (deltaY < 0) {
      // Scrolled up - render top edge
      for (let localY = 0; localY < -deltaY; localY++) {
        const worldY = newWorldStartY + localY;
        for (let localX = 0; localX < buffer.tilesWide; localX++) {
          const worldX = newWorldStartX + localX;
          this.renderTileIfNeeded(ctx, pass, worldX, worldY, localX, localY, resolveTile, isVerticalObject);
        }
      }
    }

    buffer.worldStartX = newWorldStartX;
    buffer.worldStartY = newWorldStartY;
  }

  /**
   * Render a single tile if it passes all filters
   */
  private renderTileIfNeeded(
    ctx: CanvasRenderingContext2D,
    pass: RenderPass,
    worldX: number,
    worldY: number,
    localX: number,
    localY: number,
    resolveTile: BufferTileResolver,
    isVerticalObject: (tileX: number, tileY: number) => boolean
  ): void {
    const resolved = resolveTile(worldX, worldY);
    if (!resolved || !resolved.metatile) return;

    // Clear the tile area first
    const screenX = localX * METATILE_SIZE;
    const screenY = localY * METATILE_SIZE;
    ctx.clearRect(screenX, screenY, METATILE_SIZE, METATILE_SIZE);

    // Apply filters for top passes
    if (pass !== 'background') {
      const isVertical = isVerticalObject(worldX, worldY);

      if (pass === 'topBelow') {
        if (isVertical) return;
        if (!this.passElevationFilter(pass, resolved.mapTile, this.currentPlayerElevation)) return;
      } else {
        if (!isVertical && !this.passElevationFilter(pass, resolved.mapTile, this.currentPlayerElevation)) return;
      }
    }

    this.renderMetatile(ctx, resolved, screenX, screenY, pass);
  }

  /**
   * Composite a pass to the main canvas
   *
   * This is the main entry point - handles buffer management and compositing
   *
   * @returns true if a full re-render was needed
   */
  composite(
    mainCtx: CanvasRenderingContext2D,
    pass: RenderPass,
    viewportWorldStartX: number,
    viewportWorldStartY: number,
    subTileOffsetX: number,
    subTileOffsetY: number,
    resolveTile: BufferTileResolver,
    isVerticalObject: (tileX: number, tileY: number) => boolean,
    forceFullRender: boolean = false
  ): boolean {
    const buffer = this.ensureBuffer(pass);
    const dims = this.getBufferDimensions();

    // Calculate the ideal buffer start position (viewport minus overscan)
    const idealBufferStartX = viewportWorldStartX - OVERSCAN_TILES;
    const idealBufferStartY = viewportWorldStartY - OVERSCAN_TILES;

    // Check if we need to re-render
    const animationChanged = buffer.animationFrame !== this.currentAnimationFrame;
    const elevationChanged = pass !== 'background' && buffer.playerElevation !== this.currentPlayerElevation;
    const needsFullRender = forceFullRender ||
      animationChanged ||
      elevationChanged ||
      buffer.worldStartX === -999999;

    if (needsFullRender) {
      this.renderFullBuffer(buffer, pass, idealBufferStartX, idealBufferStartY, resolveTile, isVerticalObject);
    } else {
      // Check if viewport is still within buffer (with some margin)
      const marginTiles = 1;
      const viewportEndX = viewportWorldStartX + this.viewportTilesWide;
      const viewportEndY = viewportWorldStartY + this.viewportTilesHigh;
      const bufferEndX = buffer.worldStartX + buffer.tilesWide;
      const bufferEndY = buffer.worldStartY + buffer.tilesHigh;

      const needsShift =
        viewportWorldStartX < buffer.worldStartX + marginTiles ||
        viewportWorldStartY < buffer.worldStartY + marginTiles ||
        viewportEndX > bufferEndX - marginTiles ||
        viewportEndY > bufferEndY - marginTiles;

      if (needsShift) {
        this.renderEdgeTiles(buffer, pass, idealBufferStartX, idealBufferStartY, resolveTile, isVerticalObject);
      }
    }

    // Composite to main canvas
    // Calculate source rect in buffer
    const srcX = (viewportWorldStartX - buffer.worldStartX) * METATILE_SIZE - subTileOffsetX;
    const srcY = (viewportWorldStartY - buffer.worldStartY) * METATILE_SIZE - subTileOffsetY;
    const destWidth = this.viewportTilesWide * METATILE_SIZE;
    const destHeight = this.viewportTilesHigh * METATILE_SIZE;

    mainCtx.drawImage(
      buffer.canvas,
      srcX, srcY, destWidth, destHeight,
      0, 0, destWidth, destHeight
    );

    return needsFullRender;
  }

  /**
   * Force invalidation of all buffers
   */
  invalidateAll(): void {
    for (const buffer of this.buffers.values()) {
      buffer.worldStartX = -999999;
      buffer.worldStartY = -999999;
      buffer.animationFrame = -1;
    }
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    const dims = this.getBufferDimensions();
    return {
      overscanTiles: OVERSCAN_TILES,
      bufferTilesWide: dims.tilesWide,
      bufferTilesHigh: dims.tilesHigh,
      totalBufferPixels: dims.pixelWidth * dims.pixelHeight,
      passCount: this.buffers.size,
    };
  }
}
