/**
 * WorldManager - Dynamic infinite world management
 *
 * Manages the seamless loading and unloading of connected maps as the player
 * moves through the world. Handles:
 * - Dynamic map loading based on player position
 * - Map unloading when too far from player
 * - Anchor tracking for border metatile resolution
 * - Tileset pair management (max 2 pairs for GPU)
 *
 * The world tracks an "anchor" map (the player's current map) for border
 * metatile resolution. No coordinate shifting is needed — tile coordinates
 * stay small enough for full precision across the entire game world.
 */

import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry, WarpEvent } from '../types/maps';
import type { ObjectEventData } from '../types/objectEvents';
import {
  loadMapEvents,
  type ScriptCoordEvent,
  type WeatherCoordEvent,
  type BgEvent,
} from './mapEventLoader';
import {
  loadMapLayout,
  loadTilesetImage,
  loadText,
  parsePalette,
  loadMetatileDefinitions,
  loadMetatileAttributes,
  loadBorderMetatiles,
  type Palette,
  type TilesetImageData,
  type Metatile,
  type MapData,
  type MetatileAttributes,
} from '../utils/mapLoader';
import { createLogger } from '../utils/logger';
import { isDebugMode } from '../utils/debug';
import type { LoadedAnimation } from '../rendering/types';
import { TilesetPairScheduler } from './TilesetPairScheduler';
import { loadTilesetAnimations } from './loadTilesetAnimations';
import {
  computeSpatialConnectionOffset,
  isSpatialConnectionDirection,
} from './mapConnections';
import { applyTrainerHillDynamicFloorLayout } from './trainerHillFloorLayout';

const PROJECT_ROOT = '/pokeemerald';
const NUM_PALS_IN_PRIMARY = 6;
const NUM_PALS_TOTAL = 13;
const worldManagerLogger = createLogger('WorldManager');

/** Maximum number of unique tileset pairs to keep in CPU memory
 * The scheduler manages which 2 are in GPU - this is the total that can be cached
 * Higher values allow more freedom to walk across tileset boundaries
 * Set high to avoid blocking map loading during development/debugging
 */
const MAX_TILESET_PAIRS_IN_MEMORY = 16;

/** Maximum depth for map loading from current position */
const LOAD_DEPTH = 2;

const mapIndexData = mapIndexJson as MapIndexEntry[];

/**
 * Complete tileset pair data (primary + secondary tilesets)
 */
export interface TilesetPairInfo {
  id: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  primaryImage: TilesetImageData;
  secondaryImage: TilesetImageData;
  primaryPalettes: Palette[];
  secondaryPalettes: Palette[];
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
  animations: LoadedAnimation[];
}

/**
 * A map instance positioned in world space
 */
export interface LoadedMapInstance {
  entry: MapIndexEntry;
  mapData: MapData;
  offsetX: number;  // World tile offset
  offsetY: number;
  tilesetPairIndex: number;  // Index into tilesetPairs array
  borderMetatiles: number[];  // Per-map border metatiles from border.bin
  warpEvents: WarpEvent[];  // Warp events from map.json
  objectEvents: ObjectEventData[];  // Object events (NPCs, items) from map.json
  coordEvents: Array<ScriptCoordEvent | WeatherCoordEvent>;  // Coordinate events from map.json
  bgEvents: BgEvent[];  // Background events (signs, hidden items) from map.json
  mapWeather: string | null;  // Map default weather from map.json
  mapAllowCycling: boolean;  // Map allow_cycling flag from map.json
}

/**
 * World state snapshot for rendering
 */
export interface WorldSnapshot {
  maps: LoadedMapInstance[];
  tilesetPairs: TilesetPairInfo[];
  mapTilesetPairIndex: Map<string, number>;
  /** Border metatiles from the ANCHOR map - used for all out-of-bounds tiles */
  anchorBorderMetatiles: number[];
  /** Maps tileset pair ID to GPU slot (0, 1, or 2). Pairs not in GPU are not in this map. */
  pairIdToGpuSlot: Map<string, 0 | 1 | 2>;
  anchorMapId: string;
  worldBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Events emitted by WorldManager
 */
export type WorldManagerEvent =
  | { type: 'mapsChanged'; snapshot: WorldSnapshot }
  | { type: 'anchorChanged'; snapshot: WorldSnapshot; newAnchorMapId: string }
  | { type: 'tilesetsChanged'; pair0: TilesetPairInfo; pair1: TilesetPairInfo | null }
| { type: 'gpuSlotsSwapped'; slot0PairId: string | null; slot1PairId: string | null; needsRebuild: boolean };

export type WorldManagerEventHandler = (event: WorldManagerEvent) => void;

// Re-export scheduler for external use
export { TilesetPairScheduler } from './TilesetPairScheduler';
export type { TilesetBoundary, SchedulerEvent } from './TilesetPairScheduler';

/**
 * Manages dynamic world loading and unloading
 */
export class WorldManager {
  private maps: Map<string, LoadedMapInstance> = new Map();
  private tilesetPairs: TilesetPairInfo[] = [];
  private tilesetPairMap: Map<string, number> = new Map();  // pairId -> index
  private mapTilesetPairIndex: Map<string, number> = new Map();

