import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectEventManager } from '../ObjectEventManager.ts';
import type { ObjectEventData } from '../../types/objectEvents.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';

const MAP_ID = 'MAP_TEST_INTERACTABLE_ELEVATION';

function createNpcObjectEvent(overrides: Partial<ObjectEventData> = {}): ObjectEventData {
  return {
    local_id: '1',
    graphics_id: 'OBJ_EVENT_GFX_SWIMMER_M',
    x: 10,
    y: 8,
    elevation: 1,
    movement_type: 'MOVEMENT_TYPE_FACE_RIGHT',
    movement_range_x: 0,
    movement_range_y: 0,
    trainer_type: 'TRAINER_TYPE_NORMAL',
    trainer_sight_or_berry_tree_id: '3',
    script: 'Route105_EventScript_Luis',
    flag: '0',
    ...overrides,
  };
}

test('getInteractableAtWithElevation returns water NPCs while surfing elevation', () => {
  saveStateStore.resetRuntimeState();

  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [createNpcObjectEvent()], 0, 0);

  const interactable = manager.getInteractableAtWithElevation(10, 8, 1);
  assert.ok(interactable);
  assert.equal(interactable.type, 'npc');
});

test('getInteractableAtWithElevation uses runtime tile elevation for NPCs', () => {
  saveStateStore.resetRuntimeState();

  const manager = new ObjectEventManager();
  manager.parseMapObjects(MAP_ID, [
    createNpcObjectEvent({
      elevation: 3,
    }),
  ], 0, 0);

  manager.setTileElevationResolver((tileX, tileY) => {
    if (tileX === 10 && tileY === 8) {
      return 1;
    }
    return 3;
  });

  const interactable = manager.getInteractableAtWithElevation(10, 8, 1);
  assert.ok(interactable);
  assert.equal(interactable.type, 'npc');
});
