import assert from 'node:assert';
import test from 'node:test';
import { createInitialState, ObservableState, type Position } from '../GameState';
import { UpdateCoordinator } from '../UpdateCoordinator';
import type { WorldState } from '../../services/MapManager';

const stubWorld: WorldState = {
  anchorId: 'MAP_TEST',
  maps: [],
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
};

const stubPosition: Position = { x: 0, y: 0, tileX: 0, tileY: 0 };

test('UpdateCoordinator applies hook updates and mutates state flags', () => {
  const state = new ObservableState(createInitialState(stubWorld, stubPosition));
  let beforeCalled = false;
  let afterCalled = false;

  const coordinator = new UpdateCoordinator(state, {
    beforeUpdate: () => {
      beforeCalled = true;
    },
    update: () => ({
      needsRender: true,
      viewChanged: true,
      animationFrameChanged: false,
    }),
    afterUpdate: (_ctx, result) => {
      afterCalled = result.needsRender === true;
    },
  });

  const result = coordinator.update(16, 100);

  assert.ok(beforeCalled);
  assert.ok(afterCalled);
  assert.strictEqual(result.needsRender, true);
  assert.strictEqual(state.get().needsRender, true);
  assert.strictEqual(state.get().viewChanged, true);
});
