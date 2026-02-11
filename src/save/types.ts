/**
 * Save System Types
 *
 * Based on Pokemon Emerald's save structure from:
 * - public/pokeemerald/include/global.h (SaveBlock1, SaveBlock2)
 * - public/pokeemerald/include/save.h
 *
 * SaveBlock2: Player identity, options, pokedex, frontier
 * SaveBlock1: Position, party, items, flags, vars, game state
 *
 * Architecture:
 * - SaveData: The complete save file structure
 * - Individual state interfaces for each subsystem
 * - Version field for migration support
 */

import type { PartyPokemon } from '../pokemon/types';

/**
 * Current save format version. Increment when making breaking changes.
 */
export const SAVE_VERSION = 1;

/**
 * Storage key prefix for localStorage
 */
export const SAVE_STORAGE_KEY = 'pokemon-rse-browser-save';

// ============================================================================
// SaveBlock2 equivalent - Player identity and options
// ============================================================================

/**
 * Player profile/identity data
 * Reference: SaveBlock2 in global.h
 */
export interface PlayerProfile {
  /** Player's chosen name (max 7 chars + null) */
  name: string;
  /** Player gender: 0 = male, 1 = female */
  gender: 0 | 1;
  /** Public trainer ID (visible in summary) */
  trainerId: number;
  /** Secret ID (used for shiny calculation) */
  secretId: number;
}

/**
 * Play time tracking
 * Reference: SaveBlock2 playTime fields
 */
export interface PlayTime {
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Game options
 * Reference: SaveBlock2 options fields
 */
export interface GameOptions {
  textSpeed: 'slow' | 'mid' | 'fast';
  battleScene: boolean;
  battleStyle: 'shift' | 'set';
  sound: 'mono' | 'stereo';
  buttonMode: 'normal' | 'lr' | 'l_equals_a';
  windowFrame: number; // 0-19
}

/**
 * Pokedex state
 * Reference: SaveBlock2.pokedex, SaveBlock1.seen1/seen2
 */
export interface PokedexState {
  /** Species IDs that have been seen */
  seen: number[];
  /** Species IDs that have been caught */
  caught: number[];
  /** National dex unlocked */
  nationalDex: boolean;
}

// ============================================================================
// SaveBlock1 equivalent - Game state
// ============================================================================

/**
 * Warp/location data
 * Reference: struct WarpData in global.h
 */
export interface WarpData {
  mapId: string;
  warpId: number;
  x: number;
  y: number;
}

/**
 * Player position and location state
 * Reference: SaveBlock1 pos, location, continueGameWarp, etc.
 */
export interface LocationState {
  /** Current position (tile coordinates) */
  pos: { x: number; y: number };
  /** Current map and warp */
  location: WarpData;
  /** Where to continue from after loading save */
  continueGameWarp: WarpData;
  /** Last Pokemon Center / heal location */
  lastHealLocation: WarpData;
  /** Escape Rope / Dig destination */
  escapeWarp: WarpData;
  /** Player facing direction */
  direction: 'up' | 'down' | 'left' | 'right';
  /** Current elevation */
  elevation: number;
  /** Whether currently surfing */
  isSurfing: boolean;
}

/**
 * Item slot in bag or PC
 * Reference: struct ItemSlot in global.h
 */
export interface ItemSlot {
  itemId: number;
  quantity: number;
}

/**
 * Player's item bag
 * Reference: SaveBlock1 bagPocket_* fields
 */
export interface BagState {
  items: ItemSlot[];
  keyItems: ItemSlot[];
  pokeBalls: ItemSlot[];
  tmHm: ItemSlot[];
  berries: ItemSlot[];
}

/**
 * PC item storage
 * Reference: SaveBlock1.pcItems
 */
export interface PCItemsState {
  items: ItemSlot[];
}

/**
 * Money and coins
 * Reference: SaveBlock1.money, SaveBlock1.coins
 */
export interface MoneyState {
  money: number;
  coins: number;
}

/**
 * Game flags - events, items collected, story progress
 * Reference: SaveBlock1.flags (NUM_FLAG_BYTES = 0x12C = 300 bytes = 2400 flags)
 * Stored as array of flag names that are SET
 */
export type GameFlags = string[];

/**
 * Game variables (numbered vars used by scripts)
 * Reference: SaveBlock1.vars
 */
export type GameVars = Record<string, number>;

/**
 * Game statistics
 * Reference: SaveBlock1.gameStats
 */
export interface GameStats {
  pokemonCaught: number;
  trainersDefeated: number;
  stepCount: number;
  pokemonBattles: number;
  wildBattles: number;
  // Can expand with more stats as needed
}

// ============================================================================
// Pokemon data (future expansion)
// ============================================================================

/**
 * Pokemon data structure (simplified for now)
 * Reference: struct Pokemon in pokemon.h
 */
export interface Pokemon {
  species: number;
  nickname: string | null;
  otName: string;
  otId: number;
  level: number;
  experience: number;
  // Future: IVs, EVs, moves, ability, nature, held item, etc.
}

/**
 * Player's party
 * Reference: SaveBlock1.playerParty
 */
export interface PartyState {
  pokemon: (Pokemon | null)[];
  count: number;
}

/**
 * PC Pokemon storage (future)
 * Reference: PokemonStorage in global.h
 */
export interface PCPokemonState {
  currentBox: number;
  boxes: {
    name: string;
    pokemon: (Pokemon | null)[];
  }[];
}

// ============================================================================
// Main Save Data Structure
// ============================================================================

/**
 * The complete save data structure
 *
 * Design principles:
 * - Mirrors Pokemon Emerald's SaveBlock1 and SaveBlock2
 * - All fields optional except version for forward compatibility
 * - New features can add fields without breaking old saves
 */
export interface SaveData {
  /** Save format version for migration support */
  version: number;

