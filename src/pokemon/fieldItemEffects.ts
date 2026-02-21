/**
 * Field medicine/item stat effects shared across menus and scripted usage.
 *
 * C ref:
 * - public/pokeemerald/src/pokemon.c (vitamin EV limits and stat recalc behavior)
 * - public/pokeemerald/src/battle_script_commands.c (PP bonus rules via CalculatePPWithBonus parity)
 */

import { ITEMS } from '../data/items.ts';
import type { PartyPokemon } from './types.ts';
import { recalculatePartyStatsCStyle } from './stats.ts';
import { calculateMoveMaxPp, canApplyPpUp, getMovePpUps, setMovePpUps } from './pp.ts';

export const EV_ITEM_RAISE_LIMIT = 100;
export const MAX_TOTAL_EVS = 510;
export const EV_ITEM_RAISE_AMOUNT = 10;

const VITAMIN_STAT_BY_ITEM: Record<number, keyof PartyPokemon['evs']> = {
  [ITEMS.ITEM_HP_UP]: 'hp',
  [ITEMS.ITEM_PROTEIN]: 'attack',
  [ITEMS.ITEM_IRON]: 'defense',
  [ITEMS.ITEM_CARBOS]: 'speed',
  [ITEMS.ITEM_CALCIUM]: 'spAttack',
  [ITEMS.ITEM_ZINC]: 'spDefense',
};

export function resolveVitaminStat(itemId: number): keyof PartyPokemon['evs'] | null {
  return VITAMIN_STAT_BY_ITEM[itemId] ?? null;
}

function getTotalEvs(mon: PartyPokemon): number {
  return mon.evs.hp
    + mon.evs.attack
    + mon.evs.defense
    + mon.evs.speed
    + mon.evs.spAttack
    + mon.evs.spDefense;
}

export function tryApplyVitaminByItem(mon: PartyPokemon, itemId: number): {
  used: boolean;
  pokemon: PartyPokemon;
  stat?: keyof PartyPokemon['evs'];
  evIncrease?: number;
} {
  const stat = resolveVitaminStat(itemId);
  if (!stat) {
    return { used: false, pokemon: mon };
  }

  const currentEv = mon.evs[stat];
  const totalEvs = getTotalEvs(mon);
  const roomPerStat = Math.max(0, EV_ITEM_RAISE_LIMIT - currentEv);
  const roomTotal = Math.max(0, MAX_TOTAL_EVS - totalEvs);
  const evIncrease = Math.min(EV_ITEM_RAISE_AMOUNT, roomPerStat, roomTotal);
  if (evIncrease <= 0) {
    return { used: false, pokemon: mon, stat, evIncrease: 0 };
  }

  const nextMon = recalculatePartyStatsCStyle({
    ...mon,
    evs: {
      ...mon.evs,
      [stat]: currentEv + evIncrease,
    },
  });

  return {
    used: true,
    pokemon: nextMon,
    stat,
    evIncrease,
  };
}

export function tryApplyPpUp(mon: PartyPokemon, moveSlot: number): {
  used: boolean;
  pokemon: PartyPokemon;
  maxPpIncrease: number;
} {
  const moveId = mon.moves[moveSlot] ?? 0;
  if (!canApplyPpUp(moveId, mon.ppBonuses, moveSlot)) {
    return { used: false, pokemon: mon, maxPpIncrease: 0 };
  }

  const prevMaxPp = calculateMoveMaxPp(moveId, mon.ppBonuses, moveSlot);
  const currentUps = getMovePpUps(mon.ppBonuses, moveSlot);
  const nextBonuses = setMovePpUps(mon.ppBonuses, moveSlot, currentUps + 1);
  const nextMaxPp = calculateMoveMaxPp(moveId, nextBonuses, moveSlot);
  const maxPpIncrease = Math.max(0, nextMaxPp - prevMaxPp);

  const pp = [...mon.pp] as [number, number, number, number];
  pp[moveSlot] = Math.min(nextMaxPp, (pp[moveSlot] ?? 0) + maxPpIncrease);

  return {
    used: true,
    pokemon: {
      ...mon,
      pp,
      ppBonuses: nextBonuses,
    },
    maxPpIncrease,
  };
}

export function tryApplyPpMax(mon: PartyPokemon, moveSlot: number): {
  used: boolean;
  pokemon: PartyPokemon;
  maxPpIncrease: number;
} {
  const moveId = mon.moves[moveSlot] ?? 0;
  if (!canApplyPpUp(moveId, mon.ppBonuses, moveSlot)) {
    return { used: false, pokemon: mon, maxPpIncrease: 0 };
  }

  const prevMaxPp = calculateMoveMaxPp(moveId, mon.ppBonuses, moveSlot);
  const nextBonuses = setMovePpUps(mon.ppBonuses, moveSlot, 3);
  const nextMaxPp = calculateMoveMaxPp(moveId, nextBonuses, moveSlot);
  const maxPpIncrease = Math.max(0, nextMaxPp - prevMaxPp);

  const pp = [...mon.pp] as [number, number, number, number];
  pp[moveSlot] = Math.min(nextMaxPp, (pp[moveSlot] ?? 0) + maxPpIncrease);

  return {
    used: true,
    pokemon: {
      ...mon,
      pp,
      ppBonuses: nextBonuses,
    },
    maxPpIncrease,
  };
}
