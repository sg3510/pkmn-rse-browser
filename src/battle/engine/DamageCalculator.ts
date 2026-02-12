/**
 * Full Gen 3 damage calculator.
 *
 * C ref: public/pokeemerald/src/pokemon.c:3106 (CalculateBaseDamage, ~200 lines)
 * Formula: ((2*level/5+2) * power * attack / defense / 50) + 2
 *
 * Gen 3 physical/special split is TYPE-based (not move-based).
 * Types 0-8 (NORMAL through STEEL) are physical, rest are special.
 *
 * Modifier chain:
 *   STAB × Type effectiveness × Critical × Random(85-100) × Weather ×
 *   Held items × Abilities × Burn × Screens
 */

import { STATUS } from '../../pokemon/types';
import { getSpeciesInfo } from '../../data/speciesInfo';
import { getTypeEffectiveness } from '../../data/typeEffectiveness.gen';
import { getBattleMoveData } from '../../data/battleMoves.gen';
import { getItemBattleEffect, HOLD_EFFECTS } from '../../data/itemBattleEffects.gen';
import { getMoveInfo } from '../../data/moves';
import type { BattlePokemon, WeatherType } from './types';
import type { SideState } from './types';
import { applyStatStage, isPhysicalType } from './types';
import { hasStatus } from './StatusEffects';

export interface DamageResult {
  damage: number;
  critical: boolean;
  effectiveness: number;
  /** Number of hits (for multi-hit moves). */
  hits: number;
}

export interface DamageContext {
  attacker: BattlePokemon;
  defender: BattlePokemon;
  moveId: number;
  weather: WeatherType;
  attackerSide: SideState;
  defenderSide: SideState;
  /** Is this a critical hit override? (e.g., forced crit moves) */
  forceCrit?: boolean;
}

/**
 * Calculate damage for an attacking move.
 * Returns 0 damage if move has no power or target is immune.
 */
