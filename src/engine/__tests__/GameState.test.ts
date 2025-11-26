import assert from 'node:assert';
import test from 'node:test';
import { createInitialState, ObservableState, type GameState, type Position } from '../GameState';
import type { WorldState } from '../../services/MapManager';

const stubWorld: WorldState = {
  anchorId: 'MAP_TEST',
  maps: [],
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
};

const stubPosition: Position = { x: 0, y: 0, tileX: 0, tileY: 0 };

test('createInitialState seeds core fields', () => {
  const state = createInitialState(stubWorld, stubPosition);

  assert.strictEqual(state.anchorMapId, 'MAP_TEST');
  assert.strictEqual(state.playerTileX, 0);
  assert.strictEqual(state.playerTileY, 0);
  assert.strictEqual(state.needsRender, true);
});

test('ObservableState notifies listeners on update', () => {
  const state = new ObservableState(createInitialState(stubWorld, stubPosition));
  let observed: Partial<GameState> | null = null;

  const unsubscribe = state.subscribe((_next, changes) => {
    observed = changes;
  });

  state.update({ playerTileX: 2, needsRender: false });

  assert.strictEqual(state.get().playerTileX, 2);
  assert.deepStrictEqual(observed, { playerTileX: 2, needsRender: false });

  unsubscribe();
});