  private anchorMapId: string = '';

  private eventHandlers: WorldManagerEventHandler[] = [];
  private loadingMaps: Set<string> = new Set();

  /** Epoch counter - incremented on initialize() to invalidate stale async operations */
  private worldEpoch: number = 0;

  /** Tileset pair scheduler for smart loading/unloading */
  private scheduler: TilesetPairScheduler = new TilesetPairScheduler();

  private debugLog(...args: unknown[]): void {
    if (!isDebugMode()) return;
    worldManagerLogger.debug(...args);
  }

  private debugWarn(...args: unknown[]): void {
    if (!isDebugMode()) return;
    worldManagerLogger.warn(...args);
  }

  /**
   * Set the callback for uploading tileset pairs to GPU
   * This must be called before initialize() for proper scheduler setup
   */
  setGpuUploadCallback(callback: (pair: TilesetPairInfo, slot: 0 | 1 | 2) => void): void {
    // Set up scheduler callbacks
    this.scheduler.setCallbacks(
      callback,
      async (pairId: string) => {
        // Parse the pair ID to get tileset IDs
        const [primaryId, secondaryId] = pairId.split('+');
        // Find a map entry that uses these tilesets
        const entry = mapIndexData.find(
          m => m.primaryTilesetId === primaryId && m.secondaryTilesetId === secondaryId
        );
        if (!entry) {
          throw new Error(`No map found for tileset pair: ${pairId}`);
        }
        return this.loadTilesetPair(entry);
      }
    );
  }

  /**
   * Get the scheduler instance for direct access
   */
  getScheduler(): TilesetPairScheduler {
    return this.scheduler;
  }

  /**
   * Initialize the world with a starting map
   *
   * This CLEARS all existing maps and tileset data before loading the new world.
   * Call this when warping to a completely new area.
   */
  async initialize(startMapId: string): Promise<WorldSnapshot> {
    const startEntry = mapIndexData.find(m => m.id === startMapId);
    if (!startEntry) {
      throw new Error(`Map not found: ${startMapId}`);
    }

    // CRITICAL: Clear all existing world data before loading new world
    // This is essential for warping to work correctly!
    this.maps.clear();
    this.tilesetPairs = [];
    this.tilesetPairMap.clear();
    this.mapTilesetPairIndex.clear();
    this.loadingMaps.clear();

    // Increment epoch to invalidate any in-flight async operations from old world
    this.worldEpoch++;
    this.debugLog(`[INIT] World epoch incremented to ${this.worldEpoch}`);

    // Reset scheduler state (but keep callbacks)
    this.scheduler.reset();

    this.anchorMapId = startMapId;

    // Load initial world
    this.debugLog(`[INIT] Starting initialize for ${startMapId}, connections:`, startEntry.connections || 'NONE');
    await this.loadMapsFromAnchor(startEntry, 0, 0, LOAD_DEPTH);
    this.debugLog(`[INIT] After loadMapsFromAnchor, loaded maps:`, Array.from(this.maps.keys()));

    // Update scheduler with loaded maps and boundaries
    this.scheduler.updateBoundaries(
      Array.from(this.maps.values()),
      this.mapTilesetPairIndex,
      this.tilesetPairs
    );

    // Add all loaded pairs to scheduler cache
    for (const pair of this.tilesetPairs) {
      this.scheduler.addToCache(pair);
    }

    // Set initial GPU slots (up to 3 pairs)
    if (this.tilesetPairs[0]) {
      this.scheduler.setGpuSlot(this.tilesetPairs[0].id, 0);
    }
    if (this.tilesetPairs[1]) {
      this.scheduler.setGpuSlot(this.tilesetPairs[1].id, 1);
    }
    if (this.tilesetPairs[2]) {
      this.scheduler.setGpuSlot(this.tilesetPairs[2].id, 2);
    }

    return this.getSnapshot();
  }

