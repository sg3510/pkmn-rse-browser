import { parseNonNegativeInt, parseNumeric, type NumericInput } from "./numbers.js";
import type { GbaButton } from "./types.js";

const KEY_INDEX_BY_BUTTON: Record<GbaButton, number> = {
  A: 0,
  B: 1,
  SELECT: 2,
  START: 3,
  RIGHT: 4,
  LEFT: 5,
  UP: 6,
  DOWN: 7,
  R: 8,
  L: 9
};

type ButtonMaskInput = {
  button?: unknown;
  buttons?: unknown;
  mask?: NumericInput;
};

function toButtonName(raw: unknown, label: string): GbaButton {
  if (typeof raw !== "string") {
    throw new Error(`${label} must be a string button name.`);
  }

  const normalized = raw.trim().toUpperCase();
  const keyIndex = (KEY_INDEX_BY_BUTTON as Record<string, number | undefined>)[normalized];
  if (keyIndex === undefined) {
    throw new Error(`${label} has unsupported button "${raw}".`);
  }

  return normalized as GbaButton;
}

function maskForButtonName(button: GbaButton): number {
  return 1 << KEY_INDEX_BY_BUTTON[button];
}

export function resolveMask(input: ButtonMaskInput, label: string): number | undefined {
  if (input.mask !== undefined) {
    return parseNonNegativeInt(parseNumeric(input.mask, `${label}.mask`), `${label}.mask`);
  }

  let mask = 0;
  let hasButton = false;

  if (input.button !== undefined) {
    mask |= maskForButtonName(toButtonName(input.button, `${label}.button`));
    hasButton = true;
  }

  if (input.buttons !== undefined) {
    if (!Array.isArray(input.buttons)) {
      throw new Error(`${label}.buttons must be an array of button names.`);
    }

    for (let i = 0; i < input.buttons.length; i += 1) {
      mask |= maskForButtonName(toButtonName(input.buttons[i], `${label}.buttons[${i}]`));
      hasButton = true;
    }
  }

  return hasButton ? mask : undefined;
}
