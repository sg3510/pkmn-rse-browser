import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { inputMap } from '../core/InputMap';
import { inputController } from '../core/InputController';

export interface UseInputOptions {
  onKeyDown?: (event: KeyboardEvent, pressed: Record<string, boolean>) => void;
  onKeyUp?: (event: KeyboardEvent, pressed: Record<string, boolean>) => void;
  preventDefaultKeys?: Array<string> | Set<string>;
  target?: Window | Document;
}

/** Derived from InputMap bindings (e.code values) */
const DEFAULT_PREVENT_KEYS = inputMap.getAllCodes();

/**
 * useInput - tracks the shared game input state and exposes change callbacks.
 *
 * The low-level DOM listeners now live in InputController so keyboard and
 * touch-driven button events share the same state transitions.
 */
export function useInput(options: UseInputOptions = {}): {
  pressedKeys: Record<string, boolean>;
  pressedKeysRef: MutableRefObject<Record<string, boolean>>;
} {
  const { onKeyDown, onKeyUp, preventDefaultKeys } = options;
  const pressedRef = useRef<Record<string, boolean>>({});
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});

  const preventKeys = useMemo(() => {
    if (preventDefaultKeys instanceof Set) return preventDefaultKeys;
    if (Array.isArray(preventDefaultKeys)) return new Set(preventDefaultKeys);
    return DEFAULT_PREVENT_KEYS;
  }, [preventDefaultKeys]);

  useEffect(() => {
    const createKeyboardEvent = (type: 'keydown' | 'keyup', code: string): KeyboardEvent => {
      if (typeof KeyboardEvent === 'function') {
        return new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          code,
          key: code,
        });
      }
      return { code } as KeyboardEvent;
    };

    const syncHeldRecord = (): Record<string, boolean> => {
      const next = inputController.getHeldRecord();
      pressedRef.current = next;
      setPressedKeys(next);
      return next;
    };

    pressedRef.current = inputController.getHeldRecord();
    setPressedKeys(pressedRef.current);

    return inputController.subscribe((event) => {
      if (!preventKeys.has(event.code)) {
        return;
      }

      if (event.type === 'keydown') {
        const next = syncHeldRecord();
        onKeyDown?.(createKeyboardEvent('keydown', event.code), next);
        return;
      }

      if (event.type === 'keyup') {
        const next = syncHeldRecord();
        onKeyUp?.(createKeyboardEvent('keyup', event.code), next);
      }
    });
  }, [onKeyDown, onKeyUp, preventKeys]);

  return { pressedKeys, pressedKeysRef: pressedRef };
}
