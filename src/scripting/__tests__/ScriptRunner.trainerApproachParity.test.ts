import test from 'node:test';
import assert from 'node:assert/strict';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';
import { TrainerApproachRuntime } from '../../game/trainers/trainerApproachRuntime.ts';
import type { TrainerSightApproachingTrainer } from '../../game/trainers/trainerSightEncounter.ts';
import { TRAINER_BATTLE_MODE } from '../../game/trainers/trainerSightEncounter.ts';
import { BATTLE_OUTCOME, type ScriptTrainerBattleRequest } from '../battleTypes.ts';
import { isTrainerDefeated } from '../trainerFlags.ts';
import { ScriptRunner, type ScriptRuntimeServices } from '../ScriptRunner.ts';

function createData(
  commands: ScriptCommand[],
  scripts: Record<string, ScriptCommand[]> = {},
  text: Record<string, string> = {}
): { mapData: MapScriptData; commonData: MapScriptData } {
  return {
    mapData: {
      mapScripts: {},
      scripts: { Main: commands, ...scripts },
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

function createContext(overrides: Partial<StoryScriptContext> = {}): StoryScriptContext {
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

function createApproachingTrainer(
  localId: string,
  trainerId: string,
  battleMode = TRAINER_BATTLE_MODE.SINGLE
): TrainerSightApproachingTrainer {
  return {
    npcId: `MAP_TEST_npc_${localId}`,
    mapId: 'MAP_TEST',
    localId,
    localIdNumber: Number.parseInt(localId, 10),
    scriptName: `TrainerScript_${localId}`,
    approachDistance: 3,
    approachDirection: 'right',
    trainerType: 'normal',
    movementTypeRaw: 'MOVEMENT_TYPE_FACE_RIGHT',
    battle: {
      battleMode,
      trainerId,
      introTextLabel: `Text_Intro_${localId}`,
      defeatTextLabel: `Text_Defeat_${localId}`,
      cannotBattleTextLabel: null,
      beatenScriptLabel: 'AfterBattle',
      postBattleCommands: [],
    },
  };
}

test('trainer approach command chain keeps C ordering through battle start and beaten script jump', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

  const runtime = new TrainerApproachRuntime();
  runtime.prepareForSightEncounter({
    approachingTrainers: [createApproachingTrainer('1', 'TRAINER_ROXANNE_1')],
  });

  const events: string[] = [];
  const trainerBattleRequests: ScriptTrainerBattleRequest[] = [];
  const ctx = createContext({
    waitForPlayerIdle: async () => {
      events.push('lockfortrainer-wait');
    },
    showMessage: async (text: string) => {
      events.push(`intro:${text}`);
    },
    startTrainerBattle: async (request) => {
      trainerBattleRequests.push(request);
      events.push(`battle:${request.trainerId}:${request.mode}`);
      return { outcome: BATTLE_OUTCOME.WON };
    },
  });

  const services: ScriptRuntimeServices = {
    trainerApproach: {
      runtime,
      runCurrentApproachIntro: async () => {
        events.push('approach-intro');
      },
      setSelectedTrainerFacingDirection: () => {
        events.push('set-facing');
      },
      facePlayerAfterBattle: () => {
        events.push('face-player');
      },
    },
  };

  const { mapData, commonData } = createData(
    [
      { cmd: 'selectapproachingtrainer' },
      { cmd: 'lockfortrainer' },
      { cmd: 'special', args: ['DoTrainerApproach'] },
      { cmd: 'waitstate' },
      { cmd: 'special', args: ['ShowTrainerIntroSpeech'] },
      { cmd: 'dotrainerbattle' },
      { cmd: 'gotobeatenscript' },
      { cmd: 'end' },
    ],
    {
      AfterBattle: [
        { cmd: 'setvar', args: ['VAR_0x800F', 77] },
        { cmd: 'end' },
      ],
    },
    {
      Text_Intro_1: 'Trainer spotted you!',
      Text_Defeat_1: 'Trainer lost!',
    },
  );

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_TEST', services);
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_0x800F'), 77);
  assert.equal(trainerBattleRequests.length, 1);
  assert.equal(trainerBattleRequests[0].trainerId, 'TRAINER_ROXANNE_1');
  assert.equal(trainerBattleRequests[0].mode, 'single');
  assert.equal(isTrainerDefeated('TRAINER_ROXANNE_1'), true);

  const lockIdx = events.indexOf('lockfortrainer-wait');
  const approachIdx = events.indexOf('approach-intro');
  const introIdx = events.findIndex((event) => event.startsWith('intro:'));
  const battleIdx = events.findIndex((event) => event.startsWith('battle:'));
  assert.ok(lockIdx >= 0);
  assert.ok(approachIdx >= 0);
  assert.ok(introIdx >= 0);
  assert.ok(battleIdx >= 0);
  assert.ok(lockIdx < approachIdx);
  assert.ok(approachIdx < introIdx);
  assert.ok(introIdx < battleIdx);
});

test('dotrainerbattle uses double mode when two approaching trainers were selected', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

  const runtime = new TrainerApproachRuntime();
  runtime.prepareForSightEncounter({
    approachingTrainers: [
      createApproachingTrainer('1', 'TRAINER_CALVIN_1'),
      createApproachingTrainer('2', 'TRAINER_RICK'),
    ],
  });

  const trainerBattleRequests: ScriptTrainerBattleRequest[] = [];
  const ctx = createContext({
    startTrainerBattle: async (request) => {
      trainerBattleRequests.push(request);
      return { outcome: BATTLE_OUTCOME.WON };
    },
  });

  const services: ScriptRuntimeServices = {
    trainerApproach: {
      runtime,
      runCurrentApproachIntro: async () => {},
    },
  };

  const { mapData, commonData } = createData([
    { cmd: 'dotrainerbattle' },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_TEST', services);
  await runner.execute('Main');

  assert.equal(trainerBattleRequests.length, 1);
  assert.equal(trainerBattleRequests[0].mode, 'double');
  assert.equal(isTrainerDefeated('TRAINER_CALVIN_1'), true);
  assert.equal(isTrainerDefeated('TRAINER_RICK'), true);
});

test('dotrainerbattle still sets defeated flags if approach runtime mutates during battle transition', async () => {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();

  const runtime = new TrainerApproachRuntime();
  runtime.prepareForSightEncounter({
    approachingTrainers: [createApproachingTrainer('1', 'TRAINER_YASU')],
  });

  const ctx = createContext({
    startTrainerBattle: async () => {
      // Mirrors OVERWORLD -> BATTLE transition side effects while script waits.
      runtime.clear();
      return { outcome: BATTLE_OUTCOME.WON };
    },
  });

  const services: ScriptRuntimeServices = {
    trainerApproach: {
      runtime,
      runCurrentApproachIntro: async () => {},
    },
  };

  const { mapData, commonData } = createData([
    { cmd: 'dotrainerbattle' },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_TEST', services);
  await runner.execute('Main');

  assert.equal(isTrainerDefeated('TRAINER_YASU'), true);
});
