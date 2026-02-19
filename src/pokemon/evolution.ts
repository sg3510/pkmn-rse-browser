/**
 * Evolution target resolution with Emerald C parity behavior.
 *
 * C refs:
 * - public/pokeemerald/src/pokemon.c (GetEvolutionTargetSpecies)
 * - public/pokeemerald/include/constants/pokemon.h (EVO_* / EVO_MODE_*)
 */

import type { PartyPokemon } from './types.ts';
import {
  EVOLUTION_METHODS,
  EVOLUTION_MODES,
  getEvolutionRules,
  type EvolutionRule,
} from '../data/evolutions.gen.ts';
import { getItemBattleEffect, HOLD_EFFECTS } from '../data/itemBattleEffects.gen.ts';
import { getSpeciesName } from '../data/species.ts';

const FRIENDSHIP_EVO_THRESHOLD = 220;
const DAY_EVO_HOUR_BEGIN = 12;
const DAY_EVO_HOUR_END = 24;
const NIGHT_EVO_HOUR_BEGIN = 0;
const NIGHT_EVO_HOUR_END = 12;
export interface EvolutionResolutionOptions {
  evolutionItem?: number;
  now?: Date;
  party?: readonly (PartyPokemon | null)[];
}

export function isEvolutionBlockedByEverstone(mon: PartyPokemon, mode: number): boolean {
  const holdEffect = getItemBattleEffect(mon.heldItem)?.holdEffect;
  if (holdEffect !== HOLD_EFFECTS.HOLD_EFFECT_PREVENT_EVOLVE) {
    return false;
  }
  return mode !== EVOLUTION_MODES.EVO_MODE_ITEM_CHECK;
}

export function isDayForEvolution(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= DAY_EVO_HOUR_BEGIN && hour < DAY_EVO_HOUR_END;
}

export function isNightForEvolution(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= NIGHT_EVO_HOUR_BEGIN && hour < NIGHT_EVO_HOUR_END;
}

function resolveNormalModeTarget(
  mon: PartyPokemon,
  rules: EvolutionRule[],
  now: Date,
): number {
  let targetSpecies = 0;
  const level = mon.level;
  const friendship = mon.friendship;
  const beauty = mon.contest.beauty;
  const upperPersonality = (mon.personality >>> 16) & 0xffff;

  for (const rule of rules) {
    switch (rule.method) {
      case EVOLUTION_METHODS.EVO_FRIENDSHIP:
        if (friendship >= FRIENDSHIP_EVO_THRESHOLD) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_FRIENDSHIP_DAY:
        if (isDayForEvolution(now) && friendship >= FRIENDSHIP_EVO_THRESHOLD) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_FRIENDSHIP_NIGHT:
        if (isNightForEvolution(now) && friendship >= FRIENDSHIP_EVO_THRESHOLD) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_LEVEL:
      case EVOLUTION_METHODS.EVO_LEVEL_NINJASK:
        if (rule.param <= level) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_LEVEL_ATK_GT_DEF:
        if (rule.param <= level && mon.stats.attack > mon.stats.defense) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_LEVEL_ATK_EQ_DEF:
        if (rule.param <= level && mon.stats.attack === mon.stats.defense) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_LEVEL_ATK_LT_DEF:
        if (rule.param <= level && mon.stats.attack < mon.stats.defense) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_LEVEL_SILCOON:
        if (rule.param <= level && (upperPersonality % 10) <= 4) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_LEVEL_CASCOON:
        if (rule.param <= level && (upperPersonality % 10) > 4) {
          targetSpecies = rule.targetSpecies;
        }
        break;
      case EVOLUTION_METHODS.EVO_BEAUTY:
        if (rule.param <= beauty) {
          targetSpecies = rule.targetSpecies;
        }
        break;
    }
  }

  return targetSpecies;
}

function resolveTradeModeTarget(mon: PartyPokemon, rules: EvolutionRule[]): number {
  let targetSpecies = 0;
  for (const rule of rules) {
    switch (rule.method) {
      case EVOLUTION_METHODS.EVO_TRADE:
        targetSpecies = rule.targetSpecies;
        break;
      case EVOLUTION_METHODS.EVO_TRADE_ITEM:
        if (rule.param === mon.heldItem) {
          targetSpecies = rule.targetSpecies;
        }
        break;
    }
  }
  return targetSpecies;
}

function resolveItemModeTarget(
  rules: EvolutionRule[],
  evolutionItem: number,
): number {
  for (const rule of rules) {
    if (
      rule.method === EVOLUTION_METHODS.EVO_ITEM
      && rule.param === evolutionItem
    ) {
      return rule.targetSpecies;
    }
  }
  return 0;
}

export function getEvolutionTargetSpecies(
  mon: PartyPokemon,
  mode: number,
  options?: EvolutionResolutionOptions,
): number {
  if (isEvolutionBlockedByEverstone(mon, mode)) {
    return 0;
  }

  const rules = getEvolutionRules(mon.species);
  if (rules.length === 0) {
    return 0;
  }

  switch (mode) {
    case EVOLUTION_MODES.EVO_MODE_NORMAL:
      return resolveNormalModeTarget(mon, rules, options?.now ?? new Date());
    case EVOLUTION_MODES.EVO_MODE_TRADE:
      return resolveTradeModeTarget(mon, rules);
    case EVOLUTION_MODES.EVO_MODE_ITEM_USE:
    case EVOLUTION_MODES.EVO_MODE_ITEM_CHECK:
      return resolveItemModeTarget(rules, options?.evolutionItem ?? 0);
    default:
      return 0;
  }
}

export function getShedinjaEvolutionTarget(preEvolutionSpecies: number): number {
  const rules = getEvolutionRules(preEvolutionSpecies);
  for (const rule of rules) {
    if (rule.method === EVOLUTION_METHODS.EVO_LEVEL_SHEDINJA) {
      return rule.targetSpecies;
    }
  }
  return 0;
}

export function isShedinjaEligible(
  preEvolutionSpecies: number,
  party: readonly (PartyPokemon | null)[],
): boolean {
  const hasShedinjaRule = getShedinjaEvolutionTarget(preEvolutionSpecies) > 0;
  if (!hasShedinjaRule) {
    return false;
  }
  return party.some((mon) => mon === null);
}

function normalizeNickname(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Mirrors EvolutionRenameMon behavior: rename only if the nickname is effectively
 * the species default for the pre-evolution species.
 */
export function shouldRenameAfterEvolution(mon: PartyPokemon, preEvolutionSpecies: number): boolean {
  const nickname = mon.nickname?.trim() ?? '';
  if (nickname.length === 0) {
    return true;
  }
  const preName = getSpeciesName(preEvolutionSpecies);
  return normalizeNickname(nickname) === normalizeNickname(preName);
}

export function resolvePostEvolutionNickname(
  mon: PartyPokemon,
  preEvolutionSpecies: number,
  postEvolutionSpecies: number,
): string | null {
  if (!shouldRenameAfterEvolution(mon, preEvolutionSpecies)) {
    return mon.nickname ?? null;
  }
  return getSpeciesName(postEvolutionSpecies);
}
