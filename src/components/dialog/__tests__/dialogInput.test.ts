import assert from 'node:assert/strict';
import test from 'node:test';
import { InputController } from '../../../core/InputController.ts';
import { GameButton, inputMap } from '../../../core/InputMap.ts';
import { subscribeDialogInput } from '../dialogInput.ts';

test('mobile A reaches dialog once per tap, including a tap entirely between frames', () => {
  const controller = new InputController({ attachKeyboard: false });
  const codes: string[] = [];
  const unsubscribe = subscribeDialogInput(controller, new EventTarget(), code => codes.push(code));
  controller.setButtonActive(GameButton.A, true, 'touch', 1);
  controller.setButtonActive(GameButton.A, true, 'touch', 1);
  controller.setButtonActive(GameButton.A, false, 'touch', 1);
  assert.deepEqual(codes, [inputMap.getPrimaryBinding(GameButton.A)]);
  controller.setButtonActive(GameButton.A, true, 'touch', 2);
  assert.equal(codes.length, 2);
  unsubscribe(); controller.releaseAll();
  controller.setButtonActive(GameButton.A, true, 'touch', 3);
  assert.equal(codes.length, 2);
});

test('touch choice navigation and cancellation follow remapped bindings', () => {
  const controller = new InputController({ attachKeyboard: false });
  const previous = inputMap.getBindings(GameButton.A);
  const received: string[] = [];
  const unsubscribe = subscribeDialogInput(controller, new EventTarget(), code => received.push(code));
  try {
    inputMap.setBindings(GameButton.A, ['KeyV']);
    for (const button of [GameButton.DOWN, GameButton.UP, GameButton.B, GameButton.A]) {
      controller.setButtonActive(button, true, 'touch', 1);
      controller.setButtonActive(button, false, 'touch', 1);
    }
    assert.deepEqual(received, ['ArrowDown', 'ArrowUp', 'KeyZ', 'KeyV']);
  } finally { unsubscribe(); controller.releaseAll(); inputMap.setBindings(GameButton.A, previous); }
});

test('native keyboard input retains the original event and is not duplicated by the controller', () => {
  const controller = new InputController({ attachKeyboard: false }), target = new EventTarget();
  const received: Array<KeyboardEvent | undefined> = [];
  const unsubscribe = subscribeDialogInput(controller, target, (_code, event) => received.push(event));
  const event = new Event('keydown'); Object.defineProperty(event, 'code', { value: 'Enter' });
  target.dispatchEvent(event); controller.setCodeActive('Enter', true, 'keyboard', 'Enter');
  assert.deepEqual(received, [event]);
  unsubscribe(); target.dispatchEvent(event); assert.equal(received.length, 1);
});
