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

test('trainerbattle_single shows intro text before battle when intro label exists', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

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
      { cmd: 'trainerbattle_single', args: ['TRAINER_JOSH', 'Text_Intro', 'Text_Defeat'] },
      { cmd: 'end' },
    ],
    {
      Text_Intro: 'Josh: I will crush you!',
      Text_Defeat: 'Josh: I lost...',
    },
  );

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_RUSTBORO_CITY');
  await runner.execute('Main');

  assert.equal(trainerBattleCalls.length, 1);
  assert.equal(trainerBattleCalls[0].trainerId, 'TRAINER_JOSH');
  assert.equal(trainerBattleCalls[0].mode, 'single');
  assert.deepEqual(shownMessages, ['Josh: I will crush you!', 'Josh: I lost...']);
});

test('trainerbattle_single falls back to generic intro text when intro label is missing', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

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
      { cmd: 'trainerbattle_single', args: ['TRAINER_ROXANNE_1', 'Text_MissingIntro', 'Text_Defeat'] },
      { cmd: 'end' },
    ],
    {
      Text_Defeat: 'Roxanne was defeated!',
    },
  );

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_RUSTBORO_CITY');
  await runner.execute('Main');

  assert.equal(trainerBattleCalls.length, 1);
  assert.equal(trainerBattleCalls[0].trainerId, 'TRAINER_ROXANNE_1');
  assert.equal(trainerBattleCalls[0].mode, 'single');
  assert.deepEqual(shownMessages, ["ROXANNE: Let's battle!", 'Roxanne was defeated!']);
});

test('legacy trainerbattle single path uses intro fallback when intro label is missing', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

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
      {
        cmd: 'trainerbattle',
        args: [
          'TRAINER_BATTLE_SINGLE',
          'TRAINER_ROXANNE_1',
          'LOCALID_NONE',
          'Text_MissingIntro',
          'Text_Defeat',
        ],
      },
      { cmd: 'end' },
    ],
    {
      Text_Defeat: 'Roxanne was defeated!',
    },
  );

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_RUSTBORO_CITY');
  await runner.execute('Main');

  assert.equal(trainerBattleCalls.length, 1);
  assert.equal(trainerBattleCalls[0].trainerId, 'TRAINER_ROXANNE_1');
  assert.equal(trainerBattleCalls[0].mode, 'single');
  assert.deepEqual(shownMessages, ["ROXANNE: Let's battle!", 'Roxanne was defeated!']);
});

test('trainerbattle_single sequence keeps intro text before battle callback', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

  const eventLog: string[] = [];
  const ctx = createContext({
    showMessage: async (text: string) => {
      eventLog.push(`message:${text}`);
    },
    startTrainerBattle: async (request) => {
      eventLog.push(`battle-start:${request.trainerId}`);
      return { outcome: BATTLE_OUTCOME.WON };
    },
  });

  const { mapData, commonData } = createData(
    [
      { cmd: 'trainerbattle_single', args: ['TRAINER_JOSH', 'Text_Intro', 'Text_Defeat'] },
      { cmd: 'end' },
    ],
    {
      Text_Intro: 'Josh: I will crush you!',
      Text_Defeat: 'Josh: I lost...',
    },
  );

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_RUSTBORO_CITY');
  await runner.execute('Main');

  assert.deepEqual(eventLog, [
    'message:Josh: I will crush you!',
    'battle-start:TRAINER_JOSH',
    'message:Josh: I lost...',
  ]);
});
