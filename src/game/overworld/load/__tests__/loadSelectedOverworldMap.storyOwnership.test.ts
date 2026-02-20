import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSelectedOverworldMap } from '../loadSelectedOverworldMap.ts';
import { WorldManager } from '../../../WorldManager.ts';
import type { MapIndexEntry } from '../../../../types/maps.ts';

interface MutableRef<T> {
  current: T;
}

function createSnapshot(mapId: string): any {
  return {
    anchorMapId: mapId,
    mapTilesetPairIndex: new Map([[mapId, 0]]),
    tilesetPairs: [{ primaryAttributes: [], secondaryAttributes: [] }],
    anchorBorderMetatiles: [],
    maps: [
      {
        entry: {
          id: mapId,
          width: 12,
          height: 12,
          mapType: 'MAP_TYPE_TOWN',
          mapAllowCycling: true,
          mapRequiresFlash: false,
        },
        offsetX: 0,
        offsetY: 0,
        mapData: {
          width: 12,
          height: 12,
          layout: Array.from({ length: 144 }, () => ({
            metatileId: 0,
            collision: 0,
            elevation: 0,
          })),
        },
        borderMetatiles: [],
        warpEvents: [],
        objectEvents: [],
        coordEvents: [],
      },
    ],
  };
}

function withWorldManagerPrototypeStubs(snapshot: any, run: () => Promise<void>): Promise<void> {
  const proto = WorldManager.prototype as any;
  const originalInitialize = proto.initialize;
  const originalOn = proto.on;
  const originalSetGpuUploadCallback = proto.setGpuUploadCallback;
  const originalDispose = proto.dispose;
  const originalFindMapAtPosition = proto.findMapAtPosition;

  proto.initialize = async () => snapshot;
  proto.on = () => {};
  proto.setGpuUploadCallback = () => {};
  proto.dispose = () => {};
  proto.findMapAtPosition = () => snapshot.maps[0];

  return run().finally(() => {
    proto.initialize = originalInitialize;
    proto.on = originalOn;
    proto.setGpuUploadCallback = originalSetGpuUploadCallback;
    proto.dispose = originalDispose;
    proto.findMapAtPosition = originalFindMapAtPosition;
  });
}

