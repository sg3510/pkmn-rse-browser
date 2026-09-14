/** Ports from public/pokeemerald/src/battle_anim_mons.c, battle_anim_fire.c, battle_anim_water.c,
 * battle_anim_effects_1.c and battle_anim_ghost.c. Fixed-point translation never uses battle RNG. */
import type { EffectContext, EffectFactory, EffectInstance } from './types.ts';
import { BATTLE_ANIMATION_SINE } from '../../../data/battleAnimationPrograms.gen.ts';
export const sin256 = (angle: number, amplitude: number): number => (BATTLE_ANIMATION_SINE[angle & 255] * amplitude) >> 8;
export function placeOnMon(ctx: EffectContext, effect: EffectInstance, role: number, picture = true): void {
  const mon = ctx.resolve(role)!;
  const sign = ctx.resolve(0)!.x > ctx.resolve(1)!.x ? -1 : 1;
  effect.particle!.x = mon.x + ctx.args[0] * sign;
  effect.particle!.y = (picture ? mon.pictureY : mon.y) + ctx.args[1];
}
function linear(effect: EffectInstance, endX: number, endY: number, duration: number, arc = 0, followup = true): void {
  const node = effect.particle!, d = effect.data;
  if (duration <= 0) throw new Error('Invalid projectile duration');
  d[0] = duration;
  const delta = (value: number) => (Math.trunc((Math.abs(value) << 8) / duration) & ~1) | Number(value < 0);
  d[1] = delta(endX - node.x); d[2] = delta(endY - node.y); d[3] = d[4] = 0;
  d[5] = arc; d[6] = Math.trunc(0x8000 / duration); d[7] = 0;
  effect.step = (ctx, self) => {
    const data = self.data;
    if (!data[0]) {
      if (followup && self.phase === 0) { self.phase = 1; return; }
      ctx.destroy(self); return;
    }
    data[3] += data[1]; data[4] += data[2];
    self.pose.x = (data[1] & 1 ? -1 : 1) * ((data[3] & 0xffff) >> 8);
    self.pose.y = (data[2] & 1 ? -1 : 1) * ((data[4] & 0xffff) >> 8);
    data[7] += data[6]; self.pose.y += sin256(data[7] >> 8, data[5]); data[0]--;
  };
}
export const projectileEffects: Readonly<Record<string, EffectFactory>> = {
  AnimSpriteOnMonPos: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, ctx.args[2] ? 1 : 0, !ctx.args[3]);
    effect.step = (context, self) => { if (self.frames?.ended || self.affine?.ended) context.destroy(self); };
  } },
  TranslateAnimSpriteToTargetMonLocation: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, 0, !(ctx.args[5] & 0xff00));
    const target = ctx.resolve(1)!;
    if (ctx.resolve(0)!.side === 'opponent') ctx.args[2] = -ctx.args[2];
    linear(effect, target.x + ctx.args[2], (ctx.args[5] & 255 ? target.y : target.pictureY) + ctx.args[3], ctx.args[4]);
  } },
  AnimEmberFlare: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, 1, !ctx.args[6]);
    const mon = ctx.resolve(ctx.args[5])!;
    if (ctx.resolve(0)!.side === 'opponent') ctx.args[2] = -ctx.args[2];
    linear(effect, mon.x + ctx.args[2], (ctx.args[6] ? mon.y : mon.pictureY) + ctx.args[3], ctx.args[4]);
  } },
  AnimThrowProjectile: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, 0);
    const target = ctx.resolve(1)!;
    if (ctx.resolve(0)!.side === 'opponent') ctx.args[2] = -ctx.args[2];
    linear(effect, target.x + ctx.args[2], target.pictureY + ctx.args[3], ctx.args[4], ctx.args[5], false);
  } },
  AnimWaterGunDroplet: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, 1);
    // The source uses arg4 for both vertical distance and duration (not arg3).
    linear(effect, effect.particle!.x + ctx.args[2], effect.particle!.y + ctx.args[4], ctx.args[4]);
  } },
  AnimAbsorptionOrb: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, 1); const attacker = ctx.resolve(0)!;
    linear(effect, attacker.x, attacker.pictureY, ctx.args[3], ctx.args[2], false);
  } },
  AnimShadowBall: { children: [], initialize(ctx, effect) {
    const target = ctx.resolve(1)!, attacker = ctx.resolve(0)!, d = effect.data, node = effect.particle!;
    node.x = attacker.x; node.y = attacker.pictureY;
    d[1] = ctx.args[0]; d[2] = ctx.args[1]; d[3] = ctx.args[2];
    d[4] = node.x << 4; d[5] = node.y << 4;
    d[6] = Math.trunc(((target.x - node.x) << 4) / (d[1] * 2));
    d[7] = Math.trunc(((target.pictureY - node.y) << 4) / (d[1] * 2));
    effect.step = (context, self) => {
      const data = self.data, particle = self.particle!;
      if (self.phase === 0 || self.phase === 2) {
        data[4] += data[6]; data[5] += data[7]; particle.x = data[4] >> 4; particle.y = data[5] >> 4;
        const counter = self.phase === 0 ? 1 : 3;
        if (--data[counter] <= 0) {
          if (self.phase === 2) { particle.x = target.x; particle.y = target.pictureY; }
          self.phase++;
        }
      } else if (self.phase === 1) {
        if (--data[2] > 0) return;
        data[4] = particle.x << 4; data[5] = particle.y << 4;
        data[6] = Math.trunc(((target.x - particle.x) << 4) / data[3]);
        data[7] = Math.trunc(((target.pictureY - particle.y) << 4) / data[3]); self.phase = 2;
      } else context.destroy(self);
    };
  } },
};
