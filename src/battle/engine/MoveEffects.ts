/**
 * Move effect dispatch table.
 *
 * Each effect handler receives the move context and produces events.
 * ~40 Tier 1+2 effects implemented, covering the vast majority of moves
 * encountered in early/mid-game.
 *
 * C ref: public/pokeemerald/include/constants/battle_move_effects.h (214 effects)
 * C ref: public/pokeemerald/src/battle_script_commands.c (implementations)
 */

import { MOVE_EFFECTS, getBattleMoveData } from '../../data/battleMoves.gen';
import { getMoveInfo, getMoveName } from '../../data/moves';
import { getTypeEffectiveness } from '../../data/typeEffectiveness.gen';
import { STATUS } from '../../pokemon/types';
import { battleRandomChance, battleRandomInt } from './BattleRng';
import type { BattlePokemon, BattleEvent, SideState, StatStageId } from './types';
import { isPhysicalType, clampStage, getAccuracyMultiplier } from './types';
import { calculateDamage, type DamageResult } from './DamageCalculator';
import { getBattlePokemonTypes } from './speciesTypes';
import { tryApplyStatus, applyConfusion, hasStatus } from './StatusEffects';
import { setWeather, getWeatherStartMessage, getWeatherAccuracyOverride } from './Weather';
import type { WeatherState } from './types';

export interface MoveContext {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  moveId: number;
  moveSlot: number;
  weather: WeatherState;
  attackerSide: SideState;
  defenderSide: SideState;
}

export interface MoveResult {
  events: BattleEvent[];
  /** Updated weather (if changed by the move). */
  weather?: WeatherState;
  /** Whether the move was successfully executed. */
  success: boolean;
}

/**
 * Execute a move with its effect. Returns battle events.
 */
export function executeMove(ctx: MoveContext): MoveResult {
  const { attacker, moveId } = ctx;
  const events: BattleEvent[] = [];
  const moveName = getMoveName(moveId);
  const moveInfo = getMoveInfo(moveId);
  const battleData = getBattleMoveData(moveId);
  const battler = attacker.isPlayer ? 0 : 1;

  events.push({
    type: 'message',
    battler,
    message: `${attacker.name} used ${moveName}!`,
  });

  // PP consumption
  consumePP(attacker, ctx.moveSlot);

  if (!moveInfo || !battleData) {
    events.push({ type: 'miss', battler, message: 'But it failed!' });
    return { events, success: false };
  }

  // Accuracy check (before effect)
  if (!checkAccuracy(ctx, events)) {
    return { events, success: false };
  }

  // Dispatch to effect handler
  const effect = battleData.effect;
  const handler = EFFECT_HANDLERS[effect];
  if (handler) {
    return handler(ctx, events);
  }

  // Default: plain damaging move (EFFECT_HIT = 0)
  if (moveInfo.power > 0) {
    return handleDamagingMove(ctx, events);
  }

  // Non-damaging move with no handler
  events.push({ type: 'message', battler, message: 'But nothing happened!' });
  return { events, success: false };
}

// ── Accuracy check ──

function checkAccuracy(ctx: MoveContext, events: BattleEvent[]): boolean {
  const { attacker, defender, moveId } = ctx;
  const moveInfo = getMoveInfo(moveId);
  if (!moveInfo) return false;

  let accuracy = moveInfo.accuracy;
  if (accuracy <= 0) return true; // always-hit moves

  // Weather accuracy overrides
  const weatherOverride = getWeatherAccuracyOverride(ctx.weather.type, moveId);
  if (weatherOverride !== null) accuracy = weatherOverride;

  // Apply accuracy/evasion stages
  const accMult = getAccuracyMultiplier(attacker.stages.accuracy, defender.stages.evasion);
  accuracy = Math.floor(accuracy * accMult);

  // Hustle: -20% accuracy on physical moves
  if (attacker.ability === 55 && isPhysicalType(moveInfo.type)) {
    accuracy = Math.floor(accuracy * 0.8);
  }

  const roll = battleRandomInt(1, 100);
  if (roll > accuracy) {
    events.push({
      type: 'miss',
      battler: attacker.isPlayer ? 0 : 1,
      message: `${attacker.name}'s attack missed!`,
    });
    return false;
  }
  return true;
}

// ── Generic damaging move handler ──

function handleDamagingMove(ctx: MoveContext, events: BattleEvent[]): MoveResult {
  const result = doDamage(ctx, events);
  return { events, success: result.damage > 0 || result.effectiveness === 0 };
}

interface DamageOptions {
  minRemainingHp?: number;
}

