/**
 * InputMap - Unified input mapping system
 *
 * Single source of truth for all keyboard → GBA button mappings.
 * Uses KeyboardEvent.code (physical key position) everywhere.
 *
 * Default mapping:
 *   A      → Enter, KeyX, Space   (confirm/interact)
 *   B      → KeyZ, Escape         (cancel/run)
 *   START  → Backspace            (start menu, "press start")
 *   SELECT → ShiftRight, ShiftLeft, KeyC
 *   D-pad  → Arrow keys, WASD
 *   L/R    → KeyQ, KeyE
 */

export const GameButton = {
  A: 'A',
  B: 'B',
  START: 'START',
  SELECT: 'SELECT',
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  L: 'L',
  R: 'R',
} as const;

export type GameButton = typeof GameButton[keyof typeof GameButton];

const DEFAULT_BINDINGS: Record<GameButton, string[]> = {
  [GameButton.A]:      ['Enter', 'KeyX', 'Space'],
  [GameButton.B]:      ['KeyZ', 'Escape'],
  [GameButton.START]:  ['Backspace'],
  [GameButton.SELECT]: ['ShiftRight', 'ShiftLeft', 'KeyC'],
  [GameButton.UP]:     ['ArrowUp', 'KeyW'],
  [GameButton.DOWN]:   ['ArrowDown', 'KeyS'],
  [GameButton.LEFT]:   ['ArrowLeft', 'KeyA'],
  [GameButton.RIGHT]:  ['ArrowRight', 'KeyD'],
  [GameButton.L]:      ['KeyQ'],
  [GameButton.R]:      ['KeyE'],
};

class InputMap {
  private bindings: Map<GameButton, Set<string>>;
  private reverseMap: Map<string, GameButton[]>;

  constructor() {
    this.bindings = new Map();
    this.reverseMap = new Map();
    this.loadDefaults();
  }

  private loadDefaults(): void {
    for (const [button, codes] of Object.entries(DEFAULT_BINDINGS)) {
      this.bindings.set(button as GameButton, new Set(codes));
    }
    this.rebuildReverse();
  }

  private rebuildReverse(): void {
    this.reverseMap.clear();
    for (const [button, codes] of this.bindings) {
      for (const code of codes) {
        const existing = this.reverseMap.get(code);
        if (existing) {
          existing.push(button);
        } else {
          this.reverseMap.set(code, [button]);
        }
      }
    }
  }

  /** Check if a KeyboardEvent.code matches any of the given buttons. */
  matchesCode(code: string, ...buttons: GameButton[]): boolean {
    const mapped = this.reverseMap.get(code);
    if (!mapped) return false;
    return buttons.some(b => mapped.includes(b));
  }

  /** Check if any of the given buttons were just pressed (InputState.pressed). */
  isPressed(input: { pressed: Set<string> }, ...buttons: GameButton[]): boolean {
    for (const button of buttons) {
      const codes = this.bindings.get(button);
      if (codes) {
        for (const code of codes) {
          if (input.pressed.has(code)) return true;
        }
      }
    }
    return false;
  }

  /** Check if any of the given buttons are held (InputState.held). */
  isHeld(input: { held: Set<string> }, ...buttons: GameButton[]): boolean {
    for (const button of buttons) {
      const codes = this.bindings.get(button);
      if (codes) {
        for (const code of codes) {
          if (input.held.has(code)) return true;
        }
      }
    }
    return false;
  }

  /** Check if any of the given buttons are held in a Record<string, boolean> (PlayerController). */
  isHeldInRecord(keys: Record<string, boolean>, ...buttons: GameButton[]): boolean {
    for (const button of buttons) {
      const codes = this.bindings.get(button);
      if (codes) {
        for (const code of codes) {
          if (keys[code]) return true;
        }
      }
    }
    return false;
  }

  /** Get all bound codes (for preventDefault sets). */
  getAllCodes(): Set<string> {
    return new Set(this.reverseMap.keys());
  }

  /** Get all bound codes for a button. */
  getBindings(button: GameButton): string[] {
    const codes = this.bindings.get(button);
    return codes ? Array.from(codes) : [];
  }

  /** Get the first bound code for a button (or null if unbound). */
  getPrimaryBinding(button: GameButton): string | null {
    const codes = this.bindings.get(button);
    if (!codes) return null;
    const first = codes.values().next();
    return first.done ? null : first.value;
  }

  /** Rebind a button to new codes. */
  setBindings(button: GameButton, codes: string[]): void {
    this.bindings.set(button, new Set(codes));
    this.rebuildReverse();
  }
}

export const inputMap = new InputMap();
