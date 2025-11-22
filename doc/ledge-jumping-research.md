# Ledge Jumping Research & Implementation Plan

## Goal
Implement the ledge jumping mechanic where the player hops over small ledges (e.g., tiles 135, 214), including the shadow animation.

## Research Findings

### Metatile Behaviors
- **Ledge Behaviors**:
    - `MB_JUMP_EAST` (56 decimal, 0x38 hex)
    - `MB_JUMP_WEST` (57 decimal, 0x39 hex)
    - `MB_JUMP_NORTH` (58 decimal, 0x3A hex)
    - `MB_JUMP_SOUTH` (59 decimal, 0x3B hex)

### Jump Physics
- **Function**: `InitJumpRegular` -> `DoJumpSpriteMovement`
- **Distance**: `JUMP_DISTANCE_FAR` (2 tiles / 32 pixels)
- **Duration**: 32 frames (approx 533ms at 60fps)
- **Height Arc**: Defined by `sJumpY_High` table:
  ```c
  static const s8 sJumpY_High[] = {
      -4,  -6,  -8, -10, -11, -12, -12, -12,
     -11, -10,  -9,  -8,  -6,  -4,   0,   0
  };
  ```
  (Indexed by `timer >> 1` for `JUMP_DISTANCE_FAR`)

### Shadow Animation
- **Effect**: `FLDEFF_SHADOW` (ID 3)
- **Sprite**: `graphics/field_effects/pics/shadow_medium.png` (standard size)
- **Logic**:
    - Shadow sprite is created and follows the player's X/Y.
    - Shadow Y is offset by `(graphicsInfo->height >> 1) - gShadowVerticalOffsets[shadowSize]`.
    - For Brendan/May, this places the shadow at the feet.
    - Shadow remains on the ground while the player sprite jumps up (Y offset changes).

## Implementation Plan

### 1. PlayerController Updates
- **New State**: `JumpingState`
    - **Enter**: Triggered when moving into a ledge tile from the correct direction.
    - **Update**:
        - Lock input.
        - Move player 2 tiles over 32 frames.
        - Apply Y-offset to player sprite based on `sJumpY_High`.
        - Render shadow sprite at player's ground position.
    - **Exit**: Unlock input, snap to final grid position.

### 2. Shadow Rendering
- Load `shadow_medium.png` in `PlayerController`.
- Render it in `MapRenderer` or `PlayerController` (prefer `PlayerController` to keep it self-contained).
- Shadow should be drawn *before* the player sprite to appear underneath.

### 3. Input Handling
- In `NormalState` and `RunningState`, check for ledge tiles in the direction of movement.
- If ledge found, transition to `JumpingState`.
