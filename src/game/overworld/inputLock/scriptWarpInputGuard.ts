import type { PlayerController } from '../../PlayerController.ts';

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
  if (shouldKeepInputLocked(guards)) return false;
  player.unlockInput();
  return true;
}
