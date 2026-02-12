/**
 * Fixed dive warp target used by `setdivewarp` + dive/emerge fallback resolution.
 *
 * C references:
 * - public/pokeemerald/src/scrcmd.c (ScrCmd_setdivewarp)
 * - public/pokeemerald/src/overworld.c (SetFixedDiveWarp, SetDiveWarp)
 */

export interface FixedDiveWarpTarget {
  mapId: string;
  warpId: number;
  x: number;
  y: number;
}

let fixedDiveWarpTarget: FixedDiveWarpTarget | null = null;

export function setFixedDiveWarpTarget(
  mapId: string,
  x: number,
  y: number,
  warpId: number = 0
): void {
  fixedDiveWarpTarget = { mapId, warpId, x, y };
}

export function getFixedDiveWarpTarget(): FixedDiveWarpTarget | null {
  return fixedDiveWarpTarget;
}

export function clearFixedDiveWarpTarget(): void {
  fixedDiveWarpTarget = null;
}
