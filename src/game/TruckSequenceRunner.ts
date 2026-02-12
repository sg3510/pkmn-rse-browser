/**
 * TruckSequenceRunner - truck intro render/state glue for GamePage.
 *
 * C references:
 * - public/pokeemerald/src/field_special_scene.c (ExecuteTruckSequence, Task_Truck1/2/3)
 * - public/pokeemerald/include/constants/metatile_labels.h (InsideOfTruck door/light metatiles)
 */

import type { WorldCameraView } from '../rendering/types';
import type { ObjectEventManager } from './ObjectEventManager';
import type { CameraController } from './CameraController';
import { TruckSequence, type TruckSequenceOutput } from './TruckSequence';

export const METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP = 0x20d;
export const METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID = 0x215;
export const METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM = 0x21d;
export const METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP = 0x208;
export const METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID = 0x210;
export const METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM = 0x218;

const MAP_INSIDE_OF_TRUCK = 'MAP_INSIDE_OF_TRUCK';
const LOCALID_TRUCK_BOX_TOP = 'LOCALID_TRUCK_BOX_TOP';
const LOCALID_TRUCK_BOX_BOTTOM_L = 'LOCALID_TRUCK_BOX_BOTTOM_L';
const LOCALID_TRUCK_BOX_BOTTOM_R = 'LOCALID_TRUCK_BOX_BOTTOM_R';

function createTruckOutput(
  complete: boolean,
  playerLocked: boolean
): TruckSequenceOutput {
  return {
    cameraOffsetX: 0,
    cameraOffsetY: 0,
    complete,
    playerLocked,
    boxOffsets: {
      box1X: 3,
      box1Y: 3,
      box2X: 0,
      box2Y: -3,
      box3X: -3,
      box3Y: 0,
    },
  };
}

export interface TruckSequenceRuntime {
  sequence: TruckSequence | null;
  doorClosedApplied: boolean;
  doorOpenedApplied: boolean;
  lastGbaFrame: number;
  lastOutput: TruckSequenceOutput;
}

export function createTruckSequenceRuntime(): TruckSequenceRuntime {
  return {
    sequence: null,
    doorClosedApplied: false,
    doorOpenedApplied: false,
    lastGbaFrame: 0,
    lastOutput: createTruckOutput(true, false),
  };
}

export function isTruckSequenceLocked(runtime: TruckSequenceRuntime): boolean {
  return runtime.sequence !== null && !runtime.sequence.isComplete();
}

export function syncTruckSequenceRuntime(
  runtime: TruckSequenceRuntime,
  shouldRun: boolean,
  gbaFrame: number
): void {
  if (shouldRun && runtime.sequence === null) {
    runtime.sequence = new TruckSequence();
    runtime.doorClosedApplied = false;
    runtime.doorOpenedApplied = false;
    runtime.lastGbaFrame = gbaFrame;
    runtime.lastOutput = createTruckOutput(false, true);
    return;
  }

  if (!shouldRun && runtime.sequence !== null) {
    runtime.sequence = null;
    runtime.doorClosedApplied = false;
    runtime.doorOpenedApplied = false;
    runtime.lastGbaFrame = gbaFrame;
    runtime.lastOutput = createTruckOutput(true, false);
  }
}

function setDoorClosed(
  setMapMetatileLocal: (mapId: string, tileX: number, tileY: number, metatileId: number) => boolean
): boolean {
  let changed = false;
  changed = setMapMetatileLocal(MAP_INSIDE_OF_TRUCK, 4, 1, METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP) || changed;
  changed = setMapMetatileLocal(MAP_INSIDE_OF_TRUCK, 4, 2, METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID) || changed;
  changed = setMapMetatileLocal(MAP_INSIDE_OF_TRUCK, 4, 3, METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM) || changed;
  return changed;
}

function setDoorOpened(
  setMapMetatileLocal: (mapId: string, tileX: number, tileY: number, metatileId: number) => boolean
): boolean {
  let changed = false;
  changed = setMapMetatileLocal(MAP_INSIDE_OF_TRUCK, 4, 1, METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP) || changed;
  changed = setMapMetatileLocal(MAP_INSIDE_OF_TRUCK, 4, 2, METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID) || changed;
  changed = setMapMetatileLocal(MAP_INSIDE_OF_TRUCK, 4, 3, METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM) || changed;
  return changed;
}

function applyTruckBoxOffsets(
  objectEventManager: ObjectEventManager,
  output: TruckSequenceOutput
): void {
  const boxTop = objectEventManager.getNPCByLocalId(MAP_INSIDE_OF_TRUCK, LOCALID_TRUCK_BOX_TOP);
  const boxBottomLeft = objectEventManager.getNPCByLocalId(MAP_INSIDE_OF_TRUCK, LOCALID_TRUCK_BOX_BOTTOM_L);
  const boxBottomRight = objectEventManager.getNPCByLocalId(MAP_INSIDE_OF_TRUCK, LOCALID_TRUCK_BOX_BOTTOM_R);

  if (boxTop) {
    boxTop.subTileX = output.boxOffsets.box1X;
    boxTop.subTileY = output.boxOffsets.box1Y;
  }
  if (boxBottomLeft) {
    boxBottomLeft.subTileX = output.boxOffsets.box2X;
    boxBottomLeft.subTileY = output.boxOffsets.box2Y;
  }
  if (boxBottomRight) {
    boxBottomRight.subTileX = output.boxOffsets.box3X;
    boxBottomRight.subTileY = output.boxOffsets.box3Y;
  }
}

export interface ApplyTruckSequenceFrameParams {
  runtime: TruckSequenceRuntime;
  gbaFrame: number;
  view: WorldCameraView;
  camera?: CameraController | null;
  objectEventManager: ObjectEventManager;
  setMapMetatileLocal: (mapId: string, tileX: number, tileY: number, metatileId: number) => boolean;
  invalidateMap: () => void;
}

export function applyTruckSequenceFrame(params: ApplyTruckSequenceFrameParams): void {
  const {
    runtime,
    gbaFrame,
    camera,
    objectEventManager,
    setMapMetatileLocal,
    invalidateMap,
  } = params;

  if (!runtime.sequence) {
    return;
  }

  if (!runtime.doorClosedApplied) {
    runtime.doorClosedApplied = true;
    if (setDoorClosed(setMapMetatileLocal)) {
      invalidateMap();
    }
  }

  const frameDelta = gbaFrame - runtime.lastGbaFrame;
  if (frameDelta > 0) {
    runtime.lastOutput = runtime.sequence.update(frameDelta);
    runtime.lastGbaFrame = gbaFrame;
  }

  const output = runtime.lastOutput;
  if (!output.complete) {
    if (camera) {
      camera.setPanning(output.cameraOffsetX, output.cameraOffsetY);
    }
  } else {
    // Ensure panning is reset when sequence completes
    camera?.resetPanning();
  }

  applyTruckBoxOffsets(objectEventManager, output);

  if (output.complete && !runtime.doorOpenedApplied) {
    runtime.doorOpenedApplied = true;
    if (setDoorOpened(setMapMetatileLocal)) {
      invalidateMap();
    }
  }
}
