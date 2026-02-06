---
title: Overworld State
status: reference
last_verified: 2026-01-13
---

# Overworld State

## The Core Loop (`CB2_Overworld`)

The Overworld is the primary gameplay state. It is defined in `src/overworld.c`.

```c
void CB2_Overworld(void)
{
    bool32 fading = (gPaletteFade.active != 0);
    if (fading) SetVBlankCallback(NULL);
    
    OverworldBasic(); // <--- The meat
    
    if (fading) SetFieldVBlankCallback();
}

static void OverworldBasic(void)
{
    ScriptContext_RunScript(); // Run event scripts
    RunTasks();                // Run active tasks
    AnimateSprites();          // Update sprite animations
    CameraUpdate();            // Move camera
    UpdateCameraPanning();
    BuildOamBuffer();          // Prepare sprites for rendering
    UpdatePaletteFade();
    UpdateTilesetAnimations(); // Water/Flower animations
    DoScheduledBgTilemapCopiesToVram();
}
```

## Input Handling (`CB1_Overworld`)

Input is processed in `callback1` (run every frame before `callback2`).

*   **`FieldGetPlayerInput`**: Reads d-pad and buttons.
*   **`ProcessPlayerFieldInput`**:
    *   Checks for interaction (A button).
    *   Checks for menu (Start button).
    *   Checks for movement.
*   **`PlayerStep`**: If movement is valid, updates the player's position and animation.

## Script Execution (`script.c`)

The Overworld is heavily driven by the Script Context.

*   **`ScriptContext_RunScript`**: Executes bytecode commands (msgbox, giveitem, applymovement, trainerbattle, etc.).
*   **Locking**: When a script runs, it typically calls `LockPlayerFieldControls()`. This prevents `CB1_Overworld` from processing movement inputs until the script unlocks it.
*   **Map Scripts**: Maps have "Header Scripts" (OnLoad, OnFrame, OnTransition) that run automatically.

## Map Loading (`CB2_LoadMap`)

When warping (door, edge of map, teleport):
1.  `SetMainCallback2(CB2_LoadMap)`.
2.  `DoMapLoadLoop`:
    *   Unloads current map assets.
    *   Loads new map header and layout.
    *   Loads tilesets and palettes.
    *   Initializes object events (NPCs).
3.  Transitions back to `CB2_Overworld`.

## Lessons for Browser Port

*   **Separation of Concerns**:
    *   **Input**: Only handles "intent" (move, interact).
    *   **Logic**: `OverworldBasic` updates the world based on intent + scripts.
    *   **Render**: Happens implicitly via OAM/BG updates.
*   **Script Blocking**: The `sLockFieldControls` flag is crucial. The UI must ignore movement keys when a script is running (e.g., during dialog).
*   **Camera Priority**: The camera update happens *after* sprites/tasks but *before* rendering. This ensures the view is always synced to the player's new position.
