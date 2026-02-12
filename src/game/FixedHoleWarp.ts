/**
 * Fixed hole warp target used by `setholewarp` + `warphole MAP_UNDEFINED`.
 *
 * C references:
 * - public/pokeemerald/src/scrcmd.c (ScrCmd_setholewarp, ScrCmd_warphole)
 * - public/pokeemerald/src/overworld.c (SetFixedHoleWarp, SetWarpDestinationToFixedHoleWarp)
 */

export interface FixedHoleWarpTarget {
  mapId: string;
}

let fixedHoleWarpTarget: FixedHoleWarpTarget | null = null;

export function setFixedHoleWarpTarget(mapId: string): void {
  fixedHoleWarpTarget = { mapId };
}

export function getFixedHoleWarpTarget(): FixedHoleWarpTarget | null {
  return fixedHoleWarpTarget;
}

export function clearFixedHoleWarpTarget(): void {
  fixedHoleWarpTarget = null;
}
