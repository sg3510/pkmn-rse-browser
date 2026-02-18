import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';
import { BATTLE_OUTCOME, type ScriptTrainerBattleRequest } from '../battleTypes.ts';
import { isTrainerDefeated, setTrainerDefeated } from '../trainerFlags.ts';

function createData(commands: ScriptCommand[], text: Record<string, string> = {}): { mapData: MapScriptData; commonData: MapScriptData } {
  return {
    mapData: {
      mapScripts: {},
      scripts: { Main: commands },
      movements: {},
      text,
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
    ...overrides,
  };
}

test('trainerbattle_no_intro does not skip battle when trainer flag is already set', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

  setTrainerDefeated('TRAINER_SIDNEY');
  assert.equal(isTrainerDefeated('TRAINER_SIDNEY'), true);

  const trainerBattleCalls: ScriptTrainerBattleRequest[] = [];
  const shownMessages: string[] = [];
  const ctx = createContext({
    showMessage: async (text: string) => {
      shownMessages.push(text);
    },
    startTrainerBattle: async (request) => {
      trainerBattleCalls.push(request);
      return { outcome: BATTLE_OUTCOME.WON };
    },
  });

  const { mapData, commonData } = createData(
    [
      { cmd: 'trainerbattle_no_intro', args: ['TRAINER_SIDNEY', 'Text_Defeat'] },
      { cmd: 'setvar', args: ['VAR_0x8004', 1] },
      { cmd: 'end' },
    ],
    {
      Text_Defeat: 'Sidney was defeated!',
    },
  );

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_EVER_GRANDE_CITY');
  await runner.execute('Main');

  assert.equal(trainerBattleCalls.length, 1);
  assert.equal(trainerBattleCalls[0].trainerId, 'TRAINER_SIDNEY');
  assert.equal(trainerBattleCalls[0].mode, 'no_intro');
  assert.equal(gameVariables.getVar('VAR_0x8004'), 1);
  assert.deepEqual(shownMessages, ['Sidney was defeated!']);
});
