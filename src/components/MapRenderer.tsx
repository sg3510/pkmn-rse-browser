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
import type { BridgeType } from '../utils/metatileBehaviors';
import { getBridgeTypeFromBehavior, isIceBehavior, isReflectiveBehavior } from '../utils/metatileBehaviors';

const PROJECT_ROOT = '/pokeemerald';
const FRAME_MS = 1000 / 60;
const SECONDARY_TILE_OFFSET = TILES_PER_ROW_IN_IMAGE * 32; // 512 tiles
const NUM_PRIMARY_METATILES = 512;

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
  primaryReflectionMeta: ReflectionMeta[];
  secondaryReflectionMeta: ReflectionMeta[];
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

type ReflectionType = 'water' | 'ice';

interface ReflectionMeta {
  isReflective: boolean;
  reflectionType: ReflectionType | null;
  quadrantMask: [boolean, boolean, boolean, boolean]; // top-left, top-right, bottom-left, bottom-right
}

interface TilesetBuffers {
  primary: Uint8Array;
  secondary: Uint8Array;
}

const BRIDGE_OFFSETS: Record<BridgeType, number> = {
  none: 0,
  pondLow: 12,
  pondMed: 28,
  pondHigh: 44,
};

interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}

function buildReflectionMeta(
  metatiles: Metatile[],
  attributes: MetatileAttributes[]
): ReflectionMeta[] {
  return metatiles.map((metatile, index) => {
    const attr = attributes[index];
    const behavior = attr?.behavior ?? -1;
    const isReflective = isReflectiveBehavior(behavior);
    const reflectionType: ReflectionType | null = isReflective
      ? isIceBehavior(behavior)
        ? 'ice'
        : 'water'
      : null;
    const top = metatile.tiles.slice(4, 8);
    const quadrantMask: [boolean, boolean, boolean, boolean] = [
      top[0]?.tileId === 0,
      top[1]?.tileId === 0,
      top[2]?.tileId === 0,
      top[3]?.tileId === 0,
    ];
    return { isReflective, reflectionType, quadrantMask };
  });
}

function getMetatileBehavior(
  ctx: RenderContext,
  tileX: number,
  tileY: number
): { behavior: number; meta: ReflectionMeta | null } | null {
  if (
    tileX < 0 ||
    tileY < 0 ||
    tileX >= ctx.mapData.width ||
    tileY >= ctx.mapData.height
  ) {
    return null;
  }
  const mapTile = ctx.mapData.layout[tileY * ctx.mapData.width + tileX];
  const metatileId = getMetatileIdFromMapTile(mapTile);
  const isSecondary = metatileId >= NUM_PRIMARY_METATILES;
  if (isSecondary) {
    const index = metatileId - NUM_PRIMARY_METATILES;
    const behavior = ctx.secondaryAttributes[index]?.behavior ?? -1;
    return {
      behavior,
      meta: ctx.secondaryReflectionMeta[index] ?? null,
    };
  }
  const behavior = ctx.primaryAttributes[metatileId]?.behavior ?? -1;
  return {
    behavior,
    meta: ctx.primaryReflectionMeta[metatileId] ?? null,
  };
}

function resolveBridgeType(ctx: RenderContext, tileX: number, tileY: number): BridgeType {
  const info = getMetatileBehavior(ctx, tileX, tileY);
  if (!info) return 'none';
  return getBridgeTypeFromBehavior(info.behavior);
}

