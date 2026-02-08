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
 * Coordinate trigger event from map.json
 */
export interface CoordEvent {
  type: string;
  x: number;
  y: number;
  elevation: number;
  var: string;
  varValue: number;
  script: string;
}

/**
 * Result of loading map events
 */
export interface MapEventsData {
  warpEvents: WarpEvent[];
  objectEvents: ObjectEventData[];
  coordEvents: CoordEvent[];
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
      const parsedWarpId = Number(warp.dest_warp_id ?? 0);
      const destWarpId = Number.isFinite(parsedWarpId) ? parsedWarpId : 255;
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
 * Parse coordinate trigger events from raw JSON array
 */
export function parseCoordEvents(coordEventsRaw: Array<Record<string, unknown>>): CoordEvent[] {
  return coordEventsRaw
    .map((coordEvent) => {
      const x = Number(coordEvent.x ?? 0);
      const y = Number(coordEvent.y ?? 0);
      const elevation = Number(coordEvent.elevation ?? 0);
      const variable = String(coordEvent.var ?? '');
      const script = String(coordEvent.script ?? '');
      const parsedVarValue = Number.parseInt(String(coordEvent.var_value ?? '0'), 10);
      const varValue = Number.isFinite(parsedVarValue) ? parsedVarValue : 0;

      if (!script || !variable || !Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return {
        type: String(coordEvent.type ?? ''),
        x,
        y,
        elevation,
        var: variable,
        varValue,
        script,
      } satisfies CoordEvent;
    })
    .filter((coordEvent): coordEvent is CoordEvent => coordEvent !== null);
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
      coord_events?: Array<Record<string, unknown>>;
    };

    const warpEventsRaw = Array.isArray(data.warp_events) ? data.warp_events : [];
    const objectEventsRaw = Array.isArray(data.object_events) ? data.object_events : [];
    const coordEventsRaw = Array.isArray(data.coord_events) ? data.coord_events : [];

    return {
      warpEvents: parseWarpEvents(warpEventsRaw),
      objectEvents: parseObjectEvents(objectEventsRaw),
      coordEvents: parseCoordEvents(coordEventsRaw),
    };
  } catch {
    return { warpEvents: [], objectEvents: [], coordEvents: [] };
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

/**
 * Load only coordinate events from a map's map.json file
 */
export async function loadCoordEvents(mapFolder: string): Promise<CoordEvent[]> {
  const { coordEvents } = await loadMapEvents(mapFolder);
  return coordEvents;
}
