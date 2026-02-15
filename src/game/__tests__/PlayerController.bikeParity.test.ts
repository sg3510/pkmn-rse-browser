import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerController } from '../PlayerController';
import {
  MB_JUMP_SOUTH,
  MB_MUDDY_SLOPE,
  MB_BUMPY_SLOPE,
  MB_VERTICAL_RAIL,
  MB_HORIZONTAL_RAIL,
  MB_ISOLATED_HORIZONTAL_RAIL,
} from '../../utils/metatileBehaviors';

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

test('Acro bike B press starts bunny hop with shadow', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(10, 10);
    controller.setTileResolver((x, y) => ({
      mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
      attributes: { behavior: 0, layerType: 0 },
    }));

    assert.equal(controller.tryUseBikeItem('acro'), 'mounted');
    controller.handleBikeInput({ KeyZ: true }, 'acro');

    assert.equal(controller.showShadow, true);
    assert.equal(controller.isMoving, true);

    controller.update(300);

    assert.equal(controller.showShadow, false);
    assert.equal(controller.isMoving, false);
    assert.equal(controller.getBikeMode(), 'acro');
    controller.destroy();
  });
});

test('Bike input can start ledge jump while mounted', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(5, 5);
    controller.setTileResolver((x, y) => {
      const behavior = x === 5 && y === 6 ? MB_JUMP_SOUTH : 0;
      return {
        mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
        attributes: { behavior, layerType: 0 },
      };
    });

    assert.equal(controller.tryUseBikeItem('mach'), 'mounted');
    controller.handleBikeInput({ ArrowDown: true }, 'mach');

    // JumpingState enter() moves logical tile to landing tile (+2).
    assert.equal(controller.tileX, 5);
    assert.equal(controller.tileY, 7);
    assert.equal(controller.showShadow, true);
    assert.equal(controller.isMoving, true);

    controller.update(600);
    assert.equal(controller.showShadow, false);
    assert.equal(controller.getBikeMode(), 'mach');
    controller.destroy();
  });
});

test('Mach bike reaches fast speed tier on first successful move', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(8, 8);
    controller.setTileResolver((x, y) => ({
      mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
      attributes: { behavior: 0, layerType: 0 },
    }));

    assert.equal(controller.tryUseBikeItem('mach'), 'mounted');
    controller.handleBikeInput({ ArrowRight: true }, 'mach');

    // First successful step now enters fast tier immediately.
    assert.equal(controller.getBikeMovementSpeed('mach'), 0.12);

    controller.update(300);
    controller.handleBikeInput({ ArrowRight: true }, 'mach');
    assert.equal(controller.getBikeMovementSpeed('mach'), 0.24);
    controller.destroy();
  });
});

test('Acro bike can side-jump on cycling rails with B, but cannot just walk sideways', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(10, 10);
    controller.setTileResolver((x, y) => {
      const isRail = (x === 10 && y === 10) || (x === 11 && y === 10);
      return {
        mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
        attributes: { behavior: isRail ? MB_VERTICAL_RAIL : 0, layerType: 0 },
      };
    });

    assert.equal(controller.tryUseBikeItem('acro'), 'mounted');

    // Without B, sideways move on a vertical rail should not walk.
    controller.handleBikeInput({ ArrowRight: true }, 'acro');
    assert.equal(controller.tileX, 10);
    assert.equal(controller.tileY, 10);
    assert.equal(controller.isMoving, false);

    // With B held, perform side jump.
    controller.handleBikeInput({ KeyZ: true, ArrowRight: true }, 'acro');
    assert.equal(controller.tileX, 11);
    assert.equal(controller.tileY, 10);
    assert.equal(controller.showShadow, true);
    assert.equal(controller.isMoving, true);
    // C parity: sideways jump movement does not rotate facing mid-jump.
    assert.equal(controller.dir, 'down');

    controller.update(500);
    assert.equal(controller.getBikeMode(), 'acro');
    assert.equal(controller.showShadow, false);
    // C parity: side-jump restores pre-jump facing after landing.
    assert.equal(controller.dir, 'down');
    controller.destroy();
  });
});

