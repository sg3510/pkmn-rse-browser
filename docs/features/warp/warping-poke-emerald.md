---
title: Warp & Teleport Notes (pokeemerald)
status: reference
last_verified: 2026-01-13
---

# Warp & Teleport Notes (pokeemerald)

This is a working document capturing how the GBA engine handles warps, doors, and transitions. Source references point to `public/pokeemerald/src/**` unless noted.

## Core Data
- **Warp events**: Defined per map in the event header (`events->warps`). Each warp has `x, y`, target `mapGroup/mapNum`, target `warpId` (index), and a `warpType` (door vs. teleport vs. spin tile, etc.).
- **Map header flags**: Some maps mark `allowEscapeRope/dig`, `showMapName`, `battleScene`, and special **warp flags** in `rom_header_gf.c` (`specialSaveWarpFlags`) that drive e.g., escape/dive warps.
- **Player warp buffers** (`gSaveBlock1Ptr`):
  - `warpDestination`: the active warp to execute.
  - `escapeWarp`, `dynamicWarp`, `lastHealLocation`: convenience warps set by scripts/items.

## Collision & Entry
- Door/warp tiles are metatiles with behaviors like `MB_WARP_DOOR`, `MB_WARP_PAD`, `MB_SPIN_WARP`, `MB_DIVE_WARP`. They’re passable when the behavior marks them as warp; if a door should be blocked (e.g., locked), the metatile behavior is swapped by script to a blocking variant until unlocked.
- Outdoor→indoor: exterior door metatile has `MB_WARP_DOOR`; collision allows stepping on it and triggers `TryDoMetatileBehaviorWarp` → sets `warpDestination` and starts a warp task.
- Indoor exits: Typically floor arrow tiles (behavior `MB_ARROW_WARP_*`) or plain `MB_WARP_PAD` in front of the door. These are passable and trigger warp logic on step; the door object is just decoration.

## Warp Execution Flow (simplified)
1. **Detection**: `TryDoMetatileBehaviorWarp` runs after movement; checks the behavior under the player (or facing tile for door-triggered). If warp-triggered, populates `warpDestination`.
2. **Task**: `DoWarp`/`TryDoWarp` spawns a task that:
   - Stops input, clears movement.
   - Starts transition (fade/white-out) based on warp type/map header transition.
   - Queues `gFieldCallback` to `FieldCB_DefaultWarpExit`.
3. **Map load**: After fade, `ApplyCurrentWarp` loads the target map header, events, layout, connections. Player spawn uses target warp’s coordinates (plus 1 tile forward for door-facing-South exits).
4. **Exit positioning**: For door-style warps, the player is placed just outside the target door, facing south. For pad/teleport, exit facing is usually preserved; spin warps set direction explicitly.
5. **Resume**: Transition back in (fade-in), then unlock input.

## Door Animations & Overlays
- Door tiles animate via **field effects**:
  - `FldEff_DoorOpen`/`Close` run when entering/exiting a door warp. They spawn an overlay sprite that plays the door open frames over the base metatile.
  - Special gym/store doors use specific field effects (e.g., sliding doors).
- Overlay sprites draw on top of the map and clean themselves up after the animation completes to restore the base metatile view.

## Warp Arrows / Exit Indicators
- `field_player_avatar.c` uses `warpArrowSpriteId` per player object. On step onto arrow warp tiles (`MB_ARROW_WARP_*`), it calls `ShowWarpArrowSprite(spriteId, direction, x, y)` to render an arrow pointing the enforced exit direction (e.g., Petalburg Woods arrow tiles).
- Arrows are hidden (`SetSpriteInvisible`) when not on an arrow warp.

## Special Cases
- **Petalburg Woods arrows**: Tiles with arrow behaviors trigger forced movement and show arrow sprite; warp occurs after being pushed onto the destination tile (still collision-free).
- **Magma/Aqua HQ warp pads**: Warp pads are `MB_WARP_PAD`; stepping on them triggers a teleport-style warp with a special field effect (teleport rings) and scripted NPC animations (NPC uses same warp task with a different facing).
- **Inside building room-to-room**: Many indoor warps use simple pad/door warps within the same map group; logic is identical, only target map differs.
- **Dive/Underwater**: Dive spots use `MB_DIVE_WARP` behaviors; scripts set `warpDestination` to underwater maps and back. They also flag surf/dive state to restore on exit.
- **Lavaridge Gym ash puff**: Warp tiles create an ash effect via `field_effect.c` when you hop between sand piles; still uses warp task under the hood.
- **Secret Base**: Warps defined in `secret_base.c` use bespoke warp tables but still flow through the common warp handlers.

