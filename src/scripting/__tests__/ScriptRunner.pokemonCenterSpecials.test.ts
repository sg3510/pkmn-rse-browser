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

function createContext(overrides: Partial<StoryScriptContext> = {}): StoryScriptContext {
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

test('nurse-related specials run without unimplemented warning and return deterministic values', async () => {
  gameVariables.reset();
  const { mapData, commonData } = createData([
    { cmd: 'special', args: ['InitUnionRoom'] },
    { cmd: 'specialvar', args: ['VAR_0x8004', 'CountPlayerTrainerStars'] },
    { cmd: 'specialvar', args: ['VAR_0x8005', 'PlayerNotAtTrainerHillEntrance'] },
    { cmd: 'specialvar', args: ['VAR_0x8006', 'BufferUnionRoomPlayerName'] },
    { cmd: 'end' },
  ]);

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(String(args[0] ?? ''));
  };

  try {
    const runner = new ScriptRunner(
      { mapData, commonData },
      createContext(),
      'MAP_LAVARIDGE_TOWN_POKEMON_CENTER_1F'
    );
    await runner.execute('Main');
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);
  assert.equal(gameVariables.getVar('VAR_0x8005'), 1);
  assert.equal(gameVariables.getVar('VAR_0x8006'), 0);
  assert.equal(
    warnings.some((warning) => warning.includes('[ScriptRunner] Unimplemented special')),
    false
  );
});

test('PlayerNotAtTrainerHillEntrance returns FALSE at trainer hill entrance map', async () => {
  gameVariables.reset();
  const { mapData, commonData } = createData([
    { cmd: 'specialvar', args: ['VAR_RESULT', 'PlayerNotAtTrainerHillEntrance'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    createContext(),
    'MAP_TRAINER_HILL_ENTRANCE'
  );
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_RESULT'), 0);
});
