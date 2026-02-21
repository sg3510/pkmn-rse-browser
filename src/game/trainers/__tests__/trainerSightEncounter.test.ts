import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NPCObject } from '../../../types/objectEvents.ts';
import {
  findTrainerSightEncounterSelection,
  findTrainerSightEncounterTrigger,
} from '../trainerSightEncounter.ts';
import { MB_POND_WATER } from '../../../utils/metatileBehaviors.ts';

function createTrainerNpc(overrides: Partial<NPCObject> = {}): NPCObject {
  return {
    id: 'MAP_TEST_npc_1',
    localId: '1',
    localIdNumber: 1,
    tileX: 3,
    tileY: 2,
    elevation: 0,
    graphicsId: 'OBJ_EVENT_GFX_BUG_CATCHER',
    direction: 'right',
    movementType: 'face_right',
    movementTypeRaw: 'MOVEMENT_TYPE_FACE_RIGHT',
    movementRangeX: 0,
    movementRangeY: 0,
    trainerType: 'normal',
    trainerSightRange: 6,
    script: 'TrainerScript',
    flag: '0',
    visible: true,
    spriteHidden: false,
    scriptRemoved: false,
    renderAboveGrass: false,
    subTileX: 0,
    subTileY: 0,
    isWalking: false,
    initialTileX: 3,
    initialTileY: 2,
    ...overrides,
  };
}

const PASSABLE_TILE = { attributes: { behavior: 0 }, mapTile: { collision: 0, elevation: 0 } };
const SURFABLE_WATER_TILE = {
  attributes: { behavior: MB_POND_WATER },
  mapTile: { collision: 0, elevation: 1 },
};

test('triggers for an in-viewport trainer with clear line of sight', () => {
  const trigger = findTrainerSightEncounterTrigger({
    npcs: [createTrainerNpc()],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: () => [{ cmd: 'trainerbattle_single', args: ['TRAINER_ROXANNE', 'Intro', 'Defeat'] }],
    isTrainerDefeated: () => false,
  });

  assert.ok(trigger);
  assert.equal(trigger.mapId, 'MAP_TEST');
  assert.equal(trigger.localId, '1');
  assert.equal(trigger.localIdNumber, 1);
  assert.equal(trigger.scriptName, 'TrainerScript');
  assert.equal(trigger.approachDistance, 3);
  assert.equal(trigger.approachDirection, 'right');
});

test('still triggers for trainer just outside visible viewport bounds', () => {
  const trigger = findTrainerSightEncounterTrigger({
    npcs: [createTrainerNpc()],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 4, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: () => [{ cmd: 'trainerbattle_single', args: ['TRAINER_ROXANNE', 'Intro', 'Defeat'] }],
    isTrainerDefeated: () => false,
  });

  assert.ok(trigger);
  assert.equal(trigger.approachDistance, 3);
});

test('does not trigger when path between trainer and player is blocked', () => {
  const trigger = findTrainerSightEncounterTrigger({
    npcs: [createTrainerNpc()],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: (x, y) => x === 4 && y === 2,
    getTrainerScriptCommands: () => [{ cmd: 'trainerbattle_single', args: ['TRAINER_ROXANNE', 'Intro', 'Defeat'] }],
    isTrainerDefeated: () => false,
  });

  assert.equal(trigger, null);
});

test('triggers for swimmer trainers across surfable water when elevation matches', () => {
  const trigger = findTrainerSightEncounterTrigger({
    npcs: [createTrainerNpc({
      graphicsId: 'OBJ_EVENT_GFX_SWIMMER_M',
      elevation: 1,
    })],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => SURFABLE_WATER_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: () => [{ cmd: 'trainerbattle_single', args: ['TRAINER_SWIMMER', 'Intro', 'Defeat'] }],
    isTrainerDefeated: () => false,
  });

  assert.ok(trigger);
  assert.equal(trigger.approachDistance, 3);
});

test('does not trigger when trainer battle flag is already set', () => {
  const trigger = findTrainerSightEncounterTrigger({
    npcs: [createTrainerNpc()],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: () => [{ cmd: 'trainerbattle_single', args: ['TRAINER_ROXANNE', 'Intro', 'Defeat'] }],
    isTrainerDefeated: () => true,
  });

  assert.equal(trigger, null);
});

