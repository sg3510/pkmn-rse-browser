/**
 * React hook for menu state management
 */

import { useState, useEffect, useCallback } from 'react';
import { menuStateManager, type MenuState, type MenuType } from '../MenuStateManager';

/**
 * Hook to subscribe to menu state changes
 */
export function useMenuState() {
  const [state, setState] = useState<MenuState>(menuStateManager.getState());

  useEffect(() => {
    return menuStateManager.subscribe(setState);
  }, []);

  const openMenu = useCallback((menu: MenuType, data?: Record<string, unknown>) => {
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
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  enabled?: boolean;
}) {
  const {
    onConfirm,
    onCancel,
    onUp,
    onDown,
    onLeft,
    onRight,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Confirm: Enter, X
      if (e.code === 'Enter' || e.code === 'KeyX') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm?.();
        return;
      }

      // Cancel: Escape, Z
      if (e.code === 'Escape' || e.code === 'KeyZ') {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
        return;
      }

      // Navigation
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        e.stopPropagation();
        onUp?.();
        return;
      }

      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        onDown?.();
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
        e.preventDefault();
        e.stopPropagation();
        onLeft?.();
        return;
      }

      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyE') {
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
  }, [enabled, onConfirm, onCancel, onUp, onDown, onLeft, onRight]);
}
