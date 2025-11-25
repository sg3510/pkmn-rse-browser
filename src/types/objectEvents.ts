/**
 * Types for object events (NPCs, items, etc.) from map data
 */

/**
 * Raw object event data from map JSON
 */
export interface ObjectEventData {
  local_id?: string;
  graphics_id: string;
  x: number;
  y: number;
  elevation: number;
  movement_type: string;
  movement_range_x: number;
  movement_range_y: number;
  trainer_type: string;
  trainer_sight_or_berry_tree_id: string;
  script: string;
  flag: string;
}

/**
 * Processed item ball object for rendering and interaction
 */
export interface ItemBallObject {
  /** Unique ID for React keys and lookups */
  id: string;
  /** World tile X coordinate */
  tileX: number;
  /** World tile Y coordinate */
  tileY: number;
  /** Elevation level (for layering) */
  elevation: number;
  /** Resolved item ID */
  itemId: number;
  /** Human-readable item name */
  itemName: string;
  /** Flag to check/set when collected */
  flag: string;
  /** Original script name */
  script: string;
  /** Whether this item has been collected (derived from flag state) */
  collected: boolean;
}

/**
 * Direction an NPC can face
 */
export type NPCDirection = 'down' | 'up' | 'left' | 'right';

/**
 * NPC movement behavior types
 * Maps to MOVEMENT_TYPE_* constants from the game
 */
export type NPCMovementType =
  | 'none'
  | 'look_around'
  | 'wander_around'
  | 'wander_up_and_down'
  | 'wander_left_and_right'
  | 'face_up'
  | 'face_down'
  | 'face_left'
  | 'face_right'
  | 'walk_in_place'
  | 'invisible'
  | 'copy_player'
  | 'other';

/**
 * NPC trainer types
 */
export type NPCTrainerType = 'none' | 'normal' | 'see_all_directions' | 'buried';

/**
 * Processed NPC object for rendering and interaction
 */
export interface NPCObject {
  /** Unique ID for React keys and lookups */
  id: string;
  /** Local ID within the map (for scripting) */
  localId: string | null;
  /** World tile X coordinate */
  tileX: number;
  /** World tile Y coordinate */
  tileY: number;
  /** Elevation level (for layering) */
  elevation: number;
  /** Graphics ID for sprite lookup */
  graphicsId: string;
  /** Current facing direction */
  direction: NPCDirection;
  /** Movement behavior type */
  movementType: NPCMovementType;
  /** Movement range X (tiles) */
  movementRangeX: number;
  /** Movement range Y (tiles) */
  movementRangeY: number;
  /** Trainer type (for battle triggers) */
  trainerType: NPCTrainerType;
  /** Trainer sight range or berry tree ID */
  trainerSightRange: number;
  /** Script to execute on interaction */
  script: string;
  /** Flag controlling visibility (if set, NPC is hidden) */
  flag: string;
  /** Whether this NPC is currently visible (derived from flag state) */
  visible: boolean;
}

/**
 * NPC sprite frame layout
 * Standard NPC sprites are 144x32 (9 frames of 16x32)
 * Frame indices:
 *   0: Face down (south)
 *   1: Face up (north)
 *   2: Face left (west) - also flipped for right
 *   3: Walk down frame 1
 *   4: Walk up frame 1
 *   5: Walk left frame 1
 *   6: Walk left frame 2
 *   7: (unused or walk down frame 2 for some sprites)
 *   8: (unused or special)
 */
export const NPC_FRAME = {
  FACE_DOWN: 0,
  FACE_UP: 1,
  FACE_LEFT: 2,
  FACE_RIGHT: 2, // Same as left, but horizontally flipped
  WALK_DOWN_1: 3,
  WALK_UP_1: 4,
  WALK_LEFT_1: 5,
  WALK_LEFT_2: 6,
} as const;

/**
 * Standard NPC sprite dimensions
 */
export const NPC_SPRITE = {
  FRAME_WIDTH: 16,
  FRAME_HEIGHT: 32,
  FRAMES_PER_ROW: 9,
} as const;

/**
 * Graphics ID for item balls
 */
export const OBJ_EVENT_GFX_ITEM_BALL = 'OBJ_EVENT_GFX_ITEM_BALL';

