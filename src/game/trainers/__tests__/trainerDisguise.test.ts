import assert from 'node:assert/strict';
import test from 'node:test';
import { GBA_FRAME_MS } from '../../../config/timing.ts';
import {
  getTrainerDisguiseAnimationFrame,
  resolveTrainerDisguiseType,
} from '../trainerDisguise.ts';

test('resolveTrainerDisguiseType detects tree and mountain movement types', () => {
  assert.equal(resolveTrainerDisguiseType('MOVEMENT_TYPE_TREE_DISGUISE'), 'tree');
  assert.equal(resolveTrainerDisguiseType('MOVEMENT_TYPE_MOUNTAIN_DISGUISE'), 'mountain');
  assert.equal(resolveTrainerDisguiseType('MOVEMENT_TYPE_FACE_DOWN'), null);
});

test('getTrainerDisguiseAnimationFrame advances every 4 GBA frames and clamps to final frame', () => {
  const state = {
    type: 'tree',
    active: true,
    revealing: true,
    revealStartedAtMs: 1000,
  } as const;

  assert.equal(getTrainerDisguiseAnimationFrame(state, 1000), 0);
  assert.equal(getTrainerDisguiseAnimationFrame(state, 1000 + GBA_FRAME_MS * 3.9), 0);
  assert.equal(getTrainerDisguiseAnimationFrame(state, 1000 + GBA_FRAME_MS * 4.1), 1);
  assert.equal(getTrainerDisguiseAnimationFrame(state, 1000 + GBA_FRAME_MS * 40), 6);
});
