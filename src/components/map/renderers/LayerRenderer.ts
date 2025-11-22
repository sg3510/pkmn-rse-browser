import {
  type Palette,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  SECONDARY_TILE_OFFSET,
} from '../../../utils/mapLoader';


const TILESET_STRIDE = TILES_PER_ROW_IN_IMAGE * TILE_SIZE; // 128px

export interface TileDrawCall {
  tileId: number;
  destX: number;
  destY: number;
  palette: Palette;
  xflip: boolean;
  yflip: boolean;
  source: 'primary' | 'secondary';
  layer: 0 | 1;
}

function sampleTilePixel(
  tileId: number,
  x: number,
  y: number,
  tilesPrimary: Uint8Array,
  tilesSecondary: Uint8Array,
  useSecondarySheet: boolean
): number {
  const localId = tileId >= SECONDARY_TILE_OFFSET ? tileId - SECONDARY_TILE_OFFSET : tileId;
  const tiles = useSecondarySheet ? tilesSecondary : tilesPrimary;
  const tileX = (localId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
  const tileY = Math.floor(localId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
  return tiles[(tileY + y) * TILESET_STRIDE + (tileX + x)];
}

export class LayerRenderer {
  static drawTile(
    ctx: CanvasRenderingContext2D,
    drawCall: TileDrawCall,
    tilesPrimary: Uint8Array,
    tilesSecondary: Uint8Array
  ) {
    const { tileId, destX, destY, palette, xflip, yflip, source } = drawCall;
    const useSecondary = source === 'secondary';
    
    const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const data = imageData.data;
    
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const srcX = xflip ? TILE_SIZE - 1 - x : x;
        const srcY = yflip ? TILE_SIZE - 1 - y : y;
        
        const pixelIndex = sampleTilePixel(
          tileId,
          srcX,
          srcY,
          tilesPrimary,
          tilesSecondary,
          useSecondary
        );
        
        if (pixelIndex === 0) {
          // Transparent
          continue;
        }
        
        const colorHex = palette.colors[pixelIndex];
        if (!colorHex) continue;
        
        const r = parseInt(colorHex.slice(1, 3), 16);
        const g = parseInt(colorHex.slice(3, 5), 16);
        const b = parseInt(colorHex.slice(5, 7), 16);
        
        const destIndex = (y * TILE_SIZE + x) * 4;
        data[destIndex] = r;
        data[destIndex + 1] = g;
        data[destIndex + 2] = b;
        data[destIndex + 3] = 255;
      }
    }
    
    ctx.putImageData(imageData, destX, destY);
  }
  
  // ... (We can add more methods for batch rendering if needed)
}
