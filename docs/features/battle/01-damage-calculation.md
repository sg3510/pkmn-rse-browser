---
title: Damage Calculation
status: reference
last_verified: 2026-01-13
---

# Damage Calculation

The damage calculation is one of the most complex parts of the battle system. The main function is `CalculateBaseDamage()` in `pokemon.c:3106`.

## Core Damage Formula

The Gen 3 damage formula is:

```
Damage = ((((2 × Level / 5 + 2) × Power × A / D) / 50) + 2) × Modifiers
```

Where:
- **Level** = Attacker's level
- **Power** = Move's base power
- **A** = Attacker's Attack or Special Attack (depending on move type)
- **D** = Defender's Defense or Special Defense

## Physical vs Special Split (Gen 3)

In Gen 3, moves are Physical or Special based on **TYPE**, not individual move:

```c
// IS_TYPE_PHYSICAL checks if type < TYPE_MYSTERY (which is 9)
#define IS_TYPE_PHYSICAL(type) ((type) < TYPE_MYSTERY)
#define IS_TYPE_SPECIAL(type)  ((type) > TYPE_MYSTERY)

// Physical types (0-8): Normal, Fighting, Flying, Poison, Ground, Rock, Bug, Ghost, Steel
// Special types (10-17): Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark
// TYPE_MYSTERY (9) deals 0 damage
```

## Complete Damage Calculation Steps

### Step 1: Get Base Power

```c
if (!powerOverride)
    gBattleMovePower = gBattleMoves[move].power;
else
    gBattleMovePower = powerOverride;  // For moves with dynamic power
```

### Step 2: Get Move Type

```c
if (!typeOverride)
    type = gBattleMoves[move].type;
else
    type = typeOverride & DYNAMIC_TYPE_MASK;  // Hidden Power, Weather Ball, etc.
```

### Step 3: Get Base Stats

```c
attack = attacker->attack;
defense = defender->defense;
spAttack = attacker->spAttack;
spDefense = defender->spDefense;
```

### Step 4: Apply Stat Modifiers

#### Ability Modifiers

```c
// Huge Power / Pure Power: 2× Attack
if (attacker->ability == ABILITY_HUGE_POWER || attacker->ability == ABILITY_PURE_POWER)
    attack *= 2;

// Hustle: 1.5× Attack
if (attacker->ability == ABILITY_HUSTLE)
    attack = (150 * attack) / 100;

// Guts: 1.5× Attack when statused
if (attacker->ability == ABILITY_GUTS && attacker->status1)
    attack = (150 * attack) / 100;

// Marvel Scale: 1.5× Defense when statused
if (defender->ability == ABILITY_MARVEL_SCALE && defender->status1)
    defense = (150 * defense) / 100;

// Thick Fat: 0.5× Fire/Ice special attack
if (defender->ability == ABILITY_THICK_FAT && (type == TYPE_FIRE || type == TYPE_ICE))
    spAttack /= 2;

// Plus/Minus: 1.5× Sp.Atk when partner has opposite ability
if (attacker->ability == ABILITY_PLUS && ABILITY_ON_FIELD2(ABILITY_MINUS))
    spAttack = (150 * spAttack) / 100;
if (attacker->ability == ABILITY_MINUS && ABILITY_ON_FIELD2(ABILITY_PLUS))
    spAttack = (150 * spAttack) / 100;
```

#### Badge Boosts (Player Only)

```c
// Stone Badge: 1.1× Attack
if (ShouldGetStatBadgeBoost(FLAG_BADGE01_GET, battlerIdAtk))
    attack = (110 * attack) / 100;

// Balance Badge: 1.1× Defense
if (ShouldGetStatBadgeBoost(FLAG_BADGE05_GET, battlerIdDef))
    defense = (110 * defense) / 100;

// Mind Badge: 1.1× Sp.Atk and Sp.Def
if (ShouldGetStatBadgeBoost(FLAG_BADGE07_GET, battlerIdAtk))
    spAttack = (110 * spAttack) / 100;
if (ShouldGetStatBadgeBoost(FLAG_BADGE07_GET, battlerIdDef))
    spDefense = (110 * spDefense) / 100;
```

#### Held Item Modifiers

