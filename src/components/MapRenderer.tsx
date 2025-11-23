import React, { useCallback, useEffect, useRef, useState } from 'react';
import UPNG from 'upng-js';
import { PlayerController, type DoorWarpRequest } from '../game/PlayerController';
import { MapManager, type TilesetResources, type WorldMapInstance, type WorldState } from '../services/MapManager';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { ChunkManager, type RenderRegion, setChunkDebugOptions } from '../rendering/ChunkManager';
import { DebugPanel, type DebugOptions, DEFAULT_DEBUG_OPTIONS } from './DebugPanel';
import {
  loadBinary,
  type Metatile,
  type Palette,
  type MetatileAttributes,
  type MapTileData,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_SPLIT,
  getMetatileIdFromMapTile,
  SECONDARY_TILE_OFFSET,
} from '../utils/mapLoader';
import {
  TILESET_ANIMATION_CONFIGS,
  type TilesetKind,
} from '../data/tilesetAnimations';
import type { BridgeType, CardinalDirection } from '../utils/metatileBehaviors';
import {
  getArrowDirectionFromBehavior,
  isIceBehavior,
  isReflectiveBehavior,
  isArrowWarpBehavior,
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { computeCameraView, type CameraView } from '../utils/camera';
import { DialogSystem } from './dialog';
import type { WarpEvent } from '../types/maps';

const PROJECT_ROOT = '/pokeemerald';
const FRAME_MS = 1000 / 60;

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

import {
  type ReflectionType,
  type ReflectionMeta,
  type TilesetBuffers,
  type TilesetRuntime,
  type RenderContext,
  type ResolvedTile,
  type LoadedAnimation,
  type DebugTileInfo,
  type WarpKind,
} from './map/types';
import {
  resolveTileAt,
  findWarpEventAt,
  detectWarpTrigger,
  isVerticalObject,
  classifyWarpKind,
  computeReflectionState,
} from './map/utils';
import { DebugRenderer } from './map/renderers/DebugRenderer';
import { ObjectRenderer } from './map/renderers/ObjectRenderer';

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
  zoom?: number;
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

export interface WorldCameraView extends CameraView {
  worldStartTileX: number;
  worldStartTileY: number;
  cameraWorldX: number;
  cameraWorldY: number;
}



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
  isAnimatedDoor?: boolean; // If false, skip door animation but still do entry sequence
  entryDirection?: CardinalDirection;
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
  isAnimatedDoor?: boolean; // If false, skip door animation but still do scripted movement
  exitDirection?: 'up' | 'down' | 'left' | 'right'; // Direction to walk when exiting
  openAnimId?: number;
  closeAnimId?: number;
}

