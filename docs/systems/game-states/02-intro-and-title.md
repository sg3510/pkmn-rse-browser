---
title: Intro and Title Screen Sequence
status: reference
last_verified: 2026-01-13
---

# Intro and Title Screen Sequence

## Flow Overview

1.  **Bootup**: `AgbMain` calls `InitMainCallbacks`, setting `callback2` to `CB2_InitCopyrightScreenAfterBootup`.
2.  **Copyright Screen**: Displays copyright info, checks for specific button combos (e.g., delete save), then transitions to the Intro.
3.  **Intro Cinematic**: A multi-scene sequence managed by `intro.c`.
4.  **Title Screen**: The "Pokemon Emerald" logo screen waiting for "Press Start".
5.  **Main Menu**: "Continue", "New Game", "Options".

## Implementation Details

### Intro (`intro.c`)

The intro is divided into scenes, managed by a main callback `MainCB2_Intro`.

*   **Scene 1**: Water drops, Game Freak logo.
*   **Scene 2**: Player riding bicycle, Pokemon appearing.
*   **Scene 3**: Groudon/Kyogre/Rayquaza cinematic.

The system uses `gIntroFrameCounter` to time events precisely. When the intro finishes or a key is pressed, it calls `MainCB2_EndIntro`, which transitions to `CB2_InitTitleScreen`.

### Title Screen (`title_screen.c`)

Initialized via `CB2_InitTitleScreen`. It sets up:
*   Backgrounds (Clouds, Rayquaza).
*   Sprites (Version logo, "Press Start").
*   Music (`MUS_TITLE`).

**Phases**:
1.  **Phase 1**: Logo shines, version banner fades in.
2.  **Phase 2**: "Press Start" and copyright text appear.
3.  **Phase 3**: Waits for input.
    *   **A / Start**: Transitions to `CB2_InitMainMenu`.
    *   **Select + Up + B**: Transitions to `CB2_InitClearSaveDataScreen`.

### Main Menu (`main_menu.c`)

Initialized via `CB2_InitMainMenu`.
*   Checks save file status (`Task_MainMenuCheckSaveFile`) to determine available options (New Game vs Continue).
*   **New Game**: Calls `Task_NewGameBirchSpeech_Init`.
*   **Continue**: Calls `CB2_ContinueSavedGame` (in `overworld.c`).

## Lessons for Browser Port

*   **Cinematic Timing**: The intro relies heavily on frame counters (`gIntroFrameCounter`). Animation logic needs to be frame-rate independent or locked to a fixed tick rate.
*   **Asset Loading**: Large assets (intro graphics) are loaded and unloaded between states. We should implement a resource manager that cleans up assets when switching states to manage memory.
*   **Input Interception**: The Title Screen checks for specific button combos *before* standard input processing. Our input handler needs to support simultaneous key presses for debug/reset codes.
