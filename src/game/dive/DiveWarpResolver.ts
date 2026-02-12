/**
 * Dive warp destination resolution.
 *
 * C references:
 * - public/pokeemerald/src/overworld.c (SetDiveWarp)
 * - public/pokeemerald/src/field_control_avatar.c (TrySetDiveWarp)
 */

import mapIndexJson from '../../data/mapIndex.json';
import type { MapIndexEntry } from '../../types/maps';
import { clearFixedDiveWarpTarget, getFixedDiveWarpTarget } from '../FixedDiveWarp';
import { findConnectionByDirection } from '../mapConnections';

const mapIndexData = mapIndexJson as MapIndexEntry[];

export type DiveWarpMode = 'dive' | 'emerge';

export interface DiveWarpRequest {
  mapId: string;
  mode: DiveWarpMode;
  localX: number;
  localY: number;
}

export interface DiveWarpDestination {
  mapId: string;
  warpId: number;
  x: number;
  y: number;
}

export interface DiveWarpResolution {
  ok: boolean;
  source?: 'connection' | 'fixed';
  destination?: DiveWarpDestination;
}

export interface DiveWarpResolverDeps {
  runMapDiveScript?: (mapId: string) => Promise<boolean>;
}

export async function resolveDiveWarp(
  request: DiveWarpRequest,
  deps: DiveWarpResolverDeps = {}
): Promise<DiveWarpResolution> {
  const entry = mapIndexData.find((candidate) => candidate.id === request.mapId);
  if (!entry) {
    return { ok: false };
  }

  // 1) Direct dive/emerge connection on current map.
  const directConnection = findConnectionByDirection(entry.connections, request.mode);
  if (directConnection) {
    return {
      ok: true,
      source: 'connection',
      destination: {
        mapId: directConnection.map,
        warpId: 0,
        x: request.localX,
        y: request.localY,
      },
    };
  }

  // 2) Optional MAP_SCRIPT_ON_DIVE_WARP hook.
  if (deps.runMapDiveScript) {
    await deps.runMapDiveScript(request.mapId);
  }

  // 3) Fixed dive warp fallback (setdivewarp).
  const fixedDiveWarp = getFixedDiveWarpTarget();
  if (fixedDiveWarp) {
    clearFixedDiveWarpTarget();
    return {
      ok: true,
      source: 'fixed',
      destination: {
        mapId: fixedDiveWarp.mapId,
        warpId: fixedDiveWarp.warpId,
        x: fixedDiveWarp.x,
        y: fixedDiveWarp.y,
      },
    };
  }

  // 4) Failure.
  return { ok: false };
}
