/**
 * IWorldProvider - Unified interface for world management
 *
 * This interface abstracts the differences between WorldManager (WebGL) and
 * MapManager (Canvas2D), allowing both renderers to work with any world provider.
 *
 * Design goals:
 * 1. Expose what renderers need without leaking implementation details
 * 2. Support both static (one-shot) and dynamic (incremental) loading
 * 3. Allow GPU-specific features to be optional
 */

import type { MapIndexEntry, WarpEvent } from '../types/maps';
import type { ObjectEventData } from '../types/objectEvents';
import type { MapData, Metatile, MetatileAttributes, Palette } from '../utils/mapLoader';

// =============================================================================
// Core Types (Renderer-Agnostic)
// =============================================================================

/**
 * A map instance positioned in world space.
 * This is the unified type that both WorldManager and MapManager will use.
 */
export interface WorldMapData {
  /** Map ID from mapIndex.json */
  mapId: string;
  /** Map metadata from index */
  entry: MapIndexEntry;
  /** Tile layout data */
  mapData: MapData;
  /** World tile offset X (relative to anchor) */
  offsetX: number;
  /** World tile offset Y (relative to anchor) */
  offsetY: number;
  /** Border metatiles (2x2 repeating) */
  borderMetatiles: number[];
  /** Warp events from map.json */
  warpEvents: WarpEvent[];
  /** Object events (NPCs, items) from map.json */
  objectEvents: ObjectEventData[];
}

/**
 * Tileset resources for rendering.
 * Combined primary + secondary tileset data.
 */
export interface WorldTilesetData {
  /** Unique ID: "primaryId+secondaryId" */
  id: string;
  /** Primary tileset identifier */
  primaryTilesetId: string;
  /** Secondary tileset identifier */
  secondaryTilesetId: string;
  /** Primary tileset path */
  primaryTilesetPath: string;
  /** Secondary tileset path */
  secondaryTilesetPath: string;
  /** Primary metatile definitions */
  primaryMetatiles: Metatile[];
  /** Secondary metatile definitions */
  secondaryMetatiles: Metatile[];
  /** Primary metatile attributes */
  primaryAttributes: MetatileAttributes[];
  /** Secondary metatile attributes */
  secondaryAttributes: MetatileAttributes[];
  /** Primary palettes (6 palettes) */
  primaryPalettes: Palette[];
  /** Secondary palettes (7 palettes) */
  secondaryPalettes: Palette[];
}

/**
 * World bounds in tile coordinates.
 */
export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Computed: maxX - minX */
  width: number;
  /** Computed: maxY - minY */
  height: number;
}

/**
 * Current world state snapshot.
 * This is what renderers receive and use for rendering.
 */
export interface WorldStateSnapshot {
  /** Current anchor map ID */
  anchorMapId: string;
  /** All loaded maps with their world positions */
  maps: WorldMapData[];
  /** All loaded tileset data */
  tilesets: WorldTilesetData[];
  /** Map of mapId -> tileset index in tilesets array */
  mapTilesetIndex: Map<string, number>;
  /** Border metatiles from anchor map (used for out-of-bounds) */
  anchorBorderMetatiles: number[];
  /** World bounds in tiles */
  bounds: WorldBounds;
}

// =============================================================================
// World Provider Interface
// =============================================================================

/**
 * Interface for world management.
 *
 * Implementations:
 * - WorldManager: Dynamic loading, GPU scheduling, re-anchoring
 * - MapManager: Static loading, simple caching
 */
export interface IWorldProvider {
  /**
   * Initialize or reinitialize the world with a starting map.
   * Clears any existing world state.
   *
   * @param startMapId - Map to center the world on
   * @returns Promise resolving to initial world state
   */
  initialize(startMapId: string): Promise<WorldStateSnapshot>;

  /**
   * Get current world state for rendering.
   * This is a snapshot of the current state - implementations may
   * update the world asynchronously between calls.
   */
  getSnapshot(): WorldStateSnapshot;

  /**
   * Find which map contains a world tile position.
   *
   * @param worldTileX - World tile X coordinate
   * @param worldTileY - World tile Y coordinate
   * @returns Map data if found, null if position is outside all maps
   */
  findMapAtPosition(worldTileX: number, worldTileY: number): WorldMapData | null;

  /**
   * Get tileset data for a specific map.
   *
   * @param mapId - Map identifier
   * @returns Tileset data if map is loaded, null otherwise
   */
  getTilesetForMap(mapId: string): WorldTilesetData | null;

  /**
   * Optional: Update world based on player position.
   * Called each frame in dynamic implementations.
   * Static implementations may ignore this.
   *
   * @param playerTileX - Player's current tile X
   * @param playerTileY - Player's current tile Y
   * @param direction - Player's movement direction (for predictive loading)
   */
  update?(
    playerTileX: number,
    playerTileY: number,
    direction?: 'up' | 'down' | 'left' | 'right' | null
  ): Promise<void>;

  /**
   * Optional: Subscribe to world state changes.
   * Used for dynamic implementations that load maps incrementally.
   *
   * @param handler - Callback when world state changes
   * @returns Unsubscribe function
   */
  onStateChange?(handler: (snapshot: WorldStateSnapshot) => void): () => void;

  /**
   * Clean up resources.
   */
  dispose(): void;
}

// =============================================================================
// Helper: Compute world bounds from maps
// =============================================================================

/**
 * Calculate world bounds from a list of maps.
 */
export function computeWorldBounds(maps: WorldMapData[]): WorldBounds {
  if (maps.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const map of maps) {
    minX = Math.min(minX, map.offsetX);
    minY = Math.min(minY, map.offsetY);
    maxX = Math.max(maxX, map.offsetX + map.entry.width);
    maxY = Math.max(maxY, map.offsetY + map.entry.height);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// =============================================================================
// Helper: Get tileset ID from primary + secondary
// =============================================================================

/**
 * Generate consistent tileset pair ID.
 */
export function getTilesetPairId(primaryId: string, secondaryId: string): string {
  return `${primaryId}+${secondaryId}`;
}
