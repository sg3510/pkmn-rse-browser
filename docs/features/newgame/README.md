---
title: New Game Sequence Documentation
status: reference
last_verified: 2026-01-13
---

# New Game Sequence Documentation

Deep dive into Pokemon Emerald's intro sequence from pressing "New Game" until the clock is set.

## Complete Sequence Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     TITLE SCREEN                            │
│                   Player presses START                      │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 1. MAIN MENU                                │
│                 Select "NEW GAME"                           │
│                                                             │
│  Files: src/main_menu.c                                     │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              2. BIRCH SPEECH INTRO                          │
│  - Birch sprite slides in                                   │
│  - "Welcome to the world of Pokemon!"                       │
│  - Pokeball throw animation                                 │
│  - Gender selection (Boy/Girl)                              │
│  - Name entry screen                                        │
│  - Player sprite shrinks down                               │
│  - "Your Pokemon legend begins!"                            │
│                                                             │
│  Files: src/main_menu.c (BirchSpeech tasks)                 │
│         data/text/birch_speech.inc                          │
│         graphics/birch_speech/*                             │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              3. INSIDE THE TRUCK                            │
│  VAR_LITTLEROOT_INTRO_STATE = 0                             │
│  - Player "wakes up" in moving truck                        │
│  - Screen shakes (truck moving)                             │
│  - Truck stops, door opens                                  │
│  - Light floods in                                          │
│                                                             │
│  Files: data/maps/InsideOfTruck/scripts.inc                 │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            4. LITTLEROOT ARRIVAL                            │
│  VAR_LITTLEROOT_INTRO_STATE = 1                             │
│  - Player appears outside house                             │
│  - Mom walks down to greet player                           │
│  - "This is Littleroot Town!"                               │
│                                                             │
│  VAR_LITTLEROOT_INTRO_STATE = 2                             │
│  - Mom leads player into house                              │
│                                                             │
│  Files: data/maps/LittlerootTown/scripts.inc                │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            5. PLAYER'S HOUSE 1F                             │
│  VAR_LITTLEROOT_INTRO_STATE = 3                             │
│  - Mom welcomes player inside                               │
│  - "The mover's Pokemon do all the work!"                   │
│  - "Go see your room upstairs"                              │
│  - "Don't forget to set the clock!"                         │
│  - Two Vigoroth visible (movers)                            │
│                                                             │
│  VAR_LITTLEROOT_INTRO_STATE = 4                             │
│  - Player can explore 1F                                    │
│  - If player tries to leave: blocked                        │
│                                                             │
│  VAR_LITTLEROOT_INTRO_STATE = 5 (if player went back down)  │
│  - Mom pushes player toward stairs                          │
│  - Auto-warp to 2F                                          │
│                                                             │
│  Files: data/maps/LittlerootTown_BrendansHouse_1F/scripts.inc│
│         data/maps/LittlerootTown_MaysHouse_1F/scripts.inc   │
│         data/scripts/players_house.inc                      │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            6. PLAYER'S ROOM 2F - CLOCK SETTING              │
│  VAR_LITTLEROOT_INTRO_STATE = 4 (or 5)                      │
│  - Player examines wall clock                               │
│  - "The clock is stopped..."                                │
│  - Clock setting UI appears                                 │
│  - Player sets hour and minute                              │
│                                                             │
│  VAR_LITTLEROOT_INTRO_STATE = 6                             │
│  - FLAG_SET_WALL_CLOCK = TRUE                               │
│  - Vigoroth disappear (movers left)                         │
│  - Mom appears from stairs                                  │
│  - "How do you like your new room?"                         │
│  - Mom leaves                                               │
│                                                             │
│  Files: data/maps/LittlerootTown_BrendansHouse_2F/scripts.inc│
│         data/maps/LittlerootTown_MaysHouse_2F/scripts.inc   │
│         data/scripts/players_house.inc                      │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            7. TV BROADCAST (State 6→7)                      │
│  - Player returns to 1F                                     │
│  - Mom watching TV                                          │
│  - "Oh! Come quickly!"                                      │
│  - Petalburg Gym report on TV                               │
│  - "Maybe Dad will be on!"                                  │
│  - Broadcast ends                                           │
│  - "Go introduce yourself to Prof. Birch"                   │
│                                                             │
│  VAR_LITTLEROOT_INTRO_STATE = 7                             │
│                                                             │
│  *** PLAYER CAN NOW FREELY EXPLORE ***                      │
└─────────────────────────────────────────────────────────────┘
```

## Key State Variable

**VAR_LITTLEROOT_INTRO_STATE** (0x4092) tracks the entire intro:

| Value | Phase | What Happens |
|-------|-------|--------------|
| 0 | InsideOfTruck | Wake up, truck stops |
| 1 | LittlerootTown | Mom approaches player |
| 2 | LittlerootTown | Walk inside with Mom |
| 3 | PlayerHouse_1F | Mom's welcome speech |
| 4 | PlayerHouse_2F | Free to explore, must set clock |
| 5 | PlayerHouse_1F | Pushed back upstairs |
| 6 | PlayerHouse_1F | Clock set, TV broadcast |
| 7 | PlayerHouse_1F | Free exploration begins |

## Documentation Files

| File | Contents |
|------|----------|
| [02_BIRCH_SPEECH_INTRO.md](./02_BIRCH_SPEECH_INTRO.md) | Gender/name selection, Birch speech |
| [03_INSIDE_TRUCK.md](./03_INSIDE_TRUCK.md) | Truck sequence details |
| [04_LITTLEROOT_ARRIVAL.md](./04_LITTLEROOT_ARRIVAL.md) | Mom greeting, entering house |
| [05_PLAYERS_HOUSE.md](./05_PLAYERS_HOUSE.md) | House events through clock setting |
| [STATE_VARIABLES.md](./STATE_VARIABLES.md) | All state variables and flags |
| [SCRIPT_COMMANDS.md](./SCRIPT_COMMANDS.md) | How to read .inc script files |

## Key Source Files

### C Source (Logic/UI)

| File | Purpose |
|------|---------|
| `src/main_menu.c` | Main menu, Birch speech sequence |
| `src/new_game.c` | New game initialization |
| `src/naming_screen.c` | Name entry interface |
| `src/clock.c` / `src/wall_clock.c` | Clock setting UI |

### Script Files (.inc)

| File | Purpose |
|------|---------|
| `data/scripts/new_game.inc` | Initial game setup |
| `data/scripts/players_house.inc` | Shared house events |
| `data/text/birch_speech.inc` | Birch intro dialogue |
| `data/maps/InsideOfTruck/scripts.inc` | Truck interior |
| `data/maps/LittlerootTown/scripts.inc` | Town map scripts |
| `data/maps/LittlerootTown_BrendansHouse_1F/scripts.inc` | Male player house 1F |
| `data/maps/LittlerootTown_BrendansHouse_2F/scripts.inc` | Male player house 2F |
| `data/maps/LittlerootTown_MaysHouse_1F/scripts.inc` | Female player house 1F |
| `data/maps/LittlerootTown_MaysHouse_2F/scripts.inc` | Female player house 2F |

### Graphics

| Directory | Contents |
|-----------|----------|
| `graphics/birch_speech/` | Birch sprite, background |
| `graphics/intro/` | Title intro animations |

## Flags Set During Intro

| Flag | When | Effect |
|------|------|--------|
| `FLAG_SET_WALL_CLOCK` | After clock UI | Clock displays time |
| `FLAG_HIDE_..._VIGOROTH_1` | After clock | Mover 1 disappears |
| `FLAG_HIDE_..._VIGOROTH_2` | After clock | Mover 2 disappears |
| `FLAG_HIDE_MAP_NAME_POPUP` | In truck | No "Inside of Truck" text |
| `FLAG_SYS_TV_HOME` | After TV | TV shows regular content |

## How Scripts Work

Scripts use a state machine pattern:

1. **ON_FRAME** scripts check `VAR_LITTLEROOT_INTRO_STATE`
2. When state matches, script executes
3. Script changes state at end to prevent re-triggering
4. Next frame, different state triggers next script

Example pattern:
```asm
@ In map's OnFrame table
map_script_2 VAR_LITTLEROOT_INTRO_STATE, 3, EnterHouseScript
map_script_2 VAR_LITTLEROOT_INTRO_STATE, 5, GoUpstairsScript

@ EnterHouseScript ends with:
setvar VAR_LITTLEROOT_INTRO_STATE, 4  @ Advance state
```

See [SCRIPT_COMMANDS.md](./SCRIPT_COMMANDS.md) for detailed command reference.
