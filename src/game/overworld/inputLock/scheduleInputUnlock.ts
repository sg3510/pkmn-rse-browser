import type { PlayerController } from '../../PlayerController.ts';
import { FADE_TIMING } from '../../../field/types.ts';
import {
  tryUnlockInput,
  type ScriptWarpInputGuards,
} from './scriptWarpInputGuard.ts';

export interface InputUnlockGuards extends ScriptWarpInputGuards {}

export function scheduleInputUnlock(
  player: PlayerController,
  guards: InputUnlockGuards,
  delayMs: number = FADE_TIMING.DEFAULT_DURATION_MS
): void {
  setTimeout(() => {
    tryUnlockInput(player, guards);
  }, delayMs);
}
