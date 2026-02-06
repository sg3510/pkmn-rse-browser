---
title: Pokemon Emerald Battle System Overview
status: reference
last_verified: 2026-01-13
---

# Pokemon Emerald Battle System Overview

This documentation provides a comprehensive analysis of the Pokemon Emerald battle system based on the pokeemerald decompilation source code. The goal is to understand all mechanics well enough to simulate battles from start to finish.

## Table of Contents

1. [Damage Calculation](./01-damage-calculation.md) - Complete damage formula
2. [Type Effectiveness](./02-type-effectiveness.md) - Type chart and mechanics
3. [Pokemon Stats](./03-pokemon-stats.md) - Stats, IVs, EVs, and calculations
4. [Moves and Effects](./04-moves-and-effects.md) - Move data structure and 214 effects
5. [Capture Mechanics](./05-capture-mechanics.md) - Catch rate formula and ball bonuses
6. [Battle Flow](./06-battle-flow.md) - Turn-by-turn battle execution
7. [Battle Messages](./07-battle-messages.md) - Message system and string IDs
8. [Battle UI](./08-battle-ui.md) - Health bars, menus, and interface
9. [Battle Animations](./09-battle-animations.md) - Animation system and sprites
10. [AI System](./10-ai-system.md) - Trainer AI and decision making
11. [Special Battles](./11-special-battles.md) - Safari Zone, Battle Frontier
12. [Source Files Reference](./12-source-files.md) - Index of all relevant files
13. [React Implementation Plan](./13-react-implementation.md) - How to implement in React

## Battle Types

The battle system supports multiple battle types, defined by flags in `gBattleTypeFlags`:

| Flag | Hex | Description |
|------|-----|-------------|
| `BATTLE_TYPE_DOUBLE` | 0x0001 | Double battle (2v2) |
| `BATTLE_TYPE_LINK` | 0x0002 | Link cable battle |
| `BATTLE_TYPE_IS_MASTER` | 0x0004 | Is master in link battle |
| `BATTLE_TYPE_TRAINER` | 0x0008 | Trainer battle (vs wild) |
| `BATTLE_TYPE_FIRST_BATTLE` | 0x0010 | First battle tutorial |
| `BATTLE_TYPE_MULTI` | 0x0040 | Multi battle |
| `BATTLE_TYPE_SAFARI` | 0x0080 | Safari Zone |
| `BATTLE_TYPE_BATTLE_TOWER` | 0x0100 | Battle Tower |
| `BATTLE_TYPE_WALLY_TUTORIAL` | 0x0200 | Wally catching tutorial |
| `BATTLE_TYPE_ROAMER` | 0x0400 | Roaming legendary |
| `BATTLE_TYPE_EREADER_TRAINER` | 0x0800 | E-Reader trainer |
| `BATTLE_TYPE_KYOGRE_GROUDON` | 0x1000 | Kyogre/Groudon battle |
| `BATTLE_TYPE_LEGENDARY` | 0x2000 | Legendary Pokemon |
| `BATTLE_TYPE_REGI` | 0x4000 | Regi Pokemon |
| `BATTLE_TYPE_TWO_OPPONENTS` | 0x8000 | Two opponent trainers |
| `BATTLE_TYPE_DOME` | 0x10000 | Battle Dome |
| `BATTLE_TYPE_PALACE` | 0x20000 | Battle Palace |
| `BATTLE_TYPE_ARENA` | 0x40000 | Battle Arena |
| `BATTLE_TYPE_FACTORY` | 0x80000 | Battle Factory |
| `BATTLE_TYPE_PIKE` | 0x100000 | Battle Pike |
| `BATTLE_TYPE_PYRAMID` | 0x200000 | Battle Pyramid |
| `BATTLE_TYPE_INGAME_PARTNER` | 0x400000 | In-game partner |
| `BATTLE_TYPE_RECORDED` | 0x1000000 | Recorded battle |
| `BATTLE_TYPE_TRAINER_HILL` | 0x4000000 | Trainer Hill |
| `BATTLE_TYPE_SECRET_BASE` | 0x8000000 | Secret Base |
| `BATTLE_TYPE_GROUDON` | 0x10000000 | Groudon specifically |
| `BATTLE_TYPE_KYOGRE` | 0x20000000 | Kyogre specifically |
| `BATTLE_TYPE_RAYQUAZA` | 0x40000000 | Rayquaza |
| `BATTLE_TYPE_WILD_SCRIPTED` | 0x80000000 | Scripted wild battle |

## Core Battle Flow

