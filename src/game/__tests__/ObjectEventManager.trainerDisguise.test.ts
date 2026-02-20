import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectEventManager } from '../ObjectEventManager.ts';
import type { ObjectEventData } from '../../types/objectEvents.ts';

const MAP_ID = 'MAP_TEST_TRAINER_DISGUISE';
const LOCAL_ID = '1';

function createDisguisedTrainerObject(movementType: string): ObjectEventData {
  return {
    local_id: LOCAL_ID,
    graphics_id: 'OBJ_EVENT_GFX_NINJA_BOY',
    x: 10,
    y: 8,
    elevation: 3,
    movement_type: movementType,
    movement_range_x: 0,
    movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NORMAL',
    trainer_sight_or_berry_tree_id: '5',
    script: 'TrainerScript_Test',
    flag: '0',
  };
}

function createBuriedTrainerObject(movementType: string): ObjectEventData {
  return {
    ...createDisguisedTrainerObject(movementType),
    trainer_type: 'TRAINER_TYPE_BURIED',
  };
}

test('tree/mountain disguise trainers spawn hidden with active disguise overlay', () => {
  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createDisguisedTrainerObject('MOVEMENT_TYPE_TREE_DISGUISE')], 0, 0);

  const npc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(npc);
  assert.equal(npc.spriteHidden, true);
  assert.equal(npc.disguiseState?.type, 'tree');
  assert.equal(npc.disguiseState?.active, true);
  assert.equal(npc.disguiseState?.revealing, false);
});

test('disguise reveal start/complete toggles overlay and trainer visibility', () => {
  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createDisguisedTrainerObject('MOVEMENT_TYPE_MOUNTAIN_DISGUISE')], 0, 0);

  assert.equal(manager.startNPCDisguiseRevealByLocalId(MAP_ID, LOCAL_ID), true);
  const revealingNpc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(revealingNpc);
  assert.equal(revealingNpc.spriteHidden, true);
  assert.equal(revealingNpc.disguiseState?.type, 'mountain');
  assert.equal(revealingNpc.disguiseState?.active, true);
  assert.equal(revealingNpc.disguiseState?.revealing, true);

  assert.equal(manager.completeNPCDisguiseRevealByLocalId(MAP_ID, LOCAL_ID), true);
  const revealedNpc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(revealedNpc);
  assert.equal(revealedNpc.spriteHidden, false);
  assert.equal(revealedNpc.disguiseState?.active, false);
  assert.equal(revealedNpc.disguiseState?.revealing, false);
});

test('switching movement type away from disguise clears disguise state', () => {
  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createDisguisedTrainerObject('MOVEMENT_TYPE_TREE_DISGUISE')], 0, 0);

  assert.equal(manager.setNPCMovementTypeByLocalId(MAP_ID, LOCAL_ID, 'MOVEMENT_TYPE_FACE_RIGHT'), true);
  const npc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(npc);
  assert.equal(npc.disguiseState, null);
});

test('buried trainers spawn hidden and stay visible once switched to face movement', () => {
  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createBuriedTrainerObject('MOVEMENT_TYPE_BURIED')], 0, 0);

  const buriedNpc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(buriedNpc);
  assert.equal(buriedNpc.spriteHidden, true);
  assert.equal(buriedNpc.trainerType, 'buried');

  assert.equal(manager.setNPCMovementTypeByLocalId(MAP_ID, LOCAL_ID, 'MOVEMENT_TYPE_FACE_RIGHT'), true);
  const revealedNpc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(revealedNpc);
  assert.equal(revealedNpc.spriteHidden, true);

  manager.setNPCSpriteHiddenByLocalId(MAP_ID, LOCAL_ID, false);
  const visibleNpc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(visibleNpc);
  assert.equal(visibleNpc.spriteHidden, false);

  assert.equal(manager.setNPCMovementTypeByLocalId(MAP_ID, LOCAL_ID, 'MOVEMENT_TYPE_FACE_LEFT'), true);
  const stillVisibleNpc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(stillVisibleNpc);
  assert.equal(stillVisibleNpc.spriteHidden, false);
});

test('revealed buried trainers stay visible after map unload/reload', () => {
  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createBuriedTrainerObject('MOVEMENT_TYPE_BURIED')], 0, 0);

  // Simulate post-reveal state after trainer approach interaction.
  manager.setNPCSpriteHiddenByLocalId(MAP_ID, LOCAL_ID, false);
  manager.setNPCMovementTypeByLocalId(MAP_ID, LOCAL_ID, 'MOVEMENT_TYPE_FACE_RIGHT');
  manager.setNPCTemplatePositionByLocalId(MAP_ID, LOCAL_ID, 12, 9);
  manager.setNPCPositionByLocalId(MAP_ID, LOCAL_ID, 12, 9, { updateInitialPosition: true });

  manager.removeMapObjects(MAP_ID);
  manager.parseMapObjects(MAP_ID, [createBuriedTrainerObject('MOVEMENT_TYPE_BURIED')], 0, 0);

  const npc = manager.getNPCByLocalId(MAP_ID, LOCAL_ID);
  assert.ok(npc);
  assert.equal(npc.spriteHidden, false);
  assert.equal(npc.movementTypeRaw, 'MOVEMENT_TYPE_FACE_RIGHT');
  assert.equal(npc.direction, 'right');
  assert.equal(npc.tileX, 12);
  assert.equal(npc.tileY, 9);
});
