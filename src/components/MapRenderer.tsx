import React, { useCallback, useEffect, useRef, useState } from 'react';
import UPNG from 'upng-js';
import { PlayerController } from '../game/PlayerController';
import { MapManager, type TilesetResources, type WorldMapInstance, type WorldState } from '../services/MapManager';
import {
  loadBinary,
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
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { computeCameraView, type CameraView } from '../utils/camera';

const PROJECT_ROOT = '/pokeemerald';
const FRAME_MS = 1000 / 60;
const SECONDARY_TILE_OFFSET = TILES_PER_ROW_IN_IMAGE * 32; // 512 tiles
const NUM_PRIMARY_METATILES = 512;

interface MapRendererProps {
  mapId: string;
  mapName: string;
  width: number;
  height: number;
  layoutPath: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
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

interface TilesetRuntime {
  resources: TilesetResources;
  primaryTileMasks: Uint8Array[];
  secondaryTileMasks: Uint8Array[];
  primaryReflectionMeta: ReflectionMeta[];
  secondaryReflectionMeta: ReflectionMeta[];
  animations: LoadedAnimation[];
  animatedTileIds: { primary: Set<number>; secondary: Set<number> };
  patchedTiles: TilesetBuffers | null;
  lastPatchedKey: string;
}

interface RenderContext {
  world: WorldState;
  tilesetRuntimes: Map<string, TilesetRuntime>;
  anchor: WorldMapInstance;
}

interface ResolvedTile {
  map: WorldMapInstance;
  tileset: TilesetResources;
  metatile: Metatile | null;
  attributes: MetatileAttributes | undefined;
  mapTile: number;
  isSecondary: boolean;
  isBorder: boolean;
}

interface WorldCameraView extends CameraView {
  worldStartTileX: number;
  worldStartTileY: number;
  cameraWorldX: number;
  cameraWorldY: number;
}

function shiftWorld(state: WorldState, shiftX: number, shiftY: number): WorldState {
  const shiftedMaps = state.maps.map((m) => ({
    ...m,
    offsetX: m.offsetX + shiftX,
    offsetY: m.offsetY + shiftY,
  }));
  const minX = Math.min(...shiftedMaps.map((m) => m.offsetX));
  const minY = Math.min(...shiftedMaps.map((m) => m.offsetY));
  const maxX = Math.max(...shiftedMaps.map((m) => m.offsetX + m.mapData.width));
  const maxY = Math.max(...shiftedMaps.map((m) => m.offsetY + m.mapData.height));
  return {
    anchorId: state.anchorId,
    maps: shiftedMaps,
    bounds: { minX, minY, maxX, maxY },
  };
}

const BRIDGE_OFFSETS: Record<BridgeType, number> = {
  none: 0,
  pondLow: 12,
  pondMed: 28,
  pondHigh: 44,
};

const DEBUG_CELL_SCALE = 3;
const DEBUG_CELL_SIZE = METATILE_SIZE * DEBUG_CELL_SCALE;
const DEBUG_GRID_SIZE = DEBUG_CELL_SIZE * 3;
const VIEWPORT_CONFIG = DEFAULT_VIEWPORT_CONFIG;
const VIEWPORT_PIXEL_SIZE = getViewportPixelSize(VIEWPORT_CONFIG);
const CONNECTION_DEPTH = 2; // anchor + direct neighbors + their neighbors

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

function applyBehaviorOverrides(attributes: MetatileAttributes[]): MetatileAttributes[] {
  return attributes;
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

type PaletteRgbLUT = Array<Array<[number, number, number]>>;

function buildPaletteRgbLUT(palettes: Palette[]): PaletteRgbLUT {
  return palettes.map((palette) =>
    palette.colors.map((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b] as [number, number, number];
    })
  );
}

function isWaterColor(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return false; // too dark to be a visible reflection surface

  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  // Hue calculation (0-360)
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) * 60 + 360;
    else if (max === g) hue = ((b - r) / delta) * 60 + 120;
    else hue = ((r - g) / delta) * 60 + 240;
    hue %= 360;
  }

  // Treat blues/cyans (150-260 deg) with even modest saturation as water.
  return hue >= 150 && hue <= 260 && saturation >= 0.05;
}

