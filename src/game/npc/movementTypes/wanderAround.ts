/**
 * Wander Around Movement Type Handler
 *
 * Implements MOVEMENT_TYPE_WANDER_AROUND
 *
 * NPC randomly picks a direction, checks if it can move there,
 * then either walks one tile or just faces that direction if blocked.
 *
 * State Machine:
 *   Step 0: Initialize
 *   Step 1: Set facing animation for current direction
 *   Step 2: Execute face action, set random delay
 *   Step 3: Wait for delay timer
 *   Step 4: Pick random direction, check collision
 *   Step 5: Start walking
 *   Step 6: Execute walk until complete
 *
 * Reference: MovementType_WanderAround_* in event_object_movement.c:2566-2630
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
  STANDARD_DIRECTIONS,
  setFacingDirection,
  setDelay,
  waitForDelay,
  pickRandomDelay,
  pickRandomDirection,
  startWalking,
} from '../NPCMovementEngine';

/**
 * Step 0: Initialize
 */
function step0(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // Clear movement state
  state.singleMovementActive = false;
  state.isWalking = false;

  return {
    nextStep: 1,
    continueImmediately: true,
  };
}

/**
 * Step 1: Set facing animation
 */
function step1(
  _npc: NPCObject,
  _state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // Facing direction already set, start face animation
  return {
    nextStep: 2,
    continueImmediately: false,
  };
}

/**
 * Step 2: Execute face action, set delay
 */
function step2(
  _npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  // Face action completes immediately
  const delay = pickRandomDelay(MOVEMENT_DELAYS_MEDIUM, context.random);
  setDelay(state, delay);

  return {
    nextStep: 3,
    continueImmediately: false,
  };
}

/**
 * Step 3: Wait for delay
 */
function step3(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  if (waitForDelay(state)) {
    return {
      nextStep: 4,
      continueImmediately: true,
    };
  }

  return {
    nextStep: 3,
    continueImmediately: false,
  };
}

/**
 * Step 4: Pick direction, check collision
 */
function step4(
  npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  // Pick random direction from all 4
  const direction = pickRandomDirection(STANDARD_DIRECTIONS, context.random);
  setFacingDirection(state, direction);
  state.movementDirection = direction;

  // Check collision
  const collision = context.getCollisionInDirection(npc, state, direction);

  if (collision !== 'none') {
    // Can't move - just face this direction and wait again
    return {
      nextStep: 1,
      continueImmediately: true,
    };
  }

  // Can move - start walking
  return {
    nextStep: 5,
    continueImmediately: true,
  };
}

/**
 * Step 5: Start walking
 */
function step5(
  npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // Start the walk - this immediately updates tile position to destination
  // and sets subTile to animate from old position toward new position
  startWalking(state, state.movementDirection, npc);

  return {
    nextStep: 6,
    continueImmediately: false,
  };
}

/**
 * Step 6: Execute walk until complete
 */
function step6(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // Walk progress is updated in the main engine loop
  // We just check if it's done
  if (!state.isWalking) {
    // Walk complete, go back to facing loop
    state.singleMovementActive = false;
    return {
      nextStep: 1,
      continueImmediately: true,
    };
  }

  // Still walking
  return {
    nextStep: 6,
    continueImmediately: false,
  };
}

/**
 * Wander Around Handler
 */
export const wanderAroundHandler: MovementTypeHandler = {
  getInitialDirection(_movementTypeRaw: string): GBADirection {
    return DIR.SOUTH; // Default facing south
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
        return step2(npc, state, context);
      case 3:
        return step3(npc, state, context);
      case 4:
        return step4(npc, state, context);
      case 5:
        return step5(npc, state, context);
      case 6:
        return step6(npc, state, context);
      default:
        return step0(npc, state, context);
    }
  },
};
