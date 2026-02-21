/**
 * Shared delayed-effect helpers (Future Sight / Wish style state).
 *
 * C ref:
 * - public/pokeemerald/src/battle_util.c (HandleWishPerishSongOnTurnEnd, ENDTURN_WISH)
 * - public/pokeemerald/src/battle_script_commands.c (trywish, futureattack)
 */

import { MOVES } from '../../data/moves.ts';
import type { BattlePokemon, SideState } from './types.ts';

export function queueFutureSight(
  target: BattlePokemon,
  moveId: number,
  damage: number,
  attackerIsPlayer: boolean,
): void {
  target.volatile.futureSightTurns = 3;
  target.volatile.futureSightMoveId = moveId;
  target.volatile.futureSightDamage = Math.max(1, damage);
  target.volatile.futureSightAttackerIsPlayer = attackerIsPlayer;
}

export function clearFutureSight(target: BattlePokemon): void {
  target.volatile.futureSightTurns = 0;
  target.volatile.futureSightMoveId = MOVES.NONE;
  target.volatile.futureSightDamage = 0;
  target.volatile.futureSightAttackerIsPlayer = null;
}

export function queueWish(side: SideState, amount: number): void {
  side.wishTurn = 2;
  side.wishAmount = Math.max(1, amount);
}

export function clearWish(side: SideState): void {
  side.wishTurn = 0;
  side.wishAmount = 0;
}
