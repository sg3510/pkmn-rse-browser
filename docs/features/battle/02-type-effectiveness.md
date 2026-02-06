---
title: Type Effectiveness System
status: reference
last_verified: 2026-01-13
---

# Type Effectiveness System

The type effectiveness system is defined in `battle_main.c` as a 336-byte array called `gTypeEffectiveness`.

## Type Constants

```c
// include/constants/pokemon.h
#define TYPE_NORMAL   0
#define TYPE_FIGHTING 1
#define TYPE_FLYING   2
#define TYPE_POISON   3
#define TYPE_GROUND   4
#define TYPE_ROCK     5
#define TYPE_BUG      6
#define TYPE_GHOST    7
#define TYPE_STEEL    8
#define TYPE_MYSTERY  9  // ??? type - deals 0 damage
#define TYPE_FIRE     10
#define TYPE_WATER    11
#define TYPE_GRASS    12
#define TYPE_ELECTRIC 13
#define TYPE_PSYCHIC  14
#define TYPE_ICE      15
#define TYPE_DRAGON   16
#define TYPE_DARK     17

#define NUMBER_OF_MON_TYPES 18
```

## Effectiveness Multipliers

```c
// include/constants/battle.h
#define TYPE_MUL_NO_EFFECT      0   // 0× (immune)
#define TYPE_MUL_NOT_EFFECTIVE  5   // 0.5× (resisted)
#define TYPE_MUL_NORMAL         10  // 1× (neutral)
#define TYPE_MUL_SUPER_EFFECTIVE 20 // 2× (super effective)
```

## Type Effectiveness Table Format

The table is stored as triplets: `[ATTACK_TYPE, DEFEND_TYPE, MULTIPLIER]`

```c
// Format: ATK_TYPE, DEF_TYPE, MULTIPLIER
const u8 gTypeEffectiveness[336] = {
    TYPE_NORMAL, TYPE_ROCK, TYPE_MUL_NOT_EFFECTIVE,     // Normal -> Rock: 0.5×
    TYPE_NORMAL, TYPE_STEEL, TYPE_MUL_NOT_EFFECTIVE,    // Normal -> Steel: 0.5×
    // ... etc
    TYPE_ENDTABLE, TYPE_ENDTABLE, TYPE_MUL_NO_EFFECT    // End marker
## Source Files

- **Type Chart**: `src/battle_main.c` (line 335-449)
- **Type Constants**: `include/constants/pokemon.h`
- **Type Calculation**: `src/battle_script_commands.c` (Cmd_typecalc)
- **Type Macros**: `include/battle_main.h`

## Type Constants

From `include/constants/pokemon.h`:

```c
#define TYPE_NONE             255
#define TYPE_NORMAL           0
#define TYPE_FIGHTING         1
#define TYPE_FLYING           2
#define TYPE_POISON           3
#define TYPE_GROUND           4
#define TYPE_ROCK             5
#define TYPE_BUG              6
#define TYPE_GHOST            7
#define TYPE_STEEL            8
#define TYPE_MYSTERY          9   // ??? type
#define TYPE_FIRE             10
#define TYPE_WATER            11
#define TYPE_GRASS            12
#define TYPE_ELECTRIC         13
#define TYPE_PSYCHIC          14
#define TYPE_ICE              15
#define TYPE_DRAGON           16
#define TYPE_DARK             17
#define NUMBER_OF_MON_TYPES   18
```

## Type Multiplier Constants

From `include/battle_main.h`:

```c
#define TYPE_MUL_NO_EFFECT          0   // x0.0 (immune)
#define TYPE_MUL_NOT_EFFECTIVE      5   // x0.5 (resisted)
#define TYPE_MUL_NORMAL             10  // x1.0 (neutral)
#define TYPE_MUL_SUPER_EFFECTIVE    20  // x2.0 (super effective)