test('returns up to two approaching trainers for C-style dual single-trainer selection', () => {
  const trainerA = createTrainerNpc({
    id: 'MAP_TEST_npc_1',
    localId: '1',
    localIdNumber: 1,
    tileX: 3,
    tileY: 2,
    script: 'TrainerScriptA',
  });
  const trainerB = createTrainerNpc({
    id: 'MAP_TEST_npc_2',
    localId: '2',
    localIdNumber: 2,
    tileX: 1,
    tileY: 2,
    script: 'TrainerScriptB',
  });

  const selection = findTrainerSightEncounterSelection({
    npcs: [trainerA, trainerB],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: (_mapId, scriptName) => {
      if (scriptName === 'TrainerScriptA') {
        return [{ cmd: 'trainerbattle_single', args: ['TRAINER_A', 'IntroA', 'DefeatA'] }];
      }
      if (scriptName === 'TrainerScriptB') {
        return [{ cmd: 'trainerbattle_single', args: ['TRAINER_B', 'IntroB', 'DefeatB'] }];
      }
      return null;
    },
    hasEnoughMonsForDoubleBattle: () => true,
  });

  assert.ok(selection);
  assert.equal(selection.approachingTrainers.length, 2);
  assert.equal(selection.approachingTrainers[0].battle.trainerId, 'TRAINER_A');
  assert.equal(selection.approachingTrainers[1].battle.trainerId, 'TRAINER_B');
});

test('stops after first single trainer when player does not have enough mons for doubles', () => {
  const trainerA = createTrainerNpc({
    id: 'MAP_TEST_npc_1',
    localId: '1',
    localIdNumber: 1,
    tileX: 3,
    tileY: 2,
    script: 'TrainerScriptA',
  });
  const trainerB = createTrainerNpc({
    id: 'MAP_TEST_npc_2',
    localId: '2',
    localIdNumber: 2,
    tileX: 1,
    tileY: 2,
    script: 'TrainerScriptB',
  });

  const selection = findTrainerSightEncounterSelection({
    npcs: [trainerA, trainerB],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: (_mapId, scriptName) => {
      if (scriptName === 'TrainerScriptA') {
        return [{ cmd: 'trainerbattle_single', args: ['TRAINER_A', 'IntroA', 'DefeatA'] }];
      }
      if (scriptName === 'TrainerScriptB') {
        return [{ cmd: 'trainerbattle_single', args: ['TRAINER_B', 'IntroB', 'DefeatB'] }];
      }
      return null;
    },
    hasEnoughMonsForDoubleBattle: () => false,
  });

  assert.ok(selection);
  assert.equal(selection.approachingTrainers.length, 1);
  assert.equal(selection.approachingTrainers[0].battle.trainerId, 'TRAINER_A');
});

test('breaks immediately when first matched trainer is a scripted double battle', () => {
  const selection = findTrainerSightEncounterSelection({
    npcs: [createTrainerNpc({ script: 'TrainerScriptDouble' }), createTrainerNpc({ id: 'MAP_TEST_npc_2', localId: '2', localIdNumber: 2, tileX: 1 })],
    playerTileX: 6,
    playerTileY: 2,
    viewport: { left: 0, right: 12, top: 0, bottom: 10 },
    resolveTile: () => PASSABLE_TILE,
    hasBlockingObjectAt: () => false,
    getTrainerScriptCommands: (_mapId, scriptName) => {
      if (scriptName === 'TrainerScriptDouble') {
        return [{ cmd: 'trainerbattle_double', args: ['TRAINER_DOUBLE', 'Intro', 'Defeat', 'CantBattle'] }];
      }
      return [{ cmd: 'trainerbattle_single', args: ['TRAINER_OTHER', 'Intro', 'Defeat'] }];
    },
    hasEnoughMonsForDoubleBattle: () => true,
  });

  assert.ok(selection);
  assert.equal(selection.approachingTrainers.length, 1);
  assert.equal(selection.approachingTrainers[0].battle.trainerId, 'TRAINER_DOUBLE');
});
