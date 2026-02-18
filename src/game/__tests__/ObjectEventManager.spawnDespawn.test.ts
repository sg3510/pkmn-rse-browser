import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectEventManager } from '../ObjectEventManager.ts';
import type { ObjectEventData } from '../../types/objectEvents.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';

const MAP_ID = 'MAP_TEST_OBJECT_EVENT_CULL';
const NPC_LOCAL_ID = '1';
const NPC_ID = `${MAP_ID}_npc_${NPC_LOCAL_ID}`;

function resetRuntimeState(): void {
  saveStateStore.resetRuntimeState();
}

function createNpcObjectEvent(x: number, y: number): ObjectEventData {
  return {
    local_id: NPC_LOCAL_ID,
    graphics_id: 'OBJ_EVENT_GFX_YOUNGSTER',
    x,
    y,
    elevation: 3,
    movement_type: 'MOVEMENT_TYPE_FACE_DOWN',
    movement_range_x: 0,
    movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NONE',
    trainer_sight_or_berry_tree_id: '0',
    script: 'EventScript_TestNpc',
    flag: '0',
  };
}

function createManagerWithNpc(x: number, y: number): ObjectEventManager {
  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createNpcObjectEvent(x, y)], 0, 0);
  return manager;
}

test('Briney boat local IDs are parsed as NPC-style object events for applymovement', () => {
  resetRuntimeState();

  const manager = new ObjectEventManager();
  const boatLocalId = 'LOCALID_ROUTE104_BOAT';
  const boatEvent: ObjectEventData = {
    local_id: boatLocalId,
    graphics_id: 'OBJ_EVENT_GFX_MR_BRINEYS_BOAT',
    x: 12,
    y: 54,
    elevation: 3,
    movement_type: 'MOVEMENT_TYPE_FACE_UP',
    movement_range_x: 0,
    movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NONE',
    trainer_sight_or_berry_tree_id: '0',
    script: '0x0',
    flag: '0',
  };

  manager.parseMapObjects(MAP_ID, [boatEvent], 0, 0);
  const boatNpc = manager.getNPCByLocalId(MAP_ID, boatLocalId);
  assert.ok(boatNpc);
  assert.equal(boatNpc.graphicsId, 'OBJ_EVENT_GFX_MR_BRINEYS_BOAT');
});

test('script-addressable large objects use NPC-style storage by local ID', () => {
  resetRuntimeState();

  const manager = new ObjectEventManager();
  const localId = 'LOCALID_SLATEPORT_HARBOR_SUBMARINE';
  const event: ObjectEventData = {
    local_id: localId,
    graphics_id: 'OBJ_EVENT_GFX_SUBMARINE_SHADOW',
    x: 7,
    y: 9,
    elevation: 3,
    movement_type: 'MOVEMENT_TYPE_FACE_RIGHT',
    movement_range_x: 0,
    movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NONE',
    trainer_sight_or_berry_tree_id: '0',
    script: '0x0',
    flag: '0',
  };

  manager.parseMapObjects(MAP_ID, [event], 0, 0);
  const scriptedLargeAsNpc = manager.getNPCByLocalId(MAP_ID, localId);
  assert.ok(scriptedLargeAsNpc);
  assert.equal(scriptedLargeAsNpc.graphicsId, 'OBJ_EVENT_GFX_SUBMARINE_SHADOW');
  assert.equal(manager.getVisibleLargeObjects().length, 0);
});

test('non-script large objects without local IDs remain in large-object storage', () => {
  resetRuntimeState();

  const manager = new ObjectEventManager();
  const event: ObjectEventData = {
    graphics_id: 'OBJ_EVENT_GFX_TRUCK',
    x: 2,
    y: 10,
    elevation: 3,
    movement_type: 'MOVEMENT_TYPE_FACE_RIGHT',
    movement_range_x: 0,
    movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NONE',
    trainer_sight_or_berry_tree_id: '0',
    script: '0x0',
    flag: '0',
  };

  manager.parseMapObjects(MAP_ID, [event], 0, 0);
  const visibleLargeObjects = manager.getVisibleLargeObjects();
  assert.equal(visibleLargeObjects.length, 1);
  assert.equal(visibleLargeObjects[0]?.graphicsId, 'OBJ_EVENT_GFX_TRUCK');
});

test('camera-fixed window keeps top NPC visible when camera origin does not change', () => {
  resetRuntimeState();

  const manager = createManagerWithNpc(5, 2);
  manager.updateObjectEventSpawnDespawnForCamera(0, 0, 20, 20);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), true);

  // Legacy player-centered window would despawn this NPC at player y=15.
  manager.updateObjectEventSpawnDespawn(1, 15, 20, 20);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), false);

  // Camera is still fixed at origin, so camera-anchored update should respawn it.
  manager.updateObjectEventSpawnDespawnForCamera(0, 0, 20, 20);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), true);
});

