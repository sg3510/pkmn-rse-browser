/**
 * Main Menu State
 *
 * Displays Continue / New Game / Options menu.
 * Arrow keys to navigate, A/Enter to select, B/Escape to go back.
 *
 * Detects existing saves and shows Continue option with preview.
 */

import {
  GameState,
  type StateRenderer,
  type StateTransition,
  type InputState,
  type RenderContext,
} from '../core/GameState';
import type { ViewportConfig } from '../config/viewport';
import { saveManager } from '../save/SaveManager';
import { getMapDisplayName } from '../save/native/mapResolver';

interface MenuOption {
  label: string;
  action: GameState | 'options';
  enabled: boolean;
}

interface SavePreview {
  playerName: string;
  mapName: string;
  playTime: string;
}

export class MainMenuState implements StateRenderer {
  readonly id = GameState.MAIN_MENU;

  private menuOptions: MenuOption[] = [];
  private selectedIndex = 0;
  private hasSaveData = false;
  private savePreview: SavePreview | null = null;

  async enter(_viewport: ViewportConfig, _data?: Record<string, unknown>): Promise<void> {
    console.log('[MainMenuState] Entered');

    // Check for existing save data
    this.hasSaveData = saveManager.hasAnySave();
    this.savePreview = null;

    if (this.hasSaveData) {
      // Get preview from slot 0
      const slots = saveManager.getSaveSlots();
      const slot0 = slots[0];
      if (slot0.exists && slot0.preview) {
        const { playerName, mapId, playTime } = slot0.preview;
        this.savePreview = {
          playerName,
          mapName: getMapDisplayName(mapId),
          playTime: `${playTime.hours}:${String(playTime.minutes).padStart(2, '0')}`,
        };
        console.log('[MainMenuState] Found save:', this.savePreview);
      }
    }

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

    // Calculate box dimensions
    const boxWidth = 160;
    const menuHeight = 20 + this.menuOptions.length * 28;
    const previewHeight = this.savePreview ? 60 : 0;
    const totalHeight = menuHeight + previewHeight + (previewHeight > 0 ? 12 : 0);
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - totalHeight) / 2;

    // Save preview box (if save exists)
    if (this.savePreview) {
      const previewY = boxY;

      // Preview background
      ctx2d.fillStyle = '#1a2530';
      ctx2d.fillRect(boxX, previewY, boxWidth, previewHeight);

      // Preview border
      ctx2d.strokeStyle = '#3a5568';
      ctx2d.lineWidth = 2;
      ctx2d.strokeRect(boxX, previewY, boxWidth, previewHeight);

      // Preview content
      ctx2d.font = '12px monospace';
      ctx2d.textAlign = 'left';
      ctx2d.textBaseline = 'middle';

      // Player name
      ctx2d.fillStyle = '#ffcc00';
      ctx2d.fillText(this.savePreview.playerName, boxX + 12, previewY + 16);

      // Map name
      ctx2d.fillStyle = '#aaaaaa';
      ctx2d.fillText(this.savePreview.mapName, boxX + 12, previewY + 34);

      // Play time
      ctx2d.fillStyle = '#888888';
      ctx2d.fillText(`Time: ${this.savePreview.playTime}`, boxX + 12, previewY + 50);
    }

    // Menu box
    const menuY = boxY + (previewHeight > 0 ? previewHeight + 12 : 0);

    // Box background
    ctx2d.fillStyle = '#1a2030';
    ctx2d.fillRect(boxX, menuY, boxWidth, menuHeight);

    // Box border
    ctx2d.strokeStyle = '#4a5568';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(boxX, menuY, boxWidth, menuHeight);

    // Menu items
    ctx2d.font = '16px monospace';
    ctx2d.textAlign = 'left';
    ctx2d.textBaseline = 'middle';

    this.menuOptions.forEach((option, index) => {
      const itemY = menuY + 24 + index * 28;
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

        const isNewGame = selected.label === 'NEW GAME';
        const isContinue = selected.label === 'CONTINUE';

        if (isNewGame) {
          // Reset save data for new game
          saveManager.newGame();
          console.log('[MainMenuState] Starting new game');
        } else if (isContinue) {
          // Load the saved game (already auto-loaded by SaveManager)
          const saveData = saveManager.load(0);
          if (saveData) {
            console.log('[MainMenuState] Continuing game:', {
              name: saveData.profile.name,
              mapId: saveData.location.location.mapId,
            });
          }
        }

        return {
          to: selected.action,
          data: {
            fromNewGame: isNewGame,
            fromContinue: isContinue,
            savedLocation: isContinue ? saveManager.quickLoad()?.location : undefined,
          },
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
