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

test('camera focus x remains tile-centered across traversal modes', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(10, 20);

    controller.setTraversalMode('land', 'down');
    const landFocus = controller.getCameraFocus();

    controller.setTraversalMode('surf', 'down');
    const surfFocus = controller.getCameraFocus();

    controller.setTraversalMode('underwater', 'down');
    const underwaterFocus = controller.getCameraFocus();

    assert.strictEqual(landFocus.x, surfFocus.x);
    assert.strictEqual(landFocus.x, underwaterFocus.x);
    assert.strictEqual(landFocus.x, 10 * 16 + 8);

    controller.destroy();
  });
});
