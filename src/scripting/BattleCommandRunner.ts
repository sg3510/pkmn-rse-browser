/**
 * Sister runtime for ScriptRunner battle commands.
 *
 * Handles command-level battle setup/start state:
 * - trainer battle requests
 * - setwildbattle / dowildbattle configuration
 * - last battle outcome tracking
 *
 * C references:
 * - public/pokeemerald/src/scrcmd.c (ScrCmd_setwildbattle, ScrCmd_dowildbattle)
 * - public/pokeemerald/src/battle_setup.c (BattleSetup_StartTrainerBattle, BattleSetup_StartScriptedWildBattle)
 */

import { gameVariables } from '../game/GameVariables';
import {
  BATTLE_OUTCOME,
  normalizeBattleOutcome,
  type ScriptBattleResult,
  type ScriptTrainerBattleRequest,
  type ScriptWildBattleRequest,
} from './battleTypes';

export interface BattleCommandContext {
  delayFrames: (frames: number) => Promise<void>;
  startTrainerBattle?: (request: ScriptTrainerBattleRequest) => Promise<ScriptBattleResult>;
  startWildBattle?: (request: ScriptWildBattleRequest) => Promise<ScriptBattleResult>;
}

interface PendingWildBattle {
  speciesId: number;
  level: number;
  heldItemId: number;
}

const OUTCOME_VAR = 'VAR_BATTLE_OUTCOME';

export class BattleCommandRunner {
  private pendingWildBattle: PendingWildBattle = { speciesId: 0, level: 0, heldItemId: 0 };
  private lastOutcome = gameVariables.getVar(OUTCOME_VAR);

  constructor(private readonly ctx: BattleCommandContext) {}

  configureWildBattle(speciesId: number, level: number, heldItemId: number): void {
    this.pendingWildBattle = { speciesId, level, heldItemId };
  }

  getLastBattleOutcome(): number {
    return this.lastOutcome;
  }

  async runTrainerBattle(request: ScriptTrainerBattleRequest): Promise<ScriptBattleResult> {
    if (!this.ctx.startTrainerBattle) {
      await this.ctx.delayFrames(16);
      return this.commitOutcome(BATTLE_OUTCOME.WON);
    }

    const result = await this.ctx.startTrainerBattle(request);
    return this.commitOutcome(normalizeBattleOutcome(result?.outcome, BATTLE_OUTCOME.WON));
  }

  async runConfiguredWildBattle(source: ScriptWildBattleRequest['source']): Promise<ScriptBattleResult> {
    const request: ScriptWildBattleRequest = {
      ...this.pendingWildBattle,
      source,
    };
    return this.runWildBattle(request);
  }

  async runWildBattle(request: ScriptWildBattleRequest): Promise<ScriptBattleResult> {
    const { speciesId, level, heldItemId, source } = request;
    if (speciesId <= 0 || level <= 0) {
      await this.ctx.delayFrames(16);
      return this.commitOutcome(BATTLE_OUTCOME.WON);
    }

    if (!this.ctx.startWildBattle) {
      await this.ctx.delayFrames(16);
      return this.commitOutcome(BATTLE_OUTCOME.WON);
    }

    const result = await this.ctx.startWildBattle({ speciesId, level, heldItemId, source });
    return this.commitOutcome(normalizeBattleOutcome(result?.outcome, BATTLE_OUTCOME.WON));
  }

  private commitOutcome(outcome: ScriptBattleResult['outcome']): ScriptBattleResult {
    this.lastOutcome = outcome;
    gameVariables.setVar(OUTCOME_VAR, outcome);
    return { outcome };
  }
}
