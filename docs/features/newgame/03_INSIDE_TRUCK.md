---
title: Inside the Truck Sequence
status: reference
last_verified: 2026-01-13
---

# Inside the Truck Sequence

After the Birch Speech intro, the player "wakes up" inside a moving truck - the family is relocating to Littleroot Town.

## Script File
`data/maps/InsideOfTruck/scripts.inc`

## Map Setup

The InsideOfTruck map is a small interior map:
- Single room representing the back of a moving truck
- Contains the player and cardboard boxes
- Shaking/rumbling effect simulates movement

## Script Breakdown

### Map Scripts Structure

```asm
InsideOfTruck_MapScripts::
    map_script MAP_SCRIPT_ON_LOAD, InsideOfTruck_OnLoad
    map_script MAP_SCRIPT_ON_FRAME_TABLE, InsideOfTruck_OnFrame
    .byte 0
```

### On Load Script

```asm
InsideOfTruck_OnLoad:
    setflag FLAG_HIDE_MAP_NAME_POPUP    @ Hide "Inside of Truck" popup
    end
```

### On Frame Script (Auto-trigger)

```asm
InsideOfTruck_OnFrame:
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 0, InsideOfTruck_EventScript_TruckArrival
    .2byte 0
```

This triggers when `VAR_LITTLEROOT_INTRO_STATE == 0` (initial state).

### Main Event Script

```asm
InsideOfTruck_EventScript_TruckArrival::
    lockall
    applymovement LOCALID_PLAYER, InsideOfTruck_Movement_PlayerTurnInPlace
    waitmovement 0
    playse SE_TRUCK_DOOR                @ Truck door opening sound
    special Special_BeginTruckUnload
    waitstate
    clearflag FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE
    setflag FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK
    setflag FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK
    setvar VAR_LITTLEROOT_INTRO_STATE, 1
    warp MAP_LITTLEROOT_TOWN, 4, 10     @ Warp outside player's house
    waitstate
    releaseall
    end
```

### Movement Data

```asm
InsideOfTruck_Movement_PlayerTurnInPlace:
    walk_in_place_faster_down
    walk_in_place_faster_left
    walk_in_place_faster_down
    delay_16
    delay_16
    delay_16
    step_end
```

## Sequence Flow

```
1. Player appears inside truck (facing up)
       ↓
2. MAP_SCRIPT_ON_FRAME triggers TruckArrival
       ↓
3. Player turns in place (looking around)
       ↓
4. SE_TRUCK_DOOR sound plays
       ↓
5. Special_BeginTruckUnload called
       ↓
6. Light floods in (screen effect)
       ↓
7. Flags set:
   - Show Mom outside
   - Hide truck objects from both houses
       ↓
8. VAR_LITTLEROOT_INTRO_STATE = 1
       ↓
9. Warp to Littleroot Town (outside player's house)
```

## Special Functions

### Special_BeginTruckUnload

This C function (in `src/truck_unload.c` or similar) handles:
- Screen brightening effect (simulating door opening)
- Truck interior to exterior transition
- Possible shaking stop effect

## State Changes

| Variable | Before | After |
|----------|--------|-------|
| `VAR_LITTLEROOT_INTRO_STATE` | 0 | 1 |
| `FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE` | SET | CLEAR |
| `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK` | CLEAR | SET |
| `FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK` | CLEAR | SET |

## Graphics

The truck interior uses standard interior tileset. No special graphics are needed for this scene since it's a simple map.

## Audio

- **BGM**: MUS_NEWGAME_LEAVE_HOME (set before entering truck)
- **SE**: SE_TRUCK_DOOR (door opening sound)

## Warp Destination

After the truck scene, the player warps to:
- **Map**: MAP_LITTLEROOT_TOWN
- **Position**: (4, 10) - Right in front of the player's house

## Notes

- This is one of the shortest map scripts in the game
- The entire truck experience is essentially one auto-triggered event
- Player has no control during this sequence
- The "shaking" visual effect is handled by the special function, not the script