function doDamage(ctx: MoveContext, events: BattleEvent[], options: DamageOptions = {}): DamageResult {
  const { attacker, defender, moveId } = ctx;
  const result = calculateDamage({
    attacker,
    defender,
    moveId,
    weather: ctx.weather.type,
    attackerSide: ctx.attackerSide,
    defenderSide: ctx.defenderSide,
  });

  const defBattler = defender.isPlayer ? 0 : 1;

  if (result.effectiveness === 0) {
    events.push({
      type: 'effectiveness',
      battler: defBattler,
      value: 0,
      message: `It doesn't affect ${defender.name}...`,
    });
    return result;
  }

  const minRemainingHp = Math.max(0, options.minRemainingHp ?? 0);
  const maxDamage = Math.max(0, defender.currentHp - minRemainingHp);
  const appliedDamage = Math.min(result.damage, maxDamage);
  defender.currentHp = Math.max(0, defender.currentHp - appliedDamage);

  if (appliedDamage > 0) {
    events.push({
      type: 'damage',
      battler: defBattler,
      value: appliedDamage,
      moveId,
    });
  }

  if (result.critical) {
    events.push({ type: 'critical', battler: defBattler, message: 'A critical hit!' });
  }

  if (result.effectiveness > 1) {
    events.push({ type: 'effectiveness', battler: defBattler, value: result.effectiveness, message: "It's super effective!" });
  } else if (result.effectiveness < 1) {
    events.push({ type: 'effectiveness', battler: defBattler, value: result.effectiveness, message: "It's not very effective..." });
  }

  if (defender.currentHp <= 0) {
    events.push({ type: 'faint', battler: defBattler, message: `${defender.name} fainted!` });
  }

  return { ...result, damage: appliedDamage };
}

interface FixedDamageOptions {
  moveType?: string;
  minRemainingHp?: number;
}

function doFixedDamage(
  ctx: MoveContext,
  events: BattleEvent[],
  baseDamage: number,
  options: FixedDamageOptions = {},
): { success: boolean; damage: number } {
  const moveType = options.moveType;
  const [type1, type2] = getBattlePokemonTypes(ctx.defender);
  if (moveType && getTypeEffectiveness(moveType, type1, type2) === 0) {
    events.push({
      type: 'effectiveness',
      battler: ctx.defender.isPlayer ? 0 : 1,
      value: 0,
      message: `It doesn't affect ${ctx.defender.name}...`,
    });
    return { success: false, damage: 0 };
  }

  const minRemainingHp = Math.max(0, options.minRemainingHp ?? 0);
  const maxDamage = Math.max(0, ctx.defender.currentHp - minRemainingHp);
  const damage = Math.min(Math.max(0, baseDamage), maxDamage);
  ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - damage);

  if (damage > 0) {
    events.push({
      type: 'damage',
      battler: ctx.defender.isPlayer ? 0 : 1,
      value: damage,
    });
  }

  if (ctx.defender.currentHp <= 0) {
    events.push({
      type: 'faint',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} fainted!`,
    });
  }

  return { success: true, damage };
}

// ── Stat change helper ──

function applyStatChange(
  target: BattlePokemon,
  stat: StatStageId,
  amount: number,
  events: BattleEvent[],
): boolean {
  const oldStage = target.stages[stat];
  const newStage = clampStage(oldStage + amount);

  if (newStage === oldStage) {
    const dir = amount > 0 ? "won't go any higher" : "won't go any lower";
    events.push({
      type: 'stat_change',
      battler: target.isPlayer ? 0 : 1,
      value: 0,
      detail: stat,
      message: `${target.name}'s ${formatStatName(stat)} ${dir}!`,
    });
    return false;
  }

  target.stages[stat] = newStage;
  const diff = Math.abs(amount);
  const dir = amount > 0
    ? (diff >= 2 ? 'rose sharply!' : 'rose!')
    : (diff >= 2 ? 'harshly fell!' : 'fell!');

  events.push({
    type: 'stat_change',
    battler: target.isPlayer ? 0 : 1,
    value: amount,
    detail: stat,
    message: `${target.name}'s ${formatStatName(stat)} ${dir}`,
  });
  return true;
}

function formatStatName(stat: StatStageId): string {
  const names: Record<StatStageId, string> = {
    attack: 'ATTACK',
    defense: 'DEFENSE',
    speed: 'SPEED',
    spAttack: 'SP. ATK',
    spDefense: 'SP. DEF',
    accuracy: 'accuracy',
    evasion: 'evasiveness',
  };
  return names[stat];
}

// ── Effect Handlers ──

type EffectHandler = (ctx: MoveContext, events: BattleEvent[]) => MoveResult;

const EFFECT_HANDLERS: Record<number, EffectHandler> = {};

/** Register a handler for an effect ID. */
function registerEffect(effectId: number, handler: EffectHandler): void {
  EFFECT_HANDLERS[effectId] = handler;
}

// ── EFFECT_HIT (0) — Basic damage ──
registerEffect(MOVE_EFFECTS.EFFECT_HIT, (ctx, events) => {
  return handleDamagingMove(ctx, events);
});

