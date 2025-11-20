import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  getMetatileIdFromMapTile,
} from '../utils/mapLoader';

const PROJECT_ROOT = '/pokeemerald';
const ANIMATED_TILE_IDS = new Set([508, 509, 510, 511]); // tiles patched by flower animation

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

interface TileDrawCall {
  tileId: number;
  destX: number;
  destY: number;
  palette: Palette;
  xflip: boolean;
  yflip: boolean;
  source: 'primary' | 'secondary';
}

export const MapRenderer: React.FC<MapRendererProps> = ({
  mapName,
  width,
  height,
  layoutPath,
  primaryTilesetPath,
  secondaryTilesetPath,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const animRef = useRef<number>(0);
  const lastFlowerFrameRef = useRef<number>(-1);
  const patchedPrimaryTilesRef = useRef<Uint8Array | null>(null);
  const hasRenderedRef = useRef<boolean>(false);
  const renderGenerationRef = useRef<number>(0);

  const backgroundImageDataRef = useRef<ImageData | null>(null);
  const topImageDataRef = useRef<ImageData | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animatedBottomDrawCallsRef = useRef<TileDrawCall[]>([]);
  const animatedTopDrawCallsRef = useRef<TileDrawCall[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player Controller
  const playerControllerRef = useRef<PlayerController | null>(null);

  useEffect(() => {
    playerControllerRef.current = new PlayerController();
    return () => {
      playerControllerRef.current?.destroy();
    };
  }, []);

  const copyTile = (
    src: Uint8Array,
    srcX: number,
    srcY: number,
    srcStride: number,
    dest: Uint8Array,
    destX: number,
    destY: number,
    destStride: number
  ) => {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const val = src[(srcY + y) * srcStride + (srcX + x)];
        dest[(destY + y) * destStride + (destX + x)] = val;
      }
    }
  };

  const buildPatchedPrimaryTiles = useCallback((flowerFrameIndex: number): Uint8Array | null => {
    const ctx = renderContextRef.current;
    if (!ctx) return null;

    if (flowerFrameIndex === lastFlowerFrameRef.current && patchedPrimaryTilesRef.current) {
      return patchedPrimaryTilesRef.current;
    }

    if (ctx.flowerFrames.length === 0) {
      patchedPrimaryTilesRef.current = ctx.primaryTilesImage;
      lastFlowerFrameRef.current = flowerFrameIndex;
      return patchedPrimaryTilesRef.current;
    }

    const patchedPrimaryTiles = new Uint8Array(ctx.primaryTilesImage);
    const currentFlowerFrame = ctx.flowerFrames[flowerFrameIndex];
    if (currentFlowerFrame) {
      copyTile(currentFlowerFrame, 0, 0, 16, patchedPrimaryTiles, 96, 248, 128);
      copyTile(currentFlowerFrame, 8, 0, 16, patchedPrimaryTiles, 104, 248, 128);
      copyTile(currentFlowerFrame, 0, 8, 16, patchedPrimaryTiles, 112, 248, 128);
      copyTile(currentFlowerFrame, 8, 8, 16, patchedPrimaryTiles, 120, 248, 128);
    }

    lastFlowerFrameRef.current = flowerFrameIndex;
    patchedPrimaryTilesRef.current = patchedPrimaryTiles;
    return patchedPrimaryTiles;
  }, []);

  const ensureAuxiliaryCanvases = (widthPx: number, heightPx: number) => {
    if (!backgroundCanvasRef.current) {
      backgroundCanvasRef.current = document.createElement('canvas');
    }
    if (!topCanvasRef.current) {
      topCanvasRef.current = document.createElement('canvas');
    }
    if (backgroundCanvasRef.current && topCanvasRef.current) {
      backgroundCanvasRef.current.width = widthPx;
      backgroundCanvasRef.current.height = heightPx;
      topCanvasRef.current.width = widthPx;
      topCanvasRef.current.height = heightPx;
    }
  };

  const drawTileToImageData = (
    imageData: ImageData,
    drawCall: TileDrawCall,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ) => {
    const tiles = drawCall.source === 'primary' ? primaryTiles : secondaryTiles;
    let effectiveTileId = drawCall.tileId;
    if (drawCall.source === 'secondary') {
      effectiveTileId -= 512;
    }

    const tx = (effectiveTileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const ty = Math.floor(effectiveTileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const data = imageData.data;
    const widthPx = imageData.width;

    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const sourceX = tx + (drawCall.xflip ? TILE_SIZE - 1 - px : px);
        const sourceY = ty + (drawCall.yflip ? TILE_SIZE - 1 - py : py);
        const paletteIndex = tiles[sourceY * 128 + sourceX];
        if (paletteIndex === 0) continue;

        const targetX = drawCall.destX + px;
        const targetY = drawCall.destY + py;
        const pixelIndex = (targetY * widthPx + targetX) * 4;
        const colorHex = drawCall.palette.colors[paletteIndex];
        if (!colorHex) continue;

        data[pixelIndex] = parseInt(colorHex.slice(1, 3), 16);
        data[pixelIndex + 1] = parseInt(colorHex.slice(3, 5), 16);
        data[pixelIndex + 2] = parseInt(colorHex.slice(5, 7), 16);
        data[pixelIndex + 3] = 255;
      }
    }
  };

  const renderPass = useCallback((
    ctx: RenderContext,
    patchedPrimaryTiles: Uint8Array,
    pass: 'background' | 'top'
  ): ImageData => {
    const widthPx = ctx.mapData.width * METATILE_SIZE;
    const heightPx = ctx.mapData.height * METATILE_SIZE;
    const imageData = new ImageData(widthPx, heightPx);
    const { primaryMetatiles, secondaryMetatiles, secondaryTilesImage, palettes, primaryAttributes, secondaryAttributes } = ctx;

    for (let my = 0; my < ctx.mapData.height; my++) {
      for (let mx = 0; mx < ctx.mapData.width; mx++) {
        const rawMetatileId = ctx.mapData.layout[my * ctx.mapData.width + mx];
        const metatileId = getMetatileIdFromMapTile(rawMetatileId);
        const isSecondary = metatileId >= 512;
        const metatile = isSecondary ? secondaryMetatiles[metatileId - 512] : primaryMetatiles[metatileId];
        if (!metatile) continue;

        const attr = isSecondary ? secondaryAttributes[metatileId - 512] : primaryAttributes[metatileId];
        const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

        const screenX = mx * METATILE_SIZE;
        const screenY = my * METATILE_SIZE;

        const drawLayer = (layer: number) => {
          for (let i = 0; i < 4; i++) {
            const tileIndex = layer * 4 + i;
            const tile = metatile.tiles[tileIndex];
            const subX = (i % 2) * TILE_SIZE;
            const subY = Math.floor(i / 2) * TILE_SIZE;
            const palette = palettes[tile.palette];
            if (!palette) continue;

            const tileSource = tile.tileId >= 512 ? 'secondary' : 'primary';
            const tileIdAdjusted = tileSource === 'secondary' ? tile.tileId : tile.tileId;

            drawTileToImageData(
              imageData,
              {
                tileId: tileIdAdjusted,
                destX: screenX + subX,
                destY: screenY + subY,
                palette,
                xflip: tile.xflip,
                yflip: tile.yflip,
                source: tileSource,
              },
              patchedPrimaryTiles,
              secondaryTilesImage
            );
          }
        };

        if (pass === 'background') {
          drawLayer(0);
          if (layerType === METATILE_LAYER_TYPE_COVERED || layerType === METATILE_LAYER_TYPE_SPLIT) {
            drawLayer(1);
          }
        } else {
          if (layerType === METATILE_LAYER_TYPE_NORMAL) {
            drawLayer(1);
          }
        }
      }
    }

    return imageData;
  }, []);

  const buildAnimatedDrawCalls = (ctx: RenderContext) => {
    const bottom: TileDrawCall[] = [];
    const top: TileDrawCall[] = [];

    for (let my = 0; my < ctx.mapData.height; my++) {
      for (let mx = 0; mx < ctx.mapData.width; mx++) {
        const rawMetatileId = ctx.mapData.layout[my * ctx.mapData.width + mx];
        const metatileId = getMetatileIdFromMapTile(rawMetatileId);
        const isSecondary = metatileId >= 512;
        const metatile = isSecondary ? ctx.secondaryMetatiles[metatileId - 512] : ctx.primaryMetatiles[metatileId];
        if (!metatile) continue;
        const attr = isSecondary
          ? ctx.secondaryAttributes[metatileId - 512]
          : ctx.primaryAttributes[metatileId];
        const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

        const screenX = mx * METATILE_SIZE;
        const screenY = my * METATILE_SIZE;

        const processLayer = (layer: number, destination: TileDrawCall[]) => {
          for (let i = 0; i < 4; i++) {
            const tileIndex = layer * 4 + i;
            const tile = metatile.tiles[tileIndex];
            if (tile.tileId >= 512) {
              continue; // animations only patch primary tiles for now
            }
            if (!ANIMATED_TILE_IDS.has(tile.tileId)) continue;
            const subX = (i % 2) * TILE_SIZE;
            const subY = Math.floor(i / 2) * TILE_SIZE;
            const palette = ctx.palettes[tile.palette];
            if (!palette) continue;

            destination.push({
              tileId: tile.tileId,
              destX: screenX + subX,
              destY: screenY + subY,
              palette,
              xflip: tile.xflip,
              yflip: tile.yflip,
              source: 'primary',
            });
          }
        };

        // Background pass tiles
        processLayer(0, bottom);
        if (layerType === METATILE_LAYER_TYPE_COVERED || layerType === METATILE_LAYER_TYPE_SPLIT) {
          processLayer(1, bottom);
        } else if (layerType === METATILE_LAYER_TYPE_NORMAL) {
          processLayer(1, top);
        }
      }
    }

    animatedBottomDrawCallsRef.current = bottom;
    animatedTopDrawCallsRef.current = top;
  };

  const patchAnimatedTiles = useCallback((
    imageData: ImageData | null,
    patchedPrimaryTiles: Uint8Array,
    drawCalls: TileDrawCall[],
    ctx: RenderContext
  ) => {
    if (!imageData || drawCalls.length === 0) return;
    for (const call of drawCalls) {
      drawTileToImageData(imageData, call, patchedPrimaryTiles, ctx.secondaryTilesImage);
    }
  }, []);

  const compositeScene = useCallback((
    flowerFrameIndex: number,
    patchedPrimaryTiles: Uint8Array,
    animationFrameChanged: boolean
  ) => {
    const ctx = renderContextRef.current;
    if (!ctx) return;
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;
    const mainCtx = mainCanvas.getContext('2d');
    if (!mainCtx) return;

    const widthPx = ctx.mapData.width * METATILE_SIZE;
    const heightPx = ctx.mapData.height * METATILE_SIZE;
    ensureAuxiliaryCanvases(widthPx, heightPx);

    const bgCtx = backgroundCanvasRef.current?.getContext('2d');
    const topCtx = topCanvasRef.current?.getContext('2d');
    if (!bgCtx || !topCtx) return;

    // Full build on first render or if caches missing
    if (!backgroundImageDataRef.current || !topImageDataRef.current) {
      backgroundImageDataRef.current = renderPass(ctx, patchedPrimaryTiles, 'background');
      topImageDataRef.current = renderPass(ctx, patchedPrimaryTiles, 'top');
    } else if (animationFrameChanged) {
      patchAnimatedTiles(backgroundImageDataRef.current, patchedPrimaryTiles, animatedBottomDrawCallsRef.current, ctx);
      patchAnimatedTiles(topImageDataRef.current, patchedPrimaryTiles, animatedTopDrawCallsRef.current, ctx);
    }

    if (backgroundImageDataRef.current) {
      bgCtx.putImageData(backgroundImageDataRef.current, 0, 0);
    }
    if (topImageDataRef.current) {
      topCtx.putImageData(topImageDataRef.current, 0, 0);
    }

    mainCtx.clearRect(0, 0, widthPx, heightPx);
    if (backgroundCanvasRef.current) {
      mainCtx.drawImage(backgroundCanvasRef.current, 0, 0);
    }

    if (playerControllerRef.current) {
      playerControllerRef.current.render(mainCtx);
    }

    if (topCanvasRef.current) {
      mainCtx.drawImage(topCanvasRef.current, 0, 0);
    }

    if ((window as unknown as { DEBUG_MAP_RENDER?: boolean }).DEBUG_MAP_RENDER) {
      console.log(
        `[MapRender] frame:${flowerFrameIndex} player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
      );
    }
  }, [patchAnimatedTiles, renderPass]);

  useEffect(() => {
    (window as unknown as { DEBUG_RENDER?: boolean }).DEBUG_RENDER = false;

    const loadAndRender = async () => {
      const generation = renderGenerationRef.current;

      try {
        setLoading(true);
        setError(null);
        backgroundImageDataRef.current = null;
        topImageDataRef.current = null;
        animatedBottomDrawCallsRef.current = [];
        animatedTopDrawCallsRef.current = [];
        patchedPrimaryTilesRef.current = null;
        lastFlowerFrameRef.current = -1;

        const mapData = await loadMapLayout(`${PROJECT_ROOT}/${layoutPath}/map.bin`, width, height);
        const startTileX = Math.floor(mapData.width / 2);
        const startTileY = Math.floor(mapData.height / 2);
        playerControllerRef.current?.setPosition(startTileX, startTileY);

        const primaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${primaryTilesetPath}/metatiles.bin`);
        const primaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/tiles.png`);
        const primaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${primaryTilesetPath}/metatile_attributes.bin`);
        const primaryPalettes: Palette[] = [];
        for (let i = 0; i < 6; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${primaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          primaryPalettes.push(parsePalette(text));
        }

        const secondaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatiles.bin`);
        const secondaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${secondaryTilesetPath}/tiles.png`);
        const secondaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatile_attributes.bin`);
        const secondaryPalettes: Palette[] = [];
        for (let i = 6; i < 13; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${secondaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          secondaryPalettes.push(parsePalette(text));
        }

        // Abort if a newer render cycle started while loading
        if (generation !== renderGenerationRef.current) {
          return;
        }

        const flowerImages: Uint8Array[] = [];
        try {
          const f0 = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/anim/flower/0.png`);
          const f1 = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/anim/flower/1.png`);
          const f2 = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/anim/flower/2.png`);
          flowerImages.push(f0, f1, f0, f2);
        } catch {
          // No animation frames for this tileset
        }

        try {
          await playerControllerRef.current?.loadSprite(`${PROJECT_ROOT}/graphics/object_events/pics/people/brendan/walking.png`);
        } catch (spriteErr) {
          console.error('Failed to load sprite', spriteErr);
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
          secondaryAttributes,
        };

        buildAnimatedDrawCalls(renderContextRef.current);
        setLoading(false);

        let lastTime = 0;
        const loop = (timestamp: number) => {
          if (generation !== renderGenerationRef.current) {
            return;
          }
          if (!lastTime) lastTime = timestamp;
          const delta = timestamp - lastTime;
          lastTime = timestamp;

          const ctx = renderContextRef.current;
          if (!ctx) {
            animRef.current = requestAnimationFrame(loop);
            return;
          }

          const safeDelta = Math.min(delta, 50);
          const playerDirty = playerControllerRef.current?.update(safeDelta, ctx) ?? false;

          const flowerFrameIndex =
            ctx.flowerFrames.length > 0 ? Math.floor(timestamp / 200) % ctx.flowerFrames.length : 0;

          const animationFrameChanged =
            flowerFrameIndex !== lastFlowerFrameRef.current || patchedPrimaryTilesRef.current === null;

          const shouldRender = animationFrameChanged || playerDirty || !hasRenderedRef.current;

          if (shouldRender) {
            const patchedPrimaryTiles =
              buildPatchedPrimaryTiles(flowerFrameIndex) ?? ctx.primaryTilesImage;
            compositeScene(flowerFrameIndex, patchedPrimaryTiles, animationFrameChanged);
            hasRenderedRef.current = true;
          }

          animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(err);
        setError(message);
        setLoading(false);
      }
    };

    loadAndRender();

    return () => {
      renderGenerationRef.current += 1;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mapName, width, height, layoutPath, primaryTilesetPath, secondaryTilesetPath, buildPatchedPrimaryTiles, compositeScene]);

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
