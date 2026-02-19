/**
 * Wild encounter generation for overworld roaming.
 *
 * C references:
 * - public/pokeemerald/src/wild_encounter.c (WildEncounterCheck, AllowWildCheckOnNewMetatile, TryGenerateWildMon)
 */

import { ABILITIES } from '../../data/abilities.ts';
import { ITEMS } from '../../data/items.ts';
import { getSpeciesInfo } from '../../data/speciesInfo.ts';
import { getMapWildEncounterData, WILD_ENCOUNTER_SLOT_RATES } from '../../data/wildEncounters.gen.ts';
import type { PartyPokemon } from '../../pokemon/types.ts';
import { getAbility } from '../../pokemon/stats.ts';
import {
  isBridgeOverWaterBehavior,
  isLandWildEncounterBehavior,
  isWaterWildEncounterBehavior,
} from '../../utils/metatileBehaviors.ts';

const MAX_ENCOUNTER_RATE = 2880;

export type StepEncounterArea = 'land' | 'water';

export interface WildEncounterRollRequest {
  mapId: string;
  currentTileBehavior?: number;
  previousTileBehavior?: number;
  playerIsSurfing?: boolean;
  leadPokemon: PartyPokemon | null;
  isBikeRiding: boolean;
  weatherName?: string | null;
  repelStepsRemaining?: number;
  whiteFluteActive: boolean;
  blackFluteActive: boolean;
  randomInt?: (maxExclusive: number) => number;
}

export interface WildEncounterRollResult {
  species: number;
  level: number;
  slotIndex: number;
  area: StepEncounterArea;
}

export interface LandEncounterRollRequest extends WildEncounterRollRequest {}

export interface WaterEncounterRollRequest extends WildEncounterRollRequest {
  playerIsSurfing: boolean;
}

export interface LandEncounterRollResult {
  species: number;
  level: number;
  slotIndex: number;
}

export interface WaterEncounterRollResult {
  species: number;
  level: number;
  slotIndex: number;
}

function defaultRandomInt(maxExclusive: number): number {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 1) return 0;
  return Math.floor(Math.random() * maxExclusive);
}

function chooseWeightedIndex(weights: readonly number[], randomInt: (maxExclusive: number) => number): number {
  const normalized = weights.map((weight) => Math.max(0, Math.trunc(weight)));
  const total = normalized.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return 0;
  }

  let roll = randomInt(total);
  for (let i = 0; i < normalized.length; i++) {
    roll -= normalized[i];
    if (roll < 0) return i;
  }
  return Math.max(0, normalized.length - 1);
}

function getLeadAbility(leadPokemon: PartyPokemon | null): number {
  if (!leadPokemon || leadPokemon.isEgg) return ABILITIES.NONE;
  return getAbility(leadPokemon.species, leadPokemon.abilityNum);
}

function chooseAbilityInfluencedSlotIndex(
  slotSpecies: readonly number[],
  targetType: string,
  randomInt: (maxExclusive: number) => number,
): number | null {
  const eligible: number[] = [];
  for (let index = 0; index < slotSpecies.length; index++) {
    const speciesInfo = getSpeciesInfo(slotSpecies[index]);
    if (!speciesInfo) continue;
    if (speciesInfo.types[0] === targetType || speciesInfo.types[1] === targetType) {
      eligible.push(index);
    }
  }
  if (eligible.length === 0) return null;
  if (randomInt(2) !== 0) return null;
  return eligible[randomInt(eligible.length)];
}

function chooseLandSlotIndex(
  slotSpecies: readonly number[],
  leadAbility: number,
  randomInt: (maxExclusive: number) => number,
): number {
  if (leadAbility === ABILITIES.MAGNET_PULL) {
    const index = chooseAbilityInfluencedSlotIndex(slotSpecies, 'STEEL', randomInt);
    if (index !== null) return index;
  }

  if (leadAbility === ABILITIES.STATIC) {
    const index = chooseAbilityInfluencedSlotIndex(slotSpecies, 'ELECTRIC', randomInt);
    if (index !== null) return index;
  }

  return chooseWeightedIndex(WILD_ENCOUNTER_SLOT_RATES.land, randomInt);
}

function chooseWaterSlotIndex(
  slotSpecies: readonly number[],
  leadAbility: number,
  randomInt: (maxExclusive: number) => number,
): number {
  if (leadAbility === ABILITIES.STATIC) {
    const index = chooseAbilityInfluencedSlotIndex(slotSpecies, 'ELECTRIC', randomInt);
    if (index !== null) return index;
  }

  return chooseWeightedIndex(WILD_ENCOUNTER_SLOT_RATES.water, randomInt);
}

function chooseWildLevel(
  minLevelRaw: number,
  maxLevelRaw: number,
  leadAbility: number,
  randomInt: (maxExclusive: number) => number,
): number {
  const minLevel = Math.max(1, Math.trunc(Math.min(minLevelRaw, maxLevelRaw)));
  const maxLevel = Math.max(1, Math.trunc(Math.max(minLevelRaw, maxLevelRaw)));
  const range = Math.max(1, maxLevel - minLevel + 1);
  let roll = randomInt(range);

  if (
    leadAbility === ABILITIES.HUSTLE
    || leadAbility === ABILITIES.VITAL_SPIRIT
    || leadAbility === ABILITIES.PRESSURE
  ) {
    if (randomInt(2) === 0) {
      return maxLevel;
    }
    if (roll !== 0) {
      roll -= 1;
    }
  }

  return minLevel + roll;
}