interface ArrowOverlayState {
  visible: boolean;
  worldX: number;
  worldY: number;
  direction: CardinalDirection;
  startedAt: number;
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


const DEBUG_CELL_SCALE = 3;
const DEBUG_CELL_SIZE = METATILE_SIZE * DEBUG_CELL_SCALE;
const DEBUG_GRID_SIZE = DEBUG_CELL_SIZE * 3;
const VIEWPORT_CONFIG = DEFAULT_VIEWPORT_CONFIG;
const VIEWPORT_PIXEL_SIZE = getViewportPixelSize(VIEWPORT_CONFIG);
const CONNECTION_DEPTH = 2; // anchor + direct neighbors + their neighbors
const DOOR_FRAME_HEIGHT = 32;
const DOOR_FRAME_DURATION_MS = 90;
/**
 * Complete Door Graphics Mapping Table
 * 
 * Ported from sDoorAnimGraphicsTable in public/pokeemerald/src/field_door.c
 * Maps metatile IDs to their corresponding door animation graphics.
 * 
 * Structure:
 * - metatileIds: Array of metatile IDs that use this door graphic
 * - path: Path to door animation PNG relative to PROJECT_ROOT
 * - size: 1 for standard 1x2 tile doors, 2 for large 2x2 tile doors
 * 
 * The last entry with empty metatileIds array serves as the fallback "general" door.
 */
const DOOR_ASSET_MAP: Array<{ metatileIds: number[]; path: string; size: DoorSize }> = [
  // General/Common doors
  { metatileIds: [0x021], path: `${PROJECT_ROOT}/graphics/door_anims/general.png`, size: 1 }, // METATILE_General_Door
  { metatileIds: [0x061], path: `${PROJECT_ROOT}/graphics/door_anims/poke_center.png`, size: 1 }, // METATILE_General_Door_PokeCenter
  { metatileIds: [0x1CD], path: `${PROJECT_ROOT}/graphics/door_anims/gym.png`, size: 1 }, // METATILE_General_Door_Gym
  { metatileIds: [0x041], path: `${PROJECT_ROOT}/graphics/door_anims/poke_mart.png`, size: 1 }, // METATILE_General_Door_PokeMart
  { metatileIds: [0x1DB], path: `${PROJECT_ROOT}/graphics/door_anims/contest.png`, size: 1 }, // METATILE_General_Door_Contest
  
  // Littleroot/Petalburg/Oldale
  { metatileIds: [0x248], path: `${PROJECT_ROOT}/graphics/door_anims/littleroot.png`, size: 1 }, // METATILE_Petalburg_Door_Littleroot
  { metatileIds: [0x249], path: `${PROJECT_ROOT}/graphics/door_anims/birchs_lab.png`, size: 1 }, // METATILE_Petalburg_Door_BirchsLab
  { metatileIds: [0x287], path: `${PROJECT_ROOT}/graphics/door_anims/oldale.png`, size: 1 }, // METATILE_Petalburg_Door_Oldale
  { metatileIds: [0x224], path: `${PROJECT_ROOT}/graphics/door_anims/petalburg_gym.png`, size: 1 }, // METATILE_PetalburgGym_Door
  
  // Rustboro
  { metatileIds: [0x22F], path: `${PROJECT_ROOT}/graphics/door_anims/rustboro_tan.png`, size: 1 }, // METATILE_Rustboro_Door_Tan
  { metatileIds: [0x21F], path: `${PROJECT_ROOT}/graphics/door_anims/rustboro_gray.png`, size: 1 }, // METATILE_Rustboro_Door_Gray
  
  // Fallarbor
  { metatileIds: [0x2A5], path: `${PROJECT_ROOT}/graphics/door_anims/fallarbor_light_roof.png`, size: 1 }, // METATILE_Fallarbor_Door_LightRoof
  { metatileIds: [0x2F7], path: `${PROJECT_ROOT}/graphics/door_anims/fallarbor_dark_roof.png`, size: 1 }, // METATILE_Fallarbor_Door_DarkRoof
  { metatileIds: [0x36C], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tent.png`, size: 1 }, // METATILE_Fallarbor_Door_BattleTent
  
  // Mauville
  { metatileIds: [0x2AC], path: `${PROJECT_ROOT}/graphics/door_anims/mauville.png`, size: 1 }, // METATILE_Mauville_Door
  { metatileIds: [0x3A1], path: `${PROJECT_ROOT}/graphics/door_anims/verdanturf.png`, size: 1 }, // METATILE_Mauville_Door_Verdanturf
  { metatileIds: [0x289], path: `${PROJECT_ROOT}/graphics/door_anims/cycling_road.png`, size: 1 }, // METATILE_Mauville_Door_CyclingRoad
  { metatileIds: [0x3D4], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tent.png`, size: 1 }, // METATILE_Mauville_Door_BattleTent
  
  // Slateport
  { metatileIds: [0x2DC], path: `${PROJECT_ROOT}/graphics/door_anims/slateport.png`, size: 1 }, // METATILE_Slateport_Door
  { metatileIds: [0x393], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tent.png`, size: 1 }, // METATILE_Slateport_Door_BattleTent
  
  // Dewford
  { metatileIds: [0x225], path: `${PROJECT_ROOT}/graphics/door_anims/dewford.png`, size: 1 }, // METATILE_Dewford_Door
  { metatileIds: [0x25D], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tower_old.png`, size: 1 }, // METATILE_Dewford_Door_BattleTower
  
  // Lilycove
  { metatileIds: [0x246], path: `${PROJECT_ROOT}/graphics/door_anims/lilycove.png`, size: 1 }, // METATILE_Lilycove_Door
  { metatileIds: [0x28E], path: `${PROJECT_ROOT}/graphics/door_anims/lilycove_wooden.png`, size: 1 }, // METATILE_Lilycove_Door_Wooden
  { metatileIds: [0x30C], path: `${PROJECT_ROOT}/graphics/door_anims/lilycove_dept_store.png`, size: 1 }, // METATILE_Lilycove_Door_DeptStore
  { metatileIds: [0x32D], path: `${PROJECT_ROOT}/graphics/door_anims/safari_zone.png`, size: 1 }, // METATILE_Lilycove_Door_SafariZone
  
  // Mossdeep
  { metatileIds: [0x2A1], path: `${PROJECT_ROOT}/graphics/door_anims/mossdeep.png`, size: 1 }, // METATILE_Mossdeep_Door
  { metatileIds: [0x2ED], path: `${PROJECT_ROOT}/graphics/door_anims/mossdeep_space_center.png`, size: 1 }, // METATILE_Mossdeep_Door_SpaceCenter
  
  // Sootopolis
  { metatileIds: [0x21C], path: `${PROJECT_ROOT}/graphics/door_anims/sootopolis_peaked_roof.png`, size: 1 }, // METATILE_Sootopolis_Door_PeakedRoof
  { metatileIds: [0x21E], path: `${PROJECT_ROOT}/graphics/door_anims/sootopolis.png`, size: 1 }, // METATILE_Sootopolis_Door
  
  // Ever Grande / Pokemon League
  { metatileIds: [0x21D], path: `${PROJECT_ROOT}/graphics/door_anims/pokemon_league.png`, size: 1 }, // METATILE_EverGrande_Door_PokemonLeague
  
  // Pacifidlog
  { metatileIds: [0x21A], path: `${PROJECT_ROOT}/graphics/door_anims/pacifidlog.png`, size: 1 }, // METATILE_Pacifidlog_Door
  
  // Special Buildings
  { metatileIds: [0x264], path: `${PROJECT_ROOT}/graphics/door_anims/cable_club.png`, size: 1 }, // METATILE_PokemonCenter_Door_CableClub
  { metatileIds: [0x285], path: `${PROJECT_ROOT}/graphics/door_anims/lilycove_dept_store_elevator.png`, size: 1 }, // METATILE_Shop_Door_Elevator
  
  // Abandoned Ship
  { metatileIds: [0x22B], path: `${PROJECT_ROOT}/graphics/door_anims/abandoned_ship.png`, size: 1 }, // METATILE_InsideShip_IntactDoor_Bottom_Unlocked
  { metatileIds: [0x297], path: `${PROJECT_ROOT}/graphics/door_anims/abandoned_ship_room.png`, size: 1 }, // METATILE_InsideShip_IntactDoor_Bottom_Interior
  
  // Battle Frontier - Outside West
  { metatileIds: [0x28A], path: `${PROJECT_ROOT}/graphics/door_anims/battle_dome.png`, size: 1 }, // METATILE_BattleFrontierOutsideWest_Door_BattleDome
  { metatileIds: [0x263], path: `${PROJECT_ROOT}/graphics/door_anims/battle_factory.png`, size: 1 }, // METATILE_BattleFrontierOutsideWest_Door_BattleFactory
  { metatileIds: [0x3FC], path: `${PROJECT_ROOT}/graphics/door_anims/battle_frontier.png`, size: 1 }, // METATILE_BattleFrontierOutsideWest_Door
  { metatileIds: [0x396], path: `${PROJECT_ROOT}/graphics/door_anims/battle_frontier_sliding.png`, size: 1 }, // METATILE_BattleFrontierOutsideWest_Door_Sliding
  
  // Battle Frontier - Outside East
  { metatileIds: [0x329], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tower.png`, size: 1 }, // METATILE_BattleFrontierOutsideEast_Door_BattleTower
  { metatileIds: [0x291], path: `${PROJECT_ROOT}/graphics/door_anims/battle_arena.png`, size: 1 }, // METATILE_BattleFrontierOutsideEast_Door_BattleArena
  
  // Battle Frontier - Interiors
  { metatileIds: [0x20E], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tower_elevator.png`, size: 1 }, // METATILE_BattleFrontier_Door_Elevator
  { metatileIds: [0x2AD], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tower_multi_corridor.png`, size: 2 }, // METATILE_BattleFrontier_Door_MultiCorridor (size 2!)
  { metatileIds: [0x21B], path: `${PROJECT_ROOT}/graphics/door_anims/battle_arena_lobby.png`, size: 1 }, // METATILE_BattleArena_Door
  { metatileIds: [0x209], path: `${PROJECT_ROOT}/graphics/door_anims/battle_dome_lobby.png`, size: 1 }, // METATILE_BattleDome_Door_Lobby
  { metatileIds: [0x25E], path: `${PROJECT_ROOT}/graphics/door_anims/battle_dome_corridor.png`, size: 1 }, // METATILE_BattleDome_Door_Corridor
  { metatileIds: [0x20A], path: `${PROJECT_ROOT}/graphics/door_anims/battle_dome_pre_battle_room.png`, size: 1 }, // METATILE_BattleDome_Door_PreBattleRoom
  { metatileIds: [0x219], path: `${PROJECT_ROOT}/graphics/door_anims/battle_palace_lobby.png`, size: 1 }, // METATILE_BattlePalace_Door
  { metatileIds: [0x26B], path: `${PROJECT_ROOT}/graphics/door_anims/battle_tent_interior.png`, size: 1 }, // METATILE_BattleTent_Door
  
  // Trainer Hill
  { metatileIds: [0x32C], path: `${PROJECT_ROOT}/graphics/door_anims/trainer_hill_lobby_elevator.png`, size: 1 }, // METATILE_TrainerHill_Door_Elevator_Lobby
  { metatileIds: [0x383], path: `${PROJECT_ROOT}/graphics/door_anims/trainer_hill_roof_elevator.png`, size: 1 }, // METATILE_TrainerHill_Door_Elevator_Roof
  
  // Unused/Cut content
  { metatileIds: [0x3B0], path: `${PROJECT_ROOT}/graphics/door_anims/unused_battle_frontier.png`, size: 1 }, // Unused Battle Frontier door
  
  // Fallback - must be last with empty metatileIds
  { metatileIds: [], path: `${PROJECT_ROOT}/graphics/door_anims/general.png`, size: 1 }, // Default fallback
];
const DOOR_FADE_DURATION = 500;
const DEBUG_MODE_FLAG = 'DEBUG_MODE'; // Global debug flag for console logging
const ARROW_SPRITE_PATH = `${PROJECT_ROOT}/graphics/field_effects/pics/arrow.png`;
const DIRECTION_VECTORS: Record<CardinalDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Feature flag for hardware-accelerated rendering
// Set to false to fall back to original ImageData-based rendering
const USE_HARDWARE_RENDERING = true;
// Feature flag for chunk-based caching (currently used for background layer only)
const USE_CHUNK_CACHE = true;

interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}



const TILESET_STRIDE = TILES_PER_ROW_IN_IMAGE * TILE_SIZE; // 128px

function applyBehaviorOverrides(attributes: MetatileAttributes[]): MetatileAttributes[] {
  return attributes;
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
  if (isDebugMode()) {
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
  zoom = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const playerControllerRef = useRef<PlayerController | null>(null);
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
  const arrowOverlayRef = useRef<ArrowOverlayState | null>(null);
  const arrowSpriteRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const arrowSpritePromiseRef = useRef<Promise<HTMLImageElement | HTMLCanvasElement> | null>(null);
  const grassSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const longGrassSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const sandSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRendererRef = useRef<CanvasRenderer | null>(null); // Hardware-accelerated renderer
  const chunkManagerRef = useRef<ChunkManager | null>(null);
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
      // COMPREHENSIVE DEBUG LOGGING
      const stackTrace = new Error().stack;
      if (isDebugMode()) {
        console.log('[DOOR_SPAWN]', {
          direction,
          worldX,
          worldY,
          metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
          holdOnComplete,
          calledFrom: stackTrace?.split('\n')[2]?.trim() || 'unknown',
        });
      }
      
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
        if (isDebugMode()) {
          console.warn('Failed to spawn door animation', err);
        }
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

  const ensureArrowSprite = useCallback((): Promise<HTMLImageElement | HTMLCanvasElement> => {
    if (arrowSpriteRef.current) {
      return Promise.resolve(arrowSpriteRef.current);
    }
    if (!arrowSpritePromiseRef.current) {
      arrowSpritePromiseRef.current = new Promise<HTMLImageElement | HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        img.src = ARROW_SPRITE_PATH;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to acquire arrow sprite context'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const colorCounts = new Map<number, number>();
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha === 0) continue;
            const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
          }
          let bgKey = 0;
          let bgCount = -1;
          for (const [key, count] of colorCounts.entries()) {
            if (count > bgCount) {
              bgKey = key;
              bgCount = count;
            }
          }
          const bgR = (bgKey >> 16) & 0xff;
          const bgG = (bgKey >> 8) & 0xff;
          const bgB = bgKey & 0xff;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imageData, 0, 0);
          arrowSpriteRef.current = canvas;
          resolve(canvas);
        };
        img.onerror = (err) => reject(err);
      }).finally(() => {
        arrowSpritePromiseRef.current = null;
      }) as Promise<HTMLImageElement | HTMLCanvasElement>;
    }
    return arrowSpritePromiseRef.current!;
  }, []);

  const updateArrowOverlay = useCallback(
    (
      player: PlayerController | null,
      ctx: RenderContext | null,
      resolvedTile: ResolvedTile | null,
      now: number,
      warpInProgress: boolean
    ) => {
      if (!player || !ctx || warpInProgress) {
        arrowOverlayRef.current = null;
        return;
      }
      const tile = resolvedTile ?? resolveTileAt(ctx, player.tileX, player.tileY);
      if (!tile) {
        arrowOverlayRef.current = null;
        return;
      }
      const behavior = tile.attributes?.behavior ?? -1;
      const arrowDir = getArrowDirectionFromBehavior(behavior);
      if (!arrowDir || player.dir !== arrowDir) {
        arrowOverlayRef.current = null;
        return;
      }
      if (!arrowSpriteRef.current && !arrowSpritePromiseRef.current) {
        ensureArrowSprite().catch((err) => {
          if (isDebugMode()) {
            console.warn('Failed to load arrow sprite', err);
          }
        });
      }
      const vector = DIRECTION_VECTORS[arrowDir];
      const overlayWorldX = player.tileX + vector.dx;
      const overlayWorldY = player.tileY + vector.dy;
      const prev = arrowOverlayRef.current;
      const isNewOverlay = !prev || !prev.visible || prev.direction !== arrowDir;
      arrowOverlayRef.current = {
        visible: true,
        worldX: overlayWorldX,
        worldY: overlayWorldY,
        direction: arrowDir,
        startedAt: isNewOverlay ? now : prev.startedAt,
      };
    },
    [ensureArrowSprite]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [inspectTarget, setInspectTarget] = useState<{ tileX: number; tileY: number } | null>(null);
  const [centerTileDebugInfo, setCenterTileDebugInfo] = useState<DebugTileInfo | null>(null);

  // Derived state for backwards compatibility
  const showTileDebug = debugOptions.enabled;
  const debugFocusMode = debugOptions.focusMode;

  // Canvas refs for layer decomposition
  const bottomLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync debug options with chunk manager and global flag
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG] = debugOptions.enabled;
    setChunkDebugOptions({
      showBorders: debugOptions.showChunkBorders,
      logOperations: debugOptions.logChunkOperations,
    });
  }, [debugOptions]);

  // Player Controller


  const refreshDebugOverlay = useCallback(
    (
      ctx: RenderContext,
      player: PlayerController | null,
      view: WorldCameraView | null,
      centerOverride?: { tileX: number; tileY: number }
    ) => {
      if (!debugEnabledRef.current || !view) return;
      const mainCanvas = canvasRef.current;
      const dbgCanvas = debugCanvasRef.current;
      if (!dbgCanvas || !mainCanvas) return;

      const centerTile =
        centerOverride ??
        (debugFocusMode === 'inspect' && inspectTarget
          ? inspectTarget
          : player
            ? { tileX: player.tileX, tileY: player.tileY }
            : null);

      if (!centerTile) return;

      DebugRenderer.renderDebugOverlay(
        ctx,
        centerTile,
        player ?? undefined,
        view,
        mainCanvas,
        dbgCanvas,
        setCenterTileDebugInfo,
        debugTilesRef
      );
    },
    [debugFocusMode, inspectTarget, setCenterTileDebugInfo]
  );

  // Click-to-inspect handler for debug overlay
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!showTileDebug || debugFocusMode !== 'inspect') return;
      const view = cameraViewRef.current;
      if (!view) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const localX = (e.clientX - rect.left) * scaleX;
      const localY = (e.clientY - rect.top) * scaleY;
      const worldPixelX = view.cameraWorldX + localX;
      const worldPixelY = view.cameraWorldY + localY;
      const tileX = Math.floor(worldPixelX / METATILE_SIZE);
      const tileY = Math.floor(worldPixelY / METATILE_SIZE);
      setInspectTarget({ tileX, tileY });
      if (renderContextRef.current) {
        refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, view, { tileX, tileY });
      }
    },
    [debugFocusMode, refreshDebugOverlay, showTileDebug]
  );

  // Render layer decomposition canvases
  const renderLayerDecomposition = useCallback((ctx: RenderContext, tileInfo: DebugTileInfo) => {
    if (!tileInfo || !tileInfo.inBounds) return;
    
    const bottomCanvas = bottomLayerCanvasRef.current;
    const topCanvas = topLayerCanvasRef.current;
    const compositeCanvas = compositeLayerCanvasRef.current;
    
    if (!bottomCanvas || !topCanvas || !compositeCanvas) return;

    DebugRenderer.renderLayerDecomposition(
      ctx,
      tileInfo,
      bottomCanvas,
      topCanvas,
      compositeCanvas
    );
  }, []);

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
      canvasRef.current
    ) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [showTileDebug, refreshDebugOverlay]);

  useEffect(() => {
    if (!showTileDebug || !renderContextRef.current) return;
    refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
  }, [debugFocusMode, inspectTarget, showTileDebug, refreshDebugOverlay]);
  
  // Update layer decomposition when center tile changes
  useEffect(() => {
    if (showTileDebug && centerTileDebugInfo && renderContextRef.current) {
      renderLayerDecomposition(renderContextRef.current, centerTileDebugInfo);
    }
  }, [showTileDebug, centerTileDebugInfo, renderLayerDecomposition]);

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
          if (isDebugMode()) {
            console.warn(`Animation ${def.id} not loaded:`, err);
          }
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
      backgroundCanvasDataRef.current = null;
      topBelowCanvasDataRef.current = null;
      topAboveCanvasDataRef.current = null;
      chunkManagerRef.current?.clear();
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

  // Hardware-accelerated version using Canvas drawImage
  const drawTileToCanvas = (
    ctx: CanvasRenderingContext2D,
    drawCall: TileDrawCall,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ) => {
    const renderer = canvasRendererRef.current;
    if (!renderer) {
      // Fallback shouldn't happen, but handle gracefully
      if (isDebugMode()) {
        console.warn('Canvas renderer not initialized');
      }
      return;
    }

    renderer.drawTile(
      ctx,
      {
        tileId: drawCall.tileId,
        destX: drawCall.destX,
        destY: drawCall.destY,
        palette: drawCall.palette,
        xflip: drawCall.xflip,
        yflip: drawCall.yflip,
        source: drawCall.source,
      },
      primaryTiles,
      secondaryTiles  // FIX: Pass both tileset arrays correctly
    );
  };

  const topBelowImageDataRef = useRef<ImageData | null>(null);
  const topAboveImageDataRef = useRef<ImageData | null>(null);
  const lastPlayerElevationRef = useRef<number>(0);

  // Canvas-based rendering refs (for hardware-accelerated mode)
  const backgroundCanvasDataRef = useRef<HTMLCanvasElement | null>(null);
  const topBelowCanvasDataRef = useRef<HTMLCanvasElement | null>(null);
  const topAboveCanvasDataRef = useRef<HTMLCanvasElement | null>(null);

  const renderPass = useCallback(
    (
      ctx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      view: WorldCameraView,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
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

          // DEBUG: Trace rendering decision for specific tile
          if (tileX === 19 && tileY === 70) {
             const playerElev = playerControllerRef.current?.getElevation() ?? 0;
             const tileElev = resolved.mapTile.elevation;
             const tileCol = resolved.mapTile.collision;
             const filteredOut = elevationFilter ? !elevationFilter(resolved.mapTile, tileX, tileY) : false;
             if (isDebugMode()) {
               console.log(`[RENDER_DEBUG] Tile (19, 70) Pass=${pass} PlayerElev=${playerElev} TileElev=${tileElev} Col=${tileCol} FilteredOut=${filteredOut}`);
             }
          }
          
          // Apply elevation filter if provided
          if (elevationFilter && !elevationFilter(resolved.mapTile, tileX, tileY)) {
            continue;
          }

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
              // Palette selection based on palette INDEX, not tile source
              // Palettes 0-5 come from primary tileset, 6-15 from secondary
              // (Secondary tiles can use primary palettes and vice versa)
              const NUM_PALS_IN_PRIMARY = 6;
              const palette = tile.palette < NUM_PALS_IN_PRIMARY
                ? resolved.tileset.primaryPalettes[tile.palette]
                : resolved.tileset.secondaryPalettes[tile.palette];
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
            // Background pass: always draw layer 0
            drawLayer(0);
            // For COVERED type, also draw layer 1 in background (both layers behind player)
            if (layerType === METATILE_LAYER_TYPE_COVERED) {
              drawLayer(1);
            }
            // For SPLIT type, layer 1 goes to top pass only (layer 0 behind, layer 1 above player)
          } else {
            // Top pass: draw layer 1 for NORMAL and SPLIT types (above player)
            if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
              // CRITICAL FIX: Check elevation filter before rendering
              // If an elevationFilter is provided, only render if the filter returns true
              // This allows splitting NORMAL tiles between topBelow and topAbove passes
              const shouldRender = !elevationFilter || elevationFilter(resolved.mapTile, tileX, tileY);
              
              if (shouldRender) {
                // Debug logging for metatile 13
                if (isDebugMode() && metatile.id === 13 && tileX >= 0 && tileX < 5 && tileY >= 0 && tileY < 5) {
                  console.log(`[METATILE 13] Top pass rendering layer 1 at (${tileX}, ${tileY}), layerType=${layerType}`);
                }
                drawLayer(1);
              } else if (isDebugMode() && metatile.id >= 14 && metatile.id <= 15) {
                console.log(`[RENDER_FIX] Skipping metatile ${metatile.id} at (${tileX}, ${tileY}) due to elevation filter. Elev=${resolved.mapTile.elevation}, PlayerElev=${playerControllerRef.current?.getElevation()}`);
              }
            }
          }
        }
      }

      return imageData;
    },
    []
  );

  const drawRegionToContext = useCallback(
    (
      targetCtx: CanvasRenderingContext2D,
      renderCtx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      onlyAnimated: boolean,
      startTileX: number,
      startTileY: number,
      tilesWide: number,
      tilesHigh: number,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
    ) => {
      for (let localY = 0; localY < tilesHigh; localY++) {
        const tileY = startTileY + localY;
        for (let localX = 0; localX < tilesWide; localX++) {
          const tileX = startTileX + localX;
          const resolved = resolveTileAt(renderCtx, tileX, tileY);
          if (!resolved || !resolved.metatile) continue;

          // DEBUG: Trace rendering decision for specific tile
          if (tileX === 19 && tileY === 70) {
            const playerElev = playerControllerRef.current?.getElevation() ?? 0;
            const tileElev = resolved.mapTile.elevation;
            const tileCol = resolved.mapTile.collision;
            const filteredOut = elevationFilter ? !elevationFilter(resolved.mapTile, tileX, tileY) : false;
            if (isDebugMode()) {
              console.log(`[RENDER_DEBUG_CANVAS] Tile (19, 70) Pass=${pass} PlayerElev=${playerElev} TileElev=${tileElev} Col=${tileCol} FilteredOut=${filteredOut}`);
            }
          }

          // Apply elevation filter if provided
          if (elevationFilter && !elevationFilter(resolved.mapTile, tileX, tileY)) {
            continue;
          }

          const runtime = renderCtx.tilesetRuntimes.get(resolved.tileset.key);
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
              const tileSource = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';

              if (skipAnimated) {
              const shouldSkip =
                tileSource === 'primary'
                  ? animatedTileIds.primary.has(tile.tileId)
                  : animatedTileIds.secondary.has(tile.tileId);
              const skipsForTopPass = pass === 'top' && layer === 1 && shouldSkip;
              const skipsForBottomPass = pass === 'background' && shouldSkip;
              if (skipsForTopPass || skipsForBottomPass) continue;
            }

            if (onlyAnimated) {
              const isAnimatedTile =
                tileSource === 'primary'
                  ? animatedTileIds.primary.has(tile.tileId)
                  : animatedTileIds.secondary.has(tile.tileId);
              if (!isAnimatedTile) continue;

              // FIX: For COVERED metatiles, don't draw animated bottom-layer tiles
              // at positions where the top layer has content. This prevents the
              // animated overlay from overwriting static rocks/content that was
              // already correctly rendered in the cached chunk.
              if (layerType === METATILE_LAYER_TYPE_COVERED && layer === 0) {
                const topLayerTileIndex = i + 4;  // Corresponding tile in top layer
                const topTile = metatile.tiles[topLayerTileIndex];
                // If top layer has a non-transparent tile (tileId != 0), skip this position
                if (topTile && topTile.tileId !== 0) {
                  continue;
                }
              }
            }

              const subX = (i % 2) * TILE_SIZE;
              const subY = Math.floor(i / 2) * TILE_SIZE;

              // Palette selection based on palette INDEX, not tile source
              // Palettes 0-5 come from primary tileset, 6-15 from secondary
              // (Secondary tiles can use primary palettes and vice versa)
              const NUM_PALS_IN_PRIMARY = 6;
              const palette = tile.palette < NUM_PALS_IN_PRIMARY
                ? resolved.tileset.primaryPalettes[tile.palette]
                : resolved.tileset.secondaryPalettes[tile.palette];
              if (!palette) continue;

              // Draw using hardware-accelerated renderer
              drawTileToCanvas(
                targetCtx,
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
            if (layerType === METATILE_LAYER_TYPE_COVERED) {
              drawLayer(1);
            }
          } else {
            if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
              const shouldRender = !elevationFilter || elevationFilter(resolved.mapTile, tileX, tileY);
              
              if (shouldRender) {
                if (isDebugMode() && metatile.id === 13 && tileX >= 0 && tileX < 5 && tileY >= 0 && tileY < 5) {
                  console.log(`[METATILE 13] Top pass rendering layer 1 at (${tileX}, ${tileY}), layerType=${layerType}`);
                }
                drawLayer(1);
              } else if (isDebugMode() && metatile.id >= 14 && metatile.id <= 15) {
                console.log(`[RENDER_FIX] Skipping metatile ${metatile.id} at (${tileX}, ${tileY}) due to elevation filter. Elev=${resolved.mapTile.elevation}, PlayerElev=${playerControllerRef.current?.getElevation()}`);
              }
            }
          }
        }
      }
    },
    []
  );

  // NEW: Hardware-accelerated Canvas-based render pass
  // This is 5-10× faster than renderPass but produces IDENTICAL output
  const renderPassCanvas = useCallback(
    (
      ctx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      view: WorldCameraView,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
    ): HTMLCanvasElement => {
      const widthPx = view.tilesWide * METATILE_SIZE;
      const heightPx = view.tilesHigh * METATILE_SIZE;
      
      // Create offscreen canvas for this pass
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const canvasCtx = canvas.getContext('2d', { alpha: true })!;
      drawRegionToContext(
        canvasCtx,
        ctx,
        pass,
        skipAnimated,
        false,
        view.worldStartTileX,
        view.worldStartTileY,
        view.tilesWide,
        view.tilesHigh,
        elevationFilter
      );

      return canvas;
    },
    [drawRegionToContext]
  );

  const getAnimationStateHash = useCallback((ctx: RenderContext): string => {
    const keys: string[] = [];
    ctx.tilesetRuntimes.forEach((runtime, runtimeKey) => {
      keys.push(`${runtimeKey}:${runtime.lastPatchedKey ?? ''}`);
    });
    return keys.join('|');
  }, []);

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

      const player = playerControllerRef.current;
      const playerElevation = player ? player.getElevation() : 0;
      const elevationChanged = lastPlayerElevationRef.current !== playerElevation;
      lastPlayerElevationRef.current = playerElevation;

      // Split rendering: Top layer split into "Below Player" and "Above Player"
      // This fixes the visual issue where player on a bridge (Elev 4) is covered by the bridge
      
      const usingChunkCache = USE_HARDWARE_RENDERING && USE_CHUNK_CACHE && !!chunkManagerRef.current;

      if (USE_HARDWARE_RENDERING) {
        const needsBackgroundCanvas =
          !usingChunkCache &&
          (
            !backgroundCanvasDataRef.current ||
            animationFrameChanged ||
            viewChanged
          );

        const needsTopRender =
          !topBelowCanvasDataRef.current ||
          !topAboveCanvasDataRef.current ||
          animationFrameChanged ||
          viewChanged ||
          elevationChanged;

        if (usingChunkCache) {
          backgroundCanvasDataRef.current = null;
        }

        if (needsBackgroundCanvas) {
          backgroundCanvasDataRef.current = renderPassCanvas(ctx, 'background', false, view);
        }

        if (needsTopRender) {
          topBelowCanvasDataRef.current = renderPassCanvas(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return false;
              }
              // Elevation-based rendering:
              // - Player above tile elevation: tile renders below player (player is on higher level)
              // - Player at or below tile elevation: tile renders above player (default top-layer behavior)
              // This correctly handles:
              // - Bridges: when player is ON bridge (same elevation), bridge is below player
              // - Tree tops: when player walks under tree (same elevation), tree top is above player
              // The key is that bridge FLOOR tiles are in the bottom layer, not top layer.
              // Top layer contains decorative elements that should overlay the player at same elevation.
              if (playerElevation > mapTile.elevation) return true;
              return false;
            }
          );

          topAboveCanvasDataRef.current = renderPassCanvas(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return true;
              }
              // Elevation-based rendering (inverse of topBelow)
              if (playerElevation > mapTile.elevation) return false;
              return true;
            }
          );
        }
      } else {
        // Original ImageData mode
        const needsImageData =
          !backgroundImageDataRef.current || 
          !topBelowImageDataRef.current || 
          !topAboveImageDataRef.current || 
          animationFrameChanged || 
          viewChanged ||
          elevationChanged;

        if (needsImageData) {
          backgroundImageDataRef.current = renderPass(ctx, 'background', false, view);

          topBelowImageDataRef.current = renderPass(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return false;
              }
              // Elevation-based rendering:
              // - Player above tile elevation: tile renders below player (player is on higher level)
              // - Player at or below tile elevation: tile renders above player (default top-layer behavior)
              if (playerElevation > mapTile.elevation) return true;
              return false;
            }
          );

          topAboveImageDataRef.current = renderPass(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return true;
              }
              // Elevation-based rendering (inverse of topBelow)
              if (playerElevation > mapTile.elevation) return false;
              return true;
            }
          );
        }
      }
      const offsetX = -Math.round(view.subTileOffsetX);
      const offsetY = -Math.round(view.subTileOffsetY);
      
      mainCtx.clearRect(0, 0, widthPx, heightPx);
      
      const animHash = usingChunkCache ? 'static' : getAnimationStateHash(ctx);

      if (USE_HARDWARE_RENDERING) {
        // Hardware-accelerated Canvas mode - direct drawImage
        if (usingChunkCache && chunkManagerRef.current) {
          const renderBackgroundChunk = (chunkCtx: CanvasRenderingContext2D, region: RenderRegion) => {
            drawRegionToContext(
              chunkCtx,
              ctx,
              'background',
              false,
              false,
              region.startTileX,
              region.startTileY,
              region.width,
              region.height
            );
          };
          chunkManagerRef.current.drawLayer(mainCtx, view, 'background', animHash, renderBackgroundChunk);
          // Draw animated tiles as a lightweight overlay (no cache key churn)
          mainCtx.save();
          mainCtx.translate(offsetX, offsetY);
          drawRegionToContext(
            mainCtx,
            ctx,
            'background',
            false,
            true, // only animated tiles
            view.worldStartTileX,
            view.worldStartTileY,
            view.tilesWide,
            view.tilesHigh
          );
          mainCtx.restore();
        } else if (backgroundCanvasDataRef.current) {
          mainCtx.drawImage(backgroundCanvasDataRef.current, offsetX, offsetY);
        }

        if (topBelowCanvasDataRef.current) {
          mainCtx.drawImage(topBelowCanvasDataRef.current, offsetX, offsetY);
        }
      } else {
        // Original ImageData mode
        bgCtx.clearRect(0, 0, widthPx, heightPx);
        topCtx.clearRect(0, 0, widthPx, heightPx);
        
        if (backgroundImageDataRef.current) {
          bgCtx.putImageData(backgroundImageDataRef.current, offsetX, offsetY);
        }
        
        if (backgroundCanvasRef.current) {
          mainCtx.drawImage(backgroundCanvasRef.current, 0, 0);
        }

        if (topBelowImageDataRef.current && topCanvasRef.current) {
          topCtx.clearRect(0, 0, widthPx, heightPx);
          topCtx.putImageData(topBelowImageDataRef.current, offsetX, offsetY);
          mainCtx.drawImage(topCanvasRef.current, 0, 0);
        }
      }

      renderDoorAnimations(mainCtx, view, nowMs);
      if (arrowOverlayRef.current) {
        ObjectRenderer.renderArrow(mainCtx, arrowOverlayRef.current, arrowSpriteRef.current!, view, nowMs);
      }
      if (player) {
        ObjectRenderer.renderReflection(mainCtx, player, reflectionState, view, ctx);
      }

      const playerY = player ? player.y : 0;

      // Render field effects behind player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: grassSpriteRef.current,
          longGrass: longGrassSpriteRef.current,
          sand: sandSpriteRef.current,
          arrow: arrowSpriteRef.current,
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'bottom');
      }

      if (player && !playerHiddenRef.current) {
        player.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
      }

      // Render field effects in front of player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: grassSpriteRef.current,
          longGrass: longGrassSpriteRef.current,
          sand: sandSpriteRef.current,
          arrow: arrowSpriteRef.current,
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'top');
      }

      // 3. Draw Top Layer (Above Player)
      if (USE_HARDWARE_RENDERING) {
        if (topAboveCanvasDataRef.current) {
          mainCtx.drawImage(topAboveCanvasDataRef.current, offsetX, offsetY);
        }
      } else {
        if (topAboveImageDataRef.current && topCanvasRef.current) {
          topCtx.clearRect(0, 0, widthPx, heightPx);
          topCtx.putImageData(topAboveImageDataRef.current, offsetX, offsetY);
          mainCtx.drawImage(topCanvasRef.current, 0, 0);
        }
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

      if (isDebugMode()) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    [renderPass, renderPassCanvas, renderDoorAnimations, drawRegionToContext, getAnimationStateHash]
  );

  /**
   * Load grass sprite sheet and convert to transparent canvas
   */
  const ensureGrassSprite = useCallback(async (): Promise<HTMLCanvasElement> => {
    if (grassSpriteRef.current) {
      return grassSpriteRef.current;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/pokeemerald/graphics/field_effects/pics/tall_grass.png';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get grass sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Make transparent - assume top-left pixel is background
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];

        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
            data[i + 3] = 0; // Alpha 0
          }
        }

        ctx.putImageData(imageData, 0, 0);
        grassSpriteRef.current = canvas;
        resolve(canvas);
      };
      img.onerror = (err) => reject(err);
    });
  }, []);

  /**
   * Load long grass sprite sheet and convert to transparent canvas
   */
  const ensureLongGrassSprite = useCallback(async (): Promise<HTMLCanvasElement> => {
    if (longGrassSpriteRef.current) {
      return longGrassSpriteRef.current;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/pokeemerald/graphics/field_effects/pics/long_grass.png';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get long grass sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Make transparent - assume top-left pixel is background
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];

        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
            data[i + 3] = 0; // Alpha 0
          }
        }

        ctx.putImageData(imageData, 0, 0);
        longGrassSpriteRef.current = canvas;
        resolve(canvas);
      };
      img.onerror = (err) => reject(err);
    });
  }, []);

  /**
   * Load sand footprints sprite sheet and convert to transparent canvas
   */
  const ensureSandSprite = useCallback(async (): Promise<HTMLCanvasElement> => {
    if (sandSpriteRef.current) {
      return sandSpriteRef.current;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/pokeemerald/graphics/field_effects/pics/sand_footprints.png';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get sand sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Make transparent - assume top-left pixel is background
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];

        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
            data[i + 3] = 0; // Alpha 0
          }
        }

        ctx.putImageData(imageData, 0, 0);
        sandSpriteRef.current = canvas;
        resolve(canvas);
      };
      img.onerror = (err) => reject(err);
    });
  }, []);



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
        // Load player sprite
        const player = new PlayerController();
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');
        
        // Load grass sprite
        await ensureGrassSprite();
        await ensureLongGrassSprite();
        await ensureSandSprite();
        
        // Initialize hardware-accelerated renderer
        if (USE_HARDWARE_RENDERING) {
          canvasRendererRef.current = new CanvasRenderer();
          chunkManagerRef.current = USE_CHUNK_CACHE ? new ChunkManager() : null;
          if (isDebugMode()) {
            console.log('[PERF] Hardware-accelerated rendering enabled');
          }
        } else {
          chunkManagerRef.current = null;
        }
        
        // Initialize player position
        const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
        if (!anchor) {
          throw new Error('Failed to determine anchor map for warp setup');
        }
        const startTileX = Math.floor(anchor.mapData.width / 2);
        const startTileY = Math.floor(anchor.mapData.height / 2);
        player.setPositionAndDirection(startTileX, startTileY, 'down');

        const resolveTileForPlayer = (tileX: number, tileY: number) => {
          const ctx = renderContextRef.current;
          if (!ctx) return null;
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved) return null;
          return { mapTile: resolved.mapTile, attributes: resolved.attributes };
        };
        player.setTileResolver(resolveTileForPlayer);
        // player.setDoorWarpHandler(handleDoorWarp); // This will be defined later
        playerControllerRef.current = player;

        // The original code had a try/catch block for loading a single sprite here.
        // This has been replaced by the new PlayerController initialization above.

        // const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
        // if (!anchor) {
        //   throw new Error('Failed to determine anchor map for warp setup');
        // }
        const applyTileResolver = () => {
          playerControllerRef.current?.setTileResolver((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return null;
            const resolved = resolveTileAt(ctx, tileX, tileY);
            if (!resolved) return null;
            return { mapTile: resolved.mapTile, attributes: resolved.attributes };
          });
        };
        
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
          entryDirection: 'up',
        };
        doorExitRef.current = {
          stage: 'idle',
          doorWorldX: 0,
          doorWorldY: 0,
          metatileId: 0,
        };
        const startAutoDoorWarp = (
          trigger: WarpTrigger,
          resolved: ResolvedTile,
          player: PlayerController,
          entryDirection: CardinalDirection = 'up',
          options?: { isAnimatedDoor?: boolean }
        ) => {
          if (doorEntry.stage !== 'idle') return false;
          const now = performance.now();
          const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
          logDoor('entry: auto door warp (non-animated)', {
            worldX: player.tileX,
            worldY: player.tileY,
            metatileId,
            behavior: trigger.behavior,
          });
          arrowOverlayRef.current = null;
          doorEntry = {
            stage: 'waitingBeforeFade',
            trigger,
            targetX: player.tileX,
            targetY: player.tileY,
            metatileId,
            isAnimatedDoor: options?.isAnimatedDoor ?? false,
            entryDirection,
            playerHidden: false,
            waitStartedAt: now - 250,
          };
          warpState.inProgress = true;
          player.lockInput();
          return true;
        };

        /**
         * Perform Warp (Map Transition)
         * 
         * Handles the actual map change and player positioning after fade out.
         * 
         * Critical Logic for Door Exit Animations:
         * - Check if DESTINATION tile has door behavior before playing exit animation
         * - Many indoor exits use arrow warps (behavior 101) or stairs with NO door
         * - Only play door exit animation if destination tile is actually a door
         * 
         * Example: Exiting Brendan's House to Littleroot Town
         * - Player walks onto arrow warp at (8,8) in BRENDANS_HOUSE_1F (behavior 101, no door)
         * - Warp destination (5,8) in MAP_LITTLEROOT_TOWN has metatile 0x248 (IS a door)
         * - We check destination behavior and play door exit animation at (5,8)
         */
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
              if (isDebugMode()) {
                console.warn(`Warp target missing for ${targetMapId} warp ${targetWarpId}`);
              }
              return;
            }
            const destWorldX = destMap.offsetX + destWarp.x;
            const destWorldY = destMap.offsetY + destWarp.y;
            
            // Determine facing direction based on context
            let facing: PlayerController['dir'] = trigger.facing;
            if (trigger.kind === 'door' && options?.fromDoor && ctxAfter) {
              const destResolved = resolveTileAt(ctxAfter, destWorldX, destWorldY);
              const destBehavior = destResolved?.attributes?.behavior ?? -1;
              const destIsArrow = isArrowWarpBehavior(destBehavior);
              
              if (isDoorBehavior(destBehavior)) {
                facing = 'down'; // Exiting through a door
              } else if (destIsArrow) {
                // Arriving at an arrow warp: preserve movement direction
                facing = trigger.facing;
              } else {
                facing = 'up'; // Arrived at non-door, non-arrow destination (stairs, etc.)
              }
            } else if (trigger.kind === 'door') {
              facing = 'down'; // Default for door warps when not using door entry sequence
            } else if (trigger.kind === 'arrow') {
              // Arrow warps: always preserve the movement direction
              // This ensures you face the direction you were moving, not the destination arrow's direction
              facing = trigger.facing;
            }

            if (isDebugMode()) {
              console.log('[WARP_FACING]', {
                triggerKind: trigger.kind,
                triggerFacing: trigger.facing,
                finalFacing: facing,
                fromDoor: options?.fromDoor,
              });
            }

            playerControllerRef.current?.setPositionAndDirection(destWorldX, destWorldY, facing);
            
            // Check if destination tile actually has a door before playing door exit animation
            if (options?.fromDoor && ctxAfter) {
              const destResolved = resolveTileAt(ctxAfter, destWorldX, destWorldY);
              const destBehavior = destResolved?.attributes?.behavior ?? -1;
              const destMetatileId = destResolved ? getMetatileIdFromMapTile(destResolved.mapTile) : 0;
              
              const isAnimatedDoor = isDoorBehavior(destBehavior);
              const isNonAnimatedDoor = isNonAnimatedDoorBehavior(destBehavior);
              const requiresExitSequence = requiresDoorExitSequence(destBehavior);
              
              if (isDebugMode()) {
                console.log('[WARP_DEST_CHECK]', {
                  fromDoor: options?.fromDoor,
                  triggerKind: trigger.kind,
                  destWorldX,
                  destWorldY,
                  destMetatileId: `0x${destMetatileId.toString(16)} (${destMetatileId})`,
                  destBehavior,
                  isAnimatedDoor,
                  isNonAnimatedDoor,
                  requiresExitSequence,
                });
              }
              
              // Check if destination requires exit sequence (animated or non-animated)
              if (requiresExitSequence) {
                // Determine exit direction: for arrow warps, continue in same direction; for doors, exit down
                const exitDirection = trigger.kind === 'arrow' ? trigger.facing : 'down';
                
                if (isDebugMode()) {
                  console.log('[EXIT_SEQUENCE_START]', {
                    triggerKind: trigger.kind,
                    triggerFacing: trigger.facing,
                    exitDirection,
                    destBehavior,
                    isAnimatedDoor,
                  });
                }
                
                logDoor('performWarp: destination requires exit sequence', {
                  destWorldX,
                  destWorldY,
                  destMetatileId,
                  destBehavior,
                  isAnimatedDoor,
                  isNonAnimatedDoor,
                  exitDirection,
                  triggerKind: trigger.kind,
                });
                playerHiddenRef.current = true;
                doorExitRef.current = {
                  stage: 'opening',
                  doorWorldX: destWorldX,
                  doorWorldY: destWorldY,
                  metatileId: destMetatileId,
                  isAnimatedDoor, // Store whether to play door animation
                  exitDirection, // Store which direction to walk when exiting
                };
                fadeRef.current = {
                  mode: 'in',
                  startedAt: currentTimestampRef.current,
                  duration: DOOR_FADE_DURATION,
                };
              } else {
                if (isDebugMode()) {
                  console.log('[NO_EXIT_SEQUENCE]', {
                    triggerKind: trigger.kind,
                    destBehavior,
                    requiresExitSequence,
                    finalFacing: facing,
                  });
                }
                // No door on destination side (e.g., arrow warp, stairs, teleport pad)
                // Must unlock input immediately since there's no door exit sequence
                logDoor('performWarp: destination has no door, simple fade in', {
                  destWorldX,
                  destWorldY,
                  destMetatileId,
                  destBehavior,
                  behaviorLabel: classifyWarpKind(destBehavior) ?? 'unknown',
                });
                playerHiddenRef.current = false;
                fadeRef.current = {
                  mode: 'in',
                  startedAt: currentTimestampRef.current,
                  duration: DOOR_FADE_DURATION,
                };
                // No door exit sequence needed
                doorExitRef.current = {
                  stage: 'idle',
                  doorWorldX: 0,
                  doorWorldY: 0,
                  metatileId: 0,
                };
                // CRITICAL: Unlock input here since there's no door exit sequence to handle it
                playerControllerRef.current?.unlockInput();
                warpState.inProgress = false;
              }
            } else if (options?.fromDoor) {
              fadeRef.current = {
                mode: 'in',
                startedAt: currentTimestampRef.current,
                duration: DOOR_FADE_DURATION,
              };
              playerHiddenRef.current = false;
              doorExitRef.current = {
                stage: 'idle',
                doorWorldX: 0,
                doorWorldY: 0,
                metatileId: 0,
              };
              playerControllerRef.current?.unlockInput();
              warpState.inProgress = false;
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

        const handleDoorWarp = (request: DoorWarpRequest) => {
          const ctx = renderContextRef.current;
          if (!ctx) return;
          const resolved = resolveTileAt(ctx, request.targetX, request.targetY);
          if (!resolved) return;
          
          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) return;

          const trigger: WarpTrigger = {
            kind: classifyWarpKind(request.behavior) ?? 'door',
            sourceMap: resolved.map,
            warpEvent,
            behavior: request.behavior,
            facing: playerControllerRef.current?.dir ?? 'down'
          };
          
          if (playerControllerRef.current) {
            startAutoDoorWarp(trigger, resolved, playerControllerRef.current);
          }
        };
        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarp);

        const advanceDoorEntry = (now: number) => {
          if (doorEntry.stage === 'idle') return;
          const player = playerControllerRef.current;
          if (!player || !doorEntry.trigger) return;
          if (doorEntry.stage === 'opening') {
            // Only check for animation completion if this is an animated door
            if (doorEntry.isAnimatedDoor !== false) {
              const anim = doorEntry.openAnimId
                ? doorAnimsRef.current.find((a) => a.id === doorEntry.openAnimId)
                : null;
              const openDone = !anim || isDoorAnimDone(anim, now);
              if (openDone) {
                logDoor('entry: door fully open (animated), force step into tile', doorEntry.targetX, doorEntry.targetY);
                player.forceMove(doorEntry.entryDirection ?? 'up', true);
                doorEntry.stage = 'stepping';
              }
            } else {
              // Non-animated door: skip straight to stepping
              logDoor('entry: non-animated door, force step into tile', doorEntry.targetX, doorEntry.targetY);
              player.forceMove(doorEntry.entryDirection ?? 'up', true);
              doorEntry.stage = 'stepping';
            }
          } else if (doorEntry.stage === 'stepping') {
            if (!player.isMoving) {
              // Only spawn close animation if this is an animated door
              if (doorEntry.isAnimatedDoor !== false) {
                const startedAt = now;
                logDoor('entry: start door close (animated), hide player');
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
              } else {
                // Non-animated door: skip straight to fading
                logDoor('entry: non-animated door, skip to fade');
                playerHiddenRef.current = true;
                doorEntry.playerHidden = true;
                doorEntry.stage = 'waitingBeforeFade';
                doorEntry.waitStartedAt = now;
              }
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

          /**
           * Door Entry Handler
           * 
           * Triggered when player attempts to enter a door (from outdoor → indoor, etc.)
           * 
           * Important: Uses the SOURCE tile's metatile ID (the door tile being entered)
           * to determine which door animation to play. This is correct because we're
           * animating the door the player is walking INTO, not the destination tile.
           * 
           * Example: Entering Brendan's House from Littleroot Town
           * - Source tile (5,8) in MAP_LITTLEROOT_TOWN has metatile 0x248 (METATILE_Petalburg_Door_Littleroot)
           * - Destination tile (8,8) in BRENDANS_HOUSE_1F has metatile 514 (arrow warp, NOT a door)
           * - We play door animation using 0x248, not 514
           */
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
          
          // Check if this is an arrow warp
          const isArrow = isArrowWarpBehavior(behavior);
          const requiresExitSeq = requiresDoorExitSequence(behavior);
          const isAnimated = isDoorBehavior(behavior);
          
          if (isDebugMode()) {
            console.log('[DOOR_WARP_ATTEMPT]', {
              targetX: request.targetX,
              targetY: request.targetY,
              behavior,
              metatileId: `0x${getMetatileIdFromMapTile(resolved.mapTile).toString(16)} (${getMetatileIdFromMapTile(resolved.mapTile)})`,
              isDoor: isAnimated,
              isNonAnimatedDoor: isNonAnimatedDoorBehavior(behavior),
              isArrowWarp: isArrow,
              requiresExitSequence: requiresExitSeq,
              playerDir: player.dir,
            });
          }
          
          // Handle arrow warps
          if (isArrow) {
            const arrowDir = getArrowDirectionFromBehavior(behavior);
            if (isDebugMode()) {
              console.log('[ARROW_WARP_ATTEMPT]', {
                arrowDir,
                playerDir: player.dir,
                match: arrowDir === player.dir,
              });
            }
            if (!arrowDir || player.dir !== arrowDir) {
              if (isDebugMode()) {
                console.warn('[ARROW_WARP_ATTEMPT] Player not facing arrow direction - REJECTING');
              }
              return;
            }
            // Arrow warp: trigger auto door warp with no animation
            const trigger: WarpTrigger = {
              kind: 'arrow',
              sourceMap: resolved.map,
              warpEvent,
              behavior,
              facing: player.dir,
            };
            if (isDebugMode()) {
              console.log('[ARROW_WARP_START]', { trigger });
            }
            startAutoDoorWarp(trigger, resolved, player, arrowDir, { isAnimatedDoor: false });
            return;
          }
          
          if (!requiresExitSeq) {
            if (isDebugMode()) {
              console.warn('[DOOR_WARP_ATTEMPT] Called for non-door/non-arrow tile - REJECTING', {
                targetX: request.targetX,
                targetY: request.targetY,
                behavior,
                metatileId: getMetatileIdFromMapTile(resolved.mapTile),
              });
            }
            return;
          }
          
          const trigger: WarpTrigger = {
            kind: 'door', // Use 'door' for both animated and non-animated door sequences
            sourceMap: resolved.map,
            warpEvent,
            behavior,
            facing: player.dir,
          };
            // Use SOURCE tile's metatile ID for door animation (the door being entered)
            const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
            const startedAt = performance.now();
            
            // Only spawn door animation if this is an animated door
            // Non-animated doors (stairs) skip animation but still do entry sequence
            let openAnimId: number | null | undefined = undefined;
            if (isAnimated) {
              logDoor('entry: start door open (animated)', {
                worldX: request.targetX,
                worldY: request.targetY,
                metatileId,
                map: resolved.map.entry.id,
              });
              openAnimId = await spawnDoorAnimation(
                'open',
                request.targetX,
                request.targetY,
                metatileId,
                startedAt,
                true
              );
            } else {
              logDoor('entry: start (non-animated, no door animation)', {
                worldX: request.targetX,
                worldY: request.targetY,
                metatileId,
                map: resolved.map.entry.id,
              });
            }
          
          doorEntry = {
            stage: 'opening',
            trigger,
            targetX: request.targetX,
            targetY: request.targetY,
            metatileId,
            isAnimatedDoor: isAnimated, // Track whether to animate
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
            // Only spawn door animation if this is an animated door
            // Non-animated doors (stairs) skip animation but still do scripted movement
            if (doorExit.isAnimatedDoor !== false) {
              if (doorExit.openAnimId === undefined) {
                logDoor('exit: start door open', {
                  worldX: doorExit.doorWorldX,
                  worldY: doorExit.doorWorldY,
                  metatileId: doorExit.metatileId,
                  isAnimatedDoor: doorExit.isAnimatedDoor,
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
                const exitDir = doorExit.exitDirection ?? 'down';
                logDoor('exit: step out of door (animated)', { exitDirection: exitDir });
                playerControllerRef.current?.forceMove(exitDir, true);
                playerHiddenRef.current = false;
                doorExitRef.current.stage = 'stepping';
              }
            } else {
              // Non-animated door: skip straight to stepping
              const exitDir = doorExit.exitDirection ?? 'down';
              logDoor('exit: step out of door (non-animated, no door animation)', { exitDirection: exitDir });
              playerControllerRef.current?.forceMove(exitDir, true);
              playerHiddenRef.current = false;
              doorExitRef.current.stage = 'stepping';
            }
          } else if (doorExit.stage === 'stepping') {
            if (!playerControllerRef.current?.isMoving) {
              // Only close door animation if this is an animated door
              if (doorExit.isAnimatedDoor !== false) {
                const start = timestamp;
                logDoor('exit: start door close (animated)');
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
              } else {
                // Non-animated door: skip straight to done, unlock immediately
                logDoor('exit: done (non-animated, no door close)');
                doorExitRef.current.stage = 'done';
                warpState.inProgress = false;
                playerControllerRef.current?.unlockInput();
                playerHiddenRef.current = false;
              }
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
                  // Arrow warps are handled through PlayerController's doorWarpHandler
                  // (triggered when player tries to move in the arrow direction)
                  if (trigger.kind === 'arrow') {
                    // Do nothing - wait for player movement input
                    if (isDebugMode()) {
                      console.log('[DETECT_WARP] Arrow warp detected, waiting for player input');
                    }
                  } else if (isNonAnimatedDoorBehavior(trigger.behavior)) {
                    startAutoDoorWarp(trigger, resolvedForWarp, player, 'up', { isAnimatedDoor: false });
                  } else {
                    void performWarp(trigger);
                  }
                }
              }
            }
            updateArrowOverlay(player, ctx, resolvedForWarp, timestamp, warpState.inProgress);
          } else {
            updateArrowOverlay(null, null, null, timestamp, warpState.inProgress);
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
          // To avoid hitching on every connected-map boundary, only re-anchor when near world edges.
          if (!reanchorInFlight && player) {
            const resolved = resolveTileAt(ctx, player.tileX, player.tileY);
            if (resolved && resolved.map.entry.id !== ctx.anchor.entry.id) {
              const bounds = ctx.world.bounds;
              const marginTiles = Math.max(VIEWPORT_CONFIG.tilesWide, VIEWPORT_CONFIG.tilesHigh);
              const nearEdge =
                player.tileX - bounds.minX < marginTiles ||
                bounds.maxX - player.tileX < marginTiles ||
                player.tileY - bounds.minY < marginTiles ||
                bounds.maxY - player.tileY < marginTiles;

              if (nearEdge) {
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

          // CRITICAL FIX: Clear canvas cache when animation frames change
          // The palette canvas cache must be invalidated when tileset data changes (animations)
          if (animationFrameChanged && USE_HARDWARE_RENDERING && canvasRendererRef.current) {
            canvasRendererRef.current.clearCache();
          }

          const shouldRender =
            animationFrameChanged ||
            playerDirty ||
            !hasRenderedRef.current ||
            viewChanged ||
            doorAnimsRef.current.length > 0 ||
            fadeRef.current.mode !== null ||
            !!arrowOverlayRef.current?.visible; // Keep rendering while arrow animates
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

  // Calculate viewport dimensions for dialog system
  const viewportWidth = VIEWPORT_PIXEL_SIZE.width * zoom;
  const viewportHeight = VIEWPORT_PIXEL_SIZE.height * zoom;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
      <DialogSystem
        zoom={zoom}
        viewportWidth={viewportWidth}
        viewportHeight={viewportHeight}
        config={{
          frameStyle: 1,
          textSpeed: 'medium',
          linesVisible: 2,
        }}
      >
        <canvas
          ref={canvasRef}
          width={VIEWPORT_PIXEL_SIZE.width}
          height={VIEWPORT_PIXEL_SIZE.height}
          style={{
            display: 'block',
            border: '1px solid #ccc',
            imageRendering: 'pixelated',
            width: viewportWidth,
            height: viewportHeight,
          }}
          onClick={handleCanvasClick}
        />
      </DialogSystem>
      {/* Debug Panel - slides in from right side */}
      <DebugPanel
        options={debugOptions}
        onChange={(newOptions) => {
          // Handle focus mode change - clear inspect target when switching to player mode
          if (newOptions.focusMode === 'player' && debugOptions.focusMode === 'inspect') {
            setInspectTarget(null);
          }
          setDebugOptions(newOptions);
        }}
        tileInfo={centerTileDebugInfo}
        debugCanvasRef={debugCanvasRef}
        bottomLayerCanvasRef={bottomLayerCanvasRef}
        topLayerCanvasRef={topLayerCanvasRef}
        compositeLayerCanvasRef={compositeLayerCanvasRef}
        debugGridSize={DEBUG_GRID_SIZE}
      />
    </div>
  );
};