function computeReflectionState(
  ctx: RenderContext,
  player: PlayerController | null
): ReflectionState {
  if (!player) {
    return { hasReflection: false, reflectionType: null, bridgeType: 'none' };
  }

  const { width, height } = player.getSpriteSize();
  const widthTiles = Math.ceil((width + 8) / 16);
  const heightTiles = Math.ceil((height + 8) / 16);

  const bases = [
    { x: player.tileX, y: player.tileY },
    { x: player.prevTileX, y: player.prevTileY },
  ];

  let found: ReflectionType | null = null;

  for (let i = 0; i < heightTiles && !found; i++) {
    const offsetY = 1 + i;
    for (const base of bases) {
      const y = base.y + offsetY;
      const center = getMetatileBehavior(ctx, base.x, y);
      if (center?.meta?.isReflective) {
        found = center.meta.reflectionType;
        break;
      }
      for (let j = 1; j < widthTiles && !found; j++) {
        const px = base.x + j;
        const nx = base.x - j;
        const infos = [
          getMetatileBehavior(ctx, px, y),
          getMetatileBehavior(ctx, nx, y),
        ];
        for (const info of infos) {
          if (info?.meta?.isReflective) {
            found = info.meta.reflectionType;
            break;
          }
        }
      }
    }
  }

  const bridgeTypeFromCurrent = resolveBridgeType(ctx, player.tileX, player.tileY);
  const bridgeTypeFromPrev = resolveBridgeType(ctx, player.prevTileX, player.prevTileY);
  const bridgeType = bridgeTypeFromCurrent !== 'none' ? bridgeTypeFromCurrent : bridgeTypeFromPrev;

  return {
    hasReflection: !!found,
    reflectionType: found,
    bridgeType,
  };
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
  const renderReflectionLayer = useCallback(
    (mainCtx: CanvasRenderingContext2D, reflectionState: ReflectionState) => {
      const ctx = renderContextRef.current;
      const player = playerControllerRef.current;
      if (!ctx || !player || !reflectionState.hasReflection) return;

      const frame = player.getFrameInfo();
      if (!frame || !frame.sprite) return;

      const { height } = player.getSpriteSize();
      const reflectionX = frame.renderX;
      const reflectionY = frame.renderY + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = frame.sw;
      maskCanvas.height = frame.sh;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

      const startTileX = Math.floor(reflectionX / METATILE_SIZE);
      const endTileX = Math.floor((reflectionX + frame.sw - 1) / METATILE_SIZE);
      const startTileY = Math.floor(reflectionY / METATILE_SIZE);
      const endTileY = Math.floor((reflectionY + frame.sh - 1) / METATILE_SIZE);
      const half = METATILE_SIZE / 2;

      maskCtx.fillStyle = 'black';
      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          const info = getMetatileBehavior(ctx, tx, ty);
          if (!info?.meta?.isReflective) continue;
          const tileLeft = tx * METATILE_SIZE - reflectionX;
          const tileTop = ty * METATILE_SIZE - reflectionY;
          const quads: Array<{ allow: boolean; x: number; y: number }> = [
            { allow: info.meta.quadrantMask[0], x: tileLeft, y: tileTop },
            { allow: info.meta.quadrantMask[1], x: tileLeft + half, y: tileTop },
            { allow: info.meta.quadrantMask[2], x: tileLeft, y: tileTop + half },
            { allow: info.meta.quadrantMask[3], x: tileLeft + half, y: tileTop + half },
          ];
          for (const quad of quads) {
            if (!quad.allow) continue;
            const rx = Math.max(quad.x, 0);
            const ry = Math.max(quad.y, 0);
            const rw = Math.min(half, frame.sw - rx);
            const rh = Math.min(half, frame.sh - ry);
            if (rw > 0 && rh > 0) {
              maskCtx.fillRect(rx, ry, rw, rh);
            }
          }
        }
      }

      const reflectionCanvas = document.createElement('canvas');
      reflectionCanvas.width = frame.sw;
      reflectionCanvas.height = frame.sh;
      const reflectionCtx = reflectionCanvas.getContext('2d');
      if (!reflectionCtx) return;
      reflectionCtx.clearRect(0, 0, frame.sw, frame.sh);
      reflectionCtx.save();
      reflectionCtx.translate(frame.flip ? frame.sw : 0, frame.sh);
      reflectionCtx.scale(frame.flip ? -1 : 1, -1);
      reflectionCtx.drawImage(
        frame.sprite,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        0,
        0,
        frame.sw,
        frame.sh
      );
      reflectionCtx.restore();

      reflectionCtx.globalCompositeOperation = 'source-atop';
      const baseTint =
        reflectionState.reflectionType === 'ice'
          ? 'rgba(180, 220, 255, 0.35)'
          : 'rgba(70, 120, 200, 0.35)';
      const bridgeTint = 'rgba(20, 40, 70, 0.55)';
      reflectionCtx.fillStyle = reflectionState.bridgeType === 'none' ? baseTint : bridgeTint;
      reflectionCtx.fillRect(0, 0, frame.sw, frame.sh);
      reflectionCtx.globalCompositeOperation = 'source-over';

      reflectionCtx.globalCompositeOperation = 'destination-in';
      reflectionCtx.drawImage(maskCanvas, 0, 0);
      reflectionCtx.globalCompositeOperation = 'source-over';

      mainCtx.save();
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.globalAlpha = reflectionState.bridgeType === 'none' ? 0.65 : 0.6;
      mainCtx.drawImage(reflectionCanvas, reflectionX, reflectionY);
      mainCtx.restore();
    },
    []
  );

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
    (
      animKey: string,
      patchedTiles: TilesetBuffers,
      animationFrameChanged: boolean,
      reflectionState: ReflectionState
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

      renderReflectionLayer(mainCtx, reflectionState);

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
    [renderPass, renderReflectionLayer]
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
        const primaryReflectionMeta = buildReflectionMeta(primaryMetatiles, primaryAttributes);
        const primaryPalettes: Palette[] = [];
        for (let i = 0; i < 6; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${primaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          primaryPalettes.push(parsePalette(text));
        }

        const secondaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatiles.bin`);
        const secondaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${secondaryTilesetPath}/tiles.png`);
        const secondaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatile_attributes.bin`);
        const secondaryReflectionMeta = buildReflectionMeta(secondaryMetatiles, secondaryAttributes);
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
          primaryReflectionMeta,
          secondaryReflectionMeta,
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
          const reflectionState = computeReflectionState(ctx, playerControllerRef.current);

          if (shouldRender) {
            const patchedTiles = buildPatchedTiles(animationState) ?? {
              primary: ctx.primaryTilesImage,
              secondary: ctx.secondaryTilesImage,
            };
            compositeScene(animKey, patchedTiles, animationFrameChanged, reflectionState);
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
