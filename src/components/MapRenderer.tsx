import React, { useEffect, useRef, useState } from 'react';
import { 
  loadMapLayout, 
  loadMetatileDefinitions, 
  loadTilesetImage, 
  parsePalette, 
  loadText,
  type MapData,
  type Metatile,
  type Palette,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE
} from '../utils/mapLoader';

const PROJECT_ROOT = '/pokeemerald';

interface MapRendererProps {
  mapName: string;
  width: number;
  height: number;
  layoutPath: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
}

interface RenderContext {
  mapData: MapData;
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryTilesImage: Uint8Array;
  secondaryTilesImage: Uint8Array;
  palettes: Palette[];
  flowerFrames: Uint8Array[];
}

export const MapRenderer: React.FC<MapRendererProps> = ({
  mapName,
  width,
  height,
  layoutPath,
  primaryTilesetPath,
  secondaryTilesetPath
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const animRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAndRender = async () => {
      try {
        setLoading(true);
        
        // 1. Load Map Layout
        const mapData = await loadMapLayout(`${PROJECT_ROOT}/${layoutPath}/map.bin`, width, height);
        
        // 2. Load Primary Tileset
        const primaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${primaryTilesetPath}/metatiles.bin`);
        const primaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/tiles.png`);
        const primaryPalettes: Palette[] = [];
        for (let i = 0; i < 6; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${primaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          primaryPalettes.push(parsePalette(text));
        }

        // 3. Load Secondary Tileset
        const secondaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatiles.bin`);
        const secondaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${secondaryTilesetPath}/tiles.png`);
        const secondaryPalettes: Palette[] = [];
        for (let i = 6; i < 13; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${secondaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          secondaryPalettes.push(parsePalette(text));
        }

        // 4. Load Flower Animation Frames
        const flowerImages: Uint8Array[] = [];
        try {
          const f0 = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/anim/flower/0.png`);
          const f1 = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/anim/flower/1.png`);
          const f2 = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/anim/flower/2.png`);
          
          // Animation sequence: 0, 1, 0, 2
          flowerImages.push(f0, f1, f0, f2);
        } catch (e) {
          console.warn('No flower animations found');
        }

        const palettes = [...primaryPalettes, ...secondaryPalettes];

        renderContextRef.current = {
          mapData,
          primaryMetatiles,
          secondaryMetatiles,
          primaryTilesImage,
          secondaryTilesImage,
          palettes,
          flowerFrames: flowerImages
        };
        
        // Initial render
        renderMap(0);
        setLoading(false);
        
        // Start animation loop
        if (flowerImages.length > 0) {
          let timer = 0;
          let lastTime = 0;
          
          const loop = (timestamp: number) => {
            if (!lastTime) lastTime = timestamp;
            const delta = timestamp - lastTime;
            
            // ~60 FPS = 16.6ms per frame
            if (delta >= 16.6) {
              timer++;
              lastTime = timestamp;
              
              // Flower updates every 16 frames (~266ms)
              const flowerFrameIndex = Math.floor(timer / 16) % flowerImages.length;
              renderMap(flowerFrameIndex);
            }
            animRef.current = requestAnimationFrame(loop);
          };
          
          animRef.current = requestAnimationFrame(loop);
        }

      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadAndRender();
    
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mapName, width, height, layoutPath, primaryTilesetPath, secondaryTilesetPath]);

  const copyTile = (
    src: Uint8Array, srcX: number, srcY: number, srcStride: number,
    dest: Uint8Array, destX: number, destY: number, destStride: number
  ) => {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const val = src[(srcY + y) * srcStride + (srcX + x)];
        dest[(destY + y) * destStride + (destX + x)] = val;
      }
    }
  };

  const renderMap = (flowerFrameIndex: number) => {
    const ctx = renderContextRef.current;
    if (!ctx) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const {
      mapData,
      primaryMetatiles,
      secondaryMetatiles,
      primaryTilesImage,
      secondaryTilesImage,
      palettes,
      flowerFrames
    } = ctx;

    // Patch primary tileset with current flower animation frame
    const patchedPrimaryTiles = new Uint8Array(primaryTilesImage);
    
    if (flowerFrames.length > 0 && flowerFrames[flowerFrameIndex]) {
      const currentFlowerFrame = flowerFrames[flowerFrameIndex];
      
      // Flower tiles are at tile IDs 508-511 in the primary tileset
      // Tile 508 is at (96, 248) in a 128px-wide image
      // The flower frame is 16x16 (2x2 tiles)
      // We need to copy 4 tiles:
      // TL (0,0) -> Tile 508 (96, 248)
      // TR (8,0) -> Tile 509 (104, 248)
      // BL (0,8) -> Tile 510 (112, 248)
      // BR (8,8) -> Tile 511 (120, 248)
      
      copyTile(currentFlowerFrame, 0, 0, 16, patchedPrimaryTiles, 96, 248, 128);
      copyTile(currentFlowerFrame, 8, 0, 16, patchedPrimaryTiles, 104, 248, 128);
      copyTile(currentFlowerFrame, 0, 8, 16, patchedPrimaryTiles, 112, 248, 128);
      copyTile(currentFlowerFrame, 8, 8, 16, patchedPrimaryTiles, 120, 248, 128);
    }

    // Create image data
    const imageData = canvasCtx.createImageData(mapData.width * METATILE_SIZE, mapData.height * METATILE_SIZE);
    const data = imageData.data;

    const drawTile = (
      tileId: number, 
      x: number, 
      y: number, 
      tiles: Uint8Array | Uint8Array<ArrayBufferLike>, 
      palette: Palette, 
      xflip: boolean, 
      yflip: boolean
    ) => {
      const tx = (tileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      const ty = Math.floor(tileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;

      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const sourceX = tx + px;
          const sourceY = ty + py;
          if (sourceX >= 128 || sourceY * 128 + sourceX >= tiles.length) continue;
          
          const colorIndex = tiles[sourceY * 128 + sourceX];
          if (colorIndex === 0) continue; // Transparent

          const targetX = x + (xflip ? (TILE_SIZE - 1 - px) : px);
          const targetY = y + (yflip ? (TILE_SIZE - 1 - py) : py);

          if (targetX < 0 || targetX >= imageData.width || targetY < 0 || targetY >= imageData.height) continue;

          const pixelIndex = (targetY * imageData.width + targetX) * 4;
          
          const colorHex = palette.colors[colorIndex];
          if (!colorHex) continue;
          
          const r = parseInt(colorHex.slice(1, 3), 16);
          const g = parseInt(colorHex.slice(3, 5), 16);
          const b = parseInt(colorHex.slice(5, 7), 16);

          data[pixelIndex] = r;
          data[pixelIndex + 1] = g;
          data[pixelIndex + 2] = b;
          data[pixelIndex + 3] = 255;
        }
      }
    };

    // Render all metatiles
    for (let my = 0; my < mapData.height; my++) {
      for (let mx = 0; mx < mapData.width; mx++) {
        const rawMetatileId = mapData.layout[my * mapData.width + mx];
        const metatileId = rawMetatileId & 0x3FF;
        
        const isSecondary = metatileId >= 512;
        
        const metatile = isSecondary 
          ? secondaryMetatiles[metatileId - 512]
          : primaryMetatiles[metatileId];
        
        if (!metatile) continue;

        const screenX = mx * METATILE_SIZE;
        const screenY = my * METATILE_SIZE;

        // Draw 2 layers (bottom and top)
        for (let layer = 0; layer < 2; layer++) {
          for (let i = 0; i < 4; i++) {
            const tileIndex = layer * 4 + i;
            const tile = metatile.tiles[tileIndex];
            
            const subX = (i % 2) * TILE_SIZE;
            const subY = Math.floor(i / 2) * TILE_SIZE;

            const drawX = screenX + subX;
            const drawY = screenY + subY;

            const paletteId = tile.palette;
            const palette = palettes[paletteId];
            if (!palette) continue;

            let sourceImage: Uint8Array | Uint8Array<ArrayBufferLike> = patchedPrimaryTiles;
            let effectiveTileId = tile.tileId;
            
            if (effectiveTileId >= 512) {
              sourceImage = secondaryTilesImage as Uint8Array<ArrayBufferLike>;
              effectiveTileId -= 512;
            }

            drawTile(effectiveTileId, drawX, drawY, sourceImage, palette, tile.xflip, tile.yflip);
          }
        }
      }
    }

    canvasCtx.putImageData(imageData, 0, 0);
  };

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
      <canvas 
        ref={canvasRef} 
        width={width * METATILE_SIZE} 
        height={height * METATILE_SIZE} 
        style={{ border: '1px solid #ccc', imageRendering: 'pixelated' }}
      />
    </div>
  );
};
