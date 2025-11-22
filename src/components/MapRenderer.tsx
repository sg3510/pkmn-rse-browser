import React, { useCallback, useEffect, useRef, useState } from 'react';
import UPNG from 'upng-js';
import { PlayerController, type DoorWarpRequest } from '../game/PlayerController';
import { MapManager, type TilesetResources, type WorldMapInstance, type WorldState } from '../services/MapManager';
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
  isCollisionPassable,
} from '../utils/mapLoader';
import {
  TILESET_ANIMATION_CONFIGS,
  type TilesetAnimationDefinition,
  type TilesetKind,
} from '../data/tilesetAnimations';
import type { BridgeType, CardinalDirection } from '../utils/metatileBehaviors';
import {
  getBridgeTypeFromBehavior,
  getArrowDirectionFromBehavior,
  isIceBehavior,
  isReflectiveBehavior,
  isArrowWarpBehavior,
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
  isTeleportWarpBehavior,
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { computeCameraView, type CameraView } from '../utils/camera';
import type { WarpEvent } from '../types/maps';

const PROJECT_ROOT = '/pokeemerald';
const FRAME_MS = 1000 / 60;
const SECONDARY_TILE_OFFSET = TILES_PER_ROW_IN_IMAGE * 32; // 512 tiles
const NUM_PRIMARY_METATILES = 512;

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

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
  mapTile: MapTileData;  // CHANGED: was number, now MapTileData
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
const ARROW_FRAME_SIZE = METATILE_SIZE;
const ARROW_FRAME_DURATION_MS = 533; // GBA uses 32 ticks @ 60fps ≈ 533ms per frame
const ARROW_FRAME_SEQUENCES: Record<CardinalDirection, number[]> = {
  down: [3, 7],
  up: [0, 4],
  left: [1, 5],
  right: [2, 6],
};
const DIRECTION_VECTORS: Record<CardinalDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}

interface DebugTileInfo {
  inBounds: boolean;
  tileX: number;
  tileY: number;
  mapTile?: MapTileData;  // CHANGED: was number, now MapTileData
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
  // Additional debug info
  mapId?: string;
  mapName?: string;
  localX?: number;
  localY?: number;
  paletteIndex?: number;
  warpEvent?: WarpEvent | null;
  warpKind?: WarpKind | null;
  primaryTilesetId?: string;
  secondaryTilesetId?: string;
  // Elevation and collision info
  elevation?: number;
  collision?: number;
  collisionPassable?: boolean;
  // Rendering debug info
  playerElevation?: number;
  isLedge?: boolean;
  ledgeDirection?: string;
  bottomLayerTransparency?: number; // 0-256 (number of transparent pixels out of 256)
  topLayerTransparency?: number;
  renderedInBackgroundPass?: boolean;
  renderedInTopBelowPass?: boolean;
  renderedInTopAbovePass?: boolean;
  topBelowPassReason?: string; // Why this tile was/wasn't filtered
  topAbovePassReason?: string;
  // Detailed tile info
  bottomTileDetails?: string[];
  topTileDetails?: string[];
  adjacentTileInfo?: {
    north?: { metatileId: number; layerType: number; layerTypeLabel: string };
    south?: { metatileId: number; layerType: number; layerTypeLabel: string };
    east?: { metatileId: number; layerType: number; layerTypeLabel: string };
    west?: { metatileId: number; layerType: number; layerTypeLabel: string };
  };
}

const TILESET_STRIDE = TILES_PER_ROW_IN_IMAGE * TILE_SIZE; // 128px

function applyBehaviorOverrides(attributes: MetatileAttributes[]): MetatileAttributes[] {
  return attributes;
}

