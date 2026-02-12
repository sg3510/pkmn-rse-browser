/**
 * Snapshot Utilities
 *
 * Functions for converting WorldSnapshot to other formats used by the game.
 * These are WebGL-specific utilities that work with the snapshot-based world state.
 */

import type { LoadedMapInstance, WorldSnapshot, TilesetPairInfo } from './WorldManager';
import { buildTilesetRuntime, type TilesetRuntime, type ReflectionMeta } from '../utils/tilesetUtils';
import type { TilesetResources } from '../services/MapManager';
import type { RenderContext } from '../components/map/types';
import type { MapData, Metatile, MetatileAttributes, Palette, TilesetImageData } from '../utils/mapLoader';
import { resolveMetatileIndex } from '../utils/mapLoader';
import type { MapIndexEntry } from '../types/maps';
import type { LoadedAnimation } from '../rendering/types';
import { buildSnapshotSpatialIndex, type SnapshotSpatialIndex } from './snapshotSpatialIndex';
const snapshotSpatialIndexCache = new WeakMap<WorldSnapshot, SnapshotSpatialIndex>();

function getSnapshotSpatialIndex(snapshot: WorldSnapshot): SnapshotSpatialIndex {
  const cached = snapshotSpatialIndexCache.get(snapshot);
  if (cached) {
    return cached;
  }
  const built = buildSnapshotSpatialIndex(snapshot);
  snapshotSpatialIndexCache.set(snapshot, built);
  return built;
}

function isTileInMapBounds(map: LoadedMapInstance, tileX: number, tileY: number): boolean {
  return (
    tileX >= map.offsetX
    && tileX < map.offsetX + map.mapData.width
    && tileY >= map.offsetY
    && tileY < map.offsetY + map.mapData.height
  );
}

export function findSnapshotMapAtTile(
  snapshot: WorldSnapshot,
  tileX: number,
  tileY: number,
  mapIdHint?: string,
): LoadedMapInstance | null {
  if (mapIdHint) {
    const hinted = snapshot.maps.find((map) => map.entry.id === mapIdHint) ?? null;
    if (hinted && isTileInMapBounds(hinted, tileX, tileY)) {
      return hinted;
    }
  }

  const spatialIndex = getSnapshotSpatialIndex(snapshot);
  const byPosition = spatialIndex.getMapAt(tileX, tileY);
  if (byPosition) {
    return byPosition;
  }

  if (mapIdHint) {
    return snapshot.maps.find((map) => map.entry.id === mapIdHint) ?? null;
  }

  return null;
}

export function getSnapshotTileBehavior(
  snapshot: WorldSnapshot,
  tileX: number,
  tileY: number,
  mapIdHint?: string,
): { map: LoadedMapInstance | null; behavior: number } {
  const map = findSnapshotMapAtTile(snapshot, tileX, tileY, mapIdHint);
  if (!map || !isTileInMapBounds(map, tileX, tileY)) {
    return { map, behavior: 0 };
  }

  const localX = tileX - map.offsetX;
  const localY = tileY - map.offsetY;
  const tileIndex = localY * map.mapData.width + localX;
  const mapTile = map.mapData.layout[tileIndex];
  if (!mapTile) {
    return { map, behavior: 0 };
  }

  const pairIndex = snapshot.mapTilesetPairIndex.get(map.entry.id) ?? map.tilesetPairIndex;
  const tilesetPair = snapshot.tilesetPairs[pairIndex];
  if (!tilesetPair) {
    return { map, behavior: 0 };
  }

  const { isSecondary, index } = resolveMetatileIndex(mapTile.metatileId);
  const attributes = isSecondary
    ? tilesetPair.secondaryAttributes[index]
    : tilesetPair.primaryAttributes[index];

  return { map, behavior: attributes?.behavior ?? 0 };
}

/**
 * Result of reflection metadata lookup
 */
export interface ReflectionMetaResult {
  behavior: number;
  meta: ReflectionMeta | null;
}

/**
 * Convert TilesetPairInfo to TilesetResources format.
 * Used when creating RenderContext or building tileset runtimes.
 */
export function tilesetPairToResources(pair: TilesetPairInfo): TilesetResources {
  return {
    key: pair.id,
    primaryTilesetId: pair.primaryTilesetId,
    secondaryTilesetId: pair.secondaryTilesetId,
    primaryTilesetPath: '',
    secondaryTilesetPath: '',
    primaryMetatiles: pair.primaryMetatiles,
    secondaryMetatiles: pair.secondaryMetatiles,
    primaryPalettes: pair.primaryPalettes,
    secondaryPalettes: pair.secondaryPalettes,
    primaryTilesImage: pair.primaryImage.data,
    secondaryTilesImage: pair.secondaryImage.data,
    primaryAttributes: pair.primaryAttributes,
    secondaryAttributes: pair.secondaryAttributes,
    animations: pair.animations,
  };
}

/**
 * Map instance in a stitched world (simplified from snapshot)
 */
