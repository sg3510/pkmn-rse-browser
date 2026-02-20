import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry, WarpEvent } from '../types/maps';
import type { ObjectEventData } from '../types/objectEvents';
import {
  loadMapEvents,
  type ScriptCoordEvent,
  type WeatherCoordEvent,
  type BgEvent,
} from '../game/mapEventLoader';
export type { WarpEvent, ObjectEventData };
import {
  loadBorderMetatiles,
  loadMapLayout,
  loadMetatileAttributes,
  loadMetatileDefinitions,
  loadText,
  loadTilesetImage,
  parsePalette,
  type MapData,
  type Metatile,
  type MetatileAttributes,
  type Palette,
} from '../utils/mapLoader';
import type { LoadedAnimation } from '../utils/tilesetUtils';
import { isDebugMode } from '../utils/debug';
import {
  computeSpatialConnectionOffset,
  isSpatialConnectionDirection,
} from '../game/mapConnections';

const PROJECT_ROOT = '/pokeemerald';

const mapIndexData = mapIndexJson as MapIndexEntry[];

export interface TilesetResources {
  key: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryTilesImage: Uint8Array;
  secondaryTilesImage: Uint8Array;
  primaryPalettes: Palette[];
  secondaryPalettes: Palette[];
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
  animations: LoadedAnimation[];
}

export interface LoadedMapData {
  entry: MapIndexEntry;
  mapData: MapData;
  borderMetatiles: number[]; // 2x2 repeating metatile IDs
  tilesets: TilesetResources;
  warpEvents: WarpEvent[];
  objectEvents: ObjectEventData[];
  coordEvents: Array<ScriptCoordEvent | WeatherCoordEvent>;
  bgEvents: BgEvent[];
  mapWeather: string | null;
  mapRequiresFlash: boolean;
}

export interface WorldMapInstance extends LoadedMapData {
  offsetX: number; // in tiles
  offsetY: number; // in tiles
}

export interface WorldState {
  anchorId: string;
  maps: WorldMapInstance[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number }; // tile coords
}

export class MapManager {
  private mapIndex: Map<string, MapIndexEntry>;
  private mapCache = new Map<string, LoadedMapData>();
  private tilesetCache = new Map<string, TilesetResources>();

  constructor() {
    this.mapIndex = new Map(mapIndexData.map((entry) => [entry.id, entry]));
  }

  private getTilesetKey(primaryPath: string, secondaryPath: string) {
    return `${primaryPath}::${secondaryPath}`;
  }

  private async loadPalettes(basePath: string, count: number): Promise<Palette[]> {
    const palettes: Palette[] = [];
    for (let i = 0; i < count; i++) {
      const text = await loadText(`${PROJECT_ROOT}/${basePath}/palettes/${i.toString().padStart(2, '0')}.pal`);
      palettes.push(parsePalette(text));
    }
    return palettes;
  }

  private async loadTilesets(entry: MapIndexEntry): Promise<TilesetResources> {
    const tilesetKey = this.getTilesetKey(entry.primaryTilesetPath, entry.secondaryTilesetPath);
    const cached = this.tilesetCache.get(tilesetKey);
    if (cached) return cached;

    const [
      primaryMetatiles,
      secondaryMetatiles,
      primaryTilesImage,
      secondaryTilesImage,
      primaryAttributes,
      secondaryAttributes,
      primaryPalettes,
      secondaryPalettes,
    ] = await Promise.all([
      loadMetatileDefinitions(`${PROJECT_ROOT}/${entry.primaryTilesetPath}/metatiles.bin`),
      loadMetatileDefinitions(`${PROJECT_ROOT}/${entry.secondaryTilesetPath}/metatiles.bin`),
      loadTilesetImage(`${PROJECT_ROOT}/${entry.primaryTilesetPath}/tiles.png`),
      loadTilesetImage(`${PROJECT_ROOT}/${entry.secondaryTilesetPath}/tiles.png`),
      loadMetatileAttributes(`${PROJECT_ROOT}/${entry.primaryTilesetPath}/metatile_attributes.bin`),
      loadMetatileAttributes(`${PROJECT_ROOT}/${entry.secondaryTilesetPath}/metatile_attributes.bin`),
      this.loadPalettes(entry.primaryTilesetPath, 16),
      this.loadPalettes(entry.secondaryTilesetPath, 16),
    ]);

    const resources: TilesetResources = {
      key: tilesetKey,
      primaryTilesetId: entry.primaryTilesetId,
      secondaryTilesetId: entry.secondaryTilesetId,
      primaryTilesetPath: entry.primaryTilesetPath,
      secondaryTilesetPath: entry.secondaryTilesetPath,
      primaryMetatiles,
      secondaryMetatiles,
      primaryTilesImage,
      secondaryTilesImage,
      primaryPalettes,
      secondaryPalettes,
      primaryAttributes,
      secondaryAttributes,
      animations: [],
    };

    this.tilesetCache.set(tilesetKey, resources);
    return resources;
  }

