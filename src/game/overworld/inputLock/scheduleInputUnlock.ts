import type { PlayerController } from '../../PlayerController.ts';
import { FADE_TIMING } from '../../../field/types.ts';

interface MutableRef<T> {
  current: T;
}

export interface InputUnlockGuards {
  warpingRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  dialogIsOpenRef: MutableRef<boolean>;
}

export function scheduleInputUnlock(
  player: PlayerController,
  guards: InputUnlockGuards,
  delayMs: number = FADE_TIMING.DEFAULT_DURATION_MS
): void {
  setTimeout(() => {
    if (
      !guards.warpingRef.current
      && !guards.storyScriptRunningRef.current
      && !guards.dialogIsOpenRef.current
    ) {
      player.unlockInput();
    }
  }, delayMs);
}
