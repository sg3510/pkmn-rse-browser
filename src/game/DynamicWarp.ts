/**
 * Minimal dynamic warp state for MAP_DYNAMIC / WARP_ID_DYNAMIC handling.
 *
 * C references:
 * - public/pokeemerald/src/event_data.c (SetDynamicWarp / gSaveBlock1Ptr->dynamicWarp)
 * - public/pokeemerald/data/maps/InsideOfTruck/scripts.inc
 */

export interface DynamicWarpTarget {
  mapId: string;
  x: number;
  y: number;
}

let dynamicWarpTarget: DynamicWarpTarget | null = null;

export function setDynamicWarpTarget(mapId: string, x: number, y: number): void {
  dynamicWarpTarget = { mapId, x, y };
}

export function getDynamicWarpTarget(): DynamicWarpTarget | null {
  return dynamicWarpTarget;
}

export function clearDynamicWarpTarget(): void {
  dynamicWarpTarget = null;
}

