import assert from 'node:assert/strict';
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

test('far jump object coords progress ledge -> landing without destination overshoot', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(20, 10);

    controller.forceJump('right', 'far');

    let coords = controller.getObjectEventCoords();
    let dest = controller.getDestinationTile();
    assert.deepEqual(coords.previous, { x: 20, y: 10 });
    assert.deepEqual(coords.current, { x: 21, y: 10 });
    assert.deepEqual(dest, { x: 21, y: 10 });

    // 300ms at jump speed crosses the 16px midpoint of a 32px far jump.
    controller.update(300);

    coords = controller.getObjectEventCoords();
    dest = controller.getDestinationTile();
    assert.deepEqual(coords.previous, { x: 21, y: 10 });
    assert.deepEqual(coords.current, { x: 22, y: 10 });
    assert.deepEqual(dest, { x: 22, y: 10 });

    // Finish jump
    controller.update(300);

    coords = controller.getObjectEventCoords();
    dest = controller.getDestinationTile();
    assert.deepEqual(coords.previous, { x: 22, y: 10 });
    assert.deepEqual(coords.current, { x: 22, y: 10 });
    assert.deepEqual(dest, { x: 22, y: 10 });
    assert.equal(controller.tileX, 22);
    assert.equal(controller.tileY, 10);

    controller.destroy();
  });
});
