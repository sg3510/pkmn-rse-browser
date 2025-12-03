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

// =============================================================================
// WebGL-specific debug types
// =============================================================================

/**
 * Info about a loaded map in the WebGL world
 */
export interface LoadedMapDebugInfo {
  id: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  pairId: string;
  inGpu: boolean;
  borderTileCount: number;
}

/**
 * Info about a map connection
 */
export interface ConnectionDebugInfo {
  from: string;
  direction: string;
  to: string;
  loaded: boolean;
}

/**
 * Info about a tileset boundary (where two tileset pairs meet)
 */
export interface TilesetBoundaryDebugInfo {
  x: number;
  y: number;
  length: number;
  orientation: string;
  pairA: string;
  pairB: string;
}

/**
 * WebGL map stitching debug info - shows world state, GPU slots, loaded maps
 */
export interface MapStitchingDebugInfo {
  currentMap: string | null;
  anchorMap: string;
  loadedMaps: LoadedMapDebugInfo[];
  expectedConnections: ConnectionDebugInfo[];
  tilesetPairs: number;
  playerPos: { x: number; y: number };
  gpuSlot0: string | null;
  gpuSlot1: string | null;
  boundaries: TilesetBoundaryDebugInfo[];
  nearbyBoundaryCount: number;
}

/**
 * WebGL warp/tileset debug info - shows snapshot state after warps
 */
export interface WarpDebugInfo {
  lastWarpTo: string;
  currentAnchor: string;
  snapshotMaps: string[];
  snapshotPairs: string[];
  gpuSlots: Record<string, number>;
  resolverVersion: number;
  worldBounds: { minX: number; minY: number; width: number; height: number };
}

/**
 * WebGL render stats - performance and viewport info
 */
export interface RenderStatsDebugInfo {
  tileCount: number;
  fps: number;
  renderTimeMs: number;
  webgl2Supported: boolean;
  viewportTilesWide: number;
  viewportTilesHigh: number;
  cameraX: number;
  cameraY: number;
  worldWidthPx: number;
  worldHeightPx: number;
  stitchedMapCount: number;
}

/**
 * Shimmer debug info
 */
export interface ShimmerDebugInfo {
  enabled: boolean;
  gbaFrame: number;
  frameInCycle: number;
  scaleX0: number;
  scaleX1: number;
}

/**
 * Comprehensive tile debug info for reflection debugging
 * Shows all data about a tile relevant to reflection rendering
 */
export interface ReflectionTileDebugInfo {
  // Position
  worldX: number;
  worldY: number;
  relativeX: number;  // Relative to player (-2 to +2)
  relativeY: number;

  // Map info
  mapId: string | null;
  isBorder: boolean;

  // Metatile info
  metatileId: number | null;
  isSecondary: boolean;

  // Behavior and collision
  behavior: number | null;
  behaviorName: string;
  elevation: number | null;
  collision: number | null;

  // Reflection info
  isReflective: boolean;
  reflectionType: 'water' | 'ice' | null;
  hasPixelMask: boolean;
  maskPixelCount: number;  // How many pixels in the mask are set

  // Animation info
  isAnimated: boolean;
  animationId: string | null;

  // Runtime lookup
  runtimeFound: boolean;
  runtimeId: string | null;
}

/**
 * Grid of tiles around the player for reflection debugging
 */
export interface ReflectionTileGridDebugInfo {
  playerTileX: number;
  playerTileY: number;
  destTileX: number;
  destTileY: number;
  isMoving: boolean;
  moveDirection: string;

  // 5x5 grid centered on player (±2 in each direction)
  // Indexed as tiles[relY + 2][relX + 2] where rel is -2 to +2
  tiles: ReflectionTileDebugInfo[][];

  // Current reflection state
  currentReflectionState: {
    hasReflection: boolean;
    reflectionType: 'water' | 'ice' | null;
    bridgeType: string;
  };
}

// =============================================================================
// Priority/Sorting debug types
// =============================================================================

/**
 * Debug info for a single sprite's sort key calculation
 */
export interface SpriteSortDebugInfo {
  name: string;           // e.g., "Player", "NPC:PROF_BIRCH", "Grass:tall"
  type: 'player' | 'npc' | 'fieldEffect' | 'door' | 'arrow' | 'reflection';

  // Position info
  tileX: number;
  tileY: number;
  worldY: number;         // Raw world Y position
  feetY: number;          // Calculated feet Y used for sorting

  // Sort key components
  sortKeyY: number;       // Y value fed into calculateSortKey
  subpriority: number;    // Subpriority (0-255)
  sortKey: number;        // Final sort key value

  // Additional info
  renderLayer: string;    // 'withPlayer', 'behindBridge', 'aboveAll', 'bottom', 'top'
  elevation?: number;
  priority?: number;      // GBA priority (0-3)

  // For field effects
  effectType?: string;
  effectFrame?: number;
  effectLayer?: 'front' | 'behind';
  isInFront?: boolean;
  renderBehindPlayer?: boolean;
}

/**
 * Comprehensive priority debug state
 */
export interface PriorityDebugInfo {
  // Player info
  player: {
    tileX: number;
    tileY: number;
    pixelY: number;           // player.y
    feetY: number;            // player.y + 32
    spriteCenter: number;     // player.y + 16 (playerWorldY passed to effects)
    sortKeyY: number;         // Y value used in sortKey
    subpriority: number;
    sortKey: number;
    elevation: number;
  } | null;

  // All sprites in render order (after sorting)
  sortedSprites: SpriteSortDebugInfo[];

  // Field effects breakdown
  fieldEffects: {
    total: number;
    bottom: number;           // Rendering behind player
    top: number;              // Rendering in front of player
    effects: SpriteSortDebugInfo[];
  };

  // NPCs breakdown
  npcs: {
    total: number;
    withPlayer: number;       // Y-sorted with player
    behindBridge: number;     // Low priority (P2/P3)
    aboveAll: number;         // High priority (P0)
    list: SpriteSortDebugInfo[];
  };

  // Sort key comparison helper
  comparison: {
    playerSortKey: number;
    nearbySprites: Array<{
      name: string;
      sortKey: number;
      diff: number;           // sortKey - playerSortKey
      rendersAfterPlayer: boolean;
    }>;
  } | null;
}

/**
 * Combined WebGL debug state
 */
export interface WebGLDebugState {
  mapStitching: MapStitchingDebugInfo | null;
  warp: WarpDebugInfo | null;
  renderStats: RenderStatsDebugInfo | null;
  shimmer?: ShimmerDebugInfo | null;
  reflectionTileGrid?: ReflectionTileGridDebugInfo | null;
  priority?: PriorityDebugInfo | null;
}