function isBlueDominantColor(rgb: [number, number, number]): boolean {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return false;
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (saturation < 0.05) return false;
  return b >= g && b >= r + 8;
}

function buildPaletteWaterFlags(paletteRgb: PaletteRgbLUT): boolean[] {
  return paletteRgb.map((colors) => colors.some((c, idx) => idx !== 0 && isBlueDominantColor(c)));
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

function applyWaterMaskToMetatile(
  destMask: Uint8Array,
  tile: Metatile['tiles'][number],
  tileIndex: number,
  tilesPrimary: Uint8Array,
  tilesSecondary: Uint8Array,
  paletteRgb: PaletteRgbLUT,
  useSecondarySheet: boolean
) {
  if (!tile) return;
  const palette = paletteRgb[tile.palette];
  if (!palette) return;

  const localIndex = tileIndex; // 0..3 bottom layer
  const baseX = (localIndex % 2) * TILE_SIZE;
  const baseY = Math.floor(localIndex / 2) * TILE_SIZE;

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const srcX = tile.xflip ? TILE_SIZE - 1 - x : x;
      const srcY = tile.yflip ? TILE_SIZE - 1 - y : y;
      const pixelIndex = sampleTilePixel(
        tile.tileId,
        srcX,
        srcY,
        tilesPrimary,
        tilesSecondary,
        useSecondarySheet
      );
      if (pixelIndex === 0) continue; // treat palette index 0 as non-water / background
      const color = palette[pixelIndex];
      if (!color) continue;
      if (!isWaterColor(color)) continue;
      const destX = baseX + x;
      const destY = baseY + y;
      destMask[destY * METATILE_SIZE + destX] = 1;
    }
  }
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
  secondaryTileMasks: Uint8Array[],
  primaryPalettes: Palette[],
  secondaryPalettes: Palette[],
  primaryTilesImage: Uint8Array,
  secondaryTilesImage: Uint8Array
): ReflectionMeta[] {
  const paletteRgbPrimary = buildPaletteRgbLUT(primaryPalettes);
  const paletteRgbSecondary = buildPaletteRgbLUT(secondaryPalettes);
  const paletteWaterFlagsPrimary = buildPaletteWaterFlags(paletteRgbPrimary);
  const paletteWaterFlagsSecondary = buildPaletteWaterFlags(paletteRgbSecondary);

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

    // Step 1: mark where the bottom layer visually looks like water (blue/teal pixels).
    for (let i = 0; i < 4; i++) {
      const tile = metatile.tiles[i];
      if (!tile) continue;
      const useSecondarySheet = tile.tileId >= SECONDARY_TILE_OFFSET;
      const paletteIndex = tile.palette;
      const paletteWaterFlags = useSecondarySheet
        ? paletteWaterFlagsSecondary
        : paletteWaterFlagsPrimary;
      if (!paletteWaterFlags[paletteIndex]) continue;
      applyWaterMaskToMetatile(
        pixelMask,
        tile,
        i,
        primaryTilesImage,
        secondaryTilesImage,
        useSecondarySheet ? paletteRgbSecondary : paletteRgbPrimary,
        useSecondarySheet
      );
    }

    // Step 2: remove any pixels covered by opaque top-layer tiles.
    for (let i = 4; i < 8; i++) {
      const tile = metatile.tiles[i];
      if (!tile) continue;
      const tileId = tile.tileId;
      const useSecondarySheet = tileId >= SECONDARY_TILE_OFFSET;
      const localId = useSecondarySheet ? tileId - SECONDARY_TILE_OFFSET : tileId;
      const lut = useSecondarySheet
        ? secondaryTileMasks[localId]
        : primaryTileMasks[localId];
      applyTileMaskToMetatile(pixelMask, lut, i, tile.xflip, tile.yflip);
    }

    return { isReflective, reflectionType, pixelMask };
  });
}

