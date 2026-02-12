/**
 * Shared battle-item rule helpers.
 *
 * C refs:
 * - public/pokeemerald/src/battle_util.c (HandleAction_UseItem)
 * - public/pokeemerald/src/battle_script_commands.c (item status clearing)
 */

import { ITEMS } from '../../data/items';
import { STATUS } from '../../pokemon/types';

export type BattleHealAmount = number | 'full' | null;

const BATTLE_HEAL_AMOUNTS = new Map<number, Exclude<BattleHealAmount, null>>([
  [ITEMS.ITEM_POTION, 20],
  [ITEMS.ITEM_SUPER_POTION, 50],
  [ITEMS.ITEM_HYPER_POTION, 200],
  [ITEMS.ITEM_MAX_POTION, 'full'],
  [ITEMS.ITEM_FULL_RESTORE, 'full'],
  [ITEMS.ITEM_FRESH_WATER, 50],
  [ITEMS.ITEM_SODA_POP, 60],
  [ITEMS.ITEM_LEMONADE, 80],
  [ITEMS.ITEM_MOOMOO_MILK, 100],
  [ITEMS.ITEM_ENERGY_POWDER, 50],
  [ITEMS.ITEM_ENERGY_ROOT, 200],
  [ITEMS.ITEM_BERRY_JUICE, 20],
]);

const BATTLE_STATUS_CURE_MASKS = new Map<number, number>([
  [ITEMS.ITEM_ANTIDOTE, STATUS.POISON | STATUS.TOXIC],
  [ITEMS.ITEM_BURN_HEAL, STATUS.BURN],
  [ITEMS.ITEM_ICE_HEAL, STATUS.FREEZE],
  [ITEMS.ITEM_AWAKENING, STATUS.SLEEP],
  [ITEMS.ITEM_PARALYZE_HEAL, STATUS.PARALYSIS],
]);

export function isBattlePokeBallItem(itemId: number): boolean {
  return itemId >= ITEMS.ITEM_MASTER_BALL && itemId <= ITEMS.ITEM_PREMIER_BALL;
}

export function getBattleHealAmount(itemId: number): BattleHealAmount {
  return BATTLE_HEAL_AMOUNTS.get(itemId) ?? null;
}

export function getBattleStatusCureMask(itemId: number): number {
  return BATTLE_STATUS_CURE_MASKS.get(itemId) ?? 0;
}

export function clearBattleStatusMask(status: number, mask: number): number {
  let nextStatus = status;
  if ((mask & (STATUS.POISON | STATUS.TOXIC)) !== 0) {
    nextStatus &= ~(STATUS.POISON | STATUS.TOXIC);
  }
  if ((mask & STATUS.BURN) !== 0) {
    nextStatus &= ~STATUS.BURN;
  }
  if ((mask & STATUS.FREEZE) !== 0) {
    nextStatus &= ~STATUS.FREEZE;
  }
  if ((mask & STATUS.PARALYSIS) !== 0) {
    nextStatus &= ~STATUS.PARALYSIS;
  }
  if ((mask & STATUS.SLEEP) !== 0) {
    nextStatus &= ~STATUS.SLEEP;
  }
  return nextStatus;
}

