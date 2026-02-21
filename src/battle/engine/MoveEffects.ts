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

import {
  MOVE_EFFECTS,
  MOVE_FLAGS,
  MOVE_TARGETS,
  getBattleMoveData,
} from '../../data/battleMoves.gen.ts';
import { BATTLE_MOVE_EFFECT_IDS, BATTLE_MOVE_EFFECT_INDEX } from '../../data/battleMoveEffects.gen.ts';
import { ABILITIES } from '../../data/abilities.ts';
import { getMoveInfo, getMoveName, MOVES } from '../../data/moves.ts';
import { getTypeEffectiveness } from '../../data/typeEffectiveness.gen.ts';
import { STATUS } from '../../pokemon/types.ts';
import { battleRandomChance, battleRandomInt } from './BattleRng.ts';
import type { BattlePokemon, BattleEvent, SideState, StatStageId } from './types.ts';
import { isPhysicalType, clampStage, getAccuracyMultiplier } from './types.ts';
import { calculateDamage, type DamageResult } from './DamageCalculator.ts';
import { getBattlePokemonTypes } from './speciesTypes.ts';
import { tryApplyStatus, applyConfusion, hasStatus } from './StatusEffects.ts';
import { setWeather, getWeatherStartMessage, getWeatherAccuracyOverride } from './Weather.ts';
import type { WeatherState } from './types.ts';
import { executeBattleScriptForMoveEffect } from './scriptRuntime/BattleScriptRuntime.ts';

export interface MoveContext {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  moveId: number;
  moveSlot: number;
  battleType?: 'wild' | 'trainer';
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

export interface MoveEffectCoverageEntry {
  effectId: number;
  effectName: string;
  scriptLabel: string | null;
  implemented: boolean;
  moveCount: number;
  moveIds: number[];
}

export interface MoveEffectCoverageReport {
  totalDefinedEffects: number;
  totalReferencedEffects: number;
  implementedEffects: number;
  implementedReferencedEffects: number;
  aliasReferencedEffects: number;
  resolvedReferencedEffects: number;
  missingReferencedEffects: MoveEffectCoverageEntry[];
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
  const effect = battleData?.effect ?? MOVE_EFFECTS.EFFECT_HIT;
  const battler = attacker.isPlayer ? 0 : 1;

  events.push({
    type: 'message',
    battler,
    message: `${attacker.name} used ${moveName}!`,
  });

  if (!moveInfo || !battleData) {
    events.push({ type: 'miss', battler, message: 'But it failed!' });
    return { events, success: false };
  }

  if (effect !== MOVE_EFFECTS.EFFECT_FURY_CUTTER) {
    attacker.volatile.furyCutter = 0;
  }

  if (shouldConsumePp(ctx, effect)) {
    consumePP(attacker, ctx.moveSlot);
  }

  if (isMoveBlockedByProtect(ctx, battleData, effect)) {
    events.push({
      type: 'message',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} protected itself!`,
    });
    return { events, success: false };
  }

  // Accuracy check (before effect)
  if (shouldRunAccuracyCheck(ctx, effect) && !checkAccuracy(ctx, events)) {
    if (effect === MOVE_EFFECTS.EFFECT_RECOIL_IF_MISS) {
      applyMissRecoil(ctx, events);
    }
    if (
      effect === MOVE_EFFECTS.EFFECT_SEMI_INVULNERABLE
      && attacker.volatile.chargeMove === moveId
    ) {
      attacker.volatile.chargeMove = MOVES.NONE;
      attacker.volatile.semiInvulnerableMove = MOVES.NONE;
    }
    if (effect === MOVE_EFFECTS.EFFECT_ROLLOUT) {
      attacker.volatile.rollout = 0;
    }
    if (effect === MOVE_EFFECTS.EFFECT_FURY_CUTTER) {
      attacker.volatile.furyCutter = 0;
    }
    return { events, success: false };
  }

  // Dispatch to effect handler
  executeBattleScriptForMoveEffect(effect);

  const handler = resolveEffectHandler(effect);
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

function isMoveBlockedByProtect(
  ctx: MoveContext,
  battleData: NonNullable<ReturnType<typeof getBattleMoveData>>,
  effect: number,
): boolean {
  // Spit Up handles Protect in-script while still consuming stockpiles.
  if (effect === MOVE_EFFECTS.EFFECT_SPIT_UP) return false;
  if (!ctx.defender.volatile.protect) return false;
  if ((battleData.flags & MOVE_FLAGS.FLAG_PROTECT_AFFECTED) === 0) return false;
  if (battleData.target === MOVE_TARGETS.USER || battleData.target === MOVE_TARGETS.OPPONENTS_FIELD) return false;
  return true;
}

function shouldRunAccuracyCheck(ctx: MoveContext, moveEffect: number): boolean {
  if (moveEffect === MOVE_EFFECTS.EFFECT_BIDE) {
    return false;
  }
  if (
    moveEffect === MOVE_EFFECTS.EFFECT_FOCUS_PUNCH
    && ctx.attacker.volatile.tookDamageThisTurn
  ) {
    return false;
  }
  if (isTwoTurnChargingEffect(moveEffect) && isChargingFirstTurn(ctx, moveEffect)) {
    return false;
  }
  return true;
}

// ── Accuracy check ──

function checkAccuracy(ctx: MoveContext, events: BattleEvent[]): boolean {
  const { attacker, defender, moveId } = ctx;
  const moveInfo = getMoveInfo(moveId);
  if (!moveInfo) return false;

  if (
    attacker.volatile.lockOnTurns > 0
    && attacker.volatile.lockOnTargetIsPlayer !== null
    && attacker.volatile.lockOnTargetIsPlayer === defender.isPlayer
  ) {
    return true;
  }

  if (
    defender.volatile.semiInvulnerableMove !== MOVES.NONE
    && !canHitSemiInvulnerableTarget(moveId, defender.volatile.semiInvulnerableMove)
  ) {
    events.push({
      type: 'miss',
      battler: attacker.isPlayer ? 0 : 1,
      message: `${attacker.name}'s attack missed!`,
    });
    return false;
  }

  let accuracy = moveInfo.accuracy;
  if (accuracy <= 0) return true; // always-hit moves

  // Weather accuracy overrides
  const weatherOverride = getWeatherAccuracyOverride(ctx.weather.type, moveId);
  if (weatherOverride !== null) accuracy = weatherOverride;