/**
 * Check if a graphics ID represents an NPC (person/character)
 * Excludes items, misc objects, berry trees, etc.
 */
export function isNPCGraphicsId(graphicsId: string): boolean {
  // Exclude known non-NPC types
  if (graphicsId === OBJ_EVENT_GFX_ITEM_BALL) return false;
  if (graphicsId.includes('BERRY_TREE')) return false;
  if (graphicsId.includes('BREAKABLE_ROCK')) return false;
  if (graphicsId.includes('CUTTABLE_TREE')) return false;
  if (graphicsId.includes('PUSHABLE_BOULDER')) return false;
  if (graphicsId.includes('FOSSIL')) return false;
  if (graphicsId.includes('TRUCK')) return false;
  if (graphicsId.includes('SS_TIDAL')) return false;
  if (graphicsId.includes('CABLE_CAR')) return false;
  if (graphicsId.includes('BOAT')) return false;
  if (graphicsId.includes('SUBMARINE')) return false;
  if (graphicsId.includes('DOLL')) return false;
  if (graphicsId.includes('CUSHION')) return false;
  if (graphicsId.includes('STATUE')) return false;
  if (graphicsId.includes('BAG')) return false; // Birch's bag
  if (graphicsId.includes('STONE')) return false; // Birth island stone
  if (graphicsId.includes('MOVING_BOX')) return false;

  // Include all OBJ_EVENT_GFX_* that look like people
  return graphicsId.startsWith('OBJ_EVENT_GFX_');
}

/**
 * Parse movement type string to enum
 */
export function parseMovementType(movementType: string): NPCMovementType {
  switch (movementType) {
    case 'MOVEMENT_TYPE_NONE':
      return 'none';
    case 'MOVEMENT_TYPE_LOOK_AROUND':
      return 'look_around';
    case 'MOVEMENT_TYPE_WANDER_AROUND':
      return 'wander_around';
    case 'MOVEMENT_TYPE_WANDER_UP_AND_DOWN':
      return 'wander_up_and_down';
    case 'MOVEMENT_TYPE_WANDER_DOWN_AND_UP':
      return 'wander_up_and_down';
    case 'MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT':
      return 'wander_left_and_right';
    case 'MOVEMENT_TYPE_WANDER_RIGHT_AND_LEFT':
      return 'wander_left_and_right';
    case 'MOVEMENT_TYPE_FACE_UP':
      return 'face_up';
    case 'MOVEMENT_TYPE_FACE_DOWN':
      return 'face_down';
    case 'MOVEMENT_TYPE_FACE_LEFT':
      return 'face_left';
    case 'MOVEMENT_TYPE_FACE_RIGHT':
      return 'face_right';
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_DOWN':
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_UP':
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_LEFT':
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_RIGHT':
      return 'walk_in_place';
    case 'MOVEMENT_TYPE_INVISIBLE':
      return 'invisible';
    case 'MOVEMENT_TYPE_COPY_PLAYER':
    case 'MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE':
    case 'MOVEMENT_TYPE_COPY_PLAYER_COUNTERCLOCKWISE':
    case 'MOVEMENT_TYPE_COPY_PLAYER_CLOCKWISE':
      return 'copy_player';
    default:
      return 'other';
  }
}

/**
 * Get initial facing direction from movement type
 */
export function getInitialDirection(movementType: string): NPCDirection {
  if (movementType.includes('FACE_UP') || movementType.includes('_UP')) return 'up';
  if (movementType.includes('FACE_LEFT') || movementType.includes('_LEFT')) return 'left';
  if (movementType.includes('FACE_RIGHT') || movementType.includes('_RIGHT')) return 'right';
  // Default to down (south)
  return 'down';
}

/**
 * Parse trainer type string to enum
 */
export function parseTrainerType(trainerType: string): NPCTrainerType {
  switch (trainerType) {
    case 'TRAINER_TYPE_NORMAL':
      return 'normal';
    case 'TRAINER_TYPE_SEE_ALL_DIRECTIONS':
      return 'see_all_directions';
    case 'TRAINER_TYPE_BURIED':
      return 'buried';
    default:
      return 'none';
  }
}
