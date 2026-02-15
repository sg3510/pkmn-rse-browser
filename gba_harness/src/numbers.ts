export type NumericInput = number | string;

export function parseNumeric(input: NumericInput, label: string): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new Error(`${label} must be a finite number.`);
    }
    return input;
  }

  const normalized = input.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }

  const isHex = /^0x[0-9a-f]+$/i.test(normalized);
  const isDec = /^-?\d+$/.test(normalized);
  if (!isHex && !isDec) {
    throw new Error(`${label} must be a decimal or 0x-prefixed hex integer: ${normalized}`);
  }

  const parsed = Number.parseInt(normalized, isHex ? 16 : 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} failed to parse as a number: ${normalized}`);
  }
  return parsed;
}

export function parseInteger(input: NumericInput, label: string): number {
  const parsed = parseNumeric(input, label);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }
  return parsed;
}

export function parseNonNegativeInt(input: NumericInput, label: string): number {
  const parsed = parseInteger(input, label);
  if (parsed < 0) {
    throw new Error(`${label} must be >= 0.`);
  }
  return parsed;
}
