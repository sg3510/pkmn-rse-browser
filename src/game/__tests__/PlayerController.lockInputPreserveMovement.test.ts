import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerController, type TileResolver } from '../PlayerController.ts';

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

function createPassableTileResolver(): TileResolver {
  return () => ({
    mapTile: {
      metatileId: 1,
      collision: 0,
      elevation: 0,
    },
    attributes: {
      behavior: 0,
      layerType: 1,
    },
  });
}

function advanceMovement(controller: PlayerController, maxTicks = 32): void {
  for (let i = 0; i < maxTicks && controller.isMoving; i++) {
    controller.update(16);
  }
}

test('lockInputPreserveMovement keeps in-flight movement intact and lets the step complete', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setTileResolver(createPassableTileResolver());
    controller.setPosition(10, 10);

    controller.handleDirectionInput({ ArrowRight: true });
    assert.equal(controller.isMoving, true);

    controller.update(24);
    const partialX = controller.x;
    assert.ok(partialX > 10 * 16);

    controller.lockInputPreserveMovement();
    assert.equal(controller.inputLocked, true);
    assert.equal(controller.isMoving, true);
    assert.equal(controller.x, partialX);

    advanceMovement(controller);
    assert.equal(controller.isMoving, false);
    assert.equal(controller.tileX, 11);

    controller.destroy();
  });
});

test('lockInput preserves existing hard-stop behavior and snaps ongoing movement', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setTileResolver(createPassableTileResolver());
    controller.setPosition(10, 10);

    controller.handleDirectionInput({ ArrowRight: true });
    assert.equal(controller.isMoving, true);

    controller.update(24);
    assert.ok(controller.x > 10 * 16);

    controller.lockInput();
    assert.equal(controller.inputLocked, true);
    assert.equal(controller.isMoving, false);
    assert.equal(controller.tileX, 10);
    assert.equal(controller.x, 10 * 16);
    assert.equal(controller.y, 10 * 16 - 16);

    controller.update(16);
    assert.equal(controller.tileX, 10);
    assert.equal(controller.isMoving, false);

    controller.destroy();
  });
});
