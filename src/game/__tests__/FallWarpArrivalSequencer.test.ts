import assert from 'node:assert/strict';
import test from 'node:test';
import { FallWarpArrivalSequencer } from '../FallWarpArrivalSequencer.ts';
import type { PlayerController } from '../PlayerController.ts';
import type { CameraController } from '../CameraController.ts';
import type { FieldEffectManager } from '../FieldEffectManager.ts';
import type { FadeController } from '../../field/FadeController.ts';

function createPlayerStub(): PlayerController {
  const player = {
    spriteYOffset: 0,
    y: 64,
    tileX: 9,
    tileY: 17,
    getFrameInfo: () => ({ renderY: 64, sh: 32 }),
  };
  return player as unknown as PlayerController;
}

function createCameraStub() {
  const panY: number[] = [];
  let resetCount = 0;
  const camera = {
    getPosition: () => ({ x: 0, y: 0 }),
    setPanning: (_x: number, y: number) => {
      panY.push(y);
    },
    resetPanning: () => {
      resetCount++;
    },
  };
  return {
    camera: camera as unknown as CameraController,
    panY,
    getResetCount: () => resetCount,
  };
}

function createFieldEffectsStub() {
  const calls: Array<{ x: number; y: number; effect: string }> = [];
  const updateCalls: number[] = [];
  let cleanupCallCount = 0;
  const fieldEffects = {
    create: (x: number, y: number, effect: string) => {
      calls.push({ x, y, effect });
    },
    update: (deltaMs: number) => {
      updateCalls.push(deltaMs);
    },
    cleanup: (_ownerPositions: Map<string, unknown>) => {
      cleanupCallCount++;
    },
  };
  return {
    fieldEffects: fieldEffects as unknown as FieldEffectManager,
    calls,
    updateCalls,
    getCleanupCallCount: () => cleanupCallCount,
  };
}

function createFadeStub(direction: 'in' | 'out' | null, isCompleteValue: () => boolean): FadeController {
  const fade = {
    getDirection: () => direction,
    isComplete: (_time: number) => isCompleteValue(),
  };
  return fade as unknown as FadeController;
}

test('fall warp sequencer waits for fade-in completion before starting fall', () => {
  const sequencer = new FallWarpArrivalSequencer();
  const player = createPlayerStub();
  const { camera } = createCameraStub();
  const { fieldEffects } = createFieldEffectsStub();

  let fadeComplete = false;
  const fadeController = createFadeStub('in', () => fadeComplete);
  let startCalls = 0;

  sequencer.start({
    onStartFall: () => {
      startCalls++;
    },
  });

  for (let i = 0; i < 8; i++) {
    sequencer.update({
      nowTime: i,
      player,
      camera,
      fieldEffects,
      fadeController,
    });
  }
  assert.equal(startCalls, 0);
  assert.equal(player.spriteYOffset, 0);

  fadeComplete = true;
  sequencer.update({
    nowTime: 9,
    player,
    camera,
    fieldEffects,
    fadeController,
  });
  assert.equal(startCalls, 0);

  sequencer.update({
    nowTime: 10,
    player,
    camera,
    fieldEffects,
    fadeController,
  });
  assert.equal(startCalls, 1);
  assert.ok(player.spriteYOffset < 0);
});

test('fall warp sequencer runs fall, dust, shake, and cleanup lifecycle', () => {
  const sequencer = new FallWarpArrivalSequencer();
  const player = createPlayerStub();
  const { camera, panY, getResetCount } = createCameraStub();
  const {
    fieldEffects,
    calls: fieldEffectCalls,
    updateCalls,
    getCleanupCallCount,
  } = createFieldEffectsStub();
  const fadeController = createFadeStub('in', () => true);

  let landCalls = 0;
  let completeCalls = 0;
  const observedFallOffsets = new Set<number>();
  let currentTick = -1;
  let landingTick = -1;
  let dustTick = -1;

  sequencer.start({
    onLand: () => {
      landCalls++;
      landingTick = currentTick;
    },
    onComplete: () => {
      completeCalls++;
    },
  });

  let previousOffset = player.spriteYOffset;
  for (let i = 0; i < 512 && sequencer.isActive(); i++) {
    currentTick = i;
    sequencer.update({
      nowTime: i,
      player,
      camera,
      fieldEffects,
      fadeController,
    });
    if (dustTick < 0 && fieldEffectCalls.length > 0) {
      dustTick = i;
    }
    const delta = player.spriteYOffset - previousOffset;
    if (delta > 0) {
      observedFallOffsets.add(delta);
    }
    previousOffset = player.spriteYOffset;
  }

  assert.equal(sequencer.isActive(), false);
  assert.equal(player.spriteYOffset, 0);
  assert.equal(landCalls, 1);
  assert.equal(completeCalls, 1);
  assert.equal(fieldEffectCalls.length, 1);
  assert.equal(landingTick, dustTick);
  assert.ok(updateCalls.length > 0);
  assert.ok(getCleanupCallCount() > 0);
  assert.deepEqual(fieldEffectCalls[0], {
    x: player.tileX,
    y: player.tileY,
    effect: 'GROUND_IMPACT_DUST',
  });
  assert.ok(observedFallOffsets.has(1));
  assert.ok(observedFallOffsets.has(2));
  assert.ok(observedFallOffsets.has(4));
  assert.ok(observedFallOffsets.has(8));
  assert.ok(panY.includes(4));
  assert.ok(panY.includes(-4));
  assert.ok(getResetCount() >= 1);
});
