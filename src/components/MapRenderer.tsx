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
import {
  getBridgeTypeFromBehavior,
  isIceBehavior,
  isReflectiveBehavior,
  MB_SHALLOW_WATER,
} from '../utils/metatileBehaviors';

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
  pixelMask: Uint8Array; // 16x16 mask where 1 = BG1 transparent (reflection allowed), 0 = opaque
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

// Per-tileset behavior fixes: some Fortree marsh/mud metatiles are tagged as puddles (behavior 22),
// which makes them reflective. Downclass them to shallow water so they keep the foot splash without reflections.
const BEHAVIOR_OVERRIDES: Record<string, Record<number, number>> = {
  gTileset_Fortree: {
    // 628: MB_SHALLOW_WATER,
    629: MB_SHALLOW_WATER,
    636: MB_SHALLOW_WATER,
    637: MB_SHALLOW_WATER,
    648: MB_SHALLOW_WATER,
    649: MB_SHALLOW_WATER,
    650: MB_SHALLOW_WATER,
    656: MB_SHALLOW_WATER,
    657: MB_SHALLOW_WATER,
    658: MB_SHALLOW_WATER,
    664: MB_SHALLOW_WATER,
    665: MB_SHALLOW_WATER,
    666: MB_SHALLOW_WATER,
  },
};
const DEBUG_CELL_SCALE = 3;
const DEBUG_CELL_SIZE = METATILE_SIZE * DEBUG_CELL_SCALE;
const DEBUG_GRID_SIZE = DEBUG_CELL_SIZE * 3;

interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}

interface DebugTileInfo {
  inBounds: boolean;
  tileX: number;
  tileY: number;
  mapTile?: number;
  metatileId?: number;
  isSecondary?: boolean;
  behavior?: number;
  layerType?: number;
  layerTypeLabel?: string;
  isReflective?: boolean;
  reflectionType?: ReflectionType | null;
  reflectionMaskAllow?: number;
  reflectionMaskTotal?: number;
  bottomTiles?: Metatile['tiles'];
  topTiles?: Metatile['tiles'];
}

const TILESET_STRIDE = TILES_PER_ROW_IN_IMAGE * TILE_SIZE; // 128px

function applyBehaviorOverrides(
  attributes: MetatileAttributes[],
  tilesetId: string,
  baseMetatileId: number
): MetatileAttributes[] {
  const overrides = BEHAVIOR_OVERRIDES[tilesetId];
  if (!overrides) return attributes;

  const patched = attributes.map((attr) => ({ ...attr }));
  for (const [metatileIdStr, behavior] of Object.entries(overrides)) {
    const metatileId = Number(metatileIdStr);
    const index = metatileId - baseMetatileId;
    if (index >= 0 && index < patched.length) {
      patched[index] = { ...patched[index], behavior };
    }
  }

  return patched;
}

function buildTileTransparencyLUT(tiles: Uint8Array): Uint8Array[] {
  const tileCount = Math.floor(tiles.length / (TILE_SIZE * TILE_SIZE));
  const lut: Uint8Array[] = new Array(tileCount);
  for (let tileId = 0; tileId < tileCount; tileId++) {
    const tileX = (tileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const tileY = Math.floor(tileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const mask = new Uint8Array(TILE_SIZE * TILE_SIZE);
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const pixel = tiles[(tileY + y) * TILESET_STRIDE + (tileX + x)];
        mask[y * TILE_SIZE + x] = pixel === 0 ? 1 : 0; // 1 = transparent (palette index 0)
      }
    }
    lut[tileId] = mask;
  }
  return lut;
}

function applyTileMaskToMetatile(
  destMask: Uint8Array,
  tileMask: Uint8Array | undefined,
  tileIndex: number,
  xflip: boolean,
  yflip: boolean
) {
  if (!tileMask) return;
  const localIndex = tileIndex - 4; // 0..3 within top layer
  const baseX = (localIndex % 2) * TILE_SIZE;
  const baseY = Math.floor(localIndex / 2) * TILE_SIZE;
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const srcX = xflip ? TILE_SIZE - 1 - x : x;
      const srcY = yflip ? TILE_SIZE - 1 - y : y;
      const allow = tileMask[srcY * TILE_SIZE + srcX];
      if (allow === 0) {
        const destX = baseX + x;
        const destY = baseY + y;
        destMask[destY * METATILE_SIZE + destX] = 0;
      }
    }
  }
}

