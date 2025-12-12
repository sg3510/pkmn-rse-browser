/**
 * Face Directional Movement Type Handlers
 *
 * Implements FACE_*_AND_* movement types where NPCs look around
 * but only in specific direction combinations.
 *
 * Types implemented:
 * - FACE_DOWN_AND_UP: Looks up and down
 * - FACE_LEFT_AND_RIGHT: Looks left and right
 * - FACE_UP_AND_LEFT: Looks up and left
 * - FACE_UP_AND_RIGHT: Looks up and right
 * - FACE_DOWN_AND_LEFT: Looks down and left
 * - FACE_DOWN_AND_RIGHT: Looks down and right
 * - FACE_DOWN_UP_AND_LEFT: Looks down, up, and left (3 directions)
 * - FACE_DOWN_UP_AND_RIGHT: Looks down, up, and right (3 directions)
 * - FACE_UP_LEFT_AND_RIGHT: Looks up, left, and right (3 directions)
 * - FACE_DOWN_LEFT_AND_RIGHT: Looks down, left, and right (3 directions)
 *
 * Reference: MovementType_Face*And* in event_object_movement.c:3044-3347
 */

import type { NPCObject } from '../../../types/objectEvents';
import type {
  NPCMovementState,
  MovementTypeHandler,
  MovementStepResult,
  MovementContext,
  GBADirection,
} from '../NPCMovementEngine';
import {
  DIR,
  MOVEMENT_DELAYS_MEDIUM,
  setFacingDirection,
  setDelay,
  waitForDelay,
  pickRandomDelay,
  pickRandomDirection,
} from '../NPCMovementEngine';

/**
 * Create a face handler for a specific set of directions
 */
function createFaceHandler(
  directions: GBADirection[],
  initialDirection: GBADirection
): MovementTypeHandler {
  function step0(
    _npc: NPCObject,
    state: NPCMovementState,
    _context: MovementContext
  ): MovementStepResult {
    state.singleMovementActive = false;
    state.isWalking = false;
    return { nextStep: 1, continueImmediately: true };
  }

  function step1(
    _npc: NPCObject,
    _state: NPCMovementState,
    _context: MovementContext
  ): MovementStepResult {
    return { nextStep: 2, continueImmediately: false };
  }

  function step2(
    _npc: NPCObject,
    state: NPCMovementState,
    context: MovementContext
  ): MovementStepResult {
    state.singleMovementActive = false;
    const delay = pickRandomDelay(MOVEMENT_DELAYS_MEDIUM, context.random);
    setDelay(state, delay);
    return { nextStep: 3, continueImmediately: false };
  }

  function step3(
    _npc: NPCObject,
    state: NPCMovementState,
    _context: MovementContext
  ): MovementStepResult {
    if (waitForDelay(state)) {
      return { nextStep: 4, continueImmediately: true };
    }
    return { nextStep: 3, continueImmediately: false };
  }

  function step4(
    _npc: NPCObject,
    state: NPCMovementState,
    context: MovementContext
  ): MovementStepResult {
    const direction = pickRandomDirection(directions, context.random);
    setFacingDirection(state, direction);
    return { nextStep: 1, continueImmediately: true };
  }

  return {
    getInitialDirection(_movementTypeRaw: string): GBADirection {
      return initialDirection;
    },

    executeStep(
      npc: NPCObject,
      state: NPCMovementState,
      context: MovementContext
    ): MovementStepResult {
      switch (state.stepFuncId) {
        case 0: return step0(npc, state, context);
        case 1: return step1(npc, state, context);
        case 2: return step2(npc, state, context);
        case 3: return step3(npc, state, context);
        case 4: return step4(npc, state, context);
        default: return step0(npc, state, context);
      }
    },
  };
}

// 2-direction face handlers
export const faceDownAndUpHandler = createFaceHandler(
  [DIR.SOUTH, DIR.NORTH],
  DIR.SOUTH
);

export const faceLeftAndRightHandler = createFaceHandler(
  [DIR.WEST, DIR.EAST],
  DIR.WEST
);

export const faceUpAndLeftHandler = createFaceHandler(
  [DIR.NORTH, DIR.WEST],
  DIR.NORTH
);

export const faceUpAndRightHandler = createFaceHandler(
  [DIR.NORTH, DIR.EAST],
  DIR.NORTH
);

export const faceDownAndLeftHandler = createFaceHandler(
  [DIR.SOUTH, DIR.WEST],
  DIR.SOUTH
);

export const faceDownAndRightHandler = createFaceHandler(
  [DIR.SOUTH, DIR.EAST],
  DIR.SOUTH
);

// 3-direction face handlers
export const faceDownUpAndLeftHandler = createFaceHandler(
  [DIR.SOUTH, DIR.NORTH, DIR.WEST],
  DIR.SOUTH
);

export const faceDownUpAndRightHandler = createFaceHandler(
  [DIR.SOUTH, DIR.NORTH, DIR.EAST],
  DIR.SOUTH
);

export const faceUpLeftAndRightHandler = createFaceHandler(
  [DIR.NORTH, DIR.WEST, DIR.EAST],
  DIR.NORTH
);

export const faceDownLeftAndRightHandler = createFaceHandler(
  [DIR.SOUTH, DIR.WEST, DIR.EAST],
  DIR.SOUTH
);