export interface StitchedMapInstance {
  entry: MapIndexEntry;
  mapData: MapData;
  offsetX: number;
  offsetY: number;
}

/**
 * Legacy stitched world data format.
 * Used for backward compatibility with debug display and other systems
 * that haven't been updated to use WorldSnapshot directly.
 */
export interface StitchedWorldData {
  maps: StitchedMapInstance[];
  anchorId: string;
  worldBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  tilesetPairs: TilesetPairInfo[];
  mapTilesetPairIndex: Map<string, number>;
  // Legacy single-tileset fields (references tilesetPairs[0])
  primaryMetatiles: Metatile[];
  secondaryMetatiles: Metatile[];
  primaryAttributes: MetatileAttributes[];
  secondaryAttributes: MetatileAttributes[];
  primaryImage: TilesetImageData;
  secondaryImage: TilesetImageData;
  primaryPalettes: Palette[];
  secondaryPalettes: Palette[];
  animations: LoadedAnimation[];
  borderMetatiles: number[];
}

/**
 * Create StitchedWorldData from a WorldSnapshot.
 * This is a legacy format used for backward compatibility with debug display.
 */
export function createStitchedWorldFromSnapshot(snapshot: WorldSnapshot): StitchedWorldData {
  const primaryPair = snapshot.tilesetPairs[0];

  return {
    maps: snapshot.maps.map(m => ({
      entry: m.entry,
      mapData: m.mapData,
      offsetX: m.offsetX,
      offsetY: m.offsetY,
    })),
    anchorId: snapshot.anchorMapId,
    worldBounds: snapshot.worldBounds,
    tilesetPairs: snapshot.tilesetPairs,
    mapTilesetPairIndex: snapshot.mapTilesetPairIndex,
    // Legacy fields from primary pair
    primaryMetatiles: primaryPair?.primaryMetatiles ?? [],
    secondaryMetatiles: primaryPair?.secondaryMetatiles ?? [],
    primaryAttributes: primaryPair?.primaryAttributes ?? [],
    secondaryAttributes: primaryPair?.secondaryAttributes ?? [],
    primaryImage: primaryPair?.primaryImage ?? { data: new Uint8Array(), width: 0, height: 0 },
    secondaryImage: primaryPair?.secondaryImage ?? { data: new Uint8Array(), width: 0, height: 0 },
    primaryPalettes: primaryPair?.primaryPalettes ?? [],
    secondaryPalettes: primaryPair?.secondaryPalettes ?? [],
    animations: primaryPair?.animations ?? [],
    borderMetatiles: snapshot.anchorBorderMetatiles ?? [],
  };
}

/**
 * Build tileset runtimes for all tileset pairs in a snapshot.
 * Updates the provided Map with new runtimes (skips existing ones).
 *
 * @param snapshot - The world snapshot containing tileset pairs
 * @param runtimesMap - Map to populate with TilesetRuntime instances
 */
export function buildTilesetRuntimesForSnapshot(
  snapshot: WorldSnapshot,
  runtimesMap: Map<string, TilesetRuntime>
): void {
  for (const pair of snapshot.tilesetPairs) {
    if (runtimesMap.has(pair.id)) continue;

    const resources = tilesetPairToResources(pair);
    const runtime = buildTilesetRuntime(resources);
    runtimesMap.set(pair.id, runtime);
  }
}

/**
 * Get reflection metadata for a tile from a WorldSnapshot.
 *
 * This function looks up the tile in all loaded maps and returns the behavior
 * and reflection metadata. Falls back to border tiles if the position is outside
 * all loaded maps.
 *
 * @param snapshot - The current world snapshot
 * @param tilesetRuntimes - Map of tileset runtimes for reflection metadata
 * @param tileX - World tile X coordinate
 * @param tileY - World tile Y coordinate
 * @returns Reflection metadata result, or null if tile not found
 */
