import React, { useEffect, useRef, useState } from 'react';
import { PlayerController } from '../game/PlayerController';
import { 
  loadMapLayout, 
  loadMetatileDefinitions, 
  loadTilesetImage, 
  parsePalette, 
  loadText,
  loadMetatileAttributes,
  type MapData,
  type Metatile,
  type Palette,
  type MetatileAttributes,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_SPLIT,
  getMetatileIdFromMapTile
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
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
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

  // Player Controller
  const playerControllerRef = useRef<PlayerController | null>(null);

  useEffect(() => {
    // Initialize PlayerController
    playerControllerRef.current = new PlayerController();
    
    // Enable detailed logging (set to false for production)
    (window as any).DEBUG_RENDER = false;
    
    const loadAndRender = async () => {
      try {
        setLoading(true);
        
        // 1. Load Map Layout
        const mapData = await loadMapLayout(`${PROJECT_ROOT}/${layoutPath}/map.bin`, width, height);
        
        // Initialize player position to center of map (grid aligned)
        const startTileX = Math.floor(mapData.width / 2);
        const startTileY = Math.floor(mapData.height / 2);
        
        if (playerControllerRef.current) {
            playerControllerRef.current.setPosition(startTileX, startTileY);
        }

        // 2. Load Primary Tileset
        const primaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${primaryTilesetPath}/metatiles.bin`);
        const primaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/tiles.png`);
        const primaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${primaryTilesetPath}/metatile_attributes.bin`);
        const primaryPalettes: Palette[] = [];
        for (let i = 0; i < 6; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${primaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          primaryPalettes.push(parsePalette(text));
        }

        // 3. Load Secondary Tileset
        const secondaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatiles.bin`);
        const secondaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${secondaryTilesetPath}/tiles.png`);
        const secondaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatile_attributes.bin`);
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
          flowerImages.push(f0, f1, f0, f2);
        } catch (e) {
          console.warn('No flower animations found');
        }

        // 5. Load Player Sprite
        if (playerControllerRef.current) {
            try {
                await playerControllerRef.current.loadSprite(`${PROJECT_ROOT}/graphics/object_events/pics/people/brendan/walking.png`);
            } catch (e) {
                console.error('Failed to load sprite', e);
            }
        }

        const palettes = [...primaryPalettes, ...secondaryPalettes];

        renderContextRef.current = {
          mapData,
          primaryMetatiles,
          secondaryMetatiles,
          primaryTilesImage,
          secondaryTilesImage,
          palettes,
          flowerFrames: flowerImages,
          primaryAttributes,
          secondaryAttributes
        };
        
        setLoading(false);
        
        // Start animation loop
        let lastTime = 0;
        
        const loop = (timestamp: number) => {
          if (!lastTime) lastTime = timestamp;
          const delta = timestamp - lastTime;
          lastTime = timestamp;

          if ((window as any).DEBUG_LOOP && delta > 0) {
            console.log(`[Loop] delta:${delta.toFixed(2)}ms timestamp:${timestamp.toFixed(2)}ms`);
          }

            // Update Player State with delta time
            if (playerControllerRef.current && renderContextRef.current) {
                // Cap delta to prevent huge jumps (e.g. changing tabs)
                const safeDelta = Math.min(delta, 50);
                playerControllerRef.current.update(safeDelta, renderContextRef.current);
            }

          // Flower updates every ~200ms (independent of frame rate)
          // Using global timer or deriving from timestamp is better, 
          // but simpler to just use rough frame count equivalent or time accumulator.
          // For now, let's use timestamp directly for flowers to be smooth.
          const flowerFrameIndex = flowerImages.length > 0 
            ? Math.floor(timestamp / 200) % flowerImages.length
            : 0;
            
          renderMap(flowerFrameIndex);
          
          animRef.current = requestAnimationFrame(loop);
        };
        
        animRef.current = requestAnimationFrame(loop);

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
      flowerFrames,
      primaryAttributes,
      secondaryAttributes
    } = ctx;

    // Patch primary tileset with current flower animation frame
    const patchedPrimaryTiles = new Uint8Array(primaryTilesImage);
    
    if (flowerFrames.length > 0 && flowerFrames[flowerFrameIndex]) {
      const currentFlowerFrame = flowerFrames[flowerFrameIndex];
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

    // Helper function to draw a single metatile layer
    const drawMetatileLayer = (
      mx: number, 
      my: number, 
      metatile: Metatile, 
      layer: number // 0 = bottom layer (tiles 0-3), 1 = top layer (tiles 4-7)
    ) => {
      const screenX = mx * METATILE_SIZE;
      const screenY = my * METATILE_SIZE;

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
    };

    // RENDER PASS 1: Bottom layers (BG3 + BG2 - behind player)
    for (let my = 0; my < mapData.height; my++) {
      for (let mx = 0; mx < mapData.width; mx++) {
        const rawMetatileId = mapData.layout[my * mapData.width + mx];
        const metatileId = getMetatileIdFromMapTile(rawMetatileId);
        const isSecondary = metatileId >= 512;
        
        const metatile = isSecondary 
          ? secondaryMetatiles[metatileId - 512]
          : primaryMetatiles[metatileId];
        
        if (!metatile) continue;

        // Get layer type from attributes
        const attr = isSecondary 
          ? secondaryAttributes[metatileId - 512]
          : primaryAttributes[metatileId];
        
        const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

        // Render bottom layer for ALL types
        drawMetatileLayer(mx, my, metatile, 0);

        // Render top layer for COVERED and SPLIT types (behind player)
        if (layerType === METATILE_LAYER_TYPE_COVERED || layerType === METATILE_LAYER_TYPE_SPLIT) {
          drawMetatileLayer(mx, my, metatile, 1);
        }
      }
    }

    canvasCtx.putImageData(imageData, 0, 0);

    // RENDER PASS 2: Player Sprite
    if (playerControllerRef.current) {
        if ((window as any).DEBUG_MAP_RENDER) {
          console.log(`[MapRender] Drawing map at flowerFrame:${flowerFrameIndex}, player at tile (${playerControllerRef.current.tileX}, ${playerControllerRef.current.tileY})`);
        }
        playerControllerRef.current.render(canvasCtx);
    }

    // RENDER PASS 3: Top layers (BG1 - covers player)
    renderTopLayers(canvasCtx, patchedPrimaryTiles);
  };

  const renderTopLayers = (canvasCtx: CanvasRenderingContext2D, patchedPrimaryTiles: Uint8Array) => {
    const ctx = renderContextRef.current;
    if (!ctx) return;

    const {
      mapData,
      primaryMetatiles,
      secondaryMetatiles,
      primaryAttributes,
      secondaryAttributes,
      secondaryTilesImage,
      palettes,
    } = ctx;

    // Create ONE ImageData for the entire top layer
    const imageData = canvasCtx.createImageData(mapData.width * METATILE_SIZE, mapData.height * METATILE_SIZE);
    const data = imageData.data;

    // Helper function to draw a single 8x8 tile into the ImageData
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
          const readX = xflip ? (TILE_SIZE - 1 - px) : px;
          const readY = yflip ? (TILE_SIZE - 1 - py) : py;

          const readSourceX = tx + readX;
          const readSourceY = ty + readY;

          const tileOffset = (readSourceY * TILES_PER_ROW_IN_IMAGE * TILE_SIZE) + readSourceX;
          const paletteIndex = tiles[tileOffset];

          const pixelIndex = ((y + py) * mapData.width * METATILE_SIZE + (x + px)) * 4;
          
          if (paletteIndex === 0) {
            // Transparent pixel - leave alpha at 0 (already initialized)
            data[pixelIndex + 3] = 0;
          } else {
            const colorHex = palette.colors[paletteIndex];
            if (colorHex) {
              const r = parseInt(colorHex.slice(1, 3), 16);
              const g = parseInt(colorHex.slice(3, 5), 16);
              const b = parseInt(colorHex.slice(5, 7), 16);

              data[pixelIndex] = r;
              data[pixelIndex + 1] = g;
              data[pixelIndex + 2] = b;
              data[pixelIndex + 3] = 255;
            }
          }
        }
      }
    };

    // Draw only NORMAL layer type top layers (covers player)
    for (let my = 0; my < mapData.height; my++) {
      for (let mx = 0; mx < mapData.width; mx++) {
        const rawMetatileId = mapData.layout[my * mapData.width + mx];
        const metatileId = getMetatileIdFromMapTile(rawMetatileId);
        const isSecondary = metatileId >= 512;
        
        const metatile = isSecondary 
          ? secondaryMetatiles[metatileId - 512]
          : primaryMetatiles[metatileId];
        
        if (!metatile) continue;

        // Get layer type from attributes
        const attr = isSecondary 
          ? secondaryAttributes[metatileId - 512]
          : primaryAttributes[metatileId];
        
        const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

        // Only render top layer for NORMAL type (covers player)
        if (layerType === METATILE_LAYER_TYPE_NORMAL) {
          const screenX = mx * METATILE_SIZE;
          const screenY = my * METATILE_SIZE;

          // Draw top layer (tiles 4-7)
          for (let i = 0; i < 4; i++) {
            const tileIndex = 4 + i; // Top layer
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

    // Create a temporary canvas ONCE for the entire top layer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.putImageData(imageData, 0, 0);
    canvasCtx.drawImage(tempCanvas, 0, 0);
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
