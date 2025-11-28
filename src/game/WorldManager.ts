/**
 * WorldManager - Dynamic infinite world management
 *
 * Manages the seamless loading and unloading of connected maps as the player
 * moves through the world. Handles:
 * - Dynamic map loading based on player position
 * - Map unloading when too far from player
 * - World re-anchoring to prevent coordinate overflow
 * - Tileset pair management (max 2 pairs for GPU)
 *
 * The world is always centered around an "anchor" map. When the player moves
 * far enough from the anchor, the world is re-anchored to the player's current
 * map, and all map offsets are recalculated.
 */

import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import {
  loadMapLayout,
  loadTilesetImage,
  loadText,
  parsePalette,
  loadMetatileDefinitions,
  loadMetatileAttributes,
  loadBorderMetatiles,
  loadBinary,
  type Palette,
  type TilesetImageData,
  type Metatile,
  type MapData,
  type MetatileAttributes,
} from '../utils/mapLoader';
import type { LoadedAnimation } from '../rendering/types';
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import UPNG from 'upng-js';

const PROJECT_ROOT = '/pokeemerald';
const NUM_PALS_IN_PRIMARY = 6;
const NUM_PALS_TOTAL = 13;
const TILE_SIZE = 8;

/** Maximum number of tileset pairs GPU can handle */
const MAX_TILESET_PAIRS = 2;

/** Distance in tiles from anchor before re-anchoring */
const REANCHOR_DISTANCE = 50;

/** Maximum depth for map loading from current position */
const LOAD_DEPTH = 3;

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
}

/**
 * World state snapshot for rendering
 */
export interface WorldSnapshot {
  maps: LoadedMapInstance[];
  tilesetPairs: TilesetPairInfo[];
  mapTilesetPairIndex: Map<string, number>;
  borderMetatilesPerPair: Map<number, number[]>;
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
  | { type: 'tilesetsChanged'; pair0: TilesetPairInfo; pair1: TilesetPairInfo | null }
  | { type: 'reanchored'; newAnchorId: string; offsetShift: { x: number; y: number } };

export type WorldManagerEventHandler = (event: WorldManagerEvent) => void;

/**
 * Manages dynamic world loading and unloading
 */
export class WorldManager {
  private maps: Map<string, LoadedMapInstance> = new Map();
  private tilesetPairs: TilesetPairInfo[] = [];
  private tilesetPairMap: Map<string, number> = new Map();  // pairId -> index
  private mapTilesetPairIndex: Map<string, number> = new Map();
  private borderMetatilesPerPair: Map<number, number[]> = new Map();

  private anchorMapId: string = '';
  private anchorOffsetX: number = 0;
  private anchorOffsetY: number = 0;

  private eventHandlers: WorldManagerEventHandler[] = [];
  private loadingMaps: Set<string> = new Set();

  /**
   * Initialize the world with a starting map
   */
  async initialize(startMapId: string): Promise<WorldSnapshot> {
    const startEntry = mapIndexData.find(m => m.id === startMapId);
    if (!startEntry) {
      throw new Error(`Map not found: ${startMapId}`);
    }

    this.anchorMapId = startMapId;
    this.anchorOffsetX = 0;
    this.anchorOffsetY = 0;

    // Load initial world
    await this.loadMapsFromAnchor(startEntry, 0, 0, LOAD_DEPTH);

    return this.getSnapshot();
  }

