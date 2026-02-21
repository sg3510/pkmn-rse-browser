import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import {
  clearDynamicWarpTarget,
  getDynamicWarpTarget,
} from '../../game/DynamicWarp.ts';
import {
  clearFixedEscapeWarpTarget,
  getFixedEscapeWarpTarget,
} from '../../game/FixedEscapeWarp.ts';

interface QueueWarpCall {
  mapId: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  style?: 'default' | 'fall';
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
    queueWarp: async (mapId, x, y, direction, options) => {
      queueWarpCalls.push({ mapId, x, y, direction, style: options?.style });
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

test('lock waits for selected NPC idle before continuing script execution', async () => {
  gameVariables.reset();
  gameVariables.setVar('VAR_LAST_TALKED', 7);

  let playerWaitCalls = 0;
  let npcWaitCalls = 0;
  const npcWaitArgs: Array<{ mapId: string; localId: string }> = [];
  let resolveNpcIdleWait: (() => void) | null = null;
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls, {
    hasNpc: (mapId, localId) =>
      mapId === 'MAP_SOOTOPOLIS_CITY_GYM_1F' && localId === '7',
    waitForPlayerIdle: async () => {
      playerWaitCalls++;
    },
    waitForNpcIdle: async (mapId, localId) => {
      npcWaitCalls++;
      npcWaitArgs.push({ mapId, localId });
      await new Promise<void>((resolve) => {
        resolveNpcIdleWait = resolve;
      });
    },
  });

  const { mapData, commonData } = createData([
    { cmd: 'lock' },
    { cmd: 'setvar', args: ['VAR_0x8004', 3] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  const execution = runner.execute('Main');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assert.equal(playerWaitCalls, 1);
  assert.equal(npcWaitCalls, 1);
  assert.deepEqual(npcWaitArgs, [{ mapId: 'MAP_SOOTOPOLIS_CITY_GYM_1F', localId: '7' }]);
  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);

  resolveNpcIdleWait?.();
  await execution;

  assert.equal(gameVariables.getVar('VAR_0x8004'), 3);
});

test('faceplayer resolves selected NPC from VAR_LAST_TALKED', async () => {
  gameVariables.reset();
  gameVariables.setVar('VAR_LAST_TALKED', 12);

  const queueWarpCalls: QueueWarpCall[] = [];
  const faceCalls: Array<{ mapId: string; localId: string }> = [];
  const ctx = createContext(queueWarpCalls, {
    hasNpc: (mapId, localId) =>
      mapId === 'MAP_SOOTOPOLIS_CITY_GYM_1F' && localId === '12',
    faceNpcToPlayer: (mapId, localId) => {
      faceCalls.push({ mapId, localId });
    },
  });

  const { mapData, commonData } = createData([
    { cmd: 'faceplayer' },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SOOTOPOLIS_CITY_GYM_1F');
  await runner.execute('Main');

  assert.deepEqual(faceCalls, [{ mapId: 'MAP_SOOTOPOLIS_CITY_GYM_1F', localId: '12' }]);
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
    { mapId: 'MAP_ROUTE111', x: 9, y: 17, direction: 'down', style: 'fall' },
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
    { mapId: 'MAP_ROUTE111', x: 2, y: 3, direction: 'down', style: 'fall' },
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
    { mapId: 'MAP_ROUTE111', x: -1, y: -1, direction: 'down', style: 'fall' },
  ]);
});

test('setescapewarp stores fixed escape warp target (x/y form)', async () => {
  clearFixedEscapeWarpTarget();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'setescapewarp', args: ['MAP_ROUTE112', 28, 28] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_ROUTE112_CABLE_CAR_STATION');
  await runner.execute('Main');

  assert.deepEqual(getFixedEscapeWarpTarget(), {
    mapId: 'MAP_ROUTE112',
    warpId: 0,
    x: 28,
    y: 28,
  });
});

test('setescapewarp stores fixed escape warp target (warpId/x/y form)', async () => {
  clearFixedEscapeWarpTarget();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'setescapewarp', args: ['MAP_ROUTE112', 7, 28, 28] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_ROUTE112_CABLE_CAR_STATION');
  await runner.execute('Main');

  assert.deepEqual(getFixedEscapeWarpTarget(), {
    mapId: 'MAP_ROUTE112',
    warpId: 7,
    x: 28,
    y: 28,
  });
});

test('setdynamicwarp stores dynamic warp target (warpId/x/y form)', async () => {
  clearDynamicWarpTarget();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'setdynamicwarp', args: ['MAP_ROUTE112', 7, 28, 28] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_ROUTE112_CABLE_CAR_STATION');
  await runner.execute('Main');

  assert.deepEqual(getDynamicWarpTarget(), {
    mapId: 'MAP_ROUTE112',
    warpId: 7,
    x: 28,
    y: 28,
  });
});

test('setmaplayoutindex forwards layout ID to context handler when available', async () => {
  const queueWarpCalls: QueueWarpCall[] = [];
  const layoutCalls: string[] = [];
  const ctx = createContext(queueWarpCalls, {
    setCurrentMapLayoutById: async (layoutId: string) => {
      layoutCalls.push(layoutId);
      return true;
    },
  });

  const { mapData, commonData } = createData([
    { cmd: 'setmaplayoutindex', args: ['LAYOUT_SKY_PILLAR_4F_CLEAN'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SKY_PILLAR_4F');
  await runner.execute('Main');

  assert.deepEqual(layoutCalls, ['LAYOUT_SKY_PILLAR_4F_CLEAN']);
});

test('setmaplayoutindex is a no-op when context handler is unavailable', async () => {
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'setmaplayoutindex', args: ['LAYOUT_SKY_PILLAR_4F_CLEAN'] },
    { cmd: 'setvar', args: ['VAR_0x8004', 7] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SKY_PILLAR_4F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_0x8004'), 7);
});

test('copyvar with warn=FALSE and numeric source keeps immediate value parity', async () => {
  gameVariables.reset();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'copyvar', args: ['VAR_ICE_STEP_COUNT', 1, 'warn=FALSE'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_GRANITE_CAVE_B1F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 1);
});

test('copyvar still copies from variable references normally', async () => {
  gameVariables.reset();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_TEMP_1', 37] },
    { cmd: 'copyvar', args: ['VAR_ICE_STEP_COUNT', 'VAR_TEMP_1'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_GRANITE_CAVE_B1F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 37);
});

test('copyvar with warn=FALSE and numeric string source keeps immediate value parity', async () => {
  gameVariables.reset();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'copyvar', args: ['VAR_ICE_STEP_COUNT', '1', 'warn=FALSE'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SKY_PILLAR_4F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 1);
});

test('copyvar with numeric source keeps immediate value parity without warn flag', async () => {
  gameVariables.reset();
  const queueWarpCalls: QueueWarpCall[] = [];
  const ctx = createContext(queueWarpCalls);

  const { mapData, commonData } = createData([
    { cmd: 'copyvar', args: ['VAR_ICE_STEP_COUNT', 1] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_SKY_PILLAR_4F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_ICE_STEP_COUNT'), 1);
});