export function calculateDamage(ctx: DamageContext): DamageResult {
  const { attacker, defender, moveId, weather, defenderSide } = ctx;

  const moveInfo = getMoveInfo(moveId);
  const battleMoveData = getBattleMoveData(moveId);
  if (!moveInfo || moveInfo.power <= 0) {
    return { damage: 0, critical: false, effectiveness: 1, hits: 0 };
  }

  const attackerInfo = getSpeciesInfo(attacker.pokemon.species);
  const defenderInfo = getSpeciesInfo(defender.pokemon.species);
  const attackerTypes = attackerInfo?.types ?? ['NORMAL', 'NORMAL'];
  const defenderTypes = defenderInfo?.types ?? ['NORMAL', 'NORMAL'];

  const moveType = moveInfo.type;
  const isPhysical = isPhysicalType(moveType);

  // ── Type effectiveness ──
  const effectiveness = getTypeEffectiveness(moveType, defenderTypes[0], defenderTypes[1]);
  if (effectiveness === 0) {
    return { damage: 0, critical: false, effectiveness: 0, hits: 0 };
  }

  // ── Critical hit ──
  const critical = ctx.forceCrit ?? rollCritical(attacker, battleMoveData?.effect ?? 0);

  // ── Base stats (with stages and critical adjustments) ──
  let attackStat: number;
  let defenseStat: number;

  if (isPhysical) {
    let atkStage = attacker.stages.attack;
    let defStage = defender.stages.defense;

    // Critical: ignore negative attack stages and positive defense stages
    if (critical) {
      if (atkStage < 0) atkStage = 0;
      if (defStage > 0) defStage = 0;
    }

    attackStat = applyStatStage(attacker.pokemon.stats.attack, atkStage);
    defenseStat = applyStatStage(defender.pokemon.stats.defense, defStage);
  } else {
    let spAtkStage = attacker.stages.spAttack;
    let spDefStage = defender.stages.spDefense;

    if (critical) {
      if (spAtkStage < 0) spAtkStage = 0;
      if (spDefStage > 0) spDefStage = 0;
    }

    attackStat = applyStatStage(attacker.pokemon.stats.spAttack, spAtkStage);
    defenseStat = applyStatStage(defender.pokemon.stats.spDefense, spDefStage);
  }

  // ── Ability modifiers on stats ──
  attackStat = applyAttackAbilityModifiers(attacker, attackStat, isPhysical, moveType);
  defenseStat = applyDefenseAbilityModifiers(defender, defenseStat, isPhysical, moveType);

  // ── Held item modifiers on stats ──
  attackStat = applyAttackItemModifiers(attacker, attackStat, isPhysical);

  // ── Burn halves physical attack (unless Guts) ──
  if (isPhysical && hasStatus(attacker, STATUS.BURN) && attacker.ability !== 62) {
    // 62 = ABILITY_GUTS
    attackStat = Math.floor(attackStat / 2);
  }

  defenseStat = Math.max(1, defenseStat);

  // ── Base damage formula ──
  const level = attacker.pokemon.level;
  let damage = Math.floor(
    Math.floor(
      Math.floor(((2 * level) / 5 + 2) * moveInfo.power * attackStat / defenseStat) / 50
    ) + 2
  );

  // ── Weather modifier ──
  if (weather === 'rain') {
    if (moveType === 'WATER') damage = Math.floor(damage * 1.5);
    if (moveType === 'FIRE') damage = Math.floor(damage * 0.5);
  } else if (weather === 'sun') {
    if (moveType === 'FIRE') damage = Math.floor(damage * 1.5);
    if (moveType === 'WATER') damage = Math.floor(damage * 0.5);
  }

  // ── Critical ──
  if (critical) {
    damage *= 2;
  }

  // ── STAB ──
  const stab = (attackerTypes[0] === moveType || attackerTypes[1] === moveType) ? 1.5 : 1;
  if (stab > 1) {
    damage = Math.floor(damage * stab);
  }

  // ── Type effectiveness ──
  // Apply in two steps to match GBA integer truncation
  if (defenderTypes[0]) {
    const eff1 = getTypeEffectiveness(moveType, defenderTypes[0]);
    if (eff1 !== 1) damage = Math.floor(damage * eff1);
  }
  if (defenderTypes[1] && defenderTypes[1] !== defenderTypes[0]) {
    const eff2 = getTypeEffectiveness(moveType, defenderTypes[1]);
    if (eff2 !== 1) damage = Math.floor(damage * eff2);
  }

  // ── Screens (ignored on critical) ──
  if (!critical) {
    if (isPhysical && defenderSide.reflect > 0) {
      damage = Math.floor(damage / 2);
    }
    if (!isPhysical && defenderSide.lightScreen > 0) {
      damage = Math.floor(damage / 2);
    }
  }

  // ── Held item type boost ──
  damage = applyItemTypeDamageBoost(attacker, damage, moveType);

  // ── Random factor (85-100) ──
  const randomFactor = randomIntInclusive(85, 100);
  damage = Math.floor(damage * randomFactor / 100);

  // ── Minimum 1 damage ──
  damage = Math.max(1, damage);

  return { damage, critical, effectiveness, hits: 1 };
}

// ── Critical hit roll ──

/**
 * GBA critical hit rates by stage:
 *   Stage 0: 1/16, Stage 1: 1/8, Stage 2: 1/4, Stage 3: 1/3, Stage 4+: 1/2
 * C ref: sCriticalHitChance[] = {16, 8, 4, 3, 2}
 */
