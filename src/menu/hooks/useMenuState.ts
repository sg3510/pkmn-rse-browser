/**
 * React hook for menu state management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  menuStateManager,
  type MenuState,
  type MenuType,
  type MenuDataFor,
} from '../MenuStateManager';
import { inputMap, GameButton } from '../../core/InputMap';

/**
 * Hook to subscribe to menu state changes
 */
export function useMenuState() {
  const [state, setState] = useState<MenuState>(menuStateManager.getState());

  useEffect(() => {
    return menuStateManager.subscribe(setState);
  }, []);

  const openMenu = useCallback(<TMenu extends MenuType>(menu: TMenu, data?: MenuDataFor<TMenu>) => {
    menuStateManager.open(menu, data);
  }, []);

  const closeMenu = useCallback(() => {
    menuStateManager.close();
  }, []);

  const goBack = useCallback(() => {
    menuStateManager.back();
  }, []);

  const setCursor = useCallback((index: number) => {
    menuStateManager.setCursor(index);
  }, []);

  const moveCursor = useCallback((delta: number, maxIndex: number, wrap?: boolean) => {
    return menuStateManager.moveCursor(delta, maxIndex, wrap);
  }, []);

  return {
    ...state,
    openMenu,
    closeMenu,
    goBack,
    setCursor,
    moveCursor,
  };
}

/**
 * Hook for menu keyboard/mouse input handling
 */
export function useMenuInput(options: {
  onConfirm?: () => void;
  onCancel?: () => void;
  onSelect?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  enabled?: boolean;
}) {
  const {
    onConfirm,
    onCancel,
    onSelect,
    onUp,
    onDown,
    onLeft,
    onRight,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Confirm: A button
      if (inputMap.matchesCode(e.code, GameButton.A)) {
        e.preventDefault();
        e.stopPropagation();
        onConfirm?.();
        return;
      }

      // Cancel: B button
      if (inputMap.matchesCode(e.code, GameButton.B)) {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
        return;
      }

      // Select: SELECT button
      if (inputMap.matchesCode(e.code, GameButton.SELECT)) {
        e.preventDefault();
        e.stopPropagation();
        onSelect?.();
        return;
      }

      // Navigation: D-pad
      if (inputMap.matchesCode(e.code, GameButton.UP)) {
        e.preventDefault();
        e.stopPropagation();
        onUp?.();
        return;
      }

      if (inputMap.matchesCode(e.code, GameButton.DOWN)) {
        e.preventDefault();
        e.stopPropagation();
        onDown?.();
        return;
      }

      if (inputMap.matchesCode(e.code, GameButton.LEFT)) {
        e.preventDefault();
        e.stopPropagation();
        onLeft?.();
        return;
      }

      if (inputMap.matchesCode(e.code, GameButton.RIGHT)) {
        e.preventDefault();
        e.stopPropagation();
        onRight?.();
        return;
      }
    };

    // Use capture phase to intercept events before PlayerController
    // This ensures menu navigation takes priority over game input
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [enabled, onConfirm, onCancel, onSelect, onUp, onDown, onLeft, onRight]);
}
