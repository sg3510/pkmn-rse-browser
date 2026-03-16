/**
 * Minimal dynamic warp state for MAP_DYNAMIC / WARP_ID_DYNAMIC handling.
 *
 * C references:
 * - public/pokeemerald/src/event_data.c (SetDynamicWarp / gSaveBlock1Ptr->dynamicWarp)
 * - public/pokeemerald/data/maps/InsideOfTruck/scripts.inc
 */

import { WARP_ID_NONE } from './warpConstants.ts';

export interface DynamicWarpTarget {
  mapId: string;
  warpId: number;
  x: number;
  y: number;
}

let dynamicWarpTarget: DynamicWarpTarget | null = null;

export function setDynamicWarpTarget(mapId: string, x: number, y: number, warpId: number = WARP_ID_NONE): void {
  dynamicWarpTarget = {
    mapId,
    warpId,
    x,
    y,
  };
}

export function getDynamicWarpTarget(): DynamicWarpTarget | null {
  return dynamicWarpTarget;
}

export function clearDynamicWarpTarget(): void {
  dynamicWarpTarget = null;
}
