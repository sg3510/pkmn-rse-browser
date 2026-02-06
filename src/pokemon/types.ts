/**
 * Pokemon Type Definitions
 *
 * Based on Gen 3 (Pokemon Emerald) data structures.
 * See docs/systems/save/pokemon-party-storage-system.md for details.
 */

// Constants
export const PARTY_SIZE = 6;
export const TOTAL_BOXES = 14;
export const IN_BOX_COUNT = 30;
export const IN_BOX_ROWS = 5;
export const IN_BOX_COLUMNS = 6;
export const MAX_MOVES = 4;
export const POKEMON_NAME_LENGTH = 10;

/**
 * Stats structure (6 stats)
 */
export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;
}

/**
 * IVs (Individual Values) - 0-31 each
 */
export interface IVs extends Stats {}

/**
 * EVs (Effort Values) - 0-255 each, 510 total max
 */
export interface EVs extends Stats {}

/**
 * Contest stats
 */
export interface ContestStats {
  cool: number;
  beauty: number;
  cute: number;
  smart: number;
  tough: number;
  sheen: number;
}

/**
 * Pokemon markings (PC organization)
 */
export interface Markings {
  circle: boolean;
  square: boolean;
  triangle: boolean;
  heart: boolean;
}

/**
 * Pokerus status
 */
export interface Pokerus {
  strain: number;  // 0 = never had, 1-15 = strain
  days: number;    // Days remaining (0 = cured/immune)
}

/**
 * Pokemon ribbons
 */
export interface Ribbons {
  // Contest ribbons (0-4 rank each)
  coolRank: number;
  beautyRank: number;
  cuteRank: number;
  smartRank: number;
  toughRank: number;
  // Achievement ribbons
  champion: boolean;
  winning: boolean;
  victory: boolean;
  artist: boolean;
  effort: boolean;
  marine: boolean;
  land: boolean;
  sky: boolean;
  country: boolean;
  national: boolean;
  earth: boolean;
  world: boolean;
}

/**
 * Status conditions (bit flags)
 */
export const STATUS = {
  NONE: 0,
  SLEEP: 0x07,      // 3 bits for sleep turns
  POISON: 0x08,
  BURN: 0x10,
  FREEZE: 0x20,
  PARALYSIS: 0x40,
  TOXIC: 0x80,      // Bad poison
} as const;

/**
 * Base Pokemon data (BoxPokemon equivalent - 80 bytes in GBA)
 * This is the minimum data needed for PC storage
 */
export interface BoxPokemon {
  // Identity (from encrypted data)
  personality: number;        // 32-bit value (nature, gender, ability, shiny)
  otId: number;               // Original trainer ID (public + secret)
  species: number;            // 1-411 (National Dex number)

  // Display
  nickname: string | null;    // Custom name (max 10 chars, null = use species name)
  otName: string;             // Original trainer name
  language: number;           // Language of origin

  // Core data
  heldItem: number;           // Item ID (0 = none)
  experience: number;         // Total EXP
  friendship: number;         // 0-255

  // Moves
  moves: [number, number, number, number];  // Move IDs (0 = empty)
  pp: [number, number, number, number];     // Current PP
  ppBonuses: number;          // PP Up bonuses (2 bits per move)

  // Stats
  ivs: IVs;
  evs: EVs;

  // Status flags
  isEgg: boolean;
  isBadEgg: boolean;
  abilityNum: 0 | 1;          // Which ability slot (for dual-ability Pokemon)

  // Origin info
  metLocation: number;        // Map ID where caught
  metLevel: number;           // Level when caught (0-100)
  metGame: number;            // Game of origin
  pokeball: number;           // Ball used to catch
  otGender: 'male' | 'female';

  // Pokerus
  pokerus: Pokerus;

  // Contest
  contest: ContestStats;

  // Organization
  markings: Markings;
  ribbons: Ribbons;

  // Fateful encounter (Mew/Deoxys obedience)
  fatefulEncounter: boolean;
}

/**
 * Party Pokemon (100 bytes in GBA)
 * Extends BoxPokemon with calculated stats for battle
 */
export interface PartyPokemon extends BoxPokemon {
  // Calculated/cached values
  level: number;              // Calculated from experience
  status: number;             // Current status condition

  // Battle stats (calculated from base + IVs + EVs + nature)
  stats: {
    hp: number;               // Current HP
    maxHp: number;            // Maximum HP
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };

  // Mail attachment (party only)
  mail: number | null;        // Mail ID or null
}

/**
 * PC Storage box
 */
export interface StorageBox {
  name: string;               // Box name (max 8 chars)
  wallpaper: number;          // Wallpaper ID
  pokemon: (BoxPokemon | null)[];  // 30 slots
}

/**
 * Full PC storage
 */
export interface PCStorage {
  currentBox: number;         // Selected box (0-13)
  boxes: StorageBox[];        // 14 boxes
}

/**
 * Party state
 */
export interface PartyState {
  pokemon: (PartyPokemon | null)[];  // 6 slots
  count: number;              // Number of non-null Pokemon
}

/**
 * Create empty party
 */
export function createEmptyParty(): PartyState {
  return {
    pokemon: [null, null, null, null, null, null],
    count: 0,
  };
}

/**
 * Create empty PC storage
 */
export function createEmptyStorage(): PCStorage {
  const boxes: StorageBox[] = [];
  for (let i = 0; i < TOTAL_BOXES; i++) {
    boxes.push({
      name: `BOX ${i + 1}`,
      wallpaper: i % 4,
      pokemon: Array(IN_BOX_COUNT).fill(null),
    });
  }
  return {
    currentBox: 0,
    boxes,
  };
}

/**
 * Create empty ribbons
 */
export function createEmptyRibbons(): Ribbons {
  return {
    coolRank: 0,
    beautyRank: 0,
    cuteRank: 0,
    smartRank: 0,
    toughRank: 0,
    champion: false,
    winning: false,
    victory: false,
    artist: false,
    effort: false,
    marine: false,
    land: false,
    sky: false,
    country: false,
    national: false,
    earth: false,
    world: false,
  };
}

/**
 * Create empty contest stats
 */
export function createEmptyContestStats(): ContestStats {
  return {
    cool: 0,
    beauty: 0,
    cute: 0,
    smart: 0,
    tough: 0,
    sheen: 0,
  };
}

/**
 * Create empty markings
 */
export function createEmptyMarkings(): Markings {
  return {
    circle: false,
    square: false,
    triangle: false,
    heart: false,
  };
}
