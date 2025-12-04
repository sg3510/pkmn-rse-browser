/**
 * Overworld State
 *
 * Wrapper state for the existing overworld/map rendering logic.
 * This state signals to GamePage that it should use the existing
 * WebGL rendering pipeline for map/NPC/player rendering.
 *
 * The actual rendering is handled by GamePage's existing code,
 * not by this state's render() method.
 */

import {
  GameState,
  type StateRenderer,
  type StateTransition,
  type InputState,
  type RenderContext,
} from '../core/GameState';
import type { ViewportConfig } from '../config/viewport';

export class OverworldState implements StateRenderer {
  readonly id = GameState.OVERWORLD;

  /**
   * Flag indicating this state uses external rendering.
   * GamePage checks this to know whether to use its WebGL pipeline.
   */
  readonly usesExternalRendering = true;

  private fromNewGame = false;

  async enter(_viewport: ViewportConfig, data?: Record<string, unknown>): Promise<void> {
    console.log('[OverworldState] Entered', data);
    this.fromNewGame = data?.fromNewGame === true;

    // TODO: If fromNewGame, initialize fresh game state
    // TODO: If not fromNewGame (Continue), load saved state
  }

  async exit(): Promise<void> {
    console.log('[OverworldState] Exited');
    // Overworld cleanup is handled by GamePage
  }

  update(_dt: number, _frameCount: number): void {
    // Updates handled by GamePage's existing render loop
  }

  render(context: RenderContext): void {
    // This should not be called when usesExternalRendering is true.
    // If it is called, show a placeholder message.
    const { ctx2d, viewport } = context;
    const { width, height } = viewport;

    ctx2d.fillStyle = '#000000';
    ctx2d.fillRect(0, 0, width, height);

    ctx2d.fillStyle = '#ffffff';
    ctx2d.font = '14px monospace';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText('OVERWORLD STATE', width / 2, height / 2 - 10);
    ctx2d.fillText('(WebGL rendering active)', width / 2, height / 2 + 10);
  }

  handleInput(_input: InputState): StateTransition | null {
    // Input is handled by PlayerController in GamePage
    // Menu key (Start/Enter) could transition to POKEMON_MENU in future
    return null;
  }

  /**
   * Check if this is a fresh new game
   */
  isNewGame(): boolean {
    return this.fromNewGame;
  }
}

/**
 * Factory function for creating OverworldState
 */
export function createOverworldState(): StateRenderer {
  return new OverworldState();
}
