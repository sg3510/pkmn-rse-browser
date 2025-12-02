/**
 * MapRendererInit - Game initialization logic extracted from MapRenderer.tsx
 *
 * This module contains the async initialization sequence for the game,
 * separated to reduce the size of the main MapRenderer component.
 */

import { PlayerController } from '../game/PlayerController';
import type { WorldState, TilesetResources } from '../services/MapManager';
import { TilesetCanvasCache } from '../rendering/TilesetCanvasCache';
import type { IRenderPipeline } from '../rendering/IRenderPipeline';
import { RenderPipelineFactory, WebGLRenderPipelineAdapter } from '../rendering/RenderPipelineFactory';
import { RENDERING_CONFIG } from '../config/rendering';
import { AnimationTimer } from '../engine/AnimationTimer';
import { GameLoop, type FrameHandler } from '../engine/GameLoop';
import { createInitialState, ObservableState, type Position } from '../engine/GameState';
import { UpdateCoordinator } from '../engine/UpdateCoordinator';
import { npcSpriteCache } from '../game/npc';
import type { TilesetRuntime, RenderContext, ReflectionState } from './map/types';
import type { DebugOptions, DebugState } from './debug';
import type { EngineFrameResult, RunUpdateCallbacks } from '../hooks/useRunUpdate';
import type { WarpExecutionCallbacks } from '../hooks/useWarpExecution';
import type { CameraView } from '../utils/camera';
import { resolveTileAt, isVerticalObject, type WarpTrigger, type ResolvedTile } from './map/utils';
import { applyBehaviorOverrides } from '../utils/worldUtils';
import type { MapManager } from '../services/MapManager';
import type { FadeController } from '../field/FadeController';
import type { WarpHandler } from '../field/WarpHandler';
import type { ObjectEventManager } from '../game/ObjectEventManager';
import type { DoorWarpRequest } from '../game/PlayerController';
import type { CardinalDirection } from '../field/types';

export interface WorldCameraView extends CameraView {
  worldStartTileX: number;
  worldStartTileY: number;
  cameraWorldX: number;
  cameraWorldY: number;
}

export interface InitRefs {
  renderGenerationRef: React.MutableRefObject<number>;
  lastFrameResultRef: React.MutableRefObject<EngineFrameResult | null>;
  renderContextRef: React.MutableRefObject<RenderContext | null>;
  currentTimestampRef: React.MutableRefObject<number>;
  playerControllerRef: React.MutableRefObject<PlayerController | null>;
  cameraViewRef: React.MutableRefObject<WorldCameraView | null>;
  lastViewKeyRef: React.MutableRefObject<string>;
  animationTimerRef: React.MutableRefObject<AnimationTimer | null>;
  tilesetCacheRef: React.MutableRefObject<TilesetCanvasCache | null>;
  hasRenderedRef: React.MutableRefObject<boolean>;
  fadeRef: React.MutableRefObject<FadeController>;
  debugOptionsRef: React.MutableRefObject<DebugOptions>;
  reflectionStateRef: React.MutableRefObject<ReflectionState>;
  mapManagerRef: React.MutableRefObject<MapManager>;
  renderPipelineRef: React.MutableRefObject<IRenderPipeline | null>;
  webglCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  gameLoopRef: React.MutableRefObject<GameLoop | null>;
  updateCoordinatorRef: React.MutableRefObject<UpdateCoordinator | null>;
  gameStateRef: React.MutableRefObject<ObservableState | null>;
  objectEventManagerRef: React.MutableRefObject<ObjectEventManager>;
  warpHandlerRef: React.MutableRefObject<WarpHandler>;
  debugEnabledRef: React.MutableRefObject<boolean>;
  tilesetRuntimeCacheRef: React.MutableRefObject<Map<string, TilesetRuntime>>;
}

