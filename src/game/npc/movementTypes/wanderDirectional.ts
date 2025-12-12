/**
 * Wander Directional Movement Type Handlers
 *
 * Implements:
 * - MOVEMENT_TYPE_WANDER_UP_AND_DOWN / WANDER_DOWN_AND_UP
 * - MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT / WANDER_RIGHT_AND_LEFT
 *
 * Same as WANDER_AROUND but limited to 2 directions.
 *
 * Reference: MovementType_WanderUpAndDown_*, MovementType_WanderLeftAndRight_*
 * in event_object_movement.c:2895-3028
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
  UP_AND_DOWN_DIRECTIONS,
  LEFT_AND_RIGHT_DIRECTIONS,
  setFacingDirection,
  setDelay,
  waitForDelay,
  pickRandomDelay,
  pickRandomDirection,
  startWalking,
} from '../NPCMovementEngine';

/**
 * Create a wander handler for a specific set of directions
 */
function createWanderHandler(
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
    npc: NPCObject,
    state: NPCMovementState,
    context: MovementContext
  ): MovementStepResult {
    // Pick random direction from the limited set
    const direction = pickRandomDirection(directions, context.random);
    setFacingDirection(state, direction);
    state.movementDirection = direction;

    const collision = context.getCollisionInDirection(npc, state, direction);
    if (collision !== 'none') {
      return { nextStep: 1, continueImmediately: true };
    }
    return { nextStep: 5, continueImmediately: true };
  }

  function step5(
    npc: NPCObject,
    state: NPCMovementState,
    _context: MovementContext
  ): MovementStepResult {
    startWalking(state, state.movementDirection, npc);
    return { nextStep: 6, continueImmediately: false };
  }

  function step6(
    _npc: NPCObject,
    state: NPCMovementState,
    _context: MovementContext
  ): MovementStepResult {
    if (!state.isWalking) {
      state.singleMovementActive = false;
      return { nextStep: 1, continueImmediately: true };
    }
    return { nextStep: 6, continueImmediately: false };
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
        case 5: return step5(npc, state, context);
        case 6: return step6(npc, state, context);
        default: return step0(npc, state, context);
      }
    },
  };
}

/**
 * Wander Up and Down Handler
 * Initial direction: NORTH (up)
 */
export const wanderUpAndDownHandler = createWanderHandler(
  UP_AND_DOWN_DIRECTIONS,
  DIR.NORTH
);

/**
 * Wander Left and Right Handler
 * Initial direction: WEST (left)
 */
export const wanderLeftAndRightHandler = createWanderHandler(
  LEFT_AND_RIGHT_DIRECTIONS,
  DIR.WEST
);
