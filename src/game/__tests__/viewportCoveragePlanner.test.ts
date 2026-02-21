import assert from 'node:assert/strict';
import test from 'node:test';
import type { LoadedMapInstance } from '../WorldManager.ts';
import {
  buildViewportCoverageHint,
  computeViewportCoverageForMaps,
} from '../viewportCoveragePlanner.ts';

function createMap(id: string, offsetX: number, offsetY: number, width: number, height: number): LoadedMapInstance {
  return {
    entry: {
      id,
      width,
      height,
      connections: [],
    } as any,
    mapData: { layout: [] } as any,
    offsetX,
    offsetY,
    tilesetPairIndex: 0,
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

test('computeViewportCoverageForMaps ranks visible pairs by tile coverage', () => {
  const maps = [
    createMap('MAP_A', 0, 0, 10, 10),
    createMap('MAP_B', 8, 0, 10, 10),
    createMap('MAP_C', 24, 0, 10, 10),
  ];
  const pairByMap = new Map<string, string>([
    ['MAP_A', 'PAIR_A'],
    ['MAP_B', 'PAIR_B'],
    ['MAP_C', 'PAIR_C'],
  ]);

  const hint = buildViewportCoverageHint({
    startTileX: 0,
    startTileY: 0,
    tilesWide: 10,
    tilesHigh: 10,
    focusTileX: 4,
    focusTileY: 4,
    direction: 'right',
    preloadMarginTiles: 0,
  });

  const coverage = computeViewportCoverageForMaps({
    maps,
    resolvePairId: (mapId) => pairByMap.get(mapId) ?? null,
    hint,
  });

  assert.deepEqual(new Set(['MAP_A', 'MAP_B']), coverage.visibleMapIds);
  assert.deepEqual(new Set(['PAIR_A', 'PAIR_B']), coverage.visiblePairIds);
  assert.equal(coverage.visiblePairPriorities[0]?.pairId, 'PAIR_A');
  assert.equal(coverage.visiblePairPriorities[1]?.pairId, 'PAIR_B');
  assert.equal(coverage.visiblePairPriorities[0]?.coverageTiles, 100);
  assert.equal(coverage.visiblePairPriorities[1]?.coverageTiles, 20);
});

test('computeViewportCoverageForMaps expands visibility with preload margin', () => {
  const maps = [
    createMap('MAP_A', 0, 0, 10, 10),
    createMap('MAP_B', 10, 0, 10, 10),
    createMap('MAP_C', 20, 0, 10, 10),
  ];
  const pairByMap = new Map<string, string>([
    ['MAP_A', 'PAIR_A'],
    ['MAP_B', 'PAIR_B'],
    ['MAP_C', 'PAIR_C'],
  ]);

  const hint = buildViewportCoverageHint({
    startTileX: 0,
    startTileY: 0,
    tilesWide: 10,
    tilesHigh: 10,
    focusTileX: 5,
    focusTileY: 5,
    direction: 'right',
    preloadMarginTiles: 12,
  });

  const coverage = computeViewportCoverageForMaps({
    maps,
    resolvePairId: (mapId) => pairByMap.get(mapId) ?? null,
    hint,
  });

  assert.ok(coverage.visibleMapIds.has('MAP_C'));
  assert.ok(coverage.visiblePairIds.has('PAIR_C'));
});