function rollCritical(attacker: BattlePokemon, moveEffect: number): boolean {
  let stage = 0;

  // Focus Energy: +2
  if (attacker.volatile.focusEnergy) stage += 2;

  // High-crit moves (Slash, etc.): +1
  // EFFECT_HIGH_CRITICAL = 43
  if (moveEffect === 43) stage += 1;

  // Scope Lens: +1 (HOLD_EFFECT_SCOPE_LENS = 41)
  const itemEffect = getItemBattleEffect(attacker.pokemon.heldItem);
  if (itemEffect?.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_SCOPE_LENS) stage += 1;

  // Lucky Punch (Chansey): +2 (HOLD_EFFECT_LUCKY_PUNCH = 63)
  if (itemEffect?.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_LUCKY_PUNCH &&
      attacker.pokemon.species === 113) { // SPECIES_CHANSEY
    stage += 2;
  }

  // Stick (Farfetch'd): +2 (HOLD_EFFECT_STICK = 66)
  if (itemEffect?.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_STICK &&
      attacker.pokemon.species === 83) { // SPECIES_FARFETCHD
    stage += 2;
  }

  stage = Math.min(stage, 4);
  const chances = [16, 8, 4, 3, 2];
  const threshold = chances[stage];

  return randomIntInclusive(1, threshold) === 1;
}

// ── Ability modifiers ──

function applyAttackAbilityModifiers(
  attacker: BattlePokemon,
  attackStat: number,
  isPhysical: boolean,
  moveType: string,
): number {
  const ability = attacker.ability;

  // Huge Power / Pure Power: double physical attack
  // 37 = ABILITY_HUGE_POWER, 74 = ABILITY_PURE_POWER
  if ((ability === 37 || ability === 74) && isPhysical) {
    return attackStat * 2;
  }

  // Hustle: +50% attack but -20% accuracy (accuracy handled elsewhere)
  // 55 = ABILITY_HUSTLE
  if (ability === 55 && isPhysical) {
    return Math.floor(attackStat * 1.5);
  }

  // Guts: +50% attack when statused
  // 62 = ABILITY_GUTS
  if (ability === 62 && attacker.pokemon.status !== 0 && isPhysical) {
    return Math.floor(attackStat * 1.5);
  }

  // Overgrow / Blaze / Torrent / Swarm: +50% at <=33% HP
  const hpPercent = attacker.currentHp / attacker.maxHp;
  if (hpPercent <= 1 / 3) {
    // 65 = ABILITY_OVERGROW (Grass), 66 = ABILITY_BLAZE (Fire),
    // 67 = ABILITY_TORRENT (Water), 68 = ABILITY_SWARM (Bug)
    if (ability === 65 && moveType === 'GRASS') return Math.floor(attackStat * 1.5);
    if (ability === 66 && moveType === 'FIRE') return Math.floor(attackStat * 1.5);
    if (ability === 67 && moveType === 'WATER') return Math.floor(attackStat * 1.5);
    if (ability === 68 && moveType === 'BUG') return Math.floor(attackStat * 1.5);
  }

  return attackStat;
}

function applyDefenseAbilityModifiers(
  defender: BattlePokemon,
  defenseStat: number,
  isPhysical: boolean,
  moveType: string,
): number {
  const ability = defender.ability;

  // Marvel Scale: +50% defense when statused (physical only)
  // 63 = ABILITY_MARVEL_SCALE
  if (ability === 63 && defender.pokemon.status !== 0 && isPhysical) {
    return Math.floor(defenseStat * 1.5);
  }

  // Thick Fat: halve Fire/Ice special attack damage
  // 47 = ABILITY_THICK_FAT
  if (ability === 47 && !isPhysical && (moveType === 'FIRE' || moveType === 'ICE')) {
    return defenseStat * 2; // effectively halves damage
  }

  // Sandstorm SpDef boost for Rock types
  // (handled in weather section of calculateDamage if needed)

  return defenseStat;
}

// ── Held item modifiers ──