export function getReflectionMetaFromSnapshot(
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntime>,
  tileX: number,
  tileY: number
): ReflectionMetaResult | null {
  const { maps, tilesetPairs, mapTilesetPairIndex, anchorBorderMetatiles, anchorMapId } = snapshot;
  const spatialIndex = getSnapshotSpatialIndex(snapshot);

  const map = spatialIndex.getMapAt(tileX, tileY);
  if (map) {
    const localX = tileX - map.offsetX;
    const localY = tileY - map.offsetY;

    const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
    const pair = tilesetPairs[pairIndex];

    const idx = localY * map.entry.width + localX;
    const mapTile = map.mapData.layout[idx];
    const metatileId = mapTile.metatileId;

    const { isSecondary, index: attrIndex } = resolveMetatileIndex(metatileId);
    const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
    const behavior = attrArray[attrIndex]?.behavior ?? 0;

    // Get reflection meta from runtime
    // First try the expected pair ID, then try all runtimes as fallback
    let runtime = tilesetRuntimes.get(pair.id);

    // Fallback: try first available runtime (for single-tileset scenarios)
    if (!runtime && tilesetRuntimes.size > 0) {
      runtime = tilesetRuntimes.values().next().value;
    }

    if (!runtime) return { behavior, meta: null };

    const meta = isSecondary
      ? runtime.secondaryReflectionMeta[attrIndex]
      : runtime.primaryReflectionMeta[attrIndex];

    return { behavior, meta: meta ?? null };
  }

  // BORDER FALLBACK: Tile is outside all loaded maps
  // Use anchor map's border metatiles (same logic as Canvas2D's resolveTileAt)
  if (!anchorBorderMetatiles || anchorBorderMetatiles.length === 0) {
    return null;
  }

  // Find anchor map to get its tileset pair
  const anchorMap = maps.find((m) => m.entry.id === anchorMapId);
  if (!anchorMap) return null;

  const anchorPairIndex = mapTilesetPairIndex.get(anchorMapId) ?? 0;
  const anchorPair = tilesetPairs[anchorPairIndex];
  if (!anchorPair) return null;

  // Calculate local coords relative to anchor for 2x2 repeating border pattern
  const anchorLocalX = tileX - anchorMap.offsetX;
  const anchorLocalY = tileY - anchorMap.offsetY;
  const borderIndex = (anchorLocalX & 1) + ((anchorLocalY & 1) * 2);
  const borderMetatileId = anchorBorderMetatiles[borderIndex % anchorBorderMetatiles.length];

  const { isSecondary, index: attrIndex } = resolveMetatileIndex(borderMetatileId);
  const attrArray = isSecondary ? anchorPair.secondaryAttributes : anchorPair.primaryAttributes;
  const behavior = attrArray[attrIndex]?.behavior ?? 0;

  // Get reflection meta from runtime (with fallback)
  let runtime = tilesetRuntimes.get(anchorPair.id);
  if (!runtime && tilesetRuntimes.size > 0) {
    runtime = tilesetRuntimes.values().next().value;
  }
  if (!runtime) return { behavior, meta: null };

  const meta = isSecondary
    ? runtime.secondaryReflectionMeta[attrIndex]
    : runtime.primaryReflectionMeta[attrIndex];

  return { behavior, meta: meta ?? null };
}

/**
 * Create a RenderContext from a WorldSnapshot.
 *
 * This converts the snapshot-based world state to the RenderContext format
 * used by field effects, warp detection, and other Canvas2D-compatible code.
 *
 * @param snapshot - The current world snapshot
 * @param tilesetRuntimes - Map of tileset runtimes
 * @returns RenderContext or null if snapshot is empty
 */
export function createRenderContextFromSnapshot(
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntime>
): RenderContext | null {
  const { maps, tilesetPairs, mapTilesetPairIndex } = snapshot;
  if (maps.length === 0 || tilesetPairs.length === 0) return null;

  // Find anchor map (the one at offset 0,0 or the first one)
  const anchorMap = maps.find((m) => m.offsetX === 0 && m.offsetY === 0) ?? maps[0];
  const anchorPairIndex = mapTilesetPairIndex.get(anchorMap.entry.id) ?? 0;
  const anchorPair = tilesetPairs[anchorPairIndex];

  // Create TilesetResources for the anchor
  const anchorTilesetResources = tilesetPairToResources(anchorPair);

  // Create WorldMapInstance-like objects
  const worldMaps = maps.map((m) => {
    const pairIndex = mapTilesetPairIndex.get(m.entry.id) ?? 0;
    const pair = tilesetPairs[pairIndex];
    return {
      entry: m.entry,
      mapData: m.mapData,
      offsetX: m.offsetX,
      offsetY: m.offsetY,
      borderMetatiles: [],
      tilesets: tilesetPairToResources(pair),
      warpEvents: m.warpEvents ?? [],
      objectEvents: [],
      coordEvents: [],
      bgEvents: [],
      mapWeather: m.mapWeather ?? null,
    };
  });

  // Create anchor WorldMapInstance
  const anchor = worldMaps.find((m) => m.offsetX === 0 && m.offsetY === 0) ?? worldMaps[0];
  const tileLookup = new Map<string, (typeof worldMaps)[number]>();
  for (const map of worldMaps) {
    const minX = map.offsetX;
    const maxX = map.offsetX + map.mapData.width - 1;
    const minY = map.offsetY;
    const maxY = map.offsetY + map.mapData.height - 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`;
        if (!tileLookup.has(key)) {
          tileLookup.set(key, map);
        }
      }
    }
  }

  return {
    world: {
      anchorId: snapshot.anchorMapId,
      maps: worldMaps,
      bounds: {
        minX: snapshot.worldBounds.minX,
        minY: snapshot.worldBounds.minY,
        maxX: snapshot.worldBounds.maxX,
        maxY: snapshot.worldBounds.maxY,
      },
    },
    tilesetRuntimes,
    tileLookup,
    anchor: {
      ...anchor,
      tilesets: anchorTilesetResources,
      borderMetatiles: snapshot.anchorBorderMetatiles ?? [],
    },
  } as RenderContext;
}