function applyEncounterRateModifiers(
  baseEncounterRate: number,
  req: WildEncounterRollRequest,
  leadAbility: number,
): number {
  let encounterRate = Math.max(0, Math.trunc(baseEncounterRate)) * 16;

  if (req.isBikeRiding) {
    encounterRate = Math.floor((encounterRate * 80) / 100);
  }

  if (req.whiteFluteActive) {
    encounterRate += Math.floor(encounterRate / 2);
  } else if (req.blackFluteActive) {
    encounterRate = Math.floor(encounterRate / 2);
  }

  if (req.leadPokemon?.heldItem === ITEMS.ITEM_CLEANSE_TAG) {
    encounterRate = Math.floor((encounterRate * 2) / 3);
  }

  switch (leadAbility) {
    case ABILITIES.STENCH:
    case ABILITIES.WHITE_SMOKE:
      encounterRate = Math.floor(encounterRate / 2);
      break;
    case ABILITIES.ILLUMINATE:
    case ABILITIES.ARENA_TRAP:
      encounterRate *= 2;
      break;
    case ABILITIES.SAND_VEIL:
      if (req.weatherName === 'WEATHER_SANDSTORM') {
        encounterRate = Math.floor(encounterRate / 2);
      }
      break;
  }

  if (encounterRate > MAX_ENCOUNTER_RATE) {
    return MAX_ENCOUNTER_RATE;
  }
  return Math.max(0, encounterRate);
}

/**
 * Resolve the encounter area for the player's current step.
 *
 * C refs:
 * - public/pokeemerald/src/metatile_behavior.c (MetatileBehavior_IsLandWildEncounter / IsWaterWildEncounter)
 * - public/pokeemerald/src/wild_encounter.c (StandardWildEncounter water-bridge branch)
 */
function resolveStepEncounterArea(req: WildEncounterRollRequest): StepEncounterArea | null {
  const behavior = req.currentTileBehavior;
  if (behavior === undefined) return null;

  if (isLandWildEncounterBehavior(behavior)) {
    return 'land';
  }

  if (
    isWaterWildEncounterBehavior(behavior)
    || (req.playerIsSurfing === true && isBridgeOverWaterBehavior(behavior))
  ) {
    return 'water';
  }

  return null;
}

/**
 * Attempt to generate a roaming step encounter (land or surfing water).
 */
export function tryGenerateStepEncounter(req: WildEncounterRollRequest): WildEncounterRollResult | null {
  const randomInt = req.randomInt ?? defaultRandomInt;
  const area = resolveStepEncounterArea(req);
  if (!area) return null;

  const wildData = getMapWildEncounterData(req.mapId);
  const encounterTable = area === 'land' ? wildData?.land : wildData?.water;
  if (!encounterTable || encounterTable.slots.length === 0) return null;

  // C parity: changing metatile behavior has a 40% chance to skip wild check.
  const behavior = req.currentTileBehavior;
  if (
    behavior !== undefined
    && req.previousTileBehavior !== undefined
    && req.previousTileBehavior !== behavior
    && randomInt(100) >= 60
  ) {
    return null;
  }

  const leadAbility = getLeadAbility(req.leadPokemon);
  const encounterRate = applyEncounterRateModifiers(encounterTable.encounterRate, req, leadAbility);
  if (randomInt(MAX_ENCOUNTER_RATE) >= encounterRate) {
    return null;
  }

  const slotSpecies = encounterTable.slots.map((slot) => slot.species);
  const slotIndex = area === 'land'
    ? chooseLandSlotIndex(slotSpecies, leadAbility, randomInt)
    : chooseWaterSlotIndex(slotSpecies, leadAbility, randomInt);
  const selectedSlot = encounterTable.slots[Math.max(0, Math.min(encounterTable.slots.length - 1, slotIndex))];
  if (!selectedSlot || selectedSlot.species <= 0) return null;

  const level = chooseWildLevel(selectedSlot.minLevel, selectedSlot.maxLevel, leadAbility, randomInt);
  const leadLevel = req.leadPokemon?.level ?? 1;
  const repelSteps = Math.max(0, Math.trunc(req.repelStepsRemaining ?? 0));

  // C parity: Repel blocks encounters below lead level.
  if (repelSteps > 0 && level < leadLevel) {
    return null;
  }

  // C parity: Keen Eye / Intimidate can cancel low-level encounters (50%).
  if (
    (leadAbility === ABILITIES.KEEN_EYE || leadAbility === ABILITIES.INTIMIDATE)
    && leadLevel > 5
    && level <= leadLevel - 5
    && randomInt(2) === 0
  ) {
    return null;
  }

  return {
    species: selectedSlot.species,
    level,
    slotIndex,
    area,
  };
}

/**
 * Attempt to generate a roaming land encounter from the current step.
 */
export function tryGenerateLandEncounter(req: LandEncounterRollRequest): LandEncounterRollResult | null {
  const result = tryGenerateStepEncounter(req);
  if (!result || result.area !== 'land') {
    return null;
  }
  return {
    species: result.species,
    level: result.level,
    slotIndex: result.slotIndex,
  };
}

/**
 * Attempt to generate a roaming water encounter from the current step.
 */
export function tryGenerateWaterEncounter(req: WaterEncounterRollRequest): WaterEncounterRollResult | null {
  const result = tryGenerateStepEncounter(req);
  if (!result || result.area !== 'water') {
    return null;
  }
  return {
    species: result.species,
    level: result.level,
    slotIndex: result.slotIndex,
  };
}
