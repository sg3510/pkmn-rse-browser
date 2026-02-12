---
title: Damage Calculation System
status: reference
written_on: 2025-11-26
last_verified: 2026-01-13
---

# Damage Calculation System

## Source Files

- **Damage Calculation**: `src/pokemon.c` (CalculateBaseDamage, line 3106-3372)
- **Type Calculation**: `src/battle_script_commands.c` (Cmd_typecalc)
- **Stat Stage Ratios**: `src/data/pokemon/stat_stage_ratios.h`
- **Constants**: `include/constants/pokemon.h`

## Damage Formula

The Generation 3 damage formula:

```
Damage = ((((2 × Level / 5 + 2) × Power × A / D) / 50) + 2)
         × Modifier
```

Where:
- **Level** = Attacker's level
- **Power** = Move's base power
- **A** = Attacker's Attack or Sp. Attack (based on move type)
- **D** = Defender's Defense or Sp. Defense (based on move type)

### Modifier Breakdown

```
Modifier = Targets × Weather × Badge × Critical × Random × STAB × Type × Burn × Other
```

| Factor | Values | Condition |
|--------|--------|-----------|
| Targets | 0.5 | Move hits multiple targets in doubles |
| Weather | 0.5 or 1.5 | Weather affects move type |
| Badge | 1.1 | Player has relevant badge |
| Critical | 2.0 | Critical hit |
| Random | 0.85-1.00 | Random factor (85-100%) |
| STAB | 1.5 | Move type matches attacker type |
| Type | 0-4x | Type effectiveness |
| Burn | 0.5 | Attacker burned (physical only, no Guts) |
| Other | varies | Abilities, items, etc. |

## Complete Damage Calculation Code

From `src/pokemon.c`:

