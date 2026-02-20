/**
 * Menu State Manager
 *
 * Central controller for all menu state and transitions.
 * Manages which menu is open, cursor position, and navigation history.
 */

import type { PartyPokemon } from '../pokemon/types';

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
export interface StartMenuOpenData {
  onFieldUseItem?: (itemId: number) => Promise<boolean> | boolean;
  onFieldRegisterItem?: (itemId: number) => void;
  onSaveToBrowser?: () => void;
}

export interface BagMenuOpenData {
  mode?: 'field' | 'battle' | 'berrySelect';
  onBattleItemSelected?: (itemId: number | null) => void;
  onBerrySelected?: (itemId: number) => void;
  onBerrySelectionCancel?: () => void;
  onFieldUseItem?: (itemId: number) => Promise<boolean> | boolean;
  onFieldRegisterItem?: (itemId: number) => void;
}

export interface MoveForgetMenuOpenData {
  mode?: 'learn' | 'delete';
  promptText?: string;
  pokemonName: string;
  pokemonMoves: [number, number, number, number];
  pokemonPp: [number, number, number, number];
  moveToLearnId?: number;
  onMoveSlotChosen?: (moveSlot: number | null) => void;
}

export interface FieldItemPartyMenuOpenData {
  mode: 'fieldItemUse';
  onFieldPartySelected?: (partyIndex: number | null) => void;
}

export interface BattlePartyMenuOpenData {
  mode: 'battle';
  activePartyIndex: number;
  onBattlePartySelected?: (partyIndex: number | null) => void;
}

export interface PokemonSummaryMenuOpenData {
  pokemon: PartyPokemon;
  partyIndex?: number;
}

export type PartyMenuOpenData =
  | FieldItemPartyMenuOpenData
  | BattlePartyMenuOpenData
  | Record<string, never>;

export interface MenuDataMap {
  start: StartMenuOpenData;
  bag: BagMenuOpenData;
  party: PartyMenuOpenData;
  moveForget: MoveForgetMenuOpenData;
  pokedex: Record<string, never>;
  trainerCard: Record<string, never>;
  save: Record<string, never>;
  options: Record<string, never>;
  pokemonSummary: PokemonSummaryMenuOpenData;
}

export type MenuDataFor<TMenu extends MenuType> = MenuDataMap[TMenu];
export type AnyMenuData = MenuDataMap[MenuType];

const EMPTY_MENU_DATA: Record<string, never> = {};

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
  data: AnyMenuData;
}

type MenuListener = (state: MenuState) => void;

class MenuStateManagerClass {
  private state: MenuState = {
    isOpen: false,
    currentMenu: null,
    cursorIndex: 0,
    history: [],
    data: EMPTY_MENU_DATA,
  };

  private listeners: Set<MenuListener> = new Set();
  private pendingAsyncResolve: ((value: unknown | null) => void) | null = null;

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
  open<TMenu extends MenuType>(menu: TMenu, data?: MenuDataFor<TMenu>): void {
    // If already in a menu, push current to history
    if (this.state.currentMenu && this.state.currentMenu !== menu) {
      this.state.history.push(this.state.currentMenu);
    }

    this.state = {
      isOpen: true,
      currentMenu: menu,
      cursorIndex: 0,
      history: this.state.history,
      data: (data ?? EMPTY_MENU_DATA) as AnyMenuData,
    };

    console.log(`[MenuStateManager] Opened menu: ${menu}`);
    this.notifyListeners();
  }

  /**
   * Open a menu and await a typed result.
   * The promise resolves with null when the menu stack closes without selection.
   */
  openAsync<TMenu extends MenuType, TResult = unknown>(
    menu: TMenu,
    data?: MenuDataFor<TMenu>,
  ): Promise<TResult | null> {
    this.settlePendingAsync(null);
    return new Promise<TResult | null>((resolve) => {
      this.pendingAsyncResolve = resolve as (value: unknown | null) => void;
      this.open(menu, data);
    });
  }

  /**
   * Resolve the current async menu flow and close the menu stack.
   */
  resolveAsync<TResult>(value: TResult): void {
    this.settlePendingAsync(value);
    this.close();
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
        data: EMPTY_MENU_DATA,
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
    this.settlePendingAsync(null);
    this.state = {
      isOpen: false,
      currentMenu: null,
      cursorIndex: 0,
      history: [],
      data: EMPTY_MENU_DATA,
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

  private settlePendingAsync(value: unknown | null): void {
    const resolve = this.pendingAsyncResolve;
    if (!resolve) {
      return;
    }
    this.pendingAsyncResolve = null;
    resolve(value);
  }
}

export function getMenuDataFor<TMenu extends MenuType>(
  state: Pick<MenuState, 'currentMenu' | 'data'>,
  menu: TMenu,
): MenuDataFor<TMenu> | null {
  if (state.currentMenu !== menu) {
    return null;
  }
  return state.data as MenuDataFor<TMenu>;
}

// Singleton instance
export const menuStateManager = new MenuStateManagerClass();
