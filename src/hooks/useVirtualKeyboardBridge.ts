import { useCallback, useEffect, useRef } from 'react';
import { type GameButton } from '../core/InputMap';
import { inputController } from '../core/InputController';

interface VirtualKeyboardBridge {
  pressButton: (button: GameButton, pointerId: number) => void;
  releasePointer: (pointerId: number) => void;
  releaseAll: () => void;
}

export function useVirtualKeyboardBridge(): VirtualKeyboardBridge {
  const pointerToButtonRef = useRef<Map<number, GameButton>>(new Map());

  const releasePointer = useCallback((pointerId: number) => {
    const pointerToButton = pointerToButtonRef.current;
    const button = pointerToButton.get(pointerId);
    if (!button) return;

    pointerToButton.delete(pointerId);
    inputController.setButtonActive(button, false, 'touch', pointerId);
  }, []);

  const releaseAll = useCallback(() => {
    inputController.releaseAll('touch');
    pointerToButtonRef.current.clear();
  }, []);

  const pressButton = useCallback((button: GameButton, pointerId: number) => {
    const pointerToButton = pointerToButtonRef.current;
    const existingButton = pointerToButton.get(pointerId);
    if (existingButton === button) {
      return;
    }

    if (existingButton) {
      inputController.setButtonActive(existingButton, false, 'touch', pointerId);
    }

    pointerToButton.set(pointerId, button);
    inputController.setButtonActive(button, true, 'touch', pointerId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        releaseAll();
      }
    };

    const handleBlur = () => releaseAll();
    const handleOrientationChange = () => releaseAll();
    const orientationMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: portrait)')
      : null;

    window.addEventListener('blur', handleBlur);
    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    orientationMedia?.addEventListener('change', handleOrientationChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      orientationMedia?.removeEventListener('change', handleOrientationChange);
      releaseAll();
    };
  }, [releaseAll]);

  return { pressButton, releasePointer, releaseAll };
}