```c
s32 CalculateBaseDamage(
    struct BattlePokemon *attacker,
    struct BattlePokemon *defender,
    u32 move,
    u16 sideStatus,
    u16 powerOverride,
    u8 typeOverride,
    u8 battlerIdAtk,
    u8 battlerIdDef)
{
    s32 damage = 0;
    u16 attack, defense;
    u16 spAttack, spDefense;
    u8 type;

    // Get move power
    gBattleMovePower = powerOverride ? powerOverride : gBattleMoves[move].power;

    // Get move type
    type = typeOverride ? (typeOverride & DYNAMIC_TYPE_MASK) : gBattleMoves[move].type;

    // Get base stats
    attack = attacker->attack;
    defense = defender->defense;
    spAttack = attacker->spAttack;
    spDefense = defender->spDefense;

    //===========================================
    // ABILITY MODIFIERS (Pre-calculation)
    //===========================================

    // Huge Power / Pure Power doubles Attack
    if (attacker->ability == ABILITY_HUGE_POWER ||
        attacker->ability == ABILITY_PURE_POWER) {
        attack *= 2;
    }

    // Hustle boosts Attack by 50%
    if (attacker->ability == ABILITY_HUSTLE) {
        attack = (150 * attack) / 100;
    }

    // Guts boosts Attack by 50% when statused
    if (attacker->ability == ABILITY_GUTS && attacker->status1) {
        attack = (150 * attack) / 100;
    }

    // Marvel Scale boosts Defense by 50% when statused
    if (defender->ability == ABILITY_MARVEL_SCALE && defender->status1) {
        defense = (150 * defense) / 100;
    }

    // Thick Fat halves Fire/Ice special attack
    if (defender->ability == ABILITY_THICK_FAT &&
        (type == TYPE_FIRE || type == TYPE_ICE)) {
        spAttack /= 2;
    }

    // Plus/Minus combo
    if (attacker->ability == ABILITY_PLUS && ABILITY_ON_FIELD2(ABILITY_MINUS)) {
        spAttack = (150 * spAttack) / 100;
    }
    if (attacker->ability == ABILITY_MINUS && ABILITY_ON_FIELD2(ABILITY_PLUS)) {
        spAttack = (150 * spAttack) / 100;
    }

    //===========================================
    // BADGE BOOST (Player only)
    //===========================================

    if (ShouldGetStatBadgeBoost(FLAG_BADGE01_GET, battlerIdAtk))
        attack = (110 * attack) / 100;      // Stone Badge
    if (ShouldGetStatBadgeBoost(FLAG_BADGE05_GET, battlerIdDef))
        defense = (110 * defense) / 100;    // Balance Badge
    if (ShouldGetStatBadgeBoost(FLAG_BADGE07_GET, battlerIdAtk))
        spAttack = (110 * spAttack) / 100;  // Mind Badge
    if (ShouldGetStatBadgeBoost(FLAG_BADGE07_GET, battlerIdDef))
        spDefense = (110 * spDefense) / 100;

    //===========================================
    // HOLD ITEM MODIFIERS
    //===========================================

    // Choice Band
    if (attackerHoldEffect == HOLD_EFFECT_CHOICE_BAND) {
        attack = (150 * attack) / 100;
    }

    // Soul Dew (Latias/Latios only, not in Frontier)
    if (attackerHoldEffect == HOLD_EFFECT_SOUL_DEW &&
        !(gBattleTypeFlags & BATTLE_TYPE_FRONTIER) &&
        (attacker->species == SPECIES_LATIAS || attacker->species == SPECIES_LATIOS)) {
        spAttack = (150 * spAttack) / 100;
    }

    // Deep Sea Tooth (Clamperl only)
    if (attackerHoldEffect == HOLD_EFFECT_DEEP_SEA_TOOTH &&
        attacker->species == SPECIES_CLAMPERL) {
        spAttack *= 2;
    }

    // Light Ball (Pikachu only)
    if (attackerHoldEffect == HOLD_EFFECT_LIGHT_BALL &&
        attacker->species == SPECIES_PIKACHU) {
        spAttack *= 2;
    }

    // Metal Powder (Ditto only)
    if (defenderHoldEffect == HOLD_EFFECT_METAL_POWDER &&
        defender->species == SPECIES_DITTO) {
        defense *= 2;
    }

    // Thick Club (Cubone/Marowak only)
    if (attackerHoldEffect == HOLD_EFFECT_THICK_CLUB &&
        (attacker->species == SPECIES_CUBONE || attacker->species == SPECIES_MAROWAK)) {
        attack *= 2;
    }

    // Type-boosting items (Charcoal, Mystic Water, etc.)
    for (i = 0; i < ARRAY_COUNT(sHoldEffectToType); i++) {
        if (attackerHoldEffect == sHoldEffectToType[i][0] &&
            type == sHoldEffectToType[i][1]) {
            if (IS_TYPE_PHYSICAL(type))
                attack = (attack * (attackerHoldEffectParam + 100)) / 100;
            else
                spAttack = (spAttack * (attackerHoldEffectParam + 100)) / 100;
            break;
        }
    }

    //===========================================
    // MOVE POWER MODIFIERS
    //===========================================

    // Mud Sport halves Electric damage
    if (type == TYPE_ELECTRIC &&
        AbilityBattleEffects(ABILITYEFFECT_FIELD_SPORT, 0, 0, ABILITYEFFECT_MUD_SPORT, 0)) {
        gBattleMovePower /= 2;
    }

    // Water Sport halves Fire damage
    if (type == TYPE_FIRE &&
        AbilityBattleEffects(ABILITYEFFECT_FIELD_SPORT, 0, 0, ABILITYEFFECT_WATER_SPORT, 0)) {
        gBattleMovePower /= 2;
    }

    // Pinch abilities (Overgrow, Blaze, Torrent, Swarm)
    if (type == TYPE_GRASS && attacker->ability == ABILITY_OVERGROW &&
        attacker->hp <= (attacker->maxHP / 3)) {
        gBattleMovePower = (150 * gBattleMovePower) / 100;
    }
    if (type == TYPE_FIRE && attacker->ability == ABILITY_BLAZE &&
        attacker->hp <= (attacker->maxHP / 3)) {
        gBattleMovePower = (150 * gBattleMovePower) / 100;
    }
    if (type == TYPE_WATER && attacker->ability == ABILITY_TORRENT &&
        attacker->hp <= (attacker->maxHP / 3)) {
        gBattleMovePower = (150 * gBattleMovePower) / 100;
    }
    if (type == TYPE_BUG && attacker->ability == ABILITY_SWARM &&
        attacker->hp <= (attacker->maxHP / 3)) {
        gBattleMovePower = (150 * gBattleMovePower) / 100;
    }

    // Explosion/Self-Destruct halves defense
    if (gBattleMoves[gCurrentMove].effect == EFFECT_EXPLOSION) {
        defense /= 2;
    }

    //===========================================
    // PHYSICAL DAMAGE CALCULATION
    //===========================================

    if (IS_TYPE_PHYSICAL(type)) {
        // Apply attack stat stages
        if (gCritMultiplier == 2) {
            // Critical hit ignores stat drops
            if (attacker->statStages[STAT_ATK] > DEFAULT_STAT_STAGE)
                APPLY_STAT_MOD(damage, attacker, attack, STAT_ATK)
            else
                damage = attack;
        } else {
            APPLY_STAT_MOD(damage, attacker, attack, STAT_ATK)
        }

        damage = damage * gBattleMovePower;
        damage *= (2 * attacker->level / 5 + 2);

        // Apply defense stat stages
        if (gCritMultiplier == 2) {
            // Critical hit ignores stat boosts
            if (defender->statStages[STAT_DEF] < DEFAULT_STAT_STAGE)
                APPLY_STAT_MOD(damageHelper, defender, defense, STAT_DEF)
            else
                damageHelper = defense;
        } else {
            APPLY_STAT_MOD(damageHelper, defender, defense, STAT_DEF)
        }

        damage = damage / damageHelper;
        damage /= 50;

        // Burn halves physical damage (unless Guts)
        if ((attacker->status1 & STATUS1_BURN) &&
            attacker->ability != ABILITY_GUTS) {
            damage /= 2;
        }

        // Reflect halves damage (ignored by crits)
        if ((sideStatus & SIDE_STATUS_REFLECT) && gCritMultiplier == 1) {
            if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) &&
                CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2)
                damage = 2 * (damage / 3);  // 2/3 in doubles
            else
                damage /= 2;
        }

        // Multi-target moves halved in doubles
        if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) &&
            gBattleMoves[move].target == MOVE_TARGET_BOTH &&
            CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2) {
            damage /= 2;
        }

        if (damage == 0) damage = 1;  // Minimum 1 damage
    }

    //===========================================
    // SPECIAL DAMAGE CALCULATION
    //===========================================

    if (IS_TYPE_SPECIAL(type)) {
        // Similar logic with spAttack/spDefense
        // Light Screen instead of Reflect
        // Weather effects apply here

        // Weather effects (Rain, Sun)
        if (WEATHER_HAS_EFFECT2) {
            if (gBattleWeather & B_WEATHER_RAIN) {
                if (type == TYPE_FIRE) damage /= 2;
                if (type == TYPE_WATER) damage = (15 * damage) / 10;
            }
            if (gBattleWeather & B_WEATHER_SUN) {
                if (type == TYPE_FIRE) damage = (15 * damage) / 10;
                if (type == TYPE_WATER) damage /= 2;
            }
            // Non-sun weather weakens Solar Beam
            if ((gBattleWeather & (B_WEATHER_RAIN | B_WEATHER_SANDSTORM | B_WEATHER_HAIL)) &&
                gCurrentMove == MOVE_SOLAR_BEAM) {
                damage /= 2;
            }
        }

        // Flash Fire bonus
        if ((gBattleResources->flags->flags[battlerIdAtk] & RESOURCE_FLAG_FLASH_FIRE) &&
            type == TYPE_FIRE) {
            damage = (15 * damage) / 10;
        }
    }

    return damage + 2;
}
```

