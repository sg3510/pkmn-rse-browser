import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import UPNG from 'upng-js';
import { PlayerController, type DoorWarpRequest } from '../game/PlayerController';
import { MapManager, type TilesetResources, type WorldState } from '../services/MapManager';
import { ObjectEventManager } from '../game/ObjectEventManager';
import { saveManager, type SaveData, type SaveResult, type LocationState } from '../save';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { ViewportBuffer, type BufferTileResolver } from '../rendering/ViewportBuffer';
import { TilesetCanvasCache } from '../rendering/TilesetCanvasCache';
import { RenderPipeline } from '../rendering/RenderPipeline';
import { AnimationTimer } from '../engine/AnimationTimer';
import { GameLoop, type FrameHandler } from '../engine/GameLoop';
import { createInitialState, ObservableState, type Position } from '../engine/GameState';
import { UpdateCoordinator } from '../engine/UpdateCoordinator';
import { useInput } from '../hooks/useInput';
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
import { getSpritePriorityForElevation } from '../utils/elevationPriority';
import {
  TILESET_ANIMATION_CONFIGS,
  type TilesetKind,
} from '../data/tilesetAnimations';
import type { CardinalDirection } from '../utils/metatileBehaviors';
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
// WarpEvent type used via WarpTrigger from './map/utils'

const PROJECT_ROOT = '/pokeemerald';

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

import {
  type ReflectionType,
  type ReflectionMeta,
  type ReflectionState,
  type TilesetBuffers,
  type TilesetRuntime,
  type RenderContext,
  type ResolvedTile,
  type LoadedAnimation,
  type DebugTileInfo,
} from './map/types';
import {
  resolveTileAt,
  findWarpEventAt,
  detectWarpTrigger,
  isVerticalObject,
  classifyWarpKind,
  computeReflectionState,
  type WarpTrigger,
} from './map/utils';
import { DebugRenderer } from './map/renderers/DebugRenderer';
import { ObjectRenderer } from './map/renderers/ObjectRenderer';
import { DialogBox, useDialog } from './dialog';
// Field effect types and controllers from refactored modules
import {
  type DoorSize,
  type DoorAnimDrawable,
  type DoorEntryStage,
  type DoorExitStage,
  DOOR_TIMING,
} from '../field/types';
import { FadeController } from '../field/FadeController';
import { ArrowOverlay } from '../field/ArrowOverlay';
import { WarpHandler } from '../field/WarpHandler';
import { npcSpriteCache, renderNPCs, renderNPCReflections, renderNPCGrassEffects } from '../game/npc';
import { DebugPanel, DEFAULT_DEBUG_OPTIONS, type DebugOptions, type DebugState } from './debug';

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

/**
 * Handle for imperative methods exposed via ref
 */
