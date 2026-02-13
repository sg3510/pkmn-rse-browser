/**
 * Copy-player movement handler.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c (MovementType_CopyPlayer*)
 * - public/pokeemerald/src/faraway_island.c (GetMewMoveDirection)
 */

import type { NPCObject } from '../../../types/objectEvents';
import {
  getFarawayMewMoveDirection,
  shouldFarawayMewBeVisible,
} from '../../legendary/farawayMew';
import { gameVariables } from '../../GameVariables';
import { isLongGrassBehavior, isTallGrassBehavior } from '../../../utils/metatileBehaviors';
import type {
  NPCMovementState,
  MovementTypeHandler,
  MovementStepResult,
  MovementContext,
  GBADirection,
} from '../NPCMovementEngine';
import {
  DIR,
  getDirectionDeltas,
  setFacingDirection,
  startWalking,
} from '../NPCMovementEngine';

const FARAWAY_ISLAND_MAP_ID = 'MAP_FARAWAY_ISLAND_INTERIOR';
const VAR_FARAWAY_STEP_COUNTER = 'VAR_FARAWAY_ISLAND_STEP_COUNTER';

type CardinalDirection = 'up' | 'down' | 'left' | 'right';
type CardinalGbaDirection = typeof DIR.NORTH | typeof DIR.SOUTH | typeof DIR.WEST | typeof DIR.EAST;

const PLAYER_DIRECTIONS_FOR_COPY: Record<number, Record<number, CardinalGbaDirection>> = {
  [DIR.SOUTH]: {
    [DIR.SOUTH]: DIR.NORTH,
    [DIR.NORTH]: DIR.SOUTH,
    [DIR.WEST]: DIR.EAST,
    [DIR.EAST]: DIR.WEST,
  },
  [DIR.NORTH]: {
    [DIR.SOUTH]: DIR.SOUTH,
    [DIR.NORTH]: DIR.NORTH,
    [DIR.WEST]: DIR.WEST,
    [DIR.EAST]: DIR.EAST,
  },
  [DIR.WEST]: {
    [DIR.SOUTH]: DIR.WEST,
    [DIR.NORTH]: DIR.EAST,
    [DIR.WEST]: DIR.NORTH,
    [DIR.EAST]: DIR.SOUTH,
  },
  [DIR.EAST]: {
    [DIR.SOUTH]: DIR.EAST,
    [DIR.NORTH]: DIR.WEST,
    [DIR.WEST]: DIR.SOUTH,
    [DIR.EAST]: DIR.NORTH,
  },
};

const PLAYER_DIRECTION_TO_COPY_DIRECTION: Record<number, Record<number, CardinalGbaDirection>> = {
  // COPY_PLAYER_OPPOSITE
  [DIR.SOUTH]: {
    [DIR.SOUTH]: DIR.NORTH,
    [DIR.NORTH]: DIR.SOUTH,
    [DIR.WEST]: DIR.EAST,
    [DIR.EAST]: DIR.WEST,
  },
  // COPY_PLAYER
  [DIR.NORTH]: {
    [DIR.SOUTH]: DIR.SOUTH,
    [DIR.NORTH]: DIR.NORTH,
    [DIR.WEST]: DIR.WEST,
    [DIR.EAST]: DIR.EAST,
  },
  // COPY_PLAYER_COUNTERCLOCKWISE
  [DIR.WEST]: {
    [DIR.SOUTH]: DIR.EAST,
    [DIR.NORTH]: DIR.WEST,
    [DIR.WEST]: DIR.SOUTH,
    [DIR.EAST]: DIR.NORTH,
  },
  // COPY_PLAYER_CLOCKWISE
  [DIR.EAST]: {
    [DIR.SOUTH]: DIR.WEST,
    [DIR.NORTH]: DIR.EAST,
    [DIR.WEST]: DIR.NORTH,
    [DIR.EAST]: DIR.SOUTH,
  },
};

function getMapIdForNpc(npc: NPCObject): string | null {
  const marker = '_npc_';
  const idx = npc.id.indexOf(marker);
  if (idx <= 0) return null;
  return npc.id.slice(0, idx);
}

function cardinalToGba(direction: CardinalDirection): CardinalGbaDirection {
  if (direction === 'up') return DIR.NORTH;
  if (direction === 'down') return DIR.SOUTH;
  if (direction === 'left') return DIR.WEST;
  return DIR.EAST;
}

function isCopyInGrassType(movementTypeRaw: string): boolean {
  return movementTypeRaw.includes('_IN_GRASS');
}

function getCopyInitDirection(movementTypeRaw: string): CardinalGbaDirection {
  if (movementTypeRaw.includes('COUNTERCLOCKWISE')) return DIR.WEST;
  if (movementTypeRaw.includes('CLOCKWISE')) return DIR.EAST;
  if (movementTypeRaw.includes('OPPOSITE')) return DIR.SOUTH;
  return DIR.NORTH;
}