async function runLoadCase(options: {
  storyScriptRunning: boolean;
  warping: boolean;
  pendingScriptedWarp: any | null;
}): Promise<{ unlockCalls: number; storyScriptRunning: boolean; mapEntryGate: boolean }> {
  const mapId = 'MAP_TEST_STORY_OWNERSHIP';
  const snapshot = createSnapshot(mapId);

  const entry = {
    id: mapId,
    name: 'Test Map',
    width: 12,
    height: 12,
  } as unknown as MapIndexEntry;

  let unlockCalls = 0;
  const player: any = {
    tileX: 1,
    tileY: 1,
    dir: 'down',
    _tileResolver: null as any,
    setTileResolver(resolver: any) {
      this._tileResolver = resolver;
    },
    getTileResolver() {
      return this._tileResolver;
    },
    setMapAllowsCyclingResolver: () => {},
    setPosition(x: number, y: number) {
      this.tileX = x;
      this.tileY = y;
    },
    setTraversalState: () => {},
    setCyclingRoadChallengeActive: () => {},
    getElevation: () => 0,
    isSurfing: () => false,
    isUnderwater: () => false,
    getBikeMode: () => 'none',
    isBikeRiding: () => false,
    unlockInput: () => {
      unlockCalls++;
    },
  };

  const playerRef: MutableRef<any> = { current: player };
  const loadingRef: MutableRef<boolean> = { current: false };
  const worldSnapshotRef: MutableRef<any> = { current: null };
  const cameraRef: MutableRef<any> = { current: null };
  const worldBoundsRef: MutableRef<any> = { current: { width: 0, height: 0, minX: 0, minY: 0 } };
  const worldManagerRef: MutableRef<any> = { current: null };
  const objectEventManagerRef: MutableRef<any> = {
    current: {
      setTileElevationResolver: () => {},
      applyRuntimeState: () => {},
    },
  };
  const pendingSavedLocationRef: MutableRef<any> = {
    current: {
      location: { mapId },
      pos: { x: 1, y: 1 },
      direction: 'down',
      isSurfing: false,
      isUnderwater: false,
      bikeMode: 'none',
      isRidingBike: false,
      flashLevel: 0,
    },
  };
  const pendingOverworldEntryReasonRef: MutableRef<any> = { current: null };
  const pendingScriptedWarpRef: MutableRef<any> = { current: options.pendingScriptedWarp };
  const warpingRef: MutableRef<boolean> = { current: options.warping };
  const playerHiddenRef: MutableRef<boolean> = { current: false };
  const storyScriptRunningRef: MutableRef<boolean> = { current: options.storyScriptRunning };
  const mapEntryCutsceneGateRef: MutableRef<boolean> = { current: false };
  const mapScriptCacheRef: MutableRef<Map<string, unknown> | null> = { current: new Map() };
  const lastCoordTriggerTileRef: MutableRef<any> = { current: null };
  const lastPlayerMapIdRef: MutableRef<string | null> = { current: null };
  const warpHandlerRef: MutableRef<any> = {
    current: {
      updateLastCheckedTile: () => {},
    },
  };
  const lastWorldUpdateRef: MutableRef<any> = { current: null };
  const fadeControllerRef: MutableRef<any> = {
    current: {
      getDirection: () => 'in',
      isActive: () => true,
      startFadeIn: () => {},
    },
  };

  let doneResolve!: () => void;
  const done = new Promise<void>((resolve) => {
    doneResolve = resolve;
  });
  let sawInitialLoadingTrue = false;

  const setLoading = (loading: boolean) => {
    if (loading) {
      sawInitialLoadingTrue = true;
      return;
    }
    if (sawInitialLoadingTrue) {
      doneResolve();
    }
  };

  await withWorldManagerPrototypeStubs(snapshot, async () => {
    const cleanup = loadSelectedOverworldMap({
      entry,
      viewportTilesWide: 15,
      viewportTilesHigh: 10,
      pipeline: {
        invalidate: () => {},
      } as any,
      loadingRef,
      worldSnapshotRef,
      playerRef,
      cameraRef,
      worldBoundsRef,
      worldManagerRef,
      objectEventManagerRef,
      pendingSavedLocationRef,
      pendingOverworldEntryReasonRef,
      consumePendingObjectEventRuntimeState: () => null,
      pendingScriptedWarpRef,
      warpingRef,
      playerHiddenRef,
      storyScriptRunningRef,
      mapEntryCutsceneGateRef,
      mapScriptCacheRef,
      lastCoordTriggerTileRef,
      lastPlayerMapIdRef,
      warpHandlerRef,
      lastWorldUpdateRef,
      fadeControllerRef,
      setLoading,
      setStats: () => {},
      setCameraDisplay: () => {},
      setWorldSize: () => {},
      setStitchedMapCount: () => {},
      onLoadingStateChanged: () => {},
      createSnapshotTileResolver: () => (() => null),
      createSnapshotPlayerTileResolver: () => (() => null),
      loadObjectEventsFromSnapshot: async () => {},
      initializeWorldFromSnapshot: async () => {},
    });

    await done;
    cleanup();
  });

  return {
    unlockCalls,
    storyScriptRunning: storyScriptRunningRef.current,
    mapEntryGate: mapEntryCutsceneGateRef.current,
  };
}

test('loadSelectedOverworldMap does not clear story ownership and keeps input locked behind entry gate', async () => {
  const withStoryRunning = await runLoadCase({
    storyScriptRunning: true,
    warping: false,
    pendingScriptedWarp: null,
  });
  assert.equal(withStoryRunning.storyScriptRunning, true);
  assert.equal(withStoryRunning.unlockCalls, 0);

  const withOnlyEntryGate = await runLoadCase({
    storyScriptRunning: false,
    warping: false,
    pendingScriptedWarp: null,
  });
  assert.equal(withOnlyEntryGate.mapEntryGate, true);
  assert.equal(withOnlyEntryGate.unlockCalls, 0);
});
