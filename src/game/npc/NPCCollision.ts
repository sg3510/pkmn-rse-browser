/**
 * NPCCollision - Collision detection for NPC movement
 *
 * Implements collision checks from pokeemerald's event_object_movement.c:
 * - GetCollisionInDirection
 * - IsCoordOutsideObjectEventMovementRange
 * - DoesObjectCollideWithObjectAt
 * - IsMetatileDirectionallyImpassable
 */

import type { NPCObject } from '../../types/objectEvents';
import type { NPCMovementState, GBADirection } from './NPCMovementEngine';
import { getDirectionDeltas } from './NPCMovementEngine';
import { areElevationsCompatible as areElevationsCompatibleShared } from '../../utils/elevation';

/**
 * Collision result types matching GBA constants
 */
export type CollisionResult =
  | 'none'           // COLLISION_NONE - can move
  | 'outside_range'  // COLLISION_OUTSIDE_RANGE - exceeds movement bounds
  | 'impassable'     // COLLISION_IMPASSABLE - wall/water/blocked tile
  | 'elevation_mismatch' // COLLISION_ELEVATION_MISMATCH - different elevation
  | 'object_event';  // COLLISION_OBJECT_EVENT - another NPC

/**
 * Context needed for collision checks
 */
export interface CollisionContext {
  /** Check if a tile is walkable (passable metatile) */
  isTileWalkable: (x: number, y: number) => boolean;

  /** Get tile elevation at position */
  getTileElevation: (x: number, y: number) => number;

  /** Check if another NPC is at position */
  hasNPCAt: (x: number, y: number, excludeNpcId: string) => boolean;

  /** Check if player is at position (NPCs shouldn't walk into player) */
  hasPlayerAt?: (x: number, y: number) => boolean;

  /** Check directional impassability (ledges, etc.) */
  isDirectionallyImpassable?: (x: number, y: number, direction: GBADirection) => boolean;
}

/**
 * Check if coordinate is outside NPC's movement range
 *
 * Reference: IsCoordOutsideObjectEventMovementRange in event_object_movement.c:4689
 */
export function isOutsideMovementRange(
  state: NPCMovementState,
  npc: NPCObject,
  targetX: number,
  targetY: number
): boolean {
  // Check X range
  if (npc.movementRangeX !== 0) {
    const left = state.initialTileX - npc.movementRangeX;
    const right = state.initialTileX + npc.movementRangeX;

    if (targetX < left || targetX > right) {
      return true;
    }
  }

  // Check Y range
  if (npc.movementRangeY !== 0) {
    const top = state.initialTileY - npc.movementRangeY;
    const bottom = state.initialTileY + npc.movementRangeY;

    if (targetY < top || targetY > bottom) {
      return true;
    }
  }

  return false;
}

/**
 * Check for collision in a direction
 *
 * Reference: GetCollisionInDirection in event_object_movement.c:4650
 */
export function getCollisionInDirection(
  npc: NPCObject,
  state: NPCMovementState,
  direction: GBADirection,
  context: CollisionContext
): CollisionResult {
  // Calculate target position
  const { dx, dy } = getDirectionDeltas(direction);
  const targetX = npc.tileX + dx;
  const targetY = npc.tileY + dy;

  return getCollisionAtCoords(npc, state, targetX, targetY, direction, context);
}

/**
 * Check for collision at specific coordinates
 *
 * Reference: GetCollisionAtCoords in event_object_movement.c:4658
 */
export function getCollisionAtCoords(
  npc: NPCObject,
  state: NPCMovementState,
  x: number,
  y: number,
  direction: GBADirection,
  context: CollisionContext
): CollisionResult {
  // 1. Check movement range
  if (isOutsideMovementRange(state, npc, x, y)) {
    return 'outside_range';
  }

  // 2. Check tile walkability
  if (!context.isTileWalkable(x, y)) {
    return 'impassable';
  }

  // 3. Check directional impassability (ledges, etc.)
  if (context.isDirectionallyImpassable?.(x, y, direction)) {
    return 'impassable';
  }

  // 4. Check elevation
  const targetElevation = context.getTileElevation(x, y);
  if (!areElevationsCompatible(npc.elevation, targetElevation)) {
    return 'elevation_mismatch';
  }

  // 5. Check for other NPCs
  if (context.hasNPCAt(x, y, npc.id)) {
    return 'object_event';
  }

  // 6. Check for player (NPCs shouldn't walk into the player)
  if (context.hasPlayerAt?.(x, y)) {
    return 'object_event';
  }

  return 'none';
}

/**
 * Check if two elevations are compatible for collision
 *
 * Reference: AreElevationsCompatible in event_object_movement.c:7791
 */
export function areElevationsCompatible(elevation1: number, elevation2: number): boolean {
  return areElevationsCompatibleShared(elevation1, elevation2);
}

function getNPCCollisionTiles(npc: NPCObject): Array<{ x: number; y: number }> {
  const occupied = [{ x: npc.tileX, y: npc.tileY }];
  if (!npc.isWalking || (npc.subTileX === 0 && npc.subTileY === 0)) {
    return occupied;
  }

  const prevX = npc.tileX + Math.sign(npc.subTileX);
  const prevY = npc.tileY + Math.sign(npc.subTileY);
  if (prevX !== npc.tileX || prevY !== npc.tileY) {
    occupied.push({ x: prevX, y: prevY });
  }
  return occupied;
}

/**
 * Create a simple collision context from ObjectEventManager and map data
 */
export function createCollisionContext(
  isTileWalkable: (x: number, y: number) => boolean,
  getTileElevation: (x: number, y: number) => number,
  getAllNPCs: () => NPCObject[],
  isDirectionallyImpassable?: (x: number, y: number, direction: GBADirection) => boolean,
  hasPlayerAt?: (x: number, y: number) => boolean
): CollisionContext {
  return {
    isTileWalkable,
    getTileElevation,
    hasNPCAt: (x: number, y: number, excludeNpcId: string) => {
      const npcs = getAllNPCs();
      for (const npc of npcs) {
        if (npc.id === excludeNpcId) continue;
        if (!npc.visible) continue;
        const occupied = getNPCCollisionTiles(npc);
        for (const tile of occupied) {
          if (tile.x === x && tile.y === y) {
            return true;
          }
        }
      }
      return false;
    },
    hasPlayerAt,
    isDirectionallyImpassable,
  };
}
