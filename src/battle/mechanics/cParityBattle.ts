/**
 * C-parity helper math for battle capture/EXP/IV flows.
 *
 * C refs:
 * - public/pokeemerald/src/battle_script_commands.c (Cmd_handleballthrow, Cmd_getexp)
 * - public/pokeemerald/src/battle_main.c (CreateNPCTrainerParty)
 * - public/pokeemerald/src/battle_message.c (gBallEscapeStringIds)
 */

import { ITEMS } from '../../data/items.ts';
import { getItemBattleEffect, HOLD_EFFECTS } from '../../data/itemBattleEffects.gen.ts';
import { STATUS } from '../../pokemon/types.ts';

export const BALL_SHAKES_SUCCESS = 3;

export interface CaptureBallContext {
  itemId: number;
  targetLevel: number;
  targetTypes: readonly string[];
  isUnderwater: boolean;
  speciesCaughtBefore: boolean;
  battleTurnCounter: number;
}

export interface CatchOddsContext {
  catchRate: number;
  ballMultiplierTenths: number;
  targetHp: number;
  targetMaxHp: number;
  targetStatus: number;
}

export interface CaptureShakeContext {
  itemId: number;
  odds: number;
  randomU16: () => number;
}

export interface CaptureShakeResult {
  caught: boolean;
  shakes: 0 | 1 | 2 | 3;
}

export interface FaintExpDistributionPartySlot {
  isPresent: boolean;
  level: number;
  hp: number;
  heldItem: number;
  participated: boolean;
}

export interface FaintExpDistributionContext {
  baseExpYield: number;
  faintedLevel: number;
  trainerBattle: boolean;
  party: readonly FaintExpDistributionPartySlot[];
}

export function scaleTrainerIvToBattleIv(rawIv: number): number {
  const iv = Number.isFinite(rawIv) ? Math.trunc(rawIv) : 0;
  const clamped = Math.max(0, Math.min(255, iv));
  return Math.floor((clamped * 31) / 255);
}

export function resolveBallMultiplierTenths(ctx: CaptureBallContext): number {
  switch (ctx.itemId) {
    case ITEMS.ITEM_ULTRA_BALL:
      return 20;
    case ITEMS.ITEM_GREAT_BALL:
      return 15;
    case ITEMS.ITEM_POKE_BALL:
      return 10;
    case ITEMS.ITEM_SAFARI_BALL:
      return 15;
    case ITEMS.ITEM_NET_BALL:
      return ctx.targetTypes.includes('WATER') || ctx.targetTypes.includes('BUG') ? 30 : 10;
    case ITEMS.ITEM_DIVE_BALL:
      return ctx.isUnderwater ? 35 : 10;
    case ITEMS.ITEM_NEST_BALL: {
      if (ctx.targetLevel < 40) {
        const scaled = 40 - ctx.targetLevel;
        return scaled <= 9 ? 10 : scaled;
      }
      return 10;
    }
    case ITEMS.ITEM_REPEAT_BALL:
      return ctx.speciesCaughtBefore ? 30 : 10;
    case ITEMS.ITEM_TIMER_BALL:
      return Math.min(40, Math.max(10, Math.trunc(ctx.battleTurnCounter) + 10));
    case ITEMS.ITEM_LUXURY_BALL:
    case ITEMS.ITEM_PREMIER_BALL:
      return 10;
    default:
      return 10;
  }
}

export function calculateCatchOdds(ctx: CatchOddsContext): number {
  const safeMaxHp = Math.max(1, Math.trunc(ctx.targetMaxHp));
  const hp = Math.max(0, Math.min(safeMaxHp, Math.trunc(ctx.targetHp)));
  const catchRate = Math.max(1, Math.trunc(ctx.catchRate));
  const ballMultiplierTenths = Math.max(1, Math.trunc(ctx.ballMultiplierTenths));

  let odds = Math.floor((catchRate * ballMultiplierTenths) / 10);
  odds = Math.floor((odds * ((safeMaxHp * 3) - (hp * 2))) / (3 * safeMaxHp));

  if ((ctx.targetStatus & (STATUS.SLEEP | STATUS.FREEZE)) !== 0) {
    odds *= 2;
  } else if ((ctx.targetStatus & (STATUS.POISON | STATUS.BURN | STATUS.PARALYSIS | STATUS.TOXIC)) !== 0) {
    odds = Math.floor((odds * 15) / 10);
  }

  return odds;
}

