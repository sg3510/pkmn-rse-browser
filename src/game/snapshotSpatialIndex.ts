import type { LoadedMapInstance, WorldSnapshot } from './WorldManager';

interface MapBounds {
  map: LoadedMapInstance;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function buildMapBounds(map: LoadedMapInstance): MapBounds {
  return {
    map,
    minX: map.offsetX,
    maxX: map.offsetX + map.entry.width - 1,
    minY: map.offsetY,
    maxY: map.offsetY + map.entry.height - 1,
  };
}

function distanceToBoundsSquared(x: number, y: number, bounds: MapBounds): number {
  const dx = x < bounds.minX ? bounds.minX - x : x > bounds.maxX ? x - bounds.maxX : 0;
  const dy = y < bounds.minY ? bounds.minY - y : y > bounds.maxY ? y - bounds.maxY : 0;
  return dx * dx + dy * dy;
}

export interface SnapshotSpatialIndex {
  getMapAt: (tileX: number, tileY: number) => LoadedMapInstance | null;
  getNearestMap: (tileX: number, tileY: number, allowedMapIds?: Set<string>) => LoadedMapInstance | null;
}

export function buildSnapshotSpatialIndex(snapshot: WorldSnapshot): SnapshotSpatialIndex {
  const bounds = snapshot.maps.map(buildMapBounds);
  const tileToMap = new Map<string, LoadedMapInstance>();
  const nearestCacheAll = new Map<string, LoadedMapInstance | null>();
  const nearestCacheByMapSet = new Map<string, Map<string, LoadedMapInstance | null>>();

  for (const mapBounds of bounds) {
    for (let y = mapBounds.minY; y <= mapBounds.maxY; y++) {
      for (let x = mapBounds.minX; x <= mapBounds.maxX; x++) {
        const key = tileKey(x, y);
        if (!tileToMap.has(key)) {
          tileToMap.set(key, mapBounds.map);
        }
      }
    }
  }

  const getNearestMapUncached = (tileX: number, tileY: number, allowedMapIds?: Set<string>): LoadedMapInstance | null => {
    let nearest: LoadedMapInstance | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const mapBounds of bounds) {
      if (allowedMapIds && !allowedMapIds.has(mapBounds.map.entry.id)) {
        continue;
      }

      const distance = distanceToBoundsSquared(tileX, tileY, mapBounds);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = mapBounds.map;
      }
    }

    return nearest;
  };

  return {
    getMapAt: (tileX: number, tileY: number) => tileToMap.get(tileKey(tileX, tileY)) ?? null,
    getNearestMap: (tileX: number, tileY: number, allowedMapIds?: Set<string>) => {
      const key = tileKey(tileX, tileY);

      if (!allowedMapIds) {
        if (nearestCacheAll.has(key)) {
          return nearestCacheAll.get(key) ?? null;
        }
        const nearest = getNearestMapUncached(tileX, tileY);
        nearestCacheAll.set(key, nearest);
        return nearest;
      }

      const mapSetKey = [...allowedMapIds].sort().join('|');
      let cache = nearestCacheByMapSet.get(mapSetKey);
      if (!cache) {
        cache = new Map<string, LoadedMapInstance | null>();
        nearestCacheByMapSet.set(mapSetKey, cache);
      }
      if (cache.has(key)) {
        return cache.get(key) ?? null;
      }

      const nearest = getNearestMapUncached(tileX, tileY, allowedMapIds);
      cache.set(key, nearest);
      return nearest;
    },
  };
}
