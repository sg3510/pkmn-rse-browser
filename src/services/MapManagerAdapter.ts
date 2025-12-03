/**
 * MapManagerAdapter - Adapts MapManager to IWorldProvider interface
 *
 * This adapter wraps the Canvas2D-focused MapManager and exposes it through
 * the unified IWorldProvider interface. Unlike WorldManager, MapManager uses
 * a static one-shot loading approach, so the dynamic update features are no-ops.
 */

import { MapManager, type WorldState, type WorldMapInstance, type TilesetResources } from './MapManager';
import type {
  IWorldProvider,
  WorldMapData,
  WorldTilesetData,
  WorldStateSnapshot,
} from './IWorldProvider';
import { computeWorldBounds } from './IWorldProvider';

/** Default depth for BFS map loading */
const DEFAULT_LOAD_DEPTH = 2;

/**
 * Adapter that wraps MapManager to implement IWorldProvider.
 *
 * MapManager uses static loading (all maps loaded upfront via buildWorld),
 * so the update() method is a no-op and onStateChange is not used.
 */
export class MapManagerAdapter implements IWorldProvider {
  private mapManager: MapManager;
  private currentState: WorldStateSnapshot | null = null;
  private loadDepth: number;

  constructor(mapManager: MapManager, loadDepth: number = DEFAULT_LOAD_DEPTH) {
    this.mapManager = mapManager;
    this.loadDepth = loadDepth;
  }

  /**
   * Initialize the world with a starting map.
   * Uses MapManager's buildWorld() for one-shot BFS loading.
   */
  async initialize(startMapId: string): Promise<WorldStateSnapshot> {
    const worldState = await this.mapManager.buildWorld(startMapId, this.loadDepth);
    this.currentState = this.convertWorldState(worldState);
    return this.currentState;
  }

  /**
   * Get current world state snapshot.
   */
  getSnapshot(): WorldStateSnapshot {
    if (!this.currentState) {
      throw new Error('World not initialized. Call initialize() first.');
    }
    return this.currentState;
  }

  /**
   * Find map at world tile position.
   */
  findMapAtPosition(worldTileX: number, worldTileY: number): WorldMapData | null {
    if (!this.currentState) return null;

    for (const map of this.currentState.maps) {
      const localX = worldTileX - map.offsetX;
      const localY = worldTileY - map.offsetY;
      if (
        localX >= 0 &&
        localX < map.entry.width &&
        localY >= 0 &&
        localY < map.entry.height
      ) {
        return map;
      }
    }
    return null;
  }

  /**
   * Get tileset data for a map.
   */
  getTilesetForMap(mapId: string): WorldTilesetData | null {
    if (!this.currentState) return null;

    const index = this.currentState.mapTilesetIndex.get(mapId);
    if (index === undefined) return null;
    return this.currentState.tilesets[index] ?? null;
  }

  /**
   * Update world based on player position.
   *
   * MapManager uses static loading, so this is a no-op.
   * The world is fully loaded during initialize().
   */
  async update(
    _playerTileX: number,
    _playerTileY: number,
    _direction?: 'up' | 'down' | 'left' | 'right' | null
  ): Promise<void> {
    // No-op for static MapManager
  }

  /**
   * Subscribe to state changes.
   *
   * MapManager doesn't emit events, so this just returns an unsubscribe no-op.
   * The state is set once during initialize() and doesn't change dynamically.
   */
  onStateChange(_handler: (snapshot: WorldStateSnapshot) => void): () => void {
    // MapManager is static - no events to subscribe to
    return () => {};
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.currentState = null;
    // MapManager doesn't have a dispose method - it just has caches
  }

  // ==========================================================================
  // Type Conversion Helpers
  // ==========================================================================

  /**
   * Convert WorldState to WorldStateSnapshot.
   */
  private convertWorldState(state: WorldState): WorldStateSnapshot {
    // Build tileset list (deduplicated by tileset key)
    const tilesetMap = new Map<string, WorldTilesetData>();
    const mapTilesetIndex = new Map<string, number>();

    for (const map of state.maps) {
      const tileset = this.convertTileset(map.tilesets);
      if (!tilesetMap.has(tileset.id)) {
        tilesetMap.set(tileset.id, tileset);
      }
    }

    // Convert to array and build index map
    const tilesets = Array.from(tilesetMap.values());
    const tilesetIndexLookup = new Map<string, number>();
    tilesets.forEach((t, i) => tilesetIndexLookup.set(t.id, i));

    // Map each map to its tileset index
    for (const map of state.maps) {
      const pairId = `${map.tilesets.primaryTilesetId}+${map.tilesets.secondaryTilesetId}`;
      const index = tilesetIndexLookup.get(pairId);
      if (index !== undefined) {
        mapTilesetIndex.set(map.entry.id, index);
      }
    }

    // Convert maps
    const maps = state.maps.map((m) => this.convertMap(m));

    // Get anchor border metatiles
    const anchorMap = state.maps.find((m) => m.entry.id === state.anchorId);
    const anchorBorderMetatiles = anchorMap?.borderMetatiles ?? [];

    return {
      anchorMapId: state.anchorId,
      maps,
      tilesets,
      mapTilesetIndex,
      anchorBorderMetatiles,
      bounds: computeWorldBounds(maps),
    };
  }

  /**
   * Convert WorldMapInstance to WorldMapData.
   */
  private convertMap(map: WorldMapInstance): WorldMapData {
    return {
      mapId: map.entry.id,
      entry: map.entry,
      mapData: map.mapData,
      offsetX: map.offsetX,
      offsetY: map.offsetY,
      borderMetatiles: map.borderMetatiles,
      warpEvents: map.warpEvents,
      objectEvents: map.objectEvents,
    };
  }

  /**
   * Convert TilesetResources to WorldTilesetData.
   */
  private convertTileset(tilesets: TilesetResources): WorldTilesetData {
    return {
      id: `${tilesets.primaryTilesetId}+${tilesets.secondaryTilesetId}`,
      primaryTilesetId: tilesets.primaryTilesetId,
      secondaryTilesetId: tilesets.secondaryTilesetId,
      primaryTilesetPath: tilesets.primaryTilesetPath,
      secondaryTilesetPath: tilesets.secondaryTilesetPath,
      primaryMetatiles: tilesets.primaryMetatiles,
      secondaryMetatiles: tilesets.secondaryMetatiles,
      primaryAttributes: tilesets.primaryAttributes,
      secondaryAttributes: tilesets.secondaryAttributes,
      primaryPalettes: tilesets.primaryPalettes,
      secondaryPalettes: tilesets.secondaryPalettes,
    };
  }

  // ==========================================================================
  // Direct Access (for Canvas2D-specific features)
  // ==========================================================================

  /**
   * Get the underlying MapManager for direct access.
   */
  getMapManager(): MapManager {
    return this.mapManager;
  }

  /**
   * Reload world with a new anchor map.
   * Convenience method that re-initializes the world.
   */
  async reload(newAnchorId: string): Promise<WorldStateSnapshot> {
    return this.initialize(newAnchorId);
  }
}

/**
 * Factory function to create a MapManagerAdapter.
 */
export function createMapProvider(
  mapManager: MapManager,
  loadDepth: number = DEFAULT_LOAD_DEPTH
): IWorldProvider {
  return new MapManagerAdapter(mapManager, loadDepth);
}
