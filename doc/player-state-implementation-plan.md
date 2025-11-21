# Player State Implementation Plan

## Goal
Refactor `PlayerController` to use a modular State pattern, enabling the implementation of Running, Biking, and Surfing mechanics with correct speeds, sprites, and input handling.

## User Review Required
> [!IMPORTANT]
> This is a significant refactor of the player movement logic. It will change how `PlayerController` handles input and rendering.

## Proposed Changes

### `src/game/PlayerController.ts`
- [ ] Define `PlayerState` interface/abstract class.
- [ ] Implement `PlayerState` subclasses:
    - `NormalState`: Standard walking.
    - `RunningState`: Faster movement, running sprites.
- [ ] Refactor `PlayerController` to delegate logic to the current state:
    - `update(delta)`: State handles movement logic.
    - `getFrameInfo()`: State determines the sprite frame.
    - `handleInput()`: State decides how to respond to keys (e.g., B button).
- [ ] Add `setSprite(state: string, path: string)` to pre-load or lazy-load sprites.

### `src/components/MapRenderer.tsx`
- [ ] Update to pass necessary assets (running sprites) to `PlayerController`.
- [ ] Ensure `PlayerController` is initialized with the correct initial state.

## Detailed Design

### PlayerState Interface
```typescript
interface PlayerState {
  enter(): void;
  exit(): void;
  update(delta: number): boolean; // Returns true if render needed
  handleInput(keys: { [key: string]: boolean }): void;
  getFrameInfo(): FrameInfo | null;
  getSpeed(): number;
}
```

### States
- **NormalState**:
    - Speed: `0.06` (Walk)
    - Input: Arrows to move. B button held -> Transition to `RunningState`.
- **RunningState**:
    - Speed: `0.12` (Run)
    - Input: Arrows to move. B button released -> Transition to `NormalState`.
    - Sprite: Uses running sprite sheet.

## Verification Plan

### Manual Verification
1.  **Walking**: Use Arrow keys. Verify standard walking speed and animation.
2.  **Running**: Hold 'Z' (mapped to B) + Arrow keys. Verify:
    - Speed increases (approx 2x).
    - Sprite changes to running sprite.
    - Animation plays correctly.
3.  **Transitions**:
    - Release 'Z' while moving -> Return to walking speed/sprite.
    - Press 'Z' while walking -> Transition to running.
