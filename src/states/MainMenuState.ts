/**
 * Main Menu State
 *
 * Displays Continue / New Game / Options menu.
 * Arrow keys to navigate, A/Enter to select, B/Escape to go back.
 *
 * TODO: Implement save detection and actual menu rendering
 */

import {
  GameState,
  type StateRenderer,
  type StateTransition,
  type InputState,
  type RenderContext,
} from '../core/GameState';
import type { ViewportConfig } from '../config/viewport';

interface MenuOption {
  label: string;
  action: GameState | 'options';
  enabled: boolean;
}

export class MainMenuState implements StateRenderer {
  readonly id = GameState.MAIN_MENU;

  private menuOptions: MenuOption[] = [];
  private selectedIndex = 0;
  private hasSaveData = false; // TODO: Check actual save data

  async enter(_viewport: ViewportConfig, _data?: Record<string, unknown>): Promise<void> {
    console.log('[MainMenuState] Entered');

    // TODO: Check for existing save data
    this.hasSaveData = false; // For now, assume no save

    // Build menu options based on save state
    this.menuOptions = [];

    if (this.hasSaveData) {
      this.menuOptions.push({
        label: 'CONTINUE',
        action: GameState.OVERWORLD,
        enabled: true,
      });
    }

    this.menuOptions.push({
      label: 'NEW GAME',
      action: GameState.OVERWORLD, // TODO: Should go to NEW_GAME_BIRCH state
      enabled: true,
    });

    this.menuOptions.push({
      label: 'OPTIONS',
      action: 'options',
      enabled: false, // Not implemented yet
    });

    this.selectedIndex = 0;
  }

  async exit(): Promise<void> {
    console.log('[MainMenuState] Exited');
  }

  update(_dt: number, _frameCount: number): void {
    // Menu doesn't need continuous updates
  }

  render(context: RenderContext): void {
    const { ctx2d, viewport } = context;
    const { width, height } = viewport;

    // Clear with dark background
    ctx2d.fillStyle = '#0f1115';
    ctx2d.fillRect(0, 0, width, height);

    // Menu box
    const boxWidth = 160;
    const boxHeight = 20 + this.menuOptions.length * 28;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    // Box background
    ctx2d.fillStyle = '#1a2030';
    ctx2d.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Box border
    ctx2d.strokeStyle = '#4a5568';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Menu items
    ctx2d.font = '16px monospace';
    ctx2d.textAlign = 'left';
    ctx2d.textBaseline = 'middle';

    this.menuOptions.forEach((option, index) => {
      const itemY = boxY + 24 + index * 28;
      const isSelected = index === this.selectedIndex;

      // Selection cursor
      if (isSelected) {
        ctx2d.fillStyle = '#ffcc00';
        ctx2d.fillText('>', boxX + 12, itemY);
      }

      // Option text
      ctx2d.fillStyle = option.enabled
        ? (isSelected ? '#ffffff' : '#aaaaaa')
        : '#555555';
      ctx2d.fillText(option.label, boxX + 32, itemY);
    });

    // Instructions
    ctx2d.fillStyle = '#666666';
    ctx2d.font = '10px monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillText('Arrow Keys: Move | Enter/Z: Select | Esc/X: Back', width / 2, height - 30);

    // Viewport info (debug)
    ctx2d.fillStyle = '#666666';
    ctx2d.font = '10px monospace';
    ctx2d.textAlign = 'left';
    ctx2d.fillText(`Viewport: ${width}x${height}`, 8, height - 8);

    // State label
    ctx2d.fillStyle = '#444444';
    ctx2d.textAlign = 'right';
    ctx2d.fillText('STATE: MAIN_MENU', width - 8, height - 8);
  }

  handleInput(input: InputState): StateTransition | null {
    // Navigate up
    if (input.pressed.has('ArrowUp') || input.pressed.has('KeyW')) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    }

    // Navigate down
    if (input.pressed.has('ArrowDown') || input.pressed.has('KeyS')) {
      this.selectedIndex = Math.min(this.menuOptions.length - 1, this.selectedIndex + 1);
    }

    // Select
    if (input.pressed.has('Enter') || input.pressed.has('KeyZ') || input.pressed.has('Space')) {
      const selected = this.menuOptions[this.selectedIndex];
      if (selected.enabled && selected.action !== 'options') {
        console.log('[MainMenuState] Selected:', selected.label);
        return {
          to: selected.action,
          data: { fromNewGame: selected.label === 'NEW GAME' },
        };
      }
    }

    // Back to title
    if (input.pressed.has('Escape') || input.pressed.has('KeyX')) {
      return { to: GameState.TITLE_SCREEN };
    }

    return null;
  }
}

/**
 * Factory function for creating MainMenuState
 */
export function createMainMenuState(): StateRenderer {
  return new MainMenuState();
}
