# Type Effectiveness System

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
