import assert from 'node:assert/strict';
import test from 'node:test';
import { InputController } from '../InputController.ts';
import { GameButton } from '../InputMap.ts';

test('keyboard press emits one edge and then GBA-style repeats', () => {
  const controller = new InputController({ attachKeyboard: false });

  controller.setCodeActive('ArrowDown', true, 'keyboard', 'ArrowDown');

  const firstFrame = controller.consumeFrameState();
  assert.equal(firstFrame.pressed.has('ArrowDown'), true);
  assert.equal(firstFrame.held.has('ArrowDown'), true);
  assert.equal(firstFrame.repeated.has('ArrowDown'), false);
  assert.deepEqual(firstFrame.axes, { x: 0, y: 1 });

  for (let frame = 0; frame < 39; frame++) {
    const state = controller.consumeFrameState();
    assert.equal(state.repeated.has('ArrowDown'), false);
  }

  const repeatFrame = controller.consumeFrameState();
  assert.equal(repeatFrame.repeated.has('ArrowDown'), true);

  for (let frame = 0; frame < 4; frame++) {
    const state = controller.consumeFrameState();
    assert.equal(state.repeated.has('ArrowDown'), false);
  }

  const continuedRepeatFrame = controller.consumeFrameState();
  assert.equal(continuedRepeatFrame.repeated.has('ArrowDown'), true);

  controller.setCodeActive('ArrowDown', false, 'keyboard', 'ArrowDown');
  const releasedFrame = controller.consumeFrameState();
  assert.equal(releasedFrame.released.has('ArrowDown'), true);
  assert.equal(releasedFrame.held.has('ArrowDown'), false);
});

test('touch button input uses the shared code path and emits one buttondown', () => {
  const controller = new InputController({ attachKeyboard: false });
  const buttonEvents: string[] = [];

  const unsubscribe = controller.subscribe((event) => {
    if (event.type === 'buttondown' || event.type === 'buttonup') {
      buttonEvents.push(`${event.type}:${event.button}`);
    }
  });

  controller.setButtonActive(GameButton.A, true, 'touch', 'pointer-1');
  controller.setCodeActive('Space', true, 'keyboard', 'Space');

  const frame = controller.consumeFrameState();
  assert.equal(frame.pressed.has('Enter'), true);
  assert.equal(frame.sourceMask.has('touch'), true);
  assert.equal(frame.sourceMask.has('keyboard'), true);
  assert.deepEqual(buttonEvents, ['buttondown:A']);

  controller.setButtonActive(GameButton.A, false, 'touch', 'pointer-1');
  let releaseFrame = controller.consumeFrameState();
  assert.equal(releaseFrame.released.has('Enter'), true);
  assert.deepEqual(buttonEvents, ['buttondown:A']);

  controller.setCodeActive('Space', false, 'keyboard', 'Space');
  releaseFrame = controller.consumeFrameState();
  assert.equal(releaseFrame.released.has('Space'), true);
  assert.deepEqual(buttonEvents, ['buttondown:A', 'buttonup:A']);

  unsubscribe();
});

test('modal input stays consumed until release and the next tap works normally', () => {
  const controller = new InputController({ attachKeyboard: false });
  controller.setCodeActive('ArrowDown', true, 'touch', 1);
  controller.consumeCodeUntilRelease('ArrowDown');
  for (let i = 0; i < 50; i++) {
    const frame = controller.consumeFrameState();
    assert.equal(frame.pressed.size, 0);
    assert.equal(frame.held.size, 0);
    assert.equal(frame.repeated.size, 0);
    assert.deepEqual(frame.axes, { x: 0, y: 0 });
    assert.deepEqual(controller.getHeldRecord(), {});
  }
  controller.setCodeActive('ArrowDown', false, 'touch', 1);
  controller.setCodeActive('ArrowDown', true, 'touch', 2);
  assert.equal(controller.consumeFrameState().pressed.has('ArrowDown'), true);
});

test('consumed quick tap cannot leak a queued press after the modal closes', () => {
  const controller = new InputController({ attachKeyboard: false });
  const unsub = controller.subscribe(event => {
    if (event.type === 'keydown') controller.consumeCodeUntilRelease(event.code);
  });
  controller.setButtonActive(GameButton.B, true, 'touch', 1);
  unsub();
  controller.setButtonActive(GameButton.B, false, 'touch', 1);
  assert.equal(controller.consumeFrameState().pressed.size, 0);
});