  public async loadMap(mapId: string): Promise<LoadedMapData> {
    const cached = this.mapCache.get(mapId);
    if (cached) return cached;

    const entry = this.mapIndex.get(mapId);
    if (!entry) {
      throw new Error(`Unknown map id: ${mapId}`);
    }

    const [mapData, borderMetatiles, tilesets, mapEvents] = await Promise.all([
      loadMapLayout(`${PROJECT_ROOT}/${entry.layoutPath}/map.bin`, entry.width, entry.height),
      loadBorderMetatiles(`${PROJECT_ROOT}/${entry.layoutPath}/border.bin`),
      this.loadTilesets(entry),
      loadMapEvents(entry.folder),
    ]);

    const loaded: LoadedMapData = {
      entry,
      mapData,
      borderMetatiles,
      tilesets,
      warpEvents: mapEvents.warpEvents,
      objectEvents: mapEvents.objectEvents,
      coordEvents: mapEvents.coordEvents,
      bgEvents: mapEvents.bgEvents,
      mapWeather: mapEvents.mapWeather,
      mapRequiresFlash: mapEvents.mapRequiresFlash,
    };

    this.mapCache.set(mapId, loaded);
    return loaded;
  }

  /**
   * Load the anchor map and its direct connections into world space.
   * World origin is the anchor map's top-left at (0,0) in tiles.
   */
  public async buildWorld(anchorId: string, maxDepth = 1): Promise<WorldState> {
    const anchor = await this.loadMap(anchorId);
    const maps: WorldMapInstance[] = [];
    const visited = new Set<string>();
    const queue: Array<{ map: LoadedMapData; offsetX: number; offsetY: number; depth: number }> = [
      { map: anchor, offsetX: 0, offsetY: 0, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.map.entry.id)) continue;
      visited.add(current.map.entry.id);
      maps.push({ ...current.map, offsetX: current.offsetX, offsetY: current.offsetY });

      if (current.depth >= maxDepth) continue;

      for (const connection of current.map.entry.connections || []) {
        if (!isSpatialConnectionDirection(connection.direction)) continue;
        try {
          const neighbor = await this.loadMap(connection.map);
          const connectionOffset = computeSpatialConnectionOffset(
            { width: current.map.mapData.width, height: current.map.mapData.height },
            { width: neighbor.mapData.width, height: neighbor.mapData.height },
            connection,
            current.offsetX,
            current.offsetY
          );
          if (!connectionOffset) continue;
          const { offsetX, offsetY } = connectionOffset;
          queue.push({ map: neighbor, offsetX, offsetY, depth: current.depth + 1 });
        } catch (err) {
          if (isDebugMode()) {
            console.warn(`Failed to load connected map ${connection.map}:`, err);
          }
        }
      }
    }

    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;

    for (const map of maps) {
      minX = Math.min(minX, map.offsetX);
      minY = Math.min(minY, map.offsetY);
      maxX = Math.max(maxX, map.offsetX + map.mapData.width);
      maxY = Math.max(maxY, map.offsetY + map.mapData.height);
    }

    return {
      anchorId,
      maps,
      bounds: { minX, minY, maxX, maxY },
    };
  }
}
