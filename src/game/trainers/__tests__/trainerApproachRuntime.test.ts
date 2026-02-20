import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrainerSightApproachingTrainer } from '../trainerSightEncounter.ts';
import { TRAINER_BATTLE_MODE } from '../trainerSightEncounter.ts';
import { TrainerApproachRuntime } from '../trainerApproachRuntime.ts';

function createApproachingTrainer(
  localId: string,
  trainerId: string,
  beatenScriptLabel: string | null
): TrainerSightApproachingTrainer {
  return {
    npcId: `MAP_TEST_npc_${localId}`,
    mapId: 'MAP_TEST',
    localId,
    localIdNumber: Number.parseInt(localId, 10),
    scriptName: `TrainerScript_${localId}`,
    approachDistance: 2,
    approachDirection: 'right',
    trainerType: 'normal',
    movementTypeRaw: 'MOVEMENT_TYPE_FACE_RIGHT',
    battle: {
      battleMode: TRAINER_BATTLE_MODE.SINGLE,
      trainerId,
      introTextLabel: `Text_Intro_${localId}`,
      defeatTextLabel: `Text_Defeat_${localId}`,
      cannotBattleTextLabel: null,
      beatenScriptLabel,
      postBattleCommands: [{ cmd: 'setvar', args: ['VAR_0x8000', localId] }],
    },
  };
}

test('tracks current/selected trainer and toggles second approacher like C runtime', () => {
  const runtime = new TrainerApproachRuntime();
  const trainerA = createApproachingTrainer('1', 'TRAINER_A', 'Script_A');
  const trainerB = createApproachingTrainer('2', 'TRAINER_B', 'Script_B');

  runtime.prepareForSightEncounter({
    approachingTrainers: [trainerA, trainerB],
  });

  assert.equal(runtime.getApproachingTrainerCount(), 2);
  assert.equal(runtime.getCurrentApproachingTrainer()?.localId, '1');

  runtime.selectCurrentApproachingTrainer();
  assert.equal(runtime.getSelectedApproachingTrainer()?.localId, '1');

  assert.equal(runtime.tryPrepareSecondApproachingTrainer(), true);
  assert.equal(runtime.getCurrentApproachingTrainer()?.localId, '2');

  runtime.selectCurrentApproachingTrainer();
  assert.equal(runtime.getSelectedApproachingTrainer()?.localId, '2');

  assert.equal(runtime.tryPrepareSecondApproachingTrainer(), false);
  assert.equal(runtime.getCurrentApproachingTrainer()?.localId, '1');
});

test('returns trainer B post-battle script first when two approachers were active', () => {
  const runtime = new TrainerApproachRuntime();
  runtime.prepareForSightEncounter({
    approachingTrainers: [
      createApproachingTrainer('1', 'TRAINER_A', 'Script_A'),
      createApproachingTrainer('2', 'TRAINER_B', 'Script_B'),
    ],
  });

  runtime.onTrainerBattleStarted();
  assert.equal(runtime.shouldTryGetTrainerScript(), true);
  assert.equal(runtime.getTrainerPostBattleScriptLabel(), 'Script_B');
  assert.equal(runtime.getWhichTrainerToFaceAfterBattle(), 1);
  assert.equal(runtime.getTrainerPostBattleScriptLabel(), 'Script_A');
  assert.equal(runtime.getWhichTrainerToFaceAfterBattle(), 0);
});

test('falls back to EventScript_TryGetTrainerScript when beaten scripts are absent', () => {
  const runtime = new TrainerApproachRuntime();
  runtime.prepareForSightEncounter({
    approachingTrainers: [
      createApproachingTrainer('1', 'TRAINER_A', null),
    ],
  });

  runtime.onTrainerBattleStarted();
  assert.equal(runtime.getTrainerPostBattleScriptLabel(), 'EventScript_TryGetTrainerScript');
});