  // Apply accuracy/evasion stages
  const ignoreAccuracyStages = defender.volatile.foresight;
  const accMult = ignoreAccuracyStages
    ? 1
    : getAccuracyMultiplier(attacker.stages.accuracy, defender.stages.evasion);
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

function canHitSemiInvulnerableTarget(moveId: number, semiInvulnerableMoveId: number): boolean {
  if (semiInvulnerableMoveId === MOVES.NONE) return true;
  if (semiInvulnerableMoveId === MOVES.DIG) {
    return moveId === MOVES.EARTHQUAKE || moveId === MOVES.MAGNITUDE;
  }
  if (semiInvulnerableMoveId === MOVES.DIVE) {
    return moveId === MOVES.SURF || moveId === MOVES.WHIRLPOOL;
  }
  if (semiInvulnerableMoveId === MOVES.FLY || semiInvulnerableMoveId === MOVES.BOUNCE) {
    return moveId === MOVES.GUST || moveId === MOVES.TWISTER;
  }
  return false;
}

function dealsDoubleDamageToSemiInvulnerableTarget(moveId: number, semiInvulnerableMoveId: number): boolean {
  if (semiInvulnerableMoveId === MOVES.DIG) {
    return moveId === MOVES.EARTHQUAKE || moveId === MOVES.MAGNITUDE;
  }
  if (semiInvulnerableMoveId === MOVES.DIVE) {
    return moveId === MOVES.SURF || moveId === MOVES.WHIRLPOOL;
  }
  if (semiInvulnerableMoveId === MOVES.FLY || semiInvulnerableMoveId === MOVES.BOUNCE) {
    return moveId === MOVES.GUST || moveId === MOVES.TWISTER;
  }
  return false;
}

function applyMissRecoil(ctx: MoveContext, events: BattleEvent[]): void {
  const recoil = Math.max(1, Math.floor(ctx.attacker.maxHp / 2));
  const actualRecoil = Math.min(recoil, ctx.attacker.currentHp);
  ctx.attacker.currentHp = Math.max(0, ctx.attacker.currentHp - actualRecoil);
  events.push({
    type: 'recoil',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    value: actualRecoil,
    message: `${ctx.attacker.name} kept going and crashed!`,
  });
  if (ctx.attacker.currentHp <= 0) {
    events.push({
      type: 'faint',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: `${ctx.attacker.name} fainted!`,
    });
  }
}

// ── Generic damaging move handler ──

function handleDamagingMove(ctx: MoveContext, events: BattleEvent[]): MoveResult {
  const result = doDamage(ctx, events);
  return { events, success: result.damage > 0 || result.effectiveness === 0 };
}

interface DamageOptions {
  minRemainingHp?: number;
  powerOverride?: number;
}

function doDamage(ctx: MoveContext, events: BattleEvent[], options: DamageOptions = {}): DamageResult {
  const { attacker, defender, moveId } = ctx;
  const result = calculateDamage({
    attacker,
    defender,
    moveId,
    powerOverride: options.powerOverride,
    ignoreNormalFightGhostImmunity: defender.volatile.foresight,
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

  const hpBefore = defender.currentHp;
  const endureActive = defender.volatile.endure;
  const minRemainingHp = Math.max(0, options.minRemainingHp ?? 0, endureActive ? 1 : 0);
  const maxDamage = Math.max(0, defender.currentHp - minRemainingHp);
  let computedDamage = result.damage;
  if (ctx.attacker.volatile.chargeTurns > 0 && (getMoveInfo(moveId)?.type ?? '') === 'ELECTRIC') {
    computedDamage = Math.max(1, computedDamage * 2);
  }
  if (dealsDoubleDamageToSemiInvulnerableTarget(moveId, defender.volatile.semiInvulnerableMove)) {
    computedDamage = Math.max(1, computedDamage * 2);
  }
  const appliedDamage = Math.min(computedDamage, maxDamage);
  defender.currentHp = Math.max(0, defender.currentHp - appliedDamage);

  if (appliedDamage > 0) {
    events.push({
      type: 'damage',
      battler: defBattler,
      value: appliedDamage,
      moveId,
    });
    recordDamageTaken(defender, attacker, appliedDamage);
  }

  const enduredHit = endureActive
    && hpBefore > 1
    && computedDamage >= hpBefore
    && defender.currentHp === 1;
  if (enduredHit) {
    events.push({
      type: 'message',
      battler: defBattler,
      message: `${defender.name} endured the hit!`,
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

  const hpBefore = ctx.defender.currentHp;
  const endureActive = ctx.defender.volatile.endure;
  const minRemainingHp = Math.max(0, options.minRemainingHp ?? 0, endureActive ? 1 : 0);
  const maxDamage = Math.max(0, ctx.defender.currentHp - minRemainingHp);
  const damage = Math.min(Math.max(0, baseDamage), maxDamage);
  ctx.defender.currentHp = Math.max(0, ctx.defender.currentHp - damage);

  if (damage > 0) {
    events.push({
      type: 'damage',
      battler: ctx.defender.isPlayer ? 0 : 1,
      value: damage,
    });
    recordDamageTaken(ctx.defender, ctx.attacker, damage);
  }

  const enduredHit = endureActive
    && hpBefore > 1
    && baseDamage >= hpBefore
    && ctx.defender.currentHp === 1;
  if (enduredHit) {
    events.push({
      type: 'message',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} endured the hit!`,
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

function recordDamageTaken(target: BattlePokemon, source: BattlePokemon, damage: number): void {
  if (damage <= 0) return;
  target.volatile.tookDamageThisTurn = true;
  target.volatile.lastDamageTaken = damage;
  target.volatile.lastDamagedByIsPlayer = source.isPlayer;

  if (target.volatile.bide > 0) {
    target.volatile.bideDamage += damage;
    target.volatile.bideTargetIsPlayer = source.isPlayer;
  }
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

function tryApplyStatusWithSafeguard(
  ctx: MoveContext,
  status: number,
  events: BattleEvent[],
): boolean {
  if (ctx.defenderSide.safeguard > 0) {
    events.push({
      type: 'message',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} is protected by Safeguard!`,
    });
    return false;
  }
  return tryApplyStatus(ctx.defender, status, events);
}

function applyDefenderStatDrop(
  ctx: MoveContext,
  stat: StatStageId,
  amount: number,
  events: BattleEvent[],
): boolean {
  if (ctx.defenderSide.mist > 0) {
    events.push({
      type: 'message',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} is protected by Mist!`,
    });
    return false;
  }
  return applyStatChange(ctx.defender, stat, amount, events);
}

const PROTECT_LIKE_SUCCESS_RATES = [1, 1 / 2, 1 / 4, 1 / 8] as const;

function applyProtectLike(ctx: MoveContext, events: BattleEvent[], kind: 'protect' | 'endure'): MoveResult {
  const count = Math.max(0, ctx.attacker.volatile.protectSuccessCount | 0);
  const index = Math.min(count, PROTECT_LIKE_SUCCESS_RATES.length - 1);
  const chance = PROTECT_LIKE_SUCCESS_RATES[index];
  if (!battleRandomChance(chance)) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  if (kind === 'protect') {
    ctx.attacker.volatile.protect = true;
    events.push({ type: 'message', message: `${ctx.attacker.name} protected itself!` });
  } else {
    ctx.attacker.volatile.endure = true;
    events.push({ type: 'message', message: `${ctx.attacker.name} braced itself!` });
  }
  ctx.attacker.volatile.protectSuccessCount++;
  return { events, success: true };
}

const TWO_TURN_CHARGING_EFFECTS = new Set<number>([
  MOVE_EFFECTS.EFFECT_SEMI_INVULNERABLE,
  MOVE_EFFECTS.EFFECT_RAZOR_WIND,
  MOVE_EFFECTS.EFFECT_SKY_ATTACK,
  MOVE_EFFECTS.EFFECT_SKULL_BASH,
  MOVE_EFFECTS.EFFECT_SOLAR_BEAM,
]);

function isTwoTurnChargingEffect(moveEffect: number): boolean {
  return TWO_TURN_CHARGING_EFFECTS.has(moveEffect);
}

function shouldSolarBeamSkipCharge(ctx: MoveContext): boolean {
  if (ctx.moveId !== MOVES.SOLAR_BEAM) return false;
  const abilityCancelsSun =
    ctx.attacker.ability === ABILITIES.CLOUD_NINE
    || ctx.attacker.ability === ABILITIES.AIR_LOCK
    || ctx.defender.ability === ABILITIES.CLOUD_NINE
    || ctx.defender.ability === ABILITIES.AIR_LOCK;
  if (abilityCancelsSun) return false;
  return ctx.weather.type === 'sun';
}

function isChargingFirstTurn(ctx: MoveContext, moveEffect: number): boolean {
  if (!isTwoTurnChargingEffect(moveEffect)) return false;
  if (moveEffect === MOVE_EFFECTS.EFFECT_SOLAR_BEAM && shouldSolarBeamSkipCharge(ctx)) {
    return false;
  }
  return ctx.attacker.volatile.chargeMove !== ctx.moveId;
}

function beginChargingTurn(
  ctx: MoveContext,
  events: BattleEvent[],
  message: string,
): MoveResult {
  ctx.attacker.volatile.chargeMove = ctx.moveId;
  if (ctx.moveId === MOVES.FLY || ctx.moveId === MOVES.DIG || ctx.moveId === MOVES.DIVE || ctx.moveId === MOVES.BOUNCE) {
    ctx.attacker.volatile.semiInvulnerableMove = ctx.moveId;
  }
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message,
  });
  return { events, success: true };
}

// ── Effect Handlers ──

type EffectHandler = (ctx: MoveContext, events: BattleEvent[]) => MoveResult;

const EFFECT_HANDLERS: Record<number, EffectHandler> = {};
let effectAliasMapCache: Map<number, number> | null = null;

/** Register a handler for an effect ID. */
function registerEffect(effectId: number, handler: EffectHandler): void {
  EFFECT_HANDLERS[effectId] = handler;
  effectAliasMapCache = null;
}

function getEffectAliasMap(): Map<number, number> {
  if (effectAliasMapCache !== null) return effectAliasMapCache;

  const byScriptLabel = new Map<string, number[]>();
  for (const effectId of getImplementedMoveEffectIds()) {
    const scriptLabel = BATTLE_MOVE_EFFECT_INDEX[effectId]?.scriptLabel;
    if (!scriptLabel) continue;
    const ids = byScriptLabel.get(scriptLabel) ?? [];
    ids.push(effectId);
    byScriptLabel.set(scriptLabel, ids);
  }

  const map = new Map<number, number>();
  for (const effectId of BATTLE_MOVE_EFFECT_IDS) {
    if (EFFECT_HANDLERS[effectId]) continue;
    const scriptLabel = BATTLE_MOVE_EFFECT_INDEX[effectId]?.scriptLabel;
    if (!scriptLabel) continue;
    const candidates = byScriptLabel.get(scriptLabel);
    if (!candidates || candidates.length !== 1) continue;
    map.set(effectId, candidates[0]);
  }

  effectAliasMapCache = map;
  return map;
}

function resolveEffectHandler(effectId: number): EffectHandler | undefined {
  const direct = EFFECT_HANDLERS[effectId];
  if (direct) return direct;
  const aliasEffectId = getEffectAliasMap().get(effectId);
  if (aliasEffectId === undefined) return undefined;
  return EFFECT_HANDLERS[aliasEffectId];
}

// ── EFFECT_HIT (0) — Basic damage ──
registerEffect(MOVE_EFFECTS.EFFECT_HIT, (ctx, events) => {
  return handleDamagingMove(ctx, events);
});

// ── EFFECT_SLEEP (1) ──
registerEffect(MOVE_EFFECTS.EFFECT_SLEEP, (ctx, events) => {
  const success = tryApplyStatusWithSafeguard(ctx, STATUS.SLEEP, events);
  if (!success && ctx.defenderSide.safeguard === 0) {
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
      tryApplyStatusWithSafeguard(ctx, STATUS.POISON, events);
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
      tryApplyStatusWithSafeguard(ctx, STATUS.BURN, events);
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
      tryApplyStatusWithSafeguard(ctx, STATUS.FREEZE, events);
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
      tryApplyStatusWithSafeguard(ctx, STATUS.PARALYSIS, events);
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
    const success = applyDefenderStatDrop(ctx, stat, amount, events);
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
        applyDefenderStatDrop(ctx, stat, -1, events);
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
  const success = tryApplyStatusWithSafeguard(ctx, STATUS.POISON, events);
  if (!success && ctx.defenderSide.safeguard === 0) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_PARALYZE (67) ──
registerEffect(MOVE_EFFECTS.EFFECT_PARALYZE, (ctx, events) => {
  const success = tryApplyStatusWithSafeguard(ctx, STATUS.PARALYSIS, events);
  if (!success && ctx.defenderSide.safeguard === 0) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_TOXIC (33) ──
registerEffect(MOVE_EFFECTS.EFFECT_TOXIC, (ctx, events) => {
  const success = tryApplyStatusWithSafeguard(ctx, STATUS.TOXIC, events);
  if (!success && ctx.defenderSide.safeguard === 0) {
    events.push({ type: 'message', message: 'But it failed!' });
  }
  return { events, success };
});

// ── EFFECT_WILL_O_WISP (167) ──
registerEffect(MOVE_EFFECTS.EFFECT_WILL_O_WISP, (ctx, events) => {
  const success = tryApplyStatusWithSafeguard(ctx, STATUS.BURN, events);
  if (!success && ctx.defenderSide.safeguard === 0) {
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
  return applyProtectLike(ctx, events, 'protect');
});

// ── EFFECT_ENDURE (116) ──
registerEffect(MOVE_EFFECTS.EFFECT_ENDURE, (ctx, events) => {
  return applyProtectLike(ctx, events, 'endure');
});

// ── EFFECT_MIST (46) ──
registerEffect(MOVE_EFFECTS.EFFECT_MIST, (ctx, events) => {
  if (ctx.attackerSide.mist > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attackerSide.mist = 5;
  events.push({ type: 'message', message: `${ctx.attacker.name}'s team became shrouded in Mist!` });
  return { events, success: true };
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

// ── EFFECT_SAFEGUARD (124) ──
registerEffect(MOVE_EFFECTS.EFFECT_SAFEGUARD, (ctx, events) => {
  if (ctx.attackerSide.safeguard > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attackerSide.safeguard = 5;
  events.push({ type: 'message', message: `${ctx.attacker.name}'s team became cloaked in Safeguard!` });
  return { events, success: true };
});

// ── EFFECT_SPIKES (112) ──
registerEffect(MOVE_EFFECTS.EFFECT_SPIKES, (ctx, events) => {
  if (ctx.defenderSide.spikes >= 3) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defenderSide.spikes++;
  events.push({ type: 'message', message: `Spikes were scattered around ${ctx.defender.name}'s team!` });
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

// ── EFFECT_BIDE (26) — store damage, then retaliate ──
registerEffect(MOVE_EFFECTS.EFFECT_BIDE, (ctx, events) => {
  if (ctx.attacker.volatile.bide <= 0) {
    ctx.attacker.volatile.bide = 2;
    ctx.attacker.volatile.bideDamage = 0;
    ctx.attacker.volatile.bideTargetIsPlayer = null;
    events.push({
      type: 'message',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: `${ctx.attacker.name} is storing energy!`,
    });
    return { events, success: true };
  }

  ctx.attacker.volatile.bide--;
  if (ctx.attacker.volatile.bide > 0) {
    events.push({
      type: 'message',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: `${ctx.attacker.name} is storing energy!`,
    });
    return { events, success: true };
  }

  const storedDamage = ctx.attacker.volatile.bideDamage;
  ctx.attacker.volatile.bideDamage = 0;
  ctx.attacker.volatile.bideTargetIsPlayer = null;
  if (storedDamage <= 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  const result = doFixedDamage(ctx, events, Math.max(1, storedDamage * 2));
  return { events, success: result.success };
});

// ── EFFECT_RAZOR_WIND (39) — two-turn attack ──
registerEffect(MOVE_EFFECTS.EFFECT_RAZOR_WIND, (ctx, events) => {
  if (isChargingFirstTurn(ctx, MOVE_EFFECTS.EFFECT_RAZOR_WIND)) {
    return beginChargingTurn(ctx, events, `${ctx.attacker.name} whipped up a whirlwind!`);
  }
  ctx.attacker.volatile.chargeMove = MOVES.NONE;
  const dmg = doDamage(ctx, events);
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// ── EFFECT_SKY_ATTACK (75) — two-turn attack with flinch chance ──
registerEffect(MOVE_EFFECTS.EFFECT_SKY_ATTACK, (ctx, events) => {
  if (isChargingFirstTurn(ctx, MOVE_EFFECTS.EFFECT_SKY_ATTACK)) {
    return beginChargingTurn(ctx, events, `${ctx.attacker.name} became cloaked in a harsh light!`);
  }
  ctx.attacker.volatile.chargeMove = MOVES.NONE;
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getSecondaryEffectChance(ctx.moveId);
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      ctx.defender.volatile.flinch = true;
    }
  }
  return { events, success: true };
});

// ── EFFECT_SKULL_BASH (145) — charge and raise defense, then attack ──
registerEffect(MOVE_EFFECTS.EFFECT_SKULL_BASH, (ctx, events) => {
  if (isChargingFirstTurn(ctx, MOVE_EFFECTS.EFFECT_SKULL_BASH)) {
    applyStatChange(ctx.attacker, 'defense', 1, events);
    return beginChargingTurn(ctx, events, `${ctx.attacker.name} lowered its head!`);
  }
  ctx.attacker.volatile.chargeMove = MOVES.NONE;
  const dmg = doDamage(ctx, events);
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// ── EFFECT_SOLAR_BEAM (151) — charge unless sunlight is active ──
registerEffect(MOVE_EFFECTS.EFFECT_SOLAR_BEAM, (ctx, events) => {
  if (isChargingFirstTurn(ctx, MOVE_EFFECTS.EFFECT_SOLAR_BEAM)) {
    return beginChargingTurn(ctx, events, `${ctx.attacker.name} took in sunlight!`);
  }
  ctx.attacker.volatile.chargeMove = MOVES.NONE;
  const dmg = doDamage(ctx, events);
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// ── EFFECT_TRAP (42) — Damage + trap 3-6 turns (Wrap, Bind, etc.) ──
registerEffect(MOVE_EFFECTS.EFFECT_TRAP, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.damage > 0 && ctx.defender.currentHp > 0 && ctx.defender.volatile.trapped === 0) {
    ctx.defender.volatile.trapped = battleRandomInt(3, 6);
    ctx.defender.volatile.trappedByIsPlayer = ctx.attacker.isPlayer;
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
      tryApplyStatusWithSafeguard(ctx, STATUS.BURN, events);
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
      if (effect === 1) tryApplyStatusWithSafeguard(ctx, STATUS.BURN, events);
      else if (effect === 2) tryApplyStatusWithSafeguard(ctx, STATUS.FREEZE, events);
      else tryApplyStatusWithSafeguard(ctx, STATUS.PARALYSIS, events);
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
  applyDefenderStatDrop(ctx, 'attack', -1, events);
  applyDefenderStatDrop(ctx, 'defense', -1, events);
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

// EFFECT_RECHARGE (80) — Hyper Beam family
registerEffect(MOVE_EFFECTS.EFFECT_RECHARGE, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (dmg.effectiveness !== 0) {
    ctx.attacker.volatile.recharging = true;
  }
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// EFFECT_FLINCH_MINIMIZE_HIT (150) — Stomp family
registerEffect(MOVE_EFFECTS.EFFECT_FLINCH_MINIMIZE_HIT, (ctx, events) => {
  const basePower = getMoveInfo(ctx.moveId)?.power ?? 0;
  const powerOverride = ctx.defender.volatile.minimized ? Math.max(1, basePower * 2) : undefined;
  const dmg = doDamage(ctx, events, { powerOverride });
  if (dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getSecondaryEffectChance(ctx.moveId);
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      ctx.defender.volatile.flinch = true;
    }
  }
  return { events, success: true };
});

// EFFECT_SEMI_INVULNERABLE (155) — Fly / Dig / Dive / Bounce
registerEffect(MOVE_EFFECTS.EFFECT_SEMI_INVULNERABLE, (ctx, events) => {
  const continuing = ctx.attacker.volatile.chargeMove === ctx.moveId;
  if (!continuing) {
    ctx.attacker.volatile.chargeMove = ctx.moveId;
    ctx.attacker.volatile.semiInvulnerableMove = ctx.moveId;
    events.push({
      type: 'message',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: getSemiInvulnerableChargeMessage(ctx.attacker.name, ctx.moveId),
    });
    return { events, success: true };
  }

  ctx.attacker.volatile.chargeMove = MOVES.NONE;
  ctx.attacker.volatile.semiInvulnerableMove = MOVES.NONE;
  const dmg = doDamage(ctx, events);
  if (ctx.moveId === MOVES.BOUNCE && dmg.damage > 0 && ctx.defender.currentHp > 0) {
    const chance = getSecondaryEffectChance(ctx.moveId);
    if (chance > 0 && battleRandomInt(1, 100) <= chance) {
      tryApplyStatusWithSafeguard(ctx, STATUS.PARALYSIS, events);
    }
  }
  return { events, success: true };
});

// EFFECT_RAMPAGE (27) — Thrash / Outrage / Petal Dance
registerEffect(MOVE_EFFECTS.EFFECT_RAMPAGE, (ctx, events) => {
  if (ctx.attacker.volatile.rampageMove !== ctx.moveId || ctx.attacker.volatile.rampageTurns <= 0) {
    ctx.attacker.volatile.rampageMove = ctx.moveId;
    ctx.attacker.volatile.rampageTurns = battleRandomInt(2, 3);
  }

  const dmg = doDamage(ctx, events);
  if (dmg.effectiveness === 0) {
    ctx.attacker.volatile.rampageTurns = 0;
    ctx.attacker.volatile.rampageMove = MOVES.NONE;
    return { events, success: false };
  }

  if (ctx.attacker.volatile.rampageTurns > 0) {
    ctx.attacker.volatile.rampageTurns--;
  }

  if (ctx.attacker.volatile.rampageTurns <= 0) {
    ctx.attacker.volatile.rampageTurns = 0;
    ctx.attacker.volatile.rampageMove = MOVES.NONE;
    if (ctx.attacker.currentHp > 0) {
      applyConfusion(ctx.attacker, events);
    }
  }

  return { events, success: true };
});

// EFFECT_MEAN_LOOK (106) — prevent escape/switch
registerEffect(MOVE_EFFECTS.EFFECT_MEAN_LOOK, (ctx, events) => {
  if (ctx.defender.volatile.substitute > 0 || ctx.defender.volatile.meanLookSourceIsPlayer !== null) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defender.volatile.meanLookSourceIsPlayer = ctx.attacker.isPlayer;
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} can no longer escape!`,
  });
  return { events, success: true };
});

// EFFECT_ROAR (28) — force out / end wild battle
registerEffect(MOVE_EFFECTS.EFFECT_ROAR, (ctx, events) => {
  const battleType = ctx.battleType ?? 'trainer';
  if (battleType === 'trainer') {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  const attackerLevel = ctx.attacker.pokemon.level;
  const defenderLevel = ctx.defender.pokemon.level;
  if (attackerLevel < defenderLevel) {
    const random = battleRandomInt(0, 255);
    const threshold = Math.floor((random * (attackerLevel + defenderLevel)) / 256) + 1;
    if (threshold <= Math.floor(defenderLevel / 4)) {
      events.push({ type: 'message', message: 'But it failed!' });
      return { events, success: false };
    }
  }

  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} was blown away!`,
  });
  events.push({
    type: 'battle_end',
    detail: 'flee',
  });
  return { events, success: true };
});

// EFFECT_RECOIL_IF_MISS (45) — Jump Kick / Hi Jump Kick
registerEffect(MOVE_EFFECTS.EFFECT_RECOIL_IF_MISS, (ctx, events) => {
  return handleDamagingMove(ctx, events);
});

// EFFECT_LOCK_ON (94) — Mind Reader / Lock-On
registerEffect(MOVE_EFFECTS.EFFECT_LOCK_ON, (ctx, events) => {
  if (ctx.defender.volatile.substitute > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attacker.volatile.lockOnTurns = 2;
  ctx.attacker.volatile.lockOnTargetIsPlayer = ctx.defender.isPlayer;
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: `${ctx.attacker.name} took aim at ${ctx.defender.name}!`,
  });
  return { events, success: true };
});

// EFFECT_DISABLE (86)
registerEffect(MOVE_EFFECTS.EFFECT_DISABLE, (ctx, events) => {
  const moveId = ctx.defender.volatile.lastMoveUsed;
  if (ctx.defender.volatile.disabled > 0 || moveId === MOVES.NONE) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  const moveSlot = ctx.defender.pokemon.moves.findIndex((entry, index) => entry === moveId && ctx.defender.pokemon.pp[index] > 0);
  if (moveSlot < 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  ctx.defender.volatile.disabledMove = moveId;
  ctx.defender.volatile.disabled = battleRandomInt(2, 5);
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name}'s ${getMoveName(moveId)} was disabled!`,
  });
  return { events, success: true };
});

// EFFECT_ENCORE (90)
registerEffect(MOVE_EFFECTS.EFFECT_ENCORE, (ctx, events) => {
  const moveId = ctx.defender.volatile.lastMoveUsed;
  if (
    ctx.defender.volatile.encore > 0
    || moveId === MOVES.NONE
    || moveId === MOVES.STRUGGLE
    || moveId === MOVES.ENCORE
    || moveId === MOVES.MIRROR_MOVE
  ) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  const moveSlot = ctx.defender.pokemon.moves.findIndex((entry, index) => entry === moveId && ctx.defender.pokemon.pp[index] > 0);
  if (moveSlot < 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  ctx.defender.volatile.encoredMove = moveId;
  ctx.defender.volatile.encore = battleRandomInt(3, 6);
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} got an encore!`,
  });
  return { events, success: true };
});

// EFFECT_PERISH_SONG (114)
registerEffect(MOVE_EFFECTS.EFFECT_PERISH_SONG, (_ctx, events) => {
  const battlers = [_ctx.attacker, _ctx.defender];
  let applied = false;
  for (const battler of battlers) {
    if (battler.volatile.perishSong > 0) continue;
    if (battler.ability === ABILITIES.SOUNDPROOF) continue;
    battler.volatile.perishSong = 4;
    applied = true;
  }
  if (!applied) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  events.push({ type: 'message', message: 'All Pokémon hearing the song will faint in three turns!' });
  return { events, success: true };
});

// EFFECT_FURY_CUTTER (119) — escalating power on consecutive hits
registerEffect(MOVE_EFFECTS.EFFECT_FURY_CUTTER, (ctx, events) => {
  const nextCounter = Math.min(5, Math.max(1, ctx.attacker.volatile.furyCutter + 1));
  const basePower = getMoveInfo(ctx.moveId)?.power ?? 1;
  const powerOverride = Math.max(1, basePower * (2 ** Math.max(0, nextCounter - 1)));
  const dmg = doDamage(ctx, events, { powerOverride });
  if (dmg.effectiveness === 0) {
    ctx.attacker.volatile.furyCutter = 0;
    return { events, success: false };
  }
  ctx.attacker.volatile.furyCutter = nextCounter;
  return { events, success: true };
});

// EFFECT_UPROAR (159) — multi-turn lock with sleep prevention
registerEffect(MOVE_EFFECTS.EFFECT_UPROAR, (ctx, events) => {
  if (ctx.attacker.volatile.uproarTurns <= 0 || ctx.attacker.volatile.uproarMove !== ctx.moveId) {
    ctx.attacker.volatile.uproarTurns = battleRandomInt(2, 5);
    ctx.attacker.volatile.uproarMove = ctx.moveId;
  }

  const dmg = doDamage(ctx, events);
  if (ctx.attacker.volatile.uproarTurns > 0) {
    ctx.attacker.volatile.uproarTurns--;
  }
  if (ctx.attacker.volatile.uproarTurns <= 0) {
    ctx.attacker.volatile.uproarTurns = 0;
    ctx.attacker.volatile.uproarMove = MOVES.NONE;
    events.push({
      type: 'message',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: `${ctx.attacker.name} calmed down.`,
    });
  }
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// EFFECT_STOCKPILE (160)
registerEffect(MOVE_EFFECTS.EFFECT_STOCKPILE, (ctx, events) => {
  if (ctx.attacker.volatile.stockpile >= 3) {
    events.push({ type: 'message', message: "But it can't stockpile any more!" });
    return { events, success: false };
  }
  ctx.attacker.volatile.stockpile++;
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: `${ctx.attacker.name} stockpiled ${ctx.attacker.volatile.stockpile}!`,
  });
  return { events, success: true };
});

// EFFECT_SPIT_UP (161)
registerEffect(MOVE_EFFECTS.EFFECT_SPIT_UP, (ctx, events) => {
  const stockpileCount = ctx.attacker.volatile.stockpile;
  if (stockpileCount <= 0) {
    events.push({ type: 'message', message: 'But it failed to spit up a thing!' });
    return { events, success: false };
  }
  if (ctx.defender.volatile.protect) {
    ctx.attacker.volatile.stockpile = 0;
    events.push({
      type: 'message',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} protected itself!`,
    });
    return { events, success: false };
  }
  const basePower = getMoveInfo(ctx.moveId)?.power ?? 1;
  const powerOverride = Math.max(1, basePower * stockpileCount);
  const dmg = doDamage(ctx, events, { powerOverride });
  ctx.attacker.volatile.stockpile = 0;
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// EFFECT_SWALLOW (162)
registerEffect(MOVE_EFFECTS.EFFECT_SWALLOW, (ctx, events) => {
  const stockpileCount = ctx.attacker.volatile.stockpile;
  if (stockpileCount <= 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  if (ctx.attacker.currentHp >= ctx.attacker.maxHp) {
    ctx.attacker.volatile.stockpile = 0;
    events.push({ type: 'message', message: `${ctx.attacker.name}'s HP is full!` });
    return { events, success: false };
  }
  const healAmount = Math.max(1, Math.floor(ctx.attacker.maxHp / (2 ** (3 - stockpileCount))));
  const actualHeal = Math.min(healAmount, ctx.attacker.maxHp - ctx.attacker.currentHp);
  ctx.attacker.currentHp += actualHeal;
  ctx.attacker.volatile.stockpile = 0;
  events.push({
    type: 'heal',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    value: actualHeal,
    message: `${ctx.attacker.name}'s HP was restored.`,
  });
  return { events, success: true };
});

// EFFECT_TORMENT (165)
registerEffect(MOVE_EFFECTS.EFFECT_TORMENT, (ctx, events) => {
  if (ctx.defender.volatile.torment) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defender.volatile.torment = true;
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} was subjected to torment!`,
  });
  return { events, success: true };
});

// EFFECT_FOCUS_PUNCH (170)
registerEffect(MOVE_EFFECTS.EFFECT_FOCUS_PUNCH, (ctx, events) => {
  if (ctx.attacker.volatile.tookDamageThisTurn) {
    events.push({
      type: 'message',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: `${ctx.attacker.name} lost its focus and couldn't move!`,
    });
    return { events, success: false };
  }
  const dmg = doDamage(ctx, events);
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// EFFECT_CHARGE (174)
registerEffect(MOVE_EFFECTS.EFFECT_CHARGE, (ctx, events) => {
  ctx.attacker.volatile.chargeTurns = 2;
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: `${ctx.attacker.name} began charging power!`,
  });
  return { events, success: true };
});

// EFFECT_TAUNT (175)
registerEffect(MOVE_EFFECTS.EFFECT_TAUNT, (ctx, events) => {
  if (ctx.defender.volatile.taunt > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defender.volatile.taunt = 2;
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} fell for the taunt!`,
  });
  return { events, success: true };
});

// EFFECT_WISH (179)
registerEffect(MOVE_EFFECTS.EFFECT_WISH, (ctx, events) => {
  if (ctx.attackerSide.wishTurn > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.attackerSide.wishTurn = 2;
  ctx.attackerSide.wishAmount = Math.max(1, Math.floor(ctx.attacker.maxHp / 2));
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: `${ctx.attacker.name} made a wish!`,
  });
  return { events, success: true };
});

// EFFECT_REVENGE (185)
registerEffect(MOVE_EFFECTS.EFFECT_REVENGE, (ctx, events) => {
  const wasHitByTarget = ctx.attacker.volatile.tookDamageThisTurn
    && ctx.attacker.volatile.lastDamagedByIsPlayer === ctx.defender.isPlayer;
  const basePower = getMoveInfo(ctx.moveId)?.power ?? 1;
  const powerOverride = wasHitByTarget ? Math.max(1, basePower * 2) : undefined;
  const dmg = doDamage(ctx, events, { powerOverride });
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// EFFECT_YAWN (187)
registerEffect(MOVE_EFFECTS.EFFECT_YAWN, (ctx, events) => {
  const hasSleepImmunity = ctx.defender.ability === ABILITIES.INSOMNIA || ctx.defender.ability === ABILITIES.VITAL_SPIRIT;
  if (ctx.defender.volatile.yawn > 0 || ctx.defender.pokemon.status !== STATUS.NONE || hasSleepImmunity) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  if (ctx.defenderSide.safeguard > 0) {
    events.push({
      type: 'message',
      battler: ctx.defender.isPlayer ? 0 : 1,
      message: `${ctx.defender.name} is protected by Safeguard!`,
    });
    return { events, success: false };
  }
  ctx.defender.volatile.yawn = 2;
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} grew drowsy!`,
  });
  return { events, success: true };
});

// EFFECT_FLAIL (99) — Flail / Reversal
registerEffect(MOVE_EFFECTS.EFFECT_FLAIL, (ctx, events) => {
  const powerOverride = calculateFlailPower(ctx.attacker);
  const dmg = doDamage(ctx, events, { powerOverride });
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// EFFECT_HEAL_BELL (102) — Heal Bell / Aromatherapy
registerEffect(MOVE_EFFECTS.EFFECT_HEAL_BELL, (ctx, events) => {
  const hadStatus = ctx.attacker.pokemon.status !== STATUS.NONE;
  if (hadStatus) {
    ctx.attacker.pokemon.status = STATUS.NONE;
    ctx.attacker.volatile.toxicCounter = 0;
    ctx.attacker.volatile.nightmare = false;
  }
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: ctx.moveId === MOVES.HEAL_BELL
      ? 'A bell chimed!'
      : 'A soothing aroma wafted through the area!',
  });
  return { events, success: hadStatus || ctx.moveId === MOVES.HEAL_BELL || ctx.moveId === MOVES.AROMATHERAPY };
});

// EFFECT_THIEF (105) — damage then steal held item
registerEffect(MOVE_EFFECTS.EFFECT_THIEF, (ctx, events) => {
  const dmg = doDamage(ctx, events);
  if (
    dmg.damage > 0
    && ctx.attacker.pokemon.heldItem === 0
    && ctx.defender.pokemon.heldItem !== 0
  ) {
    ctx.attacker.pokemon.heldItem = ctx.defender.pokemon.heldItem;
    ctx.defender.pokemon.heldItem = 0;
    events.push({
      type: 'message',
      battler: ctx.attacker.isPlayer ? 0 : 1,
      message: `${ctx.attacker.name} stole ${ctx.defender.name}'s item!`,
    });
  }
  return { events, success: true };
});

// EFFECT_FORESIGHT (113) — identify target
registerEffect(MOVE_EFFECTS.EFFECT_FORESIGHT, (ctx, events) => {
  if (ctx.defender.volatile.foresight) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  ctx.defender.volatile.foresight = true;
  events.push({
    type: 'message',
    battler: ctx.defender.isPlayer ? 0 : 1,
    message: `${ctx.defender.name} was identified!`,
  });
  return { events, success: true };
});

// EFFECT_ROLLOUT (117) — escalating multi-turn move
registerEffect(MOVE_EFFECTS.EFFECT_ROLLOUT, (ctx, events) => {
  const previousTurns = ctx.attacker.volatile.rollout;
  const turnIndex = previousTurns <= 0 ? 1 : previousTurns;
  const basePower = getMoveInfo(ctx.moveId)?.power ?? 0;
  const powerOverride = Math.max(1, basePower * (2 ** Math.max(0, turnIndex - 1)));
  const dmg = doDamage(ctx, events, { powerOverride });

  if (dmg.effectiveness === 0) {
    ctx.attacker.volatile.rollout = 0;
    return { events, success: false };
  }

  if (turnIndex >= 5) {
    ctx.attacker.volatile.rollout = 0;
  } else {
    ctx.attacker.volatile.rollout = turnIndex + 1;
  }

  return { events, success: true };
});

// EFFECT_FUTURE_SIGHT (148) — delayed hit
registerEffect(MOVE_EFFECTS.EFFECT_FUTURE_SIGHT, (ctx, events) => {
  if (ctx.defender.volatile.futureSightTurns > 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  const preview = calculateDamage({
    attacker: ctx.attacker,
    defender: ctx.defender,
    moveId: ctx.moveId,
    weather: ctx.weather.type,
    attackerSide: ctx.attackerSide,
    defenderSide: ctx.defenderSide,
    ignoreNormalFightGhostImmunity: ctx.defender.volatile.foresight,
  });
  if (preview.effectiveness === 0) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }

  ctx.defender.volatile.futureSightTurns = 3;
  ctx.defender.volatile.futureSightMoveId = ctx.moveId;
  ctx.defender.volatile.futureSightDamage = Math.max(1, preview.damage);
  ctx.defender.volatile.futureSightAttackerIsPlayer = ctx.attacker.isPlayer;
  events.push({
    type: 'message',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    message: ctx.moveId === MOVES.DOOM_DESIRE
      ? `${ctx.attacker.name} chose Doom Desire as its destiny!`
      : `${ctx.attacker.name} foresaw an attack!`,
  });
  return { events, success: true };
});

// EFFECT_SOFTBOILED (157) — restore half max HP
registerEffect(MOVE_EFFECTS.EFFECT_SOFTBOILED, (ctx, events) => {
  if (ctx.attacker.currentHp >= ctx.attacker.maxHp) {
    events.push({ type: 'message', message: 'But it failed!' });
    return { events, success: false };
  }
  const healAmount = Math.max(1, Math.floor(ctx.attacker.maxHp / 2));
  const actualHeal = Math.min(healAmount, ctx.attacker.maxHp - ctx.attacker.currentHp);
  ctx.attacker.currentHp += actualHeal;
  events.push({
    type: 'heal',
    battler: ctx.attacker.isPlayer ? 0 : 1,
    value: actualHeal,
    message: `${ctx.attacker.name} regained health!`,
  });
  return { events, success: true };
});

// EFFECT_ERUPTION (190) — scales with current HP
registerEffect(MOVE_EFFECTS.EFFECT_ERUPTION, (ctx, events) => {
  const powerOverride = calculateHpRatioPower(ctx.attacker, ctx.moveId);
  const dmg = doDamage(ctx, events, { powerOverride });
  return { events, success: dmg.damage > 0 || dmg.effectiveness === 0 };
});

// ── Utility ──

function getSecondaryEffectChance(moveId: number): number {
  return getBattleMoveData(moveId)?.secondaryEffectChance ?? 0;
}

function shouldConsumePp(
  ctx: MoveContext,
  moveEffect: number,
): boolean {
  if (ctx.moveSlot < 0 || ctx.moveSlot > 3) return false;

  if (
    isTwoTurnChargingEffect(moveEffect)
    && ctx.attacker.volatile.chargeMove === ctx.moveId
  ) {
    return false;
  }

  if (
    moveEffect === MOVE_EFFECTS.EFFECT_BIDE
    && ctx.attacker.volatile.bide > 0
  ) {
    return false;
  }

  if (
    moveEffect === MOVE_EFFECTS.EFFECT_RAMPAGE
    && ctx.attacker.volatile.rampageMove === ctx.moveId
    && ctx.attacker.volatile.rampageTurns > 0
  ) {
    return false;
  }

  if (
    moveEffect === MOVE_EFFECTS.EFFECT_ROLLOUT
    && ctx.attacker.volatile.rollout > 0
    && ctx.attacker.volatile.lastMoveUsed === ctx.moveId
  ) {
    return false;
  }

  if (
    moveEffect === MOVE_EFFECTS.EFFECT_UPROAR
    && ctx.attacker.volatile.uproarTurns > 0
    && ctx.attacker.volatile.uproarMove === ctx.moveId
  ) {
    return false;
  }

  return true;
}

function getSemiInvulnerableChargeMessage(attackerName: string, moveId: number): string {
  switch (moveId) {
    case MOVES.FLY:
      return `${attackerName} flew up high!`;
    case MOVES.DIG:
      return `${attackerName} dug underground!`;
    case MOVES.DIVE:
      return `${attackerName} hid underwater!`;
    case MOVES.BOUNCE:
      return `${attackerName} sprang up!`;
    default:
      return `${attackerName} became semi-invulnerable!`;
  }
}

function calculateFlailPower(attacker: BattlePokemon): number {
  const maxHp = Math.max(1, attacker.maxHp);
  let hpFraction = Math.floor((attacker.currentHp * 48) / maxHp);
  if (hpFraction === 0 && attacker.currentHp > 0) {
    hpFraction = 1;
  }
  if (hpFraction <= 1) return 200;
  if (hpFraction <= 4) return 150;
  if (hpFraction <= 9) return 100;
  if (hpFraction <= 16) return 80;
  if (hpFraction <= 32) return 40;
  return 20;
}

function calculateHpRatioPower(attacker: BattlePokemon, moveId: number): number {
  const basePower = getMoveInfo(moveId)?.power ?? 1;
  const scaled = Math.floor((attacker.currentHp * basePower) / Math.max(1, attacker.maxHp));
  return Math.max(1, scaled);
}

function consumePP(attacker: BattlePokemon, moveSlot: number): void {
  if (moveSlot >= 0 && moveSlot < 4) {
    attacker.pokemon.pp[moveSlot] = Math.max(0, attacker.pokemon.pp[moveSlot] - 1) as 0;
  }
}

export function getImplementedMoveEffectIds(): number[] {
  return Object.keys(EFFECT_HANDLERS)
    .map((key) => Number(key))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
}

export function getResolvedMoveEffectIds(): number[] {
  const ids = new Set(getImplementedMoveEffectIds());
  for (const effectId of getEffectAliasMap().keys()) {
    ids.add(effectId);
  }
  return Array.from(ids).sort((a, b) => a - b);
}

export function getMoveEffectCoverageReport(): MoveEffectCoverageReport {
  const implementedIds = new Set(getImplementedMoveEffectIds());
  const resolvedIds = new Set(getResolvedMoveEffectIds());
  const referencedEntries: MoveEffectCoverageEntry[] = BATTLE_MOVE_EFFECT_IDS
    .map((effectId) => {
      const row = BATTLE_MOVE_EFFECT_INDEX[effectId];
      return {
        effectId,
        effectName: row.effectName,
        scriptLabel: row.scriptLabel,
        implemented: resolvedIds.has(effectId),
        moveCount: row.moveCount,
        moveIds: row.moveIds,
      };
    })
    .sort((a, b) => a.effectId - b.effectId);

  const missingReferencedEffects = referencedEntries
    .filter((entry) => !entry.implemented)
    .sort((a, b) => b.moveCount - a.moveCount || a.effectId - b.effectId);

  const implementedReferencedEffects = referencedEntries.filter((entry) => entry.implemented).length;
  const directImplementedReferencedEffects = referencedEntries.filter((entry) => implementedIds.has(entry.effectId)).length;

  return {
    totalDefinedEffects: Object.keys(MOVE_EFFECTS).length,
    totalReferencedEffects: referencedEntries.length,
    implementedEffects: implementedIds.size,
    implementedReferencedEffects: directImplementedReferencedEffects,
    aliasReferencedEffects: implementedReferencedEffects - directImplementedReferencedEffects,
    resolvedReferencedEffects: implementedReferencedEffects,
    missingReferencedEffects,
  };
}