function buildTilesetRuntime(resources: TilesetResources): TilesetRuntime {
  const primaryTileMasks = buildTileTransparencyLUT(resources.primaryTilesImage);
  const secondaryTileMasks = buildTileTransparencyLUT(resources.secondaryTilesImage);

  const primaryReflectionMeta = buildReflectionMeta(
    resources.primaryMetatiles,
    resources.primaryAttributes,
    primaryTileMasks,
    secondaryTileMasks,
    resources.primaryPalettes,
    resources.secondaryPalettes,
    resources.primaryTilesImage,
    resources.secondaryTilesImage
  );

  const secondaryReflectionMeta = buildReflectionMeta(
    resources.secondaryMetatiles,
    resources.secondaryAttributes,
    primaryTileMasks,
    secondaryTileMasks,
    resources.primaryPalettes,
    resources.secondaryPalettes,
    resources.primaryTilesImage,
    resources.secondaryTilesImage
  );

  return {
    resources,
    primaryTileMasks,
    secondaryTileMasks,
    primaryReflectionMeta,
    secondaryReflectionMeta,
    animations: [],
    animatedTileIds: { primary: new Set(), secondary: new Set() },
    patchedTiles: null,
    lastPatchedKey: '',
  };
}

function resolveTileAt(ctx: RenderContext, worldTileX: number, worldTileY: number): ResolvedTile | null {
  const map = ctx.world.maps.find(
    (m) =>
      worldTileX >= m.offsetX &&
      worldTileX < m.offsetX + m.mapData.width &&
      worldTileY >= m.offsetY &&
      worldTileY < m.offsetY + m.mapData.height
  );

  if (map) {
    const localX = worldTileX - map.offsetX;
    const localY = worldTileY - map.offsetY;
    const idx = localY * map.mapData.width + localX;
    const mapTile = map.mapData.layout[idx];
    const metatileId = getMetatileIdFromMapTile(mapTile);
    const isSecondary = metatileId >= NUM_PRIMARY_METATILES;
    const metatile = isSecondary
      ? map.tilesets.secondaryMetatiles[metatileId - NUM_PRIMARY_METATILES] ?? null
      : map.tilesets.primaryMetatiles[metatileId] ?? null;
    const attributes = isSecondary
      ? map.tilesets.secondaryAttributes[metatileId - NUM_PRIMARY_METATILES]
      : map.tilesets.primaryAttributes[metatileId];
    return {
      map,
      tileset: map.tilesets,
      metatile,
      attributes,
      mapTile,
      isSecondary,
      isBorder: false,
    };
  }

  const anchor = ctx.anchor;
  const borderTiles = anchor.borderMetatiles;
  if (!borderTiles || borderTiles.length === 0) return null;
  const anchorLocalX = worldTileX - anchor.offsetX;
  const anchorLocalY = worldTileY - anchor.offsetY;
  // Shift pattern one tile up/left so the repeating border visually aligns with GBA behavior.
  const borderIndex = (anchorLocalX & 1) + ((anchorLocalY & 1) * 2);
  const borderMetatileId = borderTiles[borderIndex % borderTiles.length];
  const isSecondary = borderMetatileId >= NUM_PRIMARY_METATILES;
  const metatile = isSecondary
    ? anchor.tilesets.secondaryMetatiles[borderMetatileId - NUM_PRIMARY_METATILES] ?? null
    : anchor.tilesets.primaryMetatiles[borderMetatileId] ?? null;
  const attributes = isSecondary
    ? anchor.tilesets.secondaryAttributes[borderMetatileId - NUM_PRIMARY_METATILES]
    : anchor.tilesets.primaryAttributes[borderMetatileId];
  const mapTile = borderMetatileId | (1 << 10); // mark as impassable like pokeemerald border
  return {
    map: anchor,
    tileset: anchor.tilesets,
    metatile,
    attributes,
    mapTile,
    isSecondary,
    isBorder: true,
  };
}

