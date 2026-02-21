import assert from 'node:assert/strict';
import test from 'node:test';
import { TilesetPairScheduler } from '../TilesetPairScheduler.ts';
import type { LoadedMapInstance, TilesetPairInfo } from '../WorldManager.ts';

function createPair(id: string): TilesetPairInfo {
  return {
    id,
    primaryTilesetId: id,
    secondaryTilesetId: id,
    primaryTilesetPath: '',
    secondaryTilesetPath: '',
    primaryImage: {} as any,
    secondaryImage: {} as any,
    primaryPalettes: [],
    secondaryPalettes: [],
    primaryMetatiles: [],
    secondaryMetatiles: [],
    primaryAttributes: [],
    secondaryAttributes: [],
    animations: [],
  };
}

function createMap(params: {
  id: string;
  pairIndex: number;
  offsetY: number;
  connections: Array<{ direction: string; map: string; offset: number }>;
}): LoadedMapInstance {
  return {
    entry: {
      id: params.id,
      width: 10,
      height: 10,
      primaryTilesetId: 'unused',
      secondaryTilesetId: 'unused',
      connections: params.connections,
    } as any,
    mapData: { layout: [] } as any,
    offsetX: 0,
    offsetY: params.offsetY,
    tilesetPairIndex: params.pairIndex,
    borderMetatiles: [],
    warpEvents: [],
    objectEvents: [],
    coordEvents: [],
    bgEvents: [],
    mapWeather: null,
    mapAllowCycling: true,
    mapRequiresFlash: false,
  };
}

function setupSchedulerScenario() {
  const scheduler = new TilesetPairScheduler();
  scheduler.setCallbacks(() => {}, async () => {
    throw new Error('unexpected preload call');
  });

  const pairCurrent = createPair('PAIR_CURRENT');
  const pairNorth = createPair('PAIR_NORTH');
  const pairSouth = createPair('PAIR_SOUTH');
  const pairs = [pairCurrent, pairNorth, pairSouth];
  const mapTilesetPairIndex = new Map<string, number>([
    ['MAP_CURRENT', 0],
    ['MAP_NORTH', 1],
    ['MAP_SOUTH', 2],
  ]);

  const maps: LoadedMapInstance[] = [
    createMap({
      id: 'MAP_CURRENT',
      pairIndex: 0,
      offsetY: 0,
      connections: [
        { direction: 'up', map: 'MAP_NORTH', offset: 0 },
        { direction: 'down', map: 'MAP_SOUTH', offset: 0 },
      ],
    }),
    createMap({
      id: 'MAP_NORTH',
      pairIndex: 1,
      offsetY: -10,
      connections: [{ direction: 'down', map: 'MAP_CURRENT', offset: 0 }],
    }),
    createMap({
      id: 'MAP_SOUTH',
      pairIndex: 2,
      offsetY: 10,
      connections: [{ direction: 'up', map: 'MAP_CURRENT', offset: 0 }],
    }),
  ];

  scheduler.addToCache(pairCurrent);
  scheduler.addToCache(pairNorth);
  scheduler.addToCache(pairSouth);
  scheduler.setGpuSlot(pairCurrent.id, 0);
  scheduler.updateBoundaries(maps, mapTilesetPairIndex, pairs);

  return { scheduler, pairCurrent, pairNorth, pairSouth };
}

test('scheduler uses movement direction as tie-break for equal viewport coverage', () => {
  const { scheduler, pairCurrent, pairNorth, pairSouth } = setupSchedulerScenario();

  const result = scheduler.update(
    5,
    5,
    pairCurrent.id,
    'up',
    {
      visiblePairPriorities: [
        { pairId: pairNorth.id, coverageTiles: 100, nearestTileDistanceSq: 1 },
        { pairId: pairSouth.id, coverageTiles: 100, nearestTileDistanceSq: 1 },
      ],
    }
  );

  assert.equal(result.newSlot1, pairNorth.id);
  assert.equal(result.newSlot2, pairSouth.id);
});

test('scheduler keeps higher-coverage pair first even if direction points elsewhere', () => {
  const { scheduler, pairCurrent, pairNorth, pairSouth } = setupSchedulerScenario();

  const result = scheduler.update(
    5,
    5,
    pairCurrent.id,
    'down',
    {
      visiblePairPriorities: [
        { pairId: pairNorth.id, coverageTiles: 120, nearestTileDistanceSq: 4 },
        { pairId: pairSouth.id, coverageTiles: 80, nearestTileDistanceSq: 1 },
      ],
    }
  );

  assert.equal(result.newSlot1, pairNorth.id);
  assert.equal(result.newSlot2, pairSouth.id);
});
