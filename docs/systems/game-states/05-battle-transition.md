---
title: Battle Transition and Flow
status: reference
last_verified: 2026-01-13
---

# Battle Transition and Flow

## Starting a Battle (`battle_setup.c`)

Battles are initiated from the Overworld, typically via scripts or collision detection (tall grass).

### Initiation Functions
*   **`BattleSetup_StartWildBattle`**: Called for random encounters.
*   **`BattleSetup_StartTrainerBattle`**: Called when spotted by a trainer or interacting with one.
*   **`BattleSetup_StartLegendaryBattle`**: Special setup for Groudon/Kyogre/etc.

### The Transition Task (`CreateBattleStartTask`)

This task handles the visual "whoosh" effect before the battle screen appears.
1.  **Select Transition**: Determines the visual effect (Slice, Blur, Grid Squares) based on context (Wild vs Trainer, Cave vs Grass).
2.  **Play Music**: Starts the battle BGM.
3.  **Execute Transition**: Runs the visual effect.
4.  **Switch State**: Once the effect is done, calls `SetMainCallback2(CB2_InitBattle)`.

## The Battle Loop (`battle_main.c` - inferred)

While I didn't explicitly dump `battle_main.c`, the pattern is consistent:
*   `CB2_InitBattle` sets up the battle scene (backgrounds, HP bars, Pokemon sprites).
*   A new `CB2_Battle` (or similar) becomes the main loop.
*   It uses its own `RunBattleScript` equivalent to handle the turn-based logic.

## Ending a Battle

When the battle concludes (Win/Loss/Run), the game calls a cleanup callback.

*   **`CB2_EndWildBattle`**:
    *   Resets OAM/Palettes.
    *   Checks outcome (Won/Ran vs Lost).
    *   **If Lost**: `SetMainCallback2(CB2_WhiteOut)`.
    *   **Otherwise**: `SetMainCallback2(CB2_ReturnToField)`.

*   **`CB2_EndTrainerBattle`**:
    *   Similar cleanup.
    *   Sets trainer flags (beaten).
    *   Returns to field.

## Return to Field (`overworld.c`)

`CB2_ReturnToField` is a state that re-initializes the Overworld view without resetting the entire map state (unlike `LoadMap`).
*   Reloads graphics that might have been overwritten by battle assets.
*   Restores camera position.
*   Resumes the Overworld music (or keeps playing it if it didn't change).

## Lessons for Browser Port

*   **Visual Handoff**: The transition effect effectively hides the loading of the heavy battle assets. We should implement similar "Masking" transitions to avoid popping.
*   **State Isolation**: The Battle state is completely isolated from the Overworld. It doesn't "pause" the overworld; it completely replaces the `callback2`. The Overworld is *reconstructed* upon return.
*   **Outcome Handling**: The battle system must return a result (Win/Loss) which the Overworld handler uses to decide the next step (Script continue vs Whiteout).
