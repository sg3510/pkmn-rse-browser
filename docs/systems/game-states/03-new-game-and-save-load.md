---
title: New Game and Save Loading
status: reference
last_verified: 2026-01-13
---

# New Game and Save Loading

## New Game Sequence (`new_game.c`, `main_menu.c`)

The "New Game" process is a complex scripted sequence primarily handled in `main_menu.c` via the **Birch Speech Task**.

### The Birch Speech Task (`Task_NewGameBirchSpeech_Init`)

Instead of a simple state change, "New Game" starts a long-running **Task** that stays active while the `callback2` remains `CB2_MainMenu`.

**Sequence of Events:**
1.  **Init**: Loads Birch and Lotad sprites.
2.  **Welcome**: Prints "Welcome to the world of Pokemon".
3.  **Gender Selection**: Shows Boy/Girl sprites.
    *   `Task_NewGameBirchSpeech_ChooseGender` handles input.
    *   Updates `gSaveBlock2Ptr->playerGender`.
4.  **Naming**: Calls `DoNamingScreen`.
    *   This temporarily switches `callback2` to the Naming Screen's callback.
    *   Returns via `CB2_NewGameBirchSpeech_ReturnFromNamingScreen`.
5.  **Shrink**: Player sprite shrinks (simulating entering the TV/Game world).
6.  **Cleanup**: Frees resources and calls `SetMainCallback2(CB2_NewGame)`.

### `CB2_NewGame` (`overworld.c`)

This is the true start of the gameplay loop.
1.  **Initialization**: Clears flags, inits save blocks (`NewGameInitData`), starts play time counter.
2.  **Truck Sequence**: Sets `gFieldCallback = ExecuteTruckSequence`.
3.  **Map Load**: Calls `DoMapLoadLoop` to load the "Inside Truck" map.
4.  **Transition**: Sets `SetMainCallback2(CB2_Overworld)`.

## Save Loading (`overworld.c`)

Triggered by selecting "Continue" on the Main Menu.

### `CB2_ContinueSavedGame`

1.  **Load Data**: Loads the map header, object events, and scripts from the save block.
2.  **Restore State**:
    *   `UnfreezeObjectEvents()`: Restores NPC states.
    *   `DoTimeBasedEvents()`: Updates berries, shoal cave, etc.
    *   `UpdateMiscOverworldStates()`: Roamers, swarm pokemon.
3.  **Warp**:
    *   If inside a building/special area, it restores the exact position.
    *   If `UseContinueGameWarp()` is true (e.g. after beating E4), it warps to a specific spawn point (usually home).
4.  **Transition**: Sets `SetMainCallback2(CB2_Overworld)`.

## Lessons for Browser Port

*   **Task-Based Sequencing**: The Birch intro shows that "Game State" isn't just `CB2` pointers. Complex UI flows (like the intro speech) are often implemented as Tasks *within* a generic "Menu" state.
*   **Temporary State Switching**: The Naming Screen interrupts the flow. Our state manager needs a stack or a way to "push" a state (Naming) and "pop" back to the previous one (Birch Speech) with context intact.
*   **Initialization Order**: `CB2_NewGame` is critical. It sets up the global state *before* the first map load. Missing this step would cause the player to spawn in the void or with uninitialized data.
