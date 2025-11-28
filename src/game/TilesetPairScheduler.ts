/**
 * TilesetPairScheduler - Smart tileset pair loading/unloading for infinite walking
 *
 * The GPU can only hold 2 tileset pairs at once (6 textures total).
 * This scheduler manages which pairs are loaded based on player position,
 * with smart boundary detection and predictive preloading.
 *
 * Architecture:
 * - GPU Slots: 2 slots (0 and 1) for active tileset pairs
 * - CPU Cache: LRU cache of recently used pairs (avoids disk reloads)
 * - Preload Queue: Pairs to load when player approaches boundary
 *
 * The "active" pair is always in slot 0 (the area the player is standing in).
 * Slot 1 holds the adjacent tileset pair (if any).
 */

import type { TilesetPairInfo, LoadedMapInstance } from './WorldManager';

/** Distance in tiles from tileset boundary to start preloading */
const PRELOAD_DISTANCE = 3;

/** Maximum number of tileset pairs to keep in CPU cache */
const MAX_CPU_CACHE = 4;

/**
 * Boundary between two tileset regions
 */
export interface TilesetBoundary {
  /** World tile X where boundary starts */
  worldX: number;
  /** World tile Y where boundary starts */
  worldY: number;
  /** Length of boundary in tiles */
  length: number;
  /** Whether boundary is horizontal (player crosses by moving N/S) or vertical (E/W) */
  orientation: 'horizontal' | 'vertical';
  /** Tileset pair ID on one side */
  pairIdA: string;
  /** Tileset pair ID on other side */
  pairIdB: string;
  /** Map IDs on each side */
  mapIdA: string;
  mapIdB: string;
}

/**
 * A cached tileset pair with LRU tracking
 */
interface CachedPair {
  id: string;
  data: TilesetPairInfo;
  lastAccessFrame: number;
  gpuSlot: 0 | 1 | null;
}

/**
 * Events emitted by the scheduler
 */
export type SchedulerEvent =
  | { type: 'gpuSlotsChanged'; slot0: string | null; slot1: string | null }
  | { type: 'preloadStarted'; pairId: string }
  | { type: 'preloadCompleted'; pairId: string }
  | { type: 'pairEvicted'; pairId: string };

export type SchedulerEventHandler = (event: SchedulerEvent) => void;

/**
 * Manages tileset pair loading/unloading for infinite world traversal
 */
export class TilesetPairScheduler {
  /** CPU cache of loaded tileset pairs */
  private cache: Map<string, CachedPair> = new Map();

  /** Currently active GPU slot assignments */
  private gpuSlot0: string | null = null;
  private gpuSlot1: string | null = null;

  /** Detected tileset boundaries in the current world */
  private boundaries: TilesetBoundary[] = [];

  /** Current frame number for LRU tracking */
  private currentFrame: number = 0;

  /** Pairs currently being loaded */
  private loadingPairs: Set<string> = new Set();

  /** Event handlers */
  private eventHandlers: SchedulerEventHandler[] = [];

  /** Callback to actually upload tileset to GPU */
  private onUploadToGpu: ((pair: TilesetPairInfo, slot: 0 | 1) => void) | null = null;

  /** Callback to load tileset pair data from disk */
  private onLoadPair: ((pairId: string) => Promise<TilesetPairInfo>) | null = null;

  /**
   * Set callbacks for GPU upload and disk loading
   */
  setCallbacks(
    uploadToGpu: (pair: TilesetPairInfo, slot: 0 | 1) => void,
    loadPair: (pairId: string) => Promise<TilesetPairInfo>
  ): void {
    this.onUploadToGpu = uploadToGpu;
    this.onLoadPair = loadPair;
  }

