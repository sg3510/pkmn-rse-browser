import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTrainerSightProbeTile } from '../trainerSightProbe.ts';

test('uses current tile when player is not moving', () => {
  const tile = getTrainerSightProbeTile({
    playerTileX: 10,
    playerTileY: 15,
    playerDirection: 'right',
    playerIsMoving: false,
  });

  assert.deepEqual(tile, { tileX: 10, tileY: 15 });
});

test('uses destination tile when moving up', () => {
  const tile = getTrainerSightProbeTile({
    playerTileX: 10,
    playerTileY: 15,
    playerDirection: 'up',
    playerIsMoving: true,
  });

  assert.deepEqual(tile, { tileX: 10, tileY: 14 });
});

test('uses destination tile when moving down', () => {
  const tile = getTrainerSightProbeTile({
    playerTileX: 10,
    playerTileY: 15,
    playerDirection: 'down',
    playerIsMoving: true,
  });

  assert.deepEqual(tile, { tileX: 10, tileY: 16 });
});

test('uses destination tile when moving left', () => {
  const tile = getTrainerSightProbeTile({
    playerTileX: 10,
    playerTileY: 15,
    playerDirection: 'left',
    playerIsMoving: true,
  });

  assert.deepEqual(tile, { tileX: 9, tileY: 15 });
});

test('uses destination tile when moving right', () => {
  const tile = getTrainerSightProbeTile({
    playerTileX: 10,
    playerTileY: 15,
    playerDirection: 'right',
    playerIsMoving: true,
  });

  assert.deepEqual(tile, { tileX: 11, tileY: 15 });
});
