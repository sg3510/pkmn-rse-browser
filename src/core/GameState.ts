/**
 * Game State Types
 *
 * Defines the state machine for the game, following GBA's SetMainCallback2 pattern.
 * All states render to the same configurable viewport canvas.
 */

import type { ViewportConfig } from '../config/viewport';

/**
 * All possible game states
 */
export const GameState = {
  TITLE_SCREEN: 'TITLE_SCREEN',
  MAIN_MENU: 'MAIN_MENU',
  NEW_GAME_BIRCH: 'NEW_GAME_BIRCH',
  OVERWORLD: 'OVERWORLD',
  BATTLE: 'BATTLE',
  EVOLUTION: 'EVOLUTION',
  // Future states:
  // POKEMON_MENU: 'POKEMON_MENU',
  // BAG: 'BAG',
  // SAVE_SCREEN: 'SAVE_SCREEN',
} as const;

export type GameState = typeof GameState[keyof typeof GameState];

/**
 * Input state passed to states for handling
 */
export interface InputState {
  /** Keys pressed this frame */
  pressed: Set<string>;
  /** Keys currently held */
  held: Set<string>;
  /** Keys released this frame */
  released: Set<string>;
}

/**
 * Transition request from a state
 */
export interface StateTransition {
  to: GameState;
  /** Optional data to pass to the next state */
  data?: Record<string, unknown>;
}

/**
 * Render context passed to states
 */
export interface RenderContext {
  /** 2D canvas context for simple rendering */
  ctx2d: CanvasRenderingContext2D;
  /** Viewport dimensions in pixels */
  viewport: {
    width: number;
    height: number;
  };
  /** Viewport config (tiles) */
  viewportConfig: ViewportConfig;
}

/**
 * Interface all game states must implement
 */
export interface StateRenderer {
  /** State identifier */
  readonly id: GameState;

  /**
   * Called when state becomes active.
   * Load assets, initialize state.
   * @param viewport Current viewport configuration
   * @param data Optional data from previous state
   */
  enter(viewport: ViewportConfig, data?: Record<string, unknown>): Promise<void>;

  /**
   * Called when leaving state.
   * Cleanup resources, cancel pending operations.
   */
  exit(): Promise<void>;

  /**
   * Logic update, called at fixed timestep (~59.73 Hz GBA timing)
   * @param dt Delta time in milliseconds
   * @param frameCount GBA frame counter
   */
  update(dt: number, frameCount: number): void;

  /**
   * Render to canvas.
   * Called every animation frame.
   * @param context Render context with canvas and viewport info
   */
  render(context: RenderContext): void;

  /**
   * Handle input for this state.
   * @param input Current input state
   * @returns Transition request, or null to stay in current state
   */
  handleInput(input: InputState): StateTransition | null;

  /**
   * Called when viewport configuration changes while state is active.
   * Optional - states that need to resize (e.g., TitleScreen with 3D canvas) should implement this.
   * @param viewport New viewport configuration
   */
  onViewportChange?(viewport: ViewportConfig): void;
}

/**
 * Factory function type for creating state renderers
 */
export type StateFactory = () => StateRenderer;

/**
 * Registry of state factories
 */
export type StateRegistry = Map<GameState, StateFactory>;