## Transition Effects
- Transition handler picks an effect from map header/warp type:
  - Standard door fade (black in/out).
  - White flash for teleport pads.
  - Aqua/Magma HQ uses teleport sparkle field effect + white flash.
  - Cave entries often use quick fade or special screen wipe constants.
- Effects are defined as callbacks/field effects; the warp task calls `StartPlayerFadeOut` / `StartMapFadeIn` with the chosen template.

## Metadata & Headers
- Map headers carry `music`, `weather`, `showMapName`, `battleScene`, and **connection** data; connections are used to place return warps automatically (e.g., exiting a house returns to the door you entered).
- Warp events reference by index; `warpId` on the target map selects which warp slot the player emerges from. If the target warp `warpId` is 0x7F, the engine uses `x/y` override stored in the warp data (dynamic warp).

## Why Doors Are Sometimes Passable or Not
- The warp activation is tied to the metatile behavior. Scripts can:
  - Swap the metatile to a blocking variant (no warp behavior) for “locked” doors.
  - Temporarily disable input/warps during cutscenes.
  - Change warps dynamically (e.g., set dynamic/escape warp after using Dig/Escape Rope).

## Practical Emulation Notes
- Collision: Treat warp behavior tiles as passable and trigger warp on entry; when “locked,” swap to a blocking behavior.
- Animation: Overlay a door-sprite animation on warp entry/exit; synchronize with fade timing.
- Arrows: Render an arrow overlay on arrow-warp tiles and force direction.
- Facing: Door-type warps exit facing south; pad warps preserve or set facing based on tile behavior.
- Transitions: Choose fade/flash by warp type; fade-out before map swap, fade-in after.
- Return warps: When entering from overworld to a house, store the exterior position as a temporary warp so exiting returns to the correct door tile. The engine auto-populates this via the warp index on the target.

## Key Files to Inspect Further
- `field_player_avatar.c`: arrow sprites, warp detection hooks.
- `fieldmap.c`/`metatile_behavior.c`: behaviors, warp triggering, collision flags.
- `field_effect.c`: door open/close and teleport visuals.
- `event_object_movement.c`: forced-movement for arrow warps.
- `secret_base.c`: custom warp tables.
- `rom_header_gf.c`: special warp flags layout.
- `region_map.c`: escape/dynamic warp lookups.

______
# Warping Mechanics in Pokémon Emerald

This document details the implementation of teleportation and warping mechanics in the `pokeemerald` codebase. It covers how warps are triggered, the execution flow, visual effects, and specific warp scenarios.

## Overview

Warping in Pokémon Emerald is a multi-step process involving:
1.  **Trigger Detection:** Checking if the player is on a warp tile or interacting with a door.
2.  **Warp Setup:** Retrieving destination data (map group, map number, warp ID) from map events.
3.  **Visual Transition:** Fading the screen, playing sound effects, and animating the player or environment (e.g., door opening).
4.  **Map Loading:** Loading the new map data and placing the player at the destination.
5.  **Entry Animation:** Fading the screen in and potentially animating the player's entry (e.g., walking out of a door).

## 1. Triggering Warps

Warp triggering is primarily handled in `src/field_control_avatar.c` within the `ProcessPlayerFieldInput` function. This function checks for various events after the player takes a step or provides input.

### Metatile Behaviors
The game uses "Metatile Behaviors" (defined in `include/constants/metatile_behaviors.h` and checked in `src/metatile_behavior.c`) to identify warp tiles.

*   **Arrow Warps:** Triggered when the player steps onto a tile with behavior `MB_EAST_ARROW_WARP`, `MB_WEST_ARROW_WARP`, etc.
    *   Handled by `TryArrowWarp` in `field_control_avatar.c`.
    *   Requires the player to be moving in the specific direction of the arrow.
