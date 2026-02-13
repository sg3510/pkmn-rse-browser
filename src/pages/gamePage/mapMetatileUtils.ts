import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { PlayerController } from '../../game/PlayerController';
import { FADE_TIMING } from '../../field/types';

interface MutableRef<T> {
  current: T;
}

/**
 * Type for the raw setMapMetatileLocal function that operates on snapshot data.
 */
export type SetMapMetatileLocalFn = (
  mapId: string,
  tileX: number,
  tileY: number,
  metatileId: number,
  collision?: number
) => boolean;

/**
 * Type for the wrapped metatile setter that also invalidates the pipeline.
 */
export type SetMapMetatileAndInvalidateFn = (
  mapId: string,
  tileX: number,
  tileY: number,
  metatileId: number,
  collision?: number
) => boolean;

/**
 * Creates a metatile update function that sets the tile and invalidates the
 * render pipeline when the tile actually changed. Replaces 7 inline wrappers.
 */
export function createMetatileUpdater(
  setMapMetatileLocal: SetMapMetatileLocalFn,
  pipelineRef: MutableRef<WebGLRenderPipeline | null>
): SetMapMetatileAndInvalidateFn {
  return (mapId, tileX, tileY, metatileId, collision?) => {
    const changed = setMapMetatileLocal(mapId, tileX, tileY, metatileId, collision);
    if (changed) {
      pipelineRef.current?.invalidate();
    }
    return changed;
  };
}

/**
 * Raw setMapMetatileLocal implementation extracted from GamePage.
 * Modifies a tile in the world snapshot's map data in place.
 */
export function setMapMetatileInSnapshot(
  snapshot: WorldSnapshot | null,
  mapId: string,
  tileX: number,
  tileY: number,
  metatileId: number,
  collision?: number
): boolean {
  if (!snapshot) return false;

  const map = snapshot.maps.find((m) => m.entry.id === mapId);
  if (!map) return false;

  if (tileX < 0 || tileY < 0 || tileX >= map.mapData.width || tileY >= map.mapData.height) {
    return false;
  }

  const index = tileY * map.mapData.width + tileX;
  const tile = map.mapData.layout[index];
  if (!tile) return false;

  const changed = tile.metatileId !== metatileId || (collision !== undefined && tile.collision !== collision);
  if (!changed) return false;

  tile.metatileId = metatileId;
  // C parity: MapGridSetMetatileIdAt always overwrites collision bits.
  if (collision !== undefined) {
    tile.collision = collision;
  }
  return true;
}

export interface InputUnlockGuards {
  warpingRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  dialogIsOpenRef: MutableRef<boolean>;
}

/**
 * Schedules player input unlock after a delay, guarded by warp/script/dialog state.
 * Replaces 4 identical setTimeout + guard blocks.
 */
export function scheduleInputUnlock(
  player: PlayerController,
  guards: InputUnlockGuards,
  delayMs: number = FADE_TIMING.DEFAULT_DURATION_MS
): void {
  setTimeout(() => {
    if (
      !guards.warpingRef.current
      && !guards.storyScriptRunningRef.current
      && !guards.dialogIsOpenRef.current
    ) {
      player.unlockInput();
    }
  }, delayMs);
}
