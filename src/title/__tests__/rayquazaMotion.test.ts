import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleRayquazaFlight, sampleSwimAngle, RAYQUAZA_CYCLE_SECONDS } from '../rayquazaMotion.ts';

test('makes straight upward and downward back-facing passes separated offscreen', () => {
  for (const [start, end, sign, roll] of [[0, 3.5, 1, 0], [4.5, 8, -1, Math.PI]]) {
    let previous = sampleRayquazaFlight(start).y;
    for (let t = start + 0.05; t < end; t += 0.05) {
      const pose = sampleRayquazaFlight(t);
      assert.equal(pose.x, 0);
      assert.equal(pose.yaw, 0);
      assert.equal(pose.roll, roll);
      assert.equal(pose.coil, 0);
      assert.ok(sign * (pose.y - previous) > 0);
      previous = pose.y;
    }
  }
  assert.equal(sampleRayquazaFlight(4).visible, false);
  assert.equal(sampleRayquazaFlight(8.5).visible, false);
});

test('returns to the face-visible spiral, holds for twenty seconds, then departs', () => {
  for (const t of [12, 20, 31.999]) {
    const pose = sampleRayquazaFlight(t);
    assert.equal(pose.coil, 1);
    assert.equal(pose.y, 0);
    assert.equal(pose.roll, 0);
    assert.equal(pose.scale, 1);
  }
  for (const boundary of [12, 32]) {
    const before = sampleRayquazaFlight(boundary - 0.0001);
    const after = sampleRayquazaFlight(boundary + 0.0001);
    for (const key of ['x', 'y', 'coil', 'scale'] as const) assert.ok(Math.abs(before[key] - after[key]) < 0.001);
  }
  assert.ok(sampleRayquazaFlight(34.999).y > 6.9);
  assert.equal(sampleRayquazaFlight(RAYQUAZA_CYCLE_SECONDS).y, -7);
});

test('swim wave propagates toward the tail and grows in amplitude', () => {
  const amplitude = (d: number) => 0.16 + 0.48 * Math.min(1, d / 180);
  const upstream = sampleSwimAngle(40, 0.3) / amplitude(40);
  const downstream = sampleSwimAngle(80, 0.3 + 40 / 115 * 1.6) / amplitude(80);
  assert.ok(Math.abs(upstream - downstream) < 1e-10);
  assert.ok(amplitude(170) > amplitude(20));
  for (let t = 0; t < 120; t += 0.037) {
    const pose = sampleRayquazaFlight(t);
    assert.ok(pose.coil >= 0 && pose.coil <= 1);
    assert.ok(pose.glow >= 0 && pose.glow <= 1);
    assert.ok(Math.abs(sampleSwimAngle(180, t)) <= 0.64);
  }
});
