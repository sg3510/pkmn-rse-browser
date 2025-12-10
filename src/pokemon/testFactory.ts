/**
 * Test Pokemon Factory
 *
 * Creates test Pokemon for development and debugging.
 * NOT for production use - these are pre-built Pokemon for UI testing.
 */

import { SPECIES } from '../data/species';
import { getSpeciesInfo } from '../data/speciesInfo';
import { MOVES } from '../data/moves';
import { calculateAllStats, getExpForLevel } from './stats';
import type { PartyPokemon, IVs, EVs } from './types';
import {
  createEmptyRibbons,
  createEmptyContestStats,
  createEmptyMarkings,
} from './types';

// ============================================================================
// Random Utilities
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPersonality(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF);
}

function randomIVs(): IVs {
  return {
    hp: randomInt(0, 31),
    attack: randomInt(0, 31),
    defense: randomInt(0, 31),
    speed: randomInt(0, 31),
    spAttack: randomInt(0, 31),
    spDefense: randomInt(0, 31),
  };
}

function perfectIVs(): IVs {
  return { hp: 31, attack: 31, defense: 31, speed: 31, spAttack: 31, spDefense: 31 };
}

function zeroEVs(): EVs {
  return { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 };
}

// ============================================================================
// Factory Functions
// ============================================================================

export interface CreatePokemonOptions {
  species: number;
  level?: number;
  nickname?: string | null;
  heldItem?: number;
  moves?: [number, number, number, number];
  ivs?: IVs;
  evs?: EVs;
  personality?: number;
  otId?: number;
  otName?: string;
  currentHpPercent?: number;  // 0-100, for testing damaged Pokemon
  status?: number;
  abilityNum?: 0 | 1;
  isShiny?: boolean;
}

/**
 * Create a PartyPokemon with specified options
 */
export function createTestPokemon(options: CreatePokemonOptions): PartyPokemon {
  const {
    species,
    level = 50,
    nickname = null,
    heldItem = 0,
    moves = [0, 0, 0, 0],
    ivs = randomIVs(),
    evs = zeroEVs(),
    personality = randomPersonality(),
    otId = 12345,
    otName = 'TEST',
    currentHpPercent = 100,
    status = 0,
    abilityNum = 0,
  } = options;

  const info = getSpeciesInfo(species);
  const growthRate = info?.growthRate || 'MEDIUM_FAST';
  const experience = getExpForLevel(growthRate, level);

  const calculatedStats = calculateAllStats(species, level, ivs, evs, personality);

  const currentHp = Math.max(0, Math.floor(calculatedStats.hp * (currentHpPercent / 100)));

  return {
    // Identity
    personality,
    otId,
    species,

    // Display
    nickname,
    otName,
    language: 2, // English

    // Core data
    heldItem,
    experience,
    friendship: 70,

    // Moves
    moves,
    pp: [35, 35, 35, 35], // Default PP (should look up from move data)
    ppBonuses: 0,

    // Stats
    ivs,
    evs,

    // Flags
    isEgg: false,
    isBadEgg: false,
    abilityNum,

    // Origin
    metLocation: 0,
    metLevel: level,
    metGame: 3, // Emerald
    pokeball: 4, // Poke Ball
    otGender: 'male',

    // Pokerus
    pokerus: { strain: 0, days: 0 },

    // Contest
    contest: createEmptyContestStats(),

    // Organization
    markings: createEmptyMarkings(),
    ribbons: createEmptyRibbons(),

    // Flags
    fatefulEncounter: false,

    // Party-specific
    level,
    status,
    stats: {
      hp: currentHp,
      maxHp: calculatedStats.hp,
      attack: calculatedStats.attack,
      defense: calculatedStats.defense,
      speed: calculatedStats.speed,
      spAttack: calculatedStats.spAttack,
      spDefense: calculatedStats.spDefense,
    },
    mail: null,
  };
}

// ============================================================================
// Pre-built Test Pokemon
// ============================================================================

/**
 * Create a starter team for testing the party menu
 */
