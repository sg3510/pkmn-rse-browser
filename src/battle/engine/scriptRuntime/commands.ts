import type { BattleScriptOp } from '../../../data/battleScripts.gen.ts';

export interface BattleScriptRuntimeState {
  halt: boolean;
  success: boolean;
}

export interface BattleScriptRuntimeContext {
  effectId: number;
}

export type BattleScriptCommandHandler = (
  op: BattleScriptOp,
  ctx: BattleScriptRuntimeContext,
  state: BattleScriptRuntimeState,
) => void;

const noop: BattleScriptCommandHandler = () => {};

const COMMAND_HANDLERS: Record<string, BattleScriptCommandHandler> = {
  attackcanceler: noop,
  accuracycheck: noop,
  ppreduce: noop,
  attackstring: noop,
  attackanimation: noop,
  waitanimation: noop,
  waitstate: noop,
  waitmessage: noop,
  resultmessage: noop,
  setmoveeffect: noop,
  seteffectprimary: noop,
  seteffectsecondary: noop,
  printstring: noop,
  printfromtable: noop,
  pause: noop,
  goto: noop,
  call: noop,
  return: noop,
  end: (_op, _ctx, state) => {
    state.halt = true;
  },
  end2: (_op, _ctx, state) => {
    state.halt = true;
  },
  jumpifbyte: noop,
  jumpifhalfword: noop,
  jumpifword: noop,
  jumpifstatus: noop,
  jumpifstatus2: noop,
  jumpifstatus3: noop,
  jumpifability: noop,
  jumpifabilitypresent: noop,
  jumpifnotmove: noop,
  jumpifmove: noop,
  jumpifnostatus3: noop,
  jumpifcantmakeasleep: noop,
  orword: noop,
  bicword: noop,
  setbyte: noop,
  setword: noop,
  sethword: noop,
  setbide: noop,
  setcharge: noop,
  settaunt: noop,
  settorment: noop,
  trywish: noop,
  setyawn: noop,
  stockpile: noop,
  stockpiletobasedamage: noop,
  stockpiletohpheal: noop,
  doubledamagedealtifdamaged: noop,
};

export function getBattleScriptCommandHandler(opcode: string): BattleScriptCommandHandler | undefined {
  return COMMAND_HANDLERS[opcode.toLowerCase()];
}

export function hasBattleScriptCommandHandler(opcode: string): boolean {
  return getBattleScriptCommandHandler(opcode) !== undefined;
}
