/**
 * Game variables manager.
 *
 * C references:
 * - public/pokeemerald/include/constants/vars.h
 * - public/pokeemerald/src/event_data.c (VarGet / VarSet usage)
 */

const STORAGE_KEY = 'pokemon-rse-browser-vars';

export const GAME_VARS = {
  VAR_LITTLEROOT_INTRO_STATE: 'VAR_LITTLEROOT_INTRO_STATE',
  VAR_LITTLEROOT_TOWN_STATE: 'VAR_LITTLEROOT_TOWN_STATE',
  VAR_LITTLEROOT_HOUSES_STATE_MAY: 'VAR_LITTLEROOT_HOUSES_STATE_MAY',
  VAR_LITTLEROOT_HOUSES_STATE_BRENDAN: 'VAR_LITTLEROOT_HOUSES_STATE_BRENDAN',
  VAR_ROUTE101_STATE: 'VAR_ROUTE101_STATE',
  VAR_BIRCH_LAB_STATE: 'VAR_BIRCH_LAB_STATE',
  VAR_RESULT: 'VAR_RESULT',
  VAR_STARTER_MON: 'VAR_STARTER_MON',
} as const;

export type GameVarName = string;
export type GameVarRecord = Record<string, number>;

class GameVariablesManager {
  private vars: Map<GameVarName, number> = new Map();
  private loaded = false;

  private load(): void {
    if (this.loaded) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (parsed && typeof parsed === 'object') {
          for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof value === 'number' && Number.isFinite(value)) {
              this.vars.set(key, value);
            }
          }
        }
      }
    } catch (error) {
      console.warn('[GameVariables] Failed to load variables from localStorage:', error);
    }

    this.loaded = true;
  }

  private save(): void {
    try {
      const payload = Object.fromEntries(this.vars.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[GameVariables] Failed to save variables to localStorage:', error);
    }
  }

  getVar(name: GameVarName): number {
    this.load();
    return this.vars.get(name) ?? 0;
  }

  setVar(name: GameVarName, value: number): void {
    this.load();
    this.vars.set(name, value | 0);
    this.save();
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
    this.load();
    this.vars.clear();
    this.save();
  }

  loadFromRecord(record: GameVarRecord): void {
    this.load();
    this.vars.clear();

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        this.vars.set(key, value | 0);
      }
    }

    this.save();
  }

  getAllVars(): GameVarRecord {
    this.load();
    return Object.fromEntries(this.vars.entries());
  }
}

export const gameVariables = new GameVariablesManager();
