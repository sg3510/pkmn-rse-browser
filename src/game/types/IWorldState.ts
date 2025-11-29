/**
 * Shared World State Interfaces
 *
 * These interfaces define the common contract between different world management
 * implementations (WorldManager for WebGL, MapManager for Canvas2D).
 *
 * Design goals:
 * - Common base interface that both implementations can satisfy
 * - Optional extensions for renderer-specific features (GPU slots, etc.)
 * - Enable future unification in GameContainer
 */

import type { MapIndexEntry, WarpEvent } from '../../types/maps';
import type { MapData } from '../../utils/mapLoader';

// =============================================================================
// World Bounds
// =============================================================================

/**
 * Bounds of the loaded world in tile coordinates
 * Supports negative coordinates for stitched worlds (maps connected left/above anchor)
 */
export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Convenience: maxX - minX */
  width: number;
  /** Convenience: maxY - minY */
  height: number;
}

// =============================================================================
// Loaded Map Instance
// =============================================================================

/**
 * Base interface for a map instance positioned in world space
 * Both WorldManager and MapManager map instances must satisfy this
 */
export interface ILoadedMapInstance {
  /** Map metadata from index */
  entry: MapIndexEntry;
  /** Map layout and tile data */
  mapData: MapData;
  /** World tile offset (can be negative for maps left/above anchor) */
  offsetX: number;
  offsetY: number;
  /** Border metatiles for this map (2x2 repeating pattern) */
  borderMetatiles: number[];
  /** Warp events from map.json */
  warpEvents: WarpEvent[];
}

// =============================================================================
// World State
// =============================================================================

/**
 * Base world state interface
 * Represents the current state of loaded maps that can be used for rendering
 */
export interface IWorldState {
  /** Currently loaded maps */
  maps: ILoadedMapInstance[];
  /** ID of the anchor map (center of the world) */
  anchorMapId: string;
  /** World bounds in tile coordinates */
  worldBounds: WorldBounds;
}

// =============================================================================
// World Provider
// =============================================================================

/**
 * Interface for world management implementations
 * Both WorldManager and MapManager should be adaptable to this interface
 */
export interface IWorldProvider {
  /**
   * Initialize the world at a starting map
   * @param mapId - The map to start at
   * @returns The initial world state
   */
  initialize(mapId: string): Promise<IWorldState>;

  /**
   * Update the world based on player position
   * May trigger loading/unloading of maps
   * @param tileX - Player tile X position
   * @param tileY - Player tile Y position
   * @param direction - Optional facing direction for predictive loading
   */
  update(tileX: number, tileY: number, direction?: string): void;

  /**
   * Get current world state snapshot
   * Used for rendering and game logic
   */
  getSnapshot(): IWorldState;

  /**
   * Get the current anchor map ID
   */
  getAnchorMapId(): string;

  /**
   * Clean up resources
   */
  dispose(): void;
}

// =============================================================================
// WebGL-Specific Extensions
// =============================================================================

/**
 * Extended map instance with WebGL-specific data
 * Used by WorldManager for GPU tileset management
 */
export interface IWebGLMapInstance extends ILoadedMapInstance {
  /** Index into tileset pairs array (for GPU slot lookup) */
  tilesetPairIndex: number;
}

/**
 * Extended world state with WebGL-specific data
 * Used by WorldManager for GPU rendering
 */
export interface IWebGLWorldState extends IWorldState {
  maps: IWebGLMapInstance[];
  /** Maps tileset pair ID to GPU slot (0 or 1) */
  pairIdToGpuSlot: Map<string, 0 | 1>;
  /** Border metatiles from the anchor map (used for all out-of-bounds tiles) */
  anchorBorderMetatiles: number[];
}

/**
 * Extended world provider with WebGL-specific features
 */
export interface IWebGLWorldProvider extends IWorldProvider {
  getSnapshot(): IWebGLWorldState;

  /**
   * Subscribe to world events (maps changed, tilesets changed, reanchored, etc.)
   */
  subscribe(handler: (event: unknown) => void): () => void;

  /**
   * Get debug info for the debug panel
   */
  getDebugInfo(playerX: number, playerY: number): unknown;
}

// =============================================================================
// Canvas2D-Specific Extensions (if needed)
// =============================================================================

/**
 * Extended map instance with Canvas2D-specific data
 * Used by MapManager - includes embedded tileset resources
 */
export interface ICanvas2DMapInstance extends ILoadedMapInstance {
  /** Embedded tileset resources (Canvas2D doesn't have GPU slot limits) */
  tilesets: {
    primaryMetatiles: unknown[];
    secondaryMetatiles: unknown[];
    primaryPalettes: unknown[];
    secondaryPalettes: unknown[];
    primaryAttributes: unknown[];
    secondaryAttributes: unknown[];
  };
  /** Object events (NPCs, items) */
  objectEvents: unknown[];
}
