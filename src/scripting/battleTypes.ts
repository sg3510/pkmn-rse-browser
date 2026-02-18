/**
 * Shared battle scripting types and constants.
 *
 * C references:
 * - public/pokeemerald/include/constants/battle.h (B_OUTCOME_*)
 * - public/pokeemerald/src/battle_setup.c (IsPlayerDefeated)
 */

import { B_OUTCOME } from '../data/battleConstants.gen.ts';
import type { BattleTrainerSpec } from '../battle/BattleStartRequest.ts';

export const BATTLE_OUTCOME = {
  WON: B_OUTCOME.B_OUTCOME_WON,
  LOST: B_OUTCOME.B_OUTCOME_LOST,
  DREW: B_OUTCOME.B_OUTCOME_DREW,
  RAN: B_OUTCOME.B_OUTCOME_RAN,
  PLAYER_TELEPORTED: B_OUTCOME.B_OUTCOME_PLAYER_TELEPORTED,
  MON_FLED: B_OUTCOME.B_OUTCOME_MON_FLED,
  CAUGHT: B_OUTCOME.B_OUTCOME_CAUGHT,
  NO_SAFARI_BALLS: B_OUTCOME.B_OUTCOME_NO_SAFARI_BALLS,
  FORFEITED: B_OUTCOME.B_OUTCOME_FORFEITED,
  MON_TELEPORTED: B_OUTCOME.B_OUTCOME_MON_TELEPORTED,
} as const;

export type BattleOutcomeCode = typeof BATTLE_OUTCOME[keyof typeof BATTLE_OUTCOME];

export interface ScriptBattleResult {
  outcome: BattleOutcomeCode;
}

export type ScriptTrainerBattleMode =
  | 'single'
  | 'double'
  | 'rematch'
  | 'rematch_double'
  | 'no_intro';

export interface ScriptTrainerBattleRequest {
  trainerId: string;
  mode: ScriptTrainerBattleMode;
  trainer?: BattleTrainerSpec;
}

export type ScriptWildBattleSource = 'setwildbattle' | 'special';

export interface ScriptWildBattleRequest {
  speciesId: number;
  level: number;
  heldItemId: number;
  source: ScriptWildBattleSource;
}

export function isPlayerDefeatedBattleOutcome(outcome: number): boolean {
  return outcome === BATTLE_OUTCOME.LOST || outcome === BATTLE_OUTCOME.DREW;
}

export function normalizeBattleOutcome(
  outcome: number | undefined,
  fallback: BattleOutcomeCode = BATTLE_OUTCOME.WON
): BattleOutcomeCode {
  if (outcome === undefined) return fallback;
  if (outcome >= BATTLE_OUTCOME.WON && outcome <= BATTLE_OUTCOME.MON_TELEPORTED) {
    return outcome as BattleOutcomeCode;
  }
  return fallback;
}
