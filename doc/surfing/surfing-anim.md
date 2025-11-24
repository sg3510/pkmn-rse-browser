# Surfing Animation Sequence Analysis

This document details the frame-by-frame sequence and implementation details of the Surfing start animation in Pokémon Emerald, based on the `pokeemerald` source code.

## Overview

The surfing sequence is triggered by a script interaction, which then hands off to a C-based Field Effect Task (`Task_SurfFieldEffect`). This task orchestrates the player's pose, the "field move" cutscene (black banner), the creation of the surf blob, and the player's jump onto the water.

## 1. Script Interaction

**File:** `data/scripts/surf.inc`

The sequence begins when the player interacts with a water tile.

1.  **Check Party Move**: The script checks if a Pokémon in the party has `MOVE_SURF`.
2.  **Prompt**: Displays the text:
    > "The water is dyed a deep blue…\nWould you like to SURF?"
3.  **Yes/No**: If the player selects "Yes":
    *   **Message**: "{STR_VAR_1} used SURF!"
    *   **Trigger**: Calls `dofieldeffect FLDEFF_USE_SURF`.

## 2. Field Effect Task (`Task_SurfFieldEffect`)

**File:** `src/field_effect.c`

The `FLDEFF_USE_SURF` effect starts the `Task_SurfFieldEffect` task, which manages the animation states.

### State 0: Init (`SurfFieldEffect_Init`)
*   **Lock Controls**: Calls `LockPlayerFieldControls()` and `FreezeObjectEvents()`.
*   **Set Flag**: Sets `PLAYER_AVATAR_FLAG_SURFING`.
*   **Calculate Destination**: Determines the target coordinates (1 tile in front of the player).

### State 1: Field Move Pose (`SurfFieldEffect_FieldMovePose`)
*   **Change Sprite**: Calls `SetPlayerAvatarFieldMove()` (in `src/field_player_avatar.c`).
    *   **Graphic**: Changes player sprite to `PLAYER_AVATAR_STATE_FIELD_MOVE`.
        *   Brendan: `graphics/object_events/pics/people/brendan/field_move.4bpp`
        *   May: `graphics/object_events/pics/people/may/field_move.4bpp`
    *   **Animation**: Plays `ANIM_FIELD_MOVE` (Taking out Poké Ball).
*   **Movement**: Sets movement action to `MOVEMENT_ACTION_START_ANIM_IN_DIRECTION`.

### State 2: Show Mon / Cutscene (`SurfFieldEffect_ShowMon`)
*   **Trigger Cutscene**: Starts `FLDEFF_FIELD_MOVE_SHOW_MON_INIT`.
    *   **Task**: `Task_FieldMoveShowMonOutdoors` (in `src/field_effect.c`).
    *   **Visuals**:
        *   **Banner**: Uses `graphics/field_effects/pics/field_move_streaks.4bpp` and `field_move_streaks.gbapal`.
        *   **Animation**:
            1.  **Load Gfx**: Loads the streak tiles and palette.
            2.  **Create Banner**: Expands a window (WIN0) horizontally and vertically to mask the screen, creating the "cut-in" effect.
            3.  **Slide Mon**: Slides the Pokémon's sprite from off-screen into the center.
            4.  **Wait**: Waits for the cry and a brief delay.
            5.  **Shrink Banner**: Closes the window.
            6.  **Restore Bg**: Restores the original background.

### State 3: Jump on Blob (`SurfFieldEffect_JumpOnSurfBlob`)
*   **Wait**: Waits for the cutscene to finish.
*   **Change Sprite**: Changes player sprite to `PLAYER_AVATAR_STATE_SURFING`.
    *   Brendan: `graphics/object_events/pics/people/brendan/surfing.4bpp`
    *   May: `graphics/object_events/pics/people/may/surfing.4bpp`