*   **Door Warps:** Triggered when the player presses the D-Pad direction *into* a door tile.
    *   Handled by `TryDoorWarp` in `field_control_avatar.c`.
    *   Checks for `MetatileBehavior_IsDoor` (animated doors) or `MetatileBehavior_IsNonAnimDoor`.
*   **Instant Warps:** Triggered immediately upon stepping on the tile (e.g., holes, teleport pads).
    *   Handled by `TryStartWarpEventScript`.
    *   Checks for behaviors like `MB_AQUA_HIDEOUT_WARP`, `MB_MT_PYRE_HOLE`, `MB_ESCALATOR`.

### Map Events
For a warp to function, a corresponding **Warp Event** must be defined in the map's header data (`gMapHeader.events->warps`).
*   `GetWarpEventAtMapPosition` retrieves the warp event at the player's coordinates.
*   The warp event contains the destination `mapGroup`, `mapNum`, `warpId`, and coordinates.

## 2. Warp Execution Flow

Once a trigger is confirmed, the warping process is initiated:

1.  **`SetupWarp`:** Stores the destination data into `sWarpDestination` (in `src/overworld.c`).
2.  **`DoWarp` (or specific variant):** Starts the visual transition and sets the callback for the next state.
    *   Located in `src/field_screen_effect.c`.
    *   Locks player controls.
    *   Fades out music.
    *   Initiates screen fade-out.

### Specific Warp Functions
Different warp types have specialized execution functions in `src/field_screen_effect.c`:

*   **`DoWarp`:** Standard warp. Fades to black/white.
*   **`DoDoorWarp`:** Handles door opening animation before fading out.
*   **`DoTeleportTileWarp`:** Used for Aqua Hideout teleport pads. Plays `SE_WARP_IN` and sets up a "spin" entry animation.
*   **`DoEscalatorWarp`:** Handles escalator specific movement.
*   **`DoDiveWarp` / `DoFallWarp`:** For underwater and hole transitions.

## 3. Visual Effects & Animations

### Screen Transitions
Screen fades are managed in `src/field_screen_effect.c`.
*   **Fade Out:** `WarpFadeOutScreen` calls `FadeScreen(FADE_TO_BLACK, 0)` or `FADE_TO_WHITE` based on the map type pair (e.g., outdoors to indoors).
*   **Fade In:** `WarpFadeInScreen` handles the reverse process upon loading the new map.

### Door Animations
Door animations are defined in `src/field_door.c`.
*   **Opening:** `StartDoorOpenAnimation` draws the door opening frames.
*   **Closing:** `StartDoorCloseAnimation` draws the door closing frames.
*   **Graphics:** `sDoorAnimGraphicsTable` maps metatile IDs to specific door graphics (e.g., Gym, Lab, House).

### Teleport Spin (Aqua/Magma HQ)
The "teleport pad" effect uses a spin animation.
*   **Exit:** `DoTeleportTileWarp` fades out the screen.
*   **Entry:** `FieldCB_SpinEnterWarp` sets up `Task_SpinEnterWarp`.
    *   The player sprite spins down from the top of the screen to the destination tile.

### Exit Arrows
Exit arrows (e.g., in department stores) are standard "Arrow Warps".
*   They do not have a special animation other than the standard screen fade.
*   The "arrow" graphic itself is part of the metatile.

## 4. Code References

| Feature | File | Key Functions/Variables |
| :--- | :--- | :--- |
| Warp Triggers | `src/field_control_avatar.c` | `ProcessPlayerFieldInput`, `TryStartWarpEventScript`, `TryArrowWarp` |
| Metatile Checks | `src/metatile_behavior.c` | `MetatileBehavior_IsWarpDoor`, `MetatileBehavior_IsArrowWarp` |
| Warp Execution | `src/field_screen_effect.c` | `DoWarp`, `DoDoorWarp`, `DoTeleportTileWarp` |
| Door Animations | `src/field_door.c` | `StartDoorOpenAnimation`, `sDoorAnimGraphicsTable` |
| Warp Data | `src/overworld.c` | `sWarpDestination`, `SetWarpDestination` |