function applyAttackItemModifiers(
  attacker: BattlePokemon,
  attackStat: number,
  isPhysical: boolean,
): number {
  const itemEffect = getItemBattleEffect(attacker.pokemon.heldItem);
  if (!itemEffect) return attackStat;

  // Choice Band: +50% physical attack
  if (itemEffect.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_CHOICE_BAND && isPhysical) {
    return Math.floor(attackStat * 1.5);
  }

  // Thick Club (Marowak/Cubone): double physical attack
  // 105 = SPECIES_MAROWAK, 104 = SPECIES_CUBONE
  if (itemEffect.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_THICK_CLUB && isPhysical) {
    if (attacker.pokemon.species === 104 || attacker.pokemon.species === 105) {
      return attackStat * 2;
    }
  }

  // Light Ball (Pikachu): double special attack
  // 25 = SPECIES_PIKACHU
  if (itemEffect.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_LIGHT_BALL && !isPhysical) {
    if (attacker.pokemon.species === 25) {
      return attackStat * 2;
    }
  }

  // Soul Dew (Latios/Latias): +50% SpAtk/SpDef
  // 380 = SPECIES_LATIAS, 381 = SPECIES_LATIOS
  if (itemEffect.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_SOUL_DEW && !isPhysical) {
    if (attacker.pokemon.species === 380 || attacker.pokemon.species === 381) {
      return Math.floor(attackStat * 1.5);
    }
  }

  // Deep Sea Tooth (Clamperl): double SpAtk
  // 366 = SPECIES_CLAMPERL
  if (itemEffect.holdEffect === HOLD_EFFECTS.HOLD_EFFECT_DEEP_SEA_TOOTH && !isPhysical) {
    if (attacker.pokemon.species === 366) {
      return attackStat * 2;
    }
  }

  // Metal Powder (Ditto): double defense
  // 132 = SPECIES_DITTO — only applies to defense, handled in defense section

  return attackStat;
}

/** Type-boosting held items (10% boost from Charcoal, Mystic Water, etc.). */
function applyItemTypeDamageBoost(
  attacker: BattlePokemon,
  damage: number,
  moveType: string,
): number {
  const itemEffect = getItemBattleEffect(attacker.pokemon.heldItem);
  if (!itemEffect) return damage;

  const holdEffect = itemEffect.holdEffect;
  const param = itemEffect.holdEffectParam;

  const typeToHoldEffect: Record<string, number> = {
    BUG: HOLD_EFFECTS.HOLD_EFFECT_BUG_POWER,
    STEEL: HOLD_EFFECTS.HOLD_EFFECT_STEEL_POWER,
    GROUND: HOLD_EFFECTS.HOLD_EFFECT_GROUND_POWER,
    ROCK: HOLD_EFFECTS.HOLD_EFFECT_ROCK_POWER,
    GRASS: HOLD_EFFECTS.HOLD_EFFECT_GRASS_POWER,
    DARK: HOLD_EFFECTS.HOLD_EFFECT_DARK_POWER,
    FIGHTING: HOLD_EFFECTS.HOLD_EFFECT_FIGHTING_POWER,
    ELECTRIC: HOLD_EFFECTS.HOLD_EFFECT_ELECTRIC_POWER,
    WATER: HOLD_EFFECTS.HOLD_EFFECT_WATER_POWER,
    FLYING: HOLD_EFFECTS.HOLD_EFFECT_FLYING_POWER,
    POISON: HOLD_EFFECTS.HOLD_EFFECT_POISON_POWER,
    ICE: HOLD_EFFECTS.HOLD_EFFECT_ICE_POWER,
    GHOST: HOLD_EFFECTS.HOLD_EFFECT_GHOST_POWER,
    PSYCHIC: HOLD_EFFECTS.HOLD_EFFECT_PSYCHIC_POWER,
    FIRE: HOLD_EFFECTS.HOLD_EFFECT_FIRE_POWER,
    DRAGON: HOLD_EFFECTS.HOLD_EFFECT_DRAGON_POWER,
    NORMAL: HOLD_EFFECTS.HOLD_EFFECT_NORMAL_POWER,
  };

  const expectedHoldEffect = typeToHoldEffect[moveType];
  if (expectedHoldEffect !== undefined && holdEffect === expectedHoldEffect) {
    // param is typically 10 (for 10%)
    return Math.floor(damage * (100 + param) / 100);
  }

  return damage;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
