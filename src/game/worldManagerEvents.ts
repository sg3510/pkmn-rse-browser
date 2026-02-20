/**
 * WorldManager Event Handlers
 *
 * Extracted event handling logic for WorldManager events in WebGLMapPage.
 * These handlers respond to world state changes and update the rendering pipeline,
 * resolvers, and game state accordingly.
 */

import type { WorldSnapshot, WorldManagerEvent, TilesetPairInfo } from './WorldManager';
import type { WebGLRenderPipeline } from '../rendering/webgl/WebGLRenderPipeline';
import type { TileResolverFn } from '../rendering/types';
import type { PlayerController, TileResolver as PlayerTileResolver } from './PlayerController';
import type { CameraController } from './CameraController';
import type { TilesetPairScheduler } from './TilesetPairScheduler';
import {
  resetTilesetUploadDedupeState,
  uploadTilesetPairToSlotIfNeeded,
} from '../rendering/webgl/TilesetUploader';
import { METATILE_SIZE } from '../utils/mapLoader';
import { getMapScripts } from '../data/scripts';

const LOCAL_MAP_SCRIPT_CACHE_MAX_ENTRIES = 32;

function pruneMapScriptCacheForSnapshot(
  cache: Map<string, unknown>,
  snapshot: WorldSnapshot
): void {
  const keepMapIds = new Set(snapshot.maps.map((map) => map.entry.id));
  keepMapIds.add(snapshot.anchorMapId);

  for (const mapId of cache.keys()) {
    if (!keepMapIds.has(mapId)) {
      cache.delete(mapId);
    }
  }

  while (cache.size > LOCAL_MAP_SCRIPT_CACHE_MAX_ENTRIES) {
    const oldestMapId = cache.keys().next().value as string | undefined;
    if (!oldestMapId) {
      break;
    }
    cache.delete(oldestMapId);
  }
}

/**
 * World bounds in pixel space
 */
export interface WorldBoundsInfo {
  width: number;
  height: number;
  minX: number;
  minY: number;
}

/**
 * Update world bounds from a snapshot.
 * Shared helper used by both initial load and mapsChanged event.
 */
export function updateWorldBounds(
  snapshot: WorldSnapshot,
  worldBoundsRef: React.MutableRefObject<WorldBoundsInfo | null>,
  setWorldSize: (size: { width: number; height: number }) => void,
  setStitchedMapCount: (count: number) => void
): void {
  const { worldBounds } = snapshot;
  const worldWidth = worldBounds.width * METATILE_SIZE;
  const worldHeight = worldBounds.height * METATILE_SIZE;
  const worldMinX = worldBounds.minX * METATILE_SIZE;
  const worldMinY = worldBounds.minY * METATILE_SIZE;
  worldBoundsRef.current = {
    width: worldWidth,
    height: worldHeight,
    minX: worldMinX,
    minY: worldMinY,
  };
  setWorldSize({ width: worldWidth, height: worldHeight });
  setStitchedMapCount(snapshot.maps.length);
}

/**
 * Dependencies for WorldManager event handling
 */
export interface WorldManagerEventDeps {
  /** WebGL render pipeline for GPU uploads and tile resolution */
  pipeline: WebGLRenderPipeline;

  /** Ref to current world snapshot */
  worldSnapshotRef: React.MutableRefObject<WorldSnapshot | null>;

  /** Ref to player controller */
  playerRef: React.MutableRefObject<PlayerController | null>;

  /** Ref to camera controller */
  cameraRef: React.MutableRefObject<CameraController | null>;

  /** Ref to world bounds */
  worldBoundsRef: React.MutableRefObject<WorldBoundsInfo | null>;

  /** State setter for world size display */
  setWorldSize: (size: { width: number; height: number }) => void;

  /** State setter for stitched map count display */
  setStitchedMapCount: (count: number) => void;

  /** Factory to create tile resolver from snapshot */
  createSnapshotTileResolver: (snapshot: WorldSnapshot) => TileResolverFn;

  /** Factory to create player tile resolver from snapshot */
  createSnapshotPlayerTileResolver: (snapshot: WorldSnapshot) => PlayerTileResolver;

  /** Check if operation was cancelled (for async safety) */
  isCancelled: () => boolean;

  /** Optional: Reload object events (NPCs, items) when maps change */
  loadObjectEventsFromSnapshot?: (
    snapshot: WorldSnapshot,
    options?: { preserveExistingMapRuntimeState?: boolean }
  ) => Promise<void>;

  /** Ref indicating a story script is currently running */
  storyScriptRunningRef?: React.MutableRefObject<boolean>;

  /** Map script cache for eager pre-population on anchor change */
  mapScriptCacheRef?: React.MutableRefObject<Map<string, unknown> | null>;

  /** Optional callback for loading activity during background stitching */
  onLoadingStateChanged?: (loadingCount: number) => void;
}

