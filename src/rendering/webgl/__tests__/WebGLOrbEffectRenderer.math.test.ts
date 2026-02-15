import assert from 'node:assert/strict';
import test from 'node:test';
import { computeOrbViewportTransform } from '../WebGLOrbEffectRenderer.ts';

const EPSILON = 0.0001;

function assertNear(actual: number, expected: number, epsilon = EPSILON): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test('maps center/radius for square viewport', () => {
  const transform = computeOrbViewportTransform(120, 80, 160, 320, 320);

  assertNear(transform.centerPxX, 160);
  assertNear(transform.centerPxY, 160);
  assertNear(transform.radiusPx, 213.3333333);
});

test('maps center/radius for wide viewport without inner letterbox transform', () => {
  const transform = computeOrbViewportTransform(136, 80, 160, 1200, 700);

  assertNear(transform.centerPxX, 680);
  assertNear(transform.centerPxY, 350);
  assertNear(transform.radiusPx, 700);
});

test('maps center/radius for tall viewport while keeping circle radius from min axis scale', () => {
  const transform = computeOrbViewportTransform(104, 80, 160, 480, 960);

  assertNear(transform.centerPxX, 208);
  assertNear(transform.centerPxY, 480);
  assertNear(transform.radiusPx, 320);
});

test('preserves non-integer scaling (no floor quantization)', () => {
  const transform = computeOrbViewportTransform(120, 80, 33, 1000, 700);

  assertNear(transform.radiusPx, 137.5);
  assert.notEqual(transform.radiusPx, 132);
});
