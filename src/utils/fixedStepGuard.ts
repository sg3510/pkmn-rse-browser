import {
  MAX_CATCHUP_STEPS_PER_TICK,
  MAX_SIMULATION_DELTA_MS,
  RESUME_RESET_THRESHOLD_MS,
} from '../config/timing';

export interface FixedStepGuardParams {
  rawDeltaMs: number;
  accumulatorMs: number;
  stepMs: number;
  resumeResetThresholdMs?: number;
  maxSimulationDeltaMs?: number;
  maxCatchupSteps?: number;
}

export interface FixedStepGuardResult {
  rawDeltaMs: number;
  clampedDeltaMs: number;
  nextAccumulatorMs: number;
  stepsToRun: number;
  droppedSteps: number;
  droppedMs: number;
  resumeReset: boolean;
}

function sanitizeDelta(rawDeltaMs: number): number {
  if (!Number.isFinite(rawDeltaMs) || rawDeltaMs <= 0) {
    return 0;
  }
  return rawDeltaMs;
}

/**
 * Guard fixed-step loops against tab-resume frame spikes and unbounded catch-up.
 */
export function guardFixedStep(params: FixedStepGuardParams): FixedStepGuardResult {
  const {
    rawDeltaMs,
    accumulatorMs,
    stepMs,
    resumeResetThresholdMs = RESUME_RESET_THRESHOLD_MS,
    maxSimulationDeltaMs = MAX_SIMULATION_DELTA_MS,
    maxCatchupSteps = MAX_CATCHUP_STEPS_PER_TICK,
  } = params;

  const safeStepMs = stepMs > 0 ? stepMs : 1;
  const safeAccumulatorMs = Math.max(0, sanitizeDelta(accumulatorMs));
  const safeRawDeltaMs = sanitizeDelta(rawDeltaMs);
  const resumeReset = safeRawDeltaMs >= resumeResetThresholdMs;

  if (resumeReset) {
    return {
      rawDeltaMs: safeRawDeltaMs,
      clampedDeltaMs: 0,
      nextAccumulatorMs: 0,
      stepsToRun: 0,
      droppedSteps: 0,
      droppedMs: 0,
      resumeReset: true,
    };
  }

  const clampedDeltaMs = Math.min(safeRawDeltaMs, maxSimulationDeltaMs);
  const nextAccumulatorRawMs = safeAccumulatorMs + clampedDeltaMs;
  const totalSteps = Math.floor(nextAccumulatorRawMs / safeStepMs);
  const stepsToRun = Math.min(totalSteps, maxCatchupSteps);
  const droppedSteps = totalSteps - stepsToRun;

  if (droppedSteps > 0) {
    const droppedMs = nextAccumulatorRawMs - (stepsToRun * safeStepMs);
    return {
      rawDeltaMs: safeRawDeltaMs,
      clampedDeltaMs,
      nextAccumulatorMs: 0,
      stepsToRun,
      droppedSteps,
      droppedMs,
      resumeReset: false,
    };
  }

  const consumedMs = stepsToRun * safeStepMs;
  const nextAccumulatorMs = Math.max(0, nextAccumulatorRawMs - consumedMs);
  return {
    rawDeltaMs: safeRawDeltaMs,
    clampedDeltaMs,
    nextAccumulatorMs,
    stepsToRun,
    droppedSteps: 0,
    droppedMs: 0,
    resumeReset: false,
  };
}
