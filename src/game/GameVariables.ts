/**
 * Game variables manager.
 *
 * C references:
 * - public/pokeemerald/include/constants/vars.h
 * - public/pokeemerald/src/event_data.c (VarGet / VarSet usage)
 */

import { saveStateStore } from '../save/SaveStateStore.ts';

export const GAME_VARS = {
  VAR_LITTLEROOT_INTRO_STATE: 'VAR_LITTLEROOT_INTRO_STATE',
  VAR_LITTLEROOT_TOWN_STATE: 'VAR_LITTLEROOT_TOWN_STATE',
  VAR_LITTLEROOT_HOUSES_STATE_MAY: 'VAR_LITTLEROOT_HOUSES_STATE_MAY',
  VAR_LITTLEROOT_HOUSES_STATE_BRENDAN: 'VAR_LITTLEROOT_HOUSES_STATE_BRENDAN',
  VAR_ROUTE101_STATE: 'VAR_ROUTE101_STATE',
  VAR_BIRCH_LAB_STATE: 'VAR_BIRCH_LAB_STATE',
  VAR_LITTLEROOT_RIVAL_STATE: 'VAR_LITTLEROOT_RIVAL_STATE',
  VAR_RESULT: 'VAR_RESULT',
  VAR_STARTER_MON: 'VAR_STARTER_MON',
} as const;

export type GameVarName = string;
export type GameVarRecord = Record<string, number>;

class GameVariablesManager {
  getVar(name: GameVarName): number {
    return saveStateStore.getVar(name);
  }

  setVar(name: GameVarName, value: number): void {
    saveStateStore.setVar(name, value);
  }

  addVar(name: GameVarName, delta: number): void {
    this.setVar(name, this.getVar(name) + delta);
  }

  compareVar(name: GameVarName, value: number): number {
    const current = this.getVar(name);
    if (current === value) return 0;
    return current < value ? -1 : 1;
  }

  reset(): void {
    saveStateStore.clearVars();
  }

  loadFromRecord(record: GameVarRecord): void {
    saveStateStore.replaceVars(record);
  }

  getAllVars(): GameVarRecord {
    return saveStateStore.getAllVars();
  }
}

export const gameVariables = new GameVariablesManager();
