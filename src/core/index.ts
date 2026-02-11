/**
 * Core Module Index
 *
 * Re-exports core game state management types and classes.
 */

export {
  GameState,
  type StateRenderer,
  type StateTransition,
  type InputState,
  type RenderContext,
  type StateRegistry,
  type StateFactory,
} from './GameState';

export { GameStateManager, type GameStateManagerConfig } from './GameStateManager';

export { GameButton, inputMap } from './InputMap';
