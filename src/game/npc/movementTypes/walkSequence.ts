/**
 * Walk Sequence movement type handler.
 *
 * Implements all 24 MOVEMENT_TYPE_WALK_SEQUENCE_* variants.
 * Each variant walks a fixed 4-direction cycle, returning to the start.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c:3824-4155
 *   MoveNextDirectionInSequence(), MovementType_WalkSequence*
 * - public/pokeemerald/src/data/object_events/movement_type_func_tables.h
 *   Direction arrays for each variant
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

const dirNameToGBA: Record<string, GBADirection> = {
  UP: DIR.NORTH,
  DOWN: DIR.SOUTH,
  LEFT: DIR.WEST,
  RIGHT: DIR.EAST,
};

/**
 * Parse direction sequence from raw movement type string.
 * e.g. "MOVEMENT_TYPE_WALK_SEQUENCE_UP_RIGHT_LEFT_DOWN" → [NORTH, EAST, WEST, SOUTH]
 */
function parseDirectionSequence(movementTypeRaw: string): GBADirection[] {
  const suffix = movementTypeRaw.replace('MOVEMENT_TYPE_WALK_SEQUENCE_', '');
  const matches = suffix.match(/(UP|DOWN|LEFT|RIGHT)/g);
  if (!matches || matches.length !== 4) {
    // Fallback: default square pattern
    return [DIR.SOUTH, DIR.EAST, DIR.NORTH, DIR.WEST];
  }
  return matches.map((m) => dirNameToGBA[m]);
}

function isHorizontal(dir: GBADirection): boolean {
  return dir === DIR.EAST || dir === DIR.WEST;
}

/**
 * Derive the mid-cycle skip rule from the direction array.
 *
 * In C, each variant has a conditional check before MoveNextDirectionInSequence:
 *   if (directionSequenceIndex == N && initialCoords.{x|y} == currentCoords.{x|y})
 *       directionSequenceIndex = N+1;
 *
 * The pattern: find the pair of consecutive directions on the same axis
 * (the "return leg"). The skip triggers at the second index of that pair,
 * checking the axis coordinate against the initial position.
 */
function deriveSkipRule(dirs: GBADirection[]): { skipIndex: number; checkAxis: 'x' | 'y' } {
  // Check d0,d1 same axis
  if (isHorizontal(dirs[0]) === isHorizontal(dirs[1])) {
    return {
      skipIndex: 1,
      checkAxis: isHorizontal(dirs[1]) ? 'x' : 'y',
    };
  }
  // Otherwise d1,d2 must be on the same axis
  return {
    skipIndex: 2,
    checkAxis: isHorizontal(dirs[2]) ? 'x' : 'y',
  };
}

// Cache parsed data per raw movement type
const sequenceCache = new Map<string, {
  directions: GBADirection[];
  skipIndex: number;
  checkAxis: 'x' | 'y';
}>();

function getSequenceData(movementTypeRaw: string) {
  let data = sequenceCache.get(movementTypeRaw);
  if (!data) {
    const directions = parseDirectionSequence(movementTypeRaw);
    const { skipIndex, checkAxis } = deriveSkipRule(directions);
    data = { directions, skipIndex, checkAxis };
    sequenceCache.set(movementTypeRaw, data);
  }
  return data;
}

/**
 * Step 0: Initialize - clear movement state, record initial position.
 */
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

/**
 * Step 1: Pick next direction, apply mid-cycle skip, check collision, move.
 *
 * Mirrors MoveNextDirectionInSequence() from C:
 * 1. Reset index when sequence complete and back at origin
 * 2. Apply variant-specific skip optimization
 * 3. Face the current sequence direction
 * 4. Check collision; if OUTSIDE_RANGE, advance index and retry
 * 5. If any collision, walk in place; otherwise walk forward
 */
function step1(
  npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  const { directions, skipIndex, checkAxis } = getSequenceData(npc.movementTypeRaw);

  // C: reset index to 0 when at end of sequence and back at start
  if (
    state.directionSequenceIndex === 3 &&
    npc.tileX === state.initialTileX &&
    npc.tileY === state.initialTileY
  ) {
    state.directionSequenceIndex = 0;
  }

  // C: variant-specific mid-cycle skip
  if (state.directionSequenceIndex === skipIndex) {
    const atInitial =
      checkAxis === 'x'
        ? npc.tileX === state.initialTileX
        : npc.tileY === state.initialTileY;
    if (atInitial) {
      state.directionSequenceIndex = skipIndex + 1;
    }
  }

  // Get current direction from sequence
  const direction = directions[state.directionSequenceIndex];
  setFacingDirection(state, direction);
  state.movementDirection = direction;

  // Check collision
  let collision = context.getCollisionInDirection(npc, state, direction);

  // C: if outside range, advance index and try next direction
  if (collision === 'outside_range') {
    state.directionSequenceIndex++;
    const nextDir = directions[state.directionSequenceIndex];
    if (nextDir !== undefined) {
      setFacingDirection(state, nextDir);
      state.movementDirection = nextDir;
      collision = context.getCollisionInDirection(npc, state, nextDir);
    }
  }

  if (collision !== 'none') {
    // Walk in place facing current direction (matches C: GetWalkInPlaceNormalMovementAction)
    state.isWalking = true;
    state.walkInPlace = true;
    state.walkProgress = 0;
    state.singleMovementActive = true;
  } else {
    // Walk forward
    startWalking(state, state.movementDirection, npc);
  }

  return { nextStep: 2, continueImmediately: false };
}

/**
 * Step 2: Wait for walk/walk-in-place to complete, then loop back.
 */
function step2(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  if (!state.isWalking) {
    state.singleMovementActive = false;
    // Advance to next direction in sequence after completing a step
    state.directionSequenceIndex++;
    return { nextStep: 1, continueImmediately: true };
  }
  return { nextStep: 2, continueImmediately: false };
}

export const walkSequenceHandler: MovementTypeHandler = {
  getInitialDirection(movementTypeRaw: string): GBADirection {
    const { directions } = getSequenceData(movementTypeRaw);
    return directions[0];
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
      default:
        return step0(npc, state, context);
    }
  },
};