  /** When this save was created/last modified (Unix timestamp) */
  timestamp: number;

  // === SaveBlock2 equivalent ===
  /** Player identity */
  profile: PlayerProfile;
  /** Total play time */
  playTime: PlayTime;
  /** Game options */
  options?: GameOptions;
  /** Pokedex progress */
  pokedex?: PokedexState;

  // === SaveBlock1 equivalent ===
  /** Player position and location */
  location: LocationState;
  /** Money and coins */
  money?: MoneyState;
  /** Item bag */
  bag?: BagState;
  /** PC item storage */
  pcItems?: PCItemsState;
  /** Pokemon party */
  party?: PartyState;
  /** Runtime battle-ready party payload */
  partyFull?: (PartyPokemon | null)[];
  /** PC Pokemon storage */
  pcPokemon?: PCPokemonState;
  /** Event flags */
  flags: GameFlags;
  /** Raw 300-byte event flag bitset (lossless import/export) */
  rawFlags?: number[];
  /** Script variables */
  vars?: GameVars;
  /** Raw 256-entry script var array (u16, lossless import/export) */
  rawVars?: number[];
  /** Game statistics */
  stats?: GameStats;
  /** Permanent NPC position overrides from copyobjectxytoperm */
  objectEventOverrides?: Record<string, { x: number; y: number }>;
}

// ============================================================================
// Save Management Types
// ============================================================================

/**
 * Save slot metadata (for save slot selection UI)
 */
export interface SaveSlotInfo {
  /** Slot index (0-2 for 3 save slots) */
  slot: number;
  /** Whether this slot has data */
  exists: boolean;
  /** Preview info if save exists */
  preview?: {
    playerName: string;
    mapId: string;
    playTime: PlayTime;
    timestamp: number;
    badges?: number;
    pokedexCaught?: number;
  };
}

/**
 * Result of a save/load operation
 */
export interface SaveResult {
  success: boolean;
  error?: string;
}

/**
 * Default values for new game
 */
export const DEFAULT_PROFILE: PlayerProfile = {
  name: 'BRENDAN',
  gender: 0,
  trainerId: 0,
  secretId: 0,
};

export const DEFAULT_PLAY_TIME: PlayTime = {
  hours: 0,
  minutes: 0,
  seconds: 0,
};

export const DEFAULT_OPTIONS: GameOptions = {
  textSpeed: 'mid',
  battleScene: true,
  battleStyle: 'shift',
  sound: 'stereo',
  buttonMode: 'normal',
  windowFrame: 0,
};
