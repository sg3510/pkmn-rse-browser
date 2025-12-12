/**
 * Look Around Movement Type Handler
 *
 * Implements MOVEMENT_TYPE_LOOK_AROUND
 *
 * NPC randomly looks in different directions without moving.
 * Uses MEDIUM delays between direction changes.
 *
 * State Machine:
 *   Step 0: Initialize
 *   Step 1: Set facing animation for current direction
 *   Step 2: Execute face action, then set random delay
 *   Step 3: Wait for delay timer
 *   Step 4: Pick new random direction, go back to Step 1
 *
 * Reference: MovementType_LookAround_* in event_object_movement.c:2844-2893
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
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  // The facing direction should already be set (from step 4 or initialization)
  // Just mark that we're setting the face animation

  return {
    nextStep: 2,
    continueImmediately: false, // Wait one frame for animation to "start"
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
  // Face action completes immediately (it's just a static frame)
  state.singleMovementActive = false;

  // Set random delay before looking in a new direction
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
    // Delay finished, pick new direction
    return {
      nextStep: 4,
      continueImmediately: true,
    };
  }

  // Still waiting
  return {
    nextStep: 3,
    continueImmediately: false,
  };
}

/**
 * Step 4: Pick new random direction
 */
function step4(
  _npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  // Pick random direction from all 4
  const direction = pickRandomDirection(STANDARD_DIRECTIONS, context.random);
  setFacingDirection(state, direction);

  return {
    nextStep: 1,
    continueImmediately: true,
  };
}

/**
 * Look Around Handler
 */
export const lookAroundHandler: MovementTypeHandler = {
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
      default:
        return step0(npc, state, context);
    }
  },
};
