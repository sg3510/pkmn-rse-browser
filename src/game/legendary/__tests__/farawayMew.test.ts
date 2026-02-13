import assert from 'node:assert';
import test from 'node:test';
import {
  getFarawayMewMoveDirection,
  shouldFarawayMewBeVisible,
  shouldFarawayMewPauseStep,
  shouldFarawayMewShakeGrass,
} from '../farawayMew';

test('Faraway Mew visibility cadence: visible every 8th step', () => {
  assert.strictEqual(shouldFarawayMewBeVisible(0), true);
  assert.strictEqual(shouldFarawayMewBeVisible(1), false);
  assert.strictEqual(shouldFarawayMewBeVisible(7), false);
  assert.strictEqual(shouldFarawayMewBeVisible(8), true);
});

test('Faraway Mew pause cadence: pauses every 9th step', () => {
  assert.strictEqual(shouldFarawayMewPauseStep(0), true);
  assert.strictEqual(shouldFarawayMewPauseStep(1), false);
  assert.strictEqual(shouldFarawayMewPauseStep(8), false);
  assert.strictEqual(shouldFarawayMewPauseStep(9), true);
});

test('Faraway Mew grass shake cadence matches C behavior', () => {
  assert.strictEqual(shouldFarawayMewShakeGrass(0), true);
  assert.strictEqual(shouldFarawayMewShakeGrass(1), false);
  assert.strictEqual(shouldFarawayMewShakeGrass(4), true);
  assert.strictEqual(shouldFarawayMewShakeGrass(0xffff), false);
});

test('GetMewMoveDirection returns null when player only turns in place', () => {
  const direction = getFarawayMewMoveDirection({
    stepCounter: 1,
    playerPrevX: 10,
    playerPrevY: 10,
    playerCurrX: 10,
    playerCurrY: 10,
    mewX: 12,
    mewY: 10,
    canMoveTo: () => true,
  });
  assert.strictEqual(direction, null);
});

test('GetMewMoveDirection returns null on pause steps even if player moved', () => {
  const direction = getFarawayMewMoveDirection({
    stepCounter: 9,
    playerPrevX: 10,
    playerPrevY: 10,
    playerCurrX: 11,
    playerCurrY: 10,
    mewX: 12,
    mewY: 10,
    canMoveTo: () => true,
  });
  assert.strictEqual(direction, null);
});

test('GetMewMoveDirection chooses a direction away from the player when available', () => {
  const direction = getFarawayMewMoveDirection({
    stepCounter: 1,
    playerPrevX: 10,
    playerPrevY: 10,
    playerCurrX: 11,
    playerCurrY: 10,
    mewX: 12,
    mewY: 10,
    canMoveTo: () => true,
  });
  assert.strictEqual(direction, 'right');
});

