---
title: Game State Management & Main Loop
status: reference
last_verified: 2026-01-13
---

# Game State Management & Main Loop

## Overview

The Game Boy Advance (GBA) Pokemon games (Ruby, Sapphire, Emerald) use a callback-based system to manage the main game loop and high-level state transitions. This system is central to understanding how the game switches between the intro, title screen, overworld, battles, and menus.

## The Main Loop (`AgbMain`)

Located in `src/main.c`, `AgbMain` is the entry point of the game. After initializing hardware (interrupts, sound, DMA, etc.), it enters an infinite loop:

```c
void AgbMain(void)
{
    // ... Initialization ...
    InitMainCallbacks(); // Sets initial state
    
    for (;;)
    {
        ReadKeys(); // Process input
        
        // ... Link cable updates ...
        
        UpdateLinkAndCallCallbacks(); // Execute game logic
        
        PlayTimeCounter_Update();
        MapMusicMain();
        WaitForVBlank(); // Sync to 60FPS
    }
}
```

## The Callback System

The core of the state machine relies on three function pointers stored in the `gMain` structure:

1.  **`callback1`**: Typically used for per-frame logic that must run every VBlank, such as processing player input (`CB1_Overworld`) or updating link communications.
2.  **`callback2`**: The **Main State Handler**. This function defines the current "mode" of the game (e.g., `CB2_Overworld`, `CB2_InitBattle`, `CB2_MainMenu`). Changing this pointer effectively changes the game state.
3.  **`vblankCallback`**: Executed during the Vertical Blanking Interval (VBlank) interrupt. It handles updating hardware registers (OAM, palettes, BG offsets) to prevent screen tearing.

### State Transitions

Transitions are handled by calling `SetMainCallback2(CallbackFunc newCallback)`.

*   **Example**: Transitioning from the Title Screen to the Main Menu.
    ```c
    // In title_screen.c
    static void CB2_GoToMainMenu(void)
    {
        if (!UpdatePaletteFade())
            SetMainCallback2(CB2_InitMainMenu);
    }
    ```

## Key Global Structures

*   **`gMain`**: Holds the callback pointers and input state (`newKeys`, `heldKeys`).
*   **`gTasks`**: A cooperative multitasking system. Many complex behaviors (like the "New Game" intro sequence or battle animations) are implemented as tasks that run alongside the main callback. `RunTasks()` is usually called within `callback2`.

## Implications for Browser Port

1.  **State Machine**: We should mirror the `SetMainCallback2` pattern. A central `GameLoop` component should manage a `currentGameState` (or `callback`) prop/ref.
2.  **Input Handling**: Input processing should be separated from game logic, just like `ReadKeys` vs `callback1`.
3.  **VBlank Separation**: While we don't have hardware VBlank, we should separate "Logic Update" (Game State) from "Render Update" (React/Canvas draw) to maintain deterministic game speed independent of frame rate.
