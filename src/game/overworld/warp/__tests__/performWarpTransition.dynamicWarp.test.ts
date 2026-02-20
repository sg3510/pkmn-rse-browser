import assert from 'node:assert/strict';
import test from 'node:test';
import { clearDynamicWarpTarget, getDynamicWarpTarget } from '../../../DynamicWarp.ts';
import { maybePrimeDynamicWarpReturn } from '../dynamicWarpParity.ts';

test('maybePrimeDynamicWarpReturn primes MAP_DYNAMIC return target when destination arrival warp loops to MAP_DYNAMIC', () => {
  clearDynamicWarpTarget();

  maybePrimeDynamicWarpReturn(
    'MAP_UNDERWATER_ROUTE129',
    { x: 32, y: 21, destMap: 'MAP_UNDERWATER_MARINE_CAVE', destWarpId: 0 },
    [
      { x: 26, y: 3, destMap: 'MAP_UNDERWATER_MARINE_CAVE', destWarpId: 0 },
      { x: 32, y: 21, destMap: 'MAP_UNDERWATER_MARINE_CAVE', destWarpId: 0 },
    ],
    { x: 31, y: 21 },
    [{ destMap: 'MAP_DYNAMIC' }]
  );

  assert.deepEqual(getDynamicWarpTarget(), {
    mapId: 'MAP_UNDERWATER_ROUTE129',
    warpId: 1,
    x: 31,
    y: 21,
  });
});

test('maybePrimeDynamicWarpReturn is a no-op when destination arrival warp is not MAP_DYNAMIC', () => {
  clearDynamicWarpTarget();

  maybePrimeDynamicWarpReturn(
    'MAP_UNDERWATER_ROUTE129',
    { x: 26, y: 3, destMap: 'MAP_UNDERWATER_MARINE_CAVE', destWarpId: 0 },
    [{ x: 26, y: 3, destMap: 'MAP_UNDERWATER_MARINE_CAVE', destWarpId: 0 }],
    { x: 26, y: 3 },
    [{ destMap: 'MAP_ROUTE129' }]
  );

  assert.equal(getDynamicWarpTarget(), null);
});
