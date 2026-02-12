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

import { gameVariables, GAME_VARS } from '../game/GameVariables';
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

const OUTCOME_VAR = GAME_VARS.VAR_RESULT;

export class BattleCommandRunner {
  private readonly ctx: BattleCommandContext;
  private pendingWildBattle: PendingWildBattle = { speciesId: 0, level: 0, heldItemId: 0 };

  constructor(ctx: BattleCommandContext) {
    this.ctx = ctx;
  }

  configureWildBattle(speciesId: number, level: number, heldItemId: number): void {
    this.pendingWildBattle = { speciesId, level, heldItemId };
  }

  getLastBattleOutcome(): number {
    return normalizeBattleOutcome(gameVariables.getVar(OUTCOME_VAR), BATTLE_OUTCOME.WON);
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
    gameVariables.setVar(OUTCOME_VAR, outcome);
    return { outcome };
  }
}
