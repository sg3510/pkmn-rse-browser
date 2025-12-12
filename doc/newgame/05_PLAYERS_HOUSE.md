# Player's House Events (Clock Setting)

This document covers the events inside the player's house from arrival until the clock is set and Mom shows the room.

## Script Files

- `data/maps/LittlerootTown_BrendansHouse_1F/scripts.inc` - Male player 1F
- `data/maps/LittlerootTown_BrendansHouse_2F/scripts.inc` - Male player 2F
- `data/maps/LittlerootTown_MaysHouse_1F/scripts.inc` - Female player 1F
- `data/maps/LittlerootTown_MaysHouse_2F/scripts.inc` - Female player 2F
- `data/scripts/players_house.inc` - Shared scripts for both houses

## House 1F - First Entry

### Map Script Hooks (Brendan's House Example)

```asm
LittlerootTown_BrendansHouse_1F_MapScripts::
    map_script MAP_SCRIPT_ON_LOAD, LittlerootTown_BrendansHouse_1F_OnLoad
    map_script MAP_SCRIPT_ON_TRANSITION, LittlerootTown_BrendansHouse_1F_OnTransition
    map_script MAP_SCRIPT_ON_FRAME_TABLE, LittlerootTown_BrendansHouse_1F_OnFrame
    .byte 0
```

### On Load - Set Moving Boxes

```asm
LittlerootTown_BrendansHouse_1F_OnLoad:
    call_if_lt VAR_LITTLEROOT_INTRO_STATE, 6, LittlerootTown_BrendansHouse_1F_EventScript_SetMovingBoxes
    end

LittlerootTown_BrendansHouse_1F_EventScript_SetMovingBoxes::
    setmetatile 5, 4, METATILE_BrendansMaysHouse_MovingBox_Open, TRUE
    setmetatile 5, 2, METATILE_BrendansMaysHouse_MovingBox_Closed, TRUE
    return
```

The moving boxes are visible only during the intro (before clock is set).

### On Transition - Position Mom

Mom's position changes based on the current intro state:

```asm
LittlerootTown_BrendansHouse_1F_OnTransition:
    call_if_eq VAR_LITTLEROOT_INTRO_STATE, 3, EventScript_MoveMomToDoor
    call_if_eq VAR_LITTLEROOT_INTRO_STATE, 5, EventScript_MoveMomToStairs
    call_if_eq VAR_LITTLEROOT_INTRO_STATE, 6, EventScript_MoveMomToTV
    end
```

| State | Mom's Position | Mom's Purpose |
|-------|----------------|---------------|
| 3 | Near door (9, 8) | Just entered, greeting player |
| 5 | Near stairs (8, 4) | Waiting to push player upstairs |
| 6 | Near TV (4, 5) | Watching TV for gym report |

### On Frame - Auto-trigger Events

```asm
LittlerootTown_BrendansHouse_1F_OnFrame:
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 3, EventScript_EnterHouseMovingIn
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 5, EventScript_GoUpstairsToSetClock
    map_script_2 VAR_LITTLEROOT_INTRO_STATE, 6, EventScript_PetalburgGymReport
    .2byte 0
```

## Event 1: Enter House Moving In (State 3)

From `players_house.inc`:

```asm
PlayersHouse_1F_EventScript_EnterHouseMovingIn::
    msgbox PlayersHouse_1F_Text_IsntItNiceInHere, MSGBOX_DEFAULT
    applymovement VAR_0x8004, Common_Movement_FacePlayer
    waitmovement 0
    call_if_eq VAR_0x8005, MALE, PlayersHouse_1F_EventScript_MomFacePlayerMovingInMale
    call_if_eq VAR_0x8005, FEMALE, PlayersHouse_1F_EventScript_MomFacePlayerMovingInFemale
    msgbox PlayersHouse_1F_Text_MoversPokemonGoSetClock, MSGBOX_DEFAULT
    closemessage
    setvar VAR_LITTLEROOT_INTRO_STATE, 4
    applymovement LOCALID_PLAYER, PlayersHouse_1F_Movement_PlayerWalkIn
    applymovement VAR_0x8004, Common_Movement_WalkInPlaceFasterUp
    waitmovement 0
    releaseall
    end
```

### Dialogue - Mom's Welcome

```asm
PlayersHouse_1F_Text_IsntItNiceInHere:
    .string "MOM: See, {PLAYER}?\n"
    .string "Isn't it nice in here, too?$"

PlayersHouse_1F_Text_MoversPokemonGoSetClock:
    .string "The mover's POKéMON do all the work\n"
    .string "of moving us in and cleaning up after.\l"
    .string "This is so convenient!\p"
    .string "{PLAYER}, your room is upstairs.\n"
    .string "Go check it out, dear!\p"
    .string "DAD bought you a new clock to mark\n"
    .string "our move here.\l"
    .string "Don't forget to set it!$"
```

### Characters in House

