import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerController } from '../PlayerController.ts';
import { MB_ICE } from '../../utils/metatileBehaviors.generated.ts';

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

function createTileResolver(): (tileX: number, tileY: number) => any {
  return (tileX: number, tileY: number) => {
    const behavior = tileX === 1 && tileY === 0 ? MB_ICE : 0;
    return {
      attributes: { behavior, layerType: 0 },
      mapTile: { metatileId: 0, collision: 0, elevation: 0 },
    };
  };
}

test('scripted forceMove can suppress post-move special-tile chaining', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setTileResolver(createTileResolver());
    controller.setPosition(0, 0);

    assert.equal(controller.forceMove('right', true, undefined, {
      suppressPostMoveSpecialTileCheck: true,
    }), true);
    controller.update(1000);

    assert.equal(controller.tileX, 1);
    assert.equal(controller.getStateName(), 'NormalState');
    assert.equal(controller.isMoving, false);
    controller.destroy();
  });
});

test('normal movement still triggers autonomous ice sliding', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setTileResolver(createTileResolver());
    controller.setPosition(0, 0);

    assert.equal(controller.forceMove('right', true), true);
    controller.update(1000);

    assert.equal(controller.tileX, 1);
    assert.equal(controller.getStateName(), 'IceSlidingState');
    controller.destroy();
  });
});