*   **Create Blob**: Triggers `FLDEFF_SURF_BLOB` (mapped to `FldEff_SurfBlob` in `src/field_effect_helpers.c`).
    *   **Sprite**: `graphics/field_effects/pics/surf_blob.4bpp`.
    *   **Palette**: Uses `TAG_NONE` (likely dynamic or system palette).
    *   **Animation**: `sAnimTable_SurfBlob` (Face South/North/West/East).
    *   **Position**: Created at the destination coordinates (the water tile).
*   **Player Jump**: Executes `GetJumpSpecialMovementAction` (in `src/event_object_movement.c`).
    *   **Logic**: Calls `InitJump` with `JUMP_DISTANCE_NORMAL` (1 tile) and `JUMP_TYPE_HIGH`.
    *   **Animation**: `GetJumpSpecialDirectionAnimNum`. The player visually jumps from the shore onto the blob.

### State 4: End (`SurfFieldEffect_End`)
*   **Wait**: Waits for the jump movement to finish.
*   **Bobbing**: Sets the blob's bobbing state (`SetSurfBlob_BobState`) to `BOB_PLAYER_AND_MON`.
*   **Unlock**: Unlocks controls (`UnlockPlayerFieldControls`, `UnfreezeObjectEvents`).
*   **Cleanup**: Removes the task.

## 3. Dismount Sequence (Stop Surfing)

**File:** `src/field_player_avatar.c`

The dismount sequence is triggered when the player attempts to move from a water tile to a land tile.

### Trigger (`CanStopSurfing`)
*   **Condition**: Player is surfing (`PLAYER_AVATAR_FLAG_SURFING`) and attempts to move to a tile with elevation 3 (Land).
*   **Action**: Calls `CreateStopSurfingTask`.

### Task (`Task_StopSurfingInit` / `Task_WaitStopSurfing`)
1.  **Lock**: Locks controls.
2.  **Flags**: Clears `PLAYER_AVATAR_FLAG_SURFING`, sets `PLAYER_AVATAR_FLAG_ON_FOOT`.
3.  **Bobbing**: Sets blob bob state to `BOB_JUST_MON` (stops bobbing with player).
4.  **Jump**: Executes `GetJumpSpecialMovementAction` in the direction of movement (jumping from water to land).
5.  **Wait**: Waits for the jump to finish.
6.  **Change Sprite**: Sets player graphics to `PLAYER_AVATAR_STATE_NORMAL` (Walking).
7.  **Cleanup**: Destroys the surf blob sprite.
8.  **Unlock**: Unlocks controls.

## Assets Summary

### Player Sprites
*   **Field Move (Ball Throw)**:
    *   `graphics/object_events/pics/people/brendan/field_move.4bpp`
    *   `graphics/object_events/pics/people/may/field_move.4bpp`
*   **Surfing (Riding)**:
    *   `graphics/object_events/pics/people/brendan/surfing.4bpp`
    *   `graphics/object_events/pics/people/may/surfing.4bpp`

### Field Effect Assets
*   **Surf Blob**: `graphics/field_effects/pics/surf_blob.4bpp` (32x32 pixels)
*   **Cutscene Streaks**: `graphics/field_effects/pics/field_move_streaks.4bpp`
*   **Cutscene Palette**: `graphics/field_effects/pics/field_move_streaks.gbapal`

## Implementation Notes for React/Canvas

1.  **Centering**: The GBA uses a 240x160 resolution. The cutscene centers the banner and Pokémon sprite based on this. In a React app, ensure the overlay is centered relative to the game viewport, not necessarily the window.
2.  **Layers**:
    *   The **Surf Blob** is a separate sprite (Object Event) that sits *under* the player sprite but *above* the water.
    *   The **Player** is rendered on top of the blob.
    *   The **Black Banner** is a high-priority overlay (Window/BG layer) that obscures the map.
3.  **Timing**:
    *   The jump happens *immediately* after the banner closes.
    *   The blob appears *before* the player lands (it's created at the start of the jump sequence).
4.  **Bobbing**: The blob and player likely share a bobbing animation (vertical offset) once surfing begins.
5.  **Dismount**: The dismount is a mirror of the mount sequence but without the cutscene and field move pose. The player simply jumps off the blob onto the land tile, and the blob disappears.

