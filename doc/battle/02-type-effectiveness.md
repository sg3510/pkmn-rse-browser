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
}
```