export interface InitHooks {
  ensureTilesetRuntime: (tilesets: TilesetResources) => Promise<TilesetRuntime>;
  createRunUpdate: (generation: number, callbacks: RunUpdateCallbacks) => (deltaMs: number, timestamp: number) => void;
  createWarpExecutors: (generation: number, callbacks: WarpExecutionCallbacks) => {
    performWarp: (trigger: WarpTrigger, options?: { force?: boolean; fromDoor?: boolean }) => Promise<void>;
    startAutoDoorWarp: (
      trigger: WarpTrigger,
      resolved: ResolvedTile,
      player: PlayerController,
      entryDirection?: CardinalDirection,
      options?: { isAnimatedDoor?: boolean }
    ) => boolean;
    advanceDoorEntry: (timestamp: number) => void;
    advanceDoorExit: (timestamp: number) => void;
    handleDoorWarpAttempt: (request: DoorWarpRequest) => Promise<void>;
  };
  resetDoorSequencer: () => void;
  fieldSpritesLoadAll: () => Promise<unknown>;
  compositeScene: (
    reflectionState: ReflectionState,
    view: WorldCameraView,
    viewChanged: boolean,
    animationFrameChanged: boolean,
    timestamp: number,
    gameFrame: number
  ) => void;
  refreshDebugOverlay: (
    ctx: RenderContext,
    player: PlayerController,
    view: WorldCameraView | null
  ) => void;
}

export interface InitCallbacks {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDebugState: (state: DebugState) => void;
  buildPatchedTilesForRuntime: (runtime: TilesetRuntime, animationState: Record<string, number>) => { primary: Uint8Array; secondary: Uint8Array };
  shiftWorld: (state: WorldState, shiftX: number, shiftY: number) => WorldState;
}

export interface InitializeGameOptions {
  mapId: string;
  generation: number;
  refs: InitRefs;
  hooks: InitHooks;
  callbacks: InitCallbacks;
  connectionDepth: number;
}

/**
 * Rebuild render context for a new world state.
 */
async function rebuildContextForWorld(
  world: WorldState,
  anchorId: string,
  refs: InitRefs,
  ensureTilesetRuntime: (tilesets: TilesetResources) => Promise<TilesetRuntime>
) {
  const anchor = world.maps.find((m) => m.entry.id === anchorId) ?? world.maps[0];
  const tilesetRuntimes = new Map<string, TilesetRuntime>();
  for (const map of world.maps) {
    const runtime = await ensureTilesetRuntime(map.tilesets);
    runtime.resources.primaryAttributes = applyBehaviorOverrides(runtime.resources.primaryAttributes);
    runtime.resources.secondaryAttributes = applyBehaviorOverrides(runtime.resources.secondaryAttributes);
    tilesetRuntimes.set(map.tilesets.key, runtime);
  }
  refs.renderContextRef.current = {
    world,
    tilesetRuntimes,
    anchor,
  };
  refs.hasRenderedRef.current = false;

  // Re-parse object events for the new world
  const objectEventManager = refs.objectEventManagerRef.current;
  objectEventManager.clear();
  for (const map of world.maps) {
    objectEventManager.parseMapObjects(
      map.entry.id,
      map.objectEvents,
      map.offsetX,
      map.offsetY
    );
  }

  // Load NPC sprites for visible NPCs
  const npcGraphicsIds = objectEventManager.getUniqueNPCGraphicsIds();
  if (npcGraphicsIds.length > 0) {
    await npcSpriteCache.loadMany(npcGraphicsIds);
  }

  // Upload tilesets to WebGL if using WebGL pipeline
  uploadTilesetsToWebGL(refs, tilesetRuntimes);
}

/** Tileset width in pixels (16 tiles * 8 pixels) */
const TILESET_WIDTH = 128;

/**
 * Upload tilesets and palettes to WebGL pipeline if active.
 * This is needed because WebGL requires explicit GPU uploads.
 */
function uploadTilesetsToWebGL(
  refs: InitRefs,
  tilesetRuntimes: Map<string, TilesetRuntime>
) {
  const pipeline = refs.renderPipelineRef.current;
  if (!pipeline || pipeline.rendererType !== 'webgl') {
    return;
  }

  // Cast to WebGL adapter to access upload methods
  const webglPipeline = pipeline as WebGLRenderPipelineAdapter;

  // Use the anchor map's tileset for initial upload
  const ctx = refs.renderContextRef.current;
  if (!ctx) return;

  const anchorRuntime = tilesetRuntimes.get(ctx.anchor.tilesets.key);
  if (!anchorRuntime) return;

  const { resources } = anchorRuntime;

  // Calculate dimensions from data length (tilesets are 128px wide)
  const primaryWidth = TILESET_WIDTH;
  const primaryHeight = resources.primaryTilesImage.length / TILESET_WIDTH;
  const secondaryWidth = TILESET_WIDTH;
  const secondaryHeight = resources.secondaryTilesImage.length / TILESET_WIDTH;

  // Upload tilesets
  webglPipeline.uploadTilesets(
    resources.primaryTilesImage,
    primaryWidth,
    primaryHeight,
    resources.secondaryTilesImage,
    secondaryWidth,
    secondaryHeight,
    anchorRuntime.animations
  );

  // Combine palettes (GBA system: slots 0-5 from primary, 6-12 from secondary)
  const combinedPalettes = [
    ...resources.primaryPalettes.slice(0, 6),
    ...resources.secondaryPalettes.slice(6, 13), // slots 6-12
  ];
  // Pad to 16 palettes
  while (combinedPalettes.length < 16) {
    combinedPalettes.push(resources.primaryPalettes[0]);
  }

  webglPipeline.uploadPalettes(combinedPalettes);
}

