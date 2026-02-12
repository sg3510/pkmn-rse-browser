import type { PlayerController, TileResolver as PlayerTileResolver } from '../../game/PlayerController';
import { executeWarp, type WarpExecutorDeps, type WarpDestination } from '../../game/WarpExecutor';
import { resolveTileAt, type WarpTrigger } from '../../components/map/utils';
import type { WorldManager, WorldSnapshot } from '../../game/WorldManager';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { RenderContext } from '../../rendering/types';
import type { WarpHandler } from '../../field/WarpHandler';
import type { FadeController } from '../../field/FadeController';
import type { UseDoorAnimationsReturn } from '../../hooks/useDoorAnimations';
import type { UseDoorSequencerReturn } from '../../hooks/useDoorSequencer';
import type { LavaridgeWarpSequencer } from '../../game/LavaridgeWarpSequencer';
import type { WarpDebugInfo } from '../../components/debug';
import type { MapScriptData } from '../../data/scripts/types';
import { runMapEntryScripts } from './runMapEntryScripts';
import { handleSpecialWarpArrival } from '../../game/SpecialWarpBehaviorRegistry';
import type { ScriptRuntimeServices } from '../../scripting/ScriptRunner';

interface MutableRef<T> {
  current: T;
}

interface NpcMovementLike {
  reset: () => void;
}

export interface PerformWarpTransitionParams {
  trigger: WarpTrigger;
  options?: { force?: boolean; fromDoor?: boolean };
  worldManager: WorldManager | null;
  player: PlayerController | null;
  pipeline: WebGLRenderPipeline | null;
  initializeWorldFromSnapshot: (snapshot: WorldSnapshot, pipeline: WebGLRenderPipeline) => Promise<void>;
  createSnapshotPlayerTileResolver: (snapshot: WorldSnapshot) => PlayerTileResolver;
  objectEventManager: ObjectEventManager;
  getRenderContextFromSnapshot: (snapshot: WorldSnapshot) => RenderContext | null;
  doorSequencer: UseDoorSequencerReturn;
  fadeController: FadeController;
  warpHandler: WarpHandler;
  playerHiddenRef: MutableRef<boolean>;
  doorAnimations: UseDoorAnimationsReturn;
  lavaridgeWarpSequencer: LavaridgeWarpSequencer;
  applyStoryTransitionObjectParity: (mapId: string) => void;
  npcMovement: NpcMovementLike;
  setWarpDebugInfo: (info: WarpDebugInfo) => void;
  resolverVersion: number;
  setLastCoordTriggerTile: (tile: { mapId: string; x: number; y: number }) => void;
  warpingRef: MutableRef<boolean>;
  resolveDynamicWarpTarget: () => { mapId: string; x: number; y: number } | null;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => boolean;
  /** Pre-populate frame table cache so ON_FRAME scripts fire on the first frame */
  mapScriptCache?: Map<string, MapScriptData | null>;
  scriptRuntimeServices?: ScriptRuntimeServices;
  /** Called after a warp completes with the new anchor map ID */
  onMapChanged?: (mapId: string) => void;
}

export interface PerformWarpTransitionResult {
  managesInputUnlock: boolean;
}

function isUnderwaterMapType(mapType: string | null): boolean {
  return mapType === 'MAP_TYPE_UNDERWATER';
}

