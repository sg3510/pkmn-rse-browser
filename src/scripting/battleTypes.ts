/**
 * Shared battle scripting types and constants.
 *
 * C references:
 * - public/pokeemerald/include/constants/battle.h (B_OUTCOME_*)
 * - public/pokeemerald/src/battle_setup.c (IsPlayerDefeated)
 */

export const BATTLE_OUTCOME = {
  WON: 1,
  LOST: 2,
  DREW: 3,
  RAN: 4,
  PLAYER_TELEPORTED: 5,
  MON_FLED: 6,
  CAUGHT: 7,
  NO_SAFARI_BALLS: 8,
  FORFEITED: 9,
  MON_TELEPORTED: 10,
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
