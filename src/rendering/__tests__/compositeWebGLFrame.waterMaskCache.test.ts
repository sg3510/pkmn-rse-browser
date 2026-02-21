import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorldSnapshot } from '../../game/WorldManager.ts';
import type { TilesetRuntime } from '../../utils/tilesetUtils.ts';
import type { WorldCameraView } from '../types.ts';
import { __testBuildWaterMaskCacheKey } from '../compositeWebGLFrame.ts';

function createView(overrides: Partial<WorldCameraView> = {}): WorldCameraView {
  return {
    cameraX: 0,
    cameraY: 0,
    startTileX: 0,
    startTileY: 0,
    subTileOffsetX: 0,
    subTileOffsetY: 0,
    tilesWide: 21,
    tilesHigh: 16,
    pixelWidth: 336,
    pixelHeight: 256,
    worldStartTileX: 0,
    worldStartTileY: 0,
    cameraWorldX: 0,
    cameraWorldY: 0,
    ...overrides,
  };
}

function createSnapshot(anchorMapId: string): WorldSnapshot {
  return {
    maps: [],
    tilesetPairs: [],
    mapTilesetPairIndex: new Map(),
    anchorBorderMetatiles: [],
    pairIdToGpuSlot: new Map(),
    anchorMapId,
    worldBounds: {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 1,
      height: 1,
    },
  };
}

function createRuntimeMap(lastPatchedKey: string): Map<string, TilesetRuntime> {
  return new Map([
    [
      'pair-0',
      {
        lastPatchedKey,
      } as TilesetRuntime,
    ],
  ]);
}

test('water-mask cache key is stable for identical inputs', () => {
  const snapshot = createSnapshot('MAP_A');
  const view = createView();
  const runtimes = createRuntimeMap('v1');

  const keyA = __testBuildWaterMaskCacheKey(view, snapshot, runtimes);
  const keyB = __testBuildWaterMaskCacheKey(view, snapshot, runtimes);
  assert.equal(keyA, keyB);
});

test('water-mask cache key changes when camera moves', () => {
  const snapshot = createSnapshot('MAP_A');
  const runtimes = createRuntimeMap('v1');

  const keyA = __testBuildWaterMaskCacheKey(createView({ cameraWorldX: 64 }), snapshot, runtimes);
  const keyB = __testBuildWaterMaskCacheKey(createView({ cameraWorldX: 65 }), snapshot, runtimes);
  assert.notEqual(keyA, keyB);
});

test('water-mask cache key changes when snapshot identity changes', () => {
  const view = createView();
  const runtimes = createRuntimeMap('v1');

  const keyA = __testBuildWaterMaskCacheKey(view, createSnapshot('MAP_A'), runtimes);
  const keyB = __testBuildWaterMaskCacheKey(view, createSnapshot('MAP_B'), runtimes);
  assert.notEqual(keyA, keyB);
});

test('water-mask cache key changes when tileset runtime version changes', () => {
  const snapshot = createSnapshot('MAP_A');
  const view = createView();

  const keyA = __testBuildWaterMaskCacheKey(view, snapshot, createRuntimeMap('v1'));
  const keyB = __testBuildWaterMaskCacheKey(view, snapshot, createRuntimeMap('v2'));
  assert.notEqual(keyA, keyB);
});
