/** Ports: public/pokeemerald/src/battle_anim_normal.c, battle_anim_effects_3.c, battle_anim_sound_tasks.c. */
import { FrameAnimation } from '../runtime/FrameAnimation.ts';
import type { EffectFactory } from './types.ts';
export const normalEffects: Readonly<Record<string, EffectFactory>> = {
  AnimHitSplatBasic: { children: [], initialize(ctx, effect, template) {
    const mon = ctx.resolve(ctx.args[2] === 0 ? 0 : 1);
    if (!mon || !template || !effect.particle) { ctx.destroy(effect); return; }
    const attacker = ctx.resolve(0)!;
    effect.particle.x = mon.x + ctx.args[0] * (attacker.side === 'player' ? 1 : -1);
    effect.particle.y = mon.pictureY + ctx.args[1];
    const affine = template.affineFrames[ctx.args[3]];
    if (!affine) throw new Error(`Missing affine animation ${ctx.args[3]}`);
    effect.affine = new FrameAnimation(affine, true);
    effect.step = (context, self) => {
      if (self.phase === 1) context.destroy(self);
      else if (self.affine?.ended) self.phase = 1;
    };
  } },
  AnimRoarNoiseLine: { children: [], initialize(ctx, effect, template) {
    const mon = ctx.resolve(0);
    if (!mon || !template || !effect.particle) { ctx.destroy(effect); return; }
    const sign = mon.side === 'player' ? 1 : -1;
    // The source mutates shared gBattleAnimArgs, not just a private copy.
    if (sign < 0) ctx.args[0] = -ctx.args[0];
    effect.particle.x = mon.x + ctx.args[0]; effect.particle.y = mon.y + ctx.args[1];
    effect.particle.flipX = sign < 0; effect.particle.flipY = ctx.args[2] === 1;
    effect.data[0] = 0x280 * sign;
    effect.data[1] = ctx.args[2] === 0 ? -0x280 : ctx.args[2] === 1 ? 0x280 : 0;
    if (ctx.args[2] !== 0 && ctx.args[2] !== 1) effect.frames = new FrameAnimation(template.frames[1]);
    effect.step = (context, self) => {
      const d = self.data; d[6] += d[0]; d[7] += d[1];
      // Positions are fixed point; keep the base coordinates separate from x2/y2.
      self.pose.x = d[6] >> 8; self.pose.y = d[7] >> 8;
      if (++d[5] === 14) context.destroy(self);
    };
  } },
  SoundTask_PlayDoubleCry: { children: [], initialize(ctx, effect) {
    const mon = ctx.resolve(ctx.args[0]);
    if (!mon) { ctx.destroy(effect); return; }
    effect.data[0] = ctx.args[1]; effect.data[1] = mon.species;
    effect.data[2] = ctx.resolve(0)?.side === 'player' ? -64 : 63;
    const mode = ctx.args[1] === 255 ? 9 : 7;
    ctx.sound({ kind: 'cry', id: mon.species, pan: effect.data[2], mode });
    effect.step = (context, self) => {
      if (self.data[9] < 2) { self.data[9]++; return; }
      if (!context.criesComplete()) return;
      context.sound({ kind: 'cry', id: self.data[1], pan: self.data[2], mode: self.data[0] === 255 ? 10 : 8 });
      context.destroy(self);
    };
  } },
  SoundTask_WaitForCry: { children: [], initialize(ctx, effect) {
    effect.step = (context, self) => {
      if (self.data[9] < 2) self.data[9]++;
      else if (context.criesComplete()) context.destroy(self);
    };
    effect.step(ctx, effect);
  } },
};