test('Bumpy slopes are blocked on foot and require B-held Acro movement', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(4, 4);
    controller.setTileResolver((x, y) => ({
      mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
      attributes: { behavior: x === 5 && y === 4 ? MB_BUMPY_SLOPE : 0, layerType: 0 },
    }));

    assert.equal(controller.forceMove('right'), false);
    assert.equal(controller.tryUseBikeItem('acro'), 'mounted');
    controller.handleBikeInput({ KeyZ: true, ArrowRight: true }, 'acro');
    assert.equal(controller.isMoving, true);
    controller.destroy();
  });
});

test('On-foot movement cannot enter isolated rail tiles', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(4, 4);
    controller.setTileResolver((x, y) => ({
      mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
      attributes: { behavior: x === 5 && y === 4 ? MB_ISOLATED_HORIZONTAL_RAIL : 0, layerType: 0 },
    }));

    assert.equal(controller.forceMove('right'), false);
    controller.destroy();
  });
});

test('Isolated rails block normal movement but allow Acro side-jump landing', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(10, 10);
    controller.setTileResolver((x, y) => {
      const behavior = x === 10 && y === 10
        ? MB_HORIZONTAL_RAIL
        : (x === 10 && y === 9 ? MB_ISOLATED_HORIZONTAL_RAIL : 0);
      return {
        mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
        attributes: { behavior, layerType: 0 },
      };
    });

    assert.equal(controller.tryUseBikeItem('acro'), 'mounted');
    controller.handleBikeInput({ ArrowUp: true }, 'acro');
    assert.equal(controller.tileX, 10);
    assert.equal(controller.tileY, 10);
    assert.equal(controller.isMoving, false);

    controller.handleBikeInput({ KeyZ: true, ArrowUp: true }, 'acro');
    assert.equal(controller.isMoving, true);
    assert.equal(controller.tileX, 10);
    assert.equal(controller.tileY, 9);

    controller.update(500);
    assert.equal(controller.getBikeMode(), 'acro');
    controller.destroy();
  });
});

test('Acro turn-jump flips facing in place on opposite-direction input', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPositionAndDirection(12, 12, 'right');
    controller.setTileResolver((x, y) => ({
      mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
      attributes: { behavior: x === 12 && y === 12 ? MB_HORIZONTAL_RAIL : 0, layerType: 0 },
    }));

    assert.equal(controller.tryUseBikeItem('acro'), 'mounted');
    controller.handleBikeInput({ KeyZ: true, ArrowLeft: true }, 'acro');
    assert.equal(controller.isMoving, true);
    assert.equal(controller.tileX, 12);
    assert.equal(controller.tileY, 12);

    controller.update(500);
    assert.equal(controller.getBikeMode(), 'acro');
    assert.equal(controller.dir, 'left');
    assert.equal(controller.tileX, 12);
    assert.equal(controller.tileY, 12);
    controller.destroy();
  });
});

test('Muddy slope forces player south unless climbing on max-speed Mach bike', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(5, 5);
    controller.setTileResolver((x, y) => ({
      mapTile: { metatileId: x + y * 100, collision: 0, elevation: 0 },
      attributes: { behavior: x === 5 && y === 4 ? MB_MUDDY_SLOPE : 0, layerType: 0 },
    }));

    assert.equal(controller.forceMove('up'), true);
    controller.update(300); // Reach muddy slope.
    assert.equal(controller.tileX, 5);
    assert.equal(controller.tileY, 4);
    assert.equal(controller.isMoving, true); // Forced south step started.
    assert.equal(controller.dir, 'down');
    controller.update(300);
    assert.equal(controller.tileX, 5);
    assert.equal(controller.tileY, 5);

    controller.setPosition(5, 7);
    assert.equal(controller.tryUseBikeItem('mach'), 'mounted');

    controller.handleBikeInput({ ArrowUp: true }, 'mach');
    controller.update(300);
    controller.handleBikeInput({ ArrowUp: true }, 'mach');
    controller.update(300);
    controller.handleBikeInput({ ArrowUp: true }, 'mach'); // Enter muddy slope at tier 2.
    controller.update(300);

    assert.equal(controller.tileX, 5);
    assert.equal(controller.tileY, 4);
    assert.equal(controller.isMoving, false);
    assert.equal(controller.dir, 'up');
    controller.destroy();
  });
});
