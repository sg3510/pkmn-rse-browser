import assert from 'node:assert/strict';
import test from 'node:test';
import { OrbEffectRuntime } from '../scriptEffects/orbEffectRuntime.ts';

interface CameraStub {
  panCalls: Array<{ x: number; y: number }>;
  resetCalls: number;
  setPanning: (x: number, y: number) => void;
  resetPanning: () => void;
}

function createCameraStub(): CameraStub {
  return {
    panCalls: [],
    resetCalls: 0,
    setPanning(x: number, y: number) {
      this.panCalls.push({ x, y });
    },
    resetPanning() {
      this.resetCalls++;
    },
  };
}

test('orb runtime expands with correct color/center and enters shaking phase', async () => {
  const runtime = new OrbEffectRuntime();
  const camera = createCameraStub();

  const expansionDone = runtime.start(0);
  runtime.update(79, camera as any);

  let state = runtime.getRenderState();
  assert.ok(state);
  assert.equal(state.color, 'red');
  assert.equal(state.centerX, 104);
  assert.equal(state.centerY, 80);
  assert.equal(state.phase, 'expanding');
  assert.equal(state.radius, 159);

  runtime.update(1, camera as any);
  await expansionDone;
  state = runtime.getRenderState();
  assert.ok(state);
  assert.equal(state.phase, 'shaking');
  assert.equal(state.radius, 160);

  runtime.update(4, camera as any);
  assert.deepEqual(camera.panCalls.at(-1), { x: 0, y: 4 });
});

test('orb runtime fades out to idle and resolves fade waiter', async () => {
  const runtime = new OrbEffectRuntime();
  const camera = createCameraStub();

  const expansionDone = runtime.start(99);
  runtime.update(80, camera as any);
  await expansionDone;

  let state = runtime.getRenderState();
  assert.ok(state);
  assert.equal(state.color, 'blue');
  assert.equal(state.centerX, 120);

  const fadeDone = runtime.fadeOut();
  runtime.update(512, camera as any);
  await fadeDone;

  assert.equal(runtime.getRenderState(), null);
  assert.ok(camera.resetCalls > 0);
});
