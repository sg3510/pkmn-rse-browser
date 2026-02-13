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