```c
// Type-boosting items (Charcoal, Mystic Water, etc.)
for (i = 0; i < ARRAY_COUNT(sHoldEffectToType); i++) {
    if (attackerHoldEffect == sHoldEffectToType[i][0] && type == sHoldEffectToType[i][1]) {
        if (IS_TYPE_PHYSICAL(type))
            attack = (attack * (attackerHoldEffectParam + 100)) / 100;  // Usually +10%
        else
            spAttack = (spAttack * (attackerHoldEffectParam + 100)) / 100;
    }
}

// Choice Band: 1.5× Attack
if (attackerHoldEffect == HOLD_EFFECT_CHOICE_BAND)
    attack = (150 * attack) / 100;

// Soul Dew (Latias/Latios): 1.5× Sp.Atk and Sp.Def (not in Frontier)
if (attackerHoldEffect == HOLD_EFFECT_SOUL_DEW && !(gBattleTypeFlags & BATTLE_TYPE_FRONTIER))
    if (attacker->species == SPECIES_LATIAS || attacker->species == SPECIES_LATIOS)
        spAttack = (150 * spAttack) / 100;

// Deep Sea Tooth (Clamperl): 2× Sp.Atk
if (attackerHoldEffect == HOLD_EFFECT_DEEP_SEA_TOOTH && attacker->species == SPECIES_CLAMPERL)
    spAttack *= 2;

// Deep Sea Scale (Clamperl): 2× Sp.Def
if (defenderHoldEffect == HOLD_EFFECT_DEEP_SEA_SCALE && defender->species == SPECIES_CLAMPERL)
    spDefense *= 2;

// Light Ball (Pikachu): 2× Sp.Atk
if (attackerHoldEffect == HOLD_EFFECT_LIGHT_BALL && attacker->species == SPECIES_PIKACHU)
    spAttack *= 2;

// Metal Powder (Ditto): 2× Defense
if (defenderHoldEffect == HOLD_EFFECT_METAL_POWDER && defender->species == SPECIES_DITTO)
    defense *= 2;

// Thick Club (Cubone/Marowak): 2× Attack
if (attackerHoldEffect == HOLD_EFFECT_THICK_CLUB)
    if (attacker->species == SPECIES_CUBONE || attacker->species == SPECIES_MAROWAK)
        attack *= 2;
```

#### Field Effects

```c
// Mud Sport: 0.5× Electric power
if (type == TYPE_ELECTRIC && AbilityBattleEffects(ABILITYEFFECT_MUD_SPORT))
    gBattleMovePower /= 2;

// Water Sport: 0.5× Fire power
if (type == TYPE_FIRE && AbilityBattleEffects(ABILITYEFFECT_WATER_SPORT))
    gBattleMovePower /= 2;
```

#### Pinch Abilities

```c
// Overgrow: 1.5× Grass power at ≤1/3 HP
if (type == TYPE_GRASS && attacker->ability == ABILITY_OVERGROW)
    if (attacker->hp <= (attacker->maxHP / 3))
        gBattleMovePower = (150 * gBattleMovePower) / 100;

// Blaze: 1.5× Fire power at ≤1/3 HP
if (type == TYPE_FIRE && attacker->ability == ABILITY_BLAZE)
    if (attacker->hp <= (attacker->maxHP / 3))
        gBattleMovePower = (150 * gBattleMovePower) / 100;

// Torrent: 1.5× Water power at ≤1/3 HP
if (type == TYPE_WATER && attacker->ability == ABILITY_TORRENT)
    if (attacker->hp <= (attacker->maxHP / 3))
        gBattleMovePower = (150 * gBattleMovePower) / 100;

// Swarm: 1.5× Bug power at ≤1/3 HP
if (type == TYPE_BUG && attacker->ability == ABILITY_SWARM)
    if (attacker->hp <= (attacker->maxHP / 3))
        gBattleMovePower = (150 * gBattleMovePower) / 100;
```

### Step 5: Apply Stat Stages

Stat stages range from -6 to +6, with 0 being default:

```c
// Stat stage multipliers
const u8 gStatStageRatios[13][2] = {
    {25, 100},  // -6: 25/100 = 0.25×
    {28, 100},  // -5: 28/100 = 0.28×
    {33, 100},  // -4: 33/100 = 0.33×
    {40, 100},  // -3: 40/100 = 0.40×
    {50, 100},  // -2: 50/100 = 0.50×
    {66, 100},  // -1: 66/100 = 0.66×
    {100, 100}, //  0: 100/100 = 1.00×
    {150, 100}, // +1: 150/100 = 1.50×
    {200, 100}, // +2: 200/100 = 2.00×
    {250, 100}, // +3: 250/100 = 2.50×
    {300, 100}, // +4: 300/100 = 3.00×
    {350, 100}, // +5: 350/100 = 3.50×
    {400, 100}, // +6: 400/100 = 4.00×
};

#define APPLY_STAT_MOD(var, mon, stat, statIndex) { \
    (var) = (stat) * gStatStageRatios[(mon)->statStages[(statIndex)]][0]; \
    (var) /= gStatStageRatios[(mon)->statStages[(statIndex)]][1]; \
}
```

### Step 6: Explosion/Self-Destruct

```c
// Self-destruct and Explosion halve defense
if (gBattleMoves[gCurrentMove].effect == EFFECT_EXPLOSION)
    defense /= 2;
```

### Step 7: Critical Hit Handling

