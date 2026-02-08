/**
 * Walk In Place Movement Type Handler
 *
 * Implements MOVEMENT_TYPE_WALK_IN_PLACE_UP/DOWN/LEFT/RIGHT
 *
 * The NPC cycles walk animation frames while staying on the same tile.
 * Used for Vigoroth movers in the player's house.
 *
 * State Machine:
 *   Step 0: Initialize, set facing direction, start walking animation
 *   Step 1: Toggle isWalking on/off at regular intervals to cycle animation
 *
 * Reference: MovementType_WalkInPlace in event_object_movement.c
 */

import type { NPCObject } from '../../../types/objectEvents';
import type {
  NPCMovementState,
  MovementTypeHandler,
  MovementStepResult,
  MovementContext,
  GBADirection,
} from '../NPCMovementEngine';
import { DIR, setFacingDirection } from '../NPCMovementEngine';

/** Frames between walk animation toggles (~16 frames = ~267ms) */
const WALK_IN_PLACE_TOGGLE_FRAMES = 16;

function getInitialDirectionForType(movementTypeRaw: string): GBADirection {
  if (movementTypeRaw.includes('IN_PLACE_UP')) return DIR.NORTH;
  if (movementTypeRaw.includes('IN_PLACE_DOWN')) return DIR.SOUTH;
  if (movementTypeRaw.includes('IN_PLACE_LEFT')) return DIR.WEST;
  if (movementTypeRaw.includes('IN_PLACE_RIGHT')) return DIR.EAST;
  return DIR.SOUTH;
}

function step0(
  npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  const direction = getInitialDirectionForType(npc.movementTypeRaw);
  setFacingDirection(state, direction);
  state.delayTimer = WALK_IN_PLACE_TOGGLE_FRAMES;
  // Set walking on the movement state — the engine copies state.isWalking to npc.isWalking
  state.isWalking = true;

  return {
    nextStep: 1,
    continueImmediately: false,
  };
}

function step1(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  if (state.delayTimer > 0) {
    state.delayTimer--;
    return { nextStep: 1, continueImmediately: false };
  }

  // Toggle walk animation on the movement state
  state.isWalking = !state.isWalking;
  state.delayTimer = WALK_IN_PLACE_TOGGLE_FRAMES;

  return {
    nextStep: 1,
    continueImmediately: false,
  };
}

export const walkInPlaceHandler: MovementTypeHandler = {
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
      default:
        return step1(npc, state, context);
    }
  },
};
