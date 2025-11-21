# Implementation Plan - Ledge Jumping

## Goal Description
Implement the ledge jumping mechanic, allowing the player to hop over ledges (tiles with specific behaviors) when moving towards them. This includes the jump arc animation and a shadow effect.

## User Review Required
> [!IMPORTANT]
> I will be using the `shadow_medium.png` sprite for the shadow. I assume this asset exists or I will need to generate/extract it.

## Proposed Changes

### Game Logic

#### [MODIFY] [PlayerController.ts](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/game/PlayerController.ts)
- Add `JumpingState` class.
- Implement `sJumpY_High` lookup table.
- Add `shadow` sprite loading.
- Update `NormalState` and `RunningState` to check for ledge behaviors (`MB_JUMP_*`) and transition to `JumpingState`.
- Implement `JumpingState.update`:
    - Move player 32 pixels over 32 frames (1px/frame).
    - Apply vertical offset from `sJumpY_High`.
    - Draw shadow at the ground position.

#### [MODIFY] [metatileBehaviors.ts](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/src/constants/metatileBehaviors.ts)
- Add `MB_JUMP_EAST`, `MB_JUMP_WEST`, `MB_JUMP_NORTH`, `MB_JUMP_SOUTH` constants if missing.

### Assets
#### [NEW] [shadow_medium.png](file:///Users/seb/Documents/GitHub/pkmn-rse-browser/public/pokeemerald/graphics/field_effects/pics/shadow_medium.png)
- Ensure this asset is available for loading.

## Verification Plan

### Automated Tests
- None (visual feature).

### Manual Verification
1.  **Setup**:
    - Load the game.
    - Navigate to a map with ledges (e.g., Route 101, 102, or 104).
2.  **Test**:
    - Walk towards a ledge from the correct direction (e.g., walk DOWN into a "Jump South" ledge).
    - **Expectation**: Player jumps over the ledge (2 tiles distance), shadow appears under them, input is locked during jump.
    - Walk towards a ledge from the WRONG direction (e.g., walk UP into a "Jump South" ledge).
    - **Expectation**: Player is blocked (collision).
