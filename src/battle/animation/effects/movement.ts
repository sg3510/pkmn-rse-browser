/** Ports from public/pokeemerald/src/battle_anim_mon_movement.c and battle_anim_mons.c. */
import { sin256 } from './projectiles.ts';
import type { EffectContext, EffectFactory, EffectInstance } from './types.ts';
function lungeStep(ctx: EffectContext, effect: EffectInstance): void {
  const data = effect.data;
  if (effect.phase === 1) {
    data[0] = data[4]; data[1] = -data[1]; effect.phase = 2;
  } else if (effect.phase === 3) {
    ctx.destroy(effect);
  } else if (data[0] > 0) {
    data[0]--; effect.pose.x += data[1];
  } else {
    effect.phase++; // SetCallbackToStoredInData6 does not invoke the callback yet.
  }
}
const horizontalLunge: EffectFactory = {
  children: [],
  initialize(ctx, effect) {
    const mon = ctx.resolve(0);
    if (!mon) { ctx.destroy(effect); return; }
    effect.slot = mon.slot;
    effect.data[0] = effect.data[4] = ctx.args[0];
    effect.data[1] = ctx.args[1] * (mon.side === 'player' ? 1 : -1);
    effect.step = lungeStep;
  },
};
function shakeStep(ctx: EffectContext, effect: EffectInstance): void {
  const d = effect.data;
  if (d[3] > 0) { d[3]--; return; }
  effect.pose.x = effect.pose.x === d[4] ? (d[6] ? -d[4] : 0) : d[4];
  effect.pose.y = effect.pose.y === d[5] ? (d[6] ? -d[5] : 0) : d[5];
  d[3] = d[2];
  if (--d[1] <= 0) ctx.destroy(effect);
}
function shake(alternate: boolean): EffectFactory {
  return { children: [], initialize(ctx, effect) {
    const mon = ctx.resolve(ctx.args[0]);
    if (!mon) { ctx.destroy(effect); return; }
    effect.slot = mon.slot;
    effect.pose.x = effect.data[4] = ctx.args[1]; effect.pose.y = effect.data[5] = ctx.args[2];
    effect.data[1] = ctx.args[3]; effect.data[2] = effect.data[3] = ctx.args[4];
    effect.data[6] = alternate ? 1 : 0;
    effect.step = shakeStep;
    shakeStep(ctx, effect); // The C initialization explicitly calls the step once.
  } };
}
export const movementEffects: Readonly<Record<string, EffectFactory>> = {
  AnimTask_TranslateMonEllipticalRespectSide: { children: [], initialize(ctx, effect) {
    const mon = ctx.resolve(ctx.args[0])!; effect.slot = mon.slot;
    const d = effect.data;
    d[1] = ctx.args[1] * (ctx.resolve(0)!.side === 'player' ? 1 : -1);
    d[2] = ctx.args[2]; d[3] = ctx.args[3]; d[4] = 1 << Math.min(5, ctx.args[4]);
    effect.step = (context, self) => {
      const data = self.data;
      self.pose.x = sin256(data[5], data[1]); self.pose.y = data[2] - sin256(data[5] + 64, data[2]);
      data[5] = (data[5] + data[4]) & 255;
      if (data[5] === 0 && --data[3] === 0) context.destroy(self);
    }; effect.step(ctx, effect);
  } },
  AnimTask_ScaleMonAndRestore: { children: [], initialize(ctx, effect) {
    effect.slot = ctx.resolve(ctx.args[3])!.slot;
    const d = effect.data; d[0] = ctx.args[0]; d[1] = ctx.args[1]; d[2] = d[3] = ctx.args[2]; d[10] = d[11] = 256;
    effect.step = (context, self) => {
      const data = self.data; data[10] += data[0]; data[11] += data[1];
      self.pose.scaleX = 256 / data[10]; self.pose.scaleY = 256 / data[11];
      if (--data[2] === 0) {
        if (data[3]) { data[0] *= -1; data[1] *= -1; data[2] = data[3]; data[3] = 0; }
        else context.destroy(self);
      }
    };
  } },
  DoHorizontalLunge: horizontalLunge, AnimTask_ShakeMon: shake(false), AnimTask_ShakeMon2: shake(true),
};
