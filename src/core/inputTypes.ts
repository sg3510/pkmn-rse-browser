export type InputSource = 'keyboard' | 'touch' | 'gamepad';

export interface InputAxisState {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

export interface InputRepeatPolicy {
  initialDelayFrames: number;
  repeatIntervalFrames: number;
}

export interface InputState {
  pressed: Set<string>;
  held: Set<string>;
  released: Set<string>;
  repeated: Set<string>;
  axes: InputAxisState;
  sourceMask: Set<InputSource>;
}

export interface InputSourceAdapter {
  readonly source: InputSource;
  attach(controller: { releaseAll: (source?: InputSource) => void }): void;
  detach(): void;
}

export const DEFAULT_INPUT_REPEAT_POLICY: InputRepeatPolicy = {
  initialDelayFrames: 40,
  repeatIntervalFrames: 5,
};

export const NEUTRAL_INPUT_AXES: InputAxisState = { x: 0, y: 0 };