export async function performWarpTransition(
  params: PerformWarpTransitionParams
): Promise<PerformWarpTransitionResult> {
  const {
    trigger,
    options,
    worldManager,
    player,
    pipeline,
    initializeWorldFromSnapshot,
    createSnapshotPlayerTileResolver,
    objectEventManager,
    getRenderContextFromSnapshot,
    doorSequencer,
    fadeController,
    warpHandler,
    playerHiddenRef,
    doorAnimations,
    lavaridgeWarpSequencer,
    applyStoryTransitionObjectParity,
    npcMovement,
    setWarpDebugInfo,
    resolverVersion,
    setLastCoordTriggerTile,
    warpingRef,
    resolveDynamicWarpTarget,
    setMapMetatile,
    mapScriptCache,
    scriptRuntimeServices,
    onMapChanged,
  } = params;

  if (!worldManager || !player || !pipeline) {
    console.warn('[WARP] Missing dependencies, aborting warp:', { worldManager: !!worldManager, player: !!player, pipeline: !!pipeline });
    warpingRef.current = false;
    return { managesInputUnlock: false };
  }

  let destMapId = trigger.warpEvent.destMap;
  let dynamicWarpOverride: { x: number; y: number } | null = null;

  if (destMapId === 'MAP_DYNAMIC') {
    const dynamicWarp = resolveDynamicWarpTarget();
    if (!dynamicWarp) {
      console.warn('[WARP] MAP_DYNAMIC encountered, but no dynamic warp target is set.');
      warpingRef.current = false;
      return { managesInputUnlock: false };
    }

    destMapId = dynamicWarp.mapId;
    dynamicWarpOverride = { x: dynamicWarp.x, y: dynamicWarp.y };
  }

  const priorFacing = player.getFacingDirection();

  console.log('[WARP] ========== WARP START ==========');
  console.log('[WARP] Source map:', trigger.sourceMap.entry.id);
  console.log('[WARP] Destination map:', destMapId);
  console.log('[WARP] fromDoor:', options?.fromDoor);
  console.log('[WARP] priorFacing:', priorFacing);

  try {
    let managesInputUnlock = false;
    let managesVisibility = false;

    const snapshot = await worldManager.initialize(destMapId);

    await initializeWorldFromSnapshot(snapshot, pipeline);

    const playerResolver = createSnapshotPlayerTileResolver(snapshot);
    player.setTileResolver(playerResolver);

    objectEventManager.setTileElevationResolver((tileX, tileY) => {
      const resolved = playerResolver(tileX, tileY);
      return resolved?.mapTile.elevation ?? null;
    });

    const destMap = snapshot.maps.find((map) => map.entry.id === destMapId);
    if (!destMap) {
      console.error('[WARP] Destination map not found in snapshot:', destMapId);
      return { managesInputUnlock: false };
    }

    const renderContext = getRenderContextFromSnapshot(snapshot);

    const warpDeps: WarpExecutorDeps = {
      player,
      doorSequencer,
      fadeController,
      warpHandler,
      playerHiddenRef,
      getCurrentTime: () => performance.now(),
      onClearDoorAnimations: () => doorAnimations.clearAll(),
    };

    const destination: WarpDestination = {
      map: destMap,
      resolveTileAt: (x, y) => {
        if (!renderContext) {
          return null;
        }

        const resolved = resolveTileAt(renderContext, x, y);
        if (!resolved) {
          return null;
        }

        return {
          attributes: resolved.attributes,
          mapTile: resolved.mapTile,
        };
      },
    };

    executeWarp(warpDeps, trigger, destination, {
      ...options,
      priorFacing,
    });

    if (!options?.fromDoor) {
      const currentResolved = destination.resolveTileAt(player.tileX, player.tileY);
      const currentBehavior = currentResolved?.attributes?.behavior ?? -1;
      const arrivalResult = handleSpecialWarpArrival({
        trigger,
        destinationBehavior: currentBehavior,
        now: performance.now(),
        player,
        playerHiddenRef,
        lavaridgeWarpSequencer,
      });
      managesInputUnlock = arrivalResult.managesInputUnlock;
      managesVisibility = arrivalResult.managesVisibility;
    }

    if (dynamicWarpOverride) {
      player.setPosition(dynamicWarpOverride.x, dynamicWarpOverride.y);
      // Dynamic warp overrides the warp-event position; cancel any door-exit
      // that executeWarp started for the fallback warp-event tile.
      // The script (e.g. StepOffTruckMale) handles player movement instead.
      if (doorSequencer.isExitActive()) {
        doorSequencer.reset();
        playerHiddenRef.current = false;
        if (!warpingRef.current) {
          player.unlockInput();
        }
      }
    }

    const currentMapId = worldManager.findMapAtPosition(player.tileX, player.tileY)?.entry.id ?? destMapId;
    const destinationUnderwater = isUnderwaterMapType(destMap.entry.mapType);
    player.setTraversalState({
      surfing: false,
      underwater: destinationUnderwater,
    });
    setLastCoordTriggerTile({
      mapId: currentMapId,
      x: player.tileX,
      y: player.tileY,
    });

    applyStoryTransitionObjectParity(currentMapId);

    // Run generated ON_LOAD, ON_TRANSITION, and ON_WARP_INTO scripts for the destination map.
    await runMapEntryScripts({
      currentMapId,
      snapshot,
      objectEventManager,
      player,
      playerHiddenRef,
      pipeline,
      mapScriptCache,
      setMapMetatile,
      scriptRuntimeServices,
    });

    if (!managesVisibility) {
      playerHiddenRef.current = false;
    }

    pipeline.invalidate();
    npcMovement.reset();

    // Sync debug panel map selector with the new anchor map
    onMapChanged?.(snapshot.anchorMapId);

    console.log('[WARP] Warp complete');
    console.log('[WARP] World bounds:', snapshot.worldBounds);
    console.log('[WARP] Loaded maps:', snapshot.maps.map((map) => map.entry.id));
    console.log('[WARP] Tileset pairs:', snapshot.tilesetPairs.map((pair) => pair.id));
    console.log('[WARP] GPU slots:', Object.fromEntries(snapshot.pairIdToGpuSlot));

    setWarpDebugInfo({
      lastWarpTo: destMapId,
      currentAnchor: snapshot.anchorMapId,
      snapshotMaps: snapshot.maps.map((map) => map.entry.id),
      snapshotPairs: snapshot.tilesetPairs.map((pair) => pair.id),
      gpuSlots: Object.fromEntries(snapshot.pairIdToGpuSlot),
      resolverVersion,
      worldBounds: snapshot.worldBounds,
    });

    if (options?.fromDoor) {
      warpingRef.current = false;
    }
    return { managesInputUnlock };
  } catch (err) {
    console.error('[WARP] Failed to perform warp:', err);
    warpHandler.setInProgress(false);
    warpingRef.current = false;
    return { managesInputUnlock: false };
  }
}
