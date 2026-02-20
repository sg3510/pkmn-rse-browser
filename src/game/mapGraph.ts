import type { MapIndexEntry } from '../types/maps';
import { isSpatialConnectionDirection } from './mapConnections';

interface QueueItem {
  mapId: string;
  depth: number;
}

function normalizeDepth(depth: number): number {
  if (!Number.isFinite(depth)) {
    return 0;
  }
  return Math.max(0, Math.floor(depth));
}

/**
 * Return map IDs reachable from an anchor map within a depth-limited BFS.
 */
export function getReachableMapIdsWithinDepth(
  mapIndex: ReadonlyArray<MapIndexEntry>,
  anchorMapId: string,
  maxDepth: number
): Set<string> {
  const depthLimit = normalizeDepth(maxDepth);
  const mapById = new Map(mapIndex.map((entry) => [entry.id, entry]));
  const anchor = mapById.get(anchorMapId);
  if (!anchor) {
    return new Set();
  }

  const visited = new Set<string>([anchor.id]);
  const queue: QueueItem[] = [{ mapId: anchor.id, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= depthLimit) {
      continue;
    }

    const currentEntry = mapById.get(current.mapId);
    if (!currentEntry) {
      continue;
    }

    for (const connection of currentEntry.connections ?? []) {
      if (!isSpatialConnectionDirection(connection.direction)) {
        continue;
      }
      if (!mapById.has(connection.map) || visited.has(connection.map)) {
        continue;
      }

      visited.add(connection.map);
      queue.push({ mapId: connection.map, depth: current.depth + 1 });
    }
  }

  return visited;
}

/**
 * Count maps reachable from an anchor map within a depth-limited BFS.
 */
export function countReachableMapsWithinDepth(
  mapIndex: ReadonlyArray<MapIndexEntry>,
  anchorMapId: string,
  maxDepth: number
): number {
  return getReachableMapIdsWithinDepth(mapIndex, anchorMapId, maxDepth).size;
}
