import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTruckSequenceFrame,
  bootstrapTruckSequence,
  createTruckSequenceRuntime,
  isTruckSequenceLocked,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP,
} from '../TruckSequenceRunner.ts';

interface MetatileWrite {
  mapId: string;
  tileX: number;
  tileY: number;
  metatileId: number;
}

function createMetatileRecorder() {
  const writes: MetatileWrite[] = [];
  return {
    writes,
    setMapMetatileLocal: (mapId: string, tileX: number, tileY: number, metatileId: number): boolean => {
      writes.push({ mapId, tileX, tileY, metatileId });
      return true;
    },
  };
}

function createObjectEventManagerStub() {
  return {
    getNPCByLocalId: () => null,
  } as never;
}

test('bootstrapTruckSequence closes the truck door before the first visible intro frame', () => {
  const runtime = createTruckSequenceRuntime();
  const recorder = createMetatileRecorder();
  let invalidations = 0;

  const changed = bootstrapTruckSequence({
    runtime,
    shouldRun: true,
    gbaFrame: 42,
    setMapMetatileLocal: recorder.setMapMetatileLocal,
    invalidateMap: () => {
      invalidations++;
    },
  });

  assert.equal(changed, true);
  assert.ok(runtime.sequence);
  assert.equal(runtime.doorClosedApplied, true);
  assert.equal(runtime.doorOpenedApplied, false);
  assert.equal(runtime.lastGbaFrame, 42);
  assert.equal(runtime.lastOutput.complete, false);
  assert.equal(isTruckSequenceLocked(runtime), true);
  assert.equal(invalidations, 1);
  assert.deepEqual(recorder.writes, [
    { mapId: 'MAP_INSIDE_OF_TRUCK', tileX: 4, tileY: 1, metatileId: METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP },
    { mapId: 'MAP_INSIDE_OF_TRUCK', tileX: 4, tileY: 2, metatileId: METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID },
    { mapId: 'MAP_INSIDE_OF_TRUCK', tileX: 4, tileY: 3, metatileId: METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM },
  ]);
});

test('bootstrapTruckSequence is a no-op when the truck intro is not active', () => {
  const runtime = createTruckSequenceRuntime();
  const recorder = createMetatileRecorder();
  let invalidations = 0;

  const changed = bootstrapTruckSequence({
    runtime,
    shouldRun: false,
    gbaFrame: 7,
    setMapMetatileLocal: recorder.setMapMetatileLocal,
    invalidateMap: () => {
      invalidations++;
    },
  });

  assert.equal(changed, false);
  assert.equal(runtime.sequence, null);
  assert.equal(runtime.doorClosedApplied, false);
  assert.equal(runtime.doorOpenedApplied, false);
  assert.equal(recorder.writes.length, 0);
  assert.equal(invalidations, 0);
});

test('applyTruckSequenceFrame reopens the truck door once after the intro sequence completes', () => {
  const runtime = createTruckSequenceRuntime();
  const bootstrapRecorder = createMetatileRecorder();

  bootstrapTruckSequence({
    runtime,
    shouldRun: true,
    gbaFrame: 0,
    setMapMetatileLocal: bootstrapRecorder.setMapMetatileLocal,
    invalidateMap: () => {},
  });

  const runtimeRecorder = createMetatileRecorder();
  let invalidations = 0;
  let panCalls = 0;
  let resetCalls = 0;
  const camera = {
    setPanning: () => {
      panCalls++;
    },
    resetPanning: () => {
      resetCalls++;
    },
  } as never;

  applyTruckSequenceFrame({
    runtime,
    gbaFrame: 1,
    view: {} as never,
    camera,
    objectEventManager: createObjectEventManagerStub(),
    setMapMetatileLocal: runtimeRecorder.setMapMetatileLocal,
    invalidateMap: () => {
      invalidations++;
    },
  });

  assert.equal(runtime.doorOpenedApplied, false);
  assert.equal(runtimeRecorder.writes.length, 0);
  assert.ok(panCalls > 0);

  for (let gbaFrame = 2; gbaFrame < 2000 && !runtime.lastOutput.complete; gbaFrame++) {
    applyTruckSequenceFrame({
      runtime,
      gbaFrame,
      view: {} as never,
      camera,
      objectEventManager: createObjectEventManagerStub(),
      setMapMetatileLocal: runtimeRecorder.setMapMetatileLocal,
      invalidateMap: () => {
        invalidations++;
      },
    });
  }

  assert.equal(runtime.lastOutput.complete, true);
  assert.equal(runtime.doorOpenedApplied, true);
  assert.deepEqual(runtimeRecorder.writes, [
    { mapId: 'MAP_INSIDE_OF_TRUCK', tileX: 4, tileY: 1, metatileId: METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP },
    { mapId: 'MAP_INSIDE_OF_TRUCK', tileX: 4, tileY: 2, metatileId: METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID },
    { mapId: 'MAP_INSIDE_OF_TRUCK', tileX: 4, tileY: 3, metatileId: METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM },
  ]);
  assert.equal(invalidations, 1);
  assert.ok(resetCalls > 0);

  applyTruckSequenceFrame({
    runtime,
    gbaFrame: 2000,
    view: {} as never,
    camera,
    objectEventManager: createObjectEventManagerStub(),
    setMapMetatileLocal: runtimeRecorder.setMapMetatileLocal,
    invalidateMap: () => {
      invalidations++;
    },
  });

  assert.equal(runtimeRecorder.writes.length, 3);
  assert.equal(invalidations, 1);
});
