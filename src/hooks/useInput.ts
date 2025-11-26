import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';

export interface UseInputOptions {
  onKeyDown?: (event: KeyboardEvent, pressed: Record<string, boolean>) => void;
  onKeyUp?: (event: KeyboardEvent, pressed: Record<string, boolean>) => void;
  preventDefaultKeys?: Array<string> | Set<string>;
  target?: Window | Document;
}

const DEFAULT_PREVENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'W',
  'a',
  'A',
  's',
  'S',
  'd',
  'D',
  'z',
  'Z',
  'x',
  'X',
  ' ',
  'Enter',
]);

/**
 * useInput - tracks pressed keys and exposes change callbacks.
 *
 * PlayerController still owns its own listeners; this hook is meant to
 * coordinate ancillary game input (surf prompts, item pickup) in a single
 * place without sprinkling window listeners across the component.
 */
export function useInput(options: UseInputOptions = {}): {
  pressedKeys: Record<string, boolean>;
  pressedKeysRef: MutableRefObject<Record<string, boolean>>;
} {
  const { onKeyDown, onKeyUp, target = window, preventDefaultKeys } = options;
  const pressedRef = useRef<Record<string, boolean>>({});
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});

  const preventKeys = useMemo(() => {
    if (preventDefaultKeys instanceof Set) return preventDefaultKeys;
    if (Array.isArray(preventDefaultKeys)) return new Set(preventDefaultKeys);
    return DEFAULT_PREVENT_KEYS;
  }, [preventDefaultKeys]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (preventKeys.has(e.key)) {
        e.preventDefault();
      }
      if (pressedRef.current[e.key]) {
        onKeyDown?.(e, pressedRef.current);
        return;
      }
      pressedRef.current = { ...pressedRef.current, [e.key]: true };
      setPressedKeys(pressedRef.current);
      onKeyDown?.(e, pressedRef.current);
    };

    const up = (e: KeyboardEvent) => {
      if (preventKeys.has(e.key)) {
        e.preventDefault();
      }
      if (!pressedRef.current[e.key]) {
        onKeyUp?.(e, pressedRef.current);
        return;
      }
      const next = { ...pressedRef.current };
      delete next[e.key];
      pressedRef.current = next;
      setPressedKeys(next);
      onKeyUp?.(e, pressedRef.current);
    };

    const eventTarget: Window | Document = target;
    const downListener = down as EventListener;
    const upListener = up as EventListener;

    eventTarget.addEventListener('keydown', downListener);
    eventTarget.addEventListener('keyup', upListener);

    return () => {
      eventTarget.removeEventListener('keydown', downListener);
      eventTarget.removeEventListener('keyup', upListener);
    };
  }, [onKeyDown, onKeyUp, preventKeys, target]);

  return { pressedKeys, pressedKeysRef: pressedRef };
}