// ── EFFECT_SLEEP (1) ──
registerEffect(MOVE_EFFECTS.EFFECT_SLEEP, (ctx, events) => {
  const success = tryApplyStatus(ctx.defender, STATUS.SLEEP, events);
  if (!success) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_POISON_HIT (2) — Damage + chance to poison ──
registerEffect(MOVE_EFFECTS.EFFECT_POISON_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      tryApplyStatus(ctx.defender, STATUS.POISON, events);
    }
  }
  return { events, success: true };
});

// ── EFFECT_ABSORB (3) — Damage + drain HP ──
registerEffect(MOVE_EFFECTS.EFFECT_ABSORB, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    const healAmount = Math.max(1, Math.floor(dmg.damage / 2));
    const actualHeal = Math.min(healAmount, ctx.attacker.maxHp - ctx.attacker.currentHp);
    ctx.attacker.currentHp += actualHeal;
    if (actualHeal > 0) {
      events.push({
        type: 'drain',
        battler: ctx.attacker.isPlayer ? 0 : 1,
        value: actualHeal,
        message: `${ctx.defender.name} had its energy drained!`,
      });
    }
  }
  return { events, success: true };
});

// ── EFFECT_BURN_HIT (4) — Damage + chance to burn ──
registerEffect(MOVE_EFFECTS.EFFECT_BURN_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      tryApplyStatus(ctx.defender, STATUS.BURN, events);
    }
  }
  return { events, success: true };
});

// ── EFFECT_FREEZE_HIT (5) — Damage + chance to freeze ──
registerEffect(MOVE_EFFECTS.EFFECT_FREEZE_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      tryApplyStatus(ctx.defender, STATUS.FREEZE, events);
    }
  }
  return { events, success: true };
});

// ── EFFECT_PARALYZE_HIT (6) — Damage + chance to paralyze ──
registerEffect(MOVE_EFFECTS.EFFECT_PARALYZE_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      tryApplyStatus(ctx.defender, STATUS.PARALYSIS, events);
    }
  }
  return { events, success: true };
});

// ── EFFECT_EXPLOSION (7) — Halve defense, damage, user faints ──
registerEffect(MOVE_EFFECTS.EFFECT_EXPLOSION, (ctx, events) => {
  // Halve defense for damage calculation
  const savedDef = ctx.defender.pokemon.stats.defense;
  ctx.defender.pokemon.stats.defense = Math.max(1, Math.floor(savedDef / 2));
  doDamage(ctx, events);
  ctx.defender.pokemon.stats.defense = savedDef;

  // User faints
  ctx.attacker.currentHp = 0;
  events.push({
    type: 'faint',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: `${ctx.attacker.name} fainted!`,
  });
  return { events, success: true };
});

// ── Stat-raising moves (10-16) ──
function makeStatUpHandler(stat: StatStageId, amount: number): EffectHandler {
  return (ctx, events) => {
    const success = applyStatChange(ctx.attacker, stat, amount, events);
    return { events, success };
  };
}

registerEffect(MOVE_EFFECTS.EFFECT_ATTACK_UP, makeStatUpHandler('attack', 1));
registerEffect(MOVE_EFFECTS.EFFECT_DEFENSE_UP, makeStatUpHandler('defense', 1));
registerEffect(MOVE_EFFECTS.EFFECT_SPEED_UP, makeStatUpHandler('speed', 1));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_ATTACK_UP, makeStatUpHandler('spAttack', 1));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_DEFENSE_UP, makeStatUpHandler('spDefense', 1));
registerEffect(MOVE_EFFECTS.EFFECT_ACCURACY_UP, makeStatUpHandler('accuracy', 1));
registerEffect(MOVE_EFFECTS.EFFECT_EVASION_UP, makeStatUpHandler('evasion', 1));

// ── Stat-lowering moves (18-24) ──
function makeStatDownHandler(stat: StatStageId, amount: number): EffectHandler {
  return (ctx, events) => {
    const success = applyStatChange(ctx.defender, stat, amount, events);
    return { events, success };
  };
}

registerEffect(MOVE_EFFECTS.EFFECT_ATTACK_DOWN, makeStatDownHandler('attack', -1));
registerEffect(MOVE_EFFECTS.EFFECT_DEFENSE_DOWN, makeStatDownHandler('defense', -1));
registerEffect(MOVE_EFFECTS.EFFECT_SPEED_DOWN, makeStatDownHandler('speed', -1));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_ATTACK_DOWN, makeStatDownHandler('spAttack', -1));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_DEFENSE_DOWN, makeStatDownHandler('spDefense', -1));
registerEffect(MOVE_EFFECTS.EFFECT_ACCURACY_DOWN, makeStatDownHandler('accuracy', -1));
registerEffect(MOVE_EFFECTS.EFFECT_EVASION_DOWN, makeStatDownHandler('evasion', -1));

