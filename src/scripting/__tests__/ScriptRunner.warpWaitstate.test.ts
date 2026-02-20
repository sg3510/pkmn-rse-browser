import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
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
  queueWarpImpl: StoryScriptContext['queueWarp']
): StoryScriptContext {
  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => true,
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: queueWarpImpl,
    forcePlayerStep: () => {},
    delayFrames: async () => {},
    movePlayer: async () => {},
    moveNpc: async () => {},
    faceNpcToPlayer: () => {},
    setNpcPosition: () => {},
    setNpcVisible: () => {},
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
  };
}

test('waitstate blocks script advancement until queued warp resolves', async () => {
  gameVariables.reset();

  let resolveWarp!: () => void;
  const queueWarpCalls: Array<{ mapId: string; x: number; y: number }> = [];
  const ctx = createContext(async (mapId, x, y) => {
    queueWarpCalls.push({ mapId, x, y });
    await new Promise<void>((resolve) => {
      resolveWarp = resolve;
    });
  });

  const { mapData, commonData } = createData([
    { cmd: 'warp', args: ['MAP_ROUTE111', 4, 8] },
    { cmd: 'waitstate' },
    { cmd: 'setvar', args: ['VAR_0x8004', 1] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_LITTLEROOT_TOWN');
  const execution = runner.execute('Main');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(queueWarpCalls, [{ mapId: 'MAP_ROUTE111', x: 4, y: 8 }]);
  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);

  resolveWarp();
  await execution;

  assert.equal(gameVariables.getVar('VAR_0x8004'), 1);
});