// Special markers in type table
#define TYPE_FORESIGHT  0xFE  // Foresight/Odor Sleuth removes immunity
#define TYPE_ENDTABLE   0xFF  // End of type effectiveness table
```

## Type Effectiveness Table

From `src/battle_main.c`:

The table is stored as triplets: `[AttackType, DefenseType, Multiplier]`

```c
const u8 gTypeEffectiveness[336] = {
    // Normal attacks
    TYPE_NORMAL, TYPE_ROCK, TYPE_MUL_NOT_EFFECTIVE,      // Normal vs Rock = 0.5x
    TYPE_NORMAL, TYPE_STEEL, TYPE_MUL_NOT_EFFECTIVE,     // Normal vs Steel = 0.5x

    // Fire attacks
    TYPE_FIRE, TYPE_FIRE, TYPE_MUL_NOT_EFFECTIVE,        // Fire vs Fire = 0.5x
    TYPE_FIRE, TYPE_WATER, TYPE_MUL_NOT_EFFECTIVE,       // Fire vs Water = 0.5x
    TYPE_FIRE, TYPE_GRASS, TYPE_MUL_SUPER_EFFECTIVE,     // Fire vs Grass = 2x
    TYPE_FIRE, TYPE_ICE, TYPE_MUL_SUPER_EFFECTIVE,       // Fire vs Ice = 2x
    TYPE_FIRE, TYPE_BUG, TYPE_MUL_SUPER_EFFECTIVE,       // Fire vs Bug = 2x
    TYPE_FIRE, TYPE_ROCK, TYPE_MUL_NOT_EFFECTIVE,        // Fire vs Rock = 0.5x
    TYPE_FIRE, TYPE_DRAGON, TYPE_MUL_NOT_EFFECTIVE,      // Fire vs Dragon = 0.5x
    TYPE_FIRE, TYPE_STEEL, TYPE_MUL_SUPER_EFFECTIVE,     // Fire vs Steel = 2x

    // ... (full table continues)

    // Immunities (after TYPE_FORESIGHT marker)
    TYPE_FORESIGHT, TYPE_FORESIGHT, TYPE_MUL_NO_EFFECT,  // Marker
    TYPE_NORMAL, TYPE_GHOST, TYPE_MUL_NO_EFFECT,         // Normal vs Ghost = 0x
    TYPE_FIGHTING, TYPE_GHOST, TYPE_MUL_NO_EFFECT,       // Fighting vs Ghost = 0x
    TYPE_ENDTABLE, TYPE_ENDTABLE, TYPE_MUL_NO_EFFECT     // End marker
};
```

## Complete Type Chart

### Super Effective (2×)

| Attacking Type | Super Effective Against |
|---------------|------------------------|
| **Normal** | — |
| **Fighting** | Normal, Ice, Rock, Dark, Steel |
| **Flying** | Grass, Fighting, Bug |
| **Poison** | Grass |
| **Ground** | Fire, Electric, Poison, Rock, Steel |
| **Rock** | Fire, Ice, Flying, Bug |
| **Bug** | Grass, Psychic, Dark |
| **Ghost** | Psychic, Ghost |
| **Steel** | Ice, Rock |
| **Fire** | Grass, Ice, Bug, Steel |
| **Water** | Fire, Ground, Rock |
| **Grass** | Water, Ground, Rock |
| **Electric** | Water, Flying |
| **Psychic** | Fighting, Poison |
| **Ice** | Grass, Ground, Flying, Dragon |
| **Dragon** | Dragon |
| **Dark** | Psychic, Ghost |

### Not Very Effective (0.5×)

| Attacking Type | Resisted By |
|---------------|-------------|
| **Normal** | Rock, Steel |
| **Fighting** | Poison, Flying, Psychic, Bug |
| **Flying** | Electric, Rock, Steel |
| **Poison** | Poison, Ground, Rock, Ghost |
| **Ground** | Grass, Bug |
| **Rock** | Fighting, Ground, Steel |
| **Bug** | Fire, Fighting, Poison, Flying, Ghost, Steel |
| **Ghost** | Dark, Steel |
| **Steel** | Fire, Water, Electric, Steel |
| **Fire** | Fire, Water, Rock, Dragon |
| **Water** | Water, Grass, Dragon |
| **Grass** | Fire, Grass, Poison, Flying, Bug, Dragon, Steel |
| **Electric** | Electric, Grass, Dragon |
| **Psychic** | Psychic, Steel |
| **Ice** | Fire, Water, Ice, Steel |
| **Dragon** | Steel |
| **Dark** | Fighting, Dark, Steel |

### Immunities (0×)

| Attacking Type | Immune Types |
|---------------|--------------|
| **Normal** | Ghost |
| **Fighting** | Ghost |
| **Poison** | Steel |
| **Ground** | Flying |
| **Ghost** | Normal |
| **Electric** | Ground |
| **Psychic** | Dark |

## Foresight and Odor Sleuth

The type chart includes special entries for Foresight/Odor Sleuth:

```c
TYPE_FORESIGHT, TYPE_FORESIGHT, TYPE_MUL_NO_EFFECT,  // End marker for foresight
TYPE_NORMAL, TYPE_GHOST, TYPE_MUL_NO_EFFECT,         // Normal -> Ghost: immune
TYPE_FIGHTING, TYPE_GHOST, TYPE_MUL_NO_EFFECT,       // Fighting -> Ghost: immune
```

When Foresight is active, the lookup stops at `TYPE_FORESIGHT` marker, skipping the Ghost immunities.

## Type Effectiveness Calculation

Located in `battle_script_commands.c`:

```c
u8 TypeCalc(u16 move, u8 attacker, u8 defender)
{
    s32 i = 0;
    u8 moveType;
    u8 defType1, defType2;
    u8 flags = 0;
    u8 modifier = TYPE_MUL_NORMAL; // Start at 1× (10)

    // Get move type (handle Hidden Power, etc.)
    if (gBattleStruct->dynamicMoveType)
        moveType = gBattleStruct->dynamicMoveType & DYNAMIC_TYPE_MASK;
    else
        moveType = gBattleMoves[move].type;

    // Status moves don't check type effectiveness for damage
    if (gBattleMoves[move].power == 0)
        return 0;

    defType1 = gBattleMons[defender].type1;
    defType2 = gBattleMons[defender].type2;

    // Roost removes Flying type temporarily
    if (gStatuses3[defender] & STATUS3_ROOST && defType1 == TYPE_FLYING)
        defType1 = TYPE_NORMAL;
    if (gStatuses3[defender] & STATUS3_ROOST && defType2 == TYPE_FLYING)
        defType2 = TYPE_NORMAL;

    // Iterate through type chart
    while (gTypeEffectiveness[i] != TYPE_ENDTABLE) {
        // Handle Foresight
        if (gTypeEffectiveness[i] == TYPE_FORESIGHT) {
            if (gBattleMons[defender].status2 & STATUS2_FORESIGHT)
                break;  // Skip remaining immunities
            i += 3;
            continue;
        }

        // Check if this entry matches
        if (gTypeEffectiveness[i] == moveType) {
            // Check against first type
            if (gTypeEffectiveness[i + 1] == defType1) {
                modifier = (modifier * gTypeEffectiveness[i + 2]) / TYPE_MUL_NORMAL;
                if (gTypeEffectiveness[i + 2] == TYPE_MUL_NO_EFFECT)
                    flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
                else if (gTypeEffectiveness[i + 2] == TYPE_MUL_NOT_EFFECTIVE)
                    flags |= MOVE_RESULT_NOT_VERY_EFFECTIVE;
                else if (gTypeEffectiveness[i + 2] == TYPE_MUL_SUPER_EFFECTIVE)
                    flags |= MOVE_RESULT_SUPER_EFFECTIVE;
            }
            // Check against second type (if different)
            if (defType1 != defType2 && gTypeEffectiveness[i + 1] == defType2) {
                modifier = (modifier * gTypeEffectiveness[i + 2]) / TYPE_MUL_NORMAL;
                if (gTypeEffectiveness[i + 2] == TYPE_MUL_NO_EFFECT)
                    flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
                else if (gTypeEffectiveness[i + 2] == TYPE_MUL_NOT_EFFECTIVE)
                    flags |= MOVE_RESULT_NOT_VERY_EFFECTIVE;
                else if (gTypeEffectiveness[i + 2] == TYPE_MUL_SUPER_EFFECTIVE)
                    flags |= MOVE_RESULT_SUPER_EFFECTIVE;
            }
        }
        i += 3;
    }

    // Apply to damage
    gBattleMoveDamage = gBattleMoveDamage * modifier / TYPE_MUL_NORMAL;

    return flags;
}
```

## Dual Type Effectiveness

For dual-type Pokemon, multipliers stack multiplicatively:

| Scenario | Calculation | Result |
|----------|-------------|--------|
| 2× and 2× | 20 × 20 / 10 = 40 | 4× |
| 2× and 1× | 20 × 10 / 10 = 20 | 2× |
| 2× and 0.5× | 20 × 5 / 10 = 10 | 1× |
| 0.5× and 0.5× | 5 × 5 / 10 = 2.5 | 0.25× |
| Any × 0 | x × 0 / 10 = 0 | 0× |

## Ability Type Interactions

### Levitate
```c
// Ground immunity from Levitate
if (defender->ability == ABILITY_LEVITATE && moveType == TYPE_GROUND)
    flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
