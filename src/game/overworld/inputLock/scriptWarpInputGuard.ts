import type { PlayerController } from '../../PlayerController.ts';
import { isDebugMode } from '../../../utils/debug.ts';

// C parity reference:
// - public/pokeemerald/src/scrcmd.c (ScrCmd_lockall / ScrCmd_releaseall / waitstate + warp commands)
// - public/pokeemerald/src/event_object_lock.c (freeze/unfreeze ownership)
interface MutableRef<T> {
  current: T;
}

export interface ScriptWarpInputGuards {
  warpingRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  dialogIsOpenRef: MutableRef<boolean>;
  pendingScriptedWarpRef?: MutableRef<unknown | null>;
  mapEntryCutsceneGateRef?: MutableRef<boolean>;
}

function buildGuardState(guards: ScriptWarpInputGuards): string {
  const warping = guards.warpingRef.current === true;
  const script = guards.storyScriptRunningRef.current === true;
  const dialog = guards.dialogIsOpenRef.current === true;
  const pendingWarp = (guards.pendingScriptedWarpRef?.current ?? null) !== null;
  const mapEntryGate = guards.mapEntryCutsceneGateRef?.current === true;
  return [
    `warping=${warping ? 1 : 0}`,
    `script=${script ? 1 : 0}`,
    `dialog=${dialog ? 1 : 0}`,
    `pendingWarp=${pendingWarp ? 1 : 0}`,
    `mapEntryGate=${mapEntryGate ? 1 : 0}`,
  ].join(' ');
}

let lastInputGuardDebugSignature: string | null = null;

function logInputGuardDebug(prefix: 'keep locked' | 'unlock', guards: ScriptWarpInputGuards): void {
  if (!isDebugMode('field')) return;
  const signature = `${prefix} ${buildGuardState(guards)}`;
  if (lastInputGuardDebugSignature === signature) return;
  lastInputGuardDebugSignature = signature;
  console.log(`[INPUT_GUARD] ${signature}`);
}

export function shouldKeepInputLocked(guards: ScriptWarpInputGuards): boolean {
  if (guards.warpingRef.current) return true;
  if (guards.storyScriptRunningRef.current) return true;
  if (guards.dialogIsOpenRef.current) return true;
  if ((guards.pendingScriptedWarpRef?.current ?? null) !== null) return true;
  if (guards.mapEntryCutsceneGateRef?.current === true) return true;
  return false;
}

export function tryUnlockInput(
  player: PlayerController | null | undefined,
  guards: ScriptWarpInputGuards
): boolean {
  if (!player) return false;
  if (shouldKeepInputLocked(guards)) {
    logInputGuardDebug('keep locked', guards);
    return false;
  }
  logInputGuardDebug('unlock', guards);
  player.unlockInput();
  return true;
}
