---
title: State Variables Reference
status: reference
last_verified: 2026-01-13
---

# State Variables Reference

This document details all the state variables and flags used during the New Game sequence.

## VAR_LITTLEROOT_INTRO_STATE (0x4092)

Primary state machine for the intro sequence.

| Value | Location | Description |
|-------|----------|-------------|
| 0 | InsideOfTruck | Initial state, player wakes up in truck |
| 1 | LittlerootTown | Just exited truck, Mom approaches |
| 2 | LittlerootTown | Mom finished greeting, go inside together |
| 3 | PlayerHouse_1F | Just entered house, Mom welcomes, mentions clock |
| 4 | PlayerHouse_2F | Player went upstairs, can explore but must set clock |
| 5 | PlayerHouse_1F | Player tried to leave without setting clock, Mom pushes to stairs |
| 6 | PlayerHouse_1F | Clock set, Mom showed room, now watching for TV broadcast |
| 7 | PlayerHouse_1F | TV broadcast watched, Mom says to visit Prof. Birch |

### State Transition Diagram

```
[0] InsideOfTruck
    └─ TruckArrival event ─→ [1]

[1] LittlerootTown (MomGreet)
    └─ Mom dialogue ends ─→ [2]

[2] LittlerootTown (GoInsideWithMom)
    └─ Enter house ─→ [3]

[3] PlayerHouse_1F (EnterHouseMovingIn)
    └─ Mom dialogue ends ─→ [4]

[4] PlayerHouse_2F
    ├─ Set clock ─→ [6]
    └─ Try to go back downstairs ─→ [5]

[5] PlayerHouse_1F (GoUpstairsToSetClock)
    └─ Auto-warp to 2F ─→ [4]

[6] PlayerHouse_1F (PetalburgGymReport)
    └─ TV broadcast ends ─→ [7]

[7] FREE EXPLORATION
    └─ Can now leave house and visit Prof. Birch
```

## VAR_LITTLEROOT_TOWN_STATE (0x4050)

General town progression state.

| Value | Description |
|-------|-------------|
| 0 | Initial state |
| 1 | Met rival for first time |
| 2 | (Unused in intro) |
| 3 | Received Pokedex from Birch |

## VAR_LITTLEROOT_RIVAL_STATE (0x408D)

Tracks encounters with the rival character.

| Value | Description |
|-------|-------------|
| 0 | Haven't met rival |
| 1 | (Transition state) |
| 2 | Ready to meet rival (triggers when entering rival's room) |
| 3 | Met rival |
| 4 | Received Pokedex |

## VAR_BIRCH_LAB_STATE (0x4084)

Professor Birch's lab events.

| Value | Description |
|-------|-------------|
| 0 | Initial - haven't rescued Birch |
| 1 | (Never occurs) |
| 2 | Chose starter on Route 101 |
| 3 | Received starter in lab, told to see rival |
| 4 | Defeated rival on Route 103 |
| 5 | Received Pokedex |

## VAR_ROUTE101_STATE (0x4050)

Route 101 events (Birch rescue).

| Value | Description |
|-------|-------------|
| 0 | Initial - hide map name popup |
| 1 | Map name popup hidden |
| 2 | Birch rescue in progress |
| 3 | Rescued Birch, completed |

## VAR_LITTLEROOT_HOUSES_STATE_MAY (0x4082)

Female player's house-related events.

| Value | Description |
|-------|-------------|
| 0 | Initial |
| 1 | Ready to meet rival's mom |
| 2 | Met rival's mom |
| 3 | Ready for SS Ticket event (post-game) |
| 4 | Completed Lati@s TV event (post-game) |

## VAR_LITTLEROOT_HOUSES_STATE_BRENDAN (0x408C)

Male player's house-related events. Same values as MAY version.

## Key Flags

### Introduction Flags

| Flag | Hex | Purpose |
|------|-----|---------|
| `FLAG_SET_WALL_CLOCK` | 0x51 | Clock has been set |
| `FLAG_SYS_POKEMON_GET` | system | Player has Pokemon |
| `FLAG_RESCUED_BIRCH` | varies | Saved Birch on Route 101 |
| `FLAG_ADVENTURE_STARTED` | system | Tutorial complete |
| `FLAG_RECEIVED_POKEDEX_FROM_BIRCH` | varies | Has Pokedex |
| `FLAG_HIDE_MAP_NAME_POPUP` | varies | Suppress map name display |

### Character Visibility Flags

| Flag | Purpose |
|------|---------|
| `FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE` | Mom outside house |
| `FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_1` | Vigoroth 1 in house |
| `FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_2` | Vigoroth 2 in house |
| `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK` | Truck at Brendan's |
| `FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK` | Truck at May's |
| `FLAG_HIDE_LITTLEROOT_TOWN_BIRCH` | Prof. Birch in town |
| `FLAG_HIDE_LITTLEROOT_TOWN_RIVAL` | Rival in town |
| `FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH` | Birch in lab |
| `FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG` | Birch's bag on Route 101 |
| `FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE` | Zigzagoon encounter |

## Script Commands Reference

### Variable Commands

```asm
setvar VAR_NAME, value          @ Set variable to value
addvar VAR_NAME, value          @ Add to variable
copyvar VAR_DEST, VAR_SRC       @ Copy variable
compare VAR_NAME, value         @ Compare for conditionals
```

### Conditional Commands

```asm
goto_if_eq VAR_NAME, value, Label   @ Jump if equal
goto_if_ne VAR_NAME, value, Label   @ Jump if not equal
goto_if_lt VAR_NAME, value, Label   @ Jump if less than
goto_if_ge VAR_NAME, value, Label   @ Jump if greater or equal
call_if_eq VAR_NAME, value, Label   @ Call if equal (returns)
goto_if_set FLAG_NAME, Label        @ Jump if flag set
goto_if_unset FLAG_NAME, Label      @ Jump if flag not set
```

### Flag Commands

```asm
setflag FLAG_NAME               @ Set flag to TRUE
clearflag FLAG_NAME             @ Set flag to FALSE
checkflag FLAG_NAME             @ Check flag state
```

## Understanding Map Scripts

Map scripts are defined in a specific structure:

```asm
MapName_MapScripts::
    map_script MAP_SCRIPT_ON_LOAD, MapName_OnLoad
    map_script MAP_SCRIPT_ON_TRANSITION, MapName_OnTransition
    map_script MAP_SCRIPT_ON_FRAME_TABLE, MapName_OnFrame
    .byte 0
```

### Script Types

| Type | When Triggered |
|------|----------------|
| `MAP_SCRIPT_ON_LOAD` | When map tiles are loaded |
| `MAP_SCRIPT_ON_TRANSITION` | When entering map (before fade-in) |
| `MAP_SCRIPT_ON_FRAME_TABLE` | Each frame, checks conditions |
| `MAP_SCRIPT_ON_WARP_INTO_MAP_TABLE` | When warping to map |

### On Frame Table Format

```asm
MapName_OnFrame:
    map_script_2 VAR_NAME, value, ScriptLabel  @ Triggers when VAR == value
    map_script_2 VAR_NAME2, value2, ScriptLabel2
    .2byte 0  @ End marker
```

The script executes when the variable matches the specified value. After execution, you typically change the variable to prevent re-triggering.
