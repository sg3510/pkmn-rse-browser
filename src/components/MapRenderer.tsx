import React, { useCallback, useEffect, useRef, useState } from 'react';
import UPNG from 'upng-js';
import { PlayerController } from '../game/PlayerController';
import {
  loadMapLayout,
  loadMetatileDefinitions,
  loadTilesetImage,
  parsePalette,
  loadText,
  loadMetatileAttributes,
  loadBinary,
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
import {
  TILESET_ANIMATION_CONFIGS,
  type TilesetAnimationDefinition,
  type TilesetKind,
} from '../data/tilesetAnimations';

const PROJECT_ROOT = '/pokeemerald';
const FRAME_MS = 1000 / 60;
const SECONDARY_TILE_OFFSET = TILES_PER_ROW_IN_IMAGE * 32; // 512 tiles

interface MapRendererProps {
  mapName: string;
  width: number;
  height: number;
  layoutPath: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
}

interface RenderContext {
  mapData: MapData;
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryTilesImage: Uint8Array;
  secondaryTilesImage: Uint8Array;
  palettes: Palette[];
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
}

interface AnimationDestination {
  destStart: number;
  phase?: number;
}

interface LoadedAnimation extends Omit<TilesetAnimationDefinition, 'frames'> {
  frames: Uint8Array[];
  width: number;
  height: number;
  tilesWide: number;
  tilesHigh: number;
  destinations: AnimationDestination[];
  sequence: number[];
}

type AnimationState = Record<string, number>;

interface TileDrawCall {
  tileId: number;
  destX: number;
  destY: number;
  palette: Palette;
  xflip: boolean;
  yflip: boolean;
  source: TilesetKind;
  layer: 0 | 1;
}

interface TilesetBuffers {
  primary: Uint8Array;
  secondary: Uint8Array;
}

export const MapRenderer: React.FC<MapRendererProps> = ({
  mapName,
  width,
  height,
  layoutPath,
  primaryTilesetPath,
  secondaryTilesetPath,
  primaryTilesetId,
  secondaryTilesetId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const animRef = useRef<number>(0);
  const patchedTilesRef = useRef<TilesetBuffers | null>(null);
  const hasRenderedRef = useRef<boolean>(false);
  const renderGenerationRef = useRef<number>(0);
  const animationsRef = useRef<LoadedAnimation[]>([]);
  const lastAnimStateKeyRef = useRef<string>('');
  const lastPatchedKeyRef = useRef<string>('');

  const backgroundImageDataRef = useRef<ImageData | null>(null);
  const topImageDataRef = useRef<ImageData | null>(null);
  const staticLayersDirtyRef = useRef<boolean>(false);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const animatedBottomDrawCallsRef = useRef<TileDrawCall[]>([]);
  const animatedTopDrawCallsRef = useRef<TileDrawCall[]>([]);
  const animatedTileIdsRef = useRef<{ primary: Set<number>; secondary: Set<number> }>({
    primary: new Set(),
    secondary: new Set(),
  });

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

  const buildPatchedTiles = useCallback(
    (animationState: AnimationState): TilesetBuffers | null => {
      const ctx = renderContextRef.current;
      if (!ctx) return null;

      const animKey = animationsRef.current
        .map((anim) => `${anim.id}:${animationState[anim.id] ?? 0}`)
        .join('|');

      if (animKey === lastPatchedKeyRef.current && patchedTilesRef.current) {
        return patchedTilesRef.current;
      }

      let patchedPrimary = ctx.primaryTilesImage;
      let patchedSecondary = ctx.secondaryTilesImage;
      let primaryPatched = false;
      let secondaryPatched = false;

      for (const anim of animationsRef.current) {
        const rawCycle = animationState[anim.id] ?? 0;
        const tilesetTarget = anim.tileset;
        if (tilesetTarget === 'primary' && !primaryPatched) {
          patchedPrimary = new Uint8Array(ctx.primaryTilesImage);
          primaryPatched = true;
        }
        if (tilesetTarget === 'secondary' && !secondaryPatched) {
          patchedSecondary = new Uint8Array(ctx.secondaryTilesImage);
          secondaryPatched = true;
        }

        for (const destination of anim.destinations) {
          const effectiveCycle = rawCycle + (destination.phase ?? 0);
          const useAlt =
            anim.altSequence !== undefined &&
            anim.altSequenceThreshold !== undefined &&
            effectiveCycle >= anim.altSequenceThreshold;
          const seq = useAlt && anim.altSequence ? anim.altSequence : anim.sequence;
          const seqIndexRaw = effectiveCycle % seq.length;
          const seqIndex = seqIndexRaw < 0 ? seqIndexRaw + seq.length : seqIndexRaw;
          const frameIndex = seq[seqIndex] ?? 0;
          const frameData = anim.frames[frameIndex];
          if (!frameData) continue;

          let destId = destination.destStart;
          for (let ty = 0; ty < anim.tilesHigh; ty++) {
            for (let tx = 0; tx < anim.tilesWide; tx++) {
              const sx = tx * TILE_SIZE;
              const sy = ty * TILE_SIZE;
              const targetBuffer = tilesetTarget === 'primary' ? patchedPrimary : patchedSecondary;
              const adjustedDestId =
                tilesetTarget === 'secondary' ? destId - SECONDARY_TILE_OFFSET : destId; // 512 offset removal
              copyTile(
                frameData,
                sx,
                sy,
                anim.width,
                targetBuffer,
                (adjustedDestId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE,
                Math.floor(adjustedDestId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE,
                128
              );
              destId++;
            }
          }
        }
      }

      const patched: TilesetBuffers = {
        primary: patchedPrimary,
        secondary: patchedSecondary,
      };

      lastPatchedKeyRef.current = animKey;
      patchedTilesRef.current = patched;
      return patched;
    },
    []
  );

  const ensureAuxiliaryCanvases = (widthPx: number, heightPx: number) => {
    if (!backgroundCanvasRef.current) {
      backgroundCanvasRef.current = document.createElement('canvas');
    }
    if (!topCanvasRef.current) {
      topCanvasRef.current = document.createElement('canvas');
    }
    if (backgroundCanvasRef.current && topCanvasRef.current) {
      const sizeChanged = canvasSizeRef.current.w !== widthPx || canvasSizeRef.current.h !== heightPx;
      if (sizeChanged) {
        backgroundCanvasRef.current.width = widthPx;
        backgroundCanvasRef.current.height = heightPx;
        topCanvasRef.current.width = widthPx;
        topCanvasRef.current.height = heightPx;
        canvasSizeRef.current = { w: widthPx, h: heightPx };
        staticLayersDirtyRef.current = true;
      }
    }
  };

  const loadIndexedFrame = async (url: string) => {
    const buffer = await loadBinary(url);
    const img = UPNG.decode(buffer);

    let data: Uint8Array;
    if (img.ctype === 3 && img.depth === 4) {
      const packed = new Uint8Array(img.data);
      const unpacked = new Uint8Array(packed.length * 2);
      for (let i = 0; i < packed.length; i++) {
        const byte = packed[i];
        unpacked[i * 2] = (byte >> 4) & 0xF;
        unpacked[i * 2 + 1] = byte & 0xF;
      }
      data = unpacked;
    } else {
      data = new Uint8Array(img.data);
    }

    return { data, width: img.width, height: img.height };
  };

  const loadTilesetAnimations = useCallback(
    async (primaryId: string, secondaryId: string) => {
      const loaded: LoadedAnimation[] = [];
      const requested = [
        ...(TILESET_ANIMATION_CONFIGS[primaryId] ?? []),
        ...(TILESET_ANIMATION_CONFIGS[secondaryId] ?? []),
      ];

      for (const def of requested) {
        try {
          const frames: Uint8Array[] = [];
          let width = 0;
          let height = 0;

          for (const framePath of def.frames) {
            const frame = await loadIndexedFrame(`${PROJECT_ROOT}/${framePath}`);
            frames.push(frame.data);
            width = frame.width;
            height = frame.height;
          }

          const tilesWide = Math.max(1, Math.floor(width / TILE_SIZE));
          const tilesHigh = Math.max(1, Math.floor(height / TILE_SIZE));
          const sequence = def.sequence ?? frames.map((_, i) => i);

          loaded.push({
            ...def,
            frames,
            width,
            height,
            tilesWide,
            tilesHigh,
            sequence,
            destinations: def.destinations,
          });
        } catch (err) {
          console.warn(`Animation ${def.id} not loaded:`, err);
        }
      }

      animationsRef.current = loaded;
    },
    []
  );

  const computeAnimatedTileIds = (animations: LoadedAnimation[]) => {
    const primary = new Set<number>();
    const secondary = new Set<number>();

    for (const anim of animations) {
      for (const dest of anim.destinations) {
        let destId = dest.destStart;
        for (let ty = 0; ty < anim.tilesHigh; ty++) {
          for (let tx = 0; tx < anim.tilesWide; tx++) {
            if (anim.tileset === 'primary') {
              primary.add(destId);
            } else {
              secondary.add(destId);
            }
            destId++;
          }
        }
      }
    }

    return { primary, secondary };
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
      effectiveTileId -= SECONDARY_TILE_OFFSET;
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

  const renderPass = useCallback(
    (
      ctx: RenderContext,
      tiles: TilesetBuffers,
      animatedTileIds: { primary: Set<number>; secondary: Set<number> },
      pass: 'background' | 'top',
      skipAnimated: boolean
    ): ImageData => {
      const widthPx = ctx.mapData.width * METATILE_SIZE;
      const heightPx = ctx.mapData.height * METATILE_SIZE;
      const imageData = new ImageData(widthPx, heightPx);
      const {
        primaryMetatiles,
        secondaryMetatiles,
        palettes,
        primaryAttributes,
        secondaryAttributes,
      } = ctx;

      for (let my = 0; my < ctx.mapData.height; my++) {
        for (let mx = 0; mx < ctx.mapData.width; mx++) {
          const rawMetatileId = ctx.mapData.layout[my * ctx.mapData.width + mx];
          const metatileId = getMetatileIdFromMapTile(rawMetatileId);
          const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
          const metatile = isSecondary
            ? secondaryMetatiles[metatileId - SECONDARY_TILE_OFFSET]
            : primaryMetatiles[metatileId];
          if (!metatile) continue;

          const attr = isSecondary
            ? secondaryAttributes[metatileId - SECONDARY_TILE_OFFSET]
            : primaryAttributes[metatileId];
          const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

          const screenX = mx * METATILE_SIZE;
          const screenY = my * METATILE_SIZE;

          const drawLayer = (layer: number) => {
            for (let i = 0; i < 4; i++) {
              const tileIndex = layer * 4 + i;
              const tile = metatile.tiles[tileIndex];
              const tileSource: TilesetKind =
                tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
              if (skipAnimated) {
                const shouldSkip =
                  tileSource === 'primary'
                    ? animatedTileIds.primary.has(tile.tileId)
                    : animatedTileIds.secondary.has(tile.tileId);
                const skipsForTopPass = pass === 'top' && layer === 1 && shouldSkip;
                const skipsForBottomPass = pass === 'background' && shouldSkip;
                if (skipsForTopPass || skipsForBottomPass) continue;
              }

              const subX = (i % 2) * TILE_SIZE;
              const subY = Math.floor(i / 2) * TILE_SIZE;
              const palette = palettes[tile.palette];
              if (!palette) continue;

              drawTileToImageData(
                imageData,
                {
                  tileId: tile.tileId,
                  destX: screenX + subX,
                  destY: screenY + subY,
                  palette,
                  xflip: tile.xflip,
                  yflip: tile.yflip,
                  source: tileSource,
                  layer: layer as 0 | 1,
                },
                tiles.primary,
                tiles.secondary
              );
            }
          };

          if (pass === 'background') {
            drawLayer(0);
            if (layerType === METATILE_LAYER_TYPE_COVERED || layerType === METATILE_LAYER_TYPE_SPLIT) {
              drawLayer(1);
            }
          } else {
            if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
              drawLayer(1);
            }
          }
        }
      }

      return imageData;
    },
    []
  );

  const buildAnimatedDrawCalls = (ctx: RenderContext) => {
    const bottom: TileDrawCall[] = [];
    const top: TileDrawCall[] = [];
    const animatedTileIds = animatedTileIdsRef.current;

    for (let my = 0; my < ctx.mapData.height; my++) {
      for (let mx = 0; mx < ctx.mapData.width; mx++) {
        const rawMetatileId = ctx.mapData.layout[my * ctx.mapData.width + mx];
        const metatileId = getMetatileIdFromMapTile(rawMetatileId);
        const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
        const metatile = isSecondary
          ? ctx.secondaryMetatiles[metatileId - SECONDARY_TILE_OFFSET]
          : ctx.primaryMetatiles[metatileId];
        if (!metatile) continue;
        const attr = isSecondary
          ? ctx.secondaryAttributes[metatileId - SECONDARY_TILE_OFFSET]
          : ctx.primaryAttributes[metatileId];
        const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

        const screenX = mx * METATILE_SIZE;
        const screenY = my * METATILE_SIZE;

          const processLayer = (layer: number, destination: TileDrawCall[]) => {
            for (let i = 0; i < 4; i++) {
              const tileIndex = layer * 4 + i;
              const tile = metatile.tiles[tileIndex];
              const tileSource: TilesetKind =
                tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
              const isAnimated =
                tileSource === 'primary'
                  ? animatedTileIds.primary.has(tile.tileId)
                  : animatedTileIds.secondary.has(tile.tileId);
              if (!isAnimated) continue;
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
                source: tileSource,
                layer: layer as 0 | 1,
              });
            }
          };

        processLayer(0, bottom);
        if (layerType === METATILE_LAYER_TYPE_COVERED) {
          processLayer(1, bottom);
        } else if (layerType === METATILE_LAYER_TYPE_NORMAL) {
          processLayer(1, top);
        } else if (layerType === METATILE_LAYER_TYPE_SPLIT) {
          processLayer(1, top);
        }
      }
    }

    animatedBottomDrawCallsRef.current = bottom;
    animatedTopDrawCallsRef.current = top;
  };

  const compositeScene = useCallback(
    (animKey: string, patchedTiles: TilesetBuffers, animationFrameChanged: boolean) => {
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

      if (!backgroundImageDataRef.current || !topImageDataRef.current || animationFrameChanged) {
        backgroundImageDataRef.current = renderPass(
          ctx,
          patchedTiles,
          animatedTileIdsRef.current,
          'background',
          false
        );
        topImageDataRef.current = renderPass(
          ctx,
          patchedTiles,
          animatedTileIdsRef.current,
          'top',
          false
        );
        staticLayersDirtyRef.current = true;
      }

      if (staticLayersDirtyRef.current) {
        bgCtx.putImageData(backgroundImageDataRef.current!, 0, 0);
        topCtx.putImageData(topImageDataRef.current!, 0, 0);
        staticLayersDirtyRef.current = false;
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
          `[MapRender] key:${animKey} player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    [renderPass]
  );

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
        patchedTilesRef.current = null;
        staticLayersDirtyRef.current = false;
        lastPatchedKeyRef.current = '';
        lastAnimStateKeyRef.current = '';
        animationsRef.current = [];
        animatedTileIdsRef.current = { primary: new Set(), secondary: new Set() };
        hasRenderedRef.current = false;

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

        try {
          await playerControllerRef.current?.loadSprite(`${PROJECT_ROOT}/graphics/object_events/pics/people/brendan/walking.png`);
        } catch (spriteErr) {
          console.error('Failed to load sprite', spriteErr);
        }

        await loadTilesetAnimations(primaryTilesetId, secondaryTilesetId);
        animatedTileIdsRef.current = computeAnimatedTileIds(animationsRef.current);

        const palettes = [...primaryPalettes, ...secondaryPalettes];
        renderContextRef.current = {
          mapData,
          primaryMetatiles,
          secondaryMetatiles,
          primaryTilesImage,
          secondaryTilesImage,
          palettes,
          primaryAttributes,
          secondaryAttributes,
        };
        staticLayersDirtyRef.current = true;
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

          const animationState: AnimationState = {};
          const frameTick = Math.floor(timestamp / FRAME_MS);
          for (const anim of animationsRef.current) {
            const seqIndex = Math.floor(frameTick / anim.interval);
            animationState[anim.id] = seqIndex;
          }

          const animKey = animationsRef.current
            .map((anim) => `${anim.id}:${animationState[anim.id] ?? 0}`)
            .join('|');

          const animationFrameChanged =
            animKey !== lastAnimStateKeyRef.current || patchedTilesRef.current === null;
          lastAnimStateKeyRef.current = animKey;

          const shouldRender = animationFrameChanged || playerDirty || !hasRenderedRef.current;

          if (shouldRender) {
            const patchedTiles = buildPatchedTiles(animationState) ?? {
              primary: ctx.primaryTilesImage,
              secondary: ctx.secondaryTilesImage,
            };
            compositeScene(animKey, patchedTiles, animationFrameChanged);
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
  }, [
    mapName,
    width,
    height,
    layoutPath,
    primaryTilesetPath,
    secondaryTilesetPath,
    primaryTilesetId,
    secondaryTilesetId,
    buildPatchedTiles,
    compositeScene,
    loadTilesetAnimations,
  ]);

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
