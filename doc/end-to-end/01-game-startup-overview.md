# Pokemon Emerald Game Startup - Overview

This document provides a comprehensive analysis of the Pokemon Emerald C source code related to game startup, from boot to gameplay. This is intended to guide implementation of these systems in a browser-based TypeScript/React environment.

## High-Level Game Flow

```
Boot/Reset
    │
    ▼
┌─────────────────────┐
│  Copyright Screen   │  (140 frames display)
│    (intro.c)        │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│   Intro Cinematic   │  (Scene 1: GF Logo, Scene 2: Bike, Scene 3: Legendaries)
│    (intro.c)        │
└─────────────────────┘
    │ (A/B/Start to skip)
    ▼
┌─────────────────────┐
│    Title Screen     │  (Rayquaza, "Press Start")
│  (title_screen.c)   │
└─────────────────────┘
    │ (Press Start)
    ▼
┌─────────────────────┐
│     Main Menu       │  (NEW GAME / CONTINUE / OPTIONS)
│   (main_menu.c)     │
└─────────────────────┘
    │
    ├─── NEW GAME ──────────────────────┐
    │                                    ▼
    │                           ┌─────────────────────┐
    │                           │   Birch Speech      │
    │                           │   (main_menu.c)     │
    │                           │  - Welcome          │
    │                           │  - This is a Pokemon│
    │                           │  - Boy or Girl?     │
    │                           │  - What's your name?│
    │                           │  - Are you ready?   │
    │                           └─────────────────────┘
    │                                    │
    │                                    ▼
    │                           ┌─────────────────────┐
    │                           │   NewGameInitData   │
    │                           │   (new_game.c)      │
    │                           │  - Reset save data  │
    │                           │  - Set starting $   │
    │                           │  - Warp to truck    │
    │                           └─────────────────────┘
    │                                    │
    │                                    ▼
    │                           ┌─────────────────────┐
    │                           │   Truck Sequence    │
    │                           │(field_special_scene)│
    │                           │  - Box bouncing     │
    │                           │  - Camera shake     │
    │                           │  - Door opens       │
    │                           └─────────────────────┘
    │                                    │
    │                                    ▼
    │                           ┌─────────────────────┐
    │                           │   SetIntroFlags     │
    │                           │ (InsideOfTruck map) │
    │                           │  - Set respawn      │
    │                           │  - Set house flags  │
    │                           │  - Player walks out │
    │                           └─────────────────────┘
    │                                    │
    ├─── CONTINUE ──────────────┼────────┤
    │         │                          │
    │         ▼                          ▼
    │   ┌─────────────────────┐  ┌─────────────────────┐
    │   │  Load Save Data     │  │  Gameplay Begins    │
    │   │  (load_save.c)      │  │   (overworld.c)     │
    │   └─────────────────────┘  └─────────────────────┘
    │
    └─── OPTIONS ──────────────→ (option_menu.c) ─→ Return to Main Menu
```

## Key Source Files

| File | Purpose |
|------|---------|
| `src/main_menu.c` | Main menu UI, Birch speech sequence |
| `src/intro.c` | Cinematic intro (3 scenes) |
| `src/title_screen.c` | Title screen with Rayquaza |
| `src/new_game.c` | Initialize new game data |
| `src/field_special_scene.c` | Truck sequence animation |
| `src/starter_choose.c` | Starter Pokemon selection |
| `src/load_save.c` | Save data loading |
| `src/save.c` | Save system implementation |
| `src/overworld.c` | Field/overworld management |

## Callback System (CB2)

The GBA Pokemon games use a callback-based architecture. The main loop calls `gMain.callback2()` every frame. Different game states are represented by different CB2 functions:

```c
// Entry points for different states:
CB2_InitTitleScreen()   // Title screen
CB2_InitMainMenu()      // Main menu
CB2_NewGame            // After Birch speech
CB2_ContinueSavedGame  // Continue saved game
```

## Task System

Emerald uses a task system for managing concurrent operations:

```c
struct Task {
    TaskFunc func;     // Function to call each frame
    bool8 isActive;
    u8 prev;
    u8 next;
    u8 priority;
    s16 data[16];      // Task-local data
};
```

Tasks are created with `CreateTask()` and destroyed with `DestroyTask()`. Task functions often advance by setting `gTasks[taskId].func` to the next function in the sequence.

## State Machine Pattern

The Birch speech sequence demonstrates a common pattern - each task function handles one state and sets `.func` to the next state:

```
Task_NewGameBirchSpeech_Init
    → Task_NewGameBirchSpeech_WaitToShowBirch
    → Task_NewGameBirchSpeech_WaitForSpriteFadeInWelcome
    → Task_NewGameBirchSpeech_ThisIsAPokemon
    → Task_NewGameBirchSpeech_MainSpeech
    → Task_NewGameBirchSpeech_AndYouAre
    → Task_NewGameBirchSpeech_StartBirchLotadPlatformFade
    → Task_NewGameBirchSpeech_SlidePlatformAway
    → Task_NewGameBirchSpeech_StartPlayerFadeIn
    → Task_NewGameBirchSpeech_WaitForPlayerFadeIn
    → Task_NewGameBirchSpeech_BoyOrGirl
    → Task_NewGameBirchSpeech_WaitToShowGenderMenu
    → Task_NewGameBirchSpeech_ChooseGender
    → Task_NewGameBirchSpeech_WhatsYourName
    → (Naming Screen)
    → Task_NewGameBirchSpeech_SoItsPlayerName
    → Task_NewGameBirchSpeech_CreateNameYesNo
    → Task_NewGameBirchSpeech_ProcessNameYesNoMenu
    → Task_NewGameBirchSpeech_SlidePlatformAway2
    → Task_NewGameBirchSpeech_ReshowBirchLotad
    → Task_NewGameBirchSpeech_AreYouReady
    → Task_NewGameBirchSpeech_ShrinkPlayer
    → Task_NewGameBirchSpeech_WaitForPlayerShrink
    → Task_NewGameBirchSpeech_FadePlayerToWhite
    → Task_NewGameBirchSpeech_Cleanup
    → CB2_NewGame
```

## Modules to Implement

Based on this analysis, the following modules should be implemented for the browser version:

1. **GameStateManager** - Handle CB2 callback equivalent
2. **TaskSystem** - Concurrent task management
3. **TitleScreenModule** - Title screen rendering and input
4. **MainMenuModule** - Menu UI and navigation
5. **BirchSpeechModule** - Intro sequence with animations
6. **NamingScreenModule** - Player naming interface
7. **NewGameModule** - Game state initialization
8. **TruckSequenceModule** - Truck scene animation
9. **SaveLoadModule** - Browser localStorage-based save system
10. **PaletteFadeSystem** - Screen fade effects

See the detailed documentation for each module in the subsequent files.
