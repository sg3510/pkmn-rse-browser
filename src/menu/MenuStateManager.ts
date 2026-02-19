/**
 * Menu State Manager
 *
 * Central controller for all menu state and transitions.
 * Manages which menu is open, cursor position, and navigation history.
 */

export type MenuType =
  | 'start'
  | 'bag'
  | 'party'
  | 'moveForget'
  | 'pokedex'
  | 'trainerCard'
  | 'save'
  | 'options'
  | 'pokemonSummary';

/**
 * Payload contract for opening the bag menu.
 * Used by battle item selection and berry selection script specials.
 */
export interface BagMenuOpenData {
  mode?: 'battle' | 'berrySelect';
  onBattleItemSelected?: (itemId: number | null) => void;
  onBerrySelected?: (itemId: number) => void;
  onBerrySelectionCancel?: () => void;
  onFieldUseItem?: (itemId: number) => Promise<boolean> | boolean;
  onFieldRegisterItem?: (itemId: number) => void;
}

export interface MoveForgetMenuOpenData {
  pokemonName: string;
  pokemonMoves: [number, number, number, number];
  pokemonPp: [number, number, number, number];
  moveToLearnId: number;
  onMoveSlotChosen: (moveSlot: number | null) => void;
}

export interface MenuState {
  /** Whether any menu is currently open */
  isOpen: boolean;
  /** Currently active menu (null if closed) */
  currentMenu: MenuType | null;
  /** Cursor position within current menu */
  cursorIndex: number;
  /** Navigation history for back button */
  history: MenuType[];
  /** Additional data passed to menu (e.g., selected Pokemon index) */
  data: Record<string, unknown>;
}

type MenuListener = (state: MenuState) => void;

class MenuStateManagerClass {
  private state: MenuState = {
    isOpen: false,
    currentMenu: null,
    cursorIndex: 0,
    history: [],
    data: {},
  };

  private listeners: Set<MenuListener> = new Set();

  /**
   * Get current menu state
   */
  getState(): MenuState {
    return { ...this.state };
  }

  /**
   * Check if any menu is open
   */
  isMenuOpen(): boolean {
    return this.state.isOpen;
  }

  /**
   * Get current menu type
   */
  getCurrentMenu(): MenuType | null {
    return this.state.currentMenu;
  }

  /**
   * Open a menu
   */
  open(menu: MenuType, data?: Record<string, unknown>): void {
    // If already in a menu, push current to history
    if (this.state.currentMenu && this.state.currentMenu !== menu) {
      this.state.history.push(this.state.currentMenu);
    }

    this.state = {
      isOpen: true,
      currentMenu: menu,
      cursorIndex: 0,
      history: this.state.history,
      data: data ?? {},
    };

    console.log(`[MenuStateManager] Opened menu: ${menu}`);
    this.notifyListeners();
  }

  /**
   * Close the current menu and go back, or close entirely
   */
  back(): void {
    if (this.state.history.length > 0) {
      // Go back to previous menu
      const previousMenu = this.state.history.pop()!;
      this.state = {
        isOpen: true,
        currentMenu: previousMenu,
        cursorIndex: 0,
        history: this.state.history,
        data: {},
      };
      console.log(`[MenuStateManager] Back to: ${previousMenu}`);
    } else {
      // Close menu entirely
      this.close();
    }
    this.notifyListeners();
  }

  /**
   * Close all menus
   */
  close(): void {
    this.state = {
      isOpen: false,
      currentMenu: null,
      cursorIndex: 0,
      history: [],
      data: {},
    };
    console.log('[MenuStateManager] Closed all menus');
    this.notifyListeners();
  }

  /**
   * Set cursor position
   */
  setCursor(index: number): void {
    if (this.state.cursorIndex !== index) {
      this.state.cursorIndex = index;
      this.notifyListeners();
    }
  }

  /**
   * Move cursor by delta (with optional wrapping)
   */
  moveCursor(delta: number, maxIndex: number, wrap: boolean = true): number {
    let newIndex = this.state.cursorIndex + delta;

    if (wrap) {
      if (newIndex < 0) {
        newIndex = maxIndex;
      } else if (newIndex > maxIndex) {
        newIndex = 0;
      }
    } else {
      newIndex = Math.max(0, Math.min(maxIndex, newIndex));
    }

    this.setCursor(newIndex);
    return newIndex;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: MenuListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

// Singleton instance
export const menuStateManager = new MenuStateManagerClass();
