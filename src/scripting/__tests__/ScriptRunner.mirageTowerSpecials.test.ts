import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner, type ScriptRuntimeServices } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameFlags } from '../../game/GameFlags.ts';
import { gameVariables } from '../../game/GameVariables.ts';

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

function createContext(
  metatileCalls: Array<{ mapId: string; x: number; y: number; metatileId: number; collision?: number }>,
  delayFramesCalls: number[]
): StoryScriptContext {
  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => true,
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: async () => {},
    forcePlayerStep: () => {},
    delayFrames: async (frames) => {
      delayFramesCalls.push(frames);
    },
    movePlayer: async () => {},
    moveNpc: async () => {},
    faceNpcToPlayer: () => {},
    setNpcPosition: () => {},
    setNpcVisible: () => {},
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
    setMapMetatile: (mapId, x, y, metatileId, collision) => {
      metatileCalls.push({ mapId, x, y, metatileId, collision });
    },
  };
}

test('ScriptRunner dispatches SetMirageTowerVisibility and applies Route111 no-tower patch when state is non-zero', async () => {
  gameVariables.reset();
  gameFlags.reset();

  const metatileCalls: Array<{ mapId: string; x: number; y: number; metatileId: number; collision?: number }> = [];
  const delayFramesCalls: number[] = [];

  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_MIRAGE_TOWER_STATE', 2] },
    { cmd: 'setflag', args: ['FLAG_MIRAGE_TOWER_VISIBLE'] },
    { cmd: 'special', args: ['SetMirageTowerVisibility'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    createContext(metatileCalls, delayFramesCalls),
    'MAP_ROUTE111'
  );

  const handled = await runner.execute('Main');
  assert.equal(handled, true);
  assert.equal(gameFlags.isSet('FLAG_MIRAGE_TOWER_VISIBLE'), false);
  assert.equal(metatileCalls.length, 18);
  assert.equal(delayFramesCalls.length, 0);
});

test('ScriptRunner handles Mirage Tower shake special waitstate flow', async () => {
  gameVariables.reset();
  gameFlags.reset();

  const metatileCalls: Array<{ mapId: string; x: number; y: number; metatileId: number; collision?: number }> = [];
  const delayFramesCalls: number[] = [];
  const shakeCalls: Array<{
    verticalPan: number;
    horizontalPan: number;
    numShakes: number;
    delayFrames: number;
  }> = [];

  const services: ScriptRuntimeServices = {
    camera: {
      shake: async (request) => {
        shakeCalls.push(request);
      },
    },
  };

  const { mapData, commonData } = createData([
    { cmd: 'special', args: ['StartMirageTowerShake'] },
    { cmd: 'waitstate' },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    createContext(metatileCalls, delayFramesCalls),
    'MAP_ROUTE111',
    services
  );

  const handled = await runner.execute('Main');
  assert.equal(handled, true);
  assert.equal(shakeCalls.length, 1);
  assert.deepEqual(shakeCalls[0], {
    verticalPan: 0,
    horizontalPan: 2,
    numShakes: 64,
    delayFrames: 2,
  });
  assert.deepEqual(delayFramesCalls, [6]);
});

test('ScriptRunner dispatches Mirage Tower shake to runtime service when available', async () => {
  gameVariables.reset();
  gameFlags.reset();

  const metatileCalls: Array<{ mapId: string; x: number; y: number; metatileId: number; collision?: number }> = [];
  const delayFramesCalls: number[] = [];
  const mirageCalls: string[] = [];
  const shakeCalls: Array<{
    verticalPan: number;
    horizontalPan: number;
    numShakes: number;
    delayFrames: number;
  }> = [];

  const services: ScriptRuntimeServices = {
    camera: {
      shake: async (request) => {
        shakeCalls.push(request);
      },
    },
    mirageTower: {
      startShake: async () => {
        mirageCalls.push('startShake');
      },
    },
  };

  const { mapData, commonData } = createData([
    { cmd: 'special', args: ['StartMirageTowerShake'] },
    { cmd: 'waitstate' },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    createContext(metatileCalls, delayFramesCalls),
    'MAP_ROUTE111',
    services
  );

  const handled = await runner.execute('Main');
  assert.equal(handled, true);
  assert.deepEqual(mirageCalls, ['startShake']);
  assert.equal(shakeCalls.length, 0);
  assert.equal(delayFramesCalls.length, 0);
  assert.equal(metatileCalls.length, 18);
});
