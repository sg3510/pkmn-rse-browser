import assert from 'node:assert';
import test from 'node:test';
import type { MapConnection, MapIndexEntry } from '../../types/maps';
import {
  countReachableMapsWithinDepth,
  getReachableMapIdsWithinDepth,
} from '../mapGraph';

function createEntry(id: string, connections: MapConnection[]): MapIndexEntry {
  return {
    id,
    name: id,
    folder: id.toLowerCase(),
    layoutId: `${id}_layout`,
    width: 10,
    height: 10,
    layoutPath: 'layouts/test',
    primaryTilesetId: 'gTileset_General',
    secondaryTilesetId: 'gTileset_Petalburg',
    primaryTilesetPath: 'data/tilesets/primary/general',
    secondaryTilesetPath: 'data/tilesets/secondary/petalburg',
    connections,
    mapType: null,
    regionMapSection: null,
  };
}

const TEST_GRAPH: MapIndexEntry[] = [
  createEntry('MAP_A', [
    { map: 'MAP_B', direction: 'right', offset: 0 },
    { map: 'MAP_D', direction: 'left', offset: 0 },
    { map: 'MAP_WARP_ONLY', direction: 'warp', offset: 0 },
  ]),
  createEntry('MAP_B', [
    { map: 'MAP_A', direction: 'left', offset: 0 },
    { map: 'MAP_C', direction: 'right', offset: 0 },
  ]),
  createEntry('MAP_C', [{ map: 'MAP_B', direction: 'left', offset: 0 }]),
  createEntry('MAP_D', [{ map: 'MAP_A', direction: 'right', offset: 0 }]),
  createEntry('MAP_WARP_ONLY', [{ map: 'MAP_A', direction: 'warp', offset: 0 }]),
];

test('depth 0 returns only the anchor map', () => {
  const reachable = getReachableMapIdsWithinDepth(TEST_GRAPH, 'MAP_A', 0);
  assert.deepStrictEqual(Array.from(reachable), ['MAP_A']);
});

test('depth-limited BFS expands spatial neighbors only', () => {
  const depthOne = getReachableMapIdsWithinDepth(TEST_GRAPH, 'MAP_A', 1);
  assert.deepStrictEqual(new Set(depthOne), new Set(['MAP_A', 'MAP_B', 'MAP_D']));

  const depthTwo = getReachableMapIdsWithinDepth(TEST_GRAPH, 'MAP_A', 2);
  assert.deepStrictEqual(new Set(depthTwo), new Set(['MAP_A', 'MAP_B', 'MAP_C', 'MAP_D']));
});

test('count helper ignores non-spatial connections', () => {
  const count = countReachableMapsWithinDepth(TEST_GRAPH, 'MAP_A', 2);
  assert.strictEqual(count, 4);
});
