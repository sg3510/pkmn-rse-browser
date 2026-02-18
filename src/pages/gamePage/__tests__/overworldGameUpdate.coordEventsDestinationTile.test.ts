import assert from 'node:assert/strict';
import test from 'node:test';
import { handleWorldUpdateAndEvents } from '../overworldGameUpdate.ts';
import { DEFAULT_DEBUG_OPTIONS } from '../../../components/debug/types.ts';
import { gameVariables, GAME_VARS } from '../../../game/GameVariables.ts';

test('handleWorldUpdateAndEvents matches coord events on destination tile (PlayerGetDestCoords parity)', () => {
  gameVariables.reset();

  const destinationTile = { x: 10, y: 11 };
  const firedScripts: Array<{ scriptName: string; mapId: string }> = [];
  const lastCoordTriggerTileRef: {
    current: { mapId: string; x: number; y: number } | null;
  } = { current: null };

  const currentMap = {
    entry: { id: 'MAP_PETALBURG_WOODS' },
    offsetX: 0,
    offsetY: 0,
    coordEvents: [
      {
        x: 10,
        y: 11,
        elevation: 0,
        script: 'PetalburgWoods_EventScript_TestCoord',
        var: GAME_VARS.VAR_ROUTE101_STATE,
        varValue: 0,
      },
    ],
    objectEvents: [],
  };

  const player = {
    tileX: 10,
    tileY: 10,
    x: 160,
    y: 160,
    isMoving: true,
    getFacingDirection: () => 'down',
    getDestinationTile: () => destinationTile,
    getCurrentElevation: () => 0,
    getElevation: () => 0,
    getPreviousElevation: () => 0,
    isSurfing: () => false,
    getSurfingController: () => ({ isJumping: () => false }),
    getStateName: () => 'NormalState',
    hasObjectCollisionChecker: () => true,
  } as any;

  const worldManager = {
    update: () => {},
    findMapAtPosition: () => currentMap,
    getDebugInfo: () => null,
  } as any;

  const weatherManager = {
    setMapDefaultsFromSources: () => {},
    setCurrentMap: () => {},
    applyCoordWeather: () => {},
  };

  handleWorldUpdateAndEvents({
    player,
    worldManager,
    preInputOnFrameTriggered: true,
    worldSnapshotRef: { current: null },
    weatherDefaultsSnapshotRef: { current: null },
    weatherManagerRef: { current: weatherManager as any },
    lastWorldUpdateRef: { current: null },
    lastCoordTriggerTileRef,
    lastPlayerMapIdRef: { current: null },
    cameraRef: { current: null },
    worldBoundsRef: { current: { minX: 0, minY: 0, width: 0, height: 0 } },
    warpingRef: { current: false },
    storyScriptRunningRef: { current: false },
    dialogIsOpenRef: { current: false },
    objectEventManagerRef: { current: { hasMapObjects: () => true } as any },
    doorSequencerIsActive: false,
    seamTransitionScriptsInFlightRef: { current: new Set<string>() },
    mapScriptCacheRef: { current: new Map() },
    mapScriptLoadingRef: { current: new Set() },
    onFrameSuppressedRef: { current: new Map() },
    runScript: (scriptName, mapId) => {
      firedScripts.push({ scriptName, mapId });
    },
    runSeamTransitionScripts: () => {},
    debugOptionsRef: { current: DEFAULT_DEBUG_OPTIONS },
    gbaFrameRef: { current: 1 },
    setMapDebugInfo: () => {},
    setPlayerDebugInfo: () => {},
    selectedMapId: currentMap.entry.id,
  });

  assert.deepEqual(firedScripts, [
    {
      scriptName: 'PetalburgWoods_EventScript_TestCoord',
      mapId: 'MAP_PETALBURG_WOODS',
    },
  ]);
  assert.deepEqual(lastCoordTriggerTileRef.current, {
    mapId: 'MAP_PETALBURG_WOODS',
    x: 10,
    y: 11,
  });
});