function buildReflectionMeta(
  metatiles: Metatile[],
  attributes: MetatileAttributes[],
  primaryTileMasks: Uint8Array[],
  secondaryTileMasks: Uint8Array[]
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
    const pixelMask = new Uint8Array(METATILE_SIZE * METATILE_SIZE);
    if (!isReflective) {
      return { isReflective, reflectionType, pixelMask };
    }

    pixelMask.fill(1); // start fully transparent; opaque BG1 pixels will zero it out
    for (let i = 4; i < 8; i++) {
      const tile = metatile.tiles[i];
      if (!tile) continue;
      const tileId = tile.tileId;
      const useSecondary = tileId >= SECONDARY_TILE_OFFSET;
      const lut = useSecondary
        ? secondaryTileMasks[tileId - SECONDARY_TILE_OFFSET]
        : primaryTileMasks[tileId];
      applyTileMaskToMetatile(pixelMask, lut, i, tile.xflip, tile.yflip);
    }

    return { isReflective, reflectionType, pixelMask };
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

function layerTypeToLabel(layerType: number): string {
  switch (layerType) {
    case METATILE_LAYER_TYPE_NORMAL:
      return 'NORMAL';
    case METATILE_LAYER_TYPE_COVERED:
      return 'COVERED';
    case METATILE_LAYER_TYPE_SPLIT:
      return 'SPLIT';
    default:
      return `UNKNOWN_${layerType}`;
  }
}

function describeTile(
  ctx: RenderContext,
  tileX: number,
  tileY: number
): DebugTileInfo {
  if (
    tileX < 0 ||
    tileY < 0 ||
    tileX >= ctx.mapData.width ||
    tileY >= ctx.mapData.height
  ) {
    return { inBounds: false, tileX, tileY };
  }

  const mapTile = ctx.mapData.layout[tileY * ctx.mapData.width + tileX];
  const metatileId = getMetatileIdFromMapTile(mapTile);
  const isSecondary = metatileId >= NUM_PRIMARY_METATILES;
  const attr = isSecondary
    ? ctx.secondaryAttributes[metatileId - NUM_PRIMARY_METATILES]
    : ctx.primaryAttributes[metatileId];
  const meta = isSecondary
    ? ctx.secondaryMetatiles[metatileId - NUM_PRIMARY_METATILES]
    : ctx.primaryMetatiles[metatileId];
  const reflectionMeta = isSecondary
    ? ctx.secondaryReflectionMeta[metatileId - NUM_PRIMARY_METATILES]
    : ctx.primaryReflectionMeta[metatileId];
  const behavior = attr?.behavior;
  const layerType = attr?.layerType;
  const reflectionMaskAllow = reflectionMeta?.pixelMask?.reduce((acc, v) => acc + (v ? 1 : 0), 0);
  const reflectionMaskTotal = reflectionMeta?.pixelMask?.length;

  return {
    inBounds: true,
    tileX,
    tileY,
    mapTile,
    metatileId,
    isSecondary,
    behavior,
    layerType,
    layerTypeLabel: layerType !== undefined ? layerTypeToLabel(layerType) : undefined,
    isReflective: reflectionMeta?.isReflective,
    reflectionType: reflectionMeta?.reflectionType,
    reflectionMaskAllow,
    reflectionMaskTotal,
    bottomTiles: meta?.tiles.slice(0, 4),
    topTiles: meta?.tiles.slice(4, 8),
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
  const widthTiles = (width + 8) >> 4;
  const heightTiles = (height + 8) >> 4;

  const bases = [
    { x: player.tileX, y: player.tileY },
    { x: player.prevTileX, y: player.prevTileY },
  ];

  let found: ReflectionType | null = null;

  for (let i = 0; i < heightTiles && !found; i++) {
    const offsetY = i;
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
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugEnabledRef = useRef<boolean>(false);
  const reflectionStateRef = useRef<ReflectionState>({
    hasReflection: false,
    reflectionType: null,
    bridgeType: 'none',
  });
  const debugTilesRef = useRef<DebugTileInfo[]>([]);
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
      const maskImage = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
      const maskData = maskImage.data;

      const startTileX = Math.floor(reflectionX / METATILE_SIZE);
      const endTileX = Math.floor((reflectionX + frame.sw - 1) / METATILE_SIZE);
      const startTileY = Math.floor(reflectionY / METATILE_SIZE);
      const endTileY = Math.floor((reflectionY + frame.sh - 1) / METATILE_SIZE);
      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          const info = getMetatileBehavior(ctx, tx, ty);
          if (!info?.meta?.isReflective) continue;
          const mask = info.meta.pixelMask;
          const tileLeft = tx * METATILE_SIZE - reflectionX;
          const tileTop = ty * METATILE_SIZE - reflectionY;
          for (let y = 0; y < METATILE_SIZE; y++) {
            const globalY = tileTop + y;
            if (globalY < 0 || globalY >= frame.sh) continue;
            for (let x = 0; x < METATILE_SIZE; x++) {
              const globalX = tileLeft + x;
              if (globalX < 0 || globalX >= frame.sw) continue;
              if (mask[y * METATILE_SIZE + x]) {
                const index = (globalY * frame.sw + globalX) * 4 + 3;
                maskData[index] = 255;
              }
            }
          }
        }
      }
      maskCtx.putImageData(maskImage, 0, 0);

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
  const [showTileDebug, setShowTileDebug] = useState(false);

  // Player Controller
  const playerControllerRef = useRef<PlayerController | null>(null);

  const refreshDebugOverlay = useCallback(
    (ctx: RenderContext, player: PlayerController) => {
      if (!debugEnabledRef.current) return;
      const mainCanvas = canvasRef.current;
      const dbgCanvas = debugCanvasRef.current;
      if (!dbgCanvas || !mainCanvas) return;

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
          const info = describeTile(ctx, tileX, tileY);
          collected.push(info);

          const destX = (dx + 1) * DEBUG_CELL_SIZE;
          const destY = (dy + 1) * DEBUG_CELL_SIZE;
          if (info.inBounds) {
            dbgCtx.drawImage(
              mainCanvas,
              tileX * METATILE_SIZE,
              tileY * METATILE_SIZE,
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
    },
    []
  );

  useEffect(() => {
    playerControllerRef.current = new PlayerController();
    return () => {
      playerControllerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    debugEnabledRef.current = showTileDebug;
    if (
      showTileDebug &&
      renderContextRef.current &&
      canvasRef.current &&
      playerControllerRef.current
    ) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current);
    }
  }, [showTileDebug]);

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

  const handleCopyTileDebug = useCallback(async () => {
    const player = playerControllerRef.current;
    if (!player) return;
    const payload = {
      timestamp: new Date().toISOString(),
      player: {
        tileX: player.tileX,
        tileY: player.tileY,
        x: player.x,
        y: player.y,
        dir: player.dir,
      },
      reflectionState: reflectionStateRef.current,
      tiles: debugTilesRef.current,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy debug info', err);
    }
  }, []);

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
        const secondaryMetatiles = await loadMetatileDefinitions(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatiles.bin`);

        const primaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${primaryTilesetPath}/tiles.png`);
        const secondaryTilesImage = await loadTilesetImage(`${PROJECT_ROOT}/${secondaryTilesetPath}/tiles.png`);

        const primaryTileMasks = buildTileTransparencyLUT(primaryTilesImage);
        const secondaryTileMasks = buildTileTransparencyLUT(secondaryTilesImage);

        let primaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${primaryTilesetPath}/metatile_attributes.bin`);
        let secondaryAttributes = await loadMetatileAttributes(`${PROJECT_ROOT}/${secondaryTilesetPath}/metatile_attributes.bin`);

        primaryAttributes = applyBehaviorOverrides(primaryAttributes, primaryTilesetId, 0);
        secondaryAttributes = applyBehaviorOverrides(
          secondaryAttributes,
          secondaryTilesetId,
          NUM_PRIMARY_METATILES
        );

        const primaryReflectionMeta = buildReflectionMeta(
          primaryMetatiles,
          primaryAttributes,
          primaryTileMasks,
          secondaryTileMasks
        );
        const primaryPalettes: Palette[] = [];
        for (let i = 0; i < 6; i++) {
          const text = await loadText(`${PROJECT_ROOT}/${primaryTilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
          primaryPalettes.push(parsePalette(text));
        }

        const secondaryReflectionMeta = buildReflectionMeta(
          secondaryMetatiles,
          secondaryAttributes,
          primaryTileMasks,
          secondaryTileMasks
        );
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
          reflectionStateRef.current = reflectionState;

          if (shouldRender) {
            const patchedTiles = buildPatchedTiles(animationState) ?? {
              primary: ctx.primaryTilesImage,
              secondary: ctx.secondaryTilesImage,
            };
            compositeScene(animKey, patchedTiles, animationFrameChanged, reflectionState);
            if (debugEnabledRef.current && playerControllerRef.current) {
              refreshDebugOverlay(ctx, playerControllerRef.current);
            }
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
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={showTileDebug}
            onChange={(e) => setShowTileDebug(e.target.checked)}
          />
          Show 3x3 tile debug
        </label>
        {showTileDebug && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <canvas
              ref={debugCanvasRef}
              width={DEBUG_GRID_SIZE}
              height={DEBUG_GRID_SIZE}
              style={{
                border: '1px solid #888',
                imageRendering: 'pixelated',
                width: DEBUG_GRID_SIZE,
                height: DEBUG_GRID_SIZE,
              }}
            />
            <button onClick={handleCopyTileDebug} style={{ alignSelf: 'flex-start' }}>
              Copy tile debug to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