export function createTestParty(): PartyPokemon[] {
  return [
    // Blaziken - Fire/Fighting, damaged
    createTestPokemon({
      species: SPECIES.BLAZIKEN,
      level: 45,
      nickname: 'BLAZE',
      moves: [MOVES.BLAZE_KICK, MOVES.SKY_UPPERCUT, MOVES.FLAMETHROWER, MOVES.SLASH],
      ivs: perfectIVs(),
      currentHpPercent: 65,
    }),

    // Gardevoir - Psychic, full health
    createTestPokemon({
      species: SPECIES.GARDEVOIR,
      level: 42,
      nickname: null, // Use species name
      moves: [MOVES.PSYCHIC, MOVES.CALM_MIND, MOVES.THUNDERBOLT, MOVES.SHADOW_BALL],
      currentHpPercent: 100,
    }),

    // Swampert - Water/Ground, low HP
    createTestPokemon({
      species: SPECIES.SWAMPERT,
      level: 44,
      nickname: 'MUDDY',
      moves: [MOVES.SURF, MOVES.EARTHQUAKE, MOVES.ICE_BEAM, MOVES.BRICK_BREAK],
      currentHpPercent: 15,
      status: 0x08, // Poisoned
    }),

    // Flygon - Ground/Dragon
    createTestPokemon({
      species: SPECIES.FLYGON,
      level: 43,
      moves: [MOVES.EARTHQUAKE, MOVES.DRAGON_CLAW, MOVES.FLAMETHROWER, MOVES.FLY],
    }),

    // Manectric - Electric
    createTestPokemon({
      species: SPECIES.MANECTRIC,
      level: 41,
      nickname: 'SPARKY',
      moves: [MOVES.THUNDERBOLT, MOVES.THUNDER_WAVE, MOVES.CRUNCH, MOVES.QUICK_ATTACK],
      heldItem: 221, // Magnet
    }),

    // Absol - Dark, fainted
    createTestPokemon({
      species: SPECIES.ABSOL,
      level: 40,
      moves: [MOVES.SLASH, MOVES.SWORDS_DANCE, MOVES.SHADOW_BALL, MOVES.AERIAL_ACE],
      currentHpPercent: 0, // Fainted
    }),
  ];
}

/**
 * Create a single test Pokemon by species name (convenience)
 */
export function createQuickPokemon(
  speciesName: keyof typeof SPECIES,
  level = 50
): PartyPokemon {
  return createTestPokemon({
    species: SPECIES[speciesName],
    level,
  });
}

/**
 * Create the Gen 3 starters at level 5
 */
export function createStarterTrio(): PartyPokemon[] {
  return [
    createTestPokemon({
      species: SPECIES.TREECKO,
      level: 5,
      moves: [MOVES.POUND, MOVES.LEER, 0, 0],
    }),
    createTestPokemon({
      species: SPECIES.TORCHIC,
      level: 5,
      moves: [MOVES.SCRATCH, MOVES.GROWL, 0, 0],
    }),
    createTestPokemon({
      species: SPECIES.MUDKIP,
      level: 5,
      moves: [MOVES.TACKLE, MOVES.GROWL, 0, 0],
    }),
  ];
}

/**
 * Create a legendary team for testing
 */
export function createLegendaryParty(): PartyPokemon[] {
  return [
    createTestPokemon({
      species: SPECIES.RAYQUAZA,
      level: 70,
      moves: [MOVES.OUTRAGE, MOVES.EXTREME_SPEED, MOVES.FLY, MOVES.HYPER_BEAM],
      ivs: perfectIVs(),
    }),
    createTestPokemon({
      species: SPECIES.GROUDON,
      level: 70,
      moves: [MOVES.EARTHQUAKE, MOVES.FIRE_BLAST, MOVES.SOLAR_BEAM, MOVES.REST],
      ivs: perfectIVs(),
    }),
    createTestPokemon({
      species: SPECIES.KYOGRE,
      level: 70,
      moves: [MOVES.SURF, MOVES.ICE_BEAM, MOVES.THUNDER, MOVES.CALM_MIND],
      ivs: perfectIVs(),
    }),
    createTestPokemon({
      species: SPECIES.LATIOS,
      level: 50,
      moves: [MOVES.LUSTER_PURGE, MOVES.PSYCHIC, MOVES.DRAGON_CLAW, MOVES.RECOVER],
    }),
    createTestPokemon({
      species: SPECIES.LATIAS,
      level: 50,
      moves: [MOVES.MIST_BALL, MOVES.PSYCHIC, MOVES.DRAGON_CLAW, MOVES.RECOVER],
    }),
    createTestPokemon({
      species: SPECIES.JIRACHI,
      level: 50,
      moves: [MOVES.DOOM_DESIRE, MOVES.PSYCHIC, MOVES.THUNDER, MOVES.WISH],
    }),
  ];
}
