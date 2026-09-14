/** Scheduled cue port from public/pokeemerald/src/battle_anim_sound_tasks.c. Playback remains injected/silent. */
import type { EffectFactory } from './types.ts';
export const soundEffects: Readonly<Record<string, EffectFactory>> = {
  SoundTask_LoopSEAdjustPanning: { children: [], initialize(ctx, effect) {
    const d = effect.data, sign = ctx.resolve(0)!.side === 'player' ? 1 : -1;
    const pan = (value: number) => Math.max(-64, Math.min(63, value * sign));
    d[0] = ctx.args[0]; d[1] = pan(ctx.args[1]); d[2] = pan(ctx.args[2]);
    d[3] = Math.abs(ctx.args[3]) * Math.sign(d[2] - d[1]); d[4] = ctx.args[4]; d[5] = ctx.args[5]; d[6] = ctx.args[6];
    d[11] = d[1]; d[12] = d[6];
    effect.step = (context, self) => {
      const data = self.data;
      if (data[12]++ === data[6]) {
        data[12] = 0; context.sound({ kind: 'effect', id: data[0], pan: data[11] });
        if (--data[4] === 0) { context.destroy(self); return; }
      }
      if (data[10]++ === data[5]) { data[10] = 0; data[11] = Math.max(-64, Math.min(63, data[11] + data[3])); }
    };
    effect.step(ctx, effect);
  } },
};
