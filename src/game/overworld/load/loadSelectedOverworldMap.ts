import type { MapIndexEntry } from '../../../types/maps';
import type { CameraController } from '../../CameraController';
import { createWebGLCameraController } from '../../CameraController';
import { WorldManager, type WorldSnapshot } from '../../WorldManager';
import {
  createWorldManagerEventHandler,
  createGpuUploadCallback,
} from '../../worldManagerEvents';
import { setupObjectCollisionChecker } from '../../setupObjectCollisionChecker';
import { findPlayerSpawnPosition } from '../../findPlayerSpawnPosition';
import type { PlayerController, TileResolver as PlayerTileResolver } from '../../PlayerController';
import { isSurfableBehavior } from '../../../utils/metatileBehaviors';
import type { ObjectEventManager } from '../../ObjectEventManager';
import type { ObjectEventRuntimeState } from '../../../types/objectEvents';
import type { TileResolverFn } from '../../../rendering/types';
import type { WebGLRenderPipeline } from '../../../rendering/webgl/WebGLRenderPipeline';
import type { FadeController } from '../../../field/FadeController';
import type { WarpHandler } from '../../../field/WarpHandler';
import { FADE_TIMING } from '../../../field/types';
import type { LocationState } from '../../../save/types';
import type { ScriptRuntimeServices } from '../../../scripting/ScriptRunner';
import { runMapEntryScripts } from '../../../scripting/mapHooks/runMapEntryScripts';
import { isDebugMode } from '../../../utils/debug';
import { gameFlags } from '../../GameFlags';
import { tryUnlockInput } from '../inputLock/scriptWarpInputGuard';

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
  completion?: {
    promise: Promise<void>;
    resolve: () => void;
    reject: (error?: unknown) => void;
    settled: boolean;
  };
}

type PendingOverworldEntryReason = 'continue' | 'new-game' | 'state-transition';

interface LastWorldUpdate {
  tileX: number;
  tileY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  viewportKey?: string | null;
  updatedAtMs?: number;
}

function isUnderwaterMapType(mapType: string | null): boolean {
  return mapType === 'MAP_TYPE_UNDERWATER';
}

export interface LoadSelectedOverworldMapParams {
  entry: MapIndexEntry;
  viewportTilesWide: number;
  viewportTilesHigh: number;
  pipeline: WebGLRenderPipeline;
  loadingRef: MutableRef<boolean>;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  playerRef: MutableRef<PlayerController | null>;
  cameraRef: MutableRef<CameraController | null>;
  worldBoundsRef: MutableRef<{ width: number; height: number; minX: number; minY: number }>;
  worldManagerRef: MutableRef<WorldManager | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  pendingSavedLocationRef: MutableRef<LocationState | null>;
  pendingOverworldEntryReasonRef: MutableRef<PendingOverworldEntryReason | null>;
  consumePendingObjectEventRuntimeState?: () => ObjectEventRuntimeState | null;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarpLike | null>;
  warpingRef: MutableRef<boolean>;
  playerHiddenRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  mapEntryCutsceneGateRef: MutableRef<boolean>;
  mapScriptCacheRef: MutableRef<Map<string, unknown> | null>;
  lastCoordTriggerTileRef: MutableRef<{ mapId: string; x: number; y: number } | null>;
  lastPlayerMapIdRef: MutableRef<string | null>;
  warpHandlerRef: MutableRef<WarpHandler>;
  lastWorldUpdateRef: MutableRef<LastWorldUpdate | null>;
  fadeControllerRef: MutableRef<FadeController>;
  setLoading: (loading: boolean) => void;
  setStats: (updater: (stats: any) => any) => void;
  setCameraDisplay: (position: { x: number; y: number }) => void;
  setWorldSize: (size: { width: number; height: number }) => void;
  setStitchedMapCount: (count: number) => void;
  onLoadingStateChanged?: (loadingCount: number) => void;
  createSnapshotTileResolver: (snapshot: WorldSnapshot) => TileResolverFn;
  createSnapshotPlayerTileResolver: (snapshot: WorldSnapshot) => PlayerTileResolver;
  loadObjectEventsFromSnapshot: (
    snapshot: WorldSnapshot,
    options?: {
      preserveExistingMapRuntimeState?: boolean;
      cooperativeChunkMs?: number;
    }
  ) => Promise<void>;
  initializeWorldFromSnapshot: (snapshot: WorldSnapshot, pipeline: WebGLRenderPipeline) => Promise<void>;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => boolean;
  scriptRuntimeServices?: ScriptRuntimeServices;
  setDefaultFlashLevel?: (input: { mapRequiresFlash: boolean; hasFlashFlag: boolean }) => void;
  setFlashLevel?: (level: number) => void;
  animateFlashLevel?: (level: number) => Promise<void>;
}