export function resolveCaptureShakes(ctx: CaptureShakeContext): CaptureShakeResult {
  if (ctx.itemId === ITEMS.ITEM_MASTER_BALL) {
    return { caught: true, shakes: BALL_SHAKES_SUCCESS };
  }

  if (ctx.odds > 254) {
    return { caught: true, shakes: BALL_SHAKES_SUCCESS };
  }

  if (ctx.odds <= 0) {
    return { caught: false, shakes: 0 };
  }

  const shakeDivisor = Math.sqrt(Math.sqrt(16711680 / ctx.odds));
  const shakeOdds = Math.floor(1048560 / Math.max(1, shakeDivisor));

  let shakes: 0 | 1 | 2 | 3 = 0;
  while (shakes < BALL_SHAKES_SUCCESS) {
    if (ctx.randomU16() >= shakeOdds) {
      break;
    }
    shakes = (shakes + 1) as 0 | 1 | 2 | 3;
  }

  return { caught: shakes === BALL_SHAKES_SUCCESS, shakes };
}

export function getBallEscapeMessage(shakes: 0 | 1 | 2 | 3): string {
  switch (shakes) {
    case 0:
      return 'Oh no! The POKeMON broke free!';
    case 1:
      return 'Aww! It appeared to be caught!';
    case 2:
      return 'Aargh! Almost had it!';
    default:
      return 'Shoot! It was so close, too!';
  }
}

export function calculateFaintExpAward(
  baseExpYield: number,
  faintedLevel: number,
  options: { trainerBattle: boolean; luckyEgg: boolean },
): number {
  let exp = Math.floor((Math.max(0, baseExpYield) * Math.max(1, faintedLevel)) / 7);
  if (exp <= 0) exp = 1;

  if (options.luckyEgg) {
    exp = Math.floor((exp * 150) / 100);
  }
  if (options.trainerBattle) {
    exp = Math.floor((exp * 150) / 100);
  }

  return Math.max(1, exp);
}

/**
 * C-parity EXP distribution for an enemy faint.
 *
 * Mirrors Cmd_getexp sent-in/Exp Share split:
 * - If any Exp Share holders exist, base exp is split 50/50:
 *   sent-in side / Exp Share side.
 * - Sent-in share is divided among sent-in mons that are alive/present.
 * - Exp Share share is divided among alive/present Exp Share holders.
 * - A mon that both participated and holds Exp Share gets both portions.
 * - Lucky Egg multiplier is applied before trainer-battle multiplier.
 *
 * C refs:
 * - public/pokeemerald/src/battle_script_commands.c (Cmd_getexp)
 */
export function calculateFaintExpDistribution(
  context: FaintExpDistributionContext
): number[] {
  const calculatedExp = Math.floor(
    (Math.max(0, context.baseExpYield) * Math.max(1, context.faintedLevel)) / 7
  );

  let viaSentIn = 0;
  let viaExpShare = 0;

  for (const slot of context.party) {
    if (!slot.isPresent || slot.hp <= 0) continue;
    if (slot.participated) {
      viaSentIn++;
    }

    const holdEffect = getItemBattleEffect(slot.heldItem)?.holdEffect;
    if (holdEffect === HOLD_EFFECTS.HOLD_EFFECT_EXP_SHARE) {
      viaExpShare++;
    }
  }

  let sentInExp = 0;
  let expShareExp = 0;

  if (viaExpShare > 0) {
    sentInExp = viaSentIn > 0 ? Math.floor(Math.floor(calculatedExp / 2) / viaSentIn) : 0;
    if (sentInExp === 0) sentInExp = 1;

    expShareExp = Math.floor(Math.floor(calculatedExp / 2) / viaExpShare);
    if (expShareExp === 0) expShareExp = 1;
  } else {
    sentInExp = viaSentIn > 0 ? Math.floor(calculatedExp / viaSentIn) : 0;
    if (sentInExp === 0) sentInExp = 1;
  }

  return context.party.map((slot) => {
    if (!slot.isPresent || slot.hp <= 0 || slot.level >= 100) {
      return 0;
    }

    const holdEffect = getItemBattleEffect(slot.heldItem)?.holdEffect;
    const receivesViaExpShare = holdEffect === HOLD_EFFECTS.HOLD_EFFECT_EXP_SHARE;
    const receivesViaParticipation = slot.participated;

    if (!receivesViaExpShare && !receivesViaParticipation) {
      return 0;
    }

    let exp = receivesViaParticipation ? sentInExp : 0;
    if (receivesViaExpShare) {
      exp += expShareExp;
    }

    if (holdEffect === HOLD_EFFECTS.HOLD_EFFECT_LUCKY_EGG) {
      exp = Math.floor((exp * 150) / 100);
    }
    if (context.trainerBattle) {
      exp = Math.floor((exp * 150) / 100);
    }

    return Math.max(1, exp);
  });
}
