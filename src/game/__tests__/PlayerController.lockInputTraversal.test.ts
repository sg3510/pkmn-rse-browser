import assert from 'node:assert';
import test from 'node:test';
import { PlayerController } from '../PlayerController';

function withWindowStub(run: () => void): void {
  const previousWindow = (globalThis as { window?: Window }).window;
  (globalThis as { window?: Window }).window = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as Window;

  try {
    run();
  } finally {
    if (previousWindow) {
      (globalThis as { window?: Window }).window = previousWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  }
}

test('lockInput keeps surfing state while in surf traversal mode', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setTraversalMode('surf', 'down');
    controller.lockInput();

    assert.strictEqual(controller.getStateName(), 'SurfingState');
    controller.destroy();
  });
});

test('lockInput keeps underwater state while in underwater traversal mode', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setTraversalMode('underwater', 'down');
    controller.lockInput();

    assert.strictEqual(controller.getStateName(), 'UnderwaterState');
    controller.destroy();
  });
});
