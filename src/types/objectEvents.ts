/**
 * Types for object events (NPCs, items, etc.) from map data
 */

/**
 * Raw object event data from map JSON
 */
export interface ObjectEventData {
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
 * Graphics ID for item balls
 */
export const OBJ_EVENT_GFX_ITEM_BALL = 'OBJ_EVENT_GFX_ITEM_BALL';
