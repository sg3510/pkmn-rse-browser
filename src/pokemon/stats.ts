/**
 * Pokemon Stat Calculations
 *
 * Implements Gen 3 stat formulas for calculating battle stats
 * from base stats, IVs, EVs, level, and nature.
 */

import { getSpeciesInfo } from '../data/speciesInfo';
import { getNatureStatModifier, getNatureFromPersonality } from '../data/natures';
import type { PartyPokemon, BoxPokemon, Stats, IVs, EVs } from './types';

/**
 * Calculate HP stat
 * HP uses a different formula than other stats
 */
export function calculateHP(
  baseHP: number,
  iv: number,
  ev: number,
  level: number
): number {
  // Shedinja special case - always 1 HP
  if (baseHP === 1) return 1;

  return Math.floor(
    ((2 * baseHP + iv + Math.floor(ev / 4)) * level) / 100
  ) + level + 10;
}

/**
 * Calculate a non-HP stat (Attack, Defense, Speed, Sp.Atk, Sp.Def)
 */
export function calculateStat(
  baseStat: number,
  iv: number,
  ev: number,
  level: number,
  natureModifier: number
): number {
  const base = Math.floor(
    ((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100
  ) + 5;
  return Math.floor(base * natureModifier);
}

/**
 * Calculate all stats for a Pokemon
 */
export function calculateAllStats(
  speciesId: number,
  level: number,
  ivs: IVs,
  evs: EVs,
  personality: number
): Stats {
  const info = getSpeciesInfo(speciesId);
  if (!info) {
    return { hp: 1, attack: 1, defense: 1, speed: 1, spAttack: 1, spDefense: 1 };
  }

  const nature = getNatureFromPersonality(personality);

  return {
    hp: calculateHP(info.baseHP, ivs.hp, evs.hp, level),
    attack: calculateStat(
      info.baseAttack,
      ivs.attack,
      evs.attack,
      level,
      getNatureStatModifier(nature, 0)
    ),
    defense: calculateStat(
      info.baseDefense,
      ivs.defense,
      evs.defense,
      level,
      getNatureStatModifier(nature, 1)
    ),
    speed: calculateStat(
      info.baseSpeed,
      ivs.speed,
      evs.speed,
      level,
      getNatureStatModifier(nature, 2)
    ),
    spAttack: calculateStat(
      info.baseSpAttack,
      ivs.spAttack,
      evs.spAttack,
      level,
      getNatureStatModifier(nature, 3)
    ),
    spDefense: calculateStat(
      info.baseSpDefense,
      ivs.spDefense,
      evs.spDefense,
      level,
      getNatureStatModifier(nature, 4)
    ),
  };
}

/**
 * Experience tables for different growth rates
 * Returns total EXP needed to reach a level
 */
const EXP_TABLES: Record<string, (level: number) => number> = {
  ERRATIC: (n) => {
    if (n <= 50) return Math.floor((n ** 3 * (100 - n)) / 50);
    if (n <= 68) return Math.floor((n ** 3 * (150 - n)) / 100);
    if (n <= 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
    return Math.floor((n ** 3 * (160 - n)) / 100);
  },
  FAST: (n) => Math.floor((4 * n ** 3) / 5),
  MEDIUM_FAST: (n) => n ** 3,
  MEDIUM_SLOW: (n) => Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140),
  SLOW: (n) => Math.floor((5 * n ** 3) / 4),
  FLUCTUATING: (n) => {
    if (n <= 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
    if (n <= 36) return Math.floor((n ** 3 * (n + 14)) / 50);
    return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  },
};

/**
 * Get total experience needed to reach a level
 */
export function getExpForLevel(growthRate: string, level: number): number {
  const table = EXP_TABLES[growthRate] || EXP_TABLES.MEDIUM_FAST;
  return table(level);
}

/**
 * Calculate level from total experience
 */
export function calculateLevelFromExp(growthRate: string, exp: number): number {
  for (let level = 100; level >= 1; level--) {
    if (exp >= getExpForLevel(growthRate, level)) {
      return level;
    }
  }
  return 1;
}

/**
 * Get experience to next level
 */
export function getExpToNextLevel(
  growthRate: string,
  currentLevel: number,
  currentExp: number
): number {
  if (currentLevel >= 100) return 0;
  const nextLevelExp = getExpForLevel(growthRate, currentLevel + 1);
  return Math.max(0, nextLevelExp - currentExp);
}

/**
 * Get experience progress percentage to next level
 */
export function getExpProgress(
  growthRate: string,
  currentLevel: number,
  currentExp: number
): number {
  if (currentLevel >= 100) return 100;

  const currentLevelExp = getExpForLevel(growthRate, currentLevel);
  const nextLevelExp = getExpForLevel(growthRate, currentLevel + 1);
  const levelRange = nextLevelExp - currentLevelExp;

  if (levelRange <= 0) return 100;

  const progress = currentExp - currentLevelExp;
  return Math.min(100, Math.max(0, (progress / levelRange) * 100));
}

/**
 * Get gender from personality and species gender ratio
 * @param personality 32-bit personality value
 * @param genderRatio 0=male, 254=female, 255=genderless, else threshold
 */
export function getGenderFromPersonality(
  personality: number,
  genderRatio: number
): 'male' | 'female' | 'genderless' {
  if (genderRatio === 255) return 'genderless';
  if (genderRatio === 254) return 'female';
  if (genderRatio === 0) return 'male';

  // Compare low byte of personality to gender threshold
  const p = personality & 0xFF;
  return p >= genderRatio ? 'male' : 'female';
}

/**
 * Check if a Pokemon is shiny
 * Shiny if (otId XOR personality) has low 16 bits < 8
 */
export function isShiny(personality: number, otId: number): boolean {
  const p1 = (personality >> 16) & 0xFFFF;
  const p2 = personality & 0xFFFF;
  const t1 = (otId >> 16) & 0xFFFF;
  const t2 = otId & 0xFFFF;
  return (p1 ^ p2 ^ t1 ^ t2) < 8;
}

/**
 * Get ability from species and ability number
 */
export function getAbility(speciesId: number, abilityNum: 0 | 1): number {
  const info = getSpeciesInfo(speciesId);
  if (!info) return 0;

  const ability = info.abilities[abilityNum];
  // If second ability is NONE (0), fall back to first
  if (ability === 0 && abilityNum === 1) {
    return info.abilities[0];
  }
  return ability;
}

/**
 * Recalculate stats for a party Pokemon
 * Call this after level up, EV change, or evolution
 */
export function recalculatePartyStats(pokemon: PartyPokemon): PartyPokemon {
  const info = getSpeciesInfo(pokemon.species);
  if (!info) return pokemon;

  const level = calculateLevelFromExp(info.growthRate, pokemon.experience);
  const stats = calculateAllStats(
    pokemon.species,
    level,
    pokemon.ivs,
    pokemon.evs,
    pokemon.personality
  );

  // Preserve current HP ratio when max HP changes
  const hpRatio = pokemon.stats.maxHp > 0
    ? pokemon.stats.hp / pokemon.stats.maxHp
    : 1;

  return {
    ...pokemon,
    level,
    stats: {
      hp: Math.max(0, Math.min(stats.hp, Math.round(stats.hp * hpRatio))),
      maxHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      spAttack: stats.spAttack,
      spDefense: stats.spDefense,
    },
  };
}

/**
 * Convert BoxPokemon to PartyPokemon (calculate stats)
 */
export function boxToParty(box: BoxPokemon): PartyPokemon {
  const info = getSpeciesInfo(box.species);
  const growthRate = info?.growthRate || 'MEDIUM_FAST';
  const level = calculateLevelFromExp(growthRate, box.experience);
  const stats = calculateAllStats(
    box.species,
    level,
    box.ivs,
    box.evs,
    box.personality
  );

  return {
    ...box,
    level,
    status: 0,
    stats: {
      hp: stats.hp,  // Full HP when withdrawn
      maxHp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      spAttack: stats.spAttack,
      spDefense: stats.spDefense,
    },
    mail: null,
  };
}

/**
 * Convert PartyPokemon to BoxPokemon (strip calculated stats)
 */
export function partyToBox(party: PartyPokemon): BoxPokemon {
  const { level, status, stats, mail, ...box } = party;
  return box;
}
