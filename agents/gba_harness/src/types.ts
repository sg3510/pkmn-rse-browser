import type { NumericInput } from "./numbers.js";

export type GbaButton = "A" | "B" | "SELECT" | "START" | "RIGHT" | "LEFT" | "UP" | "DOWN" | "R" | "L";

type StepMetadata = {
  note?: string;
};

type ButtonInput = {
  button?: GbaButton;
  buttons?: GbaButton[];
  mask?: NumericInput;
};

type ReadStep = StepMetadata & {
  action: "read8" | "read16" | "read32";
  address: NumericInput;
  expect?: NumericInput;
};

type WriteStep = StepMetadata & {
  action: "write8" | "write16" | "write32";
  address: NumericInput;
  value: NumericInput;
};

type FileStep = StepMetadata & {
  action: "screenshot" | "saveState" | "loadState";
  path: string;
};

export type HarnessStep =
  | (StepMetadata & { action: "ping" })
  | (StepMetadata & { action: "frame"; expect?: NumericInput })
  | (StepMetadata & { action: "waitMs"; ms: NumericInput })
  | (StepMetadata & { action: "clearKeys" | "reset" })
  | (StepMetadata & ButtonInput & { action: "hold" | "release" })
  | (StepMetadata & ButtonInput & { action: "advance"; frames: NumericInput })
  | (StepMetadata & ButtonInput & { action: "tap"; frames?: NumericInput; afterFrames?: NumericInput })
  | ReadStep
  | WriteStep
  | FileStep;

export interface HarnessScript {
  host?: string;
  port?: NumericInput;
  timeoutMs?: NumericInput;
  steps: HarnessStep[];
}
