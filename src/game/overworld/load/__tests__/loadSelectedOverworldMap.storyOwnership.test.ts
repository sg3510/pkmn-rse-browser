import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSelectedOverworldMap } from '../loadSelectedOverworldMap.ts';
import { WorldManager } from '../../../WorldManager.ts';
import {
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP,
} from '../../../TruckSequenceRunner.ts';
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

test('loadSelectedOverworldMap runs post-entry bootstrap after InsideOfTruck OnLoad metatile writes', async () => {
  const mapId = 'MAP_INSIDE_OF_TRUCK';
  const snapshot = createSnapshot(mapId);
  snapshot.maps[0].entry.mapType = 'MAP_TYPE_INDOOR';

  const entry = {
    id: mapId,
    name: 'Inside Truck',
    width: 12,
    height: 12,
  } as unknown as MapIndexEntry;

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
    unlockInput: () => {},
  };

  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let sawLoading = false;
  const finishWhenLoaded = (loading: boolean) => {
    if (loading) {
      sawLoading = true;
      return;
    }
    if (sawLoading) {
      resolveDone();
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
      loadingRef: { current: false },
      worldSnapshotRef: { current: null },
      playerRef: { current: player },
      cameraRef: { current: null },
      worldBoundsRef: { current: { width: 0, height: 0, minX: 0, minY: 0 } },
      worldManagerRef: { current: null },
      objectEventManagerRef: {
        current: {
          setTileElevationResolver: () => {},
          applyRuntimeState: () => {},
          refreshMapLoadState: () => {},
        },
      },
      pendingSavedLocationRef: {
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
      },
      pendingOverworldEntryReasonRef: { current: null },
      consumePendingObjectEventRuntimeState: () => null,
      pendingScriptedWarpRef: { current: null },
      warpingRef: { current: false },
      playerHiddenRef: { current: false },
      storyScriptRunningRef: { current: false },
      mapEntryCutsceneGateRef: { current: false },
      mapScriptCacheRef: { current: new Map() },
      lastCoordTriggerTileRef: { current: null },
      lastPlayerMapIdRef: { current: null },
      warpHandlerRef: {
        current: {
          updateLastCheckedTile: () => {},
        },
      },
      lastWorldUpdateRef: { current: null },
      fadeControllerRef: {
        current: {
          getDirection: () => 'in',
          isActive: () => true,
          startFadeIn: () => {},
        },
      },
      setLoading: finishWhenLoaded,
      setStats: () => {},
      setCameraDisplay: () => {},
      setWorldSize: () => {},
      setStitchedMapCount: () => {},
      onLoadingStateChanged: () => {},
      createSnapshotTileResolver: () => (() => null),
      createSnapshotPlayerTileResolver: () => (() => null),
      loadObjectEventsFromSnapshot: async () => {},
      initializeWorldFromSnapshot: async () => {},
      setMapMetatile: (targetMapId, tileX, tileY, metatileId) => {
        const map = snapshot.maps.find((candidate) => candidate.entry.id === targetMapId);
        assert.ok(map);
        map.mapData.layout[tileY * map.mapData.width + tileX].metatileId = metatileId;
        return true;
      },
      afterMapEntryScripts: (_loadedSnapshot, currentMapId) => {
        assert.equal(currentMapId, mapId);
        snapshot.maps[0].mapData.layout[1 * snapshot.maps[0].mapData.width + 4].metatileId = METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP;
        snapshot.maps[0].mapData.layout[2 * snapshot.maps[0].mapData.width + 4].metatileId = METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID;
        snapshot.maps[0].mapData.layout[3 * snapshot.maps[0].mapData.width + 4].metatileId = METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM;
      },
    });

    await done;
    cleanup();
  });

  assert.equal(snapshot.maps[0].mapData.layout[1 * snapshot.maps[0].mapData.width + 4].metatileId, METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP);
  assert.equal(snapshot.maps[0].mapData.layout[2 * snapshot.maps[0].mapData.width + 4].metatileId, METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID);
  assert.equal(snapshot.maps[0].mapData.layout[3 * snapshot.maps[0].mapData.width + 4].metatileId, METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM);
});
