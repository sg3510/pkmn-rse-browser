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

  // Player State (Refs for animation loop access)
  const playerState = useRef({
    x: 0, // Pixel X (visual)
    y: 0, // Pixel Y (visual)
    tileX: 0, // Grid X (logical)
    tileY: 0, // Grid Y (logical)
    dir: 'down' as 'down' | 'up' | 'left' | 'right',
    isMoving: false,
    pixelsMoved: 0, // Track progress between tiles
    frameIndex: 0,
    lastFrameTime: 0
  });
  
  const playerSpriteRef = useRef<HTMLCanvasElement | null>(null);
  
  // Movement constants
  const MOVE_SPEED = 1; // Pixels per frame (must divide 16 evenly)
  const TILE_PIXELS = 16;

  // Input handling
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Helper to process sprite transparency
  const loadSpriteWithTransparency = async (src: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Assume top-left pixel is the background color
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];
        
        // Replace all matching pixels with transparent
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
            data[i + 3] = 0; // Alpha 0
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
    });
  };

  useEffect(() => {
    const loadAndRender = async () => {
      try {
        setLoading(true);
        
        // 1. Load Map Layout
        const mapData = await loadMapLayout(`${PROJECT_ROOT}/${layoutPath}/map.bin`, width, height);
        
        // Initialize player position to center of map (grid aligned)
        const startTileX = Math.floor(mapData.width / 2);
        const startTileY = Math.floor(mapData.height / 2);
        
        playerState.current.tileX = startTileX;
        playerState.current.tileY = startTileY;
        playerState.current.x = startTileX * METATILE_SIZE;
        playerState.current.y = startTileY * METATILE_SIZE - 16; // Sprite is 32px tall, feet at bottom

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
          flowerImages.push(f0, f1, f0, f2);
        } catch (e) {
          console.warn('No flower animations found');
        }

        // 5. Load Player Sprite with Transparency
        try {
          const spriteCanvas = await loadSpriteWithTransparency(`${PROJECT_ROOT}/graphics/object_events/pics/people/brendan/walking.png`);
          playerSpriteRef.current = spriteCanvas;
        } catch (e) {
          console.error('Failed to load sprite', e);
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
        
        setLoading(false);
        
        // Start animation loop
        let timer = 0;
        let lastTime = 0;
        
        const loop = (timestamp: number) => {
          if (!lastTime) lastTime = timestamp;
          const delta = timestamp - lastTime;
          
          // Update Player State
          updatePlayerState(timestamp);

          // ~60 FPS = 16.6ms per frame
          if (delta >= 16.6) {
            timer++;
            lastTime = timestamp;
            
            // Flower updates every 16 frames (~266ms)
            const flowerFrameIndex = flowerImages.length > 0 
              ? Math.floor(timer / 16) % flowerImages.length
              : 0;
              
            renderMap(flowerFrameIndex);
          }
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

  const updatePlayerState = (timestamp: number) => {
    const state = playerState.current;
    const ctx = renderContextRef.current;
    
    if (!ctx) return;
    const { mapData } = ctx;

    if (state.isMoving) {
      // Continue movement
      state.pixelsMoved += MOVE_SPEED;
      
      if (state.dir === 'up') state.y -= MOVE_SPEED;
      else if (state.dir === 'down') state.y += MOVE_SPEED;
      else if (state.dir === 'left') state.x -= MOVE_SPEED;
      else if (state.dir === 'right') state.x += MOVE_SPEED;

      // Check if movement is complete
      if (state.pixelsMoved >= TILE_PIXELS) {
        state.isMoving = false;
        state.pixelsMoved = 0;
        
        // Update logical tile position
        if (state.dir === 'up') state.tileY--;
        else if (state.dir === 'down') state.tileY++;
        else if (state.dir === 'left') state.tileX--;
        else if (state.dir === 'right') state.tileX++;
        
        // Snap to grid (correction for any float drift, though using ints here)
        state.x = state.tileX * TILE_PIXELS;
        state.y = state.tileY * TILE_PIXELS - 16;
      }
      
      // Update animation frame every 150ms
      if (timestamp - state.lastFrameTime > 150) {
        state.frameIndex = (state.frameIndex + 1) % 2;
        state.lastFrameTime = timestamp;
      }
    } else {
      // Check for new input
      let dx = 0;
      let dy = 0;
      let newDir = state.dir;
      let attemptMove = false;

      if (keysPressed.current['ArrowUp']) {
        dy = -1;
        newDir = 'up';
        attemptMove = true;
      } else if (keysPressed.current['ArrowDown']) {
        dy = 1;
        newDir = 'down';
        attemptMove = true;
      } else if (keysPressed.current['ArrowLeft']) {
        dx = -1;
        newDir = 'left';
        attemptMove = true;
      } else if (keysPressed.current['ArrowRight']) {
        dx = 1;
        newDir = 'right';
        attemptMove = true;
      }

      if (attemptMove) {
        state.dir = newDir;
        
        // Check boundaries
        const targetTileX = state.tileX + dx;
        const targetTileY = state.tileY + dy;
        
        if (targetTileX >= 0 && targetTileX < mapData.width &&
            targetTileY >= 0 && targetTileY < mapData.height) {
          state.isMoving = true;
          state.pixelsMoved = 0;
        }
      } else {
        state.frameIndex = 0; // Idle
      }
    }
  };

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

    // Render Player Sprite
    if (playerSpriteRef.current) {
      const sprite = playerSpriteRef.current;
      const state = playerState.current;
      const spriteW = 16;
      const spriteH = 32;
      
      let srcIndex = 0;
      let flip = false;

      if (!state.isMoving) {
        if (state.dir === 'down') srcIndex = 0;
        else if (state.dir === 'up') srcIndex = 1;
        else if (state.dir === 'left') srcIndex = 2;
        else if (state.dir === 'right') { srcIndex = 2; flip = true; }
      } else {
        const offset = state.frameIndex; // 0 or 1
        if (state.dir === 'down') srcIndex = 3 + offset;
        else if (state.dir === 'up') srcIndex = 5 + offset;
        else if (state.dir === 'left') srcIndex = 7 + offset;
        else if (state.dir === 'right') { srcIndex = 7 + offset; flip = true; }
      }

      const srcX = srcIndex * spriteW;
      const srcY = 0;

      canvasCtx.save();
      if (flip) {
        canvasCtx.translate(state.x + spriteW, state.y);
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(sprite, srcX, srcY, spriteW, spriteH, 0, 0, spriteW, spriteH);
      } else {
        canvasCtx.drawImage(sprite, srcX, srcY, spriteW, spriteH, state.x, state.y, spriteW, spriteH);
      }
      canvasCtx.restore();
    }
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
