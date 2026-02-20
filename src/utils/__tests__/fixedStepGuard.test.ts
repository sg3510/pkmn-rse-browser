import assert from 'node:assert';
import test from 'node:test';
import { guardFixedStep } from '../fixedStepGuard';

test('guardFixedStep advances normal fixed steps and carries remainder', () => {
  const result = guardFixedStep({
    rawDeltaMs: 25,
    accumulatorMs: 0,
    stepMs: 10,
    resumeResetThresholdMs: 1000,
    maxSimulationDeltaMs: 100,
    maxCatchupSteps: 8,
  });

  assert.strictEqual(result.resumeReset, false);
  assert.strictEqual(result.clampedDeltaMs, 25);
  assert.strictEqual(result.stepsToRun, 2);
  assert.strictEqual(result.nextAccumulatorMs, 5);
  assert.strictEqual(result.droppedSteps, 0);
  assert.strictEqual(result.droppedMs, 0);
});

test('guardFixedStep resets on long resume deltas', () => {
  const result = guardFixedStep({
    rawDeltaMs: 2000,
    accumulatorMs: 7,
    stepMs: 10,
    resumeResetThresholdMs: 1000,
    maxSimulationDeltaMs: 100,
    maxCatchupSteps: 8,
  });

  assert.strictEqual(result.resumeReset, true);
  assert.strictEqual(result.clampedDeltaMs, 0);
  assert.strictEqual(result.stepsToRun, 0);
  assert.strictEqual(result.nextAccumulatorMs, 0);
  assert.strictEqual(result.droppedSteps, 0);
  assert.strictEqual(result.droppedMs, 0);
});

test('guardFixedStep clamps oversized delta and caps catch-up steps', () => {
  const result = guardFixedStep({
    rawDeltaMs: 500,
    accumulatorMs: 0,
    stepMs: 10,
    resumeResetThresholdMs: 1000,
    maxSimulationDeltaMs: 100,
    maxCatchupSteps: 8,
  });

  assert.strictEqual(result.resumeReset, false);
  assert.strictEqual(result.clampedDeltaMs, 100);
  assert.strictEqual(result.stepsToRun, 8);
  assert.strictEqual(result.droppedSteps, 2);
  assert.strictEqual(result.nextAccumulatorMs, 0);
  assert.strictEqual(result.droppedMs, 20);
});
