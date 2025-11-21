import React, { useCallback, useEffect, useRef, useState } from 'react';
import UPNG from 'upng-js';
import { PlayerController, type DoorWarpRequest } from '../game/PlayerController';
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
  isArrowWarpBehavior,
  isDoorBehavior,
  isTeleportWarpBehavior,
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { computeCameraView, type CameraView } from '../utils/camera';
import type { WarpEvent } from '../types/maps';

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

type WarpKind = 'door' | 'teleport' | 'arrow';

interface WarpTrigger {
  kind: WarpKind;
  sourceMap: WorldMapInstance;
  warpEvent: WarpEvent;
  behavior: number;
  facing: PlayerController['dir'];
}

interface WarpRuntimeState {
  inProgress: boolean;
  cooldownMs: number;
  lastCheckedTile?: { mapId: string; x: number; y: number };
}

type DoorSize = 1 | 2;

interface DoorAnimDrawable {
  id: number;
  image: HTMLImageElement;
  direction: 'open' | 'close';
  frameCount: number;
  frameHeight: number;
  frameDuration: number;
  worldX: number;
  worldY: number;
  size: DoorSize;
  startedAt: number;
  holdOnComplete?: boolean;
  metatileId: number;
}

interface DoorEntrySequence {
  stage: 'idle' | 'opening' | 'stepping' | 'closing' | 'waitingBeforeFade' | 'fadingOut' | 'warping';
  trigger: WarpTrigger | null;
  targetX: number;
  targetY: number;
  metatileId: number;
  openAnimId?: number;
  closeAnimId?: number;
  playerHidden?: boolean;
  waitStartedAt?: number;
}

interface DoorExitSequence {
  stage: 'idle' | 'opening' | 'stepping' | 'closing' | 'done';
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  openAnimId?: number;
  closeAnimId?: number;
}

