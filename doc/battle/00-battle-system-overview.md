# Pokemon Emerald Battle System Overview

This documentation provides a comprehensive analysis of the Pokemon Emerald battle system, specifically focused on the moves mechanics for simulation purposes.

## Source Code Structure

The battle system is implemented across multiple files in the `public/pokeemerald/` directory:

### Core Battle Files

| File | Purpose |
|------|---------|
| `src/battle_main.c` | Main battle loop, initialization, turn order |
| `src/battle_script_commands.c` | Battle script command implementations |
| `src/battle_util.c` | Utility functions (target selection, ability effects) |
| `src/battle_message.c` | Battle message display and formatting |
| `src/pokemon.c` | Damage calculation, stat calculations |
| `data/battle_scripts_1.s` | Move effect scripts (assembly) |
| `data/battle_anim_scripts.s` | Move animation scripts |

### Header Files

| File | Purpose |
|------|---------|
| `include/battle.h` | Battle structures, move targets |
| `include/battle_main.h` | Type effectiveness macros |
| `include/constants/battle.h` | Battle flags, status conditions |
| `include/constants/moves.h` | Move ID constants |
| `include/constants/battle_move_effects.h` | Move effect constants |
| `include/constants/battle_string_ids.h` | Message string IDs |
| `include/constants/pokemon.h` | Type constants, stats |

## Battle Flow Overview

```
┌────────────────────────────────────────────────────────────────┐
│                      BATTLE TURN FLOW                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. TURN START                                                 │
│     └─> Pre-turn effects (weather damage, status)              │
│                                                                │
│  2. ACTION SELECTION                                           │
│     ├─> Player chooses action (Fight/Bag/Pokemon/Run)         │
│     └─> AI/Opponent chooses action                            │
│                                                                │
│  3. TURN ORDER DETERMINATION                                   │
│     ├─> Compare Speed stats                                    │
│     ├─> Priority move check (+1, +5, etc.)                    │
│     └─> Quick Claw/random speed ties                          │
│                                                                │
│  4. MOVE EXECUTION (per battler in order)                     │
│     ├─> attackcanceler - Can the move execute?                │
│     ├─> accuracycheck - Does the move hit?                    │
│     ├─> critcalc - Critical hit determination                 │
│     ├─> damagecalc - Base damage calculation                  │
│     ├─> typecalc - Type effectiveness & STAB                  │
│     ├─> attackanimation - Play move animation                 │
│     ├─> healthbarupdate - Update HP display                   │
│     ├─> resultmessage - Show effectiveness message            │
│     ├─> seteffectwithchance - Apply secondary effects         │
│     └─> tryfaintmon - Check if target fainted                 │
│                                                                │
│  5. TURN END                                                   │
│     ├─> End-of-turn effects (Leftovers, poison damage)        │
│     └─> Check for battle end conditions                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Key Data Structures

### BattlePokemon Structure
```c
struct BattlePokemon {
    u16 species;
    u16 attack;
    u16 defense;
    u16 speed;
    u16 spAttack;
    u16 spDefense;
    u16 moves[MAX_MON_MOVES];  // 4 moves
    u32 hp;
    u32 maxHP;
    u16 item;
    u8 ppBonuses;
    u8 friendship;
    u8 pp[MAX_MON_MOVES];
    u8 statStages[NUM_BATTLE_STATS];  // -6 to +6
    u8 ability;
    u8 types[2];
    u8 status1;   // Non-volatile (sleep, poison, burn, etc.)
    u32 status2;  // Volatile (confusion, flinch, etc.)
};
```

### BattleMove Structure
```c
struct BattleMove {
    u8 effect;        // Move effect ID (determines script)
    u8 power;         // Base power (0-255)
    u8 type;          // Pokemon type
    u8 accuracy;      // Accuracy percentage
    u8 pp;            // Power Points
    u8 secondaryEffectChance;  // % chance of secondary effect
    u8 target;        // Targeting flags
    s8 priority;      // Move priority (-7 to +5)
    u8 flags;         // Contact, sound, etc.
};
```

## Global Battle Variables

| Variable | Type | Description |
|----------|------|-------------|
| `gBattlerAttacker` | u8 | Current attacking battler ID |
| `gBattlerTarget` | u8 | Current target battler ID |
| `gCurrentMove` | u16 | Move being executed |
| `gBattleMoveDamage` | s32 | Calculated damage |
| `gMoveResultFlags` | u8 | Hit/miss, effectiveness flags |
| `gCritMultiplier` | u8 | 1 = normal, 2 = critical hit |
| `gBattleTypeFlags` | u32 | Battle type (single/double/etc.) |
| `gBattleWeather` | u16 | Current weather conditions |

## Documentation Index

1. **[Move Data Structures](./01-move-data-structures.md)** - Move definitions, effects, flags
2. **[Type Effectiveness](./02-type-effectiveness.md)** - Type matchup chart and mechanics
3. **[Damage Calculation](./03-damage-calculation.md)** - Complete damage formula
4. **[Battle Scripts](./04-battle-scripts.md)** - Script commands and move execution
5. **[Battle Messages](./05-battle-messages.md)** - All battle text messages
6. **[Animation System](./06-animation-system.md)** - Animation references and timing
7. **[Double Battles](./07-double-battles.md)** - Multi-target and partner mechanics
8. **[React Implementation](./08-react-implementation.md)** - Implementation guide
