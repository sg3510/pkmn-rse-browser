import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';

interface ObjectHarness {
  ctx: StoryScriptContext;
  visibilityCalls: Array<{ mapId: string; localId: string; visible: boolean; persistent?: boolean }>;
  positionCalls: Array<{ mapId: string; localId: string; x: number; y: number }>;
  movementTypeCalls: Array<{ mapId: string; localId: string; movementType: string }>;
}

function createData(commands: ScriptCommand[]): { mapData: MapScriptData; commonData: MapScriptData } {
  return {
    mapData: {
      mapScripts: {},
      scripts: { Main: commands },
      movements: {},
      text: {},
    },
    commonData: {
      mapScripts: {},
      scripts: {},
      movements: {},
      text: {},
    },
  };
}

function createHarness(): ObjectHarness {
  const visibilityCalls: Array<{ mapId: string; localId: string; visible: boolean; persistent?: boolean }> = [];
  const positionCalls: Array<{ mapId: string; localId: string; x: number; y: number }> = [];
  const movementTypeCalls: Array<{ mapId: string; localId: string; movementType: string }> = [];

  const ctx: StoryScriptContext = {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => true,
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: () => {},
    forcePlayerStep: () => {},
    delayFrames: async () => {},
    movePlayer: async () => {},
    moveNpc: async () => {},
    faceNpcToPlayer: () => {},
    setNpcPosition: (mapId, localId, x, y) => {
      positionCalls.push({ mapId, localId, x, y });
    },
    setNpcVisible: (mapId, localId, visible, persistent) => {
      visibilityCalls.push({ mapId, localId, visible, persistent });
    },
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
    setNpcMovementType: (mapId, localId, movementType) => {
      movementTypeCalls.push({ mapId, localId, movementType });
    },
    findNpcMapId: (localId) => (
      localId === 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE' ? 'MAP_SEAFLOOR_CAVERN_ROOM9' : null
    ),
  };

  return { ctx, visibilityCalls, positionCalls, movementTypeCalls };
}

test('object commands resolve VAR local IDs and clear stale local-string state', async () => {
  gameVariables.reset();
  saveStateStore.setAllObjectEventOverrides({});
  const harness = createHarness();
  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_0x8004', 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE'] },
    { cmd: 'addobject', args: ['VAR_0x8004'] },
    { cmd: 'setobjectxy', args: ['VAR_0x8004', 16, 42] },
    { cmd: 'setobjectxyperm', args: ['VAR_0x8004', 17, 43] },
    { cmd: 'setobjectmovementtype', args: ['VAR_0x8004', 'MOVEMENT_TYPE_FACE_LEFT'] },
    { cmd: 'hideobjectat', args: ['VAR_0x8004'] },
    { cmd: 'showobjectat', args: ['VAR_0x8004'] },
    { cmd: 'removeobject', args: ['VAR_0x8004'] },
    { cmd: 'setvar', args: ['VAR_0x8004', 99] },
    { cmd: 'addobject', args: ['VAR_0x8004'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    harness.ctx,
    'MAP_SEAFLOOR_CAVERN_ROOM9'
  );
  const handled = await runner.execute('Main');

  assert.equal(handled, true);
  assert.deepEqual(harness.positionCalls, [
    { mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9', localId: 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE', x: 16, y: 42 },
  ]);
  assert.deepEqual(
    saveStateStore.getObjectEventOverride('MAP_SEAFLOOR_CAVERN_ROOM9', 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE'),
    { x: 17, y: 43 }
  );
  assert.deepEqual(harness.movementTypeCalls, [
    {
      mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9',
      localId: 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE',
      movementType: 'MOVEMENT_TYPE_FACE_LEFT',
    },
  ]);
  assert.deepEqual(harness.visibilityCalls, [
    {
      mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9',
      localId: 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE',
      visible: true,
      persistent: false,
    },
    {
      mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9',
      localId: 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE',
      visible: false,
      persistent: undefined,
    },
    {
      mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9',
      localId: 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE',
      visible: true,
      persistent: undefined,
    },
    {
      mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9',
      localId: 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE',
      visible: false,
      persistent: true,
    },
    {
      mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9',
      localId: '99',
      visible: true,
      persistent: false,
    },
  ]);
});

test('copyvar mirrors local ID strings and drops them when source becomes numeric', async () => {
  gameVariables.reset();
  const harness = createHarness();
  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_0x8004', 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE'] },
    { cmd: 'copyvar', args: ['VAR_0x8005', 'VAR_0x8004'] },
    { cmd: 'addobject', args: ['VAR_0x8005'] },
    { cmd: 'setvar', args: ['VAR_0x8004', 7] },
    { cmd: 'copyvar', args: ['VAR_0x8005', 'VAR_0x8004'] },
    { cmd: 'addobject', args: ['VAR_0x8005'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    harness.ctx,
    'MAP_SEAFLOOR_CAVERN_ROOM9'
  );
  const handled = await runner.execute('Main');

  assert.equal(handled, true);
  assert.equal(harness.visibilityCalls.length, 2);
  assert.equal(harness.visibilityCalls[0].localId, 'LOCALID_SEAFLOOR_CAVERN_ROOM9_ARCHIE');
  assert.equal(harness.visibilityCalls[1].localId, '7');
});
