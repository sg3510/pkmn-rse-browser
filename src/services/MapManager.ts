import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry, MapConnection, WarpEvent } from '../types/maps';
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
}

export interface LoadedMapData {
  entry: MapIndexEntry;
  mapData: MapData;
  borderMetatiles: number[]; // 2x2 repeating metatile IDs
  tilesets: TilesetResources;
  warpEvents: WarpEvent[];
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
    };

    this.tilesetCache.set(tilesetKey, resources);
    return resources;
  }

  private async loadWarpEvents(entry: MapIndexEntry): Promise<WarpEvent[]> {
    try {
      const jsonText = await loadText(`${PROJECT_ROOT}/data/maps/${entry.folder}/map.json`);
      const data = JSON.parse(jsonText) as { warp_events?: Array<Record<string, unknown>> };
      const warpEventsRaw = Array.isArray(data.warp_events) ? data.warp_events : [];
      return warpEventsRaw
        .map((warp, idx) => {
          const x = Number((warp as { x?: unknown }).x ?? 0);
          const y = Number((warp as { y?: unknown }).y ?? 0);
          const elevation = Number((warp as { elevation?: unknown }).elevation ?? 0);
          const destMap = String((warp as { dest_map?: unknown }).dest_map ?? '');
          const destWarpId = Number((warp as { dest_warp_id?: unknown }).dest_warp_id ?? idx);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !destMap) {
            return null;
          }
          return {
            x,
            y,
            elevation: Number.isFinite(elevation) ? elevation : 0,
            destMap,
            destWarpId: Number.isFinite(destWarpId) ? destWarpId : idx,
          } satisfies WarpEvent;
        })
        .filter((warp): warp is WarpEvent => !!warp);
    } catch (err) {
      console.warn(`Failed to load warp events for ${entry.id}:`, err);
      return [];
    }
  }

  public async loadMap(mapId: string): Promise<LoadedMapData> {
    const cached = this.mapCache.get(mapId);
    if (cached) return cached;

    const entry = this.mapIndex.get(mapId);
    if (!entry) {
      throw new Error(`Unknown map id: ${mapId}`);
    }

    const [mapData, borderMetatiles, tilesets, warpEvents] = await Promise.all([
      loadMapLayout(`${PROJECT_ROOT}/${entry.layoutPath}/map.bin`, entry.width, entry.height),
      loadBorderMetatiles(`${PROJECT_ROOT}/${entry.layoutPath}/border.bin`),
      this.loadTilesets(entry),
      this.loadWarpEvents(entry),
    ]);

    const loaded: LoadedMapData = {
      entry,
      mapData,
      borderMetatiles,
      tilesets,
      warpEvents,
    };

    this.mapCache.set(mapId, loaded);
    return loaded;
  }

  private static computeOffset(
    base: LoadedMapData,
    neighbor: LoadedMapData,
    connection: MapConnection,
    baseOffsetX = 0,
    baseOffsetY = 0
  ): { offsetX: number; offsetY: number } {
    const dir = connection.direction.toLowerCase();
    if (dir === 'up' || dir === 'north') {
      return { offsetX: baseOffsetX + connection.offset, offsetY: baseOffsetY - neighbor.mapData.height };
    }
    if (dir === 'down' || dir === 'south') {
      return { offsetX: baseOffsetX + connection.offset, offsetY: baseOffsetY + base.mapData.height };
    }
    if (dir === 'left' || dir === 'west') {
      return { offsetX: baseOffsetX - neighbor.mapData.width, offsetY: baseOffsetY + connection.offset };
    }
    if (dir === 'right' || dir === 'east') {
      return { offsetX: baseOffsetX + base.mapData.width, offsetY: baseOffsetY + connection.offset };
    }
    return { offsetX: baseOffsetX, offsetY: baseOffsetY };
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
        try {
          const neighbor = await this.loadMap(connection.map);
          const { offsetX, offsetY } = MapManager.computeOffset(
            current.map,
            neighbor,
            connection,
            current.offsetX,
            current.offsetY
          );
          queue.push({ map: neighbor, offsetX, offsetY, depth: current.depth + 1 });
        } catch (err) {
          console.warn(`Failed to load connected map ${connection.map}:`, err);
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
