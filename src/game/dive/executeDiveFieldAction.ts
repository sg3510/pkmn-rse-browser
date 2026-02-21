/**
 * Extracted dive field action handler from GamePage.
 * Resolves dive warp destination, builds saved location state, and queues a scripted warp.
 */
import type { DiveActionResolution } from '../fieldActions/FieldActionResolver';
import type { PlayerController } from '../PlayerController';
import type { WorldSnapshot } from '../WorldManager';
import type { ObjectEventManager } from '../ObjectEventManager';
import type { MapScriptData } from '../../data/scripts/types';
import type { ScriptRuntimeServices } from '../../scripting/ScriptRunner';
import type { MapIndexEntry } from '../../types/maps';
import type { LocationState } from '../../save/types';
import { resolveDiveWarp } from './DiveWarpResolver';
import { clearFixedDiveWarpTarget } from '../FixedDiveWarp';
import { runMapDiveScript } from '../../scripting/mapHooks/runMapDiveScript';
import type { SetMapMetatileAndInvalidateFn } from '../overworld/metatile/mapMetatileUtils';
import { buildLocationState } from '../../world/locationStateFactory';

interface MutableRef<T> {
  current: T;
}

interface PendingScriptedWarpLike {
  mapId: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  phase: 'pending' | 'fading' | 'loading' | 'exiting';
  style?: 'default' | 'fall';
  traversal?: {
    surfing: boolean;
    underwater: boolean;
  };
}

function isUnderwaterMapType(mapType: string | null): boolean {
  return mapType === 'MAP_TYPE_UNDERWATER';
}

export interface ExecuteDiveFieldActionParams {
  request: DiveActionResolution;
  playerRef: MutableRef<PlayerController | null>;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  playerHiddenRef: MutableRef<boolean>;
  mapScriptCacheRef: MutableRef<Map<string, MapScriptData | null>>;
  setMapMetatileAndInvalidate: SetMapMetatileAndInvalidateFn;
  scriptRuntimeServices: ScriptRuntimeServices;
  pendingSavedLocationRef: MutableRef<LocationState | null>;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarpLike | null>;
  warpingRef: MutableRef<boolean>;
  mapIndexData: MapIndexEntry[];
  showMessage: (msg: string) => Promise<void>;
  setFlashLevel?: (level: number) => void;
  animateFlashLevel?: (level: number) => Promise<void>;
  getFlashLevel?: () => number;
}

export async function executeDiveFieldAction(params: ExecuteDiveFieldActionParams): Promise<boolean> {
  const {
    request,
    playerRef,
    worldSnapshotRef,
    objectEventManagerRef,
    playerHiddenRef,
    mapScriptCacheRef,
    setMapMetatileAndInvalidate,
    scriptRuntimeServices,
    pendingSavedLocationRef,
    pendingScriptedWarpRef,
    warpingRef,
    mapIndexData,
    showMessage,
    setFlashLevel,
    animateFlashLevel,
    getFlashLevel,
  } = params;

  const player = playerRef.current;
  const snapshot = worldSnapshotRef.current;
  if (!player || !snapshot) return false;

  const resolution = await resolveDiveWarp(
    {
      mapId: request.mapId,
      mode: request.mode,
      localX: request.localX,
      localY: request.localY,
    },
    {
      runMapDiveScript: async (mapId) => runMapDiveScript({
        mapId,
        snapshot,
        objectEventManager: objectEventManagerRef.current,
        player,
        playerHiddenRef,
        mapScriptCache: mapScriptCacheRef.current,
        setMapMetatile: setMapMetatileAndInvalidate,
        scriptRuntimeServices,
        setFlashLevel,
        animateFlashLevel,
      }),
    }
  );

  if (!resolution.ok || !resolution.destination) {
    await showMessage(request.mode === 'dive' ? "Can't dive here." : "Can't surface here.");
    return false;
  }

  const destination = resolution.destination;
  const destinationEntry = mapIndexData.find((entry) => entry.id === destination.mapId) ?? null;
  const destinationUnderwater = isUnderwaterMapType(destinationEntry?.mapType ?? null);
  const facingDirection = player.getFacingDirection();

  const destinationIsSurfing = !destinationUnderwater;

  pendingSavedLocationRef.current = buildLocationState({
    mapId: destination.mapId,
    x: destination.x,
    y: destination.y,
    warpId: destination.warpId,
    direction: facingDirection,
    elevation: player.getElevation(),
    isSurfing: destinationIsSurfing,
    isUnderwater: destinationUnderwater,
    bikeMode: 'none',
    isRidingBike: false,
    flashLevel: getFlashLevel?.() ?? 0,
  });

  pendingScriptedWarpRef.current = {
    mapId: destination.mapId,
    x: destination.x,
    y: destination.y,
    direction: facingDirection,
    phase: 'pending',
    style: 'default',
    traversal: {
      surfing: destinationIsSurfing,
      underwater: destinationUnderwater,
    },
  };
  clearFixedDiveWarpTarget();
  warpingRef.current = true;
  return true;
}
