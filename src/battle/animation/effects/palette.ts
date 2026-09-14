/** Palette and background ports from public/pokeemerald/src/battle_anim_normal.c,
 * battle_anim_utility_funcs.c and battle_anim_effects_3.c. */
import type { EffectContext, EffectFactory, EffectInstance } from './types.ts';
function blend(ctx: EffectContext, effect: EffectInstance, mask: number, cycles = 1): void {
  const d = effect.data;
  d[0] = mask; d[1] = Math.max(0, ctx.args[1]); d[2] = ctx.args[2]; d[3] = ctx.args[3]; d[4] = ctx.args[4];
  d[6] = cycles; d[7] = d[2];
  effect.step = (context, self) => {
    const data = self.data;
    if (data[5]++ < data[1]) return;
    data[5] = 0; context.setPalette(data[0], { amount: data[2] / 16, color: data[4] });
    if (data[2] === data[3]) {
      if (--data[6] <= 0) context.destroy(self);
      else { const end = data[7]; data[7] = data[3]; data[3] = data[6] === 1 ? 0 : end; }
    } else data[2] += Math.sign(data[3] - data[2]);
  };
  effect.step(ctx, effect);
}
export const paletteEffects: Readonly<Record<string, EffectFactory>> = {
  AnimTask_BlendBattleAnimPal: { children: [], initialize(ctx, effect) { blend(ctx, effect, ctx.args[0]); } },
  AnimSimplePaletteBlend: { children: [], initialize(ctx, effect) { blend(ctx, effect, ctx.args[0]); } },
  AnimTask_BlendBattleAnimPalExclude: { children: [], initialize(ctx, effect) {
    const role = ctx.args[0];
    if (role !== 0 && role !== 1) throw new Error(`Unsupported excluded palette role ${role}`);
    blend(ctx, effect, 7 & ~(2 << role));
  } },
  AnimTask_BlendColorCycle: { children: [], initialize(ctx, effect) {
    const args = [...ctx.args];
    // This callback's argument order differs from the simple palette fade.
    ctx.args[2] = args[3]; ctx.args[3] = args[4]; ctx.args[4] = args[5];
    blend(ctx, effect, args[0], args[2]); ctx.args.set(args);
  } },
  AnimTask_SetAllNonAttackersInvisiblity: { children: [], initialize(ctx, effect) {
    for (const mon of ctx.request.battlers) if (mon.slot !== ctx.request.attacker) ctx.setHidden(mon.slot, !!ctx.args[0]);
    ctx.destroy(effect);
  } },
  AnimTask_SetPsychicBackground: { children: [], initialize(_ctx, effect) {
    // C explicitly removes this persistent task from gAnimVisualTaskCount.
    effect.waitGroup = 'detached';
    effect.step = (ctx, self) => {
      if (++self.data[5] === 4) { ctx.cycleBackground(); self.data[5] = 0; }
      if (ctx.args[7] === -1) ctx.destroy(self);
    };
  } },
};
