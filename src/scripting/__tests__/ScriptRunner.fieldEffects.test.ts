import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner, type ScriptRuntimeServices } from '../ScriptRunner.ts';
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

function createContext(): StoryScriptContext {
  return {
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
    setNpcPosition: () => {},
    setNpcVisible: () => {},
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
  };
}

test('dofieldeffectsparkle + waitfieldeffect + orb/weather specials execute via runtime services', async () => {
  gameVariables.reset();
  gameVariables.setVar('VAR_RESULT', 2);

  const runCalls: Array<{
    effectName: string;
    args: ReadonlyMap<number, string | number>;
    context?: { mapId: string };
  }> = [];
  let waitCalls = 0;
  let weatherWaitCalls = 0;
  let orbStartVar = -1;
  let orbFadeCalls = 0;

  let resolveSparkle: (() => void) | null = null;
  let sparklePromise: Promise<void> | null = null;

  const services: ScriptRuntimeServices = {
    fieldEffects: {
      run: (effectName, args, context) => {
        runCalls.push({ effectName, args: new Map(args), context });
        if (effectName === 'FLDEFF_SPARKLE') {
          sparklePromise = new Promise<void>((resolve) => {
            resolveSparkle = resolve;
          });
        }
      },
      wait: async (effectName) => {
        if (effectName !== 'FLDEFF_SPARKLE') return;
        waitCalls++;
        await sparklePromise;
      },
    },
    weather: {
      setSavedWeather: () => {},
      resetSavedWeather: () => {},
      applyCurrentWeather: () => {},
      waitForChangeComplete: async () => {
        weatherWaitCalls++;
      },
    },
    screenEffects: {
      startOrbEffect: async (resultVar) => {
        orbStartVar = resultVar;
      },
      fadeOutOrbEffect: async () => {
        orbFadeCalls++;
      },
    },
  };

  const { mapData, commonData } = createData([
    { cmd: 'dofieldeffectsparkle', args: [16, 42, 0] },
    { cmd: 'waitfieldeffect', args: ['FLDEFF_SPARKLE'] },
    { cmd: 'special', args: ['DoOrbEffect'] },
    { cmd: 'special', args: ['FadeOutOrbEffect'] },
    { cmd: 'special', args: ['WaitWeather'] },
    { cmd: 'special', args: ['Script_FadeOutMapMusic'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData },
    createContext(),
    'MAP_SEAFLOOR_CAVERN_ROOM9',
    services
  );

  const execution = runner.execute('Main');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  resolveSparkle?.();
  await execution;

  assert.equal(runCalls.length, 1);
  assert.equal(runCalls[0].effectName, 'FLDEFF_SPARKLE');
  assert.deepEqual(runCalls[0].args.get(0), 16);
  assert.deepEqual(runCalls[0].args.get(1), 42);
  assert.deepEqual(runCalls[0].args.get(2), 0);
  assert.deepEqual(runCalls[0].context, { mapId: 'MAP_SEAFLOOR_CAVERN_ROOM9' });
  assert.equal(waitCalls, 1);
  assert.equal(orbStartVar, 2);
  assert.equal(orbFadeCalls, 1);
  assert.equal(weatherWaitCalls, 1);
});
