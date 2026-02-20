import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';

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

test('setflashlevel clamps and forwards level to context', async () => {
  const levels: number[] = [];
  const ctx = createContext({
    setFlashLevel: (level) => {
      levels.push(level);
    },
  });
  const { mapData, commonData } = createData([
    { cmd: 'setflashlevel', args: [-4] },
    { cmd: 'setflashlevel', args: [99] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_DEWFORD_TOWN_GYM');
  await runner.execute('Main');

  assert.deepEqual(levels, [0, 8]);
});

test('animateflash prefers animateFlashLevel callback when available', async () => {
  const animatedLevels: number[] = [];
  const setLevels: number[] = [];
  const delayCalls: number[] = [];
  const ctx = createContext({
    animateFlashLevel: async (level) => {
      animatedLevels.push(level);
    },
    setFlashLevel: (level) => {
      setLevels.push(level);
    },
    delayFrames: async (frames) => {
      delayCalls.push(frames);
    },
  });
  const { mapData, commonData } = createData([
    { cmd: 'animateflash', args: [9] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_DEWFORD_TOWN_GYM');
  await runner.execute('Main');

  assert.deepEqual(animatedLevels, [8]);
  assert.deepEqual(setLevels, []);
  assert.deepEqual(delayCalls, []);
});

test('animateflash falls back to setFlashLevel + delayFrames when animate callback is missing', async () => {
  const setLevels: number[] = [];
  const delayCalls: number[] = [];
  const ctx = createContext({
    setFlashLevel: (level) => {
      setLevels.push(level);
    },
    delayFrames: async (frames) => {
      delayCalls.push(frames);
    },
  });
  const { mapData, commonData } = createData([
    { cmd: 'animateflash', args: [-5] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_DEWFORD_TOWN_GYM');
  await runner.execute('Main');

  assert.deepEqual(setLevels, [0]);
  assert.deepEqual(delayCalls, [16]);
});