```

### Wonder Guard
```c
// Only super effective moves hit
if (defender->ability == ABILITY_WONDER_GUARD) {
    if (!(flags & MOVE_RESULT_SUPER_EFFECTIVE))
        flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
}
```

### Flash Fire
```c
// Fire immunity, activates Flash Fire
if (defender->ability == ABILITY_FLASH_FIRE && moveType == TYPE_FIRE) {
    gBattleResources->flags->flags[defender] |= RESOURCE_FLAG_FLASH_FIRE;
    flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
}
```

### Volt Absorb / Water Absorb
```c
// Electric/Water immunity, heals user
if (defender->ability == ABILITY_VOLT_ABSORB && moveType == TYPE_ELECTRIC)
    flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
if (defender->ability == ABILITY_WATER_ABSORB && moveType == TYPE_WATER)
    flags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
```

### Thick Fat
```c
// Halves Fire/Ice special attack (applied in damage calc, not type calc)
if (defender->ability == ABILITY_THICK_FAT && (type == TYPE_FIRE || type == TYPE_ICE))
    spAttack /= 2;
```

## Type Name Strings

```c
const u8 gTypeNames[NUMBER_OF_MON_TYPES][TYPE_NAME_LENGTH + 1] = {
    [TYPE_NORMAL]   = _("NORMAL"),
    [TYPE_FIGHTING] = _("FIGHT"),
    [TYPE_FLYING]   = _("FLYING"),
    [TYPE_POISON]   = _("POISON"),
    [TYPE_GROUND]   = _("GROUND"),
    [TYPE_ROCK]     = _("ROCK"),
    [TYPE_BUG]      = _("BUG"),
    [TYPE_GHOST]    = _("GHOST"),
    [TYPE_STEEL]    = _("STEEL"),
    [TYPE_MYSTERY]  = _("???"),
    [TYPE_FIRE]     = _("FIRE"),
    [TYPE_WATER]    = _("WATER"),
    [TYPE_GRASS]    = _("GRASS"),
    [TYPE_ELECTRIC] = _("ELECTRIC"),
    [TYPE_PSYCHIC]  = _("PSYCHIC"),
    [TYPE_ICE]      = _("ICE"),
    [TYPE_DRAGON]   = _("DRAGON"),
    [TYPE_DARK]     = _("DARK"),
};
```

## Implementation Notes for React

When implementing type effectiveness in TypeScript:

```typescript
interface TypeEffectiveness {
  attackType: number;
  defendType: number;
  multiplier: number; // 0, 5, 10, or 20
}

