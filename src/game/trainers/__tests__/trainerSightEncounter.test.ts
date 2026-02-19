import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NPCObject } from '../../../types/objectEvents.ts';
import { findTrainerSightEncounterTrigger } from '../trainerSightEncounter.ts';

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
