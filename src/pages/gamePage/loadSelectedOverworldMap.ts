import type { MapIndexEntry } from '../../types/maps';
import type { CameraController } from '../../game/CameraController';
import { createWebGLCameraController } from '../../game/CameraController';
import { WorldManager, type WorldSnapshot } from '../../game/WorldManager';
import {
  createWorldManagerEventHandler,
  createGpuUploadCallback,
} from '../../game/worldManagerEvents';
import { setupObjectCollisionChecker } from '../../game/setupObjectCollisionChecker';
import { findPlayerSpawnPosition } from '../../game/findPlayerSpawnPosition';
import type { PlayerController, TileResolver as PlayerTileResolver } from '../../game/PlayerController';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { TileResolverFn } from '../../rendering/types';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { FadeController } from '../../field/FadeController';
import type { WarpHandler } from '../../field/WarpHandler';
import { FADE_TIMING } from '../../field/types';
import type { LocationState } from '../../save/types';

interface MutableRef<T> {
  current: T;
}

interface PendingScriptedWarpLike {
  mapId: string;
  phase: 'pending' | 'fading' | 'loading';
}

interface LastWorldUpdate {
  tileX: number;
  tileY: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface LoadSelectedOverworldMapParams {
  entry: MapIndexEntry;
  viewportTilesWide: number;
  viewportTilesHigh: number;
  pipeline: WebGLRenderPipeline;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  playerRef: MutableRef<PlayerController | null>;
  cameraRef: MutableRef<CameraController | null>;
  worldBoundsRef: MutableRef<{ width: number; height: number; minX: number; minY: number }>;
  worldManagerRef: MutableRef<WorldManager | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  pendingSavedLocationRef: MutableRef<LocationState | null>;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarpLike | null>;
  warpingRef: MutableRef<boolean>;
  playerHiddenRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  lastCoordTriggerTileRef: MutableRef<{ mapId: string; x: number; y: number } | null>;
  warpHandlerRef: MutableRef<WarpHandler>;
  lastWorldUpdateRef: MutableRef<LastWorldUpdate | null>;
  fadeControllerRef: MutableRef<FadeController>;
  setLoading: (loading: boolean) => void;
  setStats: (updater: (stats: any) => any) => void;
  setCameraDisplay: (position: { x: number; y: number }) => void;
  setWorldSize: (size: { width: number; height: number }) => void;
  setStitchedMapCount: (count: number) => void;
  createSnapshotTileResolver: (snapshot: WorldSnapshot) => TileResolverFn;
  createSnapshotPlayerTileResolver: (snapshot: WorldSnapshot) => PlayerTileResolver;
  loadObjectEventsFromSnapshot: (snapshot: WorldSnapshot) => Promise<void>;
  initializeWorldFromSnapshot: (snapshot: WorldSnapshot, pipeline: WebGLRenderPipeline) => Promise<void>;
  applyStoryTransitionObjectParity: (mapId: string) => void;
}

export function loadSelectedOverworldMap(params: LoadSelectedOverworldMapParams): () => void {
  const {
    entry,
    viewportTilesWide,
    viewportTilesHigh,
    pipeline,
    worldSnapshotRef,
    playerRef,
    cameraRef,
    worldBoundsRef,
    worldManagerRef,
    objectEventManagerRef,
    pendingSavedLocationRef,
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    lastCoordTriggerTileRef,
    warpHandlerRef,
    lastWorldUpdateRef,
    fadeControllerRef,
    setLoading,
    setStats,
    setCameraDisplay,
    setWorldSize,
    setStitchedMapCount,
    createSnapshotTileResolver,
    createSnapshotPlayerTileResolver,
    loadObjectEventsFromSnapshot,
    initializeWorldFromSnapshot,
    applyStoryTransitionObjectParity,
  } = params;

  let cancelled = false;

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
        },
        worldManager
      );
      worldManager.on(eventHandler);

      worldManager.setGpuUploadCallback(createGpuUploadCallback(pipeline));

      const snapshot = await worldManager.initialize(entry.id);
      if (cancelled) return;

      await initializeWorldFromSnapshot(snapshot, pipeline);

      pipeline.invalidate();

      const player = playerRef.current;
      if (player) {
        const playerResolver = createSnapshotPlayerTileResolver(snapshot);
        player.setTileResolver(playerResolver);

        objectEventManagerRef.current.setTileElevationResolver((tileX, tileY) => {
          const resolved = playerResolver(tileX, tileY);
          return resolved?.mapTile.elevation ?? null;
        });

        setupObjectCollisionChecker(player, objectEventManagerRef.current);

        const savedLocation = pendingSavedLocationRef.current;
        pendingSavedLocationRef.current = null;

        if (savedLocation) {
          console.log('[GamePage] Spawning player at saved position:', savedLocation.pos);
          player.setPosition(savedLocation.pos.x, savedLocation.pos.y);
          if (savedLocation.direction) {
            player.dir = savedLocation.direction;
          }
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
        }

        const playerMapId = worldManager.findMapAtPosition(player.tileX, player.tileY)?.entry.id ?? entry.id;
        lastCoordTriggerTileRef.current = {
          mapId: playerMapId,
          x: player.tileX,
          y: player.tileY,
        };

        applyStoryTransitionObjectParity(playerMapId);
        playerHiddenRef.current = false;
        storyScriptRunningRef.current = false;

        const scriptedWarp = pendingScriptedWarpRef.current;
        if (scriptedWarp && scriptedWarp.phase === 'loading' && scriptedWarp.mapId === entry.id) {
          pendingScriptedWarpRef.current = null;
          warpingRef.current = false;
          // Pre-seed the warp handler's last checked tile so the warp detector
          // sees tileChanged=false on the first frame. Without this, landing on
          // a staircase tile after a scripted warp would immediately re-warp.
          warpHandlerRef.current.updateLastCheckedTile(player.tileX, player.tileY, entry.id);
          const fade = fadeControllerRef.current;
          const now = performance.now();
          fade.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, now);
          setTimeout(() => {
            player.unlockInput();
          }, FADE_TIMING.DEFAULT_DURATION_MS);
        }
      }

      setStats((stats) => ({ ...stats, error: null }));
    } catch (error) {
      if (!cancelled) {
        const scriptedWarp = pendingScriptedWarpRef.current;
        if (scriptedWarp && scriptedWarp.mapId === entry.id) {
          pendingScriptedWarpRef.current = null;
          warpingRef.current = false;
          playerRef.current?.unlockInput();
        }

        setStats((stats) => ({
          ...stats,
          error: error instanceof Error ? error.message : 'Failed to load map assets',
        }));
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  void load();

  return () => {
    cancelled = true;
    lastWorldUpdateRef.current = null;
    if (worldManagerRef.current) {
      worldManagerRef.current.dispose();
      worldManagerRef.current = null;
    }
  };
}