function getMetatileBehavior(
  ctx: RenderContext,
  tileX: number,
  tileY: number
): { behavior: number; meta: ReflectionMeta | null } | null {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved) return null;
  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  if (!runtime) return null;
  const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
  const meta = resolved.isSecondary
    ? runtime.secondaryReflectionMeta[metatileId - NUM_PRIMARY_METATILES]
    : runtime.primaryReflectionMeta[metatileId];
  const behavior = resolved.attributes?.behavior ?? -1;
  return {
    behavior,
    meta: meta ?? null,
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
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved || !resolved.metatile) {
    return { inBounds: false, tileX, tileY };
  }

  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  const mapTile = resolved.mapTile;
  const metatileId = getMetatileIdFromMapTile(mapTile);
  const isSecondary = resolved.isSecondary;
  const attr = resolved.attributes;
  const meta = resolved.metatile;
  const reflectionMeta = runtime
    ? isSecondary
      ? runtime.secondaryReflectionMeta[metatileId - NUM_PRIMARY_METATILES]
      : runtime.primaryReflectionMeta[metatileId]
    : undefined;
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
  mapId,
  mapName,
  width: _width,
  height: _height,
  layoutPath: _layoutPath,
  primaryTilesetPath: _primaryTilesetPath,
  secondaryTilesetPath: _secondaryTilesetPath,
  primaryTilesetId: _primaryTilesetId,
  secondaryTilesetId: _secondaryTilesetId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const cameraViewRef = useRef<WorldCameraView | null>(null);
  const mapManagerRef = useRef<MapManager>(new MapManager());
  const animRef = useRef<number>(0);
  const hasRenderedRef = useRef<boolean>(false);
  const renderGenerationRef = useRef<number>(0);
  const lastViewKeyRef = useRef<string>('');

  const backgroundImageDataRef = useRef<ImageData | null>(null);
  const topImageDataRef = useRef<ImageData | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugEnabledRef = useRef<boolean>(false);
  const reflectionStateRef = useRef<ReflectionState>({
    hasReflection: false,
    reflectionType: null,
    bridgeType: 'none',
  });
  const tilesetRuntimeCacheRef = useRef<Map<string, TilesetRuntime>>(new Map());
  const debugTilesRef = useRef<DebugTileInfo[]>([]);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const renderReflectionLayer = useCallback(
    (mainCtx: CanvasRenderingContext2D, reflectionState: ReflectionState, view: WorldCameraView) => {
      const ctx = renderContextRef.current;
      const player = playerControllerRef.current;
      if (!ctx || !player || !reflectionState.hasReflection) return;

      const frame = player.getFrameInfo();
      if (!frame || !frame.sprite) return;

      const { height } = player.getSpriteSize();
      const reflectionX = frame.renderX;
      const reflectionY = frame.renderY + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];
      const screenX = Math.round(reflectionX - view.cameraWorldX);
      const screenY = Math.round(reflectionY - view.cameraWorldY);

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
      mainCtx.drawImage(reflectionCanvas, screenX, screenY);
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
    (ctx: RenderContext, player: PlayerController, view: WorldCameraView | null) => {
      if (!debugEnabledRef.current || !view) return;
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
    },
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
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
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [showTileDebug, refreshDebugOverlay]);

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

  const buildPatchedTilesForRuntime = useCallback(
    (runtime: TilesetRuntime, animationState: AnimationState): TilesetBuffers => {
      const animKey = runtime.animations
        .map((anim) => `${anim.id}:${animationState[anim.id] ?? 0}`)
        .join('|');

      if (animKey === runtime.lastPatchedKey && runtime.patchedTiles) {
        return runtime.patchedTiles;
      }

      let patchedPrimary = runtime.resources.primaryTilesImage;
      let patchedSecondary = runtime.resources.secondaryTilesImage;
      let primaryPatched = false;
      let secondaryPatched = false;

      for (const anim of runtime.animations) {
        const rawCycle = animationState[anim.id] ?? 0;
        const tilesetTarget = anim.tileset;
        if (tilesetTarget === 'primary' && !primaryPatched) {
          patchedPrimary = new Uint8Array(runtime.resources.primaryTilesImage);
          primaryPatched = true;
        }
        if (tilesetTarget === 'secondary' && !secondaryPatched) {
          patchedSecondary = new Uint8Array(runtime.resources.secondaryTilesImage);
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

      runtime.lastPatchedKey = animKey;
      runtime.patchedTiles = patched;
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
    async (primaryId: string, secondaryId: string): Promise<LoadedAnimation[]> => {
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

      return loaded;
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

  const ensureTilesetRuntime = useCallback(
    async (tilesets: TilesetResources): Promise<TilesetRuntime> => {
      const cached = tilesetRuntimeCacheRef.current.get(tilesets.key);
      if (cached) return cached;
      const runtime = buildTilesetRuntime(tilesets);
      const animations = await loadTilesetAnimations(tilesets.primaryTilesetId, tilesets.secondaryTilesetId);
      runtime.animations = animations;
      runtime.animatedTileIds = computeAnimatedTileIds(animations);
      tilesetRuntimeCacheRef.current.set(tilesets.key, runtime);
      return runtime;
    },
    [loadTilesetAnimations]
  );

  const drawTileToImageData = (
    imageData: ImageData,
    drawCall: TileDrawCall,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ) => {
    const tiles = drawCall.source === 'primary' ? primaryTiles : secondaryTiles;
    const effectiveTileId =
      drawCall.source === 'secondary'
        ? drawCall.tileId % SECONDARY_TILE_OFFSET
        : drawCall.tileId;

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
      pass: 'background' | 'top',
      skipAnimated: boolean,
      view: WorldCameraView
    ): ImageData => {
      const widthPx = view.tilesWide * METATILE_SIZE;
      const heightPx = view.tilesHigh * METATILE_SIZE;
      const imageData = new ImageData(widthPx, heightPx);
      for (let localY = 0; localY < view.tilesHigh; localY++) {
        const tileY = view.worldStartTileY + localY;
        for (let localX = 0; localX < view.tilesWide; localX++) {
          const tileX = view.worldStartTileX + localX;
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved || !resolved.metatile) continue;
          const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
          if (!runtime) continue;

          const attr = resolved.attributes;
          const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

          const screenX = localX * METATILE_SIZE;
          const screenY = localY * METATILE_SIZE;

          const patchedTiles = runtime.patchedTiles ?? {
            primary: runtime.resources.primaryTilesImage,
            secondary: runtime.resources.secondaryTilesImage,
          };
          const animatedTileIds = runtime.animatedTileIds;
          const metatile = resolved.metatile;

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
              const palette =
                tileSource === 'secondary'
                  ? resolved.tileset.secondaryPalettes[tile.palette]
                  : resolved.tileset.primaryPalettes[tile.palette];
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
                patchedTiles.primary,
                patchedTiles.secondary
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

  const compositeScene = useCallback(
    (
      reflectionState: ReflectionState,
      view: WorldCameraView,
      viewChanged: boolean,
      animationFrameChanged: boolean
    ) => {
      const ctx = renderContextRef.current;
      if (!ctx) return;
      const mainCanvas = canvasRef.current;
      if (!mainCanvas) return;
      const mainCtx = mainCanvas.getContext('2d');
      if (!mainCtx) return;

      const widthPx = view.pixelWidth;
      const heightPx = view.pixelHeight;
      ensureAuxiliaryCanvases(widthPx, heightPx);

      const bgCtx = backgroundCanvasRef.current?.getContext('2d');
      const topCtx = topCanvasRef.current?.getContext('2d');
      if (!bgCtx || !topCtx) return;

      const needsImageData =
        !backgroundImageDataRef.current || !topImageDataRef.current || animationFrameChanged || viewChanged;

      if (needsImageData) {
        backgroundImageDataRef.current = renderPass(
          ctx,
          'background',
          false,
          view
        );
        topImageDataRef.current = renderPass(
          ctx,
          'top',
          false,
          view
        );
      }

      const offsetX = -Math.round(view.subTileOffsetX);
      const offsetY = -Math.round(view.subTileOffsetY);
      bgCtx.clearRect(0, 0, widthPx, heightPx);
      topCtx.clearRect(0, 0, widthPx, heightPx);
      if (backgroundImageDataRef.current) {
        bgCtx.putImageData(backgroundImageDataRef.current, offsetX, offsetY);
      }
      if (topImageDataRef.current) {
        topCtx.putImageData(topImageDataRef.current, offsetX, offsetY);
      }

      mainCtx.clearRect(0, 0, widthPx, heightPx);
      if (backgroundCanvasRef.current) {
        mainCtx.drawImage(backgroundCanvasRef.current, 0, 0);
      }

        renderReflectionLayer(mainCtx, reflectionState, view);

        if (playerControllerRef.current) {
          playerControllerRef.current.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
        }

      if (topCanvasRef.current) {
        mainCtx.drawImage(topCanvasRef.current, 0, 0);
      }

      if ((window as unknown as { DEBUG_MAP_RENDER?: boolean }).DEBUG_MAP_RENDER) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
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
        hasRenderedRef.current = false;
        renderContextRef.current = null;
        cameraViewRef.current = null;
        lastViewKeyRef.current = '';

        const world = await mapManagerRef.current.buildWorld(mapId, CONNECTION_DEPTH);
        const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];

        const tilesetRuntimes = new Map<string, TilesetRuntime>();
        for (const map of world.maps) {
          const runtime = await ensureTilesetRuntime(map.tilesets);
          runtime.resources.primaryAttributes = applyBehaviorOverrides(runtime.resources.primaryAttributes);
          runtime.resources.secondaryAttributes = applyBehaviorOverrides(runtime.resources.secondaryAttributes);
          tilesetRuntimes.set(map.tilesets.key, runtime);
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

        renderContextRef.current = {
          world,
          tilesetRuntimes,
          anchor,
        };
        const startTileX = Math.floor(anchor.mapData.width / 2);
        const startTileY = Math.floor(anchor.mapData.height / 2);
        playerControllerRef.current?.setPosition(startTileX, startTileY);
        playerControllerRef.current?.setTileResolver((tileX, tileY) => {
          const ctx = renderContextRef.current;
          if (!ctx) return null;
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved) return null;
          return { mapTile: resolved.mapTile, attributes: resolved.attributes };
        });
        setLoading(false);

        let lastTime = 0;
        let reanchorInFlight = false;
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
          const playerDirty = playerControllerRef.current?.update(safeDelta) ?? false;
          const player = playerControllerRef.current;
          let view: WorldCameraView | null = null;
          if (player) {
            const focus = player.getCameraFocus();
            if (focus) {
              const bounds = ctx.world.bounds;
              const padX = VIEWPORT_CONFIG.tilesWide;
              const padY = VIEWPORT_CONFIG.tilesHigh;
              const paddedMinX = bounds.minX - padX;
              const paddedMinY = bounds.minY - padY;
              const paddedMaxX = bounds.maxX + padX;
              const paddedMaxY = bounds.maxY + padY;
              const worldWidth = paddedMaxX - paddedMinX;
              const worldHeight = paddedMaxY - paddedMinY;
              const baseView = computeCameraView(
                worldWidth,
                worldHeight,
                focus.x - paddedMinX * METATILE_SIZE,
                focus.y - paddedMinY * METATILE_SIZE,
                VIEWPORT_CONFIG
              );
              view = {
                ...baseView,
                worldStartTileX: baseView.startTileX + paddedMinX,
                worldStartTileY: baseView.startTileY + paddedMinY,
                cameraWorldX: baseView.cameraX + paddedMinX * METATILE_SIZE,
                cameraWorldY: baseView.cameraY + paddedMinY * METATILE_SIZE,
              };
            }
          }
          cameraViewRef.current = view;
          const viewKey = view
            ? `${view.worldStartTileX},${view.worldStartTileY},${view.tilesWide},${view.tilesHigh}`
            : '';
          const viewChanged = viewKey !== lastViewKeyRef.current;
          if (viewChanged) {
            lastViewKeyRef.current = viewKey;
          }

          // Detect if player entered a different map; re-anchor world if needed.
          if (!reanchorInFlight && player) {
            const resolved = resolveTileAt(ctx, player.tileX, player.tileY);
            if (resolved && resolved.map.entry.id !== ctx.anchor.entry.id) {
              reanchorInFlight = true;
              const targetId = resolved.map.entry.id;
              const targetOffsetX = resolved.map.offsetX;
              const targetOffsetY = resolved.map.offsetY;
              const playerWorldX = player.tileX;
              const playerWorldY = player.tileY;
              (async () => {
                const newWorldRaw = await mapManagerRef.current.buildWorld(targetId, CONNECTION_DEPTH);
                // Shift new world so the target map stays at the same world offset as before reanchor.
                const newWorld = shiftWorld(newWorldRaw, targetOffsetX, targetOffsetY);
                const newAnchor =
                  newWorld.maps.find((m) => m.entry.id === targetId) ?? newWorld.maps[0];
                const newTilesetRuntimes = new Map<string, TilesetRuntime>();
                for (const map of newWorld.maps) {
                  const runtime = await ensureTilesetRuntime(map.tilesets);
                  runtime.resources.primaryAttributes = applyBehaviorOverrides(runtime.resources.primaryAttributes);
                  runtime.resources.secondaryAttributes = applyBehaviorOverrides(runtime.resources.secondaryAttributes);
                  newTilesetRuntimes.set(map.tilesets.key, runtime);
                }
                renderContextRef.current = {
                  world: newWorld,
                  tilesetRuntimes: newTilesetRuntimes,
                  anchor: newAnchor,
                };
                // Keep absolute world position when entering new anchor.
                playerControllerRef.current?.setPosition(playerWorldX, playerWorldY);
                playerControllerRef.current?.setTileResolver((tileX, tileY) => {
                  const ctxNew = renderContextRef.current;
                  if (!ctxNew) return null;
                  const res = resolveTileAt(ctxNew, tileX, tileY);
                  if (!res) return null;
                  return { mapTile: res.mapTile, attributes: res.attributes };
                });
                backgroundImageDataRef.current = null;
                topImageDataRef.current = null;
                hasRenderedRef.current = false;
              })().finally(() => {
                reanchorInFlight = false;
              });
            }
          }

          const frameTick = Math.floor(timestamp / FRAME_MS);
          let animationFrameChanged = false;
          for (const runtime of ctx.tilesetRuntimes.values()) {
            const animationState: AnimationState = {};
            for (const anim of runtime.animations) {
              const seqIndex = Math.floor(frameTick / anim.interval);
              animationState[anim.id] = seqIndex;
            }
            const prevKey = runtime.lastPatchedKey;
            buildPatchedTilesForRuntime(runtime, animationState);
            if (runtime.lastPatchedKey !== prevKey) {
              animationFrameChanged = true;
            }
          }

          const shouldRender = animationFrameChanged || playerDirty || !hasRenderedRef.current || viewChanged;
          const reflectionState = computeReflectionState(ctx, playerControllerRef.current);
          reflectionStateRef.current = reflectionState;

          if (shouldRender && view) {
            compositeScene(reflectionState, view, viewChanged, animationFrameChanged);
            if (debugEnabledRef.current && playerControllerRef.current) {
              refreshDebugOverlay(ctx, playerControllerRef.current, view);
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
    mapId,
    mapName,
    compositeScene,
    loadTilesetAnimations,
    buildPatchedTilesForRuntime,
    refreshDebugOverlay,
  ]);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
      <canvas
        ref={canvasRef}
        width={VIEWPORT_PIXEL_SIZE.width}
        height={VIEWPORT_PIXEL_SIZE.height}
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
