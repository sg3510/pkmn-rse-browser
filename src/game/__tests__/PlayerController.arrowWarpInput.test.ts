import assert from 'node:assert';
import test from 'node:test';
import { PlayerController, type TileResolver } from '../PlayerController';
import {
  MB_BRIDGE_OVER_POND_MED,
  MB_NORTH_ARROW_WARP,
  MB_OCEAN_WATER,
  MB_SAND,
  MB_WATER_SOUTH_ARROW_WARP,
} from '../../utils/metatileBehaviors';

interface TileSpec {
  behavior: number;
  metatileId: number;
  collision: number;
  elevation: number;
}

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

function createTileResolver(
  overrides: Record<string, Partial<TileSpec>>,
  fallback: TileSpec
): TileResolver {
  return (x, y) => {
    const key = `${x},${y}`;
    const override = overrides[key];
    const tile: TileSpec = {
      behavior: override?.behavior ?? fallback.behavior,
      metatileId: override?.metatileId ?? fallback.metatileId,
      collision: override?.collision ?? fallback.collision,
      elevation: override?.elevation ?? fallback.elevation,
    };
    return {
      mapTile: {
        metatileId: tile.metatileId,
        collision: tile.collision,
        elevation: tile.elevation,
      },
      attributes: {
        behavior: tile.behavior,
        layerType: 1,
      },
    };
  };
}

test('surfing: MB_WATER_SOUTH_ARROW_WARP triggers doorWarpHandler on matching direction', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(7, 16);
    controller.setTraversalMode('surf', 'down');

    const resolver = createTileResolver(
      {
        '7,16': {
          behavior: MB_WATER_SOUTH_ARROW_WARP,
          metatileId: 643,
          collision: 0,
          elevation: 1,
        },
      },
      {
        behavior: MB_OCEAN_WATER,
        metatileId: 368,
        collision: 0,
        elevation: 1,
      }
    );
    controller.setTileResolver(resolver);

    const calls: Array<{ targetX: number; targetY: number; behavior: number }> = [];
    controller.setDoorWarpHandler((request) => {
      calls.push(request);
    });

    controller.handleSurfingInput({ ArrowDown: true });

    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], {
      targetX: 7,
      targetY: 16,
      behavior: MB_WATER_SOUTH_ARROW_WARP,
    });
    assert.strictEqual(controller.isMoving, false);
    controller.destroy();
  });
});

test('surfing: MB_WATER_SOUTH_ARROW_WARP does not trigger on non-matching direction', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(7, 16);
    controller.setTraversalMode('surf', 'down');

    const resolver = createTileResolver(
      {
        '7,16': {
          behavior: MB_WATER_SOUTH_ARROW_WARP,
          metatileId: 643,
          collision: 0,
          elevation: 1,
        },
      },
      {
        behavior: MB_OCEAN_WATER,
        metatileId: 368,
        collision: 0,
        elevation: 1,
      }
    );
    controller.setTileResolver(resolver);

    const calls: Array<{ targetX: number; targetY: number; behavior: number }> = [];
    controller.setDoorWarpHandler((request) => {
      calls.push(request);
    });

    controller.handleSurfingInput({ ArrowUp: true });

    assert.strictEqual(calls.length, 0);
    assert.strictEqual(controller.isMoving, true);
    controller.destroy();
  });
});

test('surfing: normal surfable water still moves and does not trigger arrow warp', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(8, 12);
    controller.setTraversalMode('surf', 'right');

    const resolver = createTileResolver(
      {},
      {
        behavior: MB_OCEAN_WATER,
        metatileId: 368,
        collision: 0,
        elevation: 1,
      }
    );
    controller.setTileResolver(resolver);

    let called = false;
    controller.setDoorWarpHandler(() => {
      called = true;
    });

    controller.handleSurfingInput({ ArrowRight: true });

    assert.strictEqual(called, false);
    assert.strictEqual(controller.isMoving, true);
    controller.destroy();
  });
});

test('surfing: non-surfable bridge-over-water behavior is still traversable with matching elevation', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(14, 17);
    controller.setTraversalMode('surf', 'up');

    const resolver = createTileResolver(
      {
        '14,16': {
          behavior: MB_BRIDGE_OVER_POND_MED,
          metatileId: 756,
          collision: 0,
          elevation: 1,
        },
      },
      {
        behavior: MB_OCEAN_WATER,
        metatileId: 631,
        collision: 0,
        elevation: 1,
      }
    );
    controller.setTileResolver(resolver);

    controller.handleSurfingInput({ ArrowUp: true });

    assert.strictEqual(controller.isMoving, true);
    controller.destroy();
  });
});

test('surfing: blocked shore tile with elevation 3 starts dismount sequence', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(7, 7);
    controller.setTraversalMode('surf', 'down');

    const resolver = createTileResolver(
      {
        '7,8': {
          behavior: MB_SAND,
          metatileId: 520,
          collision: 0,
          elevation: 3,
        },
      },
      {
        behavior: MB_OCEAN_WATER,
        metatileId: 368,
        collision: 0,
        elevation: 1,
      }
    );
    controller.setTileResolver(resolver);

    controller.handleSurfingInput({ ArrowDown: true });

    assert.strictEqual(controller.getStateName(), 'SurfJumpingState');
    controller.destroy();
  });
});

test('land parity: arrow warp checks current tile and triggers immediately on matching direction', () => {
  withWindowStub(() => {
    const controller = new PlayerController();
    controller.setPosition(4, 4);
    controller.setTraversalMode('land', 'up');

    const resolver = createTileResolver(
      {
        '4,4': {
          behavior: MB_NORTH_ARROW_WARP,
          metatileId: 700,
          collision: 0,
          elevation: 1,
        },
      },
      {
        behavior: MB_OCEAN_WATER,
        metatileId: 368,
        collision: 0,
        elevation: 1,
      }
    );
    controller.setTileResolver(resolver);

    const calls: Array<{ targetX: number; targetY: number; behavior: number }> = [];
    controller.setDoorWarpHandler((request) => {
      calls.push(request);
    });

    controller.handleDirectionInput({ ArrowUp: true });

    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], {
      targetX: 4,
      targetY: 4,
      behavior: MB_NORTH_ARROW_WARP,
    });
    assert.strictEqual(controller.isMoving, false);
    controller.destroy();
  });
});
