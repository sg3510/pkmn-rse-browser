/**
 * Extracted dive field action handler from GamePage.
 * Resolves dive warp destination, builds saved location state, and queues a scripted warp.
 */
import type { DiveActionResolution } from '../../game/fieldActions/FieldActionResolver';
import type { PlayerController } from '../../game/PlayerController';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { MapScriptData } from '../../data/scripts/types';
import type { ScriptRuntimeServices } from '../../scripting/ScriptRunner';
import type { MapIndexEntry } from '../../types/maps';
import type { LocationState } from '../../save/types';
import { resolveDiveWarp } from '../../game/dive/DiveWarpResolver';
import { clearFixedDiveWarpTarget } from '../../game/FixedDiveWarp';
import { runMapDiveScript } from './runMapDiveScript';
import type { PendingScriptedWarp } from './overworldGameUpdate';
import type { SetMapMetatileAndInvalidateFn } from './mapMetatileUtils';

interface MutableRef<T> {
  current: T;
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
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null>;
  warpingRef: MutableRef<boolean>;
  mapIndexData: MapIndexEntry[];
  showMessage: (msg: string) => Promise<void>;
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

  pendingSavedLocationRef.current = {
    pos: { x: destination.x, y: destination.y },
    location: { mapId: destination.mapId, warpId: destination.warpId, x: destination.x, y: destination.y },
    continueGameWarp: { mapId: destination.mapId, warpId: destination.warpId, x: destination.x, y: destination.y },
    lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
    escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
    direction: facingDirection,
    elevation: player.getElevation(),
    isSurfing: destinationIsSurfing,
    isUnderwater: destinationUnderwater,
  };

  pendingScriptedWarpRef.current = {
    mapId: destination.mapId,
    x: destination.x,
    y: destination.y,
    direction: facingDirection,
    phase: 'pending',
    traversal: {
      surfing: destinationIsSurfing,
      underwater: destinationUnderwater,
    },
  };
  clearFixedDiveWarpTarget();
  warpingRef.current = true;
  return true;
}
