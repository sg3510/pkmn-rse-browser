# Player States & Running Research

## Pokeemerald Implementation

### Running Logic
- **Speed**:
    - `GetPlayerSpeed` (`src/bike.c`) determines speed.
    - `PLAYER_SPEED_NORMAL` (1) for walking.
    - `PLAYER_SPEED_FAST` (2) for running (`PLAYER_AVATAR_FLAG_DASH`) or surfing.
    - `PLAYER_SPEED_FASTER` (3) for Acro Bike.
    - `PLAYER_SPEED_FASTEST` (4) for Mach Bike.
- **Input**:
    - `FieldGetPlayerInput` (`src/field_control_avatar.c`) checks inputs.
    - `PlayerNotOnBikeMoving` (`src/field_player_avatar.c`) checks if `B_BUTTON` is held.
    - If `B_BUTTON` held AND `FLAG_SYS_B_DASH` (Running Shoes) is set AND running is allowed (`IsRunningDisallowed` false), it transitions to running.
- **States**:
    - `gPlayerAvatar.flags` tracks states: `PLAYER_AVATAR_FLAG_ON_FOOT`, `PLAYER_AVATAR_FLAG_MACH_BIKE`, `PLAYER_AVATAR_FLAG_ACRO_BIKE`, `PLAYER_AVATAR_FLAG_SURFING`, etc.
    - `gPlayerAvatar.runningState` tracks movement: `NOT_MOVING`, `TURN_DIRECTION`, `MOVING`.

### Sprite Handling
- **Graphics IDs**:
    - `sPlayerAvatarGfxIds` maps states to graphics constants (e.g., `OBJ_EVENT_GFX_BRENDAN_NORMAL`, `OBJ_EVENT_GFX_BRENDAN_MACH_BIKE`).
- **Transitions**:
    - `PlayerAvatarTransition_Normal`, `PlayerAvatarTransition_MachBike`, etc., update the graphics ID and flags.
- **Animation**:
    - `PlayerRun` sets the movement action to `GetPlayerRunMovementAction`.
    - Walking uses `GetWalkNormalMovementAction`.

## Current React Implementation (`PlayerController.ts`)

- **State**:
    - Simple `dir` (direction) and `isMoving` boolean.
    - No explicit state machine for modes (Walking vs Biking).
- **Speed**:
    - Constant `MOVE_SPEED = 0.06` px/ms.
- **Sprites**:
    - Loads a single sprite sheet (`loadSprite`).
    - `getFrameInfo` calculates frame based on `pixelsMoved` and `dir`.
    - Hardcoded frame indices for walking/idle.
- **Input**:
    - Direct mapping of Arrow keys to movement.
    - No B button handling.

## Gap Analysis

To support running and future states (Bike, Surf), we need:
1.  **State Management**: A way to switch between modes (Normal, Running, Bike, Surf).
2.  **Variable Speed**: Speed should depend on the current state.
3.  **Dynamic Sprites**: Ability to swap sprite sheets based on state.
4.  **Input Handling**: Context-sensitive input (e.g., B for running, different bike mechanics).
5.  **Collision Overrides**: Surfing requires different collision logic (water passable, land impassable).

## Recommendations

- **Refactor `PlayerController`**: Implement a State pattern.
- **Sprite Manager**: Decouple sprite loading/rendering from the controller logic.
- **Configuration**: Define speeds and sprite paths for each state.