## Stat Stage Multipliers

From `src/data/pokemon/stat_stage_ratios.h`:

```c
const u8 gStatStageRatios[MAX_STAT_STAGE + 1][2] = {
    {10, 40}, // -6 = 10/40 = 0.25x
    {10, 35}, // -5 = 10/35 = 0.29x
    {10, 30}, // -4 = 10/30 = 0.33x
    {10, 25}, // -3 = 10/25 = 0.40x
    {10, 20}, // -2 = 10/20 = 0.50x
    {10, 15}, // -1 = 10/15 = 0.67x
    {10, 10}, //  0 = 10/10 = 1.00x
    {15, 10}, // +1 = 15/10 = 1.50x
    {20, 10}, // +2 = 20/10 = 2.00x
    {25, 10}, // +3 = 25/10 = 2.50x
    {30, 10}, // +4 = 30/10 = 3.00x
    {35, 10}, // +5 = 35/10 = 3.50x
    {40, 10}, // +6 = 40/10 = 4.00x
};
```

## Critical Hit Calculation

From `src/battle_script_commands.c`:

```c
static void Cmd_critcalc(void)
{
    u16 critChance;
    s32 adder = 0;

    // High crit ratio moves add +1
    if (gBattleMoves[gCurrentMove].effect == EFFECT_HIGH_CRITICAL)
        adder++;

    // Focus Energy adds +1
    if (gBattleMons[gBattlerAttacker].status2 & STATUS2_FOCUS_ENERGY)
        adder++;

    // Scope Lens adds +1
    if (IsHoldEffectActive(gBattlerAttacker, HOLD_EFFECT_SCOPE_LENS))
        adder++;

    // Super Luck adds +1
    if (gBattleMons[gBattlerAttacker].ability == ABILITY_SUPER_LUCK)
        adder++;

    critChance = sCriticalHitChance[min(adder, ARRAY_COUNT(sCriticalHitChance) - 1)];

    if ((gBattleMons[gBattlerTarget].ability != ABILITY_BATTLE_ARMOR) &&
        (gBattleMons[gBattlerTarget].ability != ABILITY_SHELL_ARMOR) &&
        !(gStatuses3[gBattlerAttacker] & STATUS3_CANT_SCORE_A_CRIT) &&
        !(Random() % critChance)) {
        gCritMultiplier = 2;
    } else {
        gCritMultiplier = 1;
    }
}

// Critical hit rates: 1/16, 1/8, 1/4, 1/3, 1/2
static const u16 sCriticalHitChance[] = {16, 8, 4, 3, 2};
```

