# Littleroot Town Arrival

After exiting the truck, the player arrives in Littleroot Town for the first time and is greeted by their mother.

## Script File
`data/maps/LittlerootTown/scripts.inc`

## Map Scripts Structure

```asm
LittlerootTown_MapScripts::
    map_script MAP_SCRIPT_ON_LOAD, LittlerootTown_OnLoad
    map_script MAP_SCRIPT_ON_TRANSITION, LittlerootTown_OnTransition
    map_script MAP_SCRIPT_ON_FRAME_TABLE, LittlerootTown_OnFrame
    .byte 0
```

## On Frame Events (Auto-triggers)

```asm
LittlerootTown_OnFrame:
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 1, LittlerootTown_EventScript_MomGreet
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 2, LittlerootTown_EventScript_GoInsideWithMom
    .2byte 0
```

## Mom Greeting Script

When `VAR_LITTLEROOT_INTRO_STATE == 1`:

```asm
LittlerootTown_EventScript_MomGreet::
    lockall
    applymovement LOCALID_LITTLEROOT_MOM, LittlerootTown_Movement_MomApproach
    waitmovement 0
    applymovement LOCALID_PLAYER, Common_Movement_WalkInPlaceFasterDown
    waitmovement 0
    msgbox LittlerootTown_Text_MomNewHomeWhatDoYouThink, MSGBOX_DEFAULT
    closemessage
    setvar VAR_LITTLEROOT_INTRO_STATE, 2
    releaseall
    end
```

### Mom's Dialogue

```asm
LittlerootTown_Text_MomNewHomeWhatDoYouThink:
    .string "MOM: {PLAYER}, we're here, honey!\p"
    .string "It must be so tiring to ride with\n"
    .string "our things in the moving truck.\p"
    .string "Well, this is LITTLEROOT TOWN.\p"
    .string "What do you think?\n"
    .string "This is going to be our new home!\p"
    .string "It has a quaint feel to it,\n"
    .string "but it seems to be an easy place\l"
    .string "to live, don't you think?\p"
    .string "And, you get your own room!\n"
    .string "Let's go inside.$"
```

## Go Inside With Mom Script

When `VAR_LITTLEROOT_INTRO_STATE == 2`:

```asm
LittlerootTown_EventScript_GoInsideWithMom::
    lockall
    checkplayergender
    call_if_eq VAR_RESULT, MALE, LittlerootTown_EventScript_SetMalePlayerHouse
    call_if_eq VAR_RESULT, FEMALE, LittlerootTown_EventScript_SetFemalePlayerHouse
    applymovement LOCALID_LITTLEROOT_MOM, LittlerootTown_Movement_MomGoInside
    applymovement LOCALID_PLAYER, VAR_0x8008
    waitmovement 0
    setvar VAR_LITTLEROOT_INTRO_STATE, 3
    @ Warp to appropriate house based on gender
    special GetPlayerHouseWarp
    warp VAR_0x8008, VAR_0x8009, VAR_0x800A, VAR_0x800B
    waitstate
    releaseall
    end
```

## Movement Data

### Mom Approach Movement

```asm
LittlerootTown_Movement_MomApproach:
    walk_down
    walk_down
    step_end
```

### Mom Go Inside Movement

```asm
LittlerootTown_Movement_MomGoInside:
    walk_up
    walk_up
    walk_up
    walk_up
    step_end
```

## Sequence Flow

```
1. Player exits truck, appears in Littleroot (4, 10)
       ↓
2. VAR_LITTLEROOT_INTRO_STATE == 1 triggers MomGreet
       ↓
3. Mom walks down from house to player
       ↓
4. Player faces Mom (turns down)
       ↓
5. Mom's welcome dialogue displays
       ↓
6. VAR_LITTLEROOT_INTRO_STATE = 2
       ↓
7. GoInsideWithMom triggers immediately
       ↓
8. Check player gender → determine house destination
       ↓
9. Mom walks toward house
       ↓
10. Player follows Mom
       ↓
11. VAR_LITTLEROOT_INTRO_STATE = 3
       ↓
12. Warp to Player's House 1F
```

## Gender-Based House Selection

The player's house differs based on gender selection:

| Gender | House Map |
|--------|-----------|
| Male (Brendan) | `MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F` |
| Female (May) | `MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F` |

## Object Visibility

At this point:
- Mom is visible outside (`FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE` cleared)
- Truck objects are hidden
- The Vigoroth movers are inside the house

## State Changes

| Variable | Before | After |
|----------|--------|-------|
| `VAR_LITTLEROOT_INTRO_STATE` | 1→2 | 3 |

## Audio

- **BGM**: MUS_LITTLEROOT_TOWN (town theme)

## Notes

- The player cannot walk around freely during this sequence
- Both events trigger automatically via ON_FRAME
- Gender check determines which house the player enters
- Mom's sprite disappears after entering (she's inside now)