export interface MapRendererHandle {
  /** Save current game state */
  saveGame: () => SaveResult;
  /** Load game from save slot 0 */
  loadGame: () => SaveData | null;
  /** Get current player position */
  getPlayerPosition: () => { tileX: number; tileY: number; direction: string; mapId: string } | null;
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

interface EngineFrameResult {
  view: WorldCameraView | null;
  viewChanged: boolean;
  animationFrameChanged: boolean;
  shouldRender: boolean;
  timestamp: number;
}



// WarpTrigger imported from './map/utils'
// WarpHandler manages warp state (imported from '../field/WarpHandler')

// DoorSize and DoorAnimDrawable types imported from '../field/types'

interface DoorEntrySequence {
  stage: DoorEntryStage;
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
  stage: DoorExitStage;
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  isAnimatedDoor?: boolean; // If false, skip door animation but still do scripted movement
  exitDirection?: 'up' | 'down' | 'left' | 'right'; // Direction to walk when exiting
  openAnimId?: number;
  closeAnimId?: number;
}

// ArrowOverlayState type imported from '../field/types'

// FadeState type imported from '../field/types'

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
// Door timing constants imported from '../field/types' as DOOR_TIMING
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
// DOOR_FADE_DURATION replaced by DOOR_TIMING.FADE_DURATION_MS from '../field/types'
const DEBUG_MODE_FLAG = 'DEBUG_MODE'; // Global debug flag for console logging
const ARROW_SPRITE_PATH = `${PROJECT_ROOT}/graphics/field_effects/pics/arrow.png`;
// DIRECTION_VECTORS imported from '../field/types'

// Feature flag for hardware-accelerated rendering
// Set to false to fall back to original ImageData-based rendering
const USE_HARDWARE_RENDERING = true;

// Feature flag for viewport buffer (overscan scrolling optimization)
// DISABLED: The incremental edge rendering approach has bugs with sub-tile offsets
// The old_refactor/ChunkManager approach is better - it uses fixed chunks with extraHash
// For now, fall back to the working hardware rendering (renderPassCanvas)
const USE_VIEWPORT_BUFFER = false;

// ReflectionState imported from './map/types'



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





export const MapRenderer = forwardRef<MapRendererHandle, MapRendererProps>(({
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
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const cameraViewRef = useRef<WorldCameraView | null>(null);
  const mapManagerRef = useRef<MapManager>(new MapManager());
  const gameStateRef = useRef<ObservableState | null>(null);
  const animationTimerRef = useRef<AnimationTimer | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const updateCoordinatorRef = useRef<UpdateCoordinator | null>(null);
  const lastFrameResultRef = useRef<EngineFrameResult | null>(null);
  const hasRenderedRef = useRef<boolean>(false);
  const renderGenerationRef = useRef<number>(0);
  const lastViewKeyRef = useRef<string>('');

  const backgroundImageDataRef = useRef<ImageData | null>(null);
  const topImageDataRef = useRef<ImageData | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugEnabledRef = useRef<boolean>(false);
  const debugOptionsRef = useRef<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
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

  // Dialog system for surf prompts, etc.
  const { showYesNo, showMessage, isOpen: dialogIsOpen } = useDialog();
  const surfPromptInProgressRef = useRef<boolean>(false);
  const itemPickupInProgressRef = useRef<boolean>(false);
  const currentTimestampRef = useRef<number>(0);
  // ArrowOverlay manages arrow warp indicator state
  const arrowOverlayRef = useRef<ArrowOverlay>(new ArrowOverlay());
  // WarpHandler manages warp detection and cooldown state
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  const arrowSpriteRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const arrowSpritePromiseRef = useRef<Promise<HTMLImageElement | HTMLCanvasElement> | null>(null);
  const grassSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const longGrassSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const sandSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const splashSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const rippleSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const itemBallSpriteRef = useRef<HTMLCanvasElement | null>(null);
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());
  const canvasRendererRef = useRef<CanvasRenderer | null>(null); // Hardware-accelerated renderer
  const viewportBufferRef = useRef<ViewportBuffer | null>(null); // Viewport buffer for smooth scrolling
  const tilesetCacheRef = useRef<TilesetCanvasCache | null>(null); // Shared tileset cache
  const renderPipelineRef = useRef<RenderPipeline | null>(null); // Modular render pipeline
  const doorExitRef = useRef<DoorExitSequence>({
    stage: 'idle',
    doorWorldX: 0,
    doorWorldY: 0,
    metatileId: 0,
  });
  // FadeController manages screen fade in/out transitions
  const fadeRef = useRef<FadeController>(new FadeController());

  // Expose save/load methods via ref
  useImperativeHandle(ref, () => ({
    saveGame: (): SaveResult => {
      const player = playerControllerRef.current;
      const ctx = renderContextRef.current;
      if (!player || !ctx) {
        return { success: false, error: 'Game not initialized' };
      }

      const currentMapId = ctx.anchor.entry.id;
      const locationState: LocationState = {
        pos: { x: player.tileX, y: player.tileY },
        location: { mapId: currentMapId, warpId: 0, x: player.tileX, y: player.tileY },
        continueGameWarp: { mapId: currentMapId, warpId: 0, x: player.tileX, y: player.tileY },
        lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
        escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
        direction: player.dir,
        elevation: 3,
        isSurfing: player.isSurfing(),
      };

      return saveManager.save(0, locationState);
    },

    loadGame: (): SaveData | null => {
      const saveData = saveManager.load(0);
      if (!saveData) return null;

      const player = playerControllerRef.current;
      if (player) {
        player.setPositionAndDirection(
          saveData.location.pos.x,
          saveData.location.pos.y,
          saveData.location.direction
        );
        // Refresh object events to reflect loaded flag state
        objectEventManagerRef.current.refreshCollectedState();
      }

      return saveData;
    },

    getPlayerPosition: () => {
      const player = playerControllerRef.current;
      const ctx = renderContextRef.current;
      if (!player || !ctx) return null;
      return {
        tileX: player.tileX,
        tileY: player.tileY,
        direction: player.dir,
        mapId: ctx.anchor.entry.id,
      };
    },
  }), []);

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
        const frameCount = Math.max(1, Math.floor(image.height / DOOR_TIMING.FRAME_HEIGHT));
        const anim: DoorAnimDrawable = {
          id: doorAnimIdRef.current++,
          image,
          direction,
          frameCount,
          frameHeight: DOOR_TIMING.FRAME_HEIGHT,
          frameDuration: DOOR_TIMING.FRAME_DURATION_MS,
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
        arrowOverlayRef.current.hide();
        return;
      }
      const tile = resolvedTile ?? resolveTileAt(ctx, player.tileX, player.tileY);
      if (!tile) {
        arrowOverlayRef.current.hide();
        return;
      }
      const behavior = tile.attributes?.behavior ?? -1;
      const arrowDir = getArrowDirectionFromBehavior(behavior);

      // Ensure arrow sprite is loaded
      if (arrowDir && !arrowSpriteRef.current && !arrowSpritePromiseRef.current) {
        ensureArrowSprite().catch((err) => {
          if (isDebugMode()) {
            console.warn('Failed to load arrow sprite', err);
          }
        });
      }

      // Update arrow overlay state using ArrowOverlay class
      arrowOverlayRef.current.update(
        player.dir,
        arrowDir,
        player.tileX,
        player.tileY,
        now,
        warpInProgress
      );
    },
    [ensureArrowSprite]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centerTileDebugInfo, setCenterTileDebugInfo] = useState<DebugTileInfo | null>(null);

  // Debug panel state - unified (replaces old showTileDebug)
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [debugState, setDebugState] = useState<DebugState>({
    player: null,
    tile: null,
    objectsAtPlayerTile: null,
    objectsAtFacingTile: null,
    adjacentObjects: null,
    allVisibleNPCs: [],
    allVisibleItems: [],
    totalNPCCount: 0,
    totalItemCount: 0,
  });
  