  /**
   * Subscribe to scheduler events
   */
  on(handler: SchedulerEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  /**
   * Add a tileset pair to the cache (called when WorldManager loads a pair)
   */
  addToCache(pair: TilesetPairInfo): void {
    const existing = this.cache.get(pair.id);
    if (existing) {
      existing.lastAccessFrame = this.currentFrame;
      return;
    }

    // Evict if cache is full
    this.evictIfNeeded();

    this.cache.set(pair.id, {
      id: pair.id,
      data: pair,
      lastAccessFrame: this.currentFrame,
      gpuSlot: null,
    });
  }

  /**
   * Set which pair is in a GPU slot (called after upload)
   */
  setGpuSlot(pairId: string, slot: 0 | 1): void {
    // Clear old slot assignment
    for (const cached of this.cache.values()) {
      if (cached.gpuSlot === slot) {
        cached.gpuSlot = null;
      }
    }

    // Set new assignment
    const cached = this.cache.get(pairId);
    if (cached) {
      cached.gpuSlot = slot;
      cached.lastAccessFrame = this.currentFrame;
    }

    if (slot === 0) {
      this.gpuSlot0 = pairId;
    } else {
      this.gpuSlot1 = pairId;
    }

    this.emit({ type: 'gpuSlotsChanged', slot0: this.gpuSlot0, slot1: this.gpuSlot1 });
  }

  /**
   * Get current GPU slot assignments
   */
  getGpuSlots(): { slot0: string | null; slot1: string | null } {
    return { slot0: this.gpuSlot0, slot1: this.gpuSlot1 };
  }

  /**
   * Get cached pair data (or null if not cached)
   */
  getCachedPair(pairId: string): TilesetPairInfo | null {
    const cached = this.cache.get(pairId);
    if (cached) {
      cached.lastAccessFrame = this.currentFrame;
      return cached.data;
    }
    return null;
  }

  /**
   * Check if a pair is currently in GPU
   */
  isPairInGpu(pairId: string): boolean {
    return this.gpuSlot0 === pairId || this.gpuSlot1 === pairId;
  }

  /**
   * Get which GPU slot a pair is in (or null)
   */
  getGpuSlotForPair(pairId: string): 0 | 1 | null {
    if (this.gpuSlot0 === pairId) return 0;
    if (this.gpuSlot1 === pairId) return 1;
    return null;
  }

  /**
   * Update boundaries from loaded maps
   */
  updateBoundaries(
    maps: LoadedMapInstance[],
    mapTilesetPairIndex: Map<string, number>,
    tilesetPairs: TilesetPairInfo[]
  ): void {
    this.boundaries = [];

    // Build map lookup by position for efficient neighbor checking
    const mapsByPosition = new Map<string, LoadedMapInstance>();
    for (const map of maps) {
      for (let y = 0; y < map.entry.height; y++) {
        for (let x = 0; x < map.entry.width; x++) {
          const key = `${map.offsetX + x},${map.offsetY + y}`;
          mapsByPosition.set(key, map);
        }
      }
    }

    // Find boundaries between maps with different tileset pairs
    const foundBoundaries = new Set<string>();

    for (const map of maps) {
      const mapPairIndex = mapTilesetPairIndex.get(map.entry.id);
      if (mapPairIndex === undefined) continue;

      const mapPairId = tilesetPairs[mapPairIndex]?.id;
      if (!mapPairId) continue;

      // Check each edge of this map
      for (const connection of map.entry.connections || []) {
        const neighborEntry = maps.find(m => m.entry.id === connection.map);
        if (!neighborEntry) continue;

        const neighborPairIndex = mapTilesetPairIndex.get(neighborEntry.entry.id);
        if (neighborPairIndex === undefined) continue;

        const neighborPairId = tilesetPairs[neighborPairIndex]?.id;
        if (!neighborPairId || neighborPairId === mapPairId) continue;

        // This is a tileset boundary!
        const boundaryKey = [mapPairId, neighborPairId].sort().join('|');
        if (foundBoundaries.has(boundaryKey)) continue;
        foundBoundaries.add(boundaryKey);

        // Calculate boundary position based on connection direction
        const boundary = this.computeBoundary(map, neighborEntry, connection, mapPairId, neighborPairId);
        if (boundary) {
          this.boundaries.push(boundary);
        }
      }
    }
  }

  /**
   * Compute boundary details from a connection
   */
  private computeBoundary(
    mapA: LoadedMapInstance,
    mapB: LoadedMapInstance,
    connection: { direction: string; offset: number },
    pairIdA: string,
    pairIdB: string
  ): TilesetBoundary | null {
    const dir = connection.direction.toLowerCase();

    if (dir === 'up' || dir === 'north') {
      return {
        worldX: mapA.offsetX + connection.offset,
        worldY: mapA.offsetY,
        length: Math.min(mapA.entry.width, mapB.entry.width),
        orientation: 'horizontal',
        pairIdA,
        pairIdB,
        mapIdA: mapA.entry.id,
        mapIdB: mapB.entry.id,
      };
    }
    if (dir === 'down' || dir === 'south') {
      return {
        worldX: mapA.offsetX + connection.offset,
        worldY: mapA.offsetY + mapA.entry.height,
        length: Math.min(mapA.entry.width, mapB.entry.width),
        orientation: 'horizontal',
        pairIdA,
        pairIdB,
        mapIdA: mapA.entry.id,
        mapIdB: mapB.entry.id,
      };
    }
    if (dir === 'left' || dir === 'west') {
      return {
        worldX: mapA.offsetX,
        worldY: mapA.offsetY + connection.offset,
        length: Math.min(mapA.entry.height, mapB.entry.height),
        orientation: 'vertical',
        pairIdA,
        pairIdB,
        mapIdA: mapA.entry.id,
        mapIdB: mapB.entry.id,
      };
    }
    if (dir === 'right' || dir === 'east') {
      return {
        worldX: mapA.offsetX + mapA.entry.width,
        worldY: mapA.offsetY + connection.offset,
        length: Math.min(mapA.entry.height, mapB.entry.height),
        orientation: 'vertical',
        pairIdA,
        pairIdB,
        mapIdA: mapA.entry.id,
        mapIdB: mapB.entry.id,
      };
    }

    return null;
  }

  /**
   * Get boundaries near a position
   */
  getNearbyBoundaries(worldX: number, worldY: number, distance: number = PRELOAD_DISTANCE): TilesetBoundary[] {
    return this.boundaries.filter(b => {
      if (b.orientation === 'horizontal') {
        // Check if player is within horizontal range and close vertically
        const inRange = worldX >= b.worldX && worldX < b.worldX + b.length;
        const closeY = Math.abs(worldY - b.worldY) <= distance;
        return inRange && closeY;
      } else {
        // Check if player is within vertical range and close horizontally
        const inRange = worldY >= b.worldY && worldY < b.worldY + b.length;
        const closeX = Math.abs(worldX - b.worldX) <= distance;
        return inRange && closeX;
      }
    });
  }

  /**
   * Get the tileset pair ID that the player should transition TO
   * based on their position and movement direction
   */
  getUpcomingPairId(
    worldX: number,
    worldY: number,
    currentPairId: string,
    direction: 'up' | 'down' | 'left' | 'right' | null
  ): string | null {
    const nearby = this.getNearbyBoundaries(worldX, worldY);

    for (const boundary of nearby) {
      // Determine which side of the boundary the player is approaching from
      if (boundary.orientation === 'horizontal') {
        // Moving up/down crosses horizontal boundaries
        if (direction === 'up' && worldY > boundary.worldY) {
          return boundary.pairIdA === currentPairId ? boundary.pairIdB : boundary.pairIdA;
        }
        if (direction === 'down' && worldY < boundary.worldY) {
          return boundary.pairIdA === currentPairId ? boundary.pairIdB : boundary.pairIdA;
        }
      } else {
        // Moving left/right crosses vertical boundaries
        if (direction === 'left' && worldX > boundary.worldX) {
          return boundary.pairIdA === currentPairId ? boundary.pairIdB : boundary.pairIdA;
        }
        if (direction === 'right' && worldX < boundary.worldX) {
          return boundary.pairIdA === currentPairId ? boundary.pairIdB : boundary.pairIdA;
        }
      }
    }

    return null;
  }

  /**
   * Update the scheduler based on player position
   * Call this each frame or when player moves
   */
  async update(
    playerTileX: number,
    playerTileY: number,
    currentMapPairId: string,
    playerDirection: 'up' | 'down' | 'left' | 'right' | null = null
  ): Promise<{ needsRebuild: boolean; newSlot0: string | null; newSlot1: string | null }> {
    this.currentFrame++;

    let needsRebuild = false;

    // Ensure current pair is in slot 0
    if (this.gpuSlot0 !== currentMapPairId) {
      const cached = this.cache.get(currentMapPairId);
      if (cached && this.onUploadToGpu) {
        // Current pair needs to be in slot 0
        // If it's in slot 1, swap. If not in GPU, upload.
        if (this.gpuSlot1 === currentMapPairId) {
          // Swap slots: current slot0 -> slot1, currentMapPairId -> slot0
          const oldSlot0 = this.gpuSlot0;
          if (oldSlot0) {
            const oldCached = this.cache.get(oldSlot0);
            if (oldCached) {
              this.onUploadToGpu(oldCached.data, 1);
              this.setGpuSlot(oldSlot0, 1);
            }
          }
          this.onUploadToGpu(cached.data, 0);
          this.setGpuSlot(currentMapPairId, 0);
          needsRebuild = true;
        } else {
          // Not in GPU at all, upload to slot 0
          // Move current slot 0 to slot 1 if needed
          if (this.gpuSlot0) {
            const oldCached = this.cache.get(this.gpuSlot0);
            if (oldCached) {
              this.onUploadToGpu(oldCached.data, 1);
              this.setGpuSlot(this.gpuSlot0, 1);
            }
          }
          this.onUploadToGpu(cached.data, 0);
          this.setGpuSlot(currentMapPairId, 0);
          needsRebuild = true;
        }
      }
    }

    // Check if player is near a tileset boundary
    const upcomingPairId = this.getUpcomingPairId(playerTileX, playerTileY, currentMapPairId, playerDirection);

    if (upcomingPairId && upcomingPairId !== currentMapPairId) {
      // Player is approaching a different tileset region
      if (!this.isPairInGpu(upcomingPairId)) {
        // Need to load the upcoming pair into slot 1
        const cached = this.cache.get(upcomingPairId);
        if (cached && this.onUploadToGpu) {
          this.onUploadToGpu(cached.data, 1);
          this.setGpuSlot(upcomingPairId, 1);
          needsRebuild = true;
        } else if (!this.loadingPairs.has(upcomingPairId) && this.onLoadPair) {
          // Need to load from disk
          this.preloadPair(upcomingPairId);
        }
      }
    }

    return {
      needsRebuild,
      newSlot0: this.gpuSlot0,
      newSlot1: this.gpuSlot1,
    };
  }

  /**
   * Preload a tileset pair in the background
   */
  private async preloadPair(pairId: string): Promise<void> {
    if (this.loadingPairs.has(pairId) || !this.onLoadPair) return;

    this.loadingPairs.add(pairId);
    this.emit({ type: 'preloadStarted', pairId });

    try {
      const pairData = await this.onLoadPair(pairId);
      this.addToCache(pairData);
      this.emit({ type: 'preloadCompleted', pairId });
    } catch (error) {
      console.error(`Failed to preload tileset pair ${pairId}:`, error);
    } finally {
      this.loadingPairs.delete(pairId);
    }
  }

  /**
   * Evict least recently used pairs from CPU cache if over limit
   */
  private evictIfNeeded(): void {
    while (this.cache.size >= MAX_CPU_CACHE) {
      let oldest: CachedPair | null = null;
      let oldestKey: string | null = null;

      for (const [key, cached] of this.cache) {
        // Don't evict pairs currently in GPU
        if (cached.gpuSlot !== null) continue;

        if (!oldest || cached.lastAccessFrame < oldest.lastAccessFrame) {
          oldest = cached;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.emit({ type: 'pairEvicted', pairId: oldestKey });
      } else {
        // Can't evict anything (all pairs are in GPU)
        break;
      }
    }
  }

  /**
   * Clear a GPU slot (when pair is no longer needed)
   */
  clearGpuSlot(slot: 0 | 1): void {
    const pairId = slot === 0 ? this.gpuSlot0 : this.gpuSlot1;
    if (pairId) {
      const cached = this.cache.get(pairId);
      if (cached) {
        cached.gpuSlot = null;
      }
    }

    if (slot === 0) {
      this.gpuSlot0 = null;
    } else {
      this.gpuSlot1 = null;
    }
  }

  /**
   * Get all detected boundaries (for debug visualization)
   */
  getBoundaries(): TilesetBoundary[] {
    return [...this.boundaries];
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheSize: number;
    gpuSlot0: string | null;
    gpuSlot1: string | null;
    boundaryCount: number;
    loadingCount: number;
  } {
    return {
      cacheSize: this.cache.size,
      gpuSlot0: this.gpuSlot0,
      gpuSlot1: this.gpuSlot1,
      boundaryCount: this.boundaries.length,
      loadingCount: this.loadingPairs.size,
    };
  }

  /**
   * Emit event to handlers
   */
  private emit(event: SchedulerEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.cache.clear();
    this.boundaries = [];
    this.gpuSlot0 = null;
    this.gpuSlot1 = null;
    this.loadingPairs.clear();
    this.eventHandlers = [];
  }
}