function classifyWarpKind(behavior: number): WarpKind | null {
  // Check arrow warps first, before door behaviors
  // (some behaviors like MB_DEEP_SOUTH_WARP can match multiple categories)
  if (isArrowWarpBehavior(behavior)) return 'arrow';
  if (requiresDoorExitSequence(behavior)) return 'door';
  if (isTeleportWarpBehavior(behavior)) return 'teleport';
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
    const mapTileData = map.mapData.layout[idx];  // Now MapTileData
    const metatileId = mapTileData.metatileId;     // Direct property access
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
      mapTile: mapTileData,  // Full MapTileData object
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
  // Border tiles: create MapTileData with impassable collision, elevation 0
  const mapTile: MapTileData = {
    metatileId: borderMetatileId,
    collision: 1, // Impassable like pokeemerald border
    elevation: 0, // Border tiles are always ground level
  };
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
  const metatileId = resolved.mapTile.metatileId;  // Direct property access
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
  const metatileId = resolved.mapTile.metatileId;  // Direct property access
  const kind = classifyWarpKind(behavior) ?? 'teleport';
  
  if (isDebugMode()) {
    console.log('[DETECT_WARP_TRIGGER]', {
      tileX: player.tileX,
      tileY: player.tileY,
      metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
      behavior,
      classifiedKind: kind,
      isDoor: isDoorBehavior(behavior),
      isArrow: isArrowWarpBehavior(behavior),
      isTeleport: isTeleportWarpBehavior(behavior),
      destMap: warpEvent.destMap,
    });
  }
  
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
  tileY: number,
  player?: PlayerController | null
): DebugTileInfo {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved || !resolved.metatile) {
    return { inBounds: false, tileX, tileY };
  }

  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  const mapTile = resolved.mapTile;
  const metatileId = mapTile.metatileId;  // Direct property access
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

  // Additional debug info
  const localX = tileX - resolved.map.offsetX;
  const localY = tileY - resolved.map.offsetY;
  const warpEvent = findWarpEventAt(resolved.map, tileX, tileY);
  const warpKind = behavior !== undefined ? classifyWarpKind(behavior) : null;
  const paletteIndex = (metatileId >> 12) & 0xF; // Extract palette bits
  
  // Elevation and collision info
  const elevation = mapTile.elevation;
  const collision = mapTile.collision;
  const collisionPassable = isCollisionPassable(collision);
  
  // Ledge detection
  const isLedge = behavior === 0x62 || behavior === 0x63 || behavior === 0x64 || behavior === 0x65;
  let ledgeDirection = undefined;
  if (behavior === 0x62) ledgeDirection = 'SOUTH';
  else if (behavior === 0x63) ledgeDirection = 'NORTH';
  else if (behavior === 0x64) ledgeDirection = 'WEST';
  else if (behavior === 0x65) ledgeDirection = 'EAST';
  
  // Transparency calculation for layers
  let bottomLayerTransparency = 0;
  let topLayerTransparency = 0;
  const bottomTileDetails: string[] = [];
  const topTileDetails: string[] = [];
  
  if (runtime && meta) {
    const tileMasks = isSecondary ? runtime.secondaryTileMasks : runtime.primaryTileMasks;
    
    // Bottom layer (tiles 0-3)
    for (let i = 0; i < 4; i++) {
      const tile = meta.tiles[i];
      const mask = tileMasks[tile.tileId];
      if (mask) {
        const transparentPixels = mask.reduce((sum, val) => sum + val, 0);
        bottomLayerTransparency += transparentPixels;
        bottomTileDetails.push(
          `Tile ${i}: ID=${tile.tileId}, Pal=${tile.palette}, Flip=${tile.xflip ? 'X' : ''}${tile.yflip ? 'Y' : ''}, Transparent=${transparentPixels}/64px`
        );
      }
    }
    
    // Top layer (tiles 4-7)
    for (let i = 4; i < 8; i++) {
      const tile = meta.tiles[i];
      const mask = tileMasks[tile.tileId];
      if (mask) {
        const transparentPixels = mask.reduce((sum, val) => sum + val, 0);
        topLayerTransparency += transparentPixels;
        topTileDetails.push(
          `Tile ${i}: ID=${tile.tileId}, Pal=${tile.palette}, Flip=${tile.xflip ? 'X' : ''}${tile.yflip ? 'Y' : ''}, Transparent=${transparentPixels}/64px`
        );
      }
    }
  }
  
  // Get adjacent tile information
  const adjacentTileInfo: {
    north?: { metatileId: number; layerType: number; layerTypeLabel: string };
    south?: { metatileId: number; layerType: number; layerTypeLabel: string };
    east?: { metatileId: number; layerType: number; layerTypeLabel: string };
    west?: { metatileId: number; layerType: number; layerTypeLabel: string };
  } = {};
  
  const northTile = resolveTileAt(ctx, tileX, tileY - 1);
  if (northTile?.metatile && northTile.attributes) {
    adjacentTileInfo.north = {
      metatileId: northTile.mapTile.metatileId,
      layerType: northTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(northTile.attributes.layerType),
    };
  }
  
  const southTile = resolveTileAt(ctx, tileX, tileY + 1);
  if (southTile?.metatile && southTile.attributes) {
    adjacentTileInfo.south = {
      metatileId: southTile.mapTile.metatileId,
      layerType: southTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(southTile.attributes.layerType),
    };
  }
  
  const eastTile = resolveTileAt(ctx, tileX + 1, tileY);
  if (eastTile?.metatile && eastTile.attributes) {
    adjacentTileInfo.east = {
      metatileId: eastTile.mapTile.metatileId,
      layerType: eastTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(eastTile.attributes.layerType),
    };
  }
  
  const westTile = resolveTileAt(ctx, tileX - 1, tileY);
  if (westTile?.metatile && westTile.attributes) {
    adjacentTileInfo.west = {
      metatileId: westTile.mapTile.metatileId,
      layerType: westTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(westTile.attributes.layerType),
    };
  }
  
  // Player elevation comparison
  const playerElevation = player?.getElevation();
  
  // Rendering pass calculation (same logic as compositeScene)
  const renderedInBackgroundPass = true; // Bottom layer always rendered
  let renderedInTopBelowPass = false;
  let renderedInTopAbovePass = false;
  let topBelowPassReason = 'Not applicable';
  let topAbovePassReason = 'Not applicable';
  
  // NORMAL tiles render their top layer in the TOP passes (with elevation filtering)
  // COVERED tiles render layer 1 in background (both layers behind player)
  // SPLIT tiles render layer 0 in background, layer 1 in top passes (with elevation filtering)
  
  // Check if this is a vertical object (tree, pole, etc.)
  // This properly excludes bridges which should respect elevation
  const isVertical = isVerticalObject(ctx, tileX, tileY);
  
  if (layerType === METATILE_LAYER_TYPE_COVERED) {
    // COVERED: Both layers in background pass
    topBelowPassReason = 'COVERED: both layers render in background pass (behind player)';
    topAbovePassReason = 'COVERED: both layers render in background pass (behind player)';
  } else if (layerType === METATILE_LAYER_TYPE_SPLIT || layerType === METATILE_LAYER_TYPE_NORMAL) {
    // SPLIT and NORMAL: Layer 1 in top passes with elevation filtering
    if (playerElevation !== undefined) {
      // CRITICAL: Vertical objects (trees) ALWAYS render after player
      if (isVertical) {
        renderedInTopBelowPass = false;
        topBelowPassReason = `🌳 VERTICAL OBJECT (tree/pole): Always renders AFTER player (topAbove)`;
        renderedInTopAbovePass = true;
        topAbovePassReason = `🌳 VERTICAL OBJECT (tree/pole): Always covers player`;
      } else {
        // Top Below Pass filter (rendered BEFORE player)
        if (playerElevation < 4) {
          renderedInTopBelowPass = false;
          topBelowPassReason = `Player elev ${playerElevation} < 4: top layer renders AFTER player (topAbove)`;
        } else if (elevation === playerElevation && collision === 1) {
          renderedInTopBelowPass = false;
          topBelowPassReason = `Same elev (${elevation}) + blocked: obstacle covers player (topAbove)`;
        } else {
          renderedInTopBelowPass = true;
          topBelowPassReason = `Player elev ${playerElevation} >= 4: top layer renders BEFORE player`;
        }
        
        // Top Above Pass filter (rendered AFTER player)
        if (playerElevation < 4) {
          renderedInTopAbovePass = true;
          topAbovePassReason = `Player elev ${playerElevation} < 4: top layer covers player`;
        } else if (elevation === playerElevation && collision === 1) {
          renderedInTopAbovePass = true;
          topAbovePassReason = `Same elev (${elevation}) + blocked: obstacle covers player`;
        } else {
          renderedInTopAbovePass = false;
          topAbovePassReason = `Player elev ${playerElevation} >= 4: player covers top layer`;
        }
      }
    } else {
      topBelowPassReason = 'No player to compare';
      topAbovePassReason = 'No player to compare';
    }
  }

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
    // Additional debug info
    mapId: resolved.map.entry.id,
    mapName: resolved.map.entry.name,
    localX,
    localY,
    paletteIndex,
    warpEvent,
    warpKind,
    primaryTilesetId: resolved.tileset.primaryTilesetId,
    secondaryTilesetId: resolved.tileset.secondaryTilesetId,
    // Elevation and collision info
    elevation,
    collision,
    collisionPassable,
    // Rendering debug info
    playerElevation,
    isLedge,
    ledgeDirection,
    bottomLayerTransparency,
    topLayerTransparency,
    renderedInBackgroundPass,
    renderedInTopBelowPass,
    renderedInTopAbovePass,
    topBelowPassReason,
    topAbovePassReason,
    // Detailed tile info
    bottomTileDetails,
    topTileDetails,
    adjacentTileInfo,
  };
}

