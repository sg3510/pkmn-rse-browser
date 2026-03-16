import assert from 'node:assert/strict';
import test from 'node:test';
import { clearDynamicWarpTarget, getDynamicWarpTarget } from '../../../DynamicWarp.ts';
import { gameFlags } from '../../../GameFlags.ts';
import { gameVariables } from '../../../GameVariables.ts';
import { performWarpTransition } from '../performWarpTransition.ts';
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

test('performWarpTransition falls back to explicit dynamic-warp coords when warpId is WARP_ID_NONE', async () => {
  clearDynamicWarpTarget();
  gameFlags.reset();
  gameVariables.reset();

  const positionAndDirectionCalls: Array<{ x: number; y: number; dir: string }> = [];
  const positionCalls: Array<{ x: number; y: number }> = [];
  const completeWarpCalls: Array<{ mapId: string; x: number; y: number }> = [];

  let tileResolver: ((x: number, y: number) => { attributes?: { behavior: number } } | null) | null = null;

  const player = {
    tileX: 4,
    tileY: 2,
    dir: 'right',
    resetForWarp: () => {},
    setPositionAndDirection: (x: number, y: number, dir: string) => {
      player.tileX = x;
      player.tileY = y;
      player.dir = dir;
      positionAndDirectionCalls.push({ x, y, dir });
    },
    setPosition: (x: number, y: number) => {
      player.tileX = x;
      player.tileY = y;
      positionCalls.push({ x, y });
    },
    setTileResolver: (resolver: typeof tileResolver) => {
      tileResolver = resolver;
    },
    getTileResolver: () => tileResolver,
    setMapAllowsCyclingResolver: () => {},
    getFacingDirection: () => player.dir,
    getBikeMode: () => 'none',
    isBikeRiding: () => false,
    unlockInput: () => {},
    getCyclingRoadChallengeCollisions: () => 0,
    setCyclingRoadChallengeActive: () => {},
    setTraversalState: () => {},
    getBikeSpecialValue: () => 0,
  };

  const destMap = {
    entry: {
      id: 'MAP_LITTLEROOT_TOWN',
      width: 20,
      height: 20,
      mapType: 'MAP_TYPE_TOWN',
      mapRequiresFlash: false,
    },
    mapData: {
      width: 20,
      height: 20,
      layout: [],
    },
    offsetX: 0,
    offsetY: 0,
    tilesetPairIndex: 0,
    borderMetatiles: [],
    warpEvents: [
      { x: 14, y: 8, destMap: 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F', destWarpId: 1 },
      { x: 5, y: 8, destMap: 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F', destWarpId: 1 },
      { x: 7, y: 16, destMap: 'MAP_LITTLEROOT_TOWN_PROFESSOR_BIRCHS_LAB', destWarpId: 0 },
    ],
    objectEvents: [],
    coordEvents: [],
    bgEvents: [],
    mapWeather: null,
    mapAllowCycling: true,
    mapRequiresFlash: false,
  };

  const snapshot = {
    maps: [destMap],
    tilesetPairs: [],
    mapTilesetPairIndex: new Map(),
    anchorBorderMetatiles: [],
    pairIdToGpuSlot: new Map(),
    anchorMapId: 'MAP_LITTLEROOT_TOWN',
    worldBounds: {
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 20,
      width: 20,
      height: 20,
    },
  };

  await performWarpTransition({
    trigger: {
      kind: 'door',
      sourceMap: {
        entry: { id: 'MAP_INSIDE_OF_TRUCK', mapType: 'MAP_TYPE_INDOOR' },
        offsetX: 0,
        offsetY: 0,
        warpEvents: [],
      } as never,
      warpEvent: {
        x: 4,
        y: 2,
        destMap: 'MAP_DYNAMIC',
        destWarpId: 127,
      },
      behavior: 0,
      facing: 'right',
    },
    options: { fromDoor: true },
    worldManager: {
      initialize: async () => snapshot,
      findMapAtPosition: () => destMap,
    } as never,
    player: player as never,
    pipeline: {
      invalidate: () => {},
    } as never,
    initializeWorldFromSnapshot: async () => {},
    createSnapshotPlayerTileResolver: () => () => null,
    objectEventManager: {
      setTileElevationResolver: () => {},
      setNPCPositionByLocalId: () => false,
      refreshMapLoadState: () => {},
      setNPCDirectionByLocalId: () => {},
      setNPCTemplatePositionByLocalId: () => {},
      setNPCVisibilityByLocalId: () => {},
      setNPCMovementTypeByLocalId: () => {},
      setNPCSpriteHiddenByLocalId: () => {},
      startNPCDisguiseRevealByLocalId: async () => {},
      completeNPCDisguiseRevealByLocalId: async () => {},
    } as never,
    getRenderContextFromSnapshot: () => null,
    doorSequencer: {
      reset: () => {},
      startExit: () => {},
      isExitActive: () => false,
    } as never,
    fadeController: {
      startFadeIn: () => {},
    } as never,
    warpHandler: {
      completeWarp: (mapId: string, x: number, y: number) => {
        completeWarpCalls.push({ mapId, x, y });
      },
      setCooldown: () => {},
      setInProgress: () => {},
    } as never,
    playerHiddenRef: { current: false },
    doorAnimations: {
      clearAll: () => {},
    } as never,
    lavaridgeWarpSequencer: {} as never,
    npcMovement: {
      reset: () => {},
    },
    setWarpDebugInfo: () => {},
    resolverVersion: 1,
    setLastCoordTriggerTile: () => {},
    warpingRef: { current: true },
    resolveDynamicWarpTarget: () => ({
      mapId: 'MAP_LITTLEROOT_TOWN',
      warpId: -1,
      x: 3,
      y: 10,
    }),
  });

  assert.deepEqual(positionAndDirectionCalls, [
    { x: 14, y: 8, dir: 'down' },
  ]);
  assert.deepEqual(positionCalls, [
    { x: 3, y: 10 },
  ]);
  assert.deepEqual(completeWarpCalls[completeWarpCalls.length - 1], {
    mapId: 'MAP_LITTLEROOT_TOWN',
    x: 3,
    y: 10,
  });
  assert.equal(player.tileX, 3);
  assert.equal(player.tileY, 10);
});
