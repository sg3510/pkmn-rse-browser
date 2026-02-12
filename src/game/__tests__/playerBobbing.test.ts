import assert from 'node:assert';
import test from 'node:test';
import { TICK_60FPS_MS } from '../../config/timing';
import { getUnderwaterBobOffset, getUnderwaterBobOffsetForFrame } from '../playerBobbing';

test('underwater bob offset follows 32-frame C cycle', () => {
  assert.strictEqual(getUnderwaterBobOffsetForFrame(0), 1);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(3), 1);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(4), 2);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(12), 4);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(15), 4);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(16), 3);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(24), 1);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(28), 0);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(31), 0);
  assert.strictEqual(getUnderwaterBobOffsetForFrame(32), 1);
});

test('underwater bob offset from elapsed milliseconds matches frame-based helper', () => {
  const frame = 20;
  const elapsedMs = frame * TICK_60FPS_MS;
  assert.strictEqual(
    getUnderwaterBobOffset(elapsedMs),
    getUnderwaterBobOffsetForFrame(frame),
  );
});
