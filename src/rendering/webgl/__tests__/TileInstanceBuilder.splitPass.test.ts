import assert from 'node:assert/strict';
import test from 'node:test';
import type { MapTileData, Metatile } from '../../../utils/mapLoader.ts';
import {
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_SPLIT,
} from '../../../utils/mapLoader.ts';
import type { TileResolverFn, WorldCameraView } from '../../types.ts';
import { TileInstanceBuilder } from '../TileInstanceBuilder.ts';

function createMetatile(baseTileId: number): Metatile {
  return {
    id: baseTileId,
    tiles: Array.from({ length: 8 }, (_, index) => ({
      tileId: baseTileId + index,
      xflip: false,
      yflip: false,
      palette: 0,
    })),
  };
}

function createView(): WorldCameraView {
  return {
    cameraX: 0,
    cameraY: 0,
    startTileX: 0,
    startTileY: 0,
    subTileOffsetX: 0,
    subTileOffsetY: 0,
    tilesWide: 2,
    tilesHigh: 2,
    pixelWidth: 32,
    pixelHeight: 32,
    worldStartTileX: 0,
    worldStartTileY: 0,
    cameraWorldX: 0,
    cameraWorldY: 0,
  };
}

test('split-pass build matches legacy three-pass output', () => {
  const metatileA = createMetatile(0);
  const metatileB = createMetatile(100);
  const metatileC = createMetatile(200);
  const metatileD = createMetatile(300);

  const tiles = new Map<string, {
    metatile: Metatile;
    layerType: number;
    mapTile: MapTileData;
  }>([
    ['0,0', { metatile: metatileA, layerType: METATILE_LAYER_TYPE_COVERED, mapTile: { metatileId: 0, collision: 0, elevation: 0 } }],
    ['1,0', { metatile: metatileB, layerType: METATILE_LAYER_TYPE_NORMAL, mapTile: { metatileId: 1, collision: 0, elevation: 1 } }],
    ['0,1', { metatile: metatileC, layerType: METATILE_LAYER_TYPE_SPLIT, mapTile: { metatileId: 2, collision: 0, elevation: 2 } }],
    ['1,1', { metatile: metatileD, layerType: METATILE_LAYER_TYPE_NORMAL, mapTile: { metatileId: 3, collision: 0, elevation: 3 } }],
  ]);

  const resolveTile: TileResolverFn = (x, y) => {
    const resolved = tiles.get(`${x},${y}`);
    if (!resolved) return null;
    return {
      map: {} as any,
      tileset: {} as any,
      metatile: resolved.metatile,
      attributes: { behavior: 0, layerType: resolved.layerType },
      mapTile: resolved.mapTile,
      isSecondary: false,
      isBorder: false,
      tilesetPairIndex: 0,
    };
  };

  const view = createView();
  const filterBelow = (mapTile: MapTileData) => mapTile.elevation <= 1;
  const filterAbove = (mapTile: MapTileData) => mapTile.elevation >= 2;

  const singlePassBuilder = new TileInstanceBuilder();
  const split = singlePassBuilder.buildSplitPassInstances(view, resolveTile, filterBelow, filterAbove);

  const legacyBuilder = new TileInstanceBuilder();
  const expectedBackground = legacyBuilder.buildBackgroundInstances(view, resolveTile);
  const expectedTopBelow = legacyBuilder.buildTopLayerInstances(view, resolveTile, filterBelow);
  const expectedTopAbove = legacyBuilder.buildTopLayerInstances(view, resolveTile, filterAbove);

  assert.deepEqual(split.background, expectedBackground);
  assert.deepEqual(split.topBelow, expectedTopBelow);
  assert.deepEqual(split.topAbove, expectedTopAbove);
  assert.notEqual(split.background, split.topBelow);
  assert.notEqual(split.topBelow, split.topAbove);
});
