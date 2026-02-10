import assert from 'node:assert';
import test from 'node:test';
import { AnimationTimer } from '../AnimationTimer';
import { TICK_60FPS_MS } from '../../config/timing';

const TICK_MS = TICK_60FPS_MS;

test('AnimationTimer tracks ticks and frames', () => {
  const timer = new AnimationTimer();

  timer.update(TICK_MS);
  assert.strictEqual(timer.getTickCount(), 1);
  assert.strictEqual(timer.getCurrentFrame(), 0);

  // Advance nine more ticks to complete the default 10 tick frame
  for (let i = 0; i < 9; i++) {
    timer.update(TICK_MS);
  }

  assert.strictEqual(timer.getTickCount(), 10);
  assert.strictEqual(timer.getCurrentFrame(), 1);
});

test('AnimationTimer calculates frame for custom periods', () => {
  const timer = new AnimationTimer();

  // Advance 30 ticks (~0.5s)
  for (let i = 0; i < 30; i++) {
    timer.update(TICK_MS);
  }

  // 30 ticks at period 10 -> third frame in the cycle
  const frame = timer.getFrameForPeriod(10, 16);
  assert.strictEqual(frame, 3);
});