## Deep Dive: Door Warping Internals

This section explores the intricate details of how door warps function, specifically focusing on the interaction between collision, animation, and scripted movement.

### 1. The Trigger Mechanism
The door warp is NOT triggered by stepping *onto* the tile. Instead, it is triggered by **attempting to step into** the tile.
*   **File:** `src/field_control_avatar.c`
*   **Function:** `ProcessPlayerFieldInput`
*   **Logic:** When the player presses a direction (specifically North for doors), the game calls `TryDoorWarp`.
*   **Condition:** `TryDoorWarp` checks if the target tile has `MetatileBehavior_IsWarpDoor` (e.g., `MB_ANIMATED_DOOR`).
*   **Input Consumption:** If `TryDoorWarp` returns `TRUE`, the function `ProcessPlayerFieldInput` returns `TRUE`, effectively consuming the input. This prevents the standard movement logic from executing, which explains why the player doesn't "bump" into the door or walk into it normally.

### 2. The Warp Sequence (`Task_DoDoorWarp`)
Once triggered, the warp is handled by a state machine in `src/field_screen_effect.c`.

*   **State 0: Animation Start**
    *   `FreezeObjectEvents()`: Pauses all NPCs.
    *   `PlaySE()`: Plays the door sound.
    *   `FieldAnimateDoorOpen()`: Starts the visual animation of the door opening. This uses `StartDoorAnimationTask` in `field_door.c` to cycle through tile graphics. **Crucially, this appears to be a visual-only change; the logical metatile ID in the map grid remains unchanged.**

*   **State 1: Waiting & Forced Movement**
    *   Waits for the door animation to complete.
    *   **Scripted Movement:** Calls `ObjectEventSetHeldMovement(..., MOVEMENT_ACTION_WALK_NORMAL_UP)`.
    *   **Collision Handling:** Since the door tile is typically solid (impassable) in the map data, how does the player walk through it?
        *   The `TryDoorWarp` trigger consumes the initial input, preventing a standard collision check.
        *   The forced `heldMovement` is executed directly by the object event system.
        *   *Investigation Findings:* It is highly likely that door metatiles are technically defined as **passable** in the collision data, but the `TryDoorWarp` check intercepts any attempt to walk into them, effectively acting as a soft collision. This allows the "forced" movement in State 1 to succeed without needing to bypass collision logic.

*   **State 2: Closing & Hiding**
    *   Waits for the player to finish the step (now standing "inside" the door).
    *   `FieldAnimateDoorClose()`: Plays the closing animation.
    *   `SetPlayerVisibility(FALSE)`: Hides the player sprite.

*   **State 4: Screen Fade**
    *   `WarpFadeOutScreen()`: Fades the screen to black (or white).
    *   Transitions to `Task_WarpAndLoadMap` to load the new map.

### 3. The Exit Sequence (`Task_ExitDoor`)
When arriving at a map via a door (e.g., exiting a house), a complementary sequence occurs:

*   **State 0:**
    *   `SetPlayerVisibility(FALSE)`: Player starts hidden.
    *   `FieldSetDoorOpened()`: Sets the door to the "open" visual state immediately, so it appears open when the screen fades in.

*   **State 1:**
    *   Waits for screen fade-in.
    *   `SetPlayerVisibility(TRUE)`: Shows the player.
    *   `ObjectEventSetHeldMovement(..., MOVEMENT_ACTION_WALK_NORMAL_DOWN)`: Forces the player to walk out of the door.

*   **State 2:**
    *   `FieldAnimateDoorClose()`: Closes the door behind the player.

### 4. Visual vs. Logical State
The door animations in `field_door.c` (`DrawDoor`, `CopyDoorTilesToVram`) manipulate the VRAM and tile graphics but do not appear to change the underlying `MetatileBehavior` or collision data of the map grid. The "door" effect is a carefully choreographed sequence of:
1.  Intercepting input (preventing normal movement).
2.  Playing an animation (visuals).
3.  Forcing movement (ignoring the "soft" collision of the input intercept).
4.  Hiding the sprite.
