import { useCallback, useEffect, useRef } from 'react';
import { GameButton, inputMap } from '../core/InputMap';

function codeToKey(code: string): string {
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);

  switch (code) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Enter':
    case 'Backspace':
    case 'Escape':
      return code;
    case 'Space':
      return ' ';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'Shift';
    default:
      return code;
  }
}

function dispatchSyntheticKeyEvent(type: 'keydown' | 'keyup', code: string): void {
  if (typeof window === 'undefined') return;
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
    key: codeToKey(code),
  });
  window.dispatchEvent(event);
}

interface VirtualKeyboardBridge {
  pressButton: (button: GameButton, pointerId: number) => void;
  releasePointer: (pointerId: number) => void;
  releaseAll: () => void;
}

export function useVirtualKeyboardBridge(): VirtualKeyboardBridge {
  const pointerToCodeRef = useRef<Map<number, string>>(new Map());
  const codePressCountRef = useRef<Map<string, number>>(new Map());

  const releasePointer = useCallback((pointerId: number) => {
    const pointerToCode = pointerToCodeRef.current;
    const code = pointerToCode.get(pointerId);
    if (!code) return;

    pointerToCode.delete(pointerId);
    const codePressCount = codePressCountRef.current;
    const currentCount = codePressCount.get(code) ?? 0;

    if (currentCount <= 1) {
      codePressCount.delete(code);
      dispatchSyntheticKeyEvent('keyup', code);
      return;
    }

    codePressCount.set(code, currentCount - 1);
  }, []);

  const releaseAll = useCallback(() => {
    const codePressCount = codePressCountRef.current;
    for (const code of codePressCount.keys()) {
      dispatchSyntheticKeyEvent('keyup', code);
    }
    codePressCount.clear();
    pointerToCodeRef.current.clear();
  }, []);

  const pressButton = useCallback((button: GameButton, pointerId: number) => {
    const code = inputMap.getPrimaryBinding(button);
    if (!code) return;

    const pointerToCode = pointerToCodeRef.current;
    const existingCode = pointerToCode.get(pointerId);
    if (existingCode === code) return;
    if (existingCode) {
      releasePointer(pointerId);
    }

    pointerToCode.set(pointerId, code);
    const codePressCount = codePressCountRef.current;
    const currentCount = codePressCount.get(code) ?? 0;
    if (currentCount === 0) {
      dispatchSyntheticKeyEvent('keydown', code);
    }
    codePressCount.set(code, currentCount + 1);
  }, [releasePointer]);

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