  /**
   * Update world based on player position
   * Call this each frame or when player moves significantly
   *
   * @param playerTileX - Player's current tile X position
   * @param playerTileY - Player's current tile Y position
   * @param playerDirection - Player's facing/movement direction (for predictive loading)
   */
  async update(
    playerTileX: number,
    playerTileY: number,
    playerDirection: 'up' | 'down' | 'left' | 'right' | null = null
  ): Promise<void> {
    // Find which map the player is currently in
    const currentMap = this.findMapAtPosition(playerTileX, playerTileY);
    if (!currentMap) {
      // DEBUG: Player position doesn't match any loaded map (this is normal during warps)
      // Only log if maps exist (to reduce noise during world reinitialization)
      if (this.maps.size > 0) {
        this.debugWarn(`[WM_UPDATE] No map at player pos (${playerTileX},${playerTileY}). Loaded maps:`,
          Array.from(this.maps.values()).map(m => `${m.entry.id}@(${m.offsetX},${m.offsetY}) ${m.entry.width}x${m.entry.height}`));
      }
      return;
    }

    // DEBUG: Log which map was found (for tracking stale reference issues)
    // console.log(`[WM_UPDATE] Found map ${currentMap.entry.id} at pos (${playerTileX},${playerTileY}) epoch=${this.worldEpoch}`);

    // Get the tileset pair for current map
    const currentPairIndex = this.mapTilesetPairIndex.get(currentMap.entry.id);
    const currentPair = currentPairIndex !== undefined ? this.tilesetPairs[currentPairIndex] : null;

    // Update scheduler - this handles GPU slot swapping and preloading
    if (currentPair) {
      const result = await this.scheduler.update(
        playerTileX,
        playerTileY,
        currentPair.id,
        playerDirection
      );

      if (result.needsRebuild) {
        // GPU slots changed, notify listeners
        this.emit({
          type: 'gpuSlotsSwapped',
          slot0PairId: result.newSlot0,
          slot1PairId: result.newSlot1,
          needsRebuild: true,
        });

        // Also emit tilesetsChanged for backward compatibility
        const pair0 = result.newSlot0 ? this.scheduler.getCachedPair(result.newSlot0) : null;
        const pair1 = result.newSlot1 ? this.scheduler.getCachedPair(result.newSlot1) : null;
        if (pair0) {
          this.emit({
            type: 'tilesetsChanged',
            pair0,
            pair1,
          });
        }
      }
    }

    // Lightweight anchor tracking: update anchorMapId when player enters a new map
    // (no coordinate shift — tile coords stay small enough for full precision)
    if (currentMap.entry.id !== this.anchorMapId) {
      this.anchorMapId = currentMap.entry.id;
      this.emit({ type: 'anchorChanged', snapshot: this.getSnapshot(), newAnchorMapId: currentMap.entry.id });
    }

    // Load any missing connected maps
    await this.loadConnectedMaps(currentMap);
  }

