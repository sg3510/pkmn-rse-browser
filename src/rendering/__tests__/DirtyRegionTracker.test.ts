/**
 * Tests for DirtyRegionTracker
 *
 * Run with: npx vitest run src/rendering/__tests__/DirtyRegionTracker.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DirtyRegionTracker } from '../DirtyRegionTracker';
import type { WorldCameraView, TilesetRuntime, ResolvedTile } from '../types';
import type { Metatile, Palette, MetatileAttributes, MapTileData } from '../../utils/mapLoader';

// Mock data
const createMockView = (options: Partial<WorldCameraView> = {}): WorldCameraView => ({
  tilesWide: 20,
  tilesHigh: 20,
  subTileOffsetX: 0,
  subTileOffsetY: 0,
  worldStartTileX: 0,
  worldStartTileY: 0,
  cameraWorldX: 0,
  cameraWorldY: 0,
  ...options,
});

const createMockMetatile = (tileIds: number[]): Metatile => ({
  tiles: tileIds.map((tileId, i) => ({
    tileId,
    palette: 0,
    xflip: false,
    yflip: false,
  })),
});

const createMockTilesetRuntime = (animatedTileIds: {
  primary: Set<number>;
  secondary: Set<number>;
}): TilesetRuntime => ({
  resources: {} as TilesetRuntime['resources'],
  primaryTileMasks: [],
  secondaryTileMasks: [],
  primaryReflectionMeta: [],
  secondaryReflectionMeta: [],
  animations: [],
  animatedTileIds,
  patchedTiles: null,
  lastPatchedKey: '',
});

describe('DirtyRegionTracker', () => {
  let tracker: DirtyRegionTracker;

  beforeEach(() => {
    tracker = new DirtyRegionTracker();
  });

  describe('scanViewport', () => {
    it('should identify positions with animated tiles', () => {
      const view = createMockView();
      const animatedTileIds = {
        primary: new Set([432, 433, 434, 435]), // Water tiles
        secondary: new Set<number>(),
      };
      const runtime = createMockTilesetRuntime(animatedTileIds);

      // Mock resolver that returns animated tiles at position 5,5
      const resolveTile = (x: number, y: number): ResolvedTile | null => {
        const isAnimatedPos = x === 5 && y === 5;
        return {
          map: {} as ResolvedTile['map'],
          tileset: { key: 'test' } as ResolvedTile['tileset'],
          metatile: createMockMetatile(isAnimatedPos ? [432, 433, 434, 435, 0, 0, 0, 0] : [0, 1, 2, 3, 4, 5, 6, 7]),
          attributes: undefined,
          mapTile: { metatileId: 0, collision: 0, elevation: 0 },
          isSecondary: false,
          isBorder: false,
        };
      };

      const runtimes = new Map([['test', runtime]]);
      tracker.scanViewport(view, resolveTile, runtimes);

      expect(tracker.hasAnimatedTiles()).toBe(true);
      expect(tracker.getAnimatedTileCount()).toBe(1);
    });

    it('should detect view changes', () => {
      const view1 = createMockView({ worldStartTileX: 0 });
      const view2 = createMockView({ worldStartTileX: 5 });

      expect(tracker.viewChanged(view1)).toBe(true); // First call always returns true
      tracker.scanViewport(view1, () => null, new Map());
      expect(tracker.viewChanged(view1)).toBe(false);
      expect(tracker.viewChanged(view2)).toBe(true);
    });
  });

  describe('getDirtyRegions', () => {
    it('should return empty array when no animated tiles', () => {
      const view = createMockView();
      tracker.scanViewport(view, () => null, new Map());

      const regions = tracker.getDirtyRegions(0, new Map());
      expect(regions).toEqual([]);
    });

    it('should return null when too many tiles are animated (threshold exceeded)', () => {
      const view = createMockView({ tilesWide: 10, tilesHigh: 10 });
      const animatedTileIds = {
        primary: new Set([432]),
        secondary: new Set<number>(),
      };
      const runtime = createMockTilesetRuntime(animatedTileIds);

      // All tiles are animated - more than 50% threshold
      const resolveTile = (): ResolvedTile | null => ({
        map: {} as ResolvedTile['map'],
        tileset: { key: 'test' } as ResolvedTile['tileset'],
        metatile: createMockMetatile([432, 0, 0, 0, 0, 0, 0, 0]),
        attributes: undefined,
        mapTile: { metatileId: 0, collision: 0, elevation: 0 },
        isSecondary: false,
        isBorder: false,
      });

      const runtimes = new Map([['test', runtime]]);
      tracker.scanViewport(view, resolveTile, runtimes);

      // Should return null because too many tiles are animated
      const regions = tracker.getDirtyRegions(0, runtimes);
      expect(regions).toBeNull();
    });
  });

  describe('clear', () => {
    it('should reset all tracking data', () => {
      const view = createMockView();
      tracker.scanViewport(view, () => null, new Map());
      tracker.clear();

      const stats = tracker.getStats();
      expect(stats.uniqueAnimatedTiles).toBe(0);
      expect(stats.animatedPositions).toBe(0);
    });
  });
});