```
┌─────────────────────────────────────────────────────┐
│                 BATTLE START                         │
├─────────────────────────────────────────────────────┤
│  1. Battle Setup (battle_setup.c)                   │
│     - Initialize battle type flags                   │
│     - Load player and enemy parties                  │
│     - Set up battle transition                       │
├─────────────────────────────────────────────────────┤
│  2. Battle Introduction (battle_main.c)             │
│     - Play transition animation                      │
│     - Draw background                                │
│     - Send out Pokemon                               │
│     - Display intro messages                         │
├─────────────────────────────────────────────────────┤
│  3. Turn Loop                                        │
│     ┌──────────────────────────────────────────┐    │
│     │  A. Action Selection                      │    │
│     │     - Player: Choose Fight/Bag/Pokemon/Run│    │
│     │     - AI: Select action via AI scripts    │    │
│     ├──────────────────────────────────────────┤    │
│     │  B. Turn Order Determination              │    │
│     │     - Compare Speed stats                 │    │
│     │     - Apply priority moves                │    │
│     │     - Random tie-breaker                  │    │
│     ├──────────────────────────────────────────┤    │
│     │  C. Action Execution                      │    │
│     │     - Execute moves in order              │    │
│     │     - Calculate damage                    │    │
│     │     - Apply effects                       │    │
│     │     - Display messages                    │    │
│     ├──────────────────────────────────────────┤    │
│     │  D. End-of-Turn Effects                   │    │
│     │     - Weather damage                      │    │
│     │     - Status damage (burn, poison)        │    │
│     │     - Leech Seed, wrap damage             │    │
│     │     - Ability triggers                    │    │
│     └──────────────────────────────────────────┘    │
│     Loop until battle ends                          │
├─────────────────────────────────────────────────────┤
│  4. Battle End                                       │
│     - Determine winner                               │
│     - Award experience (trainer battles: 1.5x)      │
│     - Award money                                    │
│     - Update Pokedex                                │
│     - Run post-battle scripts                       │
└─────────────────────────────────────────────────────┘
```

## Key Global Variables

| Variable | Type | Description |
|----------|------|-------------|
| `gBattleMons[4]` | BattlePokemon[] | Active Pokemon in battle |
| `gPlayerParty[6]` | Pokemon[] | Player's party |
| `gEnemyParty[6]` | Pokemon[] | Enemy's party |
| `gBattleTypeFlags` | u32 | Battle type flags |
| `gBattlerAttacker` | u8 | Current attacker battler ID |
| `gBattlerTarget` | u8 | Current target battler ID |
| `gCurrentMove` | u16 | Move being executed |
| `gBattleMoveDamage` | s32 | Calculated damage |
| `gCritMultiplier` | u8 | 1 or 2 for crit |
| `gBattleWeather` | u16 | Active weather flags |
| `gMoveResultFlags` | u8 | Move hit/miss/effectiveness |
| `gBattleOutcome` | u8 | Battle result |
| `gBattleResults` | BattleResults | Statistics for the battle |

## Battler Positions

```
Single Battle:
  Position 0: Player's Pokemon (B_POSITION_PLAYER_LEFT)
  Position 1: Enemy's Pokemon (B_POSITION_OPPONENT_LEFT)

Double Battle:
  Position 0: Player's Left Pokemon
  Position 1: Enemy's Left Pokemon
  Position 2: Player's Right Pokemon
  Position 3: Enemy's Right Pokemon
```

## Battle Outcome Values

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | - | Battle ongoing |
| 1 | `B_OUTCOME_WON` | Player won |
| 2 | `B_OUTCOME_LOST` | Player lost |
| 3 | `B_OUTCOME_DREW` | Draw |
| 4 | `B_OUTCOME_RAN` | Player ran away |
| 5 | `B_OUTCOME_PLAYER_TELEPORTED` | Player teleported |
| 6 | `B_OUTCOME_MON_FLED` | Wild Pokemon fled |
| 7 | `B_OUTCOME_CAUGHT` | Pokemon caught |
| 8 | `B_OUTCOME_NO_SAFARI_BALLS` | Out of Safari balls |
| 9 | `B_OUTCOME_FORFEITED` | Player forfeited |
| 10 | `B_OUTCOME_MON_TELEPORTED` | Pokemon teleported |

## Source Files Location

All battle-related source code is located in:
- `public/pokeemerald/src/` - C source files
- `public/pokeemerald/include/` - Header files
- `public/pokeemerald/data/` - Data files and scripts
- `public/pokeemerald/graphics/` - Graphics assets

See [Source Files Reference](./12-source-files.md) for complete file listing.
