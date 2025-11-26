import {
  type RenderContext,
  type DebugTileInfo,
  type TilesetKind,
} from '../types';
import { type WorldCameraView } from '../../MapRenderer';
import { PlayerController } from '../../../game/PlayerController';
import {
  describeTile,
  resolveTileAt,
} from '../utils';
import {
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  SECONDARY_TILE_OFFSET,
} from '../../../utils/mapLoader';

const DEBUG_CELL_SCALE = 3;
const DEBUG_CELL_SIZE = METATILE_SIZE * DEBUG_CELL_SCALE;
const DEBUG_GRID_SIZE = DEBUG_CELL_SIZE * 3;

// Elevation colors - gradient from blue (low) to red (high)
const ELEVATION_COLORS = [
  '#0000ff', // 0 - blue
  '#0044ff', // 1
  '#0088ff', // 2
  '#00ccff', // 3
  '#00ffcc', // 4
  '#00ff88', // 5
  '#00ff44', // 6
  '#00ff00', // 7 - green
  '#44ff00', // 8
  '#88ff00', // 9
  '#ccff00', // 10
  '#ffff00', // 11 - yellow
  '#ffcc00', // 12
  '#ff8800', // 13
  '#ff4400', // 14
  '#ff0000', // 15 - red
];

export class DebugRenderer {
  /**
   * Render collision and/or elevation overlay on the main canvas.
   * Shows passable tiles (green border), blocked tiles (red with X), and elevation colors.
   */
  static renderCollisionElevationOverlay(
    mainCtx: CanvasRenderingContext2D,
    ctx: RenderContext,
    view: WorldCameraView,
    options: { showCollision: boolean; showElevation: boolean }
  ): void {
    const { showCollision, showElevation } = options;
    if (!showCollision && !showElevation) return;

    const widthPx = view.pixelWidth;
    const heightPx = view.pixelHeight;
    const METATILE_PX = 16;

    // Calculate visible tile range
    const startTileX = view.worldStartTileX;
    const startTileY = view.worldStartTileY;
    const tilesWide = Math.ceil(widthPx / METATILE_PX) + 1;
    const tilesHigh = Math.ceil(heightPx / METATILE_PX) + 1;

    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const worldTileX = startTileX + tx;
        const worldTileY = startTileY + ty;
        const resolved = resolveTileAt(ctx, worldTileX, worldTileY);

        if (resolved) {
          const screenX = tx * METATILE_PX - Math.round(view.subTileOffsetX);
          const screenY = ty * METATILE_PX - Math.round(view.subTileOffsetY);

          // Render elevation overlay (bottom layer)
          if (showElevation) {
            const elevation = resolved.mapTile.elevation;
            mainCtx.globalAlpha = 0.35;
            mainCtx.fillStyle = ELEVATION_COLORS[elevation] || '#888888';
            mainCtx.fillRect(screenX, screenY, METATILE_PX, METATILE_PX);
          }

          // Render collision overlay (top layer, with hatching for blocked)
          if (showCollision) {
            const collision = resolved.mapTile.collision;
            mainCtx.globalAlpha = 0.4;

            if (collision === 0) {
              // Passable - green border only (so elevation shows through)
              mainCtx.strokeStyle = '#00ff00';
              mainCtx.lineWidth = 1;
              mainCtx.strokeRect(screenX + 0.5, screenY + 0.5, METATILE_PX - 1, METATILE_PX - 1);
            } else if (collision === 1) {
              // Blocked - red with X pattern
              mainCtx.fillStyle = '#ff0000';
              mainCtx.fillRect(screenX, screenY, METATILE_PX, METATILE_PX);
              // Draw X for blocked tiles
              mainCtx.globalAlpha = 0.6;
              mainCtx.strokeStyle = '#000000';
              mainCtx.lineWidth = 2;
              mainCtx.beginPath();
              mainCtx.moveTo(screenX + 2, screenY + 2);
              mainCtx.lineTo(screenX + METATILE_PX - 2, screenY + METATILE_PX - 2);
              mainCtx.moveTo(screenX + METATILE_PX - 2, screenY + 2);
              mainCtx.lineTo(screenX + 2, screenY + METATILE_PX - 2);
              mainCtx.stroke();
            } else {
              // Other collision types - yellow
              mainCtx.fillStyle = '#ffff00';
              mainCtx.fillRect(screenX, screenY, METATILE_PX, METATILE_PX);
            }
          }
        }
      }
    }

    mainCtx.globalAlpha = 1.0;
  }

  static renderDebugOverlay(
    ctx: RenderContext,
    player: PlayerController,
    view: WorldCameraView,
    mainCanvas: HTMLCanvasElement,
    dbgCanvas: HTMLCanvasElement,
    setCenterTileDebugInfo: (info: DebugTileInfo | null) => void,
    debugTilesRef: React.MutableRefObject<DebugTileInfo[]>
  ): void {
    dbgCanvas.width = DEBUG_GRID_SIZE;
    dbgCanvas.height = DEBUG_GRID_SIZE;
    const dbgCtx = dbgCanvas.getContext('2d');
    if (!dbgCtx) return;
    dbgCtx.imageSmoothingEnabled = false;
    dbgCtx.fillStyle = '#111';
    dbgCtx.fillRect(0, 0, DEBUG_GRID_SIZE, DEBUG_GRID_SIZE);

    const collected: DebugTileInfo[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tileX = player.tileX + dx;
        const tileY = player.tileY + dy;
        const info = describeTile(ctx, tileX, tileY, player);
        collected.push(info);

        const destX = (dx + 1) * DEBUG_CELL_SIZE;
        const destY = (dy + 1) * DEBUG_CELL_SIZE;
        const screenX = tileX * METATILE_SIZE - view.cameraWorldX;
        const screenY = tileY * METATILE_SIZE - view.cameraWorldY;
        const visible =
          screenX + METATILE_SIZE > 0 &&
          screenY + METATILE_SIZE > 0 &&
          screenX < view.pixelWidth &&
          screenY < view.pixelHeight;

        if (info.inBounds && visible) {
          dbgCtx.drawImage(
            mainCanvas,
            screenX,
            screenY,
            METATILE_SIZE,
            METATILE_SIZE,
            destX,
            destY,
            DEBUG_CELL_SIZE,
            DEBUG_CELL_SIZE
          );
        } else {
          dbgCtx.fillStyle = '#333';
          dbgCtx.fillRect(destX, destY, DEBUG_CELL_SIZE, DEBUG_CELL_SIZE);
        }

        dbgCtx.fillStyle = 'rgba(0,0,0,0.6)';
        dbgCtx.fillRect(destX, destY, DEBUG_CELL_SIZE, 16);
        dbgCtx.strokeStyle = dx === 0 && dy === 0 ? '#ff00aa' : 'rgba(255,255,255,0.3)';
        dbgCtx.lineWidth = 2;
        dbgCtx.strokeRect(destX + 1, destY + 1, DEBUG_CELL_SIZE - 2, DEBUG_CELL_SIZE - 2);
        dbgCtx.fillStyle = '#fff';
        dbgCtx.font = '12px monospace';
        const label = info.inBounds
          ? `${info.metatileId ?? '??'}` + (info.isReflective ? ' •R' : '')
          : 'OOB';
        dbgCtx.fillText(label, destX + 4, destY + 12);
      }
    }

    debugTilesRef.current = collected;
    // Update center tile info for display (index 4 is center of 3x3 grid)
    const centerTile = collected[4];
    setCenterTileDebugInfo(centerTile && centerTile.inBounds ? centerTile : null);
  }

  static renderLayerDecomposition(
    ctx: RenderContext,
    tileInfo: DebugTileInfo,
    bottomLayerCanvas: HTMLCanvasElement,
    topLayerCanvas: HTMLCanvasElement,
    compositeLayerCanvas: HTMLCanvasElement
  ): void {
    if (!tileInfo || !tileInfo.inBounds) return;
    
    const resolved = resolveTileAt(ctx, tileInfo.tileX, tileInfo.tileY);
    if (!resolved || !resolved.metatile) return;
    
    const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
    if (!runtime) return;
    
    const patchedTiles = runtime.patchedTiles ?? {
      primary: runtime.resources.primaryTilesImage,
      secondary: runtime.resources.secondaryTilesImage,
    };
    
    const SCALE = 4; // Scale up for visibility
    const TILE_SIZE_SCALED = TILE_SIZE * SCALE;
    const METATILE_SIZE_SCALED = METATILE_SIZE * SCALE;
    
    // Helper function to draw a tile
    const drawTileScaled = (
      canvas: HTMLCanvasElement,
      tile: { tileId: number; palette: number; xflip: boolean; yflip: boolean },
      destX: number,
      destY: number,
      tileSource: TilesetKind
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const palette = tile.palette < 6
        ? resolved.tileset.primaryPalettes[tile.palette]
        : resolved.tileset.secondaryPalettes[tile.palette];
      
      if (!palette) return;
      
      const tiles = tileSource === 'primary' ? patchedTiles.primary : patchedTiles.secondary;
      const tileId = tileSource === 'primary' ? tile.tileId : tile.tileId - SECONDARY_TILE_OFFSET;
      
      // Draw tile directly
      const tileX = (tileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      const tileY = Math.floor(tileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      
      ctx.imageSmoothingEnabled = false;
      
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const srcX = tile.xflip ? (TILE_SIZE - 1 - x) : x;
          const srcY = tile.yflip ? (TILE_SIZE - 1 - y) : y;
          const idx = (tileY + srcY) * TILES_PER_ROW_IN_IMAGE * TILE_SIZE + (tileX + srcX);
          const paletteIdx = tiles[idx];
          
          if (paletteIdx === 0) continue; // Transparent
          
          const color = palette.colors[paletteIdx];
          ctx.fillStyle = color;
          ctx.fillRect(destX + x * SCALE, destY + y * SCALE, SCALE, SCALE);
        }
      }
    };

    // Clear canvases
    const canvases = [bottomLayerCanvas, topLayerCanvas, compositeLayerCanvas];
    canvases.forEach(canvas => {
      canvas.width = METATILE_SIZE_SCALED;
      canvas.height = METATILE_SIZE_SCALED;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw checkerboard background
        ctx.fillStyle = '#eee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ccc';
        for (let y = 0; y < canvas.height; y += 16) {
          for (let x = 0; x < canvas.width; x += 16) {
            if ((x / 16 + y / 16) % 2 === 1) {
              ctx.fillRect(x, y, 16, 16);
            }
          }
        }
      }
    });

    const metatile = resolved.metatile;
    const isSecondary = resolved.isSecondary;
    
    // Draw Bottom Layer (0-3)
    for (let i = 0; i < 4; i++) {
      const tile = metatile.tiles[i];
      const destX = (i % 2) * TILE_SIZE_SCALED;
      const destY = Math.floor(i / 2) * TILE_SIZE_SCALED;
      const tileSource: TilesetKind = isSecondary ? 'secondary' : 'primary';
      
      drawTileScaled(bottomLayerCanvas, tile, destX, destY, tileSource);
      drawTileScaled(compositeLayerCanvas, tile, destX, destY, tileSource);
    }
    
    // Draw Top Layer (4-7)
    for (let i = 4; i < 8; i++) {
      const tile = metatile.tiles[i];
      const destX = (i % 2) * TILE_SIZE_SCALED;
      const destY = Math.floor((i - 4) / 2) * TILE_SIZE_SCALED;
      const tileSource: TilesetKind = isSecondary ? 'secondary' : 'primary';
      
      drawTileScaled(topLayerCanvas, tile, destX, destY, tileSource);
      drawTileScaled(compositeLayerCanvas, tile, destX, destY, tileSource);
    }
  }
}
