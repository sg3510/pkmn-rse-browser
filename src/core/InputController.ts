import { GameButton, inputMap, type GameButton as GameButtonType } from './InputMap.ts';
import {
  DEFAULT_INPUT_REPEAT_POLICY,
  NEUTRAL_INPUT_AXES,
  type InputRepeatPolicy,
  type InputSource,
  type InputState,
} from './inputTypes.ts';

export interface InputEvent {
  type: 'buttondown' | 'buttonup' | 'keydown' | 'keyup';
  button?: GameButtonType;
  buttons: GameButtonType[];
  code: string;
  source: InputSource;
}

type InputListener = (event: InputEvent) => void;

function buildSourceKey(source: InputSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

function buildAxes(held: ReadonlySet<string>): InputState['axes'] {
  const left = inputMap.getBindings(GameButton.LEFT).some((code) => held.has(code));
  const right = inputMap.getBindings(GameButton.RIGHT).some((code) => held.has(code));
  const up = inputMap.getBindings(GameButton.UP).some((code) => held.has(code));
  const down = inputMap.getBindings(GameButton.DOWN).some((code) => held.has(code));

  const x = left === right ? 0 : left ? -1 : 1;
  const y = up === down ? 0 : up ? -1 : 1;

  return { x, y };
}

export class InputController {
  private readonly repeatPolicy: InputRepeatPolicy;
  private readonly listeners = new Set<InputListener>();
  private readonly codeSources = new Map<string, Set<string>>();
  private readonly buttonSources = new Map<GameButtonType, Set<string>>();
  private readonly sourceLookup = new Map<string, InputSource>();
  private readonly holdFrames = new Map<string, number>();
  private readonly pressedThisFrame = new Set<string>();
  private readonly releasedThisFrame = new Set<string>();
  private keyboardListenersBound = false;
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!inputMap.hasBinding(event.code)) return;
    event.preventDefault();
    this.setCodeActive(event.code, true, 'keyboard', event.code);
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (!inputMap.hasBinding(event.code)) return;
    event.preventDefault();
    this.setCodeActive(event.code, false, 'keyboard', event.code);
  };
  private readonly handleBlur = () => {
    this.releaseAll();
  };
  private readonly handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.releaseAll();
    }
  };

  constructor(options?: { repeatPolicy?: Partial<InputRepeatPolicy>; attachKeyboard?: boolean }) {
    this.repeatPolicy = {
      initialDelayFrames: options?.repeatPolicy?.initialDelayFrames ?? DEFAULT_INPUT_REPEAT_POLICY.initialDelayFrames,
      repeatIntervalFrames: options?.repeatPolicy?.repeatIntervalFrames ?? DEFAULT_INPUT_REPEAT_POLICY.repeatIntervalFrames,
    };

    if (options?.attachKeyboard !== false) {
      this.attachKeyboardListeners();
    }
  }

  private attachKeyboardListeners(): void {
    if (this.keyboardListenersBound || typeof window === 'undefined') {
      return;
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.keyboardListenersBound = true;
  }

  private notify(event: InputEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private updateButtonSource(button: GameButtonType, sourceKey: string, active: boolean): void {
    const current = this.buttonSources.get(button);
    const wasActive = (current?.size ?? 0) > 0;
    const next = current ?? new Set<string>();

    if (active) {
      next.add(sourceKey);
      this.buttonSources.set(button, next);
    } else {
      next.delete(sourceKey);
      if (next.size === 0) {
        this.buttonSources.delete(button);
      } else {
        this.buttonSources.set(button, next);
      }
    }

    const isActive = (this.buttonSources.get(button)?.size ?? 0) > 0;
    if (wasActive === isActive) return;

    const source = this.sourceLookup.get(sourceKey) ?? 'keyboard';
    const code = inputMap.getPrimaryBinding(button) ?? button;
    this.notify({
      type: isActive ? 'buttondown' : 'buttonup',
      button,
      buttons: [button],
      code,
      source,
    });
  }

  private getHeldCodes(): Set<string> {
    return new Set(this.codeSources.keys());
  }

  private emitCodeTransition(code: string, becameActive: boolean, source: InputSource): void {
    const buttons = inputMap.getButtonsForCode(code);
    this.notify({
      type: becameActive ? 'keydown' : 'keyup',
      code,
      buttons,
      source,
    });
  }

  setCodeActive(code: string, active: boolean, source: InputSource, sourceId: string): void {
    if (!inputMap.hasBinding(code)) return;

    const sourceKey = buildSourceKey(source, sourceId);
    this.sourceLookup.set(sourceKey, source);
    const buttons = inputMap.getButtonsForCode(code);
    const currentSources = this.codeSources.get(code) ?? new Set<string>();
    const wasCodeActive = currentSources.size > 0;

    if (active) {
      if (currentSources.has(sourceKey)) {
        return;
      }
      currentSources.add(sourceKey);
      this.codeSources.set(code, currentSources);
      for (const button of buttons) {
        this.updateButtonSource(button, sourceKey, true);
      }
      if (!wasCodeActive) {
        this.pressedThisFrame.add(code);
        this.holdFrames.set(code, 0);
        this.emitCodeTransition(code, true, source);
      }
      return;
    }

    if (!currentSources.has(sourceKey)) {
      return;
    }

    currentSources.delete(sourceKey);
    for (const button of buttons) {
      this.updateButtonSource(button, sourceKey, false);
    }

    if (currentSources.size === 0) {
      this.codeSources.delete(code);
      this.holdFrames.delete(code);
      if (wasCodeActive) {
        this.releasedThisFrame.add(code);
        this.emitCodeTransition(code, false, source);
      }
    } else {
      this.codeSources.set(code, currentSources);
    }

    const stillReferenced = Array.from(this.codeSources.values()).some((sources) => sources.has(sourceKey))
      || Array.from(this.buttonSources.values()).some((sources) => sources.has(sourceKey));
    if (!stillReferenced) {
      this.sourceLookup.delete(sourceKey);
    }
  }

  setButtonActive(button: GameButtonType, active: boolean, source: InputSource, sourceId: string | number): void {
    const code = inputMap.getPrimaryBinding(button);
    if (!code) return;
    this.setCodeActive(code, active, source, String(sourceId));
  }

  releaseAll(source?: InputSource): void {
    const codes = Array.from(this.codeSources.entries());
    for (const [code, sources] of codes) {
      for (const sourceKey of Array.from(sources)) {
        const currentSource = this.sourceLookup.get(sourceKey);
        if (source && currentSource !== source) {
          continue;
        }
        const sourceId = sourceKey.slice(sourceKey.indexOf(':') + 1);
        this.setCodeActive(code, false, currentSource ?? 'keyboard', sourceId);
      }
    }
  }

  consumeFrameState(): InputState {
    const held = this.getHeldCodes();
    const repeated = new Set<string>();
    const sourceMask = new Set<InputSource>();

    for (const [code, sources] of this.codeSources) {
      const priorFrames = this.holdFrames.get(code) ?? 0;
      const nextFrames = priorFrames + 1;
      this.holdFrames.set(code, nextFrames);

      if (
        !this.pressedThisFrame.has(code)
        && nextFrames > this.repeatPolicy.initialDelayFrames
        && (nextFrames - this.repeatPolicy.initialDelayFrames - 1) % this.repeatPolicy.repeatIntervalFrames === 0
      ) {
        repeated.add(code);
      }

      for (const sourceKey of sources) {
        const source = this.sourceLookup.get(sourceKey);
        if (source) {
          sourceMask.add(source);
        }
      }
    }

    const state: InputState = {
      pressed: new Set(this.pressedThisFrame),
      held,
      released: new Set(this.releasedThisFrame),
      repeated,
      axes: held.size > 0 ? buildAxes(held) : NEUTRAL_INPUT_AXES,
      sourceMask,
    };

    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();

    return state;
  }

  getHeldRecord(): Record<string, boolean> {
    const record: Record<string, boolean> = {};
    for (const code of this.codeSources.keys()) {
      record[code] = true;
    }
    return record;
  }

  subscribe(listener: InputListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.keyboardListenersBound && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleBlur);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.keyboardListenersBound = false;
    }
    this.releaseAll();
    this.listeners.clear();
  }
}

export const inputController = new InputController();
