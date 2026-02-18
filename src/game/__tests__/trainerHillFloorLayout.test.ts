import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTrainerHillLayoutBlock } from '../trainerHillFloorLayoutBlock.ts';

const SECONDARY_TILE_OFFSET = 16 * 32;

interface TestMapData {
  width: number;
  height: number;
  layout: Array<{
    metatileId: number;
    collision: number;
    elevation: number;
  }>;
}

function createMapData(width: number, height: number, metatileId = 7): TestMapData {
  return {
    width,
    height,
    layout: Array.from({ length: width * height }, () => ({
      metatileId,
      collision: 0,
      elevation: 0,
    })),
  };
}

test('applyTrainerHillLayoutBlock overlays 16x16 dynamic block at row 5', () => {
  const mapData = createMapData(16, 21, 123);
  const metatiles = new Uint8Array(256);
  for (let i = 0; i < metatiles.length; i++) {
    metatiles[i] = i & 0xff;
  }
  const collisionRows = new Uint16Array(16);
  collisionRows[0] = 0x8001; // x=0 and x=15 impassable

  const changed = applyTrainerHillLayoutBlock(mapData, metatiles, collisionRows);
  assert.equal(changed, true);

  // Top margin rows should remain untouched.
  assert.equal(mapData.layout[0].metatileId, 123);
  assert.equal(mapData.layout[0].elevation, 0);

  const row5x0 = mapData.layout[5 * 16 + 0];
  const row5x1 = mapData.layout[5 * 16 + 1];
  const row5x15 = mapData.layout[5 * 16 + 15];

  assert.equal(row5x0.metatileId, SECONDARY_TILE_OFFSET + 0);
  assert.equal(row5x1.metatileId, SECONDARY_TILE_OFFSET + 1);
  assert.equal(row5x15.metatileId, SECONDARY_TILE_OFFSET + 15);

  assert.equal(row5x0.collision, 1);
  assert.equal(row5x1.collision, 0);
  assert.equal(row5x15.collision, 1);

  assert.equal(row5x0.elevation, 3);
  assert.equal(row5x1.elevation, 3);
  assert.equal(row5x15.elevation, 3);
});

test('applyTrainerHillLayoutBlock returns false for incompatible map dimensions', () => {
  const mapData = createMapData(15, 21);
  const metatiles = new Uint8Array(256);
  const collisionRows = new Uint16Array(16);

  const changed = applyTrainerHillLayoutBlock(mapData, metatiles, collisionRows);
  assert.equal(changed, false);
  assert.equal(mapData.layout[0].metatileId, 7);
});