  /**
   * Update world based on player position
   * Call this each frame or when player moves significantly
   */
  async update(playerTileX: number, playerTileY: number): Promise<void> {
    // Find which map the player is currently in
    const currentMap = this.findMapAtPosition(playerTileX, playerTileY);
    if (!currentMap) return;

    // Check if we need to re-anchor
    const distFromAnchor = Math.max(
      Math.abs(playerTileX - this.anchorOffsetX),
      Math.abs(playerTileY - this.anchorOffsetY)
    );

    if (distFromAnchor > REANCHOR_DISTANCE && currentMap.entry.id !== this.anchorMapId) {
      await this.reanchor(currentMap);
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

    return {
      maps: mapsArray,
      tilesetPairs: [...this.tilesetPairs],
      mapTilesetPairIndex: new Map(this.mapTilesetPairIndex),
      borderMetatilesPerPair: new Map(this.borderMetatilesPerPair),
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
   * Re-anchor the world around a new map
   */
  private async reanchor(newAnchorMap: LoadedMapInstance): Promise<void> {
    // New anchor is at the center of the new anchor map
    this.anchorMapId = newAnchorMap.entry.id;
    this.anchorOffsetX = newAnchorMap.offsetX;
    this.anchorOffsetY = newAnchorMap.offsetY;

    // Calculate offset shift
    const shiftX = newAnchorMap.offsetX;
    const shiftY = newAnchorMap.offsetY;

    // Shift all map positions
    for (const map of this.maps.values()) {
      map.offsetX -= shiftX;
      map.offsetY -= shiftY;
    }

    // Update anchor offset (now at 0,0)
    this.anchorOffsetX = 0;
    this.anchorOffsetY = 0;

    // Unload maps that are too far from new anchor
    const mapsToUnload: string[] = [];
    for (const map of this.maps.values()) {
      const dist = Math.max(
        Math.abs(map.offsetX),
        Math.abs(map.offsetY)
      );
      if (dist > REANCHOR_DISTANCE * 2) {
        mapsToUnload.push(map.entry.id);
      }
    }

    for (const mapId of mapsToUnload) {
      this.maps.delete(mapId);
      this.mapTilesetPairIndex.delete(mapId);
    }

    // Emit event
    this.emit({
      type: 'reanchored',
      newAnchorId: this.anchorMapId,
      offsetShift: { x: shiftX, y: shiftY },
    });

    // Emit maps changed
    this.emit({ type: 'mapsChanged', snapshot: this.getSnapshot() });
  }

  /**
   * Load maps connected to a given map
   */
  private async loadConnectedMaps(fromMap: LoadedMapInstance): Promise<void> {
    const connections = fromMap.entry.connections || [];

    for (const connection of connections) {
      if (this.maps.has(connection.map) || this.loadingMaps.has(connection.map)) {
        continue;
      }

      const neighborEntry = mapIndexData.find(m => m.id === connection.map);
      if (!neighborEntry) continue;

      // Calculate offset for connected map
      const { offsetX, offsetY } = this.computeConnectionOffset(
        fromMap.entry,
        neighborEntry,
        connection,
        fromMap.offsetX,
        fromMap.offsetY
      );

      // Check if we can load this map (tileset pair limit)
      const pairId = this.getTilesetPairId(neighborEntry.primaryTilesetId, neighborEntry.secondaryTilesetId);
      if (!this.tilesetPairMap.has(pairId) && this.tilesetPairs.length >= MAX_TILESET_PAIRS) {
        // Can't load - would exceed tileset pair limit
        continue;
      }

      // Load the map
      await this.loadMap(neighborEntry, offsetX, offsetY);
    }
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
    const queue: Array<{ entry: MapIndexEntry; offsetX: number; offsetY: number; depth: number }> = [
      { entry: anchorEntry, offsetX: anchorOffsetX, offsetY: anchorOffsetY, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (this.maps.has(current.entry.id)) continue;

      // Check tileset pair limit
      const pairId = this.getTilesetPairId(current.entry.primaryTilesetId, current.entry.secondaryTilesetId);
      if (!this.tilesetPairMap.has(pairId) && this.tilesetPairs.length >= MAX_TILESET_PAIRS) {
        continue;
      }

      // Load the map
      await this.loadMap(current.entry, current.offsetX, current.offsetY);

      // Queue connected maps if not at max depth
      if (current.depth < maxDepth) {
        for (const connection of current.entry.connections || []) {
          const neighborEntry = mapIndexData.find(m => m.id === connection.map);
          if (!neighborEntry || this.maps.has(neighborEntry.id)) continue;

          const { offsetX, offsetY } = this.computeConnectionOffset(
            current.entry,
            neighborEntry,
            connection,
            current.offsetX,
            current.offsetY
          );

          queue.push({ entry: neighborEntry, offsetX, offsetY, depth: current.depth + 1 });
        }
      }
    }
  }

  /**
   * Load a single map
   */
  private async loadMap(entry: MapIndexEntry, offsetX: number, offsetY: number): Promise<void> {
    if (this.maps.has(entry.id) || this.loadingMaps.has(entry.id)) return;

    this.loadingMaps.add(entry.id);

    try {
      // Ensure tileset pair is loaded
      const pairId = this.getTilesetPairId(entry.primaryTilesetId, entry.secondaryTilesetId);
      let pairIndex = this.tilesetPairMap.get(pairId);

      if (pairIndex === undefined) {
        if (this.tilesetPairs.length >= MAX_TILESET_PAIRS) {
          throw new Error(`Cannot load map ${entry.id}: tileset pair limit exceeded`);
        }

        const pair = await this.loadTilesetPair(entry);
        pairIndex = this.tilesetPairs.length;
        this.tilesetPairs.push(pair);
        this.tilesetPairMap.set(pairId, pairIndex);

        // Load border metatiles for this pair
        const layoutPath = `${PROJECT_ROOT}/${entry.layoutPath}`;
        const border = await loadBorderMetatiles(`${layoutPath}/border.bin`).catch(() => [] as number[]);
        this.borderMetatilesPerPair.set(pairIndex, border);

        // Emit tileset change
        this.emit({
          type: 'tilesetsChanged',
          pair0: this.tilesetPairs[0],
          pair1: this.tilesetPairs[1] ?? null,
        });
      }

      // Load map layout
      const layoutPath = `${PROJECT_ROOT}/${entry.layoutPath}`;
      const mapData = await loadMapLayout(`${layoutPath}/map.bin`, entry.width, entry.height);

      const mapInstance: LoadedMapInstance = {
        entry,
        mapData,
        offsetX,
        offsetY,
        tilesetPairIndex: pairIndex,
      };

      this.maps.set(entry.id, mapInstance);
      this.mapTilesetPairIndex.set(entry.id, pairIndex);

      // Emit maps changed
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
  ): { offsetX: number; offsetY: number } {
    const dir = connection.direction.toLowerCase();
    if (dir === 'up' || dir === 'north') {
      return { offsetX: baseOffsetX + connection.offset, offsetY: baseOffsetY - neighborEntry.height };
    }
    if (dir === 'down' || dir === 'south') {
      return { offsetX: baseOffsetX + connection.offset, offsetY: baseOffsetY + baseEntry.height };
    }
    if (dir === 'left' || dir === 'west') {
      return { offsetX: baseOffsetX - neighborEntry.width, offsetY: baseOffsetY + connection.offset };
    }
    if (dir === 'right' || dir === 'east') {
      return { offsetX: baseOffsetX + baseEntry.width, offsetY: baseOffsetY + connection.offset };
    }
    return { offsetX: baseOffsetX, offsetY: baseOffsetY };
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
    const loaded: LoadedAnimation[] = [];
    const requested = [
      ...(TILESET_ANIMATION_CONFIGS[primaryId] ?? []),
      ...(TILESET_ANIMATION_CONFIGS[secondaryId] ?? []),
    ];

    for (const def of requested) {
      try {
        const frames: Uint8Array[] = [];
        let width = 0;
        let height = 0;

        for (const framePath of def.frames) {
          const frame = await this.loadIndexedFrame(`${PROJECT_ROOT}/${framePath}`);
          frames.push(frame.data);
          width = frame.width;
          height = frame.height;
        }

        const tilesWide = Math.max(1, Math.floor(width / TILE_SIZE));
        const tilesHigh = Math.max(1, Math.floor(height / TILE_SIZE));
        const sequence = def.sequence ?? frames.map((_, i) => i);

        loaded.push({
          id: def.id,
          tileset: def.tileset,
          frames,
          width,
          height,
          tilesWide,
          tilesHigh,
          sequence,
          interval: def.interval,
          destinations: def.destinations,
          altSequence: def.altSequence,
          altSequenceThreshold: def.altSequenceThreshold,
        });
      } catch {
        // Skip missing animation assets
      }
    }

    return loaded;
  }

  /**
   * Decode indexed PNG frame
   */
  private async loadIndexedFrame(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
    const buffer = await loadBinary(url);
    const img = UPNG.decode(buffer);

    let data: Uint8Array;
    if (img.ctype === 3 && img.depth === 4) {
      const packed = new Uint8Array(img.data);
      const unpacked = new Uint8Array(packed.length * 2);
      for (let i = 0; i < packed.length; i++) {
        const byte = packed[i];
        unpacked[i * 2] = (byte >> 4) & 0xf;
        unpacked[i * 2 + 1] = byte & 0xf;
      }
      data = unpacked;
    } else {
      data = new Uint8Array(img.data);
    }

    return { data, width: img.width, height: img.height };
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
   * Clean up resources
   */
  dispose(): void {
    this.maps.clear();
    this.tilesetPairs = [];
    this.tilesetPairMap.clear();
    this.mapTilesetPairIndex.clear();
    this.borderMetatilesPerPair.clear();
    this.eventHandlers = [];
    this.loadingMaps.clear();
  }
}
