/**
 * Shared multi-turn battle-state helpers.
 *
 * C ref:
 * - public/pokeemerald/src/battle_util.c (CancelMultiTurnMoves)
 * - public/pokeemerald/src/battle_script_commands.c (setbide, setmoveeffect, setcharge)
 */

import { MOVES } from '../../data/moves.ts';
import type { BattlePokemon } from './types.ts';

export function setTwoTurnCharge(mon: BattlePokemon, moveId: number, semiInvulnerable = false): void {
  mon.volatile.chargeMove = moveId;
  mon.volatile.semiInvulnerableMove = semiInvulnerable ? moveId : MOVES.NONE;
}

export function clearTwoTurnCharge(mon: BattlePokemon): void {
  mon.volatile.chargeMove = MOVES.NONE;
  mon.volatile.semiInvulnerableMove = MOVES.NONE;
}

export function startBide(mon: BattlePokemon): void {
  mon.volatile.bide = 2;
  mon.volatile.bideDamage = 0;
  mon.volatile.bideTargetIsPlayer = null;
}

export function clearBide(mon: BattlePokemon): void {
  mon.volatile.bide = 0;
  mon.volatile.bideDamage = 0;
  mon.volatile.bideTargetIsPlayer = null;
}

export function clearMoveLocks(mon: BattlePokemon): void {
  clearTwoTurnCharge(mon);
  clearBide(mon);
  mon.volatile.rampageTurns = 0;
  mon.volatile.rampageMove = MOVES.NONE;
  mon.volatile.rollout = 0;
  mon.volatile.uproarTurns = 0;
  mon.volatile.uproarMove = MOVES.NONE;
  mon.volatile.furyCutter = 0;
}
