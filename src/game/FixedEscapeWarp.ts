/**
 * Fixed escape warp target used by `setescapewarp` (Dig / Escape Rope destination).
 *
 * C references:
 * - public/pokeemerald/src/scrcmd.c (ScrCmd_setescapewarp)
 * - public/pokeemerald/src/overworld.c (SetEscapeWarp, SetWarpDestinationToEscapeWarp)
 */

export interface FixedEscapeWarpTarget {
  mapId: string;
  warpId: number;
  x: number;
  y: number;
}

let fixedEscapeWarpTarget: FixedEscapeWarpTarget | null = null;

export function setFixedEscapeWarpTarget(
  mapId: string,
  x: number,
  y: number,
  warpId: number = 0
): void {
  fixedEscapeWarpTarget = { mapId, warpId, x, y };
}

export function getFixedEscapeWarpTarget(): FixedEscapeWarpTarget | null {
  return fixedEscapeWarpTarget;
}

export function clearFixedEscapeWarpTarget(): void {
  fixedEscapeWarpTarget = null;
}
