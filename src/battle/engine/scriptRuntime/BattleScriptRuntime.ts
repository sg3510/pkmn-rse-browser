/**
 * Battle script runtime compiler/executor scaffold.
 *
 * C ref:
 * - public/pokeemerald/src/battle_script_commands.c
 * - public/pokeemerald/data/battle_scripts_1.s
 * - public/pokeemerald/data/battle_scripts_2.s
 */

import {
  BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID,
  BATTLE_SCRIPT_OPS,
  type BattleScriptOp,
} from '../../../data/battleScripts.gen.ts';
import {
  getBattleScriptCommandHandler,
  hasBattleScriptCommandHandler,
  type BattleScriptRuntimeState,
} from './commands.ts';

interface CompiledBattleScript {
  label: string;
  ops: BattleScriptOp[];
  supported: boolean;
  unsupportedOpcode: string | null;
}

export interface BattleScriptRuntimeExecution {
  attempted: boolean;
  supported: boolean;
  handled: boolean;
  scriptLabel: string | null;
  unsupportedOpcode: string | null;
}

const COMPILED_BATTLE_SCRIPTS = compileBattleScripts();

function compileBattleScripts(): Map<string, CompiledBattleScript> {
  const map = new Map<string, CompiledBattleScript>();
  for (const [label, ops] of Object.entries(BATTLE_SCRIPT_OPS)) {
    let unsupportedOpcode: string | null = null;
    for (const op of ops) {
      if (!hasBattleScriptCommandHandler(op.opcode)) {
        unsupportedOpcode = op.opcode;
        break;
      }
    }
    map.set(label, {
      label,
      ops,
      supported: unsupportedOpcode === null,
      unsupportedOpcode,
    });
  }
  return map;
}

export function executeBattleScriptForMoveEffect(effectId: number): BattleScriptRuntimeExecution {
  const scriptEntry = BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID[effectId];
  if (!scriptEntry) {
    return {
      attempted: false,
      supported: false,
      handled: false,
      scriptLabel: null,
      unsupportedOpcode: null,
    };
  }

  const compiled = COMPILED_BATTLE_SCRIPTS.get(scriptEntry.scriptLabel);
  if (!compiled) {
    return {
      attempted: false,
      supported: false,
      handled: false,
      scriptLabel: scriptEntry.scriptLabel,
      unsupportedOpcode: null,
    };
  }

  if (!compiled.supported) {
    return {
      attempted: true,
      supported: false,
      handled: false,
      scriptLabel: compiled.label,
      unsupportedOpcode: compiled.unsupportedOpcode,
    };
  }

  const state: BattleScriptRuntimeState = {
    halt: false,
    success: true,
  };

  for (const op of compiled.ops) {
    const handler = getBattleScriptCommandHandler(op.opcode);
    if (!handler) {
      return {
        attempted: true,
        supported: false,
        handled: false,
        scriptLabel: compiled.label,
        unsupportedOpcode: op.opcode,
      };
    }
    handler(op, { effectId }, state);
    if (state.halt) break;
  }

  // Runtime is integrated for progressive rollout; manual effect handlers remain authoritative for now.
  return {
    attempted: true,
    supported: true,
    handled: false,
    scriptLabel: compiled.label,
    unsupportedOpcode: null,
  };
}

export function isBattleScriptRuntimeSupported(effectId: number): boolean {
  const scriptEntry = BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID[effectId];
  if (!scriptEntry) return false;
  return COMPILED_BATTLE_SCRIPTS.get(scriptEntry.scriptLabel)?.supported === true;
}