// ── +2 stat changes (50-56) ──
registerEffect(MOVE_EFFECTS.EFFECT_ATTACK_UP_2, makeStatUpHandler('attack', 2));
registerEffect(MOVE_EFFECTS.EFFECT_DEFENSE_UP_2, makeStatUpHandler('defense', 2));
registerEffect(MOVE_EFFECTS.EFFECT_SPEED_UP_2, makeStatUpHandler('speed', 2));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_ATTACK_UP_2, makeStatUpHandler('spAttack', 2));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_DEFENSE_UP_2, makeStatUpHandler('spDefense', 2));
registerEffect(MOVE_EFFECTS.EFFECT_ACCURACY_UP_2, makeStatUpHandler('accuracy', 2));
registerEffect(MOVE_EFFECTS.EFFECT_EVASION_UP_2, makeStatUpHandler('evasion', 2));

// ── -2 stat changes (58-64) ──
registerEffect(MOVE_EFFECTS.EFFECT_ATTACK_DOWN_2, makeStatDownHandler('attack', -2));
registerEffect(MOVE_EFFECTS.EFFECT_DEFENSE_DOWN_2, makeStatDownHandler('defense', -2));
registerEffect(MOVE_EFFECTS.EFFECT_SPEED_DOWN_2, makeStatDownHandler('speed', -2));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_ATTACK_DOWN_2, makeStatDownHandler('spAttack', -2));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_DEFENSE_DOWN_2, makeStatDownHandler('spDefense', -2));
registerEffect(MOVE_EFFECTS.EFFECT_ACCURACY_DOWN_2, makeStatDownHandler('accuracy', -2));
registerEffect(MOVE_EFFECTS.EFFECT_EVASION_DOWN_2, makeStatDownHandler('evasion', -2));

// ── Damage + stat down hit (68-74) ──
function makeDamageStatDownHitHandler(stat: StatStageId): EffectHandler {
  return (ctx, events) => {
    const dmg = doDamage(ctx, events);
    if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
      const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
      if (chance > 0 && battleRandomInt(1, 100) <= chance) {
        applyStatChange(ctx.defender, stat, -1, events);
      }
    }
    return { events, success: true };
  };
}

registerEffect(MOVE_EFFECTS.EFFECT_ATTACK_DOWN_HIT, makeDamageStatDownHitHandler('attack'));
registerEffect(MOVE_EFFECTS.EFFECT_DEFENSE_DOWN_HIT, makeDamageStatDownHitHandler('defense'));
registerEffect(MOVE_EFFECTS.EFFECT_SPEED_DOWN_HIT, makeDamageStatDownHitHandler('speed'));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_ATTACK_DOWN_HIT, makeDamageStatDownHitHandler('spAttack'));
registerEffect(MOVE_EFFECTS.EFFECT_SPECIAL_DEFENSE_DOWN_HIT, makeDamageStatDownHitHandler('spDefense'));
registerEffect(MOVE_EFFECTS.EFFECT_ACCURACY_DOWN_HIT, makeDamageStatDownHitHandler('accuracy'));
registerEffect(MOVE_EFFECTS.EFFECT_EVASION_DOWN_HIT, makeDamageStatDownHitHandler('evasion'));

// ── EFFECT_FLINCH_HIT (31) — Damage + chance to flinch ──
registerEffect(MOVE_EFFECTS.EFFECT_FLINCH_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      ctx.defender.volatile.flinch = true;
    }
  }
  return { events, success: true };
});

// ── EFFECT_MULTI_HIT (29) — Hit 2-5 times ──
registerEffect(MOVE_EFFECTS.EFFECT_MULTI_HIT, (ctx, events) => {
  // GBA distribution: 2(37.5%), 3(37.5%), 4(12.5%), 5(12.5%)
  const roll = battleRandomInt(1, 8);
  let hitCount: number;
  if (roll <= 3) hitCount = 2;
  else if (roll <= 6) hitCount = 3;
  else if (roll === 7) hitCount = 4;
  else hitCount = 5;

  let totalDamage = 0;
  for (let i = 0; i < hitCount; i++) {
    if (ctx.defender.currentHp <= 0) break;
    const dmg = doDamage(ctx, events);
    totalDamage += dmg.damage;
  }
  events.push({
    type: 'message',
    message: `Hit ${hitCount} time(s)!`,
  });
  return { events, success: totalDamage > 0 };
});

// ── EFFECT_DOUBLE_HIT (44) — Hit exactly 2 times ──
registerEffect(MOVE_EFFECTS.EFFECT_DOUBLE_HIT, (ctx, events) => {
  let totalDamage = 0;
  for (let i = 0; i < 2; i++) {
    if (ctx.defender.currentHp <= 0) break;
    const dmg = doDamage(ctx, events);
    totalDamage += dmg.damage;
  }
  events.push({ type: 'message', message: 'Hit 2 time(s)!' });
  return { events, success: totalDamage > 0 };
});

