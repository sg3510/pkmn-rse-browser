/**
 * Walk Back-And-Forth movement type handler.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c
 *   - MovementType_WalkBackAndForth_Step0..Step3
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
  setFacingDirection,
  startWalking,
} from '../NPCMovementEngine';

function getInitialDirectionForType(movementTypeRaw: string): GBADirection {
  if (movementTypeRaw.includes('WALK_RIGHT_AND_LEFT')) return DIR.EAST;
  if (movementTypeRaw.includes('WALK_LEFT_AND_RIGHT')) return DIR.WEST;
  if (movementTypeRaw.includes('WALK_DOWN_AND_UP')) return DIR.SOUTH;
  if (movementTypeRaw.includes('WALK_UP_AND_DOWN')) return DIR.NORTH;
  return DIR.WEST;
}

function getOppositeDirection(direction: GBADirection): GBADirection {
  switch (direction) {
    case DIR.NORTH: return DIR.SOUTH;
    case DIR.SOUTH: return DIR.NORTH;
    case DIR.WEST: return DIR.EAST;
    case DIR.EAST: return DIR.WEST;
    default: return DIR.SOUTH;
  }
}

function step0(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  state.singleMovementActive = false;
  state.isWalking = false;
  state.walkInPlace = false;
  state.walkProgress = 0;
  state.subTileX = 0;
  state.subTileY = 0;
  return { nextStep: 1, continueImmediately: true };
}

function step1(
  npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  const initialDirection = getInitialDirectionForType(npc.movementTypeRaw);
  const facingDirection = state.directionSequenceIndex ? getOppositeDirection(initialDirection) : initialDirection;
  setFacingDirection(state, facingDirection);
  state.movementDirection = facingDirection;
  return { nextStep: 2, continueImmediately: true };
}

function step2(
  npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  // Match C behavior: when returning to spawn, restart initial direction leg.
  if (
    state.directionSequenceIndex !== 0
    && npc.tileX === state.initialTileX
    && npc.tileY === state.initialTileY
  ) {
    state.directionSequenceIndex = 0;
    const newDirection = getOppositeDirection(state.movementDirection);
    setFacingDirection(state, newDirection);
    state.movementDirection = newDirection;
  }

  let collision = context.getCollisionInDirection(npc, state, state.movementDirection);
  if (collision === 'outside_range') {
    state.directionSequenceIndex++;
    const reversed = getOppositeDirection(state.movementDirection);
    setFacingDirection(state, reversed);
    state.movementDirection = reversed;
    collision = context.getCollisionInDirection(npc, state, state.movementDirection);
  }

  if (collision !== 'none') {
    // C uses walk-in-place animation here; keep parity on direction flow
    // and retry next tick without changing tile.
    return { nextStep: 1, continueImmediately: false };
  }

  startWalking(state, state.movementDirection, npc);
  return { nextStep: 3, continueImmediately: false };
}

function step3(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  if (!state.isWalking) {
    state.singleMovementActive = false;
    return { nextStep: 1, continueImmediately: true };
  }
  return { nextStep: 3, continueImmediately: false };
}

export const walkBackAndForthHandler: MovementTypeHandler = {
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
        return step2(npc, state, context);
      case 3:
      default:
        return step3(npc, state, context);
    }
  },
};
