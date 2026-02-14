import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectEventManager } from '../ObjectEventManager.ts';
import type { ObjectEventData } from '../../types/objectEvents.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';

const MAP_ID = 'MAP_TEST_MOVING_OCCUPANCY';
const NPC_LOCAL_ID = '1';

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

test('moving NPC blocks both previous and current tiles', () => {
  saveStateStore.resetRuntimeState();

  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createNpcObjectEvent(10, 8)], 0, 0);

  const npc = manager.getNPCByLocalId(MAP_ID, NPC_LOCAL_ID);
  assert.ok(npc);

  // Simulate an active walk from (10,8) -> (11,8):
  // currentCoords at destination, subTileX<0 indicates previous tile at x-1.
  npc.tileX = 11;
  npc.tileY = 8;
  npc.isWalking = true;
  npc.subTileX = -8;
  npc.subTileY = 0;

  assert.equal(manager.hasNPCAt(10, 8), true);
  assert.equal(manager.hasNPCAt(11, 8), true);
  assert.equal(manager.hasNPCAt(9, 8), false);

  assert.equal(manager.hasNPCAtWithElevation(10, 8, 3), true);
  assert.equal(manager.hasNPCAtWithElevation(11, 8, 3), true);
});
