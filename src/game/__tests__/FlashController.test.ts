import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FlashController,
  FLASH_LEVEL_TO_RADIUS,
  getFlashRadiusForLevel,
} from '../flash/FlashController.ts';

test('setDefaultFlashLevel matches cave/flash-flag parity rules', () => {
  const controller = new FlashController(async () => {});

  controller.setDefaultFlashLevel({ mapRequiresFlash: false, hasFlashFlag: false });
  assert.equal(controller.getFlashLevel(), 0);

  controller.setDefaultFlashLevel({ mapRequiresFlash: true, hasFlashFlag: true });
  assert.equal(controller.getFlashLevel(), 1);

  controller.setDefaultFlashLevel({ mapRequiresFlash: true, hasFlashFlag: false });
  assert.equal(controller.getFlashLevel(), 7);
});

test('setFlashLevel updates render radius from C flash-level table', () => {
  const controller = new FlashController(async () => {});

  for (let level = 0; level < FLASH_LEVEL_TO_RADIUS.length; level++) {
    controller.setFlashLevel(level);
    assert.equal(controller.getFlashLevel(), level);
    assert.equal(controller.getRenderRadius(), FLASH_LEVEL_TO_RADIUS[level]);
  }
});

test('animateFlashLevel steps one radius unit per frame until target without mutating persisted level', async () => {
  const delayCalls: number[] = [];
  const controller = new FlashController(async (frames) => {
    delayCalls.push(frames);
  });

  controller.setFlashLevel(7); // radius 24
  const beforePersistedLevel = controller.getFlashLevel();
  await controller.animateFlashLevel(5); // radius 40

  assert.equal(controller.getFlashLevel(), beforePersistedLevel);
  assert.equal(controller.getRenderRadius(), getFlashRadiusForLevel(5));
  assert.equal(delayCalls.length, getFlashRadiusForLevel(5) - getFlashRadiusForLevel(7));
  assert.ok(delayCalls.every((frames) => frames === 1));
});