  /**
   * Get current world snapshot for rendering
   */
  getSnapshot(): WorldSnapshot {
    const mapsArray = Array.from(this.maps.values());

    // Calculate bounds
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (const map of mapsArray) {
      minX = Math.min(minX, map.offsetX);
      minY = Math.min(minY, map.offsetY);
      maxX = Math.max(maxX, map.offsetX + map.entry.width);
      maxY = Math.max(maxY, map.offsetY + map.entry.height);
    }

    // Build pairIdToGpuSlot mapping from scheduler
    const gpuSlots = this.scheduler.getGpuSlots();
    const pairIdToGpuSlot = new Map<string, 0 | 1 | 2>();
    if (gpuSlots.slot0) pairIdToGpuSlot.set(gpuSlots.slot0, 0);
    if (gpuSlots.slot1) pairIdToGpuSlot.set(gpuSlots.slot1, 1);
    if (gpuSlots.slot2) pairIdToGpuSlot.set(gpuSlots.slot2, 2);

    // Get anchor map's border metatiles
    const anchorMap = this.maps.get(this.anchorMapId);
    const anchorBorderMetatiles = anchorMap?.borderMetatiles ?? [];

    return {
      maps: mapsArray,
      tilesetPairs: [...this.tilesetPairs],
      mapTilesetPairIndex: new Map(this.mapTilesetPairIndex),
      anchorBorderMetatiles,
      pairIdToGpuSlot,
      anchorMapId: this.anchorMapId,
      worldBounds: {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }

  /**
   * Subscribe to world events
   */
  on(handler: WorldManagerEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  /**
   * Find which map contains a world position
   */
  findMapAtPosition(worldX: number, worldY: number): LoadedMapInstance | null {
    for (const map of this.maps.values()) {
      const localX = worldX - map.offsetX;
      const localY = worldY - map.offsetY;
      if (localX >= 0 && localX < map.entry.width &&
          localY >= 0 && localY < map.entry.height) {
        return map;
      }
    }
    return null;
  }

  /**
   * Get tileset pair for a map
   */
  getTilesetPairForMap(mapId: string): TilesetPairInfo | null {
    const pairIndex = this.mapTilesetPairIndex.get(mapId);
    if (pairIndex === undefined) return null;
    return this.tilesetPairs[pairIndex] ?? null;
  }

  /**
   * Load maps connected to a given map, including neighbors-of-neighbors
   * This ensures maps are always stitched close to the player
   */
  private async loadConnectedMaps(fromMap: LoadedMapInstance): Promise<void> {
    // Capture epoch at start - if it changes, abort (world was reinitialized)
    const startEpoch = this.worldEpoch;

    // CRITICAL: Verify fromMap is still valid (exists in current world)
    // This catches stale references from old async operations
    if (!this.maps.has(fromMap.entry.id)) {
      this.debugLog(`[LOAD_CONNECTED] Skipping - fromMap ${fromMap.entry.id} is not in current world (epoch ${startEpoch})`);
      return;
    }

    // Use BFS to load maps up to 2 connections deep from current map
    const queue: Array<{ map: LoadedMapInstance; depth: number }> = [{ map: fromMap, depth: 0 }];
    const visited = new Set<string>([fromMap.entry.id]);
    const MAX_CONNECTION_DEPTH = 2;

    // Only log if there are unloaded connections (reduce log noise)
    const connections = (fromMap.entry.connections ?? []).filter((connection) =>
      isSpatialConnectionDirection(connection.direction)
    );
    const unloadedConnections = connections.filter(c =>
      !this.maps.has(c.map) && !this.loadingMaps.has(c.map)
    );
    if (unloadedConnections.length > 0) {
      this.debugLog(`[LOAD_CONNECTED] From ${fromMap.entry.id} with ${unloadedConnections.length}/${connections.length} unloaded connections (epoch ${startEpoch}):`,
        unloadedConnections.map(c => `${c.direction}->${c.map}`));
    }

    while (queue.length > 0) {
      // Check epoch before processing each item - abort if world changed
      if (this.worldEpoch !== startEpoch) {
        this.debugLog(`[LOAD_CONNECTED] Aborting - epoch changed from ${startEpoch} to ${this.worldEpoch}`);
        return;
      }

      const { map: currentMap, depth } = queue.shift()!;
      if (depth >= MAX_CONNECTION_DEPTH) {
        continue;
      }

      const connections = (currentMap.entry.connections || []).filter((connection) =>
        isSpatialConnectionDirection(connection.direction)
      );

      for (const connection of connections) {
        if (visited.has(connection.map)) continue;
        visited.add(connection.map);

        if (this.maps.has(connection.map) || this.loadingMaps.has(connection.map)) {
          // Already loaded - but still add to queue to check ITS connections
          const existingMap = this.maps.get(connection.map);
          if (existingMap) {
            queue.push({ map: existingMap, depth: depth + 1 });
          }
          continue;
        }

        const neighborEntry = mapIndexData.find(m => m.id === connection.map);
        if (!neighborEntry) continue;

        // Calculate offset for connected map
        const connectionOffset = this.computeConnectionOffset(
          currentMap.entry,
          neighborEntry,
          connection,
          currentMap.offsetX,
          currentMap.offsetY
        );
        if (!connectionOffset) {
          continue;
        }
        const { offsetX, offsetY } = connectionOffset;

        // Check tileset pair limit - but prioritize maps that share our current tileset
        const pairId = this.getTilesetPairId(neighborEntry.primaryTilesetId, neighborEntry.secondaryTilesetId);
        const currentPairId = this.getTilesetPairId(fromMap.entry.primaryTilesetId, fromMap.entry.secondaryTilesetId);
        const sharesTileset = pairId === currentPairId || this.tilesetPairMap.has(pairId);

        if (!sharesTileset && this.tilesetPairs.length >= MAX_TILESET_PAIRS_IN_MEMORY) {
          // Skip maps with new tilesets when at limit, but only for depth > 1
          // Always try to load immediate neighbors (depth 0 -> depth 1 connections)
          if (depth > 1) continue;
        }

        // Check epoch before each async operation
        if (this.worldEpoch !== startEpoch) {
          this.debugLog(`[LOAD_CONNECTED] Aborting before loadMap - epoch changed from ${startEpoch} to ${this.worldEpoch}`);
          return;
        }

        // Load the map - pass sourceInfo so offset can be recalculated if reanchor happens during load
        try {
          this.debugLog(`[LOAD_CONNECTED] Loading ${neighborEntry.id} via ${connection.direction} from ${currentMap.entry.id} at depth ${depth} (epoch ${startEpoch})`);
          await this.loadMap(neighborEntry, offsetX, offsetY, startEpoch, {
            sourceMapId: currentMap.entry.id,
            connection: { direction: connection.direction, offset: connection.offset },
          });

          // Check epoch after async operation
          if (this.worldEpoch !== startEpoch) {
            this.debugLog(`[LOAD_CONNECTED] Aborting after loadMap - epoch changed from ${startEpoch} to ${this.worldEpoch}`);
            return;
          }

          // Add newly loaded map to queue to check its connections
          const loadedMap = this.maps.get(connection.map);
          if (loadedMap) {
            queue.push({ map: loadedMap, depth: depth + 1 });
          }
        } catch (err) {
          // Map failed to load (likely tileset limit) - skip it
          this.debugWarn(`Failed to load map ${connection.map}:`, err);
        }
      }
    }

    // Final epoch check before updating scheduler
    if (this.worldEpoch !== startEpoch) {
      this.debugLog(`[LOAD_CONNECTED] Aborting scheduler update - epoch changed from ${startEpoch} to ${this.worldEpoch}`);
      return;
    }

    // Update scheduler boundaries after loading new maps
    this.scheduler.updateBoundaries(
      Array.from(this.maps.values()),
      this.mapTilesetPairIndex,
      this.tilesetPairs
    );
  }

  /**
   * Load maps starting from anchor using BFS
   */
  private async loadMapsFromAnchor(
    anchorEntry: MapIndexEntry,
    anchorOffsetX: number,
    anchorOffsetY: number,
    maxDepth: number
  ): Promise<void> {
    // Queue includes optional source info for offset recalculation
    interface QueueItem {
      entry: MapIndexEntry;
      offsetX: number;
      offsetY: number;
      depth: number;
      sourceInfo?: { sourceMapId: string; connection: { direction: string; offset: number } };
    }

    const queue: QueueItem[] = [
      { entry: anchorEntry, offsetX: anchorOffsetX, offsetY: anchorOffsetY, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (this.maps.has(current.entry.id)) continue;

      // Check tileset pair limit
      const pairId = this.getTilesetPairId(current.entry.primaryTilesetId, current.entry.secondaryTilesetId);
      if (!this.tilesetPairMap.has(pairId) && this.tilesetPairs.length >= MAX_TILESET_PAIRS_IN_MEMORY) {
        continue;
      }

      // Load the map (anchor has no sourceInfo, connected maps do)
      await this.loadMap(
        current.entry,
        current.offsetX,
        current.offsetY,
        undefined, // no epoch check during initialize
        current.sourceInfo
      );

      // Queue connected maps if not at max depth
      if (current.depth < maxDepth) {
        for (const connection of current.entry.connections || []) {
          if (!isSpatialConnectionDirection(connection.direction)) {
            continue;
          }
          const neighborEntry = mapIndexData.find(m => m.id === connection.map);
          if (!neighborEntry || this.maps.has(neighborEntry.id)) continue;

          const connectionOffset = this.computeConnectionOffset(
            current.entry,
            neighborEntry,
            connection,
            current.offsetX,
            current.offsetY
          );
          if (!connectionOffset) {
            continue;
          }
          const { offsetX, offsetY } = connectionOffset;

          queue.push({
            entry: neighborEntry,
            offsetX,
            offsetY,
            depth: current.depth + 1,
            sourceInfo: {
              sourceMapId: current.entry.id,
              connection: { direction: connection.direction, offset: connection.offset },
            },
          });
        }
      }
    }
  }

  /**
   * Load a single map
   * @param expectedEpoch - If provided, abort loading if epoch has changed (stale operation)
   * @param sourceInfo - If provided, recalculate offset at end using source map's CURRENT position
   *                     This fixes race conditions where reanchor shifts source map during async load
   */
  private async loadMap(
    entry: MapIndexEntry,
    offsetX: number,
    offsetY: number,
    expectedEpoch?: number,
    sourceInfo?: { sourceMapId: string; connection: { direction: string; offset: number } }
  ): Promise<void> {
    // Check epoch if provided - abort if world was reinitialized
    if (expectedEpoch !== undefined && this.worldEpoch !== expectedEpoch) {
      this.debugLog(`[LOAD_MAP] Skipping ${entry.id} - epoch mismatch (expected ${expectedEpoch}, current ${this.worldEpoch})`);
      return;
    }

    if (this.maps.has(entry.id) || this.loadingMaps.has(entry.id)) return;

    // DEBUG: Track why maps are being loaded
    this.debugLog(`[LOAD_MAP] Loading ${entry.id} at offset (${offsetX}, ${offsetY}) epoch=${this.worldEpoch}`);
    this.debugLog(`[LOAD_MAP] Current anchor: ${this.anchorMapId}, loaded maps: ${Array.from(this.maps.keys()).join(', ')}`);
    this.debugLog(`[LOAD_MAP] Entry connections:`, entry.connections?.map(c => `${c.direction}->${c.map}`) || 'NONE');

    this.loadingMaps.add(entry.id);

    try {
      // Ensure tileset pair is loaded
      const pairId = this.getTilesetPairId(entry.primaryTilesetId, entry.secondaryTilesetId);
      let pairIndex = this.tilesetPairMap.get(pairId);

      if (pairIndex === undefined) {
        if (this.tilesetPairs.length >= MAX_TILESET_PAIRS_IN_MEMORY) {
          throw new Error(`Cannot load map ${entry.id}: tileset pair limit exceeded`);
        }

        const pair = await this.loadTilesetPair(entry);

        // Check epoch after async - abort if world reinitialized
        if (expectedEpoch !== undefined && this.worldEpoch !== expectedEpoch) {
          this.debugLog(`[LOAD_MAP] Aborting ${entry.id} after tileset load - epoch mismatch`);
          return;
        }

        pairIndex = this.tilesetPairs.length;
        this.tilesetPairs.push(pair);
        this.tilesetPairMap.set(pairId, pairIndex);

        // Add to scheduler cache
        this.scheduler.addToCache(pair);

        // CRITICAL: Assign GPU slot for the new pair!
        // First 3 pairs go to slots 0, 1, 2
        // This ensures pairIdToGpuSlot is correct in the snapshot
        if (pairIndex === 0) {
          this.scheduler.setGpuSlot(pair.id, 0);
        } else if (pairIndex === 1) {
          this.scheduler.setGpuSlot(pair.id, 1);
        } else if (pairIndex === 2) {
          this.scheduler.setGpuSlot(pair.id, 2);
        }
        // Note: pairs beyond index 2 stay in CPU cache only until
        // the scheduler swaps them into GPU based on player position

        // Emit tileset change
        this.debugLog(`[TILESET_CHANGE] New pair loaded: ${pair.id}, total pairs now: ${this.tilesetPairs.length}`);
        this.debugLog(`[TILESET_CHANGE] For map: ${entry.id}, anchor: ${this.anchorMapId}`);
        this.emit({
          type: 'tilesetsChanged',
          pair0: this.tilesetPairs[0],
          pair1: this.tilesetPairs[1] ?? null,
        });
      }

      // Load map layout, border metatiles, and events (warps + objects)
      const layoutPath = `${PROJECT_ROOT}/${entry.layoutPath}`;
      const [mapData, borderMetatiles, mapEvents] = await Promise.all([
        loadMapLayout(`${layoutPath}/map.bin`, entry.width, entry.height),
        loadBorderMetatiles(`${layoutPath}/border.bin`).catch(() => [] as number[]),
        loadMapEvents(entry.folder),
      ]);

      await applyTrainerHillDynamicFloorLayout(entry.id, mapData);

      // Check epoch after async - abort if world reinitialized
      if (expectedEpoch !== undefined && this.worldEpoch !== expectedEpoch) {
        this.debugLog(`[LOAD_MAP] Aborting ${entry.id} after layout load - epoch mismatch`);
        return;
      }

      // CRITICAL FIX: If sourceInfo provided, recalculate offset using source map's CURRENT position
      // This fixes race condition where reanchor can shift source map during async load
      let finalOffsetX = offsetX;
      let finalOffsetY = offsetY;

      if (sourceInfo) {
        const sourceMap = this.maps.get(sourceInfo.sourceMapId);
        if (sourceMap) {
          const recalculated = this.computeConnectionOffset(
            sourceMap.entry,
            entry,
            sourceInfo.connection,
            sourceMap.offsetX,
            sourceMap.offsetY
          );
          if (!recalculated) {
            this.debugWarn(
              `[LOAD_MAP] Connection became non-spatial while recalculating offset for ${entry.id}`
            );
            return;
          }

          // Check if offset changed (indicates reanchor happened during load)
          if (recalculated.offsetX !== offsetX || recalculated.offsetY !== offsetY) {
            this.debugLog(`[LOAD_MAP] Offset recalculated for ${entry.id}: (${offsetX},${offsetY}) -> (${recalculated.offsetX},${recalculated.offsetY}) due to reanchor during load`);
            finalOffsetX = recalculated.offsetX;
            finalOffsetY = recalculated.offsetY;
          }
        } else {
          // Source map was unloaded during load - this map's offset may be stale
          this.debugWarn(`[LOAD_MAP] Source map ${sourceInfo.sourceMapId} no longer exists - ${entry.id} may have wrong offset`);
        }
      }

      const mapInstance: LoadedMapInstance = {
        entry,
        mapData,
        offsetX: finalOffsetX,
        offsetY: finalOffsetY,
        tilesetPairIndex: pairIndex,
        borderMetatiles,
        warpEvents: mapEvents.warpEvents,
        objectEvents: mapEvents.objectEvents,
        coordEvents: mapEvents.coordEvents,
        bgEvents: mapEvents.bgEvents,
        mapWeather: mapEvents.mapWeather,
        mapAllowCycling: mapEvents.mapAllowCycling,
      };

      this.maps.set(entry.id, mapInstance);
      this.mapTilesetPairIndex.set(entry.id, pairIndex);

      // Emit maps changed
      this.debugLog(`[MAPS_CHANGED] Emitting after loading ${entry.id}. Total maps: ${this.maps.size}, anchor: ${this.anchorMapId}`);
      this.emit({ type: 'mapsChanged', snapshot: this.getSnapshot() });
    } finally {
      this.loadingMaps.delete(entry.id);
    }
  }

  /**
   * Load a complete tileset pair
   */
  private async loadTilesetPair(entry: MapIndexEntry): Promise<TilesetPairInfo> {
    const primaryPath = `${PROJECT_ROOT}/${entry.primaryTilesetPath}`;
    const secondaryPath = `${PROJECT_ROOT}/${entry.secondaryTilesetPath}`;

    const [
      primaryMetatiles,
      secondaryMetatiles,
      primaryAttributes,
      secondaryAttributes,
      primaryImage,
      secondaryImage,
      primaryPalettes,
      secondaryPalettes,
    ] = await Promise.all([
      loadMetatileDefinitions(`${primaryPath}/metatiles.bin`),
      loadMetatileDefinitions(`${secondaryPath}/metatiles.bin`),
      this.safeLoadMetatileAttributes(`${primaryPath}/metatile_attributes.bin`),
      this.safeLoadMetatileAttributes(`${secondaryPath}/metatile_attributes.bin`),
      loadTilesetImage(`${primaryPath}/tiles.png`, true) as Promise<TilesetImageData>,
      loadTilesetImage(`${secondaryPath}/tiles.png`, true) as Promise<TilesetImageData>,
      this.loadPalettes(primaryPath, 0, NUM_PALS_IN_PRIMARY),
      this.loadPalettes(secondaryPath, NUM_PALS_IN_PRIMARY, NUM_PALS_TOTAL - NUM_PALS_IN_PRIMARY),
    ]);

    const animations = await this.loadAnimationsForTilesets(entry.primaryTilesetId, entry.secondaryTilesetId);

    return {
      id: this.getTilesetPairId(entry.primaryTilesetId, entry.secondaryTilesetId),
      primaryTilesetId: entry.primaryTilesetId,
      secondaryTilesetId: entry.secondaryTilesetId,
      primaryTilesetPath: entry.primaryTilesetPath,
      secondaryTilesetPath: entry.secondaryTilesetPath,
      primaryImage,
      secondaryImage,
      primaryPalettes,
      secondaryPalettes,
      primaryMetatiles,
      secondaryMetatiles,
      primaryAttributes,
      secondaryAttributes,
      animations,
    };
  }

  /**
   * Generate unique ID for tileset pair
   */
  private getTilesetPairId(primaryId: string, secondaryId: string): string {
    return `${primaryId}+${secondaryId}`;
  }

  /**
   * Compute neighbor map offset based on connection direction
   */
  private computeConnectionOffset(
    baseEntry: MapIndexEntry,
    neighborEntry: MapIndexEntry,
    connection: { direction: string; offset: number },
    baseOffsetX: number,
    baseOffsetY: number
  ): { offsetX: number; offsetY: number } | null {
    return computeSpatialConnectionOffset(
      { width: baseEntry.width, height: baseEntry.height },
      { width: neighborEntry.width, height: neighborEntry.height },
      connection,
      baseOffsetX,
      baseOffsetY
    );
  }

  /**
   * Load palettes from tileset path
   */
  private async loadPalettes(tilesetPath: string, startIndex: number, count: number): Promise<Palette[]> {
    const palettes: Palette[] = [];
    for (let i = startIndex; i < startIndex + count; i++) {
      try {
        const text = await loadText(`${tilesetPath}/palettes/${i.toString().padStart(2, '0')}.pal`);
        palettes.push(parsePalette(text));
      } catch {
        palettes.push({ colors: Array(16).fill('#000000') });
      }
    }
    return palettes;
  }

  /**
   * Safely load metatile attributes
   */
  private async safeLoadMetatileAttributes(url: string): Promise<MetatileAttributes[]> {
    try {
      return await loadMetatileAttributes(url);
    } catch {
      return [];
    }
  }

  /**
   * Load tile animations for tilesets
   */
  private async loadAnimationsForTilesets(primaryId: string, secondaryId: string): Promise<LoadedAnimation[]> {
    return loadTilesetAnimations(primaryId, secondaryId, {
      projectRoot: PROJECT_ROOT,
    });
  }

  /**
   * Emit event to all handlers
   */
  private emit(event: WorldManagerEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Get debug info about current world state
   */
  getDebugInfo(playerTileX: number, playerTileY: number): {
    currentMap: string | null;
    anchorMap: string;
    loadedMaps: Array<{ id: string; offsetX: number; offsetY: number; width: number; height: number; pairIndex: number; pairId: string; inGpu: boolean; borderTileCount: number }>;
    expectedConnections: Array<{ from: string; direction: string; to: string; loaded: boolean }>;
    tilesetPairs: number;
    playerPos: { x: number; y: number };
    gpuSlot0: string | null;
    gpuSlot1: string | null;
    tilesetAnimations: Array<{
      slot: 0 | 1 | 2;
      pairId: string;
      animationCount: number;
      animationIds: string[];
      destinationCount: number;
      frameCount: number;
    }>;
    boundaries: Array<{ x: number; y: number; length: number; orientation: string; pairA: string; pairB: string }>;
    nearbyBoundaryCount: number;
  } {
    const currentMap = this.findMapAtPosition(playerTileX, playerTileY);
    const gpuSlots = this.scheduler.getGpuSlots();

    const loadedMaps = Array.from(this.maps.values()).map(m => {
      const pairIndex = this.mapTilesetPairIndex.get(m.entry.id) ?? -1;
      const pair = pairIndex >= 0 ? this.tilesetPairs[pairIndex] : null;
      const pairId = pair?.id ?? 'none';
      const inGpu = pairId === gpuSlots.slot0 || pairId === gpuSlots.slot1;
      return {
        id: m.entry.id,
        offsetX: m.offsetX,
        offsetY: m.offsetY,
        width: m.entry.width,
        height: m.entry.height,
        pairIndex,
        pairId,
        inGpu,
        borderTileCount: m.borderMetatiles.length,
      };
    });

    const tilesetAnimations: Array<{
      slot: 0 | 1 | 2;
      pairId: string;
      animationCount: number;
      animationIds: string[];
      destinationCount: number;
      frameCount: number;
    }> = [];

    const slotPairs: Array<[0 | 1 | 2, string | null]> = [
      [0, gpuSlots.slot0],
      [1, gpuSlots.slot1],
      [2, gpuSlots.slot2],
    ];

    for (const [slot, pairId] of slotPairs) {
      if (!pairId) continue;
      const pair = this.tilesetPairs.find(p => p.id === pairId);
      if (!pair) continue;
      const animationIds = (pair.animations ?? []).map(anim => anim.id);
      const destinationCount = (pair.animations ?? []).reduce((sum, anim) => sum + (anim.destinations?.length ?? 0), 0);
      const frameCount = (pair.animations ?? []).reduce((sum, anim) => sum + (anim.frames?.length ?? 0), 0);
      tilesetAnimations.push({
        slot,
        pairId,
        animationCount: animationIds.length,
        animationIds,
        destinationCount,
        frameCount,
      });
    }

    // Get expected connections from current map
    const expectedConnections: Array<{ from: string; direction: string; to: string; loaded: boolean }> = [];
    if (currentMap) {
      for (const conn of currentMap.entry.connections || []) {
        expectedConnections.push({
          from: currentMap.entry.id,
          direction: conn.direction,
          to: conn.map,
          loaded: this.maps.has(conn.map),
        });
      }
    }

    // Get boundaries for debug visualization
    const boundaries = this.scheduler.getBoundaries().map(b => ({
      x: b.worldX,
      y: b.worldY,
      length: b.length,
      orientation: b.orientation,
      pairA: b.pairIdA.replace('gTileset_', '').replace('+gTileset_', ' + '),
      pairB: b.pairIdB.replace('gTileset_', '').replace('+gTileset_', ' + '),
    }));

    // Get nearby boundaries (within preload distance of player)
    const nearbyBoundaries = this.scheduler.getNearbyBoundaries(playerTileX, playerTileY);

    return {
      currentMap: currentMap?.entry.id ?? null,
      anchorMap: this.anchorMapId,
      loadedMaps,
      expectedConnections,
      tilesetPairs: this.tilesetPairs.length,
      playerPos: { x: playerTileX, y: playerTileY },
      gpuSlot0: gpuSlots.slot0,
      gpuSlot1: gpuSlots.slot1,
      tilesetAnimations,
      boundaries,
      nearbyBoundaryCount: nearbyBoundaries.length,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.maps.clear();
    this.tilesetPairs = [];
    this.tilesetPairMap.clear();
    this.mapTilesetPairIndex.clear();
    this.eventHandlers = [];
    this.loadingMaps.clear();
  }
}