// ── EFFECT_HIGH_CRITICAL (43) — Higher crit ratio (already in DamageCalc) ──
registerEffect(MOVE_EFFECTS.EFFECT_HIGH_CRITICAL, (ctx, events) => {
  return handleDamagingMove(ctx, events);
});

// ── EFFECT_RECOIL (48) — Damage + 1/4 recoil ──
registerEffect(MOVE_EFFECTS.EFFECT_RECOIL, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    const recoil = Math.max(1, Math.floor(dmg.damage / 4));
    ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - recoil);
    events.push({
      type: 'recoil',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      value: recoil,
      message: `${ctx.attacker.name} is damaged by recoil!`,
    });
    if (ctx.attacker.currentHp <= 0) {
      events.push({
        type: 'faint',
        battler: ctx.attacker.isPlayer ? 0 : 1,
        message: `${ctx.attacker.name} fainted!`,
      });
    }
  }
  return { events, success: true };
});

// ── EFFECT_DOUBLE_EDGE (198) — Damage + 1/3 recoil ──
registerEffect(MOVE_EFFECTS.EFFECT_DOUBLE_EDGE, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    const recoil = Math.max(1, Math.floor(dmg.damage / 3));
    ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - recoil);
    events.push({
      type: 'recoil',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      value: recoil,
      message: `${ctx.attacker.name} is damaged by recoil!`,
    });
    if (ctx.attacker.currentHp <= 0) {
      events.push({
        type: 'faint',
        battler: ctx.attacker.isPlayer ? 0 : 1,
        message: `${ctx.attacker.name} fainted!`,
      });
    }
  }
  return { events, success: true };
});

// ── EFFECT_CONFUSE (49) ──
registerEffect(MOVE_EFFECTS.EFFECT_CONFUSE, (ctx, events) => {
  const success = applyConfusion(ctx.defender, events);
  if (!success) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_CONFUSE_HIT (76) — Damage + chance to confuse ──
registerEffect(MOVE_EFFECTS.EFFECT_CONFUSE_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      applyConfusion(ctx.defender, events);
    }
  }
  return { events, success: true };
});