const TYPE_CHART: TypeEffectiveness[] = [
  { attackType: TYPE_NORMAL, defendType: TYPE_ROCK, multiplier: 5 },
  { attackType: TYPE_NORMAL, defendType: TYPE_STEEL, multiplier: 5 },
  // ... complete chart
];

function calculateTypeEffectiveness(
  moveType: number,
  defenderType1: number,
  defenderType2: number
): { multiplier: number; flags: number } {
  let modifier = 10; // 1×
  let flags = 0;

  for (const entry of TYPE_CHART) {
    if (entry.attackType === moveType) {
      if (entry.defendType === defenderType1) {
        modifier = (modifier * entry.multiplier) / 10;
        // Set flags...
      }
      if (defenderType1 !== defenderType2 && entry.defendType === defenderType2) {
        modifier = (modifier * entry.multiplier) / 10;
        // Set flags...
      }
    }
  }

  return { multiplier: modifier, flags };
### Super Effective (2x Damage)

| Attack Type | Super Effective Against |
|-------------|------------------------|
| Normal | - |
| Fighting | Normal, Ice, Rock, Dark, Steel |
| Flying | Grass, Fighting, Bug |
| Poison | Grass |
| Ground | Fire, Electric, Poison, Rock, Steel |
| Rock | Fire, Ice, Flying, Bug |
| Bug | Grass, Psychic, Dark |
| Ghost | Psychic, Ghost |
| Steel | Ice, Rock |
| Fire | Grass, Ice, Bug, Steel |
| Water | Fire, Ground, Rock |
| Grass | Water, Ground, Rock |
| Electric | Water, Flying |
| Psychic | Fighting, Poison |
| Ice | Grass, Ground, Flying, Dragon |
| Dragon | Dragon |
| Dark | Psychic, Ghost |

### Not Very Effective (0.5x Damage)

| Attack Type | Resisted By |
|-------------|-------------|
| Normal | Rock, Steel |
| Fighting | Poison, Flying, Psychic, Bug |
| Flying | Electric, Rock, Steel |
| Poison | Poison, Ground, Rock, Ghost |
| Ground | Grass, Bug |
| Rock | Fighting, Ground, Steel |
| Bug | Fire, Fighting, Poison, Flying, Ghost, Steel |
| Ghost | Dark, Steel |
| Steel | Fire, Water, Electric, Steel |
| Fire | Fire, Water, Rock, Dragon |
| Water | Water, Grass, Dragon |
| Grass | Fire, Grass, Poison, Flying, Bug, Dragon, Steel |
| Electric | Grass, Electric, Dragon |
| Psychic | Psychic, Steel |
| Ice | Fire, Water, Ice, Steel |
| Dragon | Steel |
| Dark | Fighting, Dark, Steel |

### Immunities (0x Damage)

| Attack Type | Immune Types |
|-------------|--------------|
| Normal | Ghost |
| Fighting | Ghost |
| Ground | Flying |
| Electric | Ground |
| Poison | Steel |
| Psychic | Dark |
| Ghost | Normal |

## Type Calculation Logic

From `src/battle_script_commands.c`:

```c
static void Cmd_typecalc(void)
{
    s32 i = 0;
    u8 moveType;

    if (gCurrentMove == MOVE_STRUGGLE) {
        gBattlescriptCurrInstr++;
        return;  // Struggle has no type
    }

    GET_MOVE_TYPE(gCurrentMove, moveType);

    // Check STAB (Same Type Attack Bonus)
    if (IS_BATTLER_OF_TYPE(gBattlerAttacker, moveType)) {
        gBattleMoveDamage = gBattleMoveDamage * 15 / 10;  // 1.5x
    }

    // Check Levitate ability
    if (gBattleMons[gBattlerTarget].ability == ABILITY_LEVITATE
        && moveType == TYPE_GROUND) {
        gMoveResultFlags |= (MOVE_RESULT_MISSED | MOVE_RESULT_DOESNT_AFFECT_FOE);
        gBattleCommunication[MISS_TYPE] = B_MSG_GROUND_MISS;
        RecordAbilityBattle(gBattlerTarget, gLastUsedAbility);
    }
    else {
        // Iterate through type effectiveness table
        while (TYPE_EFFECT_ATK_TYPE(i) != TYPE_ENDTABLE) {
            if (TYPE_EFFECT_ATK_TYPE(i) == TYPE_FORESIGHT) {
                // Foresight removes Ghost immunity
                if (gBattleMons[gBattlerTarget].status2 & STATUS2_FORESIGHT)
                    break;
                i += 3;
                continue;
            }

            if (TYPE_EFFECT_ATK_TYPE(i) == moveType) {
                // Check defender's first type
                if (TYPE_EFFECT_DEF_TYPE(i) == gBattleMons[gBattlerTarget].types[0])
                    ModulateDmgByType(TYPE_EFFECT_MULTIPLIER(i));

                // Check defender's second type (if different)
                if (TYPE_EFFECT_DEF_TYPE(i) == gBattleMons[gBattlerTarget].types[1] &&
                    gBattleMons[gBattlerTarget].types[0] != gBattleMons[gBattlerTarget].types[1])
                    ModulateDmgByType(TYPE_EFFECT_MULTIPLIER(i));
            }
            i += 3;
        }
    }

    // Wonder Guard check - only super effective moves hit
    if (gBattleMons[gBattlerTarget].ability == ABILITY_WONDER_GUARD
        && !(gMoveResultFlags & MOVE_RESULT_SUPER_EFFECTIVE)
        && gBattleMoves[gCurrentMove].power) {
        gMoveResultFlags |= MOVE_RESULT_MISSED;
        gBattleCommunication[MISS_TYPE] = B_MSG_AVOIDED_DMG;
    }
}
```

## Damage Modulation

```c
static void ModulateDmgByType(u8 multiplier)
{
    gBattleMoveDamage = gBattleMoveDamage * multiplier / 10;
    if (gBattleMoveDamage == 0 && multiplier != 0)
        gBattleMoveDamage = 1;  // Minimum 1 damage

    switch (multiplier) {
    case TYPE_MUL_NO_EFFECT:  // 0
        gMoveResultFlags |= MOVE_RESULT_DOESNT_AFFECT_FOE;
        gMoveResultFlags &= ~MOVE_RESULT_NOT_VERY_EFFECTIVE;
        gMoveResultFlags &= ~MOVE_RESULT_SUPER_EFFECTIVE;
        break;

    case TYPE_MUL_NOT_EFFECTIVE:  // 5
        if (gMoveResultFlags & MOVE_RESULT_SUPER_EFFECTIVE)
            gMoveResultFlags &= ~MOVE_RESULT_SUPER_EFFECTIVE;  // Cancel out
        else
            gMoveResultFlags |= MOVE_RESULT_NOT_VERY_EFFECTIVE;
        break;

    case TYPE_MUL_SUPER_EFFECTIVE:  // 20
        if (gMoveResultFlags & MOVE_RESULT_NOT_VERY_EFFECTIVE)
            gMoveResultFlags &= ~MOVE_RESULT_NOT_VERY_EFFECTIVE;  // Cancel out
        else
            gMoveResultFlags |= MOVE_RESULT_SUPER_EFFECTIVE;
        break;
    }
}
```

## Dual Type Damage Calculation

For dual-type Pokemon, multiply effectiveness:

| First Type | Second Type | Combined |
|------------|-------------|----------|
| 2x | 2x | 4x |
| 2x | 1x | 2x |
| 2x | 0.5x | 1x |
| 0.5x | 0.5x | 0.25x |
| 0x | any | 0x |

Example: Fire attack vs Grass/Steel (Ferrothorn)
- Fire vs Grass = 2x
- Fire vs Steel = 2x
- Combined = 4x damage

## TypeScript Implementation

```typescript
const TYPE_CHART: Record<PokemonType, Record<PokemonType, number>> = {
  [Type.NORMAL]: {
    [Type.ROCK]: 0.5,
    [Type.STEEL]: 0.5,
    [Type.GHOST]: 0,
  },
  [Type.FIRE]: {
    [Type.FIRE]: 0.5,
    [Type.WATER]: 0.5,
    [Type.GRASS]: 2,
    [Type.ICE]: 2,
    [Type.BUG]: 2,
    [Type.ROCK]: 0.5,
    [Type.DRAGON]: 0.5,
    [Type.STEEL]: 2,
  },
  // ... rest of chart
};

function calculateTypeEffectiveness(
  moveType: PokemonType,
  defenderTypes: [PokemonType, PokemonType?],
  hasForesight: boolean = false
): number {
  let multiplier = 1;

  for (const defType of defenderTypes) {
    if (defType === undefined) continue;

    const effectiveness = TYPE_CHART[moveType]?.[defType] ?? 1;

    // Foresight removes Normal/Fighting immunity to Ghost
    if (hasForesight && defType === Type.GHOST &&
        (moveType === Type.NORMAL || moveType === Type.FIGHTING)) {
      continue;
    }

    multiplier *= effectiveness;
  }

  return multiplier;
}

function applySTAB(
  damage: number,
  moveType: PokemonType,
  attackerTypes: [PokemonType, PokemonType?]
): number {
  if (attackerTypes.includes(moveType)) {
    return Math.floor(damage * 1.5);
  }
  return damage;
}
```