/**
 * Apply tile resolver to player controller
 */
function applyTileResolver(refs: InitRefs) {
  refs.playerControllerRef.current?.setTileResolver((tileX, tileY) => {
    const ctx = refs.renderContextRef.current;
    if (!ctx) return null;
    const resolved = resolveTileAt(ctx, tileX, tileY);
    if (!resolved) return null;
    return { mapTile: resolved.mapTile, attributes: resolved.attributes };
  });
}

/**
 * Apply tile resolver and vertical object checker to render pipeline
 */
function applyPipelineResolvers(refs: InitRefs) {
  const pipeline = refs.renderPipelineRef.current;
  if (!pipeline) return;

  pipeline.setTileResolver((tileX, tileY) => {
    const ctx = refs.renderContextRef.current;
    if (!ctx) return null;
    return resolveTileAt(ctx, tileX, tileY);
  });

  pipeline.setVerticalObjectChecker((tileX, tileY) => {
    const ctx = refs.renderContextRef.current;
    if (!ctx) return false;
    return isVerticalObject(ctx, tileX, tileY);
  });
}

/**
 * Initialize and start the game for the given map.
 */
export async function initializeGame({
  mapId,
  generation,
  refs,
  hooks,
  callbacks,
  connectionDepth,
}: InitializeGameOptions): Promise<void> {
  (window as unknown as { DEBUG_RENDER?: boolean }).DEBUG_RENDER = false;

  try {
    callbacks.setLoading(true);
    callbacks.setError(null);
    refs.hasRenderedRef.current = false;
    refs.renderContextRef.current = null;
    refs.cameraViewRef.current = null;
    refs.lastViewKeyRef.current = '';
    refs.gameLoopRef.current?.stop();
    refs.gameLoopRef.current = null;
    refs.updateCoordinatorRef.current = null;
    refs.gameStateRef.current = null;
    refs.animationTimerRef.current = null;
    refs.lastFrameResultRef.current = null;

    const world = await refs.mapManagerRef.current.buildWorld(mapId, connectionDepth);
    await rebuildContextForWorld(world, mapId, refs, hooks.ensureTilesetRuntime);

    // Abort if a newer render cycle started while loading
    if (generation !== refs.renderGenerationRef.current) {
      return;
    }

    // Load player sprite
    const player = new PlayerController();
    await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
    await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
    await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
    await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');

    // Load field effect sprites (grass, sand, splash, etc.)
    await hooks.fieldSpritesLoadAll();

    // Initialize shared tileset cache and render pipeline
    if (!refs.tilesetCacheRef.current) {
      refs.tilesetCacheRef.current = new TilesetCanvasCache();
    }

    // Create WebGL canvas if WebGL is enabled
    // Always create a fresh canvas to avoid React StrictMode issues
    // where the WebGL context gets corrupted between double-invocations
    let webglCanvas: HTMLCanvasElement | undefined;
    if (RENDERING_CONFIG.enableWebGL && !RENDERING_CONFIG.forceCanvas2D) {
      // Always create fresh canvas - reusing can cause context issues in StrictMode
      refs.webglCanvasRef.current = document.createElement('canvas');
      webglCanvas = refs.webglCanvasRef.current;
      // Set initial dimensions (will be resized when viewport is known)
      // WebGL context fails on zero-size canvas
      webglCanvas.width = 640;
      webglCanvas.height = 480;
    }

    const { pipeline, rendererType } = RenderPipelineFactory.create(webglCanvas, {
      tilesetCache: refs.tilesetCacheRef.current,
      preferWebGL: RENDERING_CONFIG.enableWebGL,
    });
    refs.renderPipelineRef.current = pipeline;
    console.log(`[PERF] RenderPipeline initialized (${rendererType})`);

    // Upload tilesets to WebGL now that pipeline exists
    // (rebuildContextForWorld ran earlier when pipeline was null)
    if (rendererType === 'webgl') {
      const renderCtx = refs.renderContextRef.current as RenderContext | null;
      if (renderCtx) {
        uploadTilesetsToWebGL(refs, renderCtx.tilesetRuntimes);
      }
    }

    // Initialize player position
    const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
    if (!anchor) {
      throw new Error('Failed to determine anchor map for warp setup');
    }
    const startTileX = Math.floor(anchor.mapData.width / 2);
    const startTileY = Math.floor(anchor.mapData.height / 2);
    player.setPositionAndDirection(startTileX, startTileY, 'down');

    const resolveTileForPlayer = (tileX: number, tileY: number) => {
      const ctx = refs.renderContextRef.current;
      if (!ctx) return null;
      const resolved = resolveTileAt(ctx, tileX, tileY);
      if (!resolved) return null;
      return { mapTile: resolved.mapTile, attributes: resolved.attributes };
    };
    player.setTileResolver(resolveTileForPlayer);

    // Set up object collision checker for item balls, NPCs, etc.
    // Uses shared hasObjectCollisionAt from ObjectEventManager
    player.setObjectCollisionChecker((tileX, tileY) => {
      const objectManager = refs.objectEventManagerRef.current;
      const playerElev = player.getCurrentElevation();
      return objectManager.hasObjectCollisionAt(tileX, tileY, playerElev);
    });

    refs.playerControllerRef.current = player;

    applyTileResolver(refs);
    applyPipelineResolvers(refs);
    callbacks.setLoading(false);

    const startingPosition: Position = {
      x: player.x,
      y: player.y,
      tileX: player.tileX,
      tileY: player.tileY,
    };
    const gameState = new ObservableState(createInitialState(world, startingPosition));
    refs.gameStateRef.current = gameState;
    const animationTimer = new AnimationTimer();
    refs.animationTimerRef.current = animationTimer;

    // Reset WarpHandler and set initial position
    const warpHandler = refs.warpHandlerRef.current;
    warpHandler.reset();
    if (anchor) {
      warpHandler.updateLastCheckedTile(startTileX, startTileY, anchor.entry.id);
    }
    hooks.resetDoorSequencer();

    const warpCallbacks: WarpExecutionCallbacks = {
      rebuildContextForWorld: (world: WorldState, anchorId: string) =>
        rebuildContextForWorld(world, anchorId, refs, hooks.ensureTilesetRuntime),
      applyTileResolver: () => applyTileResolver(refs),
      applyPipelineResolvers: () => applyPipelineResolvers(refs),
    };

    const {
      performWarp,
      startAutoDoorWarp,
      advanceDoorEntry,
      advanceDoorExit,
      handleDoorWarpAttempt,
    } = hooks.createWarpExecutors(generation, warpCallbacks);

    refs.playerControllerRef.current?.setDoorWarpHandler(handleDoorWarpAttempt);

    // Create runUpdate function using the hook's factory
    const runUpdateCallbacks: RunUpdateCallbacks = {
      advanceDoorEntry,
      advanceDoorExit,
      startAutoDoorWarp,
      performWarp,
      rebuildContextForWorld: (world: WorldState, anchorId: string) =>
        rebuildContextForWorld(world, anchorId, refs, hooks.ensureTilesetRuntime),
      applyTileResolver: () => applyTileResolver(refs),
      applyPipelineResolvers: () => applyPipelineResolvers(refs),
      buildPatchedTilesForRuntime: callbacks.buildPatchedTilesForRuntime,
      shiftWorld: callbacks.shiftWorld,
    };
    const runUpdate = hooks.createRunUpdate(generation, runUpdateCallbacks);

    const renderFrame = (frame: EngineFrameResult) => {
      if (!frame.shouldRender || !frame.view) return;
      const ctxForRender = refs.renderContextRef.current;
      if (!ctxForRender) return;

      hooks.compositeScene(
        refs.reflectionStateRef.current ?? { hasReflection: false, reflectionType: null, bridgeType: 'none' },
        frame.view,
        frame.viewChanged,
        frame.animationFrameChanged,
        refs.currentTimestampRef.current,
        refs.animationTimerRef.current?.getTickCount() ?? 0
      );

      if (refs.debugEnabledRef.current && refs.playerControllerRef.current) {
        hooks.refreshDebugOverlay(ctxForRender, refs.playerControllerRef.current, frame.view);
      }

      // Update debug panel state when enabled
      if (refs.debugEnabledRef.current && refs.playerControllerRef.current) {
        const playerForDebug = refs.playerControllerRef.current;
        const objectManager = refs.objectEventManagerRef.current;

        // Get direction vector for facing tile
        const dirVectors: Record<string, { dx: number; dy: number }> = {
          up: { dx: 0, dy: -1 },
          down: { dx: 0, dy: 1 },
          left: { dx: -1, dy: 0 },
          right: { dx: 1, dy: 0 },
        };
        const vec = dirVectors[playerForDebug.dir] ?? { dx: 0, dy: 0 };
        const facingX = playerForDebug.tileX + vec.dx;
        const facingY = playerForDebug.tileY + vec.dy;

        // Helper to get objects at a specific tile
        const getObjectsAtTile = (tileX: number, tileY: number) => {
          const npcs = objectManager.getVisibleNPCs().filter(
            (npc) => npc.tileX === tileX && npc.tileY === tileY
          );
          const items = objectManager.getVisibleItemBalls().filter(
            (item) => item.tileX === tileX && item.tileY === tileY
          );
          return {
            tileX,
            tileY,
            npcs,
            items,
            hasCollision: npcs.length > 0 || items.length > 0,
          };
        };

        const objectsAtPlayer = getObjectsAtTile(playerForDebug.tileX, playerForDebug.tileY);
        const objectsAtFacing = getObjectsAtTile(facingX, facingY);

        const adjacentObjects = {
          north: getObjectsAtTile(playerForDebug.tileX, playerForDebug.tileY - 1),
          south: getObjectsAtTile(playerForDebug.tileX, playerForDebug.tileY + 1),
          east: getObjectsAtTile(playerForDebug.tileX + 1, playerForDebug.tileY),
          west: getObjectsAtTile(playerForDebug.tileX - 1, playerForDebug.tileY),
        };

        callbacks.setDebugState({
          player: {
            tileX: playerForDebug.tileX,
            tileY: playerForDebug.tileY,
            pixelX: playerForDebug.x,
            pixelY: playerForDebug.y,
            direction: playerForDebug.dir,
            elevation: playerForDebug.getElevation(),
            isMoving: playerForDebug.isMoving,
            isSurfing: playerForDebug.isSurfing(),
            mapId: refs.renderContextRef.current?.anchor.entry.id ?? 'unknown',
          },
          tile: null,
          objectsAtPlayerTile: objectsAtPlayer,
          objectsAtFacingTile: objectsAtFacing,
          adjacentObjects,
          allVisibleNPCs: objectManager.getVisibleNPCs(),
          allVisibleItems: objectManager.getVisibleItemBalls(),
          totalNPCCount: objectManager.getAllNPCs().length,
          totalItemCount: objectManager.getAllItemBalls().length,
        });
      }

      refs.hasRenderedRef.current = true;
    };

    const coordinator = new UpdateCoordinator(gameState, {
      update: ({ deltaMs, timestamp }) => runUpdate(deltaMs, timestamp),
    });
    refs.updateCoordinatorRef.current = coordinator;

    const handleFrame: FrameHandler = (_state, combinedResult) => {
      const frame = refs.lastFrameResultRef.current;
      if (!frame) return;

      // CRITICAL: Use combinedResult.needsRender from GameLoop, not frame.shouldRender
      const frameWithCombinedFlags: EngineFrameResult = {
        ...frame,
        shouldRender: combinedResult.needsRender ?? false,
        viewChanged: combinedResult.viewChanged ?? false,
        animationFrameChanged: combinedResult.animationFrameChanged ?? false,
      };
      renderFrame(frameWithCombinedFlags);
    };

    const loop = new GameLoop(gameState, coordinator, animationTimer);
    refs.gameLoopRef.current = loop;
    loop.start(handleFrame);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    callbacks.setError(message);
    callbacks.setLoading(false);
  }
}