interface FadeState {
  mode: 'in' | 'out' | null;
  startedAt: number;
  duration: number;
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
const DOOR_FRAME_HEIGHT = 32;
const DOOR_FRAME_DURATION_MS = 90;
const DOOR_ASSET_MAP: Array<{ metatileIds: number[]; path: string; size: DoorSize }> = [
  { metatileIds: [0x248], path: `${PROJECT_ROOT}/graphics/door_anims/littleroot.png`, size: 1 },
  { metatileIds: [0x249], path: `${PROJECT_ROOT}/graphics/door_anims/birchs_lab.png`, size: 1 },
  { metatileIds: [], path: `${PROJECT_ROOT}/graphics/door_anims/general.png`, size: 1 },
];
const DOOR_FADE_DURATION = 500;
const DOOR_DEBUG_FLAG = 'DEBUG_DOOR_ANIM';

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

function classifyWarpKind(behavior: number): WarpKind | null {
  if (isDoorBehavior(behavior)) return 'door';
  if (isTeleportWarpBehavior(behavior)) return 'teleport';
  if (isArrowWarpBehavior(behavior)) return 'arrow';
  return null;
}

function getDoorAssetForMetatile(metatileId: number): { path: string; size: DoorSize } {
  for (const asset of DOOR_ASSET_MAP) {
    if (asset.metatileIds.length > 0 && asset.metatileIds.includes(metatileId)) {
      return asset;
    }
  }
  return DOOR_ASSET_MAP[DOOR_ASSET_MAP.length - 1];
}

function logDoor(...args: unknown[]) {
  if ((window as unknown as Record<string, boolean>)[DOOR_DEBUG_FLAG]) {
    // eslint-disable-next-line no-console
    console.log('[door]', ...args);
  }
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

function findWarpEventAt(map: WorldMapInstance, worldTileX: number, worldTileY: number): WarpEvent | null {
  if (!map.warpEvents || map.warpEvents.length === 0) return null;
  const localX = worldTileX - map.offsetX;
  const localY = worldTileY - map.offsetY;
  return map.warpEvents.find((warp) => warp.x === localX && warp.y === localY) ?? null;
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

function detectWarpTrigger(ctx: RenderContext, player: PlayerController): WarpTrigger | null {
  const resolved = resolveTileAt(ctx, player.tileX, player.tileY);
  if (!resolved || resolved.isBorder) return null;
  const warpEvent = findWarpEventAt(resolved.map, player.tileX, player.tileY);
  if (!warpEvent) return null;
  const behavior = resolved.attributes?.behavior ?? -1;
  const kind = classifyWarpKind(behavior) ?? 'teleport';
  // Skip arrow warps until forced-movement handling is implemented.
  if (kind === 'arrow') return null;
  return {
    kind,
    sourceMap: resolved.map,
    warpEvent,
    behavior,
    facing: player.dir,
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
  const doorSpriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const doorAnimsRef = useRef<DoorAnimDrawable[]>([]);
  const doorAnimIdRef = useRef<number>(1);
  const playerHiddenRef = useRef<boolean>(false);
  const currentTimestampRef = useRef<number>(0);
  const doorExitRef = useRef<DoorExitSequence>({
    stage: 'idle',
    doorWorldX: 0,
    doorWorldY: 0,
    metatileId: 0,
  });
  const fadeRef = useRef<FadeState>({
    mode: null,
    startedAt: 0,
    duration: DOOR_FADE_DURATION,
  });
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

  const ensureDoorSprite = useCallback(
    async (metatileId: number): Promise<{ image: HTMLImageElement; size: DoorSize }> => {
      const asset = getDoorAssetForMetatile(metatileId);
      const cached = doorSpriteCacheRef.current.get(asset.path);
      if (cached && cached.complete) {
        return { image: cached, size: asset.size };
      }
      const img = new Image();
      img.src = asset.path;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (err) => reject(err);
      });
      doorSpriteCacheRef.current.set(asset.path, img);
      return { image: img, size: asset.size };
    },
    []
  );

  const renderDoorAnimations = useCallback(
    (mainCtx: CanvasRenderingContext2D, view: WorldCameraView, now: number) => {
      const doorAnims = doorAnimsRef.current;
      if (doorAnims.length === 0) return;
      for (const anim of doorAnims) {
        const totalDuration = anim.frameCount * anim.frameDuration;
        const elapsed = now - anim.startedAt;
        
        // Skip rendering if animation is done AND not held
        if (elapsed >= totalDuration && !anim.holdOnComplete) continue;
        
        // Clamp elapsed time to totalDuration when holding on complete
        const clampedElapsed = anim.holdOnComplete ? Math.min(elapsed, totalDuration - 1) : elapsed;
        const frameIndexRaw = Math.floor(clampedElapsed / anim.frameDuration);
        const frameIndex =
          anim.direction === 'open' ? frameIndexRaw : Math.max(0, anim.frameCount - 1 - frameIndexRaw);
        const logKey = `${anim.id}:${frameIndex}`;
        if (!(anim as unknown as { _lastLog?: string })._lastLog || (anim as unknown as { _lastLog?: string })._lastLog !== logKey) {
          (anim as unknown as { _lastLog?: string })._lastLog = logKey;
          logDoor('anim-frame', {
            id: anim.id,
            dir: anim.direction,
            metatileId: anim.metatileId,
            frame: frameIndex,
            worldX: anim.worldX,
            worldY: anim.worldY,
            elapsed,
          });
        }
        const sy = frameIndex * anim.frameHeight;
        const sw = anim.image.width;
        const sh = anim.frameHeight;
        const dx = Math.round(anim.worldX * METATILE_SIZE - view.cameraWorldX);
        const dy = Math.round((anim.worldY - 1) * METATILE_SIZE - view.cameraWorldY);
        const dw = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE;
        const dh = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE * 2;
        mainCtx.drawImage(anim.image, 0, sy, sw, sh, dx, dy, dw, dh);
      }
    },
    []
  );

  const spawnDoorAnimation = useCallback(
    async (
      direction: 'open' | 'close',
      worldX: number,
      worldY: number,
      metatileId: number,
      startedAt: number,
      holdOnComplete: boolean = false
    ): Promise<number | null> => {
      try {
        const { image, size } = await ensureDoorSprite(metatileId);
        const frameCount = Math.max(1, Math.floor(image.height / DOOR_FRAME_HEIGHT));
        const anim: DoorAnimDrawable = {
          id: doorAnimIdRef.current++,
          image,
          direction,
          frameCount,
          frameHeight: DOOR_FRAME_HEIGHT,
          frameDuration: DOOR_FRAME_DURATION_MS,
          worldX,
          worldY,
          size,
          startedAt,
          holdOnComplete,
          metatileId,
        };
        doorAnimsRef.current = [...doorAnimsRef.current, anim];
        logDoor('anim-start', { id: anim.id, direction, metatileId, frameCount, worldX, worldY });
        return anim.id;
      } catch (err) {
        console.warn('Failed to spawn door animation', err);
        return null;
      }
    },
    [ensureDoorSprite]
  );

  const isDoorAnimDone = useCallback((anim: DoorAnimDrawable, now: number) => {
    const elapsed = now - anim.startedAt;
    return elapsed >= anim.frameCount * anim.frameDuration;
  }, []);

  const pruneDoorAnimations = useCallback(
    (now: number) => {
      doorAnimsRef.current = doorAnimsRef.current.filter((anim) => {
        if (anim.holdOnComplete) {
          return true;
        }
        return !isDoorAnimDone(anim, now);
      });
    },
    [isDoorAnimDone]
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

  const rebuildContextForWorld = useCallback(
    async (world: WorldState, anchorId: string) => {
      const anchor = world.maps.find((m) => m.entry.id === anchorId) ?? world.maps[0];
      const tilesetRuntimes = new Map<string, TilesetRuntime>();
      for (const map of world.maps) {
        const runtime = await ensureTilesetRuntime(map.tilesets);
        runtime.resources.primaryAttributes = applyBehaviorOverrides(runtime.resources.primaryAttributes);
        runtime.resources.secondaryAttributes = applyBehaviorOverrides(runtime.resources.secondaryAttributes);
        tilesetRuntimes.set(map.tilesets.key, runtime);
      }
      renderContextRef.current = {
        world,
        tilesetRuntimes,
        anchor,
      };
      backgroundImageDataRef.current = null;
      topImageDataRef.current = null;
      hasRenderedRef.current = false;
    },
    [ensureTilesetRuntime]
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
      animationFrameChanged: boolean,
      nowMs: number
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

      renderDoorAnimations(mainCtx, view, nowMs);
      renderReflectionLayer(mainCtx, reflectionState, view);

      if (playerControllerRef.current && !playerHiddenRef.current) {
        playerControllerRef.current.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
      }

      if (topCanvasRef.current) {
        mainCtx.drawImage(topCanvasRef.current, 0, 0);
      }

      if (fadeRef.current.mode) {
        const elapsed = nowMs - fadeRef.current.startedAt;
        const t = Math.max(0, Math.min(1, elapsed / fadeRef.current.duration));
        const alpha = fadeRef.current.mode === 'out' ? t : 1 - t;
        mainCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        mainCtx.fillRect(0, 0, widthPx, heightPx);
        if (t >= 1) {
          fadeRef.current = { ...fadeRef.current, mode: null };
        }
      }

      if ((window as unknown as { DEBUG_MAP_RENDER?: boolean }).DEBUG_MAP_RENDER) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    [renderPass, renderReflectionLayer, renderDoorAnimations]
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
        await rebuildContextForWorld(world, mapId);

        // Abort if a newer render cycle started while loading
        if (generation !== renderGenerationRef.current) {
          return;
        }

        try {
          await playerControllerRef.current?.loadSprite(`${PROJECT_ROOT}/graphics/object_events/pics/people/brendan/walking.png`);
        } catch (spriteErr) {
          console.error('Failed to load sprite', spriteErr);
        }

        const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
        if (!anchor) {
          throw new Error('Failed to determine anchor map for warp setup');
        }
        const applyTileResolver = () => {
          playerControllerRef.current?.setTileResolver((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return null;
            const resolved = resolveTileAt(ctx, tileX, tileY);
            if (!resolved) return null;
            return { mapTile: resolved.mapTile, attributes: resolved.attributes };
          });
        };
        const startTileX = Math.floor(anchor.mapData.width / 2);
        const startTileY = Math.floor(anchor.mapData.height / 2);
        playerControllerRef.current?.setPosition(startTileX, startTileY);
        applyTileResolver();
        setLoading(false);

        let lastTime = 0;
        let reanchorInFlight = false;
        const warpState: WarpRuntimeState = {
          inProgress: false,
          cooldownMs: 0,
          lastCheckedTile: anchor
            ? { mapId: anchor.entry.id, x: startTileX, y: startTileY }
            : undefined,
        };
        let doorEntry: DoorEntrySequence = {
          stage: 'idle',
          trigger: null,
          targetX: 0,
          targetY: 0,
          metatileId: 0,
        };
        doorExitRef.current = {
          stage: 'idle',
          doorWorldX: 0,
          doorWorldY: 0,
          metatileId: 0,
        };

        const performWarp = async (
          trigger: WarpTrigger,
          options?: { force?: boolean; fromDoor?: boolean }
        ) => {
          if (warpState.inProgress && !options?.force) return;
          warpState.inProgress = true;
          reanchorInFlight = true;
          const shouldUnlockInput = !options?.fromDoor;
          playerControllerRef.current?.lockInput();
          try {
            const targetMapId = trigger.warpEvent.destMap;
            const targetWarpId = trigger.warpEvent.destWarpId;
            const newWorld = await mapManagerRef.current.buildWorld(targetMapId, CONNECTION_DEPTH);
            if (generation !== renderGenerationRef.current) return;
            await rebuildContextForWorld(newWorld, targetMapId);
            if (generation !== renderGenerationRef.current) return;

            const ctxAfter = renderContextRef.current;
            const anchorAfter = ctxAfter?.anchor ?? newWorld.maps[0];
            const destMap =
              ctxAfter?.world.maps.find((m) => m.entry.id === targetMapId) ?? anchorAfter;
            const warpEvents = destMap?.warpEvents ?? [];
            const destWarp = warpEvents[targetWarpId] ?? warpEvents[0];
            if (!destMap || !destWarp) {
              console.warn(`Warp target missing for ${targetMapId} warp ${targetWarpId}`);
              return;
            }
            const destWorldX = destMap.offsetX + destWarp.x;
            const destWorldY = destMap.offsetY + destWarp.y;
            const facing: PlayerController['dir'] =
              trigger.kind === 'door' ? 'down' : trigger.facing;

            playerControllerRef.current?.setPositionAndDirection(destWorldX, destWorldY, facing);
            if (options?.fromDoor && trigger.kind === 'door') {
              playerHiddenRef.current = true;
              doorExitRef.current = {
                stage: 'opening',
                doorWorldX: destWorldX,
                doorWorldY: destWorldY,
                metatileId: getMetatileIdFromMapTile(
                  destMap.mapData.layout[destWarp.y * destMap.mapData.width + destWarp.x]
                ),
              };
              fadeRef.current = {
                mode: 'in',
                startedAt: currentTimestampRef.current,
                duration: DOOR_FADE_DURATION,
              };
            }
            applyTileResolver();
            warpState.lastCheckedTile = { mapId: destMap.entry.id, x: destWorldX, y: destWorldY };
            warpState.cooldownMs = 350;
            backgroundImageDataRef.current = null;
            topImageDataRef.current = null;
            hasRenderedRef.current = false;
            // Clear any remaining door animations from the previous map
            doorAnimsRef.current = [];
          } catch (err) {
            console.error('Warp failed', err);
          } finally {
            if (shouldUnlockInput) {
              playerControllerRef.current?.unlockInput();
              warpState.inProgress = false;
            }
            reanchorInFlight = false;
          }
        };

        const advanceDoorEntry = (now: number) => {
          if (doorEntry.stage === 'idle') return;
          const player = playerControllerRef.current;
          if (!player || !doorEntry.trigger) return;
          if (doorEntry.stage === 'opening') {
            const anim = doorEntry.openAnimId
              ? doorAnimsRef.current.find((a) => a.id === doorEntry.openAnimId)
              : null;
            const openDone = !anim || isDoorAnimDone(anim, now);
            if (openDone) {
              logDoor('entry: door fully open, force step into tile', doorEntry.targetX, doorEntry.targetY);
              player.forceMove('up', true);
              doorEntry.stage = 'stepping';
            }
          } else if (doorEntry.stage === 'stepping') {
            if (!player.isMoving) {
              const startedAt = now;
              logDoor('entry: start door close, hide player');
              spawnDoorAnimation(
                'close',
                doorEntry.targetX,
                doorEntry.targetY,
                doorEntry.metatileId,
                startedAt
              ).then((closeAnimId) => {
                doorEntry.closeAnimId = closeAnimId ?? undefined;
              });
              doorAnimsRef.current = doorAnimsRef.current.filter(
                (anim) => anim.id !== doorEntry.openAnimId
              );
              doorEntry.stage = 'closing';
              playerHiddenRef.current = true;
              doorEntry.playerHidden = true;
            }
          } else if (doorEntry.stage === 'closing') {
            const anim = doorEntry.closeAnimId
              ? doorAnimsRef.current.find((a) => a.id === doorEntry.closeAnimId)
              : null;
            const closeDone = !anim || isDoorAnimDone(anim, now);
            if (closeDone) {
              logDoor('entry: door close complete, showing base tile');
              // Remove the close animation so the base tile shows
              doorAnimsRef.current = doorAnimsRef.current.filter(
                (a) => a.id !== doorEntry.closeAnimId
              );
              doorEntry.stage = 'waitingBeforeFade';
              doorEntry.waitStartedAt = now;
            }
          } else if (doorEntry.stage === 'waitingBeforeFade') {
            const WAIT_DURATION = 250; // ms to show the closed door base tile before fading
            const waitDone = now - (doorEntry.waitStartedAt ?? now) >= WAIT_DURATION;
            if (waitDone) {
              logDoor('entry: start fade out');
              fadeRef.current = { mode: 'out', startedAt: now, duration: DOOR_FADE_DURATION };
              doorEntry.stage = 'fadingOut';
            }
          } else if (doorEntry.stage === 'fadingOut') {
            const fadeDone =
              fadeRef.current.mode === null ||
              now - fadeRef.current.startedAt >= fadeRef.current.duration;
            if (fadeDone) {
              doorEntry.stage = 'warping';
              void (async () => {
                logDoor('entry: warp now');
                await performWarp(doorEntry.trigger as WarpTrigger, { force: true, fromDoor: true });
                doorEntry = {
                  stage: 'idle',
                  trigger: null,
                  targetX: 0,
                  targetY: 0,
                  metatileId: 0,
                  playerHidden: false,
                };
              })();
            }
          }
        };

          const handleDoorWarpAttempt = async (request: DoorWarpRequest) => {
            if (doorEntry.stage !== 'idle' || warpState.inProgress) return;
            const ctx = renderContextRef.current;
            const player = playerControllerRef.current;
            if (!ctx || !player) return;
            const resolved = resolveTileAt(ctx, request.targetX, request.targetY);
          if (!resolved) return;
          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) return;
          const behavior = resolved.attributes?.behavior ?? -1;
          const trigger: WarpTrigger = {
            kind: classifyWarpKind(behavior) ?? 'door',
            sourceMap: resolved.map,
            warpEvent,
            behavior,
            facing: player.dir,
          };
            const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
            const startedAt = performance.now();
            logDoor('entry: start door open', {
              worldX: request.targetX,
              worldY: request.targetY,
              metatileId,
              map: resolved.map.entry.id,
            });
            const openAnimId = await spawnDoorAnimation(
              'open',
              request.targetX,
              request.targetY,
              metatileId,
              startedAt,
              true
            );
          doorEntry = {
            stage: 'opening',
            trigger,
            targetX: request.targetX,
            targetY: request.targetY,
            metatileId,
            openAnimId: openAnimId ?? undefined,
            playerHidden: false,
          };
          warpState.inProgress = true;
          playerHiddenRef.current = false;
          player.lockInput();
        };

        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarpAttempt);
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
          currentTimestampRef.current = timestamp;
          pruneDoorAnimations(timestamp);
          advanceDoorEntry(timestamp);
          const doorExit = doorExitRef.current;
          if (doorExit.stage === 'opening') {
            if (doorExit.openAnimId === undefined) {
              logDoor('exit: start door open', {
                worldX: doorExit.doorWorldX,
                worldY: doorExit.doorWorldY,
                metatileId: doorExit.metatileId,
              });
              spawnDoorAnimation('open', doorExit.doorWorldX, doorExit.doorWorldY, doorExit.metatileId, timestamp, true).then(
                (id) => {
                  doorExitRef.current.openAnimId = id ?? undefined;
                }
              );
            }
            const anim = doorExit.openAnimId
              ? doorAnimsRef.current.find((a) => a.id === doorExit.openAnimId)
              : null;
            const done = !anim || isDoorAnimDone(anim, timestamp);
            if (done) {
              logDoor('exit: step out of door');
              playerControllerRef.current?.forceMove('down', true);
              playerHiddenRef.current = false;
              doorExitRef.current.stage = 'stepping';
            }
          } else if (doorExit.stage === 'stepping') {
            if (!playerControllerRef.current?.isMoving) {
              const start = timestamp;
              logDoor('exit: start door close');
              // Remove the open animation now that we're starting the close
              doorAnimsRef.current = doorAnimsRef.current.filter(
                (anim) => anim.id !== doorExit.openAnimId
              );
              spawnDoorAnimation('close', doorExit.doorWorldX, doorExit.doorWorldY, doorExit.metatileId, start).then(
                (id) => {
                  doorExitRef.current.closeAnimId = id ?? undefined;
                }
              );
              doorExitRef.current.stage = 'closing';
            }
          } else if (doorExit.stage === 'closing') {
            const anim = doorExit.closeAnimId
              ? doorAnimsRef.current.find((a) => a.id === doorExit.closeAnimId)
              : null;
            const done = !anim || isDoorAnimDone(anim, timestamp);
            if (done) {
              logDoor('exit: door close complete');
              // Remove the close animation so the base tile shows
              doorAnimsRef.current = doorAnimsRef.current.filter(
                (a) => a.id !== doorExit.closeAnimId
              );
              doorExitRef.current.stage = 'done';
              warpState.inProgress = false;
              playerControllerRef.current?.unlockInput();
              playerHiddenRef.current = false;
            }
          }
          warpState.cooldownMs = Math.max(0, warpState.cooldownMs - safeDelta);
          const playerDirty = playerControllerRef.current?.update(safeDelta) ?? false;
          const player = playerControllerRef.current;
          if (player && ctx) {
            const resolvedForWarp = resolveTileAt(ctx, player.tileX, player.tileY);
            const lastChecked = warpState.lastCheckedTile;
            const tileChanged =
              !lastChecked ||
              lastChecked.mapId !== resolvedForWarp?.map.entry.id ||
              lastChecked.x !== player.tileX ||
              lastChecked.y !== player.tileY;
            if (tileChanged && resolvedForWarp) {
              warpState.lastCheckedTile = {
                mapId: resolvedForWarp.map.entry.id,
                x: player.tileX,
                y: player.tileY,
              };
              if (!warpState.inProgress && warpState.cooldownMs <= 0) {
                const trigger = detectWarpTrigger(ctx, player);
                if (trigger) {
                  void performWarp(trigger);
                }
              }
            }
          }
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
                await rebuildContextForWorld(newWorld, targetId);
                // Keep absolute world position when entering new anchor.
                playerControllerRef.current?.setPosition(playerWorldX, playerWorldY);
                applyTileResolver();
                warpState.lastCheckedTile = { mapId: targetId, x: playerWorldX, y: playerWorldY };
                warpState.cooldownMs = Math.max(warpState.cooldownMs, 50);
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

          const shouldRender =
            animationFrameChanged ||
            playerDirty ||
            !hasRenderedRef.current ||
            viewChanged ||
            doorAnimsRef.current.length > 0 ||
            fadeRef.current.mode !== null;
          const reflectionState = computeReflectionState(ctx, playerControllerRef.current);
          reflectionStateRef.current = reflectionState;

          if (shouldRender && view) {
            compositeScene(
              reflectionState,
              view,
              viewChanged,
              animationFrameChanged,
              currentTimestampRef.current
            );
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
    rebuildContextForWorld,
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