```c
// On critical hit, ignore negative attacker stages and positive defender stages
if (gCritMultiplier == 2) {
    // For attacker: only use stage if it's beneficial (> DEFAULT_STAT_STAGE)
    if (attacker->statStages[STAT_ATK] > DEFAULT_STAT_STAGE)
        APPLY_STAT_MOD(damage, attacker, attack, STAT_ATK)
    else
        damage = attack;

    // For defender: only use stage if it's detrimental (< DEFAULT_STAT_STAGE)
    if (defender->statStages[STAT_DEF] < DEFAULT_STAT_STAGE)
        APPLY_STAT_MOD(damageHelper, defender, defense, STAT_DEF)
    else
        damageHelper = defense;
}
```

### Step 8: Calculate Base Damage

```c
damage = damage * gBattleMovePower;
damage *= (2 * attacker->level / 5 + 2);
damage = damage / damageHelper;
damage /= 50;
```

### Step 9: Burn Penalty

```c
// Burn halves physical attack damage (unless Guts)
if ((attacker->status1 & STATUS1_BURN) && attacker->ability != ABILITY_GUTS)
    damage /= 2;
```

### Step 10: Screen Effects

```c
// Reflect halves physical damage (unless crit)
if ((sideStatus & SIDE_STATUS_REFLECT) && gCritMultiplier == 1) {
    if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) && CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2)
        damage = 2 * (damage / 3);  // 2/3 damage in doubles
    else
        damage /= 2;
}

// Light Screen halves special damage (unless crit)
if ((sideStatus & SIDE_STATUS_LIGHTSCREEN) && gCritMultiplier == 1) {
    if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE) && CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2)
        damage = 2 * (damage / 3);
    else
        damage /= 2;
}
```

### Step 11: Multi-Target Moves

```c
// Moves hitting both opponents deal 0.5× damage in doubles
if ((gBattleTypeFlags & BATTLE_TYPE_DOUBLE)
    && gBattleMoves[move].target == MOVE_TARGET_BOTH
    && CountAliveMonsInBattle(BATTLE_ALIVE_DEF_SIDE) == 2)
    damage /= 2;
```

### Step 12: Weather Effects

```c
if (WEATHER_HAS_EFFECT2) {
    // Rain: 0.5× Fire, 1.5× Water
    if (gBattleWeather & B_WEATHER_RAIN_TEMPORARY) {
        if (type == TYPE_FIRE)
            damage /= 2;
        else if (type == TYPE_WATER)
            damage = (15 * damage) / 10;
    }

    // Rain/Sandstorm/Hail weaken Solar Beam
    if ((gBattleWeather & (B_WEATHER_RAIN | B_WEATHER_SANDSTORM | B_WEATHER_HAIL))
        && gCurrentMove == MOVE_SOLAR_BEAM)
        damage /= 2;

    // Sun: 1.5× Fire, 0.5× Water
    if (gBattleWeather & B_WEATHER_SUN) {
        if (type == TYPE_FIRE)
            damage = (15 * damage) / 10;
        else if (type == TYPE_WATER)
            damage /= 2;
    }
}
```

### Step 13: Flash Fire

```c
// Flash Fire: 1.5× Fire damage when activated
if ((gBattleResources->flags->flags[battlerIdAtk] & RESOURCE_FLAG_FLASH_FIRE) && type == TYPE_FIRE)
    damage = (15 * damage) / 10;
```

### Step 14: Final Adjustment

```c
// Always add 2 at the end, ensuring minimum damage
return damage + 2;
```

## Post-Calculation Modifiers

After `CalculateBaseDamage()` returns, additional modifiers are applied in `Cmd_damagecalc()`:

```c
// Apply critical hit multiplier (2×)
gBattleMoveDamage = gBattleMoveDamage * gCritMultiplier * gBattleScripting.dmgMultiplier;

// Charge: 2× Electric damage
if (gStatuses3[gBattlerAttacker] & STATUS3_CHARGED_UP && gBattleMoves[gCurrentMove].type == TYPE_ELECTRIC)
    gBattleMoveDamage *= 2;

// Helping Hand: 1.5× damage
if (gProtectStructs[gBattlerAttacker].helpingHand)
    gBattleMoveDamage = gBattleMoveDamage * 15 / 10;
```

## Type Effectiveness

Applied separately after damage calculation:

```c
// Type effectiveness modifiers
TYPE_MUL_NO_EFFECT = 0       // 0×
TYPE_MUL_NOT_EFFECTIVE = 5   // 0.5×
TYPE_MUL_NORMAL = 10         // 1×
TYPE_MUL_SUPER_EFFECTIVE = 20 // 2×
```

See [Type Effectiveness](./02-type-effectiveness.md) for the full type chart.

## STAB (Same-Type Attack Bonus)

```c
// 1.5× damage if move type matches Pokemon type
if (type == attacker->type1 || type == attacker->type2)
    damage = (damage * 15) / 10;
```

## Random Modifier

A random factor from 85-100 is applied:

```c
// Random damage roll (85% to 100%)
damage = damage * (100 - (Random() % 16)) / 100;
```

## Minimum Damage

Attacks always deal at least 1 damage (unless type immunity).
