/** Callback ports from public/pokeemerald/src/battle_anim_electric.c. */
import type { EffectFactory } from './types.ts';
import { placeOnMon, sin256 } from './projectiles.ts';
export const electricEffects: Readonly<Record<string, EffectFactory>> = {
  AnimTask_ElectricBolt: { children: ['gElectricBoltSegmentSpriteTemplate'], initialize(ctx, effect) {
    const target = ctx.resolve(1)!;
    effect.data[0] = target.x + ctx.args[0]; effect.data[1] = target.y + ctx.args[1]; effect.data[2] = ctx.args[2];
    effect.step = (context, self) => {
      const d = self.data, frame = d[10]++;
      if (frame === 10) { context.destroy(self); return; }
      if (frame % 2) return;
      const segment = frame / 2, wide = !!d[2], tile = (segment === 4 ? 0 : segment) * (wide ? 4 : 1) + (wide ? 8 : 0);
      context.spawnSprite('gElectricBoltSegmentSpriteTemplate', { x: d[0], y: d[1] + (segment + 1) * 16,
        width: wide ? 16 : 8, height: 16, tileOffset: tile, mode: d[2] });
    };
  } },
  AnimElectricBoltSegment: { children: [], initialize(ctx, effect) {
    effect.step = (context, self) => { if (++self.data[1] === 15) context.destroy(self); };
    effect.step(ctx, effect);
  } },
  AnimElectricity: { children: [], initialize(ctx, effect) {
    placeOnMon(ctx, effect, 1, false); const particle = effect.particle!;
    particle.tileOffset = ctx.args[3] * 4; particle.flipX = ctx.args[3] === 1; particle.flipY = ctx.args[3] === 2;
    effect.data[0] = ctx.args[2];
    effect.step = (context, self) => { if (self.data[0]-- <= 0) context.destroy(self); };
  } },
  AnimThunderboltOrb: { children: [], initialize(ctx, effect) {
    const target = ctx.resolve(1)!, particle = effect.particle!, d = effect.data;
    particle.x = target.x + ctx.args[1] * (target.side === 'player' ? -1 : 1); particle.y = target.pictureY + ctx.args[2];
    d[3] = ctx.args[0]; d[4] = d[5] = ctx.args[3];
    effect.step = (context, self) => {
      if (--self.data[5] === -1) { self.particle!.hidden = !self.particle!.hidden; self.data[5] = self.data[4]; }
      if (self.data[3]-- <= 0) context.destroy(self);
    };
  } },
  AnimSparkElectricityFlashing: { children: [], initialize(ctx, effect) {
    const mon = ctx.resolve(ctx.args[7] & 0x8000 ? 1 : 0)!, particle = effect.particle!, d = effect.data;
    particle.x = mon.x + ctx.args[0] * (mon.side === 'player' ? -1 : 1); particle.y = mon.pictureY + ctx.args[1];
    particle.tileOffset = ctx.args[6] * 4;
    d[0] = ctx.args[3]; d[4] = ctx.args[7] & 0x7fff; d[5] = ctx.args[2]; d[6] = ctx.args[5]; d[7] = ctx.args[4];
    effect.step = (context, self) => {
      const data = self.data;
      self.pose.x = sin256(data[7], data[5]); self.pose.y = sin256(data[7] + 64, data[5]);
      data[7] = (data[7] + data[6]) & 255;
      if (data[7] % data[4] === 0) self.particle!.hidden = !self.particle!.hidden;
      if (data[0]-- <= 0) context.destroy(self);
    };
    effect.step(ctx, effect);
  } },
};
