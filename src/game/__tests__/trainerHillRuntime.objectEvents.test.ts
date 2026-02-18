import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTrainerHillDynamicObjectEvents,
  resetTrainerHillRuntimeState,
  trainerHillSetMode,
} from '../trainerHillRuntime.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';

test('Trainer Hill runtime generates two trainer object templates for floor maps', () => {
  saveStateStore.resetRuntimeState();
  resetTrainerHillRuntimeState();
  trainerHillSetMode(0);

  const events = getTrainerHillDynamicObjectEvents('MAP_TRAINER_HILL_1F');
  assert.ok(events);
  assert.equal(events.length, 2);
  assert.equal(events[0].local_id, '1');
  assert.equal(events[1].local_id, '2');
  assert.equal(events[0].script, 'TrainerHill_EventScript_TrainerBattle');
  assert.equal(events[1].script, 'TrainerHill_EventScript_TrainerBattle');
  assert.equal(events[0].trainer_type, 'TRAINER_TYPE_NORMAL');
  assert.equal(events[1].trainer_type, 'TRAINER_TYPE_NORMAL');
  assert.equal(events[0].movement_range_x, 1);
  assert.equal(events[0].movement_range_y, 1);
  assert.equal(events[1].movement_range_x, 1);
  assert.equal(events[1].movement_range_y, 1);
  assert.equal(events[0].flag, '0');
  assert.equal(events[1].flag, '0');
});

test('Trainer Hill runtime only overrides floor maps', () => {
  saveStateStore.resetRuntimeState();
  resetTrainerHillRuntimeState();
  trainerHillSetMode(0);

  assert.equal(getTrainerHillDynamicObjectEvents('MAP_TRAINER_HILL_ENTRANCE'), null);
  assert.equal(getTrainerHillDynamicObjectEvents('MAP_ROUTE101'), null);
});
