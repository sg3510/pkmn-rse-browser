import type { LoadedMapInstance, WorldSnapshot } from './WorldManager';

export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export interface TileBounds {
  minTileX: number;
  minTileY: number;
  maxTileX: number;
  maxTileY: number;
}

export interface ViewportCoverageHint extends TileBounds {
  viewportTilesWide: number;
  viewportTilesHigh: number;
  preloadMarginTiles: number;
  focusTileX: number;
  focusTileY: number;
  direction: CardinalDirection | null;
}

export interface VisiblePairPriority {
  pairId: string;
  coverageTiles: number;
  nearestTileDistanceSq: number;
}

export interface ViewportCoverageSummary {
  visibleMapIds: Set<string>;
  visiblePairIds: Set<string>;
  visiblePairPriorities: VisiblePairPriority[];
  expandedBounds: TileBounds;
}

interface PairAccum {
  pairId: string;
  coverageTiles: number;
  nearestTileDistanceSq: number;
}

function distanceToMapBoundsSquared(
  tileX: number,
  tileY: number,
  map: Pick<LoadedMapInstance, 'offsetX' | 'offsetY' | 'entry'>
): number {
  const minX = map.offsetX;
  const minY = map.offsetY;
  const maxX = map.offsetX + map.entry.width - 1;
  const maxY = map.offsetY + map.entry.height - 1;
  const dx = tileX < minX ? minX - tileX : tileX > maxX ? tileX - maxX : 0;
  const dy = tileY < minY ? minY - tileY : tileY > maxY ? tileY - maxY : 0;
  return dx * dx + dy * dy;
}

function mapBounds(
  map: Pick<LoadedMapInstance, 'offsetX' | 'offsetY' | 'entry'>
): TileBounds {
  return {
    minTileX: map.offsetX,
    minTileY: map.offsetY,
    maxTileX: map.offsetX + map.entry.width - 1,
    maxTileY: map.offsetY + map.entry.height - 1,
  };
}

export function expandTileBounds(bounds: TileBounds, marginTiles: number): TileBounds {
  const margin = Math.max(0, Math.floor(marginTiles));
  return {
    minTileX: bounds.minTileX - margin,
    minTileY: bounds.minTileY - margin,
    maxTileX: bounds.maxTileX + margin,
    maxTileY: bounds.maxTileY + margin,
  };
}

export function intersectsTileBounds(a: TileBounds, b: TileBounds): boolean {
  return !(
    a.maxTileX < b.minTileX
    || a.minTileX > b.maxTileX
    || a.maxTileY < b.minTileY
    || a.minTileY > b.maxTileY
  );
}

export function mapIntersectsTileBounds(
  map: Pick<LoadedMapInstance, 'offsetX' | 'offsetY' | 'entry'>,
  bounds: TileBounds
): boolean {
  return intersectsTileBounds(mapBounds(map), bounds);
}

export function mapIntersectionAreaWithBounds(
  map: Pick<LoadedMapInstance, 'offsetX' | 'offsetY' | 'entry'>,
  bounds: TileBounds
): number {
  const mapRect = mapBounds(map);
  const minX = Math.max(mapRect.minTileX, bounds.minTileX);
  const maxX = Math.min(mapRect.maxTileX, bounds.maxTileX);
  const minY = Math.max(mapRect.minTileY, bounds.minTileY);
  const maxY = Math.min(mapRect.maxTileY, bounds.maxTileY);
  if (minX > maxX || minY > maxY) {
    return 0;
  }
  return (maxX - minX + 1) * (maxY - minY + 1);
}

export function buildViewportCoverageHint(params: {
  startTileX: number;
  startTileY: number;
  tilesWide: number;
  tilesHigh: number;
  focusTileX: number;
  focusTileY: number;
  direction: CardinalDirection | null;
  preloadMarginTiles?: number;
}): ViewportCoverageHint {
  const width = Math.max(1, Math.floor(params.tilesWide));
  const height = Math.max(1, Math.floor(params.tilesHigh));
  const preloadMarginTiles = Math.max(0, Math.floor(params.preloadMarginTiles ?? 0));
  return {
    minTileX: Math.floor(params.startTileX),
    minTileY: Math.floor(params.startTileY),
    maxTileX: Math.floor(params.startTileX) + width - 1,
    maxTileY: Math.floor(params.startTileY) + height - 1,
    viewportTilesWide: width,
    viewportTilesHigh: height,
    preloadMarginTiles,
    focusTileX: Math.floor(params.focusTileX),
    focusTileY: Math.floor(params.focusTileY),
    direction: params.direction,
  };
}

export function computeViewportCoverageForMaps(params: {
  maps: LoadedMapInstance[];
  resolvePairId: (mapId: string) => string | null;
  hint: ViewportCoverageHint;
}): ViewportCoverageSummary {
  const { maps, resolvePairId, hint } = params;
  const expandedBounds = expandTileBounds(hint, hint.preloadMarginTiles);
  const visibleMapIds = new Set<string>();
  const visiblePairIds = new Set<string>();
  const pairAccum = new Map<string, PairAccum>();

  for (const map of maps) {
    const area = mapIntersectionAreaWithBounds(map, expandedBounds);
    if (area <= 0) {
      continue;
    }

    visibleMapIds.add(map.entry.id);
    const pairId = resolvePairId(map.entry.id);
    if (!pairId) {
      continue;
    }

    visiblePairIds.add(pairId);
    const nearestTileDistanceSq = distanceToMapBoundsSquared(hint.focusTileX, hint.focusTileY, map);
    const existing = pairAccum.get(pairId);
    if (!existing) {
      pairAccum.set(pairId, {
        pairId,
        coverageTiles: area,
        nearestTileDistanceSq,
      });
      continue;
    }

    existing.coverageTiles += area;
    if (nearestTileDistanceSq < existing.nearestTileDistanceSq) {
      existing.nearestTileDistanceSq = nearestTileDistanceSq;
    }
  }

  const visiblePairPriorities = Array.from(pairAccum.values())
    .sort((a, b) => {
      if (b.coverageTiles !== a.coverageTiles) {
        return b.coverageTiles - a.coverageTiles;
      }
      if (a.nearestTileDistanceSq !== b.nearestTileDistanceSq) {
        return a.nearestTileDistanceSq - b.nearestTileDistanceSq;
      }
      return a.pairId.localeCompare(b.pairId);
    })
    .map((entry) => ({
      pairId: entry.pairId,
      coverageTiles: entry.coverageTiles,
      nearestTileDistanceSq: entry.nearestTileDistanceSq,
    }));

  return {
    visibleMapIds,
    visiblePairIds,
    visiblePairPriorities,
    expandedBounds,
  };
}

export function computeViewportCoverageForSnapshot(
  snapshot: WorldSnapshot,
  hint: ViewportCoverageHint
): ViewportCoverageSummary {
  return computeViewportCoverageForMaps({
    maps: snapshot.maps,
    resolvePairId: (mapId: string) => {
      const pairIndex = snapshot.mapTilesetPairIndex.get(mapId);
      if (pairIndex === undefined) {
        return null;
      }
      return snapshot.tilesetPairs[pairIndex]?.id ?? null;
    },
    hint,
  });
}