## Random Factor

Applied after all other calculations:

```c
// Multiplies damage by 85-100% randomly
static inline void ApplyRandomDmgMultiplier(void)
{
    u16 rand = Random();
    u16 randPercent = 100 - (rand % 16);  // 85-100
    gBattleMoveDamage = gBattleMoveDamage * randPercent / 100;
}
```

## TypeScript Implementation

```typescript
function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: Move,
  context: BattleContext
): number {
  // Base calculation
  const level = attacker.level;
  const power = getEffectivePower(move, attacker, defender, context);
  const [attack, defense] = getAtkDef(attacker, defender, move, context);

  let damage = Math.floor(
    (Math.floor((2 * level) / 5 + 2) * power * attack) / defense / 50
  ) + 2;

  // Apply modifiers
  damage = applyTargetModifier(damage, move, context);
  damage = applyWeatherModifier(damage, move, context);
  damage = applyCriticalModifier(damage, context.isCritical);
  damage = applyRandomModifier(damage);
  damage = applySTAB(damage, move.type, attacker.types);
  damage = applyTypeEffectiveness(damage, move.type, defender.types);
  damage = applyBurnModifier(damage, attacker, move);
  damage = applyScreenModifier(damage, move, defender, context);

  return Math.max(1, Math.floor(damage));
}

function applyRandomModifier(damage: number): number {
  const rand = 85 + Math.floor(Math.random() * 16);  // 85-100
  return Math.floor(damage * rand / 100);
}
```