function resolveBridgeType(ctx: RenderContext, tileX: number, tileY: number): BridgeType {
  const info = getMetatileBehavior(ctx, tileX, tileY);
  if (!info) return 'none';
  return getBridgeTypeFromBehavior(info.behavior);
}

// Helper function to check if a tile is a vertical object (tree, pole, etc.)
// Vertical objects should always render their top layer AFTER the player
function isVerticalObject(ctx: RenderContext, tileX: number, tileY: number): boolean {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved || !resolved.metatile || !resolved.attributes) return false;
  
  const layerType = resolved.attributes.layerType;
  
  // Only NORMAL layer types can be vertical objects
  // COVERED and SPLIT have different behavior
  if (layerType !== METATILE_LAYER_TYPE_NORMAL) return false;
  
  // Check if this is a bridge tile - bridges are HORIZONTAL platforms
  // that should respect elevation, NOT vertical objects
  const behaviorInfo = getMetatileBehavior(ctx, tileX, tileY);
  if (behaviorInfo) {
    const behavior = behaviorInfo.behavior;
    // Bridge behaviors: 112-115 (BRIDGE_OVER_OCEAN/POND), 120 (FORTREE_BRIDGE), 
    // 122-125 (BRIDGE edges), 127 (BIKE_BRIDGE)
    const isBridge = (behavior >= 112 && behavior <= 115) || 
                     behavior === 120 || 
                     (behavior >= 122 && behavior <= 125) || 
                     behavior === 127;
    if (isBridge) return false; // Bridges use elevation-based rendering
  }
  
  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  if (!runtime) return false;
  
  const metatile = resolved.metatile;
  const tileMasks = resolved.isSecondary ? runtime.secondaryTileMasks : runtime.primaryTileMasks;
  
  // Calculate top layer transparency
  let topLayerTransparency = 0;
  for (let i = 4; i < 8; i++) {
    const tile = metatile.tiles[i];
    const mask = tileMasks[tile.tileId];
    if (mask) {
      topLayerTransparency += mask.reduce((sum, val) => sum + val, 0);
    }
  }
  
  // If top layer has more than 50% opaque pixels (< 128/256 transparent), 
  // it's a vertical object (tree, pole, etc.) that should cover the player
  // Trees typically have ~56/256 transparent (200 opaque)
  // Ground/empty tiles have 256/256 transparent (0 opaque)
  // Bridges have 0/256 transparent but are excluded above
  const VERTICAL_OBJECT_THRESHOLD = 128;
  return topLayerTransparency < VERTICAL_OBJECT_THRESHOLD;
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

  const bridgeType = resolveBridgeType(ctx, player.tileX, player.tileY);

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
  const arrowOverlayRef = useRef<ArrowOverlayState | null>(null);
  const arrowSpriteRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const arrowSpritePromiseRef = useRef<Promise<HTMLImageElement | HTMLCanvasElement> | null>(null);
  const grassSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const longGrassSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const sandSpriteRef = useRef<HTMLCanvasElement | null>(null);
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

  const renderArrowOverlay = useCallback(
    (mainCtx: CanvasRenderingContext2D, view: WorldCameraView, now: number) => {
      const overlay = arrowOverlayRef.current;
      const sprite = arrowSpriteRef.current;
      if (!overlay || !overlay.visible || !sprite) return;
      const framesPerRow = Math.max(1, Math.floor(sprite.width / ARROW_FRAME_SIZE));
      const frameSequence = ARROW_FRAME_SEQUENCES[overlay.direction];
      const elapsed = now - overlay.startedAt;
      const seqIndex = Math.floor(elapsed / ARROW_FRAME_DURATION_MS) % frameSequence.length;
      const frameIndex = frameSequence[seqIndex];
      const sx = (frameIndex % framesPerRow) * ARROW_FRAME_SIZE;
      const sy = Math.floor(frameIndex / framesPerRow) * ARROW_FRAME_SIZE;
      const dx = Math.round(overlay.worldX * METATILE_SIZE - view.cameraWorldX);
      const dy = Math.round(overlay.worldY * METATILE_SIZE - view.cameraWorldY);
      mainCtx.drawImage(sprite, sx, sy, ARROW_FRAME_SIZE, ARROW_FRAME_SIZE, dx, dy, ARROW_FRAME_SIZE, ARROW_FRAME_SIZE);
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
  const [showTileDebug, setShowTileDebug] = useState(false);
  const [centerTileDebugInfo, setCenterTileDebugInfo] = useState<DebugTileInfo | null>(null);
  
  // Canvas refs for layer decomposition
  const bottomLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Set global debug flag when showTileDebug changes
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG] = showTileDebug;
  }, [showTileDebug]);

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
          const info = describeTile(ctx, tileX, tileY, player);
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
      // Update center tile info for display (index 4 is center of 3x3 grid)
      const centerTile = collected[4];
      setCenterTileDebugInfo(centerTile && centerTile.inBounds ? centerTile : null);
    },
    [setCenterTileDebugInfo]
  );

  // Render layer decomposition canvases
  const renderLayerDecomposition = useCallback((ctx: RenderContext, tileInfo: DebugTileInfo) => {
    if (!tileInfo || !tileInfo.inBounds) return;
    
    const resolved = resolveTileAt(ctx, tileInfo.tileX, tileInfo.tileY);
    if (!resolved || !resolved.metatile) return;
    
    const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
    if (!runtime) return;
    
    const metatile = resolved.metatile;
    const patchedTiles = runtime.patchedTiles ?? {
      primary: runtime.resources.primaryTilesImage,
      secondary: runtime.resources.secondaryTilesImage,
    };
    
    const SCALE = 4; // Scale up for visibility
    const TILE_SIZE_SCALED = TILE_SIZE * SCALE;
    const METATILE_SIZE_SCALED = METATILE_SIZE * SCALE;
    
    // Helper function to draw a tile
    const drawTileScaled = (
      canvas: HTMLCanvasElement,
      tile: { tileId: number; palette: number; xflip: boolean; yflip: boolean },
      destX: number,
      destY: number,
      tileSource: TilesetKind
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const palette = tile.palette < 6
        ? resolved.tileset.primaryPalettes[tile.palette]
        : resolved.tileset.secondaryPalettes[tile.palette];
      
      if (!palette) return;
      
      const tiles = tileSource === 'primary' ? patchedTiles.primary : patchedTiles.secondary;
      const tileId = tileSource === 'primary' ? tile.tileId : tile.tileId - SECONDARY_TILE_OFFSET;
      
      // Draw tile directly
      const tileX = (tileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      const tileY = Math.floor(tileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
      
      ctx.imageSmoothingEnabled = false;
      
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const srcX = tile.xflip ? (TILE_SIZE - 1 - x) : x;
          const srcY = tile.yflip ? (TILE_SIZE - 1 - y) : y;
          const idx = (tileY + srcY) * TILES_PER_ROW_IN_IMAGE * TILE_SIZE + (tileX + srcX);
          const paletteIdx = tiles[idx];
          
          if (paletteIdx === 0) continue; // Transparent
          
          const color = palette.colors[paletteIdx];
          ctx.fillStyle = color;
          ctx.fillRect(destX + x * SCALE, destY + y * SCALE, SCALE, SCALE);
        }
      }
    };
    
    // Render bottom layer
    if (bottomLayerCanvasRef.current) {
      const canvas = bottomLayerCanvasRef.current;
      canvas.width = METATILE_SIZE_SCALED;
      canvas.height = METATILE_SIZE_SCALED;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < 4; i++) {
          const tile = metatile.tiles[i];
          const tileSource: TilesetKind = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
          const subX = (i % 2) * TILE_SIZE_SCALED;
          const subY = Math.floor(i / 2) * TILE_SIZE_SCALED;
          drawTileScaled(canvas, tile, subX, subY, tileSource);
        }
      }
    }
    
    // Render top layer
    if (topLayerCanvasRef.current) {
      const canvas = topLayerCanvasRef.current;
      canvas.width = METATILE_SIZE_SCALED;
      canvas.height = METATILE_SIZE_SCALED;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 4; i < 8; i++) {
          const tile = metatile.tiles[i];
          const tileSource: TilesetKind = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
          const subX = ((i - 4) % 2) * TILE_SIZE_SCALED;
          const subY = Math.floor((i - 4) / 2) * TILE_SIZE_SCALED;
          drawTileScaled(canvas, tile, subX, subY, tileSource);
        }
      }
    }
    
    // Render composite
    if (compositeLayerCanvasRef.current) {
      const canvas = compositeLayerCanvasRef.current;
      canvas.width = METATILE_SIZE_SCALED;
      canvas.height = METATILE_SIZE_SCALED;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw bottom layer first
        for (let i = 0; i < 4; i++) {
          const tile = metatile.tiles[i];
          const tileSource: TilesetKind = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
          const subX = (i % 2) * TILE_SIZE_SCALED;
          const subY = Math.floor(i / 2) * TILE_SIZE_SCALED;
          drawTileScaled(canvas, tile, subX, subY, tileSource);
        }
        
        // Draw top layer on top
        for (let i = 4; i < 8; i++) {
          const tile = metatile.tiles[i];
          const tileSource: TilesetKind = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
          const subX = ((i - 4) % 2) * TILE_SIZE_SCALED;
          const subY = Math.floor((i - 4) / 2) * TILE_SIZE_SCALED;
          drawTileScaled(canvas, tile, subX, subY, tileSource);
        }
      }
    }
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
      canvasRef.current &&
      playerControllerRef.current
    ) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [showTileDebug, refreshDebugOverlay]);
  
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

  const topBelowImageDataRef = useRef<ImageData | null>(null);
  const topAboveImageDataRef = useRef<ImageData | null>(null);
  const lastPlayerElevationRef = useRef<number>(0);

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
              // Porymap approach: choose tileset based on palette index, not tile source
              // Secondary tiles can use primary palettes (0-5) and vice versa
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
      const needsImageData =
        !backgroundImageDataRef.current || 
        !topBelowImageDataRef.current || 
        !topAboveImageDataRef.current || 
        animationFrameChanged || 
        viewChanged ||
        elevationChanged; // Re-render if elevation changed

      if (needsImageData) {
        backgroundImageDataRef.current = renderPass(
          ctx,
          'background',
          false,
          view
        );
        
        // Pass 1: Top layer tiles BELOW or EQUAL to player elevation
        // These should be rendered BEFORE the player
        topBelowImageDataRef.current = renderPass(
          ctx,
          'top',
          false,
          view,
          (mapTile, tileX, tileY) => {
            // CRITICAL FIX: Check if this is a vertical object (tree, pole, etc.)
            // Vertical objects should ALWAYS render AFTER player (not in this pass)
            if (isVerticalObject(ctx, tileX, tileY)) {
              return false; // Don't render in TopBelow - will render in TopAbove
            }
            
            // Simplified High/Low Logic with Collision Awareness
            // Player Elevation < 4 (Low): Always covered by Top Layer. (Return False)
            if (playerElevation < 4) return false;

            // Player Elevation >= 4 (High):
            // Usually Player (Prio 3) covers Top Layer (Prio 2). (Return True)
            // EXCEPTION: Same-elevation OBSTACLES (Trees/Walls) should cover the player.
            // If Tile Elevation == Player Elevation AND Collision == 1 (Blocked), treat as Obstacle.
            if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;

            return true;
          }
        );

        // Pass 2: Top layer tiles ABOVE player elevation
        // These should be rendered AFTER the player (covering them)
        topAboveImageDataRef.current = renderPass(
          ctx,
          'top',
          false,
          view,
          (mapTile, tileX, tileY) => {
            // CRITICAL FIX: Check if this is a vertical object (tree, pole, etc.)
            // Vertical objects should ALWAYS render AFTER player (in this pass)
            if (isVerticalObject(ctx, tileX, tileY)) {
              return true; // Always render vertical objects after player
            }
            
            // Player Elevation < 4 (Low): Always covered by Top Layer. (Return True)
            if (playerElevation < 4) return true;

            // Player Elevation >= 4 (High):
            // Usually covered by Player. (Return False)
            // EXCEPTION: Same-elevation OBSTACLES (Trees/Walls) should cover the player.
            if (mapTile.elevation === playerElevation && mapTile.collision === 1) return true;

            return false;
          }
        );
      }

      const offsetX = -Math.round(view.subTileOffsetX);
      const offsetY = -Math.round(view.subTileOffsetY);
      bgCtx.clearRect(0, 0, widthPx, heightPx);
      topCtx.clearRect(0, 0, widthPx, heightPx);
      
      if (backgroundImageDataRef.current) {
        bgCtx.putImageData(backgroundImageDataRef.current, offsetX, offsetY);
      }
      // We don't composite top into a single canvas anymore, we draw them sequentially
      // But we need to clear them?
      // Actually, we can just draw them directly to mainCtx if we have them.
      // Or we can use auxiliary canvases.
      // Let's use topCtx for "Above" and draw "Below" directly?
      // Or maybe just put "Above" into topCtx (which is drawn last).
      // And put "Below" into... bgCtx? No, "Below" is Top Layer, so it must be above Background.
      
      // To avoid creating more canvases, let's draw:
      // 1. Background Canvas (contains Background Pass)
      // 2. TopBelow ImageData (Directly to Main?) No, PutImage needs integer coords.
      //    We can put it into a temp canvas?
      //    Or just reuse topCtx for "Above".
      //    We need a place for "Below".
      //    Let's just render everything to MainCtx in order?
      //    ImageData drawing is fast.
      //    But `putImageData` ignores transformation (offset).
      //    We used `bgCtx.putImageData(..., offsetX, offsetY)`. 
      //    Wait, `putImageData` destination (dx, dy) are in device pixels.
      //    So we can just put them onto the main canvas?
      //    No, Main Canvas is cleared every frame.
      
      mainCtx.clearRect(0, 0, widthPx, heightPx);
      
      // 1. Draw Background Canvas (already populated with Background Pass)
      if (backgroundCanvasRef.current) {
        mainCtx.drawImage(backgroundCanvasRef.current, 0, 0);
      }

      // 2. Draw Top Layer (Below Player)
      if (topBelowImageDataRef.current && topCanvasRef.current) {
        topCtx.clearRect(0, 0, widthPx, heightPx);
        topCtx.putImageData(topBelowImageDataRef.current, offsetX, offsetY);
        mainCtx.drawImage(topCanvasRef.current, 0, 0);
      }

      renderDoorAnimations(mainCtx, view, nowMs);
      renderArrowOverlay(mainCtx, view, nowMs);
      renderReflectionLayer(mainCtx, reflectionState, view);

      const playerY = player ? player.y : 0;

      // Render grass effects behind player (visually "above" player)
      renderGrassEffects(mainCtx, view, 'bottom', playerY);

      if (player && !playerHiddenRef.current) {
        player.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
      }

      // Render grass effects in front of player (visually "below" or at same Y)
      renderGrassEffects(mainCtx, view, 'top', playerY);

      // 3. Draw Top Layer (Above Player)
      if (topAboveImageDataRef.current && topCanvasRef.current) {
        topCtx.clearRect(0, 0, widthPx, heightPx);
        topCtx.putImageData(topAboveImageDataRef.current, offsetX, offsetY);
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

      if (isDebugMode()) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    [renderPass, renderReflectionLayer, renderDoorAnimations, renderArrowOverlay]
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


  /**
   * Render grass field effect sprites (both tall and long grass)
   */
  /**
   * Render grass field effect sprites (both tall and long grass)
   */
  const renderGrassEffects = useCallback(
    (mainCtx: CanvasRenderingContext2D, view: WorldCameraView, layer: 'bottom' | 'top', playerY: number) => {
      const tallGrassSprite = grassSpriteRef.current;
      const longGrassSprite = longGrassSpriteRef.current;
      const sandSprite = sandSpriteRef.current;
      const player = playerControllerRef.current;
      if (!player) return;

      const grassManager = player.getGrassEffectManager();
      const effects = grassManager.getEffectsForRendering();

      for (const effect of effects) {
        // Skip if not visible (for flickering effects like sand)
        if (!effect.visible) continue;

        // Select sprite based on grass type
        let sprite: HTMLCanvasElement | null = null;
        if (effect.type === 'tall') sprite = tallGrassSprite;
        else if (effect.type === 'long') sprite = longGrassSprite;
        else if (effect.type === 'sand' || effect.type === 'deep_sand') sprite = sandSprite;
        
        if (!sprite) continue;

        // Y-sorting:
        // Sand always renders behind player (bottom layer)
        // Grass effects use dynamic Y-sorting
        let isInFront = effect.worldY >= playerY;

        if (effect.type === 'sand' || effect.type === 'deep_sand') {
          // Sand footprints always render behind player
          isInFront = false;
        } else {
          // Dynamic layering from subpriority (for tall grass)
          // If subpriority offset is high (4), it means "lower priority" relative to player, so render BEHIND.
          if (effect.subpriorityOffset > 0) {
            isInFront = false;
          }
        }

        if (layer === 'bottom' && isInFront) continue;
        if (layer === 'top' && !isInFront) continue;
        
        // Each frame is 16x16 pixels
        const FRAME_SIZE = 16;
        const sx = effect.frame * FRAME_SIZE; // Frames are horizontal
        const sy = 0;

        // Calculate screen position
        // GBA sprites use center-based coordinates, but Canvas uses top-left corner
        // The GrassEffectManager returns center coordinates (tile*16 + 8)
        // We need to subtract 8 to convert to top-left corner for Canvas drawImage
        const screenX = Math.round(effect.worldX - view.cameraWorldX - 8);
        const screenY = Math.round(effect.worldY - view.cameraWorldY - 8);

        // Render sprite (with optional horizontal flip for East-facing sand)
        mainCtx.imageSmoothingEnabled = false;
        
        if (effect.flipHorizontal) {
          // Flip horizontally for East-facing sand footprints
          mainCtx.save();
          mainCtx.translate(screenX + FRAME_SIZE, screenY);
          mainCtx.scale(-1, 1);
          mainCtx.drawImage(
            sprite,
            sx,
            sy,
            FRAME_SIZE,
            FRAME_SIZE,
            0,
            0,
            FRAME_SIZE,
            FRAME_SIZE
          );
          mainCtx.restore();
        } else {
          mainCtx.drawImage(
            sprite,
            sx,
            sy,
            FRAME_SIZE,
            FRAME_SIZE,
            screenX,
            screenY,
            FRAME_SIZE,
            FRAME_SIZE
          );
        }
      }
    },
    []
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
        // Load player sprite
        const player = new PlayerController();
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');
        
        // Load grass sprite
        await ensureGrassSprite();
        await ensureLongGrassSprite();
        await ensureSandSprite();
        
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
          Show 3x3 tile debug (Debug Mode)
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
            {centerTileDebugInfo && (
              <div style={{ 
                fontFamily: 'monospace', 
                fontSize: '12px', 
                backgroundColor: '#f5f5f5', 
                padding: '8px', 
                borderRadius: '4px',
                maxWidth: '900px'
              }}>
                <div><strong>Map:</strong> {centerTileDebugInfo.mapName} ({centerTileDebugInfo.mapId})</div>
                <div><strong>World Coords:</strong> ({centerTileDebugInfo.tileX}, {centerTileDebugInfo.tileY})</div>
                <div><strong>Local Coords:</strong> ({centerTileDebugInfo.localX}, {centerTileDebugInfo.localY})</div>
                <div><strong>Metatile ID:</strong> {centerTileDebugInfo.metatileId} {centerTileDebugInfo.isSecondary ? '(Secondary)' : '(Primary)'}</div>
                <div><strong>Palette:</strong> {centerTileDebugInfo.paletteIndex}</div>
                <div><strong>Behavior:</strong> {centerTileDebugInfo.behavior !== undefined ? `0x${centerTileDebugInfo.behavior.toString(16).toUpperCase().padStart(2, '0')}` : 'N/A'}</div>
                
                {/* Elevation & Collision Section */}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                  <div><strong>🏔️ Elevation & Collision:</strong></div>
                  <div style={{ marginLeft: '16px' }}>
                    <div><strong>Tile Elevation:</strong> {centerTileDebugInfo.elevation ?? 'N/A'}</div>
                    <div><strong>Player Elevation:</strong> {centerTileDebugInfo.playerElevation ?? 'N/A'}</div>
                    <div><strong>Collision:</strong> {centerTileDebugInfo.collision ?? 'N/A'} ({centerTileDebugInfo.collisionPassable ? '✅ Passable' : '🚫 Blocked'})</div>
                    {centerTileDebugInfo.isLedge && (
                      <div><strong>Ledge:</strong> ✅ {centerTileDebugInfo.ledgeDirection} (Jump {centerTileDebugInfo.ledgeDirection?.toLowerCase()})</div>
                    )}
                  </div>
                </div>
                
                {/* Layer & Rendering Section */}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                  <div><strong>🎨 Layer & Rendering:</strong></div>
                  <div style={{ marginLeft: '16px' }}>
                    <div><strong>Layer Type:</strong> {centerTileDebugInfo.layerTypeLabel ?? 'N/A'} (raw value: {centerTileDebugInfo.layerType ?? 'N/A'})</div>
                    <div><strong>Bottom Layer Transparency:</strong> {centerTileDebugInfo.bottomLayerTransparency ?? 0}/256 pixels</div>
                    <div><strong>Top Layer Transparency:</strong> {centerTileDebugInfo.topLayerTransparency ?? 0}/256 pixels</div>
                    
                    {/* Visual Layer Decomposition */}
                    <div style={{ marginTop: '8px' }}>
                      <div><strong>🔬 Visual Layer Decomposition (4x scale):</strong></div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '10px', marginBottom: '4px', textAlign: 'center' }}>Bottom Layer<br/>(tiles 0-3)</div>
                          <canvas 
                            ref={bottomLayerCanvasRef} 
                            width={64} 
                            height={64}
                            style={{ 
                              border: '1px solid #888', 
                              imageRendering: 'pixelated',
                              backgroundColor: '#000'
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', marginBottom: '4px', textAlign: 'center' }}>Top Layer<br/>(tiles 4-7)</div>
                          <canvas 
                            ref={topLayerCanvasRef} 
                            width={64} 
                            height={64}
                            style={{ 
                              border: '1px solid #888', 
                              imageRendering: 'pixelated',
                              backgroundColor: '#000'
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', marginBottom: '4px', textAlign: 'center' }}>Composite<br/>(both layers)</div>
                          <canvas 
                            ref={compositeLayerCanvasRef} 
                            width={64} 
                            height={64}
                            style={{ 
                              border: '1px solid #888', 
                              imageRendering: 'pixelated',
                              backgroundColor: '#000'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '8px' }}>
                      <div><strong>Render Passes:</strong></div>
                      <div style={{ marginLeft: '16px', fontSize: '11px' }}>
                        <div>🟢 <strong>Background Pass:</strong> {centerTileDebugInfo.renderedInBackgroundPass ? '✅ YES' : '❌ NO'} (bottom layer)</div>
                        <div>🟡 <strong>Top-Below Pass:</strong> {centerTileDebugInfo.renderedInTopBelowPass ? '✅ YES' : '❌ NO'} (before player)</div>
                        <div style={{ marginLeft: '16px', color: '#666' }}>{centerTileDebugInfo.topBelowPassReason}</div>
                        <div>🔴 <strong>Top-Above Pass:</strong> {centerTileDebugInfo.renderedInTopAbovePass ? '✅ YES' : '❌ NO'} (after player)</div>
                        <div style={{ marginLeft: '16px', color: '#666' }}>{centerTileDebugInfo.topAbovePassReason}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Detailed Tile Breakdown */}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                  <div><strong>🔍 Tile Details (8×8 tiles in this metatile):</strong></div>
                  <div style={{ marginLeft: '16px', fontSize: '11px' }}>
                    <div style={{ marginTop: '4px' }}><strong>Bottom Layer (tiles 0-3):</strong></div>
                    {centerTileDebugInfo.bottomTileDetails && centerTileDebugInfo.bottomTileDetails.length > 0 ? (
                      centerTileDebugInfo.bottomTileDetails.map((detail, i) => (
                        <div key={i} style={{ marginLeft: '16px', fontFamily: 'monospace' }}>{detail}</div>
                      ))
                    ) : (
                      <div style={{ marginLeft: '16px', color: '#999' }}>No bottom tiles</div>
                    )}
                    
                    <div style={{ marginTop: '4px' }}><strong>Top Layer (tiles 4-7):</strong></div>
                    {centerTileDebugInfo.topTileDetails && centerTileDebugInfo.topTileDetails.length > 0 ? (
                      centerTileDebugInfo.topTileDetails.map((detail, i) => (
                        <div key={i} style={{ marginLeft: '16px', fontFamily: 'monospace' }}>{detail}</div>
                      ))
                    ) : (
                      <div style={{ marginLeft: '16px', color: '#999' }}>No top tiles</div>
                    )}
                  </div>
                </div>
                
                {/* Adjacent Tiles */}
                {centerTileDebugInfo.adjacentTileInfo && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                    <div><strong>🧭 Adjacent Tiles (can affect rendering):</strong></div>
                    <div style={{ marginLeft: '16px', fontSize: '11px' }}>
                      {centerTileDebugInfo.adjacentTileInfo.north && (
                        <div>⬆️ <strong>North:</strong> Metatile {centerTileDebugInfo.adjacentTileInfo.north.metatileId}, Layer: {centerTileDebugInfo.adjacentTileInfo.north.layerTypeLabel} ({centerTileDebugInfo.adjacentTileInfo.north.layerType})</div>
                      )}
                      {centerTileDebugInfo.adjacentTileInfo.south && (
                        <div>⬇️ <strong>South:</strong> Metatile {centerTileDebugInfo.adjacentTileInfo.south.metatileId}, Layer: {centerTileDebugInfo.adjacentTileInfo.south.layerTypeLabel} ({centerTileDebugInfo.adjacentTileInfo.south.layerType})</div>
                      )}
                      {centerTileDebugInfo.adjacentTileInfo.east && (
                        <div>➡️ <strong>East:</strong> Metatile {centerTileDebugInfo.adjacentTileInfo.east.metatileId}, Layer: {centerTileDebugInfo.adjacentTileInfo.east.layerTypeLabel} ({centerTileDebugInfo.adjacentTileInfo.east.layerType})</div>
                      )}
                      {centerTileDebugInfo.adjacentTileInfo.west && (
                        <div>⬅️ <strong>West:</strong> Metatile {centerTileDebugInfo.adjacentTileInfo.west.metatileId}, Layer: {centerTileDebugInfo.adjacentTileInfo.west.layerTypeLabel} ({centerTileDebugInfo.adjacentTileInfo.west.layerType})</div>
                      )}
                    </div>
                  </div>
                )}
                
                {centerTileDebugInfo.isReflective && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                    <div><strong>💧 Reflection:</strong> {centerTileDebugInfo.reflectionType ?? 'unknown'} ({centerTileDebugInfo.reflectionMaskAllow}/{centerTileDebugInfo.reflectionMaskTotal} pixels)</div>
                  </div>
                )}
                
                <div style={{ marginTop: '4px' }}>
                  <div><strong>Tilesets:</strong> {centerTileDebugInfo.primaryTilesetId} + {centerTileDebugInfo.secondaryTilesetId}</div>
                </div>
                
                {centerTileDebugInfo.warpEvent && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                    <div><strong>🚪 Warp Event:</strong></div>
                    <div style={{ marginLeft: '16px' }}>
                      <div><strong>Kind:</strong> {centerTileDebugInfo.warpKind ?? 'unknown'}</div>
                      <div><strong>Destination:</strong> {centerTileDebugInfo.warpEvent.destMap}</div>
                      <div><strong>Dest Warp ID:</strong> {centerTileDebugInfo.warpEvent.destWarpId}</div>
                      <div><strong>Elevation:</strong> {centerTileDebugInfo.warpEvent.elevation}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={handleCopyTileDebug} style={{ alignSelf: 'flex-start' }}>
              Copy tile debug to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
