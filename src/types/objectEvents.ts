/**
 * Types for object events (NPCs, items, etc.) from map data
 */

import { getSpriteInfo } from '../data/spriteMetadata.ts';

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
 * Processed scripted object for interaction (e.g. Birch's bag).
 */
export interface ScriptObject {
  /** Unique ID for lookups */
  id: string;
  /** Owning map ID */
  mapId: string;
  /** Local ID within map data, if any */
  localId: string | null;
  /** Numeric local ID (for VAR_LAST_TALKED parity), if available */
  localIdNumber: number | null;
  /** World tile X coordinate */
  tileX: number;
  /** World tile Y coordinate */
  tileY: number;
  /** Elevation level (for layering/collision checks) */
  elevation: number;
  /** Graphics ID from map data */
  graphicsId: string;
  /** Script identifier to execute */
  script: string;
  /** Visibility flag from map data */
  flag: string;
  /** Whether object is visible */
  visible: boolean;
  /** Berry tree ID from trainer_sight_or_berry_tree_id (0 for non-berry script objects) */
  berryTreeId: number;
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
  | 'walk_back_and_forth'
  | 'face_up'
  | 'face_down'
  | 'face_left'
  | 'face_right'
  | 'face_down_and_up'
  | 'face_left_and_right'
  | 'face_up_and_left'
  | 'face_up_and_right'
  | 'face_down_and_left'
  | 'face_down_and_right'
  | 'face_down_up_and_left'
  | 'face_down_up_and_right'
  | 'face_up_left_and_right'
  | 'face_down_left_and_right'
  | 'walk_in_place'
  | 'walk_sequence'
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
  /** Numeric local ID (1 + object template index) used by native saves/scripts */
  localIdNumber: number;
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
  /** Raw movement type string from map data (for initial direction lookup) */
  movementTypeRaw: string;
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
  /** Whether the sprite is hidden (MOVEMENT_TYPE_INVISIBLE). NPC still blocks tile and responds to interaction. */
  spriteHidden: boolean;
  /** Whether this NPC was removed at runtime by a script (removeobject/addobject).
   *  Prevents refreshNPCVisibility from overriding the script's visibility change. */
  scriptRemoved: boolean;
  /**
   * Script-controlled render priority flag (e.g. Faraway Island Mew emerging from grass).
   * When enabled, sprite should render above grass overlays and skip long-grass body clipping.
   */
  renderAboveGrass: boolean;
  /** Runtime tint override for palette-like scripted effects (0..1, defaults to 1). */
  tintR?: number;
  tintG?: number;
  tintB?: number;

  // Movement state fields (updated by NPCMovementEngine)

  /** Sub-tile X offset for smooth movement (0-15 pixels) */
  subTileX: number;
  /** Sub-tile Y offset for smooth movement (0-15 pixels) */
  subTileY: number;
  /** Whether NPC is currently walking between tiles */
  isWalking: boolean;
  /** Initial spawn X position (for movement range checking) */
  initialTileX: number;
  /** Initial spawn Y position (for movement range checking) */
  initialTileY: number;

  // Jump animation state (updated by script movement)

  /** Y pixel offset for jump arc (negative = up). Default 0. */
  spriteYOffset?: number;
  /** Render shadow sprite during jumps */
  showShadow?: boolean;
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
 * Graphics ID for the truck
 */
export const OBJ_EVENT_GFX_TRUCK = 'OBJ_EVENT_GFX_TRUCK';

/**
 * Exhaustive list of large-footprint object-event graphics IDs supported by
 * the renderer/object manager pipeline.
 *
 * Note: entries with a map `local_id` are routed through NPC-style storage so
 * LOCALID script commands can target them.
 */
export const LARGE_OBJECT_GRAPHICS_IDS = [
  'OBJ_EVENT_GFX_TRUCK',
  'OBJ_EVENT_GFX_MR_BRINEYS_BOAT',
  'OBJ_EVENT_GFX_SS_TIDAL',
  'OBJ_EVENT_GFX_SUBMARINE_SHADOW',
  'OBJ_EVENT_GFX_CABLE_CAR',
] as const;

export type LargeObjectGraphicsId = (typeof LARGE_OBJECT_GRAPHICS_IDS)[number];

const LARGE_OBJECT_GRAPHICS_ID_SET: ReadonlySet<string> = new Set(LARGE_OBJECT_GRAPHICS_IDS);

export function isLargeObjectGraphicsId(graphicsId: string): graphicsId is LargeObjectGraphicsId {
  return LARGE_OBJECT_GRAPHICS_ID_SET.has(graphicsId);
}

/**
 * Large (non-NPC) rendered object like the moving truck
 */
export interface LargeObject {
  id: string;
  tileX: number;
  tileY: number;
  elevation: number;
  graphicsId: LargeObjectGraphicsId;
  flag: string;
  visible: boolean;
}

/**
 * Runtime snapshot payload for object event state.
 * Used to preserve script-driven temporary object positions/visibility across saves.
 */
export interface ObjectEventRuntimeState {
  version: 1;
  /** Coordinate system used by npc tile fields. */
  coordSpace?: 'world' | 'mapLocal';
  npcs: Record<string, {
    tileX: number;
    tileY: number;
    initialTileX: number;
    initialTileY: number;
    direction: NPCDirection;
    visible: boolean;
    spriteHidden: boolean;
    scriptRemoved: boolean;
    renderAboveGrass: boolean;
    /** Optional for native .sav imports, which may only provide numeric movement IDs. */
    movementTypeRaw?: string;
  }>;
  itemBalls: Record<string, {
    collected: boolean;
  }>;
  scriptObjects: Record<string, {
    visible: boolean;
  }>;
  largeObjects: Record<string, {
    visible: boolean;
  }>;
  offscreenDespawnedNpcIds: string[];
  offscreenDespawnedItemIds: string[];
  offscreenDespawnedScriptObjectIds: string[];
  offscreenDespawnedLargeObjectIds: string[];
}

/**
 * Check if a graphics ID represents an NPC (person/character)
 * using canonical sprite metadata plus explicit overrides.
 */
const NPC_GRAPHICS_OVERRIDES = new Set<string>([
  // Birth Island puzzle rock is scripted like an object event/NPC in this runtime.
  'OBJ_EVENT_GFX_DEOXYS_TRIANGLE',
  'OBJ_EVENT_GFX_BIRTH_ISLAND_STONE',
]);

const NON_NPC_GRAPHICS_FALLBACKS = new Set<string>([
  OBJ_EVENT_GFX_ITEM_BALL,
  'OBJ_EVENT_GFX_BERRY_TREE',
  'OBJ_EVENT_GFX_CUTTABLE_TREE',
  'OBJ_EVENT_GFX_BREAKABLE_ROCK',
  'OBJ_EVENT_GFX_PUSHABLE_BOULDER',
  'OBJ_EVENT_GFX_TRUCK',
  'OBJ_EVENT_GFX_SS_TIDAL',
  'OBJ_EVENT_GFX_SUBMARINE_SHADOW',
  'OBJ_EVENT_GFX_CABLE_CAR',
  'OBJ_EVENT_GFX_BIRCHS_BAG',
]);

export function isNPCGraphicsId(graphicsId: string): boolean {
  if (!graphicsId.startsWith('OBJ_EVENT_GFX_')) return false;
  if (NPC_GRAPHICS_OVERRIDES.has(graphicsId)) return true;
  if (NON_NPC_GRAPHICS_FALLBACKS.has(graphicsId)) return false;

  const spriteInfo = getSpriteInfo(graphicsId);
  if (spriteInfo) {
    return !spriteInfo.inanimate;
  }

  // Keep unknown IDs interactable/scriptable by default.
  return true;
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
    case 'MOVEMENT_TYPE_WALK_LEFT_AND_RIGHT':
    case 'MOVEMENT_TYPE_WALK_RIGHT_AND_LEFT':
    case 'MOVEMENT_TYPE_WALK_UP_AND_DOWN':
    case 'MOVEMENT_TYPE_WALK_DOWN_AND_UP':
      return 'walk_back_and_forth';
    case 'MOVEMENT_TYPE_FACE_UP':
      return 'face_up';
    case 'MOVEMENT_TYPE_FACE_DOWN':
      return 'face_down';
    case 'MOVEMENT_TYPE_FACE_LEFT':
      return 'face_left';
    case 'MOVEMENT_TYPE_FACE_RIGHT':
      return 'face_right';
    // 2-direction face types
    case 'MOVEMENT_TYPE_FACE_DOWN_AND_UP':
      return 'face_down_and_up';
    case 'MOVEMENT_TYPE_FACE_LEFT_AND_RIGHT':
      return 'face_left_and_right';
    case 'MOVEMENT_TYPE_FACE_UP_AND_LEFT':
      return 'face_up_and_left';
    case 'MOVEMENT_TYPE_FACE_UP_AND_RIGHT':
      return 'face_up_and_right';
    case 'MOVEMENT_TYPE_FACE_DOWN_AND_LEFT':
      return 'face_down_and_left';
    case 'MOVEMENT_TYPE_FACE_DOWN_AND_RIGHT':
      return 'face_down_and_right';
    // 3-direction face types
    case 'MOVEMENT_TYPE_FACE_DOWN_UP_AND_LEFT':
      return 'face_down_up_and_left';
    case 'MOVEMENT_TYPE_FACE_DOWN_UP_AND_RIGHT':
      return 'face_down_up_and_right';
    case 'MOVEMENT_TYPE_FACE_UP_LEFT_AND_RIGHT':
      return 'face_up_left_and_right';
    case 'MOVEMENT_TYPE_FACE_DOWN_LEFT_AND_RIGHT':
      return 'face_down_left_and_right';
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_DOWN':
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_UP':
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_LEFT':
    case 'MOVEMENT_TYPE_WALK_IN_PLACE_RIGHT':
    // C parity: Route 101 Birch/Zigzagoon use JOG_IN_PLACE_* (same handler family).
    // Reference: public/pokeemerald/data/maps/Route101/map.json
    case 'MOVEMENT_TYPE_JOG_IN_PLACE_DOWN':
    case 'MOVEMENT_TYPE_JOG_IN_PLACE_UP':
    case 'MOVEMENT_TYPE_JOG_IN_PLACE_LEFT':
    case 'MOVEMENT_TYPE_JOG_IN_PLACE_RIGHT':
    case 'MOVEMENT_TYPE_RUN_IN_PLACE_DOWN':
    case 'MOVEMENT_TYPE_RUN_IN_PLACE_UP':
    case 'MOVEMENT_TYPE_RUN_IN_PLACE_LEFT':
    case 'MOVEMENT_TYPE_RUN_IN_PLACE_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_DOWN':
    case 'MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_UP':
    case 'MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_LEFT':
    case 'MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_RIGHT':
      return 'walk_in_place';
    // Walk sequence types (24 variants) - NPC walks a 4-direction cycle
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_UP_RIGHT_LEFT_DOWN':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_LEFT_DOWN_UP':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_DOWN_UP_RIGHT_LEFT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_DOWN_UP_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_UP_LEFT_RIGHT_DOWN':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_RIGHT_DOWN_UP':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_DOWN_UP_LEFT_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_DOWN_UP_LEFT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_UP_DOWN_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_UP_DOWN_RIGHT_LEFT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_LEFT_UP_DOWN':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_DOWN_RIGHT_LEFT_UP':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_UP_DOWN_LEFT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_UP_DOWN_LEFT_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_RIGHT_UP_DOWN':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_DOWN_LEFT_RIGHT_UP':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_UP_LEFT_DOWN_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_DOWN_RIGHT_UP_LEFT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_DOWN_RIGHT_UP':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_UP_LEFT_DOWN':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_UP_RIGHT_DOWN_LEFT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_DOWN_LEFT_UP_RIGHT':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_UP_RIGHT_DOWN':
    case 'MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_DOWN_LEFT_UP':
      return 'walk_sequence';
    case 'MOVEMENT_TYPE_INVISIBLE':
      return 'invisible';
    case 'MOVEMENT_TYPE_COPY_PLAYER':
    case 'MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE':
    case 'MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE_IN_GRASS':
    case 'MOVEMENT_TYPE_COPY_PLAYER_COUNTERCLOCKWISE':
    case 'MOVEMENT_TYPE_COPY_PLAYER_CLOCKWISE':
      return 'copy_player';
    default:
      return 'other';
  }
}

/**
 * Get initial facing direction from movement type
 *
 * Reference: gInitialMovementTypeFacingDirections in
 * public/pokeemerald/src/event_object_movement.c:350-430
 *
 * The initial direction is the FIRST direction in the movement type name.
 * E.g., WALK_DOWN_AND_UP starts facing DOWN, WALK_UP_AND_DOWN starts facing UP.
 */
export function getInitialDirection(movementType: string): NPCDirection {
  // Explicit FACE_* types have highest priority
  if (movementType.includes('FACE_UP') && !movementType.includes('FACE_DOWN')) return 'up';
  if (movementType.includes('FACE_DOWN')) return 'down';
  if (movementType.includes('FACE_LEFT') && !movementType.includes('FACE_RIGHT')) return 'left';
  if (movementType.includes('FACE_RIGHT')) return 'right';

  // For WALK/WANDER types, extract the FIRST direction after the action word
  // WALK_DOWN_AND_UP -> down, WALK_UP_AND_DOWN -> up, etc.
  const walkMatch = movementType.match(/(?:WALK|WANDER|SEQUENCE)_(\w+?)(?:_AND|_|$)/);
  if (walkMatch) {
    const firstDir = walkMatch[1].toUpperCase();
    if (firstDir === 'UP' || firstDir === 'NORTH') return 'up';
    if (firstDir === 'DOWN' || firstDir === 'SOUTH') return 'down';
    if (firstDir === 'LEFT' || firstDir === 'WEST') return 'left';
    if (firstDir === 'RIGHT' || firstDir === 'EAST') return 'right';
  }

  // For IN_PLACE types, check which direction
  if (movementType.includes('IN_PLACE_UP')) return 'up';
  if (movementType.includes('IN_PLACE_DOWN')) return 'down';
  if (movementType.includes('IN_PLACE_LEFT')) return 'left';
  if (movementType.includes('IN_PLACE_RIGHT')) return 'right';

  // Default to down (south) - matches GBA default
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