test('NPC despawns only when both current and initial coords are outside camera window', () => {
  resetRuntimeState();

  const manager = createManagerWithNpc(5, 2);
  assert.equal(manager.setNPCPositionByLocalId(MAP_ID, NPC_LOCAL_ID, 5, 4), true);

  // Initial y=2 is outside (top=3), current y=4 is inside -> must stay spawned.
  manager.updateObjectEventSpawnDespawnForCamera(0, 3, 20, 20);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), true);

  // Both current y=4 and initial y=2 are outside (top=5) -> should despawn.
  manager.updateObjectEventSpawnDespawnForCamera(0, 5, 20, 20);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), false);
  assert.equal(
    manager.getRuntimeState().offscreenDespawnedNpcIds.includes(NPC_ID),
    true
  );
});

test('expanded viewport height keeps distant NPC within camera spawn window', () => {
  resetRuntimeState();

  const manager = createManagerWithNpc(5, 25);

  // With 20-tile viewport: bottom = 22, NPC y=25 is outside.
  manager.updateObjectEventSpawnDespawnForCamera(0, 0, 20, 20);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), false);

  // With larger 30-tile viewport: bottom = 32, NPC y=25 is inside.
  manager.updateObjectEventSpawnDespawnForCamera(0, 0, 20, 30);
  assert.equal(manager.getVisibleNPCs().some((npc) => npc.id === NPC_ID), true);
});

test('addobject respawns NPC from template position after setobjectxyperm parity update', () => {
  resetRuntimeState();

  const manager = createManagerWithNpc(14, 21);
  // Simulate prior stage where template and runtime were moved to a later location.
  assert.equal(manager.setNPCPositionByLocalId(MAP_ID, NPC_LOCAL_ID, 30, 10, { updateInitialPosition: true }), true);
  // Simulate removeobject.
  assert.equal(manager.setNPCVisibilityByLocalId(MAP_ID, NPC_LOCAL_ID, false, true), true);
  // setobjectxyperm should update template only.
  assert.equal(manager.setNPCTemplatePositionByLocalId(MAP_ID, NPC_LOCAL_ID, 14, 21), true);

  const hiddenNpc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(hiddenNpc);
  assert.equal(hiddenNpc.tileX, 30);
  assert.equal(hiddenNpc.tileY, 10);
  assert.equal(hiddenNpc.initialTileX, 14);
  assert.equal(hiddenNpc.initialTileY, 21);

  // Simulate addobject: NPC should respawn at template coords.
  assert.equal(manager.setNPCVisibilityByLocalId(MAP_ID, NPC_LOCAL_ID, true, false), true);
  const respawnedNpc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(respawnedNpc);
  assert.equal(respawnedNpc.visible, true);
  assert.equal(respawnedNpc.tileX, 14);
  assert.equal(respawnedNpc.tileY, 21);
});

test('setobjectmovementtype does not clobber setobjectxyperm template coordinates before addobject', () => {
  resetRuntimeState();

  const manager = createManagerWithNpc(30, 10);
  assert.equal(manager.setNPCVisibilityByLocalId(MAP_ID, NPC_LOCAL_ID, false, true), true);
  // setobjectxyperm updates template only.
  assert.equal(manager.setNPCTemplatePositionByLocalId(MAP_ID, NPC_LOCAL_ID, 14, 21), true);
  // setobjectmovementtype must not overwrite template coords.
  assert.equal(
    manager.setNPCMovementTypeByLocalId(MAP_ID, NPC_LOCAL_ID, 'MOVEMENT_TYPE_FACE_RIGHT'),
    true
  );

  const hiddenNpc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(hiddenNpc);
  assert.equal(hiddenNpc.initialTileX, 14);
  assert.equal(hiddenNpc.initialTileY, 21);

  // addobject respawns from template.
  assert.equal(manager.setNPCVisibilityByLocalId(MAP_ID, NPC_LOCAL_ID, true, false), true);
  const shownNpc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(shownNpc);
  assert.equal(shownNpc.tileX, 14);
  assert.equal(shownNpc.tileY, 21);
});

test('showing a hidden NPC respawns from template even when not scriptRemoved', () => {
  resetRuntimeState();

  const manager = createManagerWithNpc(14, 21);
  const npc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(npc);

  npc.tileX = 30;
  npc.tileY = 10;
  npc.initialTileX = 14;
  npc.initialTileY = 21;
  npc.visible = false;
  npc.scriptRemoved = false;

  assert.equal(manager.setNPCVisibilityByLocalId(MAP_ID, NPC_LOCAL_ID, true, false), true);
  const shownNpc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(shownNpc);
  assert.equal(shownNpc.tileX, 14);
  assert.equal(shownNpc.tileY, 21);
});