/**
 * Upload a tileset pair to a GPU slot.
 * Consolidates the duplicated upload logic used in multiple event handlers.
 */
export function uploadTilesetPairToSlot(
  pipeline: WebGLRenderPipeline,
  pair: TilesetPairInfo,
  slot: 0 | 1 | 2
): void {
  uploadTilesetPairToSlotIfNeeded(pipeline, pair, slot);
}

/**
 * Upload tilesets from scheduler's GPU slot assignments.
 * Used by tilesetsChanged and gpuSlotsSwapped handlers.
 */
function uploadTilesetsFromScheduler(
  pipeline: WebGLRenderPipeline,
  scheduler: TilesetPairScheduler
): void {
  const { slot0: slot0PairId, slot1: slot1PairId, slot2: slot2PairId } = scheduler.getGpuSlots();

  if (slot0PairId) {
    const pair = scheduler.getCachedPair(slot0PairId);
    if (pair) {
      uploadTilesetPairToSlot(pipeline, pair, 0);
    }
  }

  if (slot1PairId) {
    const pair = scheduler.getCachedPair(slot1PairId);
    if (pair) {
      uploadTilesetPairToSlot(pipeline, pair, 1);
    }
  }

  if (slot2PairId) {
    const pair = scheduler.getCachedPair(slot2PairId);
    if (pair) {
      uploadTilesetPairToSlot(pipeline, pair, 2);
    }
  }
}

/**
 * Update tile resolvers from a fresh snapshot.
 * Used after tileset changes to ensure resolvers have correct GPU slot info.
 */
function updateResolversFromSnapshot(
  deps: Pick<WorldManagerEventDeps, 'pipeline' | 'worldSnapshotRef' | 'playerRef' | 'createSnapshotTileResolver' | 'createSnapshotPlayerTileResolver'>,
  snapshot: WorldSnapshot
): void {
  const { pipeline, worldSnapshotRef, playerRef, createSnapshotTileResolver, createSnapshotPlayerTileResolver } = deps;

  worldSnapshotRef.current = snapshot;
  const resolver = createSnapshotTileResolver(snapshot);
  pipeline.setTileResolver(resolver);

  const player = playerRef.current;
  if (player) {
    const playerResolver = createSnapshotPlayerTileResolver(snapshot);
    player.setTileResolver(playerResolver);
  }
}

/**
 * Handle mapsChanged event - update snapshot, resolvers, world bounds, and object events
 */
function handleMapsChanged(
  deps: WorldManagerEventDeps,
  snapshot: WorldSnapshot
): void {
  const {
    pipeline,
    worldSnapshotRef,
    playerRef,
    worldBoundsRef,
    setWorldSize,
    setStitchedMapCount,
    createSnapshotTileResolver,
    createSnapshotPlayerTileResolver,
    loadObjectEventsFromSnapshot,
  } = deps;

  // Update snapshot and resolvers
  worldSnapshotRef.current = snapshot;

  // Update tile resolver
  const resolver = createSnapshotTileResolver(snapshot);
  pipeline.setTileResolver(resolver);

  // Update player resolver
  const player = playerRef.current;
  if (player) {
    const playerResolver = createSnapshotPlayerTileResolver(snapshot);
    player.setTileResolver(playerResolver);
  }

  // Update world bounds (shared helper)
  updateWorldBounds(snapshot, worldBoundsRef, setWorldSize, setStitchedMapCount);

  // Reload object events (NPCs, items) for the new set of maps.
  // While a script is running, preserve runtime state on already-parsed maps
  // but still parse newly loaded maps so long scripted movement involving
  // LOCALID-addressable large objects does not arrive in maps with missing NPCs.
  const scriptRunning = deps.storyScriptRunningRef?.current ?? false;
  if (loadObjectEventsFromSnapshot) {
    loadObjectEventsFromSnapshot(snapshot, {
      preserveExistingMapRuntimeState: scriptRunning,
    }).catch((err) => {
      console.warn('[WorldManager] Failed to reload object events:', err);
    });
  }

  const mapScriptCache = deps.mapScriptCacheRef?.current;
  if (mapScriptCache) {
    pruneMapScriptCacheForSnapshot(mapScriptCache, snapshot);
  }

  // Invalidate pipeline cache
  pipeline.invalidate();
}

/**
 * Handle anchorChanged event - update snapshot, resolvers, world bounds,
 * and eagerly cache the new anchor's scripts. Does NOT reload NPC objects
 * (no map was actually loaded/unloaded — the player just crossed a map boundary).
 */
