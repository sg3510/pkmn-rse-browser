/** Adapter for the attackanimation/waitanimation pair in public/pokeemerald/data/battle_scripts_1.s. */
import type { BattleEvent } from '../engine/types.ts';
import type { AnimationHandle } from '../animation/types.ts';
import type { AnimationPlayer } from '../animation/runtime/AnimationPlayer.ts';
import { createAnimationBattler } from '../animation/scene/BattleAnimationScene.ts';
import type { BattleMessageEntry } from './BattlePresentationSequence.ts';
export function createMoveAnimationStep(event: BattleEvent, player: AnimationPlayer, host: {
  enabled: () => boolean;
  identity: (slot: 0 | 1) => string | undefined;
}): { entry: BattleMessageEntry; played: () => boolean } {
  let handle: AnimationHandle | null = null;
  let reportedFailure = false;
  const data = event.presentation;
  return {
    played: () => handle?.status === 'completed',
    entry: { step: { kind: 'animation', start: () => {
      if (!data || event.moveId === undefined || data.phase !== 'execute') return;
      if (data.before.some((mon) => host.identity(mon.slot) !== mon.identity)) return;
      handle = player.start({ moveId: event.moveId, attacker: data.attacker, target: data.target,
        seed: data.actionId, battlers: data.before.map((mon) => createAnimationBattler(mon.slot, mon.species, mon.identity)) }, host.enabled());
    }, complete: () => {
      if (handle?.status === 'failed' && !reportedFailure) {
        reportedFailure = true; console.warn('[BattleAnimation] Playback failed; continuing presentation:', handle.reason);
      }
      return !handle || !['loading', 'running'].includes(handle.status);
    } } },
  };
}
