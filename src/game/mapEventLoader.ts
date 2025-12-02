/**
 * Map Event Loader - Shared utilities for loading warp and object events from map.json
 *
 * Used by both Canvas2D (MapManager) and WebGL (WorldManager) paths
 * to ensure consistent parsing of map events.
 */

import { loadText } from '../utils/mapLoader';
import type { ObjectEventData } from '../types/objectEvents';

const PROJECT_ROOT = '/pokeemerald';

/**
 * Warp event from map.json
 */
export interface WarpEvent {
  x: number;
  y: number;
  elevation: number;
  destMap: string;
  destWarpId: number;
}

/**
 * Result of loading map events
 */
export interface MapEventsData {
  warpEvents: WarpEvent[];
  objectEvents: ObjectEventData[];
}

/**
 * Parse warp events from raw JSON array
 */
export function parseWarpEvents(warpEventsRaw: Array<Record<string, unknown>>): WarpEvent[] {
  return warpEventsRaw
    .map((warp) => {
      const x = Number(warp.x ?? 0);
      const y = Number(warp.y ?? 0);
      const elevation = Number(warp.elevation ?? 0);
      const destMap = String(warp.dest_map ?? '');
      const destWarpId = Number(warp.dest_warp_id ?? 0);
      return { x, y, elevation, destMap, destWarpId };
    })
    .filter((w) => w.destMap !== '');
}

/**
 * Parse object events from raw JSON array
 */
export function parseObjectEvents(objectEventsRaw: Array<Record<string, unknown>>): ObjectEventData[] {
  return objectEventsRaw
    .map((obj) => {
      const graphics_id = String(obj.graphics_id ?? '');
      const x = Number(obj.x ?? 0);
      const y = Number(obj.y ?? 0);
      if (!graphics_id || !Number.isFinite(x) || !Number.isFinite(y)) return null;

      const result: ObjectEventData = {
        graphics_id,
        x,
        y,
        elevation: Number(obj.elevation ?? 0),
        movement_type: String(obj.movement_type ?? ''),
        movement_range_x: Number(obj.movement_range_x ?? 0),
        movement_range_y: Number(obj.movement_range_y ?? 0),
        trainer_type: String(obj.trainer_type ?? ''),
        trainer_sight_or_berry_tree_id: String(obj.trainer_sight_or_berry_tree_id ?? '0'),
        script: String(obj.script ?? ''),
        flag: String(obj.flag ?? '0'),
      };

      const local_id = obj.local_id;
      if (typeof local_id === 'string') {
        result.local_id = local_id;
      }

      return result;
    })
    .filter((obj): obj is ObjectEventData => obj !== null);
}

/**
 * Load all events (warps + objects) from a map's map.json file
 *
 * @param mapFolder The map folder name (e.g., "Route101", "LittlerootTown")
 * @returns Both warp and object events, or empty arrays on error
 */
export async function loadMapEvents(mapFolder: string): Promise<MapEventsData> {
  try {
    const jsonText = await loadText(`${PROJECT_ROOT}/data/maps/${mapFolder}/map.json`);
    const data = JSON.parse(jsonText) as {
      warp_events?: Array<Record<string, unknown>>;
      object_events?: Array<Record<string, unknown>>;
    };

    const warpEventsRaw = Array.isArray(data.warp_events) ? data.warp_events : [];
    const objectEventsRaw = Array.isArray(data.object_events) ? data.object_events : [];

    return {
      warpEvents: parseWarpEvents(warpEventsRaw),
      objectEvents: parseObjectEvents(objectEventsRaw),
    };
  } catch {
    return { warpEvents: [], objectEvents: [] };
  }
}

/**
 * Load only warp events from a map's map.json file
 * (Legacy function for backward compatibility)
 */
export async function loadWarpEvents(mapFolder: string): Promise<WarpEvent[]> {
  const { warpEvents } = await loadMapEvents(mapFolder);
  return warpEvents;
}

/**
 * Load only object events from a map's map.json file
 */
export async function loadObjectEvents(mapFolder: string): Promise<ObjectEventData[]> {
  const { objectEvents } = await loadMapEvents(mapFolder);
  return objectEvents;
}