function handleAnchorChanged(
  deps: WorldManagerEventDeps,
  snapshot: WorldSnapshot,
  newAnchorMapId: string
): void {
  const {
    pipeline,
    worldSnapshotRef,
    playerRef,
    worldBoundsRef,
    setWorldSize,
    setStitchedMapCount,
    createSnapshotTileResolver,
    createSnapshotPlayerTileResolver,
    mapScriptCacheRef,
  } = deps;

  // Update snapshot and resolvers
  worldSnapshotRef.current = snapshot;

  const resolver = createSnapshotTileResolver(snapshot);
  pipeline.setTileResolver(resolver);

  const player = playerRef.current;
  if (player) {
    const playerResolver = createSnapshotPlayerTileResolver(snapshot);
    player.setTileResolver(playerResolver);
  }

  // Update world bounds
  updateWorldBounds(snapshot, worldBoundsRef, setWorldSize, setStitchedMapCount);

  // Eagerly pre-populate map script cache for the new anchor
  const cache = mapScriptCacheRef?.current;
  if (cache) {
    pruneMapScriptCacheForSnapshot(cache, snapshot);
  }

  if (cache && !cache.has(newAnchorMapId)) {
    getMapScripts(newAnchorMapId).then((data) => {
      cache.set(newAnchorMapId, data);
      pruneMapScriptCacheForSnapshot(cache, snapshot);
    }).catch(() => {
      // Non-critical — scripts will be loaded lazily later
    });
  }

  // Invalidate pipeline cache
  pipeline.invalidate();
}

/**
 * Handle tilesetsChanged event - upload tilesets and refresh resolvers
 */
function handleTilesetsChanged(
  deps: WorldManagerEventDeps,
  worldManager: { getScheduler: () => TilesetPairScheduler; getSnapshot: () => WorldSnapshot }
): void {
  const { pipeline } = deps;
  const scheduler = worldManager.getScheduler();

  // Scheduler explicitly invalidated slot contents; force fresh signature baseline.
  resetTilesetUploadDedupeState(pipeline);

  // Upload tilesets based on scheduler's GPU slot assignment
  uploadTilesetsFromScheduler(pipeline, scheduler);

  // Refresh tile resolver with updated GPU slot info
  const freshSnapshot = worldManager.getSnapshot();
  updateResolversFromSnapshot(deps, freshSnapshot);

  pipeline.invalidate();
}

/**
 * Handle gpuSlotsSwapped event - re-upload tilesets and refresh resolvers
 */
function handleGpuSlotsSwapped(
  deps: WorldManagerEventDeps,
  worldManager: { getScheduler: () => TilesetPairScheduler; getSnapshot: () => WorldSnapshot },
  needsRebuild: boolean
): void {
  const { pipeline } = deps;
  const scheduler = worldManager.getScheduler();

  // GPU slot swap is an explicit tileset upload invalidation event.
  resetTilesetUploadDedupeState(pipeline);

  // Re-upload tilesets based on scheduler's new slot assignments
  uploadTilesetsFromScheduler(pipeline, scheduler);

  // CRITICAL: Get fresh snapshot with updated pairIdToGpuSlot and recreate tile resolver!
  // Without this, the tile resolver has stale GPU slot info and can't render border tiles correctly
  const freshSnapshot = worldManager.getSnapshot();
  updateResolversFromSnapshot(deps, freshSnapshot);

  if (needsRebuild) {
    pipeline.invalidate();
  }
}

function handleLoadingStateChanged(
  deps: WorldManagerEventDeps,
  loadingCount: number
): void {
  deps.onLoadingStateChanged?.(loadingCount);
}

/**
 * Create the main WorldManager event handler.
 * This is the callback passed to worldManager.on()
 */
export function createWorldManagerEventHandler(
  deps: WorldManagerEventDeps,
  worldManager: { getScheduler: () => TilesetPairScheduler; getSnapshot: () => WorldSnapshot }
): (event: WorldManagerEvent) => void {
  return (event: WorldManagerEvent) => {
    if (deps.isCancelled()) return;

    if (event.type === 'mapsChanged') {
      handleMapsChanged(deps, event.snapshot);
    }

    if (event.type === 'anchorChanged') {
      handleAnchorChanged(deps, event.snapshot, event.newAnchorMapId);
    }

    if (event.type === 'tilesetsChanged') {
      handleTilesetsChanged(deps, worldManager);
    }

    if (event.type === 'gpuSlotsSwapped') {
      handleGpuSlotsSwapped(deps, worldManager, event.needsRebuild);
    }

    if (event.type === 'loadingStateChanged') {
      handleLoadingStateChanged(deps, event.loadingCount);
    }
  };
}

/**
 * Create the GPU upload callback for the scheduler.
 * This is passed to worldManager.setGpuUploadCallback()
 */
export function createGpuUploadCallback(
  pipeline: WebGLRenderPipeline
): (pair: TilesetPairInfo, slot: 0 | 1 | 2) => void {
  return (pair: TilesetPairInfo, slot: 0 | 1 | 2) => {
    uploadTilesetPairToSlot(pipeline, pair, slot);
  };
}
