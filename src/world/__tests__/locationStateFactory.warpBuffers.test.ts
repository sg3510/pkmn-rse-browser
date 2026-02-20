import assert from 'node:assert/strict';
import test from 'node:test';
import { setDynamicWarpTarget, clearDynamicWarpTarget } from '../../game/DynamicWarp.ts';
import {
  clearFixedEscapeWarpTarget,
  setFixedEscapeWarpTarget,
} from '../../game/FixedEscapeWarp.ts';
import { buildLocationState } from '../locationStateFactory.ts';

function createBaseState() {
  return buildLocationState({
    mapId: 'MAP_LAVARIDGE_TOWN',
    x: 6,
    y: 8,
    direction: 'down',
    elevation: 3,
    isSurfing: false,
    isUnderwater: false,
    bikeMode: 'none',
    isRidingBike: false,
  });
}

test('buildLocationState includes runtime dynamic/escape warp buffers by default', () => {
  clearDynamicWarpTarget();
  clearFixedEscapeWarpTarget();
  setDynamicWarpTarget('MAP_UNDERWATER_ROUTE129', 26, 3, 1);
  setFixedEscapeWarpTarget('MAP_ROUTE129', 17, 15, 0);

  const state = createBaseState();

  assert.deepEqual(state.dynamicWarp, {
    mapId: 'MAP_UNDERWATER_ROUTE129',
    warpId: 1,
    x: 26,
    y: 3,
  });
  assert.deepEqual(state.escapeWarp, {
    mapId: 'MAP_ROUTE129',
    warpId: 0,
    x: 17,
    y: 15,
  });
});

test('buildLocationState falls back dynamic warp to continue warp when runtime buffer is unset', () => {
  clearDynamicWarpTarget();
  clearFixedEscapeWarpTarget();

  const state = createBaseState();

  assert.deepEqual(state.dynamicWarp, state.continueGameWarp);
});

test('buildLocationState explicit warp buffers override runtime buffers', () => {
  clearDynamicWarpTarget();
  clearFixedEscapeWarpTarget();
  setDynamicWarpTarget('MAP_ROUTE104', 4, 7, 4);
  setFixedEscapeWarpTarget('MAP_ROUTE105', 11, 29, 0);

  const state = buildLocationState({
    mapId: 'MAP_LAVARIDGE_TOWN',
    x: 6,
    y: 8,
    direction: 'down',
    elevation: 3,
    isSurfing: false,
    isUnderwater: false,
    bikeMode: 'none',
    isRidingBike: false,
    dynamicWarp: {
      mapId: 'MAP_ROUTE110',
      warpId: 2,
      x: 12,
      y: 4,
    },
    escapeWarp: {
      mapId: 'MAP_ROUTE111',
      warpId: 3,
      x: 9,
      y: 5,
    },
  });

  assert.deepEqual(state.dynamicWarp, {
    mapId: 'MAP_ROUTE110',
    warpId: 2,
    x: 12,
    y: 4,
  });
  assert.deepEqual(state.escapeWarp, {
    mapId: 'MAP_ROUTE111',
    warpId: 3,
    x: 9,
    y: 5,
  });
});

test('buildLocationState keeps provided flashLevel and defaults missing flashLevel to 0', () => {
  clearDynamicWarpTarget();
  clearFixedEscapeWarpTarget();

  const withExplicitFlash = buildLocationState({
    mapId: 'MAP_GRANITE_CAVE_B1F',
    x: 6,
    y: 8,
    direction: 'down',
    elevation: 3,
    flashLevel: 7,
  });
  assert.equal(withExplicitFlash.flashLevel, 7);

  const withDefaultFlash = buildLocationState({
    mapId: 'MAP_DEWFORD_TOWN_GYM',
    x: 4,
    y: 5,
    direction: 'up',
    elevation: 3,
  });
  assert.equal(withDefaultFlash.flashLevel, 0);
});

test('LocationState flashLevel survives JSON save/load roundtrip payloads', () => {
  const location = buildLocationState({
    mapId: 'MAP_GRANITE_CAVE_B2F',
    x: 11,
    y: 6,
    direction: 'left',
    elevation: 3,
    flashLevel: 5,
  });

  const serialized = JSON.stringify({ location });
  const parsed = JSON.parse(serialized) as { location: { flashLevel?: number } };
  assert.equal(parsed.location.flashLevel, 5);
});