function getPlayerDirectionForCopy(
  initDir: CardinalGbaDirection,
  moveDir: CardinalGbaDirection
): CardinalGbaDirection | null {
  const row = PLAYER_DIRECTIONS_FOR_COPY[initDir];
  if (!row) return null;
  return row[moveDir] ?? null;
}

function getCopyDirection(
  copyInitDir: CardinalGbaDirection,
  playerInitDir: CardinalGbaDirection,
  playerMoveDir: CardinalGbaDirection
): CardinalGbaDirection | null {
  const playerDirToCopy = getPlayerDirectionForCopy(playerInitDir, playerMoveDir);
  if (!playerDirToCopy) return null;
  const copyRow = PLAYER_DIRECTION_TO_COPY_DIRECTION[copyInitDir];
  if (!copyRow) return null;
  return copyRow[playerDirToCopy] ?? null;
}

function faceDirection(direction: GBADirection, state: NPCMovementState): MovementStepResult {
  setFacingDirection(state, direction);
  state.singleMovementActive = true;
  state.isWalking = false;
  state.walkInPlace = false;
  state.walkProgress = 0;
  state.subTileX = 0;
  state.subTileY = 0;
  return { nextStep: 2, continueImmediately: false };
}

function isPokeGrassAt(
  context: MovementContext,
  tileX: number,
  tileY: number
): boolean {
  const behavior = context.getTileBehaviorAt?.(tileX, tileY);
  if (behavior === undefined) return false;
  return isTallGrassBehavior(behavior) || isLongGrassBehavior(behavior);
}

function executeCopyMovement(
  npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext,
  direction: GBADirection,
  requireGrassDestination: boolean
): MovementStepResult {
  const { dx, dy } = getDirectionDeltas(direction);
  const targetX = npc.tileX + dx;
  const targetY = npc.tileY + dy;

  const blockedByCollision = context.getCollisionInDirection(npc, state, direction) !== 'none';
  const blockedByTile = requireGrassDestination && !isPokeGrassAt(context, targetX, targetY);

  if (blockedByCollision || blockedByTile) {
    return faceDirection(direction, state);
  }

  startWalking(state, direction, npc);
  return { nextStep: 2, continueImmediately: false };
}

function step0(
  _npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  state.singleMovementActive = false;
  state.isWalking = false;
  state.walkInPlace = false;
  state.walkProgress = 0;
  state.subTileX = 0;
  state.subTileY = 0;

  if (state.directionSequenceIndex === 0) {
    const playerDirection = context.getPlayerSnapshot?.()?.direction;
    if (playerDirection !== undefined) {
      state.directionSequenceIndex = playerDirection;
    }
  }

  return { nextStep: 1, continueImmediately: true };
}

function step1(
  npc: NPCObject,
  state: NPCMovementState,
  context: MovementContext
): MovementStepResult {
  const player = context.getPlayerSnapshot?.();
  if (!player || !player.isMoving) {
    return { nextStep: 1, continueImmediately: false };
  }

  const copyInitDirection = getCopyInitDirection(npc.movementTypeRaw);
  const playerInitDirection = (
    (state.directionSequenceIndex as CardinalGbaDirection)
    || (player.direction as CardinalGbaDirection)
  );
  const transformedDirection = getCopyDirection(
    copyInitDirection,
    playerInitDirection,
    player.direction as CardinalGbaDirection
  );
  if (!transformedDirection) {
    return { nextStep: 1, continueImmediately: false };
  }

  let moveDirection = transformedDirection;
  const npcMapId = getMapIdForNpc(npc);
  const isFarawayMew = npcMapId === FARAWAY_ISLAND_MAP_ID && npc.graphicsId === 'OBJ_EVENT_GFX_MEW';

  if (isFarawayMew) {
    const stepCounter = gameVariables.getVar(VAR_FARAWAY_STEP_COUNTER);
    npc.spriteHidden = !shouldFarawayMewBeVisible(stepCounter);

    const mewDirection = getFarawayMewMoveDirection({
      stepCounter,
      playerPrevX: player.tileX,
      playerPrevY: player.tileY,
      playerCurrX: player.destTileX,
      playerCurrY: player.destTileY,
      mewX: npc.tileX,
      mewY: npc.tileY,
      canMoveTo: (x, y) => {
        if (player.destTileX === x && player.destTileY === y) {
          return false;
        }
        return isPokeGrassAt(context, x, y);
      },
    });

    if (mewDirection) {
      moveDirection = cardinalToGba(mewDirection);
    } else {
      return faceDirection(transformedDirection, state);
    }
  }

  return executeCopyMovement(
    npc,
    state,
    context,
    moveDirection,
    isCopyInGrassType(npc.movementTypeRaw)
  );
}

function step2(
  _npc: NPCObject,
  state: NPCMovementState,
  _context: MovementContext
): MovementStepResult {
  if (!state.isWalking) {
    state.singleMovementActive = false;
    return { nextStep: 1, continueImmediately: false };
  }
  return { nextStep: 2, continueImmediately: false };
}

export const copyPlayerHandler: MovementTypeHandler = {
  getInitialDirection(movementTypeRaw: string): GBADirection {
    return getCopyInitDirection(movementTypeRaw);
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