  // Canvas refs for layer decomposition
  const bottomLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Set global debug flag when debug enabled changes
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG] = debugOptions.enabled;
  }, [debugOptions.enabled]);

  // Player Controller


  const refreshDebugOverlay = useCallback(
    (ctx: RenderContext, player: PlayerController, view: WorldCameraView | null) => {
      if (!debugEnabledRef.current || !view) return;
      const mainCanvas = canvasRef.current;
      const dbgCanvas = debugCanvasRef.current;
      if (!dbgCanvas || !mainCanvas) return;

      DebugRenderer.renderDebugOverlay(
        ctx,
        player,
        view,
        mainCanvas,
        dbgCanvas,
        setCenterTileDebugInfo,
        debugTilesRef
      );
    },
    [setCenterTileDebugInfo]
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
    debugEnabledRef.current = debugOptions.enabled;
    debugOptionsRef.current = debugOptions;
    if (
      debugOptions.enabled &&
      renderContextRef.current &&
      canvasRef.current &&
      playerControllerRef.current
    ) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [debugOptions, refreshDebugOverlay]);

  // Update layer decomposition when center tile changes
  useEffect(() => {
    if (debugOptions.enabled && centerTileDebugInfo && renderContextRef.current) {
      renderLayerDecomposition(renderContextRef.current, centerTileDebugInfo);
    }
  }, [debugOptions.enabled, centerTileDebugInfo, renderLayerDecomposition]);

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

      // Re-parse object events for the new world
      const objectEventManager = objectEventManagerRef.current;
      objectEventManager.clear();
      for (const map of world.maps) {
        objectEventManager.parseMapObjects(
          map.entry.id,
          map.objectEvents,
          map.offsetX,
          map.offsetY
        );
      }

      // Load NPC sprites for visible NPCs
      const npcGraphicsIds = objectEventManager.getUniqueNPCGraphicsIds();
      if (npcGraphicsIds.length > 0) {
        await npcSpriteCache.loadMany(npcGraphicsIds);
      }
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
      console.warn('Canvas renderer not initialized');
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

  // NEW: Hardware-accelerated Canvas-based render pass
  // This is 5-10× faster than renderPass but produces IDENTICAL output
  const renderPassCanvas = useCallback(
    (
      ctx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      view: WorldCameraView,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean,
      existingCanvas?: HTMLCanvasElement | null
    ): HTMLCanvasElement => {
      const widthPx = view.tilesWide * METATILE_SIZE;
      const heightPx = view.tilesHigh * METATILE_SIZE;

      // OPTIMIZATION: Reuse existing canvas if dimensions match
      let canvas: HTMLCanvasElement;
      if (existingCanvas && existingCanvas.width === widthPx && existingCanvas.height === heightPx) {
        canvas = existingCanvas;
      } else {
        canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;
      }
      const canvasCtx = canvas.getContext('2d', { alpha: true })!;

      // Clear canvas before redrawing
      canvasCtx.clearRect(0, 0, widthPx, heightPx);

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
              console.log(`[RENDER_DEBUG_CANVAS] Tile (19, 70) Pass=${pass} PlayerElev=${playerElev} TileElev=${tileElev} Col=${tileCol} FilteredOut=${filteredOut}`);
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

              const subX = (i % 2) * TILE_SIZE;
              const subY = Math.floor(i / 2) * TILE_SIZE;
              
              // CRITICAL: Palette selection matches original logic
              // Choose tileset based on palette index, NOT tile source
              const NUM_PALS_IN_PRIMARY = 6;
              const palette = tile.palette < NUM_PALS_IN_PRIMARY
                ? resolved.tileset.primaryPalettes[tile.palette]
                : resolved.tileset.secondaryPalettes[tile.palette];
              if (!palette) continue;

              // Draw using hardware-accelerated renderer
              drawTileToCanvas(
                canvasCtx,
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

      return canvas;
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

      // VIEWPORT BUFFER MODE: Buttery smooth scrolling with overscan buffer
      if (USE_VIEWPORT_BUFFER && viewportBufferRef.current) {
        const vbuffer = viewportBufferRef.current;

        // Update buffer state
        vbuffer.setPlayerElevation(playerElevation);
        vbuffer.setAnimationFrame(animationFrameChanged ? Date.now() : 0);

        // Create tile resolver for the buffer
        const bufferResolveTile: BufferTileResolver = (tileX, tileY) => {
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved || !resolved.metatile) return null;

          const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
          if (!runtime) return null;

          const patchedTiles = runtime.patchedTiles ?? {
            primary: runtime.resources.primaryTilesImage,
            secondary: runtime.resources.secondaryTilesImage,
          };

          return {
            metatile: resolved.metatile,
            attributes: resolved.attributes ?? null,
            mapTile: resolved.mapTile,
            tileset: {
              key: resolved.tileset.key,
              primaryPalettes: resolved.tileset.primaryPalettes,
              secondaryPalettes: resolved.tileset.secondaryPalettes,
            },
            patchedTiles,
            animatedTileIds: runtime.animatedTileIds,
          };
        };

        // isVerticalObject helper for buffer
        const isVerticalObjectForBuffer = (tileX: number, tileY: number) => {
          return isVerticalObject(ctx, tileX, tileY);
        };

        // Clear and composite using viewport buffer
        mainCtx.clearRect(0, 0, widthPx, heightPx);

        // Invalidate buffer on animation change
        if (animationFrameChanged) {
          vbuffer.invalidateAll();
          // Also clear tileset cache on animation change
          if (tilesetCacheRef.current) {
            tilesetCacheRef.current.clear();
          }
        }

        // Composite all three passes using the viewport buffer
        vbuffer.composite(
          mainCtx,
          'background',
          view.worldStartTileX,
          view.worldStartTileY,
          view.subTileOffsetX,
          view.subTileOffsetY,
          bufferResolveTile,
          isVerticalObjectForBuffer,
          animationFrameChanged || elevationChanged
        );

        vbuffer.composite(
          mainCtx,
          'topBelow',
          view.worldStartTileX,
          view.worldStartTileY,
          view.subTileOffsetX,
          view.subTileOffsetY,
          bufferResolveTile,
          isVerticalObjectForBuffer,
          animationFrameChanged || elevationChanged
        );

        // Player rendering happens between topBelow and topAbove
        // ... handled below in the common code path

        // Store reference for topAbove pass (rendered after player)
        // We'll do the topAbove composite after player render
      } else if (USE_HARDWARE_RENDERING) {
        // Hardware-accelerated Canvas mode
        const needsRender =
          !backgroundCanvasDataRef.current || 
          !topBelowCanvasDataRef.current || 
          !topAboveCanvasDataRef.current || 
          animationFrameChanged || 
          viewChanged ||
          elevationChanged;

        if (needsRender) {
          // OPTIMIZATION: Pass existing canvas for reuse (avoids allocations)
          backgroundCanvasDataRef.current = renderPassCanvas(
            ctx, 'background', false, view, undefined, backgroundCanvasDataRef.current
          );

          // GBA pokeemerald elevation-to-priority (sElevationToPriority)
          const playerPriority = getSpritePriorityForElevation(playerElevation);
          const playerAboveTopLayer = playerPriority <= 1; // priority 0/1 draws above BG1

          topBelowCanvasDataRef.current = renderPassCanvas(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return false;
              }
              if (!playerAboveTopLayer) return false;
              if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;
              return true;
            },
            topBelowCanvasDataRef.current
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
              if (playerAboveTopLayer) {
                if (mapTile.elevation === playerElevation && mapTile.collision === 1) return true;
                return false;
              }
              return true;
            },
            topAboveCanvasDataRef.current
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

          // GBA pokeemerald elevation-to-priority (sElevationToPriority)
          const playerPriority = getSpritePriorityForElevation(playerElevation);
          const playerAboveTopLayer = playerPriority <= 1; // priority 0/1 draws above BG1

          topBelowImageDataRef.current = renderPass(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return false;
              }
              if (!playerAboveTopLayer) return false;
              if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;
              return true;
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
              if (playerAboveTopLayer) {
                if (mapTile.elevation === playerElevation && mapTile.collision === 1) return true;
                return false;
              }
              return true;
            }
          );
        }
      }

      const offsetX = -Math.round(view.subTileOffsetX);
      const offsetY = -Math.round(view.subTileOffsetY);

      // Skip initial clear and background/topBelow compositing for viewport buffer mode
      // (already done in the viewport buffer section above)
      if (!USE_VIEWPORT_BUFFER || !viewportBufferRef.current) {
        mainCtx.clearRect(0, 0, widthPx, heightPx);

        if (USE_HARDWARE_RENDERING) {
          // Hardware-accelerated Canvas mode - direct drawImage
          if (backgroundCanvasDataRef.current) {
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
      }

      renderDoorAnimations(mainCtx, view, nowMs);
      // Render arrow overlay using ArrowOverlay class
      const arrowState = arrowOverlayRef.current.getState();
      if (arrowState && arrowSpriteRef.current) {
        ObjectRenderer.renderArrow(mainCtx, arrowState, arrowSpriteRef.current, view, nowMs);
      }
      if (player) {
        ObjectRenderer.renderReflection(mainCtx, player, reflectionState, view, ctx);
      }

      // Render NPC reflections (before NPCs so reflections appear underneath)
      {
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCReflections(mainCtx, npcs, view, ctx);
      }

      const playerY = player ? player.y : 0;

      // Render field effects behind player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: grassSpriteRef.current,
          longGrass: longGrassSpriteRef.current,
          sand: sandSpriteRef.current,
          splash: splashSpriteRef.current,
          ripple: rippleSpriteRef.current,
          arrow: arrowSpriteRef.current,
          itemBall: itemBallSpriteRef.current,
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'bottom', ctx);

        // Render item balls behind player
        const itemBalls = objectEventManagerRef.current.getVisibleItemBalls();
        ObjectRenderer.renderItemBalls(mainCtx, itemBalls, itemBallSpriteRef.current, view, player.tileY, 'bottom');

        // Render NPCs behind player
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom');

        // Render grass effects over NPCs (so grass covers their lower body)
        renderNPCGrassEffects(mainCtx, npcs, view, ctx, {
          tallGrass: grassSpriteRef.current,
          longGrass: longGrassSpriteRef.current,
        });
      }

      // Render surf blob (if surfing or mounting/dismounting)
      // The blob is rendered BEFORE player so player appears on top
      if (player && !playerHiddenRef.current) {
        const surfCtrl = player.getSurfingController();
        const blobRenderer = surfCtrl.getBlobRenderer();
        const shouldRenderBlob = player.isSurfing() || surfCtrl.isJumping();

        if (shouldRenderBlob && blobRenderer.isReady()) {
          const bobOffset = blobRenderer.getBobOffset();
          let blobScreenX: number;
          let blobScreenY: number;

          // Determine blob position based on current animation phase
          if (surfCtrl.isJumpingOn()) {
            // MOUNTING: Blob is at target water tile (destination)
            const targetPos = surfCtrl.getTargetPosition();
            if (targetPos) {
              const blobWorldX = targetPos.tileX * 16 - 8;
              const blobWorldY = targetPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else if (surfCtrl.isJumpingOff()) {
            // DISMOUNTING: Blob stays at fixed water tile position
            const fixedPos = surfCtrl.getBlobFixedPosition();
            if (fixedPos) {
              const blobWorldX = fixedPos.tileX * 16 - 8;
              const blobWorldY = fixedPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else {
            // Normal surfing: Blob follows player
            blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
            blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
          }

          // applyBob = false because we already added bobOffset to blobScreenY
          blobRenderer.render(mainCtx, blobScreenX, blobScreenY, player.dir, false);
        }
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
          splash: splashSpriteRef.current,
          ripple: rippleSpriteRef.current,
          arrow: arrowSpriteRef.current,
          itemBall: itemBallSpriteRef.current,
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'top', ctx);

        // Render item balls in front of player
        const itemBalls = objectEventManagerRef.current.getVisibleItemBalls();
        ObjectRenderer.renderItemBalls(mainCtx, itemBalls, itemBallSpriteRef.current, view, player.tileY, 'top');

        // Render NPCs in front of player
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCs(mainCtx, npcs, view, player.tileY, 'top');

        // Render grass effects over NPCs (so grass covers their lower body)
        renderNPCGrassEffects(mainCtx, npcs, view, ctx, {
          tallGrass: grassSpriteRef.current,
          longGrass: longGrassSpriteRef.current,
        });
      }

      // 3. Draw Top Layer (Above Player)
      if (USE_VIEWPORT_BUFFER && viewportBufferRef.current) {
        // Viewport buffer mode - composite topAbove pass
        const vbuffer = viewportBufferRef.current;
        const bufferResolveTile: BufferTileResolver = (tileX, tileY) => {
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved || !resolved.metatile) return null;
          const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
          if (!runtime) return null;
          const patchedTiles = runtime.patchedTiles ?? {
            primary: runtime.resources.primaryTilesImage,
            secondary: runtime.resources.secondaryTilesImage,
          };
          return {
            metatile: resolved.metatile,
            attributes: resolved.attributes ?? null,
            mapTile: resolved.mapTile,
            tileset: {
              key: resolved.tileset.key,
              primaryPalettes: resolved.tileset.primaryPalettes,
              secondaryPalettes: resolved.tileset.secondaryPalettes,
            },
            patchedTiles,
            animatedTileIds: runtime.animatedTileIds,
          };
        };
        const isVerticalObjectForBuffer = (tileX: number, tileY: number) => isVerticalObject(ctx, tileX, tileY);

        vbuffer.composite(
          mainCtx,
          'topAbove',
          view.worldStartTileX,
          view.worldStartTileY,
          view.subTileOffsetX,
          view.subTileOffsetY,
          bufferResolveTile,
          isVerticalObjectForBuffer,
          animationFrameChanged || elevationChanged
        );
      } else if (USE_HARDWARE_RENDERING) {
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

      // Render debug overlays if enabled
      const showCollision = debugOptionsRef.current.showCollisionOverlay;
      const showElevation = debugOptionsRef.current.showElevationOverlay;

      if (showCollision || showElevation) {
        const METATILE_PX = 16;

        // Calculate visible tile range
        const startTileX = view.worldStartTileX;
        const startTileY = view.worldStartTileY;
        const tilesWide = Math.ceil(widthPx / METATILE_PX) + 1;
        const tilesHigh = Math.ceil(heightPx / METATILE_PX) + 1;

        // Elevation colors - gradient from blue (low) to red (high)
        const elevationColors = [
          '#0000ff', // 0 - blue
          '#0044ff', // 1
          '#0088ff', // 2
          '#00ccff', // 3
          '#00ffcc', // 4
          '#00ff88', // 5
          '#00ff44', // 6
          '#00ff00', // 7 - green
          '#44ff00', // 8
          '#88ff00', // 9
          '#ccff00', // 10
          '#ffff00', // 11 - yellow
          '#ffcc00', // 12
          '#ff8800', // 13
          '#ff4400', // 14
          '#ff0000', // 15 - red
        ];

        for (let ty = 0; ty < tilesHigh; ty++) {
          for (let tx = 0; tx < tilesWide; tx++) {
            const worldTileX = startTileX + tx;
            const worldTileY = startTileY + ty;
            const resolved = resolveTileAt(ctx, worldTileX, worldTileY);

            if (resolved) {
              const screenX = tx * METATILE_PX - Math.round(view.subTileOffsetX);
              const screenY = ty * METATILE_PX - Math.round(view.subTileOffsetY);

              // Render elevation overlay (bottom layer)
              if (showElevation) {
                const elevation = resolved.mapTile.elevation;
                mainCtx.globalAlpha = 0.35;
                mainCtx.fillStyle = elevationColors[elevation] || '#888888';
                mainCtx.fillRect(screenX, screenY, METATILE_PX, METATILE_PX);
              }

              // Render collision overlay (top layer, with hatching for blocked)
              if (showCollision) {
                const collision = resolved.mapTile.collision;
                mainCtx.globalAlpha = 0.4;

                if (collision === 0) {
                  // Passable - green border only (so elevation shows through)
                  mainCtx.strokeStyle = '#00ff00';
                  mainCtx.lineWidth = 1;
                  mainCtx.strokeRect(screenX + 0.5, screenY + 0.5, METATILE_PX - 1, METATILE_PX - 1);
                } else if (collision === 1) {
                  // Blocked - red with X pattern
                  mainCtx.fillStyle = '#ff0000';
                  mainCtx.fillRect(screenX, screenY, METATILE_PX, METATILE_PX);
                  // Draw X for blocked tiles
                  mainCtx.globalAlpha = 0.6;
                  mainCtx.strokeStyle = '#000000';
                  mainCtx.lineWidth = 2;
                  mainCtx.beginPath();
                  mainCtx.moveTo(screenX + 2, screenY + 2);
                  mainCtx.lineTo(screenX + METATILE_PX - 2, screenY + METATILE_PX - 2);
                  mainCtx.moveTo(screenX + METATILE_PX - 2, screenY + 2);
                  mainCtx.lineTo(screenX + 2, screenY + METATILE_PX - 2);
                  mainCtx.stroke();
                } else {
                  // Other collision types - yellow
                  mainCtx.fillStyle = '#ffff00';
                  mainCtx.fillRect(screenX, screenY, METATILE_PX, METATILE_PX);
                }
              }
            }
          }
        }

        mainCtx.globalAlpha = 1.0;
      }

      // Render fade overlay using FadeController
      if (fadeRef.current.isActive()) {
        const alpha = fadeRef.current.getAlpha(nowMs);
        mainCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        mainCtx.fillRect(0, 0, widthPx, heightPx);
        if (fadeRef.current.isComplete(nowMs)) {
          fadeRef.current.clear();
        }
      }

      if (isDebugMode()) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    [renderPass, renderPassCanvas, renderDoorAnimations]
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
   * Load splash sprite sheet and convert to transparent canvas
   * Puddle splash uses cyan (top-left pixel) as transparency color
   */
  const ensureSplashSprite = useCallback(async (): Promise<HTMLCanvasElement> => {
    if (splashSpriteRef.current) {
      return splashSpriteRef.current;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/pokeemerald/graphics/field_effects/pics/splash.png';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get splash sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Make transparent - assume top-left pixel is background (cyan for GBA sprites)
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
        splashSpriteRef.current = canvas;
        resolve(canvas);
      };
      img.onerror = (err) => reject(err);
    });
  }, []);

  /**
   * Load ripple sprite sheet and convert to transparent canvas
   * Water ripple uses cyan (top-left pixel) as transparency color
   * Ripple sprite is 80x16 = 5 frames of 16x16 pixels
   */
  const ensureRippleSprite = useCallback(async (): Promise<HTMLCanvasElement> => {
    if (rippleSpriteRef.current) {
      return rippleSpriteRef.current;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/pokeemerald/graphics/field_effects/pics/ripple.png';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get ripple sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Make transparent - assume top-left pixel is background (cyan for GBA sprites)
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
        rippleSpriteRef.current = canvas;
        resolve(canvas);
      };
      img.onerror = (err) => reject(err);
    });
  }, []);

  /**
   * Load item ball sprite and convert to transparent canvas
   * Item ball uses cyan (top-left pixel) as transparency color
   * Sprite is 16x16 pixels
   */
  const ensureItemBallSprite = useCallback(async (): Promise<HTMLCanvasElement> => {
    if (itemBallSpriteRef.current) {
      return itemBallSpriteRef.current;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/pokeemerald/graphics/object_events/pics/misc/item_ball.png';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get item ball sprite context'));
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Make transparent - assume top-left pixel is background (cyan for GBA sprites)
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
        itemBallSpriteRef.current = canvas;
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
        gameLoopRef.current?.stop();
        gameLoopRef.current = null;
        updateCoordinatorRef.current = null;
        gameStateRef.current = null;
        animationTimerRef.current = null;
        lastFrameResultRef.current = null;

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
        await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');
        
        // Load grass sprite and other field effect sprites
        await ensureGrassSprite();
        await ensureLongGrassSprite();
        await ensureSandSprite();
        await ensureSplashSprite();
        await ensureRippleSprite();
        await ensureItemBallSprite();

        // Note: Object events are parsed in rebuildContextForWorld() which was called above

        // Initialize hardware-accelerated renderer
        if (USE_HARDWARE_RENDERING) {
          canvasRendererRef.current = new CanvasRenderer();
          console.log('[PERF] Hardware-accelerated rendering enabled');
        }

        // Initialize shared tileset cache and render pipeline
        if (!tilesetCacheRef.current) {
          tilesetCacheRef.current = new TilesetCanvasCache();
        }
        renderPipelineRef.current = new RenderPipeline(tilesetCacheRef.current);
        console.log('[PERF] RenderPipeline initialized');

        // Initialize viewport buffer for smooth scrolling
        if (USE_VIEWPORT_BUFFER) {
          tilesetCacheRef.current = new TilesetCanvasCache();
          viewportBufferRef.current = new ViewportBuffer(
            tilesetCacheRef.current,
            VIEWPORT_CONFIG.tilesWide,
            VIEWPORT_CONFIG.tilesHigh
          );
          console.log('[PERF] Viewport buffer enabled for smooth scrolling');
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

        // Set up object collision checker for item balls, NPCs, etc.
        // Uses elevation-aware checking: objects at different elevations don't block
        player.setObjectCollisionChecker((tileX, tileY) => {
          const objectManager = objectEventManagerRef.current;
          const playerElev = player.getCurrentElevation();

          // Block if there's an uncollected item ball at same elevation
          if (objectManager.getItemBallAtWithElevation(tileX, tileY, playerElev) !== null) {
            return true;
          }
          // Block if there's a visible NPC at same elevation
          if (objectManager.hasNPCAtWithElevation(tileX, tileY, playerElev)) {
            return true;
          }
          return false;
        });

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

        // Set up pipeline tile resolver and vertical object checker
        const applyPipelineResolvers = () => {
          const pipeline = renderPipelineRef.current;
          if (!pipeline) return;

          pipeline.setTileResolver((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return null;
            return resolveTileAt(ctx, tileX, tileY);
          });

          pipeline.setVerticalObjectChecker((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return false;
            return isVerticalObject(ctx, tileX, tileY);
          });
        };

        applyTileResolver();
        applyPipelineResolvers();
        setLoading(false);

        const startingPosition: Position = {
          x: player.x,
          y: player.y,
          tileX: player.tileX,
          tileY: player.tileY,
        };
        const gameState = new ObservableState(createInitialState(world, startingPosition));
        gameStateRef.current = gameState;
        const animationTimer = new AnimationTimer();
        animationTimerRef.current = animationTimer;

        let reanchorInFlight = false;
        // Reset WarpHandler and set initial position if anchor exists
        const warpHandler = warpHandlerRef.current;
        warpHandler.reset();
        if (anchor) {
          warpHandler.updateLastCheckedTile(startTileX, startTileY, anchor.entry.id);
        }
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
          arrowOverlayRef.current.hide();
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
          warpHandler.setInProgress(true);
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
          if (warpHandler.isInProgress() && !options?.force) return;
          warpHandler.setInProgress(true);
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
                fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
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
                fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
                // No door exit sequence needed
                doorExitRef.current = {
                  stage: 'idle',
                  doorWorldX: 0,
                  doorWorldY: 0,
                  metatileId: 0,
                };
                // CRITICAL: Unlock input here since there's no door exit sequence to handle it
                playerControllerRef.current?.unlockInput();
                warpHandler.setInProgress(false);
              }
            } else if (options?.fromDoor) {
              fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
              playerHiddenRef.current = false;
              doorExitRef.current = {
                stage: 'idle',
                doorWorldX: 0,
                doorWorldY: 0,
                metatileId: 0,
              };
              playerControllerRef.current?.unlockInput();
              warpHandler.setInProgress(false);
            }
            applyTileResolver();
            applyPipelineResolvers();
            // Invalidate pipeline caches after warp
            renderPipelineRef.current?.invalidate();
            warpHandler.updateLastCheckedTile(destWorldX, destWorldY, destMap.entry.id);
            warpHandler.setCooldown(350);
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
              warpHandler.setInProgress(false);
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
              fadeRef.current.startFadeOut(DOOR_TIMING.FADE_DURATION_MS, now);
              doorEntry.stage = 'fadingOut';
            }
          } else if (doorEntry.stage === 'fadingOut') {
            // Check if fade out is complete using FadeController
            const fadeDone = !fadeRef.current.isActive() || fadeRef.current.isComplete(now);
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
            if (doorEntry.stage !== 'idle' || warpHandler.isInProgress()) return;
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
          warpHandler.setInProgress(true);
          playerHiddenRef.current = false;
          player.lockInput();
        };

        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarpAttempt);

        const runUpdate = (deltaMs: number, timestamp: number) => {
          if (generation !== renderGenerationRef.current) {
            lastFrameResultRef.current = {
              view: null,
              viewChanged: false,
              animationFrameChanged: false,
              shouldRender: false,
              timestamp,
            };
            return { needsRender: false, viewChanged: false, animationFrameChanged: false, playerDirty: false };
          }

          const ctx = renderContextRef.current;
          if (!ctx) {
            lastFrameResultRef.current = {
              view: null,
              viewChanged: false,
              animationFrameChanged: false,
              shouldRender: false,
              timestamp,
            };
            return { needsRender: false, viewChanged: false, animationFrameChanged: false, playerDirty: false };
          }

          const safeDelta = Math.min(deltaMs, 50);
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
                warpHandler.setInProgress(false);
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
              warpHandler.setInProgress(false);
              playerControllerRef.current?.unlockInput();
              playerHiddenRef.current = false;
            }
          }
          warpHandler.update(safeDelta);
          const playerDirty = playerControllerRef.current?.update(safeDelta) ?? false;
          const player = playerControllerRef.current;
          if (player && ctx) {
            const resolvedForWarp = resolveTileAt(ctx, player.tileX, player.tileY);
            const lastChecked = warpHandler.getState().lastCheckedTile;
            const tileChanged =
              !lastChecked ||
              lastChecked.mapId !== resolvedForWarp?.map.entry.id ||
              lastChecked.x !== player.tileX ||
              lastChecked.y !== player.tileY;
            if (tileChanged && resolvedForWarp) {
              warpHandler.updateLastCheckedTile(player.tileX, player.tileY, resolvedForWarp.map.entry.id);
              if (!warpHandler.isInProgress() && !warpHandler.isOnCooldown()) {
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
            updateArrowOverlay(player, ctx, resolvedForWarp, timestamp, warpHandler.isInProgress());
          } else {
            updateArrowOverlay(null, null, null, timestamp, warpHandler.isInProgress());
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
              (async () => {
                const newWorldRaw = await mapManagerRef.current.buildWorld(targetId, CONNECTION_DEPTH);
                // Shift new world so the target map stays at the same world offset as before reanchor.
                const newWorld = shiftWorld(newWorldRaw, targetOffsetX, targetOffsetY);
                await rebuildContextForWorld(newWorld, targetId);
                // FIX: Don't reset player position - shiftWorld maintains coordinate continuity.
                // The old setPosition() call was causing a jump/teleport back effect because:
                // 1. Player continued moving during async world rebuild
                // 2. setPosition() would snap player back to stale captured coordinates
                // 3. setPosition() resets isMoving=false and pixelsMoved=0, canceling sub-tile movement
                applyTileResolver();
                applyPipelineResolvers();
                // Invalidate pipeline caches after re-anchor
                renderPipelineRef.current?.invalidate();
                // Update warpHandler with current player position
                const currentPlayer = playerControllerRef.current;
                if (currentPlayer) {
                  warpHandler.updateLastCheckedTile(currentPlayer.tileX, currentPlayer.tileY, targetId);
                }
                warpHandler.setCooldown(Math.max(warpHandler.getCooldownRemaining(), 50));
              })().finally(() => {
                reanchorInFlight = false;
              });
            }
          }

          const frameTick =
            animationTimerRef.current?.getTickCount() ?? Math.floor(timestamp / (1000 / 60));
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
            fadeRef.current.isActive() ||
            arrowOverlayRef.current.isVisible() || // Keep rendering while arrow animates
            debugOptionsRef.current.showCollisionOverlay || // Keep rendering while collision overlay is enabled
            debugOptionsRef.current.showElevationOverlay; // Keep rendering while elevation overlay is enabled
          const reflectionState = computeReflectionState(ctx, playerControllerRef.current);
          reflectionStateRef.current = reflectionState;

          lastFrameResultRef.current = {
            view,
            viewChanged,
            animationFrameChanged,
            shouldRender,
            timestamp,
          };

          return {
            needsRender: shouldRender,
            viewChanged,
            animationFrameChanged,
            playerDirty,
          };
        };

        const renderFrame = (frame: EngineFrameResult) => {
          if (!frame.shouldRender || !frame.view) return;
          const ctxForRender = renderContextRef.current;
          if (!ctxForRender) return;

          compositeScene(
            reflectionStateRef.current ?? { hasReflection: false, reflectionType: null, bridgeType: 'none' },
            frame.view,
            frame.viewChanged,
            frame.animationFrameChanged,
            currentTimestampRef.current
          );

          if (debugEnabledRef.current && playerControllerRef.current) {
            refreshDebugOverlay(ctxForRender, playerControllerRef.current, frame.view);
          }

          // Update debug panel state when enabled
          if (debugEnabledRef.current && playerControllerRef.current) {
            const player = playerControllerRef.current;
            const objectManager = objectEventManagerRef.current;

            // Get direction vector for facing tile
            const dirVectors: Record<string, { dx: number; dy: number }> = {
              up: { dx: 0, dy: -1 },
              down: { dx: 0, dy: 1 },
              left: { dx: -1, dy: 0 },
              right: { dx: 1, dy: 0 },
            };
            const vec = dirVectors[player.dir] ?? { dx: 0, dy: 0 };
            const facingX = player.tileX + vec.dx;
            const facingY = player.tileY + vec.dy;

            // Helper to get objects at a specific tile
            const getObjectsAtTile = (tileX: number, tileY: number) => {
              const npcs = objectManager.getVisibleNPCs().filter(
                (npc) => npc.tileX === tileX && npc.tileY === tileY
              );
              const items = objectManager.getVisibleItemBalls().filter(
                (item) => item.tileX === tileX && item.tileY === tileY
              );
              return {
                tileX,
                tileY,
                npcs,
                items,
                hasCollision: npcs.length > 0 || items.length > 0,
              };
            };

            // Get objects at player tile (usually empty due to collision)
            const objectsAtPlayer = getObjectsAtTile(player.tileX, player.tileY);

            // Get objects at facing tile
            const objectsAtFacing = getObjectsAtTile(facingX, facingY);

            // Get objects at all adjacent tiles
            const adjacentObjects = {
              north: getObjectsAtTile(player.tileX, player.tileY - 1),
              south: getObjectsAtTile(player.tileX, player.tileY + 1),
              east: getObjectsAtTile(player.tileX + 1, player.tileY),
              west: getObjectsAtTile(player.tileX - 1, player.tileY),
            };

            setDebugState({
              player: {
                tileX: player.tileX,
                tileY: player.tileY,
                pixelX: player.x,
                pixelY: player.y,
                direction: player.dir,
                elevation: player.getElevation(),
                isMoving: player.isMoving,
                isSurfing: player.isSurfing(),
                mapId: renderContextRef.current?.anchor.entry.id ?? 'unknown',
              },
              tile: null,
              objectsAtPlayerTile: objectsAtPlayer,
              objectsAtFacingTile: objectsAtFacing,
              adjacentObjects,
              allVisibleNPCs: objectManager.getVisibleNPCs(),
              allVisibleItems: objectManager.getVisibleItemBalls(),
              totalNPCCount: objectManager.getAllNPCs().length,
              totalItemCount: objectManager.getAllItemBalls().length,
            });
          }

          hasRenderedRef.current = true;
        };

        const coordinator = new UpdateCoordinator(gameState, {
          update: ({ deltaMs, timestamp }) => runUpdate(deltaMs, timestamp),
        });
        updateCoordinatorRef.current = coordinator;

        const handleFrame: FrameHandler = () => {
          const frame = lastFrameResultRef.current;
          if (!frame) return;
          renderFrame(frame);
        };

        const loop = new GameLoop(gameState, coordinator, animationTimer);
        gameLoopRef.current = loop;
        loop.start(handleFrame);
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
      gameLoopRef.current?.stop();
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

  const handleActionKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (e.code !== 'KeyX') return;

    const player = playerControllerRef.current;
    if (!player) return;

    // Avoid conflicts with dialog or concurrent prompts
    if (dialogIsOpen) return;

    // Surf prompt takes priority when available
    if (!surfPromptInProgressRef.current && !player.isMoving && !player.isSurfing()) {
      const surfCheck = player.canInitiateSurf();
      if (surfCheck.canSurf) {
        surfPromptInProgressRef.current = true;
        player.lockInput();

        try {
          const wantsToSurf = await showYesNo(
            "The water is dyed a deep blue…\nWould you like to SURF?"
          );

          if (wantsToSurf) {
            await showMessage("You used SURF!");
            player.startSurfing();
          }
        } finally {
          surfPromptInProgressRef.current = false;
          player.unlockInput();
        }
        return; // Don't process other actions on the same key press
      }
    }

    // Item pickup flow
    if (surfPromptInProgressRef.current || itemPickupInProgressRef.current || player.isMoving || player.isSurfing()) return;

    // Calculate the tile the player is facing
    let facingTileX = player.tileX;
    let facingTileY = player.tileY;
    if (player.dir === 'up') facingTileY -= 1;
    else if (player.dir === 'down') facingTileY += 1;
    else if (player.dir === 'left') facingTileX -= 1;
    else if (player.dir === 'right') facingTileX += 1;

    const objectEventManager = objectEventManagerRef.current;
    const interactable = objectEventManager.getInteractableAt(facingTileX, facingTileY);
    if (!interactable || interactable.type !== 'item') return;

    const itemBall = interactable.data;
    itemPickupInProgressRef.current = true;
    player.lockInput();

    try {
      objectEventManager.collectItem(itemBall.id);
      const itemName = itemBall.itemName;
      await showMessage(`BRENDAN found one ${itemName}!`);
    } finally {
      itemPickupInProgressRef.current = false;
      player.unlockInput();
    }
  }, [dialogIsOpen, showMessage, showYesNo]);

  useInput({ onKeyDown: handleActionKeyDown });

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
      {/* Game viewport container */}
      <div style={{
        position: 'relative',
        width: VIEWPORT_PIXEL_SIZE.width * zoom,
        height: VIEWPORT_PIXEL_SIZE.height * zoom
      }}>
        <canvas
          ref={canvasRef}
          width={VIEWPORT_PIXEL_SIZE.width}
          height={VIEWPORT_PIXEL_SIZE.height}
          style={{
            border: '1px solid #ccc',
            imageRendering: 'pixelated',
            width: VIEWPORT_PIXEL_SIZE.width * zoom,
            height: VIEWPORT_PIXEL_SIZE.height * zoom
          }}
        />
        {/* Dialog overlay */}
        <DialogBox
          viewportWidth={VIEWPORT_PIXEL_SIZE.width * zoom}
          viewportHeight={VIEWPORT_PIXEL_SIZE.height * zoom}
        />
      </div>

      {/* Debug Panel Sidebar */}
      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        state={debugState}
        debugCanvasRef={debugCanvasRef}
        debugGridSize={DEBUG_GRID_SIZE}
        centerTileInfo={centerTileDebugInfo}
        bottomLayerCanvasRef={bottomLayerCanvasRef}
        topLayerCanvasRef={topLayerCanvasRef}
        compositeLayerCanvasRef={compositeLayerCanvasRef}
        onCopyTileDebug={handleCopyTileDebug}
      />
    </div>
  );
});

MapRenderer.displayName = 'MapRenderer';
