/**
 * PP bonus utilities (PP Up / PP Max).
 *
 * C ref:
 * - public/pokeemerald/src/pokemon.c (CalculatePPWithBonus)
 * - public/pokeemerald/src/battle_script_commands.c (pp bonus usage in battle)
 */

import { getMoveInfo, MOVES } from '../data/moves.ts';

const PP_BONUS_BITS_PER_MOVE = 2;
const PP_UP_PERCENT = 20;
const MAX_PP_UPS_PER_MOVE = 3;

function clampMoveSlot(slot: number): number {
  return Math.max(0, Math.min(3, slot | 0));
}

export function getMovePpUps(ppBonuses: number, slot: number): number {
  const normalizedSlot = clampMoveSlot(slot);
  const shift = normalizedSlot * PP_BONUS_BITS_PER_MOVE;
  return (ppBonuses >> shift) & MAX_PP_UPS_PER_MOVE;
}

export function setMovePpUps(ppBonuses: number, slot: number, ppUps: number): number {
  const normalizedSlot = clampMoveSlot(slot);
  const normalizedUps = Math.max(0, Math.min(MAX_PP_UPS_PER_MOVE, ppUps | 0));
  const shift = normalizedSlot * PP_BONUS_BITS_PER_MOVE;
  const clearMask = ~(MAX_PP_UPS_PER_MOVE << shift);
  return (ppBonuses & clearMask) | (normalizedUps << shift);
}

export function calculateMoveMaxPp(moveId: number, ppBonuses: number, slot: number): number {
  if (moveId === MOVES.NONE) return 0;
  const basePp = getMoveInfo(moveId)?.pp ?? 0;
  if (basePp <= 0) return 0;
  const ppUps = getMovePpUps(ppBonuses, slot);
  return basePp + Math.floor((basePp * PP_UP_PERCENT * ppUps) / 100);
}

export function canApplyPpUp(moveId: number, ppBonuses: number, slot: number): boolean {
  if (moveId === MOVES.NONE) return false;
  const basePp = getMoveInfo(moveId)?.pp ?? 0;
  if (basePp < 5) {
    // Emerald disallows PP Up / PP Max on low-PP moves like Sketch.
    return false;
  }
  return getMovePpUps(ppBonuses, slot) < MAX_PP_UPS_PER_MOVE;
}
