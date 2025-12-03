/**
 * WorldManagerAdapter - Adapts WorldManager to IWorldProvider interface
 *
 * This adapter wraps the WebGL-focused WorldManager and exposes it through
 * the unified IWorldProvider interface. It handles type conversion between
 * WorldManager's GPU-oriented types and the renderer-agnostic IWorldProvider types.
 */

import { WorldManager, type WorldSnapshot, type TilesetPairInfo, type LoadedMapInstance } from '../game/WorldManager';
import type {
  IWorldProvider,
  WorldMapData,
  WorldTilesetData,
  WorldStateSnapshot,
} from './IWorldProvider';

/**
 * Adapter that wraps WorldManager to implement IWorldProvider.
 */
export class WorldManagerAdapter implements IWorldProvider {
  private worldManager: WorldManager;
  private stateChangeHandlers: Set<(snapshot: WorldStateSnapshot) => void> = new Set();

  constructor(worldManager: WorldManager) {
    this.worldManager = worldManager;

    // Subscribe to WorldManager events and forward to handlers
    this.worldManager.on((event) => {
      if (event.type === 'mapsChanged') {
        const snapshot = this.convertSnapshot(event.snapshot);
        for (const handler of this.stateChangeHandlers) {
          handler(snapshot);
        }
      }
    });
  }

  /**
   * Initialize the world with a starting map.
   */
  async initialize(startMapId: string): Promise<WorldStateSnapshot> {
    const wmSnapshot = await this.worldManager.initialize(startMapId);
    return this.convertSnapshot(wmSnapshot);
  }

  /**
   * Get current world state snapshot.
   */
  getSnapshot(): WorldStateSnapshot {
    return this.convertSnapshot(this.worldManager.getSnapshot());
  }

  /**
   * Find map at world tile position.
   */
  findMapAtPosition(worldTileX: number, worldTileY: number): WorldMapData | null {
    const map = this.worldManager.findMapAtPosition(worldTileX, worldTileY);
    return map ? this.convertMap(map) : null;
  }

  /**
   * Get tileset data for a map.
   */
  getTilesetForMap(mapId: string): WorldTilesetData | null {
    const pair = this.worldManager.getTilesetPairForMap(mapId);
    return pair ? this.convertTileset(pair) : null;
  }

  /**
   * Update world based on player position.
   */
  async update(
    playerTileX: number,
    playerTileY: number,
    direction?: 'up' | 'down' | 'left' | 'right' | null
  ): Promise<void> {
    await this.worldManager.update(playerTileX, playerTileY, direction ?? null);
  }

  /**
   * Subscribe to state changes.
   */
  onStateChange(handler: (snapshot: WorldStateSnapshot) => void): () => void {
    this.stateChangeHandlers.add(handler);
    return () => {
      this.stateChangeHandlers.delete(handler);
    };
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.stateChangeHandlers.clear();
    this.worldManager.dispose();
  }

  // ==========================================================================
  // Type Conversion Helpers
  // ==========================================================================

  /**
   * Convert WorldSnapshot to WorldStateSnapshot.
   */
  private convertSnapshot(wmSnapshot: WorldSnapshot): WorldStateSnapshot {
    const maps = wmSnapshot.maps.map((m) => this.convertMap(m));
    const tilesets = wmSnapshot.tilesetPairs.map((p) => this.convertTileset(p));

    // Build map -> tileset index map
    const mapTilesetIndex = new Map<string, number>();
    for (const [mapId, pairIndex] of wmSnapshot.mapTilesetPairIndex) {
      mapTilesetIndex.set(mapId, pairIndex);
    }

    return {
      anchorMapId: wmSnapshot.anchorMapId,
      maps,
      tilesets,
      mapTilesetIndex,
      anchorBorderMetatiles: wmSnapshot.anchorBorderMetatiles,
      bounds: {
        minX: wmSnapshot.worldBounds.minX,
        minY: wmSnapshot.worldBounds.minY,
        maxX: wmSnapshot.worldBounds.maxX,
        maxY: wmSnapshot.worldBounds.maxY,
        width: wmSnapshot.worldBounds.width,
        height: wmSnapshot.worldBounds.height,
      },
    };
  }

  /**
   * Convert LoadedMapInstance to WorldMapData.
   */
  private convertMap(map: LoadedMapInstance): WorldMapData {
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
   * Convert TilesetPairInfo to WorldTilesetData.
   *
   * Note: TilesetPairInfo has GPU-specific data (indexed PNG) that we don't
   * include in WorldTilesetData. Renderers that need GPU data should access
   * the underlying WorldManager directly or use WebGL-specific interfaces.
   */
  private convertTileset(pair: TilesetPairInfo): WorldTilesetData {
    return {
      id: pair.id,
      primaryTilesetId: pair.primaryTilesetId,
      secondaryTilesetId: pair.secondaryTilesetId,
      primaryTilesetPath: pair.primaryTilesetPath,
      secondaryTilesetPath: pair.secondaryTilesetPath,
      primaryMetatiles: pair.primaryMetatiles,
      secondaryMetatiles: pair.secondaryMetatiles,
      primaryAttributes: pair.primaryAttributes,
      secondaryAttributes: pair.secondaryAttributes,
      primaryPalettes: pair.primaryPalettes,
      secondaryPalettes: pair.secondaryPalettes,
    };
  }

  // ==========================================================================
  // Direct Access (for WebGL-specific features)
  // ==========================================================================

  /**
   * Get the underlying WorldManager for WebGL-specific operations.
   * Use this for GPU scheduling, animations, and other WebGL-only features.
   */
  getWorldManager(): WorldManager {
    return this.worldManager;
  }

  /**
   * Get the original WorldSnapshot with GPU slot information.
   * Use this when you need pairIdToGpuSlot or other GPU-specific data.
   */
  getWorldSnapshot(): WorldSnapshot {
    return this.worldManager.getSnapshot();
  }
}

/**
 * Factory function to create a WorldManagerAdapter.
 */
export function createWorldProvider(worldManager: WorldManager): IWorldProvider {
  return new WorldManagerAdapter(worldManager);
}
