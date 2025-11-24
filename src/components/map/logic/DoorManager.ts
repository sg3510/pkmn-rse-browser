import { type DoorSize } from '../types';

const PROJECT_ROOT = '/pokeemerald';
const DEBUG_MODE_FLAG = 'PKMN_DEBUG_MODE';

function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

export function logDoor(...args: unknown[]) {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[door]', ...args);
  }
}

export const DOOR_FRAME_HEIGHT = 32;
export const DOOR_FRAME_DURATION_MS = 90;
export const DOOR_FADE_DURATION = 500;

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
export const DOOR_ASSET_MAP: Array<{ metatileIds: number[]; path: string; size: DoorSize }> = [
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
  
  // Fallback
  { metatileIds: [], path: `${PROJECT_ROOT}/graphics/door_anims/general.png`, size: 1 },
];

export function getDoorAssetForMetatile(metatileId: number): { path: string; size: DoorSize } {
  for (const asset of DOOR_ASSET_MAP) {
    if (asset.metatileIds.length > 0 && asset.metatileIds.includes(metatileId)) {
      return asset;
    }
  }
  return DOOR_ASSET_MAP[DOOR_ASSET_MAP.length - 1];
}
