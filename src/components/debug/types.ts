/**
 * Debug Panel Types
 */

import type { NPCObject, ItemBallObject } from '../../types/objectEvents';
import type { DebugTileInfo } from '../map/types';

// Re-export for convenience
export type { DebugTileInfo };

/**
 * Debug options that can be toggled
 */
export interface DebugOptions {
  enabled: boolean;
  showTileGrid: boolean;
  showCollisionOverlay: boolean;
  showElevationOverlay: boolean;
  showObjectOverlay: boolean;
  showPlayerHitbox: boolean;
  logObjectEvents: boolean;
}

export const DEFAULT_DEBUG_OPTIONS: DebugOptions = {
  enabled: false,
  showTileGrid: false,
  showCollisionOverlay: false,
  showElevationOverlay: false,
  showObjectOverlay: false,
  showPlayerHitbox: false,
  logObjectEvents: false,
};

/**
 * Info about an object at the inspected/player tile
 */
export interface ObjectDebugInfo {
  type: 'npc' | 'item';
  npc?: NPCObject;
  item?: ItemBallObject;
}

/**
 * Debug info about the current player state and tile
 */
export interface PlayerDebugInfo {
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  direction: string;
  elevation: number;
  isMoving: boolean;
  isSurfing: boolean;
  mapId: string;
}

/**
 * Debug info about a specific tile
 */
export interface TileDebugInfo {
  worldX: number;
  worldY: number;
  localX: number;
  localY: number;
  mapId: string;
  mapName: string;
  metatileId: number;
  behavior: number;
  elevation: number;
  collision: number;
  isPassable: boolean;
  layerType: number;
  isSecondary: boolean;
}

/**
 * Debug info about objects at a tile
 */
export interface ObjectsAtTileInfo {
  tileX: number;
  tileY: number;
  npcs: NPCObject[];
  items: ItemBallObject[];
  hasCollision: boolean;
}

/**
 * Objects at all adjacent tiles (for interaction debugging)
 */
export interface AdjacentObjectsInfo {
  north: ObjectsAtTileInfo | null;
  south: ObjectsAtTileInfo | null;
  east: ObjectsAtTileInfo | null;
  west: ObjectsAtTileInfo | null;
}

/**
 * Full debug state passed to the panel
 */
export interface DebugState {
  player: PlayerDebugInfo | null;
  tile: TileDebugInfo | null;
  objectsAtPlayerTile: ObjectsAtTileInfo | null;
  objectsAtFacingTile: ObjectsAtTileInfo | null;
  adjacentObjects: AdjacentObjectsInfo | null;
  allVisibleNPCs: NPCObject[];
  allVisibleItems: ItemBallObject[];
  totalNPCCount: number;
  totalItemCount: number;
}