// ── EFFECT_POISON (66) ──
registerEffect(MOVE_EFFECTS.EFFECT_POISON, (ctx, events) => {
  const success = tryApplyStatus(ctx.defender, STATUS.POISON, events);
  if (!success) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_PARALYZE (67) ──
registerEffect(MOVE_EFFECTS.EFFECT_PARALYZE, (ctx, events) => {
  const success = tryApplyStatus(ctx.defender, STATUS.PARALYSIS, events);
  if (!success) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_TOXIC (33) ──
registerEffect(MOVE_EFFECTS.EFFECT_TOXIC, (ctx, events) => {
  const success = tryApplyStatus(ctx.defender, STATUS.TOXIC, events);
  if (!success) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_WILL_O_WISP (167) ──
registerEffect(MOVE_EFFECTS.EFFECT_WILL_O_WISP, (ctx, events) => {
  const success = tryApplyStatus(ctx.defender, STATUS.BURN, events);
  if (!success) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_HAZE (25) — Reset all stat stages ──
registerEffect(MOVE_EFFECTS.EFFECT_HAZE, (ctx, events) => {
  const reset = (mon: BattlePokemon) => {
    mon.stages.attack = 0;
    mon.stages.defense = 0;
    mon.stages.speed = 0;
    mon.stages.spAttack = 0;
    mon.stages.spDefense = 0;
    mon.stages.accuracy = 0;
    mon.stages.evasion = 0;
  };
  reset(ctx.attacker);
  reset(ctx.defender);
  events.push({ type: 'message', message: 'All stat changes were eliminated!' });
  return { events, success: true };
});

// ── EFFECT_RESTORE_HP (32) — Recover/Softboiled: heal 50% ──
registerEffect(MOVE_EFFECTS.EFFECT_RESTORE_HP, (ctx, events) => {
  const healAmount = Math.floor(ctx.attacker.maxHp / 2);
  const actual = Math.min(healAmount, ctx.attacker.maxHp - ctx.attacker.currentHp);
  if (actual <= 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attacker.currentHp += actual;
  events.push({
    type: 'heal',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    value: actual,
    message: `${ctx.attacker.name} regained health!`,
  });
  return { events, success: true };
});

// ── EFFECT_REST (37) — Full heal + sleep 2 turns ──
registerEffect(MOVE_EFFECTS.EFFECT_REST, (ctx, events) => {
  if (ctx.attacker.currentHp >= ctx.attacker.maxHp) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  const heal = ctx.attacker.maxHp - ctx.attacker.currentHp;
  ctx.attacker.currentHp = ctx.attacker.maxHp;
  ctx.attacker.pokemon.status = 3; // sleep 3 turns (wakes on turn 3)
  events.push({
    type: 'heal',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    value: heal,
    message: `${ctx.attacker.name} went to sleep and became healthy!`,
  });
  return { events, success: true };
});

// ── EFFECT_PROTECT (111) ──
registerEffect(MOVE_EFFECTS.EFFECT_PROTECT, (ctx, events) => {
  // Successive uses have decreasing chance: 1/1, 1/2, 1/4, 1/8, ...
  const count = ctx.attacker.volatile.protectSuccessCount;
  const chance = count === 0 ? 1 : Math.pow(0.5, count);
  if (battleRandomChance(chance)) {
    ctx.attacker.volatile.protect = true;
    ctx.attacker.volatile.protectSuccessCount++;
    events.push({ type: 'message', message: `${ctx.attacker.name} protected itself!` });
    return { events, success: true };
  }
  events.push({ type: 'message', message: 'But it failed!' });
  return { events, success: false };
});

// ── EFFECT_REFLECT (65) ──
registerEffect(MOVE_EFFECTS.EFFECT_REFLECT, (ctx, events) => {
  if (ctx.attackerSide.reflect > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attackerSide.reflect = 5;
  events.push({ type: 'message', message: `${ctx.attacker.name}'s team raised Reflect!` });
  return { events, success: true };
});

// ── EFFECT_LIGHT_SCREEN (35) ──
registerEffect(MOVE_EFFECTS.EFFECT_LIGHT_SCREEN, (ctx, events) => {
  if (ctx.attackerSide.lightScreen > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attackerSide.lightScreen = 5;
  events.push({ type: 'message', message: `${ctx.attacker.name}'s team raised Light Screen!` });
  return { events, success: true };
});

// ── EFFECT_FOCUS_ENERGY (47) ──
registerEffect(MOVE_EFFECTS.EFFECT_FOCUS_ENERGY, (ctx, events) => {
  if (ctx.attacker.volatile.focusEnergy) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attacker.volatile.focusEnergy = true;
  events.push({ type: 'message', message: `${ctx.attacker.name} is getting pumped!` });
  return { events, success: true };
});

// ── Weather moves ──

registerEffect(MOVE_EFFECTS.EFFECT_RAIN_DANCE, (ctx, events) => {
  const newWeather = setWeather(ctx.weather, 'rain', false);
  events.push({ type: 'weather_change', message: getWeatherStartMessage('rain'), detail: 'rain' });
  return { events, weather: newWeather, success: true };
});

registerEffect(MOVE_EFFECTS.EFFECT_SUNNY_DAY, (ctx, events) => {
  const newWeather = setWeather(ctx.weather, 'sun', false);
  events.push({ type: 'weather_change', message: getWeatherStartMessage('sun'), detail: 'sun' });
  return { events, weather: newWeather, success: true };
});

registerEffect(MOVE_EFFECTS.EFFECT_SANDSTORM, (ctx, events) => {
  const newWeather = setWeather(ctx.weather, 'sandstorm', false);
  events.push({ type: 'weather_change', message: getWeatherStartMessage('sandstorm'), detail: 'sandstorm' });
  return { events, weather: newWeather, success: true };
});

registerEffect(MOVE_EFFECTS.EFFECT_HAIL, (ctx, events) => {
  const newWeather = setWeather(ctx.weather, 'hail', false);
  events.push({ type: 'weather_change', message: getWeatherStartMessage('hail'), detail: 'hail' });
  return { events, weather: newWeather, success: true };
});

// ── EFFECT_OHKO (38) — One-hit KO (Fissure, Sheer Cold, etc.) ──
registerEffect(MOVE_EFFECTS.EFFECT_OHKO, (ctx, events) => {
  // Can't hit if defender is higher level
  if (ctx.defender.pokemon.level > ctx.attacker.pokemon.level) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defender.currentHp = 0;
  events.push({
    type: 'damage',
    battler: ctx.defender.isPlayer ? 0 : 1,
    value: ctx.defender.maxHp,
    message: "It's a one-hit KO!",
  });
  events.push({
    type: 'faint',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} fainted!`,
  });
  return { events, success: true };
});

// ── EFFECT_SUPER_FANG (40) — Halve HP ──
registerEffect(MOVE_EFFECTS.EFFECT_SUPER_FANG, (ctx, events) => {
  const damage = Math.max(1, Math.floor(ctx.defender.currentHp / 2));
  const result = doFixedDamage(ctx, events, damage, { moveType: 'NORMAL' });
  return { events, success: result.success };
});

// ── EFFECT_DRAGON_RAGE (41) — Fixed 40 damage ──
registerEffect(MOVE_EFFECTS.EFFECT_DRAGON_RAGE, (ctx, events) => {
  const result = doFixedDamage(ctx, events, 40, { moveType: 'DRAGON' });
  return { events, success: result.success };
});

// ── EFFECT_SONICBOOM (130) — Fixed 20 damage ──
registerEffect(MOVE_EFFECTS.EFFECT_SONICBOOM, (ctx, events) => {
  const result = doFixedDamage(ctx, events, 20, { moveType: 'NORMAL' });
  return { events, success: result.success };
});

// ── EFFECT_LEVEL_DAMAGE (87) — Damage = level (Night Shade, Seismic Toss) ──
registerEffect(MOVE_EFFECTS.EFFECT_LEVEL_DAMAGE, (ctx, events) => {
  const moveInfo = getMoveInfo(ctx.moveId);
  const moveType = moveInfo?.type ?? 'NORMAL';
  const result = doFixedDamage(ctx, events, ctx.attacker.pokemon.level, { moveType });
  return { events, success: result.success };
});

// ── EFFECT_FALSE_SWIPE (101) — Cannot KO (leave at 1 HP) ──
registerEffect(MOVE_EFFECTS.EFFECT_FALSE_SWIPE, (ctx, events) => {
  const dmg = doDamage(ctx, events, { minRemainingHp: 1 });
  return { events, success: dmg.effectiveness !== 0 };
});

// ── EFFECT_TRAP (42) — Damage + trap 4-5 turns (Wrap, Bind, etc.) ──
registerEffect(MOVE_EFFECTS.EFFECT_TRAP, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0 && ctx.defender.volatile.trapped === 0) {
    ctx.defender.volatile.trapped = battleRandomInt(4, 5);
    events.push({
      type: 'message',
      message: `${ctx.defender.name} was trapped!`,
    });
  }
  return { events, success: true };
});

// ── EFFECT_LEECH_SEED (84) ──
registerEffect(MOVE_EFFECTS.EFFECT_LEECH_SEED, (ctx, events) => {
  const defTypes = getBattlePokemonTypes(ctx.defender);
  if (defTypes.includes('GRASS')) {
    events.push({ type: 'message', message: `It doesn't affect ${ctx.defender.name}...` });
    return { events, success: false };
  }
  if (ctx.defender.volatile.leechSeed) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defender.volatile.leechSeed = true;
  events.push({ type: 'message', message: `${ctx.defender.name} was seeded!` });
  return { events, success: true };
});

// ── EFFECT_SPLASH (85) ──
registerEffect(MOVE_EFFECTS.EFFECT_SPLASH, (_ctx, events) => {
  events.push({ type: 'message', message: 'But nothing happened!' });
  return { events, success: false };
});

// ── EFFECT_THAW_HIT (125) — Fire moves that thaw frozen target ──
registerEffect(MOVE_EFFECTS.EFFECT_THAW_HIT, (ctx, events) => {
  // Thaw target if frozen
  if (hasStatus(ctx.defender, STATUS.FREEZE)) {
    ctx.defender.pokemon.status = STATUS.NONE;
    events.push({
      type: 'thaw',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} thawed out!`,
    });
  }
  const dmg = doDamage(ctx, events);
  // Chance to burn
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      tryApplyStatus(ctx.defender, STATUS.BURN, events);
    }
  }
  return { events, success: true };
});

// ── EFFECT_TRI_ATTACK (36) — Damage + 20% chance: burn/freeze/paralyze ──
registerEffect(MOVE_EFFECTS.EFFECT_TRI_ATTACK, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      const effect = battleRandomInt(1, 3);
      if (effect === 1) tryApplyStatus(ctx.defender, STATUS.BURN, events);
      else if (effect === 2) tryApplyStatus(ctx.defender, STATUS.FREEZE, events);
      else tryApplyStatus(ctx.defender, STATUS.PARALYSIS, events);
    }
  }
  return { events, success: true };
});

// ── Combo stat moves ──

// EFFECT_DEFENSE_UP_HIT (138) — Damage + raise own defense
registerEffect(MOVE_EFFECTS.EFFECT_DEFENSE_UP_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance === 0 || battleRandomInt(1, 100) <= chance) {
      applyStatChange(ctx.attacker, 'defense', 1, events);
    }
  }
  return { events, success: true };
});

// EFFECT_ATTACK_UP_HIT (139) — Damage + raise own attack
registerEffect(MOVE_EFFECTS.EFFECT_ATTACK_UP_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance === 0 || battleRandomInt(1, 100) <= chance) {
      applyStatChange(ctx.attacker, 'attack', 1, events);
    }
  }
  return { events, success: true };
});

// EFFECT_ALL_STATS_UP_HIT (140) — AncientPower etc: chance to +1 all stats
registerEffect(MOVE_EFFECTS.EFFECT_ALL_STATS_UP_HIT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    const chance = getBattleMoveData(ctx.moveId)?.secondaryEffectChance ?? 0;
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      applyStatChange(ctx.attacker, 'attack', 1, events);
      applyStatChange(ctx.attacker, 'defense', 1, events);
      applyStatChange(ctx.attacker, 'speed', 1, events);
      applyStatChange(ctx.attacker, 'spAttack', 1, events);
      applyStatChange(ctx.attacker, 'spDefense', 1, events);
    }
  }
  return { events, success: true };
});

// EFFECT_SUPERPOWER (182) — Damage + lower own attack and defense
registerEffect(MOVE_EFFECTS.EFFECT_SUPERPOWER, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    applyStatChange(ctx.attacker, 'attack', -1, events);
    applyStatChange(ctx.attacker, 'defense', -1, events);
  }
  return { events, success: true };
});

// EFFECT_OVERHEAT (204) — Damage + lower own SpAtk by 2
registerEffect(MOVE_EFFECTS.EFFECT_OVERHEAT, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0) {
    applyStatChange(ctx.attacker, 'spAttack', -2, events);
  }
  return { events, success: true };
});

// EFFECT_DRAGON_DANCE (212)
registerEffect(MOVE_EFFECTS.EFFECT_DRAGON_DANCE, (ctx, events) => {
  applyStatChange(ctx.attacker, 'attack', 1, events);
  applyStatChange(ctx.attacker, 'speed', 1, events);
  return { events, success: true };
});

// EFFECT_CALM_MIND (211)
registerEffect(MOVE_EFFECTS.EFFECT_CALM_MIND, (ctx, events) => {
  applyStatChange(ctx.attacker, 'spAttack', 1, events);
  applyStatChange(ctx.attacker, 'spDefense', 1, events);
  return { events, success: true };
});

// EFFECT_BULK_UP (208)
registerEffect(MOVE_EFFECTS.EFFECT_BULK_UP, (ctx, events) => {
  applyStatChange(ctx.attacker, 'attack', 1, events);
  applyStatChange(ctx.attacker, 'defense', 1, events);
  return { events, success: true };
});

// EFFECT_COSMIC_POWER (206)
registerEffect(MOVE_EFFECTS.EFFECT_COSMIC_POWER, (ctx, events) => {
  applyStatChange(ctx.attacker, 'defense', 1, events);
  applyStatChange(ctx.attacker, 'spDefense', 1, events);
  return { events, success: true };
});

// EFFECT_TICKLE (205)
registerEffect(MOVE_EFFECTS.EFFECT_TICKLE, (ctx, events) => {
  applyStatChange(ctx.defender, 'attack', -1, events);
  applyStatChange(ctx.defender, 'defense', -1, events);
  return { events, success: true };
});

// EFFECT_SWAGGER (118) — Confuse + raise attack by 2
registerEffect(MOVE_EFFECTS.EFFECT_SWAGGER, (ctx, events) => {
  applyStatChange(ctx.defender, 'attack', 2, events);
  applyConfusion(ctx.defender, events);
  return { events, success: true };
});

// EFFECT_FLATTER (166) — Confuse + raise SpAtk by 1
registerEffect(MOVE_EFFECTS.EFFECT_FLATTER, (ctx, events) => {
  applyStatChange(ctx.defender, 'spAttack', 1, events);
  applyConfusion(ctx.defender, events);
  return { events, success: true };
});

// EFFECT_FACADE (169) — Double power when statused
registerEffect(MOVE_EFFECTS.EFFECT_FACADE, (ctx, events) => {
  // Facade doubles power when burned/poisoned/paralyzed — handled by
  // temporarily doubling move power before damage calc
  return handleDamagingMove(ctx, events);
});

// EFFECT_BRICK_BREAK (186) — Remove screens, then damage
registerEffect(MOVE_EFFECTS.EFFECT_BRICK_BREAK, (ctx, events) => {
  if (ctx.defenderSide.reflect > 0 || ctx.defenderSide.lightScreen > 0) {
    ctx.defenderSide.reflect = 0;
    ctx.defenderSide.lightScreen = 0;
    events.push({ type: 'message', message: `${ctx.attacker.name} shattered the wall!` });
  }
  return handleDamagingMove(ctx, events);
});

// EFFECT_QUICK_ATTACK (103) — Priority handled in turn order, otherwise normal hit
registerEffect(MOVE_EFFECTS.EFFECT_QUICK_ATTACK, (ctx, events) => {
  return handleDamagingMove(ctx, events);
});

// EFFECT_ALWAYS_HIT (17) — Moves that never miss (Swift, etc.)
registerEffect(MOVE_EFFECTS.EFFECT_ALWAYS_HIT, (ctx, events) => {
  return handleDamagingMove(ctx, events);
});

// ── Utility ──

function consumePP(attacker: BattlePokemon, moveSlot: number): void {
  if (moveSlot >= 0 && moveSlot < 4) {
    attacker.pokemon.pp[moveSlot] = Math.max(0, attacker.pokemon.pp[moveSlot] - 1) as 0;
  }
}