The two Vigoroth (mover's Pokemon) are present:

```asm
PlayersHouse_1F_EventScript_Vigoroth1::
    lock
    faceplayer
    waitse
    playmoncry SPECIES_VIGOROTH, CRY_MODE_NORMAL
    msgbox PlayersHouse_1F_Text_Vigoroth1, MSGBOX_DEFAULT   @ "Fugiiiiih!"
    waitmoncry
    release
    end

PlayersHouse_1F_EventScript_Vigoroth2::
    lock
    faceplayer
    waitse
    playmoncry SPECIES_VIGOROTH, CRY_MODE_NORMAL
    msgbox PlayersHouse_1F_Text_Vigoroth2, MSGBOX_DEFAULT   @ "Huggoh, uggo uggo…"
    waitmoncry
    release
    end
```

## Event 2: Blocked Stairs (State 4)

If player tries to leave instead of going upstairs, Mom redirects:

```asm
PlayersHouse_2F_EventScript_BlockStairsUntilClockIsSet::
    setvar VAR_LITTLEROOT_INTRO_STATE, 5
    return
```

When `VAR_LITTLEROOT_INTRO_STATE == 5`, the next time player enters 1F:

```asm
EventScript_GoUpstairsToSetClock::
    lockall
    msgbox PlayersHouse_1F_Text_GoSetTheClock, MSGBOX_DEFAULT
    closemessage
    applymovement LOCALID_PLAYER, Movement_PushTowardStairs
    applymovement LOCALID_PLAYERS_HOUSE_1F_MOM, Movement_PushTowardStairs
    waitmovement 0
    warp MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F, 7, 1
    waitstate
    releaseall
    end

PlayersHouse_1F_Text_GoSetTheClock:
    .string "MOM: {PLAYER}.\p"
    .string "Go set the clock in your room, honey.$"
```

## House 2F - Setting the Clock

### Wall Clock Interaction

```asm
PlayersHouse_2F_EventScript_WallClock::
    goto_if_set FLAG_SET_WALL_CLOCK, PlayersHouse_2F_EventScript_CheckWallClock
    msgbox PlayersHouse_2F_Text_ClockIsStopped, MSGBOX_DEFAULT
    call PlayersHouse_2F_EventScript_SetWallClock
    delay 30
    setvar VAR_LITTLEROOT_INTRO_STATE, 6
    setflag FLAG_SET_WALL_CLOCK
    setflag FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_1
    setflag FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_2
    checkplayergender
    call_if_eq VAR_RESULT, MALE, PlayersHouse_2F_EventScript_MomComesUpstairsMale
    call_if_eq VAR_RESULT, FEMALE, PlayersHouse_2F_EventScript_MomComesUpstairsFemale
    playse SE_EXIT
    removeobject VAR_0x8008
    releaseall
    end

PlayersHouse_2F_Text_ClockIsStopped:
    .string "The clock is stopped…\p"
    .string "Better set it and start it!$"

PlayersHouse_2F_EventScript_SetWallClock::
    fadescreen FADE_TO_BLACK
    special StartWallClock
    waitstate
    return
```

### Clock Setting Interface

The `special StartWallClock` launches the clock-setting UI:
- Hour selection (0-23)
- Minute selection (0-59)
- Affects in-game time-based events

## Event 3: Mom Comes Upstairs

After setting the clock, Mom appears in the room:

```asm
PlayersHouse_2F_EventScript_MomComesUpstairsMale::
    setvar VAR_0x8008, LOCALID_PLAYERS_HOUSE_2F_MOM
    addobject VAR_0x8008
    applymovement VAR_0x8008, PlayersHouse_2F_Movement_MomEntersMale
    waitmovement 0
    applymovement LOCALID_PLAYER, Common_Movement_WalkInPlaceFasterRight
    waitmovement 0
    msgbox PlayersHouse_2F_Text_HowDoYouLikeYourRoom, MSGBOX_DEFAULT
    closemessage
    applymovement VAR_0x8008, PlayersHouse_2F_Movement_MomExitsMale
    waitmovement 0
    return
```

### Mom's Room Tour Dialogue

```asm
PlayersHouse_2F_Text_HowDoYouLikeYourRoom:
    .string "MOM: {PLAYER}, how do you like your\n"
    .string "new room?\p"
    .string "Good! Everything's put away neatly!\p"
    .string "They finished moving everything in\n"
    .string "downstairs, too.\p"
    .string "POKéMON movers are so convenient!\p"
    .string "Oh, you should make sure that\n"
    .string "everything's all there on your desk.$"
```

### Room Contents

The player's room contains:

| Object | Script | Text |
|--------|--------|------|
| Notebook | `PlayersHouse_2F_EventScript_Notebook` | Adventure rules (START for menu, SAVE) |
| GameCube | `PlayersHouse_2F_EventScript_GameCube` | "It's a Nintendo GameCube..." |
| Wall Map | `Common_Text_LookCloserAtMap` | Shows Hoenn map |
| PC | `PlayersHouse_2F_EventScript_PC` | Player's storage PC |

## State Flow Summary

```
State 3: Enter house, Mom greets, mentions clock
    ↓
State 4: Player free to explore 1F (if tries to leave, blocked)
    ↓
State 5: Mom pushes player to go upstairs
    ↓
State 6: Clock set, Mom shows room, Vigoroth leave
    ↓
(Continue to TV scene - covered in next section)
```

## Key Flags Set

| Flag | When Set | Effect |
|------|----------|--------|
| `FLAG_SET_WALL_CLOCK` | After setting clock | Clock shows real time |
| `FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_1` | After setting clock | Vigoroth 1 disappears |
| `FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_2` | After setting clock | Vigoroth 2 disappears |

## Notes

- The clock time affects various in-game events (tides, daily events, etc.)
- After setting the clock, the moving boxes are removed via metatile changes
- Mom's movement differs slightly between male/female player houses due to layout mirroring
