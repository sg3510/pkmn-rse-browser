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
import { combineTilesetPalettes } from '../rendering/webgl/TilesetUploader';
import { METATILE_SIZE } from '../utils/mapLoader';

/**
 * World bounds with pixel dimensions and tile offsets
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
  worldBoundsRef.current = {
    width: worldWidth,
    height: worldHeight,
    minX: worldBounds.minX,
    minY: worldBounds.minY,
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
  loadObjectEventsFromSnapshot?: (snapshot: WorldSnapshot) => Promise<void>;
}

/**
 * Upload a tileset pair to a GPU slot.
 * Consolidates the duplicated upload logic used in multiple event handlers.
 */
export function uploadTilesetPairToSlot(
  pipeline: WebGLRenderPipeline,
  pair: TilesetPairInfo,
  slot: 0 | 1
): void {
  if (slot === 0) {
    pipeline.uploadTilesets(
      pair.primaryImage.data,
      pair.primaryImage.width,
      pair.primaryImage.height,
      pair.secondaryImage.data,
      pair.secondaryImage.width,
      pair.secondaryImage.height,
      pair.animations
    );
    pipeline.uploadPalettes(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
  } else {
    pipeline.uploadTilesetsPair1(
      pair.primaryImage.data,
      pair.primaryImage.width,
      pair.primaryImage.height,
      pair.secondaryImage.data,
      pair.secondaryImage.width,
      pair.secondaryImage.height,
      pair.animations
    );
    pipeline.uploadPalettesPair1(combineTilesetPalettes(pair.primaryPalettes, pair.secondaryPalettes));
  }
}

/**
 * Upload tilesets from scheduler's GPU slot assignments.
 * Used by tilesetsChanged and gpuSlotsSwapped handlers.
 */
function uploadTilesetsFromScheduler(
  pipeline: WebGLRenderPipeline,
  scheduler: TilesetPairScheduler
): void {
  const { slot0: slot0PairId, slot1: slot1PairId } = scheduler.getGpuSlots();

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

  // Reload object events (NPCs, items) for the new set of maps
  // Note: This is async - NPCs will appear once loaded
  // The collision checker references the same ObjectEventManager so it will
  // see the new NPCs once this completes
  if (loadObjectEventsFromSnapshot) {
    loadObjectEventsFromSnapshot(snapshot).catch((err) => {
      console.warn('[WorldManager] Failed to reload object events:', err);
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

  // Upload tilesets based on scheduler's GPU slot assignment
  uploadTilesetsFromScheduler(pipeline, scheduler);

  // Refresh tile resolver with updated GPU slot info
  const freshSnapshot = worldManager.getSnapshot();
  updateResolversFromSnapshot(deps, freshSnapshot);

  pipeline.invalidate();
}

/**
 * Handle reanchored event - adjust player and camera positions
 */
function handleReanchored(
  deps: Pick<WorldManagerEventDeps, 'playerRef' | 'cameraRef'>,
  offsetShift: { x: number; y: number }
): void {
  const { playerRef, cameraRef } = deps;

  // Adjust player position by the offset shift
  const player = playerRef.current;
  if (player) {
    player.setPosition(
      player.tileX - offsetShift.x,
      player.tileY - offsetShift.y
    );
  }

  // Also adjust camera to prevent jitter on reanchor
  if (cameraRef.current) {
    cameraRef.current.adjustOffset(offsetShift.x, offsetShift.y);
  }
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

    if (event.type === 'tilesetsChanged') {
      handleTilesetsChanged(deps, worldManager);
    }

    if (event.type === 'reanchored') {
      handleReanchored(deps, event.offsetShift);
    }

    if (event.type === 'gpuSlotsSwapped') {
      handleGpuSlotsSwapped(deps, worldManager, event.needsRebuild);
    }
  };
}

/**
 * Create the GPU upload callback for the scheduler.
 * This is passed to worldManager.setGpuUploadCallback()
 */
export function createGpuUploadCallback(
  pipeline: WebGLRenderPipeline
): (pair: TilesetPairInfo, slot: 0 | 1) => void {
  return (pair: TilesetPairInfo, slot: 0 | 1) => {
    uploadTilesetPairToSlot(pipeline, pair, slot);
  };
}
