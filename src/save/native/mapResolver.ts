/**
 * Map Resolver - Convert native mapGroup/mapNum to our mapId
 *
 * The GBA save stores locations as (mapGroup, mapNum) pairs.
 * We need to convert these to our internal mapId format (e.g., "MAP_PETALBURG_WOODS").
 *
 * Data sources:
 * - public/pokeemerald/data/maps/map_groups.json (mapGroup → list of map names)
 * - src/data/mapIndex.json (mapName → mapId)
 */

import mapGroupsJson from '../../../public/pokeemerald/data/maps/map_groups.json' with { type: 'json' };
import mapIndexJson from '../../data/mapIndex.json' with { type: 'json' };
import type { MapIndexEntry } from '../../types/maps';

// Type for map_groups.json structure
interface MapGroupsData {
  group_order: string[];
  [groupName: string]: string[] | undefined;
}

const mapGroups = mapGroupsJson as MapGroupsData;
const mapIndex = mapIndexJson as MapIndexEntry[];

// Build lookup: mapName (PascalCase) → MapIndexEntry
const mapNameToEntry: Map<string, MapIndexEntry> = new Map();
for (const entry of mapIndex) {
  mapNameToEntry.set(entry.name, entry);
}

// Build lookup: (mapGroup, mapNum) → map name from map_groups.json
interface MapGroupLookupEntry {
  mapName: string;
  groupName: string;
}

const mapGroupNumToName: Map<string, MapGroupLookupEntry> = new Map();

// Iterate through group_order to get group indices
mapGroups.group_order.forEach((groupName, groupIndex) => {
  const maps = mapGroups[groupName];
  if (!maps || !Array.isArray(maps)) return;

  maps.forEach((mapName, mapNum) => {
    const key = `${groupIndex}:${mapNum}`;
    mapGroupNumToName.set(key, { mapName, groupName });
  });
});

/**
 * Result of map resolution
 */
export interface MapResolveResult {
  mapId: string;
  mapName: string;
  displayName: string;
  groupIndex: number;
  mapNum: number;
}

/**
 * Convert native (mapGroup, mapNum) to our internal mapId
 *
 * @param mapGroup - Map group index (0-33)
 * @param mapNum - Map number within group
 * @returns Resolved map info or null if not found
 */
export function mapGroupNumToMapId(mapGroup: number, mapNum: number): MapResolveResult | null {
  const key = `${mapGroup}:${mapNum}`;
  const lookup = mapGroupNumToName.get(key);

  if (!lookup) {
    console.warn(`[mapResolver] Unknown map: group=${mapGroup}, num=${mapNum}`);
    return null;
  }

  const entry = mapNameToEntry.get(lookup.mapName);

  if (!entry) {
    console.warn(`[mapResolver] Map name not in mapIndex: ${lookup.mapName}`);
    return null;
  }

  return {
    mapId: entry.id,
    mapName: entry.name,
    displayName: formatDisplayName(entry.name),
    groupIndex: mapGroup,
    mapNum,
  };
}

/**
 * Convert mapId to (mapGroup, mapNum) pair
 * Useful for save export
 */
export function mapIdToGroupNum(mapId: string): { mapGroup: number; mapNum: number } | null {
  // Find entry by id
  const entry = mapIndex.find(e => e.id === mapId);
  if (!entry) return null;

  // Find in group data
  for (let groupIndex = 0; groupIndex < mapGroups.group_order.length; groupIndex++) {
    const groupName = mapGroups.group_order[groupIndex];
    const maps = mapGroups[groupName];
    if (!maps || !Array.isArray(maps)) continue;

    const mapNum = maps.indexOf(entry.name);
    if (mapNum >= 0) {
      return { mapGroup: groupIndex, mapNum };
    }
  }

  return null;
}

/**
 * Format map name for display
 * "PetalburgWoods" → "Petalburg Woods"
 */
function formatDisplayName(mapName: string): string {
  // Handle special cases
  if (mapName.startsWith('Route')) {
    return mapName.replace(/(\d+)/, ' $1').trim();
  }

  // Split on capital letters and join with spaces
  return mapName
    .replace(/([A-Z])/g, ' $1')
    .replace(/(\d+)/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Get map display name from mapId
 */
export function getMapDisplayName(mapId: string): string {
  const entry = mapIndex.find(e => e.id === mapId);
  if (!entry) return mapId;
  return formatDisplayName(entry.name);
}

/**
 * Check if a mapId exists in our map index
 */
export function isValidMapId(mapId: string): boolean {
  return mapIndex.some(e => e.id === mapId);
}

/**
 * Get all map groups and their maps (for debugging)
 */
export function getAllMapGroups(): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const groupName of mapGroups.group_order) {
    const maps = mapGroups[groupName];
    if (maps && Array.isArray(maps)) {
      result.set(groupName, maps);
    }
  }

  return result;
}