export function loadSelectedOverworldMap(params: LoadSelectedOverworldMapParams): () => void {
  const {
    entry,
    viewportTilesWide,
    viewportTilesHigh,
    pipeline,
    loadingRef,
    worldSnapshotRef,
    playerRef,
    cameraRef,
    worldBoundsRef,
    worldManagerRef,
    objectEventManagerRef,
    pendingSavedLocationRef,
    pendingOverworldEntryReasonRef,
    consumePendingObjectEventRuntimeState,
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    mapEntryCutsceneGateRef,
    mapScriptCacheRef,
    lastCoordTriggerTileRef,
    lastPlayerMapIdRef,
    warpHandlerRef,
    lastWorldUpdateRef,
    fadeControllerRef,
    setLoading,
    setStats,
    setCameraDisplay,
    setWorldSize,
    setStitchedMapCount,
    onLoadingStateChanged,
    createSnapshotTileResolver,
    createSnapshotPlayerTileResolver,
    loadObjectEventsFromSnapshot,
    initializeWorldFromSnapshot,
    setMapMetatile,
    scriptRuntimeServices,
    setDefaultFlashLevel,
    setFlashLevel,
    animateFlashLevel,
  } = params;

  let cancelled = false;

  loadingRef.current = true;
  setLoading(true);
  setStats((stats) => ({ ...stats, error: null }));

  if (cameraRef.current) {
    cameraRef.current.reset();
  } else {
    cameraRef.current = createWebGLCameraController(viewportTilesWide, viewportTilesHigh);
  }
  setCameraDisplay({ x: 0, y: 0 });

  if (worldManagerRef.current) {
    worldManagerRef.current.dispose();
    worldManagerRef.current = null;
  }
  lastWorldUpdateRef.current = null;

  const load = async () => {
    try {
      const worldManager = new WorldManager();
      worldManagerRef.current = worldManager;

      const eventHandler = createWorldManagerEventHandler(
        {
          pipeline,
          worldSnapshotRef,
          playerRef,
          cameraRef,
          worldBoundsRef,
          setWorldSize,
          setStitchedMapCount,
          createSnapshotTileResolver,
          createSnapshotPlayerTileResolver,
          isCancelled: () => cancelled,
          loadObjectEventsFromSnapshot,
          storyScriptRunningRef,
          mapScriptCacheRef,
          onLoadingStateChanged,
        },
        worldManager
      );
      worldManager.on(eventHandler);

      worldManager.setGpuUploadCallback(createGpuUploadCallback(pipeline));

      const snapshot = await worldManager.initialize(entry.id, {
        initialDepth: 1,
        targetDepth: 2,
        backgroundStitch: true,
      });
      if (cancelled) return;

      await initializeWorldFromSnapshot(snapshot, pipeline);

      pipeline.invalidate();

      const player = playerRef.current;
      if (player) {
        const playerResolver = createSnapshotPlayerTileResolver(snapshot);
        player.setTileResolver(playerResolver);
        player.setMapAllowsCyclingResolver(() => {
          const currentMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
          return currentMap?.mapAllowCycling ?? true;
        });

        objectEventManagerRef.current.setTileElevationResolver((tileX, tileY) => {
          const resolved = playerResolver(tileX, tileY);
          return resolved?.mapTile.elevation ?? null;
        });

        setupObjectCollisionChecker(player, objectEventManagerRef.current);

        const savedLocation = pendingSavedLocationRef.current;
        const pendingEntryReason = pendingOverworldEntryReasonRef.current;
        pendingSavedLocationRef.current = null;
        pendingOverworldEntryReasonRef.current = null;
        const pendingObjectEventRuntimeState = savedLocation
          ? (consumePendingObjectEventRuntimeState?.() ?? null)
          : null;

        if (savedLocation) {
          const savedMapId = savedLocation.location.mapId;
          const savedMap = snapshot.maps.find((map) => map.entry.id === savedMapId) ?? null;
          let spawnWorldX = savedLocation.pos.x;
          let spawnWorldY = savedLocation.pos.y;

          // C parity: saved position is map-local. Convert to world coordinates
          // for the currently stitched snapshot. Keep backward compatibility for
          // older world-space saves by falling back when values are out of range.
          if (savedMap) {
            const isLocalInBounds =
              savedLocation.pos.x >= 0
              && savedLocation.pos.x < savedMap.entry.width
              && savedLocation.pos.y >= 0
              && savedLocation.pos.y < savedMap.entry.height;

            if (isLocalInBounds) {
              spawnWorldX = savedMap.offsetX + savedLocation.pos.x;
              spawnWorldY = savedMap.offsetY + savedLocation.pos.y;
            } else {
              console.warn(
                `[GamePage] Saved local position out of bounds for ${savedMap.entry.id}: `
                + `(${savedLocation.pos.x},${savedLocation.pos.y}) not in ${savedMap.entry.width}x${savedMap.entry.height}; `
                + 'treating as world coordinates (legacy save compatibility).'
              );
            }
          }

          console.log('[GamePage] Spawning player at saved position:', {
            mapId: savedMapId,
            local: savedLocation.pos,
            world: { x: spawnWorldX, y: spawnWorldY },
          });
          player.setPosition(spawnWorldX, spawnWorldY);
          if (savedLocation.direction) {
            player.dir = savedLocation.direction;
          }
          const savedUnderwater = savedLocation.isUnderwater
            ?? isUnderwaterMapType(savedMap?.entry.mapType ?? null);

          const resolvedSaveTile = player.getTileResolver()?.(player.tileX, player.tileY);
          const saveTileBehavior = resolvedSaveTile?.attributes?.behavior;
          const canSurfaceByTile =
            saveTileBehavior === undefined
              ? savedLocation.isSurfing
              : isSurfableBehavior(saveTileBehavior);

          player.setTraversalState({
            surfing: !savedUnderwater && savedLocation.isSurfing && canSurfaceByTile,
            underwater: savedUnderwater,
            bikeMode: savedLocation.bikeMode ?? 'none',
            bikeRiding: savedLocation.isRidingBike ?? false,
          });
        } else {
          const anchorMap = snapshot.maps.find((map) => map.entry.id === entry.id) ?? snapshot.maps[0];
          const tilesetPairIndex = snapshot.mapTilesetPairIndex.get(anchorMap.entry.id);
          const tilesetPair = tilesetPairIndex !== undefined ? snapshot.tilesetPairs[tilesetPairIndex] : null;

          const spawnResult = findPlayerSpawnPosition(
            anchorMap.mapData,
            anchorMap.warpEvents,
            (_x, _y, metatileId) => {
              if (!tilesetPair) return undefined;
              const attrs = metatileId < 512
                ? tilesetPair.primaryAttributes[metatileId]
                : tilesetPair.secondaryAttributes[metatileId - 512];
              return attrs?.behavior;
            }
          );
          player.setPosition(spawnResult.x, spawnResult.y);
          const spawnUnderwater = isUnderwaterMapType(anchorMap.entry.mapType);
          player.setTraversalState({
            surfing: false,
            underwater: spawnUnderwater,
            bikeMode: 'none',
            bikeRiding: false,
          });
        }

        const playerMapId = worldManager.findMapAtPosition(player.tileX, player.tileY)?.entry.id ?? entry.id;
        lastCoordTriggerTileRef.current = {
          mapId: playerMapId,
          x: player.tileX,
          y: player.tileY,
        };
        lastPlayerMapIdRef.current = playerMapId;

        // Run ON_LOAD / ON_TRANSITION / ON_WARP_INTO scripts so that
        // scripted warps (e.g. warp command) get the same map-entry
        // script treatment as door warps (performWarpTransition).
        if (isDebugMode() || isDebugMode('field')) {
          console.debug('[CYCLING_ROAD] Selected map entry reset before scripts', {
            mapId: playerMapId,
            priorCollisions: player.getCyclingRoadChallengeCollisions(),
          });
        }
        player.setCyclingRoadChallengeActive(false);
        const mapEntryMode: 'warp' | 'return-to-field' = (
          savedLocation && pendingEntryReason === 'state-transition'
        )
          ? 'return-to-field'
          : 'warp';

        const shouldRestoreSavedFlash = Boolean(
          savedLocation
          && (pendingEntryReason === 'state-transition' || pendingEntryReason === 'continue')
        );
        if (shouldRestoreSavedFlash) {
          setFlashLevel?.(savedLocation?.flashLevel ?? 0);
        } else {
          const currentMap = snapshot.maps.find((map) => map.entry.id === playerMapId) ?? null;
          setDefaultFlashLevel?.({
            mapRequiresFlash: currentMap?.mapRequiresFlash ?? false,
            hasFlashFlag: gameFlags.isSet('FLAG_SYS_USE_FLASH'),
          });
        }

        await runMapEntryScripts({
          currentMapId: playerMapId,
          snapshot,
          objectEventManager: objectEventManagerRef.current,
          player,
          playerHiddenRef,
          pipeline,
          mapScriptCache: mapScriptCacheRef.current as Map<string, any> | undefined,
          setMapMetatile: setMapMetatile
            ? (mapId, tileX, tileY, metatileId, collision?) => {
                setMapMetatile(mapId, tileX, tileY, metatileId, collision);
              }
            : undefined,
          scriptRuntimeServices,
          mode: mapEntryMode,
          setFlashLevel,
          animateFlashLevel,
        });

        if (pendingObjectEventRuntimeState) {
          objectEventManagerRef.current.applyRuntimeState(pendingObjectEventRuntimeState);
        }

        const scriptedWarp = pendingScriptedWarpRef.current;
        const completingScriptedWarpLoad = Boolean(
          scriptedWarp
          && scriptedWarp.phase === 'loading'
          && scriptedWarp.mapId === entry.id
        );

        playerHiddenRef.current = false;
        mapEntryCutsceneGateRef.current = true;
        if (isDebugMode('field')) {
          console.log('[MAP_ENTRY_GATE] armed', {
            mapId: entry.id,
            scriptedWarpLoad: completingScriptedWarpLoad,
            storyScriptRunning: storyScriptRunningRef.current,
          });
        }

        if (completingScriptedWarpLoad && scriptedWarp) {
          // Pre-seed the warp handler's last checked tile so the warp detector
          // sees tileChanged=false on the first frame. Without this, landing on
          // a staircase tile after a scripted warp would immediately re-warp.
          warpHandlerRef.current.updateLastCheckedTile(player.tileX, player.tileY, entry.id);
          const fade = fadeControllerRef.current;
          const now = performance.now();
          if (fade.getDirection() !== 'in' || !fade.isActive()) {
            fade.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, now);
          }
        }

        const shouldUnlockInput = (
          !completingScriptedWarpLoad
          && !storyScriptRunningRef.current
          && pendingScriptedWarpRef.current === null
          && !warpingRef.current
        );
        if (shouldUnlockInput) {
          tryUnlockInput(player, {
            warpingRef,
            storyScriptRunningRef,
            dialogIsOpenRef: { current: false },
            pendingScriptedWarpRef,
            mapEntryCutsceneGateRef,
          });
        }
      }

      setStats((stats) => ({ ...stats, error: null }));
    } catch (error) {
      if (!cancelled) {
        const scriptedWarp = pendingScriptedWarpRef.current;
        if (scriptedWarp && scriptedWarp.mapId === entry.id) {
          if (scriptedWarp.completion && !scriptedWarp.completion.settled) {
            scriptedWarp.completion.settled = true;
            scriptedWarp.completion.reject(error);
          }
          pendingScriptedWarpRef.current = null;
          warpingRef.current = false;
          tryUnlockInput(playerRef.current, {
            warpingRef,
            storyScriptRunningRef,
            dialogIsOpenRef: { current: false },
            pendingScriptedWarpRef,
            mapEntryCutsceneGateRef,
          });
        }

        setStats((stats) => ({
          ...stats,
          error: error instanceof Error ? error.message : 'Failed to load map assets',
        }));
      }
    } finally {
      if (!cancelled) {
        loadingRef.current = false;
        setLoading(false);
        onLoadingStateChanged?.(0);
      }
    }
  };

  void load();

  return () => {
    cancelled = true;
    loadingRef.current = false;
    setLoading(false);
    onLoadingStateChanged?.(0);
    lastWorldUpdateRef.current = null;
    if (worldManagerRef.current) {
      worldManagerRef.current.dispose();
      worldManagerRef.current = null;
    }
  };
}
