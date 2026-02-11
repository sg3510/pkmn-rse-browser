/**
 * Face Direction Movement Type Handler
 *
 * Implements MOVEMENT_TYPE_FACE_UP/DOWN/LEFT/RIGHT
 *
 * The simplest movement type - just faces a direction and stays there.
 *
 * State Machine:
 *   Step 0: Initialize, set facing animation
 *   Step 1: Execute face action (immediate)
 *   Step 2: Done, stay idle forever
 *
 * Reference: MovementType_FaceDirection_* in event_object_movement.c:3031-3055
 */

import type { NPCObject } from '../../../types/objectEvents';
import type {
  NPCMovementState,
  MovementTypeHandler,
  MovementStepResult,
  MovementContext,
  GBADirection,
} from '../NPCMovementEngine';
import { DIR } from '../NPCMovementEngine';

/**
 * Get initial direction based on movement type
 */
function getInitialDirectionForType(movementTypeRaw: string): GBADirection {
  if (movementTypeRaw.includes('FACE_UP')) return DIR.NORTH;
  if (movementTypeRaw.includes('FACE_DOWN')) return DIR.SOUTH;
  if (movementTypeRaw.includes('FACE_LEFT')) return DIR.WEST;
  if (movementTypeRaw.includes('FACE_RIGHT')) return DIR.EAST;
  return DIR.SOUTH; // Default
}

/**
 * Step 0: Initialize and set facing animation
 */
function step0(
  _npc: NPCObject,
  _state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // C parity: facingDirection is already set from npc.direction in
  // initializeNPC(). Don't override here — scripts (e.g. applymovement
  // walk_in_place_faster_up) may have set a specific direction that
  // differs from the movementTypeRaw default.
  return {
    nextStep: 1,
    continueImmediately: true, // Immediately execute face action
  };
}

/**
 * Step 1: Execute face action (completes immediately)
 */
function step1(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // Face action executes immediately for static facing
  state.singleMovementActive = false;

  return {
    nextStep: 2,
    continueImmediately: true,
  };
}

/**
 * Step 2: Stay idle forever
 */
function step2(
  _npc: NPCObject,
  _state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // Just stay here doing nothing
  return {
    nextStep: 2,
    continueImmediately: false,
  };
}

/**
 * Face Direction Handler
 */
export const faceDirectionHandler: MovementTypeHandler = {
  getInitialDirection(movementTypeRaw: string): GBADirection {
    return getInitialDirectionForType(movementTypeRaw);
  },

  executeStep(
    npc: NPCObject,
    state: NPCMovementState,
    context: MovementContext
  ): MovementStepResult {
    switch (state.stepFuncId) {
      case 0:
        return step0(npc, state, context);
      case 1:
        return step1(npc, state, context);
      case 2:
      default:
        return step2(npc, state, context);
    }
  },
};
