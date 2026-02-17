import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';

interface QueueWarpCall {
  mapId: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
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

function createContext(
  queueWarpCalls: QueueWarpCall[],
  overrides: Partial<StoryScriptContext> = {},
): StoryScriptContext {
  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => true,
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: (mapId, x, y, direction) => {
      queueWarpCalls.push({ mapId, x, y, direction });
    },
    forcePlayerStep: () => {},
    delayFrames: async () => {},
    movePlayer: async () => {},
    moveNpc: async () => {},
    faceNpcToPlayer: () => {},
    setNpcPosition: () => {},
    setNpcVisible: () => {},
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
    ...overrides,
  };
}

test('lockall waits for player idle before continuing script execution', async () => {
  gameVariables.reset();

  let waitCalls = 0;
  let resolveIdleWait: (() => void) | null = null;
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls, {
    waitForPlayerIdle: async () => {
      waitCalls++;
      await new Promise<void>((resolve) => {
        resolveIdleWait = resolve;
      });
    },
  });

  const { mapData, commonData } = createData([
    { cmd: 'lockall' },
    { cmd: 'setvar', args: ['VAR_0x8004', 1] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  const execution = runner.execute('Main');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assert.equal(waitCalls, 1);
  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);

  resolveIdleWait?.();
  await execution;

  assert.equal(gameVariables.getVar('VAR_0x8004'), 1);
});

test('lock continues immediately when waitForPlayerIdle resolves immediately', async () => {
  gameVariables.reset();

  let waitCalls = 0;
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls, {
    waitForPlayerIdle: async () => {
      waitCalls++;
    },
  });

  const { mapData, commonData } = createData([
    { cmd: 'lock' },
    { cmd: 'setvar', args: ['VAR_0x8004', 2] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  await runner.execute('Main');

  assert.equal(waitCalls, 1);
  assert.equal(gameVariables.getVar('VAR_0x8004'), 2);
});

test('warphole prefers destination-local coordinates when available', async () => {
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls, {
    getPlayerDestLocalPosition: () => ({ x: 9, y: 17 }),
    getPlayerLocalPosition: () => ({ x: 2, y: 3 }),
  });

  const { mapData, commonData } = createData([
    { cmd: 'warphole', args: ['MAP_ROUTE111'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  await runner.execute('Main');

  assert.deepEqual(queueWarpCalls, [
    { mapId: 'MAP_ROUTE111', x: 9, y: 17, direction: 'down' },
  ]);
});

test('warphole falls back safely when destination-local coordinates are unavailable', async () => {
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls, {
    getPlayerDestLocalPosition: () => null,
    getPlayerLocalPosition: () => ({ x: 2, y: 3 }),
  });

  const { mapData, commonData } = createData([
    { cmd: 'warphole', args: ['MAP_ROUTE111'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  await runner.execute('Main');

  assert.deepEqual(queueWarpCalls, [
    { mapId: 'MAP_ROUTE111', x: 2, y: 3, direction: 'down' },
  ]);
});

test('warphole uses (-1,-1) fallback when no local position is available', async () => {
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls, {
    getPlayerDestLocalPosition: () => null,
    getPlayerLocalPosition: () => null,
  });

  const { mapData, commonData } = createData([
    { cmd: 'warphole', args: ['MAP_ROUTE111'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  await runner.execute('Main');

  assert.deepEqual(queueWarpCalls, [
    { mapId: 'MAP_ROUTE111', x: -1, y: -1, direction: 'down' },
  ]);
});
