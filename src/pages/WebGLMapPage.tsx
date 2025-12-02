/**
 * WebGL Map Viewer
 *
 * Replacement for the old gameplay-heavy MapRenderer route.
 * This page mirrors the WebGL test harness but renders any map
 * from the map index using only the WebGL tile renderer (no NPCs,
 * scripts, camera, or gameplay systems).
 *
 * Access via /#/webgl-map
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { isWebGL2Supported } from '../rendering/webgl/WebGLContext';
import { WebGLRenderPipeline } from '../rendering/webgl/WebGLRenderPipeline';
import { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import { uploadTilesetsFromSnapshot } from '../rendering/webgl/TilesetUploader';
import {
  createSpriteFromFrameInfo,
  createFieldEffectSprite,
  createPlayerReflectionSprite,
  createPlayerShadowSprite,
  createNPCSpriteInstance,
  createNPCReflectionSprite,
  createNPCGrassEffectSprite,
  calculateSortKey,
  getPlayerAtlasName,
  getFieldEffectAtlasName,
  getNPCAtlasName,
  buildWaterMaskFromView,
} from '../rendering/spriteUtils';
import type { SpriteInstance } from '../rendering/types';
import type { TileResolverFn, WorldCameraView, RenderContext } from '../rendering/types';
import { PlayerController, type TileResolver as PlayerTileResolver } from '../game/PlayerController';
import { CameraController, createWebGLCameraController } from '../game/CameraController';
import { TileResolverFactory } from '../game/TileResolverFactory';
import {
  executeWarp,
  type WarpExecutorDeps,
  type WarpDestination,
} from '../game/WarpExecutor';
import {
  getReflectionMetaFromSnapshot,
  createRenderContextFromSnapshot,
  createStitchedWorldFromSnapshot,
  buildTilesetRuntimesForSnapshot,
  type StitchedWorldData,
} from '../game/snapshotUtils';
import {
  createWorldManagerEventHandler,
  createGpuUploadCallback,
  updateWorldBounds,
} from '../game/worldManagerEvents';
import { ObjectEventManager } from '../game/ObjectEventManager';
import { npcSpriteCache } from '../game/npc/NPCSpriteLoader';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { WorldManager, type WorldSnapshot } from '../game/WorldManager';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import type { NPCObject, ItemBallObject } from '../types/objectEvents';
import { METATILE_SIZE } from '../utils/mapLoader';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import {
  computeReflectionState,
  getGlobalShimmer,
  type ReflectionMetaProvider,
} from '../field/ReflectionRenderer';
import { detectWarpTrigger, resolveTileAt, findWarpEventAt, type WarpTrigger } from '../components/map/utils';
import type { ReflectionState } from '../components/map/types';
import { WarpHandler } from '../field/WarpHandler';
import { FadeController } from '../field/FadeController';
import { FADE_TIMING, type CardinalDirection } from '../field/types';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import {
  DebugPanel,
  DEFAULT_DEBUG_OPTIONS,
  getReflectionTileGridDebug,
  type DebugOptions,
  type DebugState,
  type WebGLDebugState,
  type PlayerDebugInfo,
  type ReflectionTileGridDebugInfo,
} from '../components/debug';
import { isNonAnimatedDoorBehavior, isLongGrassBehavior } from '../utils/metatileBehaviors';
import { getNPCRenderLayer } from '../utils/elevationPriority';
import { getMetatileIdFromMapTile } from '../utils/mapLoader';
import {
  handleDoorEntryAction,
  handleDoorExitAction,
  createAnimationDoneChecker,
  startDoorWarpSequence,
  type DoorActionDeps,
  type DoorWarpContext,
} from '../game/DoorActionDispatcher';
import './WebGLMapPage.css';

const GBA_FRAME_MS = 1000 / 59.7275; // Match real GBA vblank timing (~59.73 Hz)

type RenderStats = {
  webgl2Supported: boolean;
  tileCount: number;
  renderTimeMs: number;
  fps: number;
  error: string | null;
};

// CameraState type replaced by CameraController from '../game/CameraController'
// StitchedWorldData now imported from '../game/snapshotUtils'

const mapIndexData = mapIndexJson as MapIndexEntry[];

// Viewport configuration
const VIEWPORT_TILES_WIDE = 20;
const VIEWPORT_TILES_HIGH = 20;

export function WebGLMapPage() {
  // Canvas refs - we use two canvases: hidden WebGL and visible 2D
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pipeline and state refs
  const pipelineRef = useRef<WebGLRenderPipeline | null>(null);
  const spriteRendererRef = useRef<WebGLSpriteRenderer | null>(null);
  const stitchedWorldRef = useRef<StitchedWorldData | null>(null);
  const worldManagerRef = useRef<WorldManager | null>(null);
  const worldSnapshotRef = useRef<WorldSnapshot | null>(null);
  const worldBoundsRef = useRef<{ width: number; height: number; minX: number; minY: number }>({ width: 0, height: 0, minX: 0, minY: 0 });
  const rafRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const gbaFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const gbaAccumRef = useRef<number>(0);

  // Player controller ref
  const playerRef = useRef<PlayerController | null>(null);

  // Warp system refs
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  const fadeControllerRef = useRef<FadeController>(new FadeController());
  const pendingWarpRef = useRef<WarpTrigger | null>(null);
  const warpingRef = useRef<boolean>(false);
  const playerLoadedRef = useRef<boolean>(false);
  const playerHiddenRef = useRef<boolean>(false);

  // Door animation and arrow overlay hooks (reuse Canvas2D code)
  const doorAnimations = useDoorAnimations();
  const arrowOverlay = useArrowOverlay();
  const doorSequencer = useDoorSequencer({ warpHandler: warpHandlerRef.current });

  // Field sprites (grass, sand, etc.)
  const fieldSprites = useFieldSprites();
  const fieldSpritesLoadedRef = useRef<boolean>(false);

  // Tileset runtimes for reflection detection (built from TilesetPairInfo)
  const tilesetRuntimesRef = useRef<Map<string, TilesetRuntimeType>>(new Map());

  // Object event manager for NPCs and items
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());
  const npcSpritesLoadedRef = useRef<Set<string>>(new Set());

  // Track visible NPCs/items for debug panel (updated during render loop)
  const visibleNPCsRef = useRef<NPCObject[]>([]);
  const visibleItemsRef = useRef<ItemBallObject[]>([]);

  const renderableMaps = useMemo(
    () =>
      mapIndexData
        .filter((map) => map.layoutPath && map.primaryTilesetPath && map.secondaryTilesetPath)
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const defaultMap = renderableMaps.find((m) => m.name === 'LittlerootTown') || renderableMaps[0];
  const [selectedMapId, setSelectedMapId] = useState<string>(defaultMap?.id ?? '');
  const [stitchedMapCount, setStitchedMapCount] = useState<number>(1);
  const [worldSize, setWorldSize] = useState<{ width: number; height: number }>({
    width: (defaultMap?.width ?? 0) * METATILE_SIZE,
    height: (defaultMap?.height ?? 0) * METATILE_SIZE,
  });
  const selectedMap = useMemo(
    () => renderableMaps.find((m) => m.id === selectedMapId) || defaultMap || renderableMaps[0],
    [selectedMapId, renderableMaps, defaultMap]
  );

  const [stats, setStats] = useState<RenderStats>({
    webgl2Supported: false,
    tileCount: 0,
    renderTimeMs: 0,
    fps: 0,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [cameraDisplay, setCameraDisplay] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2); // Default to 2x zoom for better visibility
  const [mapDebugInfo, setMapDebugInfo] = useState<{
    currentMap: string | null;
    anchorMap: string;
    loadedMaps: Array<{ id: string; offsetX: number; offsetY: number; width: number; height: number; pairId: string; inGpu: boolean; borderTileCount: number }>;
    expectedConnections: Array<{ from: string; direction: string; to: string; loaded: boolean }>;
    tilesetPairs: number;
    playerPos: { x: number; y: number };
    gpuSlot0: string | null;
    gpuSlot1: string | null;
    boundaries: Array<{ x: number; y: number; length: number; orientation: string; pairA: string; pairB: string }>;
    nearbyBoundaryCount: number;
  } | null>(null);

  // Debug state for warp/tileset tracking
  const [warpDebugInfo, setWarpDebugInfo] = useState<{
    lastWarpTo: string;
    currentAnchor: string;
    snapshotMaps: string[];
    snapshotPairs: string[];
    gpuSlots: Record<string, number>;
    resolverVersion: number;
    worldBounds: { minX: number; minY: number; width: number; height: number };
  } | null>(null);

  // Debug panel state
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [playerDebugInfo, setPlayerDebugInfo] = useState<PlayerDebugInfo | null>(null);
  const [reflectionTileGridDebug, setReflectionTileGridDebug] = useState<ReflectionTileGridDebugInfo | null>(null);

  // Ref for debug options so render loop can access current value
  const debugOptionsRef = useRef<DebugOptions>(debugOptions);
  debugOptionsRef.current = debugOptions;

  // Create WebGL debug state from existing debug info
  const webglDebugState = useMemo<WebGLDebugState>(() => ({
    mapStitching: mapDebugInfo,
    warp: warpDebugInfo,
    renderStats: {
      tileCount: stats.tileCount,
      fps: stats.fps,
      renderTimeMs: stats.renderTimeMs,
      webgl2Supported: stats.webgl2Supported,
      viewportTilesWide: VIEWPORT_TILES_WIDE,
      viewportTilesHigh: VIEWPORT_TILES_HIGH,
      cameraX: Math.round(cameraDisplay.x),
      cameraY: Math.round(cameraDisplay.y),
      worldWidthPx: worldSize.width,
      worldHeightPx: worldSize.height,
    },
    shimmer: getGlobalShimmer().getDebugInfo(),
    reflectionTileGrid: reflectionTileGridDebug,
  }), [mapDebugInfo, warpDebugInfo, stats, cameraDisplay, worldSize, reflectionTileGridDebug]);

  // Debug state for the panel - reads from refs updated during render loop
  const debugState = useMemo<DebugState>(() => {
    const npcs = visibleNPCsRef.current;
    const items = visibleItemsRef.current;

    // Helper to get objects at a specific tile
    const getObjectsAtTile = (tileX: number, tileY: number) => {
      const tileNPCs = npcs.filter(npc => npc.tileX === tileX && npc.tileY === tileY);
      const tileItems = items.filter(item => item.tileX === tileX && item.tileY === tileY);
      return {
        tileX,
        tileY,
        npcs: tileNPCs,
        items: tileItems,
        hasCollision: tileNPCs.length > 0 || tileItems.length > 0,
      };
    };

    // Get facing tile offset based on direction
    const getFacingOffset = (dir: string): { dx: number; dy: number } => {
      switch (dir) {
        case 'up': return { dx: 0, dy: -1 };
        case 'down': return { dx: 0, dy: 1 };
        case 'left': return { dx: -1, dy: 0 };
        case 'right': return { dx: 1, dy: 0 };
        default: return { dx: 0, dy: 1 };
      }
    };

    const playerTileX = playerDebugInfo?.tileX ?? 0;
    const playerTileY = playerDebugInfo?.tileY ?? 0;
    const playerDir = playerDebugInfo?.direction ?? 'down';
    const facing = getFacingOffset(playerDir);

    return {
      player: playerDebugInfo,
      tile: null,
      objectsAtPlayerTile: getObjectsAtTile(playerTileX, playerTileY),
      objectsAtFacingTile: getObjectsAtTile(playerTileX + facing.dx, playerTileY + facing.dy),
      adjacentObjects: {
        north: getObjectsAtTile(playerTileX, playerTileY - 1),
        south: getObjectsAtTile(playerTileX, playerTileY + 1),
        east: getObjectsAtTile(playerTileX + 1, playerTileY),
        west: getObjectsAtTile(playerTileX - 1, playerTileY),
      },
      allVisibleNPCs: npcs,
      allVisibleItems: items,
      totalNPCCount: objectEventManagerRef.current.getAllNPCs().length,
      totalItemCount: objectEventManagerRef.current.getAllItemBalls().length,
    };
  }, [playerDebugInfo]);

  // Track resolver creation for debugging
  const resolverIdRef = useRef(0);

  // Create tile resolver from WorldSnapshot using TileResolverFactory
  const createSnapshotTileResolver = useCallback((snapshot: WorldSnapshot): TileResolverFn => {
    const resolverId = ++resolverIdRef.current;
    console.log(`[RESOLVER] #${resolverId} anchor:${snapshot.anchorMapId} maps:${snapshot.maps.length} pairs:${snapshot.tilesetPairs.length}`,
      snapshot.maps.map(m => m.entry.id));
    return TileResolverFactory.fromSnapshot(snapshot, resolverId);
  }, []);

  // Create player tile resolver from WorldSnapshot using TileResolverFactory
  const createSnapshotPlayerTileResolver = useCallback((snapshot: WorldSnapshot): PlayerTileResolver => {
    return TileResolverFactory.createPlayerResolver(snapshot);
  }, []);

  // Build TilesetRuntime from TilesetPairInfo for reflection detection
  const buildTilesetRuntimesFromSnapshot = useCallback((snapshot: WorldSnapshot): void => {
    buildTilesetRuntimesForSnapshot(snapshot, tilesetRuntimesRef.current);
  }, []);

  // Load object events from snapshot (object events are now included in LoadedMapInstance)
  const loadObjectEventsFromSnapshot = useCallback(async (snapshot: WorldSnapshot): Promise<void> => {
    const objectManager = objectEventManagerRef.current;
    const spriteRenderer = spriteRendererRef.current;

    // Clear previous objects
    objectManager.clear();

    // Parse object events for each map in the snapshot
    // Object events are now loaded by WorldManager and included in LoadedMapInstance
    for (const mapInst of snapshot.maps) {
      if (mapInst.objectEvents.length > 0) {
        objectManager.parseMapObjects(
          mapInst.entry.id,
          mapInst.objectEvents,
          mapInst.offsetX,
          mapInst.offsetY
        );
      }
    }

    // Get unique graphics IDs needed for NPCs
    const graphicsIds = objectManager.getUniqueNPCGraphicsIds();
    if (graphicsIds.length === 0) return;

    // Load sprites that haven't been loaded yet
    const newIds = graphicsIds.filter(id => !npcSpritesLoadedRef.current.has(id));
    if (newIds.length > 0) {
      await npcSpriteCache.loadMany(newIds);

      // Upload loaded sprites to WebGL renderer
      if (spriteRenderer) {
        for (const graphicsId of newIds) {
          const sprite = npcSpriteCache.get(graphicsId);
          if (sprite) {
            const atlasName = getNPCAtlasName(graphicsId);
            const dims = npcSpriteCache.getDimensions(graphicsId);
            spriteRenderer.uploadSpriteSheet(atlasName, sprite, {
              frameWidth: dims.frameWidth,
              frameHeight: dims.frameHeight,
            });
            npcSpritesLoadedRef.current.add(graphicsId);
            console.log(`[WebGL] Uploaded NPC sprite: ${atlasName} (${sprite.width}x${sprite.height})`);
          }
        }
      }
    }
  }, []);

  // Initialize world state from a snapshot (shared between initial load and warps)
  const initializeWorldFromSnapshot = useCallback(async (
    snapshot: WorldSnapshot,
    pipeline: WebGLRenderPipeline
  ): Promise<void> => {
    // Update snapshot ref
    worldSnapshotRef.current = snapshot;

    // Build tileset runtimes for reflection detection
    buildTilesetRuntimesFromSnapshot(snapshot);

    // Update stitched world for backward compatibility
    stitchedWorldRef.current = createStitchedWorldFromSnapshot(snapshot);

    // Set up tile resolver
    const resolver = createSnapshotTileResolver(snapshot);
    pipeline.setTileResolver(resolver);

    // Upload tilesets to GPU
    uploadTilesetsFromSnapshot(pipeline, snapshot);

    // Update world bounds
    updateWorldBounds(snapshot, worldBoundsRef, setWorldSize, setStitchedMapCount);

    // Load object events (NPCs, items) and upload sprites to WebGL
    await loadObjectEventsFromSnapshot(snapshot);
  }, [buildTilesetRuntimesFromSnapshot, createSnapshotTileResolver, uploadTilesetsFromSnapshot, loadObjectEventsFromSnapshot]);

  // Compute reflection state for an object at a tile position using shared function
  const computeReflectionStateFromSnapshot = useCallback((
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number,
    prevTileX: number,
    prevTileY: number,
    spriteWidth: number = 16,
    spriteHeight: number = 32
  ): ReflectionState => {
    // Create a provider callback that wraps getReflectionMetaFromSnapshot for this snapshot
    const provider: ReflectionMetaProvider = (x, y) =>
      getReflectionMetaFromSnapshot(snapshot, tilesetRuntimesRef.current, x, y);
    return computeReflectionState(provider, tileX, tileY, prevTileX, prevTileY, spriteWidth, spriteHeight);
  }, []);

  // Wrapper to create RenderContext from snapshot (used for field effects, warp detection)
  const getRenderContextFromSnapshot = useCallback((snapshot: WorldSnapshot): RenderContext | null => {
    return createRenderContextFromSnapshot(snapshot, tilesetRuntimesRef.current);
  }, []);

  // Execute a warp to destination map
  const performWarp = useCallback(async (
    trigger: WarpTrigger,
    options?: { force?: boolean; fromDoor?: boolean }
  ) => {
    const worldManager = worldManagerRef.current;
    const player = playerRef.current;
    const pipeline = pipelineRef.current;
    if (!worldManager || !player || !pipeline) return;

    const destMapId = trigger.warpEvent.destMap;
    // Capture prior facing for ladder/surf transitions (GBA preserves facing)
    const priorFacing = player.getFacingDirection();

    console.log('[WARP] ========== WARP START ==========');
    console.log('[WARP] Source map:', trigger.sourceMap.entry.id);
    console.log('[WARP] Destination map:', destMapId);
    console.log('[WARP] fromDoor:', options?.fromDoor);
    console.log('[WARP] priorFacing:', priorFacing);

    try {
      // ===== WebGL-SPECIFIC: Initialize world at destination =====
      const snapshot = await worldManager.initialize(destMapId);

      // Initialize world state (shared helper)
      await initializeWorldFromSnapshot(snapshot, pipeline);

      // Set up player resolver
      const playerResolver = createSnapshotPlayerTileResolver(snapshot);
      player.setTileResolver(playerResolver);

      // Set up object collision checker (uses shared hasObjectCollisionAt)
      player.setObjectCollisionChecker((tileX, tileY) => {
        const objectManager = objectEventManagerRef.current;
        const playerElev = player.getCurrentElevation();
        return objectManager.hasObjectCollisionAt(tileX, tileY, playerElev);
      });

      // ===== SHARED: Execute warp using WarpExecutor =====
      const destMap = snapshot.maps.find(m => m.entry.id === destMapId);
      if (!destMap) {
        console.error('[WARP] Destination map not found in snapshot:', destMapId);
        return;
      }

      // Create render context for tile resolution
      const renderContext = getRenderContextFromSnapshot(snapshot);

      // Build WarpExecutor dependencies
      const warpDeps: WarpExecutorDeps = {
        player,
        doorSequencer,
        fadeController: fadeControllerRef.current,
        warpHandler: warpHandlerRef.current,
        playerHiddenRef,
        getCurrentTime: () => performance.now(),
        onClearDoorAnimations: () => doorAnimations.clearAll(),
      };

      // Build destination info
      const destination: WarpDestination = {
        map: destMap,
        resolveTileAt: (x, y) => {
          if (!renderContext) return null;
          const resolved = resolveTileAt(renderContext, x, y);
          return resolved ? {
            attributes: resolved.attributes,
            mapTile: resolved.mapTile,
          } : null;
        },
      };

      // Execute shared warp logic (spawn position, facing, door sequence)
      // priorFacing is used for ladders (preserve facing) per GBA behavior
      executeWarp(warpDeps, trigger, destination, {
        ...options,
        priorFacing,
      });

      // ===== WebGL-SPECIFIC: Post-warp updates =====
      pipeline.invalidate();

      console.log('[WARP] Warp complete');
      console.log('[WARP] World bounds:', snapshot.worldBounds);
      console.log('[WARP] Loaded maps:', snapshot.maps.map(m => m.entry.id));
      console.log('[WARP] Tileset pairs:', snapshot.tilesetPairs.map(p => p.id));
      console.log('[WARP] GPU slots:', Object.fromEntries(snapshot.pairIdToGpuSlot));

      // Update debug info for UI
      setWarpDebugInfo({
        lastWarpTo: destMapId,
        currentAnchor: snapshot.anchorMapId,
        snapshotMaps: snapshot.maps.map(m => m.entry.id),
        snapshotPairs: snapshot.tilesetPairs.map(p => p.id),
        gpuSlots: Object.fromEntries(snapshot.pairIdToGpuSlot),
        resolverVersion: resolverIdRef.current,
        worldBounds: snapshot.worldBounds,
      });

      // Reset warpingRef for door warps (non-door warps reset in .then() callback)
      if (options?.fromDoor) {
        warpingRef.current = false;
      }
    } catch (err) {
      console.error('[WARP] Failed to perform warp:', err);
      warpHandlerRef.current.setInProgress(false);
      warpingRef.current = false;
    }
  }, [initializeWorldFromSnapshot, createSnapshotPlayerTileResolver, createRenderContextFromSnapshot, doorSequencer, doorAnimations]);

  // Initialize WebGL pipeline and player once
  useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    // Create hidden WebGL canvas
    const webglCanvas = document.createElement('canvas');
    webglCanvasRef.current = webglCanvas;

    if (!isWebGL2Supported(webglCanvas)) {
      // WebGL2 not supported - redirect to Canvas2D mode
      console.warn('WebGL2 not supported, redirecting to Canvas2D mode');
      window.location.hash = '';
      return;
    }

    try {
      const pipeline = new WebGLRenderPipeline(webglCanvas);
      pipelineRef.current = pipeline;
      setStats((s) => ({ ...s, webgl2Supported: true, error: null }));

      // Initialize sprite renderer (shares GL context with pipeline)
      const spriteRenderer = new WebGLSpriteRenderer(pipeline.getGL());
      spriteRenderer.initialize();
      spriteRendererRef.current = spriteRenderer;
    } catch (e) {
      // WebGL pipeline creation failed - redirect to Canvas2D mode
      console.error('Failed to create WebGL pipeline, redirecting to Canvas2D mode:', e);
      window.location.hash = '';
      return;
    }

    // Initialize player controller
    const player = new PlayerController();
    playerRef.current = player;

    // Load player sprites
    const loadPlayerSprites = async () => {
      try {
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');

        // Set up door warp handler for animated door and arrow warp entry
        // Uses shared DoorActionDispatcher for the sequence logic
        player.setDoorWarpHandler(async (request) => {
          console.log('[DOOR_HANDLER] Called with request:', request);

          const snapshot = worldSnapshotRef.current;
          if (!snapshot) {
            console.log('[DOOR_HANDLER] Rejected: no snapshot');
            return;
          }

          const renderContext = getRenderContextFromSnapshot(snapshot);
          if (!renderContext) {
            console.log('[DOOR_HANDLER] Rejected: no renderContext');
            return;
          }

          const resolved = resolveTileAt(renderContext, request.targetX, request.targetY);
          if (!resolved) {
            console.log('[DOOR_HANDLER] Rejected: no resolved tile at', request.targetX, request.targetY);
            return;
          }

          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) {
            console.log('[DOOR_HANDLER] Rejected: no warpEvent at', request.targetX, request.targetY, 'in map', resolved.map.entry.id);
            return;
          }

          console.log('[DOOR_HANDLER] Found warp:', warpEvent);

          const behavior = resolved.attributes?.behavior ?? -1;
          const metatileId = getMetatileIdFromMapTile(resolved.mapTile);

          // Debug: Check the tileset attributes arrays
          const tileset = resolved.tileset;
          console.log('[DOOR_HANDLER] Tileset attributes debug:', {
            primaryAttributesLength: tileset?.primaryAttributes?.length ?? 0,
            secondaryAttributesLength: tileset?.secondaryAttributes?.length ?? 0,
            metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
            isSecondary: resolved.isSecondary,
            attrAtIndex: resolved.isSecondary
              ? tileset?.secondaryAttributes?.[metatileId - 512]
              : tileset?.primaryAttributes?.[metatileId],
          });

          console.log('[DOOR_HANDLER] Tile info:', {
            metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
            behavior,
            hasAttributes: !!resolved.attributes,
            attributes: resolved.attributes,
          });

          // Build context for shared door warp handler
          const ctx: DoorWarpContext = {
            targetX: request.targetX,
            targetY: request.targetY,
            behavior,
            metatileId,
            warpEvent,
            sourceMap: resolved.map,
          };

          // Use shared door warp sequence starter
          const started = await startDoorWarpSequence(ctx, {
            player,
            doorSequencer,
            doorAnimations,
            arrowOverlay,
            warpHandler: warpHandlerRef.current,
          });

          if (started) {
            console.log('[DOOR_HANDLER] Door sequence started');
          }
        });

        // Upload player sprite sheets to WebGL renderer
        const spriteRenderer = spriteRendererRef.current;
        if (spriteRenderer) {
          const spriteSheets = player.getSpriteSheets();
          for (const [key, canvas] of spriteSheets) {
            const atlasName = getPlayerAtlasName(key);
            spriteRenderer.uploadSpriteSheet(atlasName, canvas, {
              frameWidth: key === 'shadow' ? 16 : 16,
              frameHeight: key === 'shadow' ? 8 : 32,
            });
            console.log(`[WebGL] Uploaded sprite sheet: ${atlasName} (${canvas.width}x${canvas.height})`);
          }
        }

        playerLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load player sprites:', err);
      }
    };
    loadPlayerSprites();

    // Load field sprites (grass, sand, etc.)
    const loadFieldSprites = async () => {
      try {
        await fieldSprites.loadAll();

        // Upload field sprites to WebGL renderer
        const spriteRenderer = spriteRendererRef.current;
        if (spriteRenderer) {
          const fieldSpriteKeys = ['grass', 'longGrass', 'sand', 'splash', 'ripple'] as const;
          for (const key of fieldSpriteKeys) {
            const canvas = fieldSprites.sprites[key];
            if (canvas) {
              const atlasName = getFieldEffectAtlasName(key);
              spriteRenderer.uploadSpriteSheet(atlasName, canvas);
              console.log(`[WebGL] Uploaded field sprite: ${atlasName} (${canvas.width}x${canvas.height})`);
            }
          }
        }

        fieldSpritesLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load field sprites:', err);
      }
    };
    loadFieldSprites();

    let frameCount = 0;
    let fpsTime = performance.now();

    const renderLoop = () => {
      const pipeline = pipelineRef.current;
      const stitchedWorld = stitchedWorldRef.current;
      const displayCanvas = displayCanvasRef.current;
      // Need stitched world to render
      if (!pipeline || !stitchedWorld || !displayCanvas) {
        rafRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx2d = displayCanvas.getContext('2d');
      if (!ctx2d) {
        rafRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Advance GBA-frame counter
      const nowTime = performance.now();
      const dt = nowTime - lastTimeRef.current;
      lastTimeRef.current = nowTime;
      gbaAccumRef.current += dt;
      while (gbaAccumRef.current >= GBA_FRAME_MS) {
        gbaAccumRef.current -= GBA_FRAME_MS;
        gbaFrameRef.current++;
      }

      // Update shimmer animation (GBA-accurate reflection distortion)
      getGlobalShimmer().update(nowTime);

      const { width, height, minX, minY } = worldBoundsRef.current;

      // Convert tile offsets to pixel offsets for camera
      const worldMinX = minX * METATILE_SIZE;
      const worldMinY = minY * METATILE_SIZE;
      const player = playerRef.current;

      // Update warp handler cooldown
      warpHandlerRef.current.update(dt);

      // Update player if loaded (handles its own input via keyboard events)
      if (player && playerLoadedRef.current && !warpingRef.current) {
        player.update(dt);

        // Update world manager with player position and direction (triggers dynamic map loading)
        const worldManager = worldManagerRef.current;
        if (worldManager) {
          // Get player's current facing direction for predictive tileset loading
          const playerDirection = player.getFacingDirection();
          worldManager.update(player.tileX, player.tileY, playerDirection);

          // Update debug info every ~500ms
          if (gbaFrameRef.current % 30 === 0) {
            const debugInfo = worldManager.getDebugInfo(player.tileX, player.tileY);
            setMapDebugInfo(debugInfo);

            // Update player debug info for the debug panel
            setPlayerDebugInfo({
              tileX: player.tileX,
              tileY: player.tileY,
              pixelX: player.x,
              pixelY: player.y,
              direction: player.getFacingDirection(),
              elevation: player.getElevation(),
              isMoving: player.isMoving,
              isSurfing: player.isSurfing(),
              mapId: debugInfo?.currentMap ?? selectedMap.id,
            });
          }

          // Update arrow overlay based on current tile behavior
          const snapshot = worldSnapshotRef.current;
          if (snapshot && !warpHandlerRef.current.isInProgress()) {
            const renderContext = getRenderContextFromSnapshot(snapshot);
            if (renderContext) {
              const resolved = resolveTileAt(renderContext, player.tileX, player.tileY);
              const behavior = resolved?.attributes?.behavior ?? 0;
              arrowOverlay.update(
                player.dir as CardinalDirection,
                player.tileX,
                player.tileY,
                behavior,
                nowTime,
                doorSequencer.isActive()
              );
            }
          }

          // Check for warps when player tile changes (matches Canvas2D useRunUpdate logic)
          if (snapshot && !warpHandlerRef.current.isInProgress() && !doorSequencer.isActive()) {
            const renderContext = getRenderContextFromSnapshot(snapshot);
            if (renderContext) {
              const resolvedForWarp = resolveTileAt(renderContext, player.tileX, player.tileY);

              if (resolvedForWarp) {
                const currentMapId = resolvedForWarp.map.entry.id;

                // Check if tile changed
                const lastChecked = warpHandlerRef.current.getState().lastCheckedTile;
                const tileChanged = !lastChecked ||
                  lastChecked.mapId !== currentMapId ||
                  lastChecked.x !== player.tileX ||
                  lastChecked.y !== player.tileY;

                if (tileChanged) {
                  warpHandlerRef.current.updateLastCheckedTile(player.tileX, player.tileY, currentMapId);

                  if (!warpHandlerRef.current.isOnCooldown()) {
                    const trigger = detectWarpTrigger(renderContext, player);
                    if (trigger) {
                      // Arrow warps are handled through PlayerController's doorWarpHandler
                      if (trigger.kind === 'arrow') {
                        // Just update arrow overlay, don't auto-warp
                      } else if (isNonAnimatedDoorBehavior(trigger.behavior)) {
                        // Non-animated doors (stairs, ladders): auto-warp with fade
                        console.log('[WARP] Non-animated door warp:', trigger.kind, 'to', trigger.warpEvent.destMap);
                        arrowOverlay.hide();
                        doorSequencer.startAutoWarp({
                          targetX: player.tileX,
                          targetY: player.tileY,
                          metatileId: getMetatileIdFromMapTile(resolvedForWarp.mapTile),
                          isAnimatedDoor: false,
                          entryDirection: player.dir as CardinalDirection,
                          warpTrigger: trigger,
                        }, nowTime, true);
                        player.lockInput();
                      } else {
                        // Other walk-over warps: simple warp
                        console.log('[WARP] Walk-over warp:', trigger.kind, 'to', trigger.warpEvent.destMap);
                        warpHandlerRef.current.startWarp(player.tileX, player.tileY, currentMapId);
                        pendingWarpRef.current = trigger;
                        warpingRef.current = true;
                        player.lockInput();
                        fadeControllerRef.current.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Advance door entry sequence (uses shared DoorActionDispatcher)
      if (doorSequencer.isEntryActive()) {
        const player = playerRef.current;
        if (player) {
          const entryState = doorSequencer.sequencer.getEntryState();
          const isAnimationDone = createAnimationDoneChecker(doorAnimations, nowTime);
          const isFadeDone = !fadeControllerRef.current.isActive() || fadeControllerRef.current.isComplete(nowTime);

          const result = doorSequencer.updateEntry(nowTime, player.isMoving, isAnimationDone, isFadeDone);

          // Use shared action dispatcher
          const actionDeps: DoorActionDeps = {
            player,
            doorSequencer,
            doorAnimations,
            fadeController: fadeControllerRef.current,
            playerHiddenRef,
            onExecuteWarp: (trigger) => {
              // CRITICAL: Set warpingRef to prevent worldManager.update() during warp
              warpingRef.current = true;
              void performWarp(trigger, { force: true, fromDoor: true });
            },
          };

          handleDoorEntryAction(result, entryState, actionDeps, nowTime);
        }
      }

      // Advance door exit sequence (uses shared DoorActionDispatcher)
      if (doorSequencer.isExitActive()) {
        const player = playerRef.current;
        if (player) {
          const exitState = doorSequencer.sequencer.getExitState();
          const isAnimationDone = createAnimationDoneChecker(doorAnimations, nowTime);
          const isFadeInDone = !fadeControllerRef.current.isActive() || fadeControllerRef.current.isComplete(nowTime);

          const result = doorSequencer.updateExit(nowTime, player.isMoving, isAnimationDone, isFadeInDone);

          // Use shared action dispatcher
          const actionDeps: DoorActionDeps = {
            player,
            doorSequencer,
            doorAnimations,
            fadeController: fadeControllerRef.current,
            playerHiddenRef,
            onExecuteWarp: () => {}, // Not used in exit sequence
          };

          handleDoorExitAction(result, exitState, actionDeps, nowTime);
        }
      }

      // Handle pending warp when fade out completes
      if (warpingRef.current && pendingWarpRef.current) {
        const fade = fadeControllerRef.current;
        if (fade.getDirection() === 'out' && fade.isComplete(nowTime)) {
          // Fade out complete, execute warp
          const trigger = pendingWarpRef.current;
          pendingWarpRef.current = null;
          void performWarp(trigger).then(() => {
            warpingRef.current = false;
            // Unlock player input after fade in starts
            const player = playerRef.current;
            if (player) {
              // Delay unlock until fade in completes
              setTimeout(() => {
                player.unlockInput();
              }, FADE_TIMING.DEFAULT_DURATION_MS);
            }
          });
        }
      }

      // Camera follows player (using CameraController)
      const camera = cameraRef.current;
      if (camera && player && playerLoadedRef.current) {
        // Update camera bounds (may have changed due to world updates)
        camera.setBounds({ minX: worldMinX, minY: worldMinY, width, height });
        camera.followTarget(player);
      }

      const viewportWidth = VIEWPORT_TILES_WIDE * METATILE_SIZE;
      const viewportHeight = VIEWPORT_TILES_HIGH * METATILE_SIZE;

      if (width > 0 && height > 0 && camera) {
        // Ensure display canvas is sized to viewport
        if (displayCanvas.width !== viewportWidth || displayCanvas.height !== viewportHeight) {
          displayCanvas.width = viewportWidth;
          displayCanvas.height = viewportHeight;
        }

        const start = performance.now();

        // Get camera view for rendering
        const camView = camera.getView(1);  // +1 tile for sub-tile scrolling
        const cameraX = camView.x;
        const cameraY = camView.y;

        const view: WorldCameraView = {
          // CameraView base fields
          cameraX,
          cameraY,
          startTileX: camView.startTileX,
          startTileY: camView.startTileY,
          subTileOffsetX: camView.subTileOffsetX,
          subTileOffsetY: camView.subTileOffsetY,
          tilesWide: camView.tilesWide,
          tilesHigh: camView.tilesHigh,
          pixelWidth: camView.tilesWide * METATILE_SIZE,
          pixelHeight: camView.tilesHigh * METATILE_SIZE,
          // WorldCameraView specific fields
          worldStartTileX: camView.startTileX,
          worldStartTileY: camView.startTileY,
          cameraWorldX: cameraX,
          cameraWorldY: cameraY,
        };

        // Get player elevation for layer splitting (same as useCompositeScene)
        const playerElevation = player && playerLoadedRef.current ? player.getElevation() : 0;

        // Render using pipeline (this does viewport culling!)
        // Force full render each frame to avoid dirty tracking issues during testing
        // animationChanged triggers texture updates for animated tiles
        pipeline.render(
          null as any, // RenderContext not used by WebGL pipeline
          view,
          playerElevation,
          { gameFrame: gbaFrameRef.current, needsFullRender: true, animationChanged: true }
        );

        // Composite with sprite rendering between layers (hybrid rendering test)
        // This matches the game's render order:
        //   1. Background layer (BG2 - always behind)
        //   2. TopBelow layer (BG1 tiles behind player based on elevation)
        //   3. Player and other sprites
        //   4. TopAbove layer (BG1 tiles in front of player - bridges, roofs, etc)

        // NOTE: Layer compositing happens in the sprite rendering section below
        // because we need to know if there are reflections to decide the render order.
        // See "SPLIT LAYER RENDERING FOR REFLECTIONS" below.

        // Prune expired door animations (actual rendering happens after layer compositing)
        doorAnimations.prune(nowTime);

        // Priority-based sprite batches for proper GBA layer ordering:
        // - lowPrioritySprites (P2/P3): render before TopBelow (behind all top layer tiles)
        // - allSprites (P1 + player): render between TopBelow and TopAbove
        // - priority0Sprites (P0): render after TopAbove (above all BG layers)
        let lowPrioritySprites: SpriteInstance[] = [];
        let priority0Sprites: SpriteInstance[] = [];
        let prioritySpriteView: WorldCameraView | null = null;

        // Render field effects and player with proper Y-sorting
        if (player && playerLoadedRef.current) {
          const playerWorldY = player.y + 16; // Player feet Y position
          const currentSnapshot = worldSnapshotRef.current;

          // Render player reflection (behind player, on water/ice tiles)
          if (currentSnapshot) {
            const { width: spriteWidth, height: spriteHeight } = player.getSpriteSize();
            // GBA SEMANTICS for reflection detection (ObjectEventGetNearbyReflectionType):
            // - currentCoords = DESTINATION tile (where moving TO)
            // - previousCoords = ORIGIN tile (where came FROM)
            // During movement: check tiles below destination AND origin
            // When idle: destination = origin (same tile)
            const destTile = player.getDestinationTile();
            const reflectionState = computeReflectionStateFromSnapshot(
              currentSnapshot,
              destTile.x,     // GBA currentCoords = destination
              destTile.y,
              player.tileX,   // GBA previousCoords = origin
              player.tileY,
              spriteWidth,
              spriteHeight
            );

            // Update reflection tile grid debug info (every 100ms to stay responsive)
            if (debugOptionsRef.current.enabled && gbaFrameRef.current % 6 === 0) {
              const gridDebug = getReflectionTileGridDebug(
                currentSnapshot,
                tilesetRuntimesRef.current,
                player.tileX,
                player.tileY,
                destTile.x,
                destTile.y,
                player.isMoving,
                player.dir,
                reflectionState
              );
              setReflectionTileGridDebug(gridDebug);
            }

            // reflectionState is used for WebGL sprite rendering below
          }

          // === WebGL Sprite Rendering (player + field effects + reflections batched) ===
          const spriteRenderer = spriteRendererRef.current;

          if (spriteRenderer && spriteRenderer.isValid()) {
            const allSprites: SpriteInstance[] = [];

            // Build WorldCameraView for sprite renderer
            const spriteView: WorldCameraView = {
              ...view,
              cameraWorldX: cameraX,
              cameraWorldY: cameraY,
            };
            // Store for priority-based rendering (low priority before TopBelow, P0 after TopAbove)
            prioritySpriteView = spriteView;

            // Add field effects (bottom and top layers)
            if (fieldSpritesLoadedRef.current) {
              const effects = player.getGrassEffectManager().getEffectsForRendering();
              for (const effect of effects) {
                // Try bottom layer
                const bottomSprite = createFieldEffectSprite(effect, playerWorldY, 'bottom');
                if (bottomSprite) allSprites.push(bottomSprite);
                // Try top layer
                const topSprite = createFieldEffectSprite(effect, playerWorldY, 'top');
                if (topSprite) allSprites.push(topSprite);
              }
            }

            // Add NPC sprites and reflections
            // Priority 0 NPCs (elevation 13-14) render ABOVE TopAbove layer
            const npcs = objectEventManagerRef.current.getVisibleNPCs();
            const items = objectEventManagerRef.current.getVisibleItemBalls();
            const snapshot = worldSnapshotRef.current;

            // Update refs for debug panel
            visibleNPCsRef.current = npcs;
            visibleItemsRef.current = items;
            // priority0Sprites is hoisted to outer scope for rendering after TopAbove

            for (const npc of npcs) {
              const atlasName = getNPCAtlasName(npc.graphicsId);
              if (!spriteRenderer.hasSpriteSheet(atlasName)) continue;

              // Get tile metadata for grass/reflection detection
              const tileMeta = snapshot ? getReflectionMetaFromSnapshot(
                snapshot,
                tilesetRuntimesRef.current,
                npc.tileX,
                npc.tileY
              ) : null;

              // Check if NPC is on long grass (clip sprite to half height)
              const isOnLongGrass = tileMeta ? isLongGrassBehavior(tileMeta.behavior) : false;

              // Calculate sort key for this NPC (feet Y + mid priority)
              const npcSortKey = calculateSortKey(
                npc.tileY * METATILE_SIZE + 16, // feet at bottom of tile
                128
              );

              const npcSprite = createNPCSpriteInstance(npc, npcSortKey, isOnLongGrass);
              if (npcSprite) {
                // Use shared utility to determine NPC render layer
                // This ensures consistent behavior between Canvas2D and WebGL
                const renderLayer = getNPCRenderLayer(npc.elevation, playerElevation);

                if (renderLayer === 'aboveAll') {
                  // P0: render after TopAbove (elevation 13-14)
                  priority0Sprites.push(npcSprite);
                } else if (renderLayer === 'behindBridge') {
                  // P2/P3 NPC when player is at P1 (on bridge): render before TopBelow
                  lowPrioritySprites.push(npcSprite);
                } else {
                  // 'withPlayer': render with player (Y-sorted)
                  allSprites.push(npcSprite);
                }

                // Add NPC reflection if on reflective tile (only for non-aboveAll NPCs)
                // Priority 0 NPCs don't have reflections (they're above everything)
                if (snapshot && renderLayer !== 'aboveAll') {
                  const npcReflectionState = computeReflectionStateFromSnapshot(
                    snapshot,
                    npc.tileX,
                    npc.tileY,
                    npc.tileX, // NPCs don't move yet, so prev = current
                    npc.tileY,
                    npcSprite.width,
                    npcSprite.height
                  );

                  const npcReflection = createNPCReflectionSprite(
                    npcSprite,
                    npcReflectionState,
                    npc.direction
                  );
                  if (npcReflection) {
                    // Reflections go to same batch as NPC sprite
                    if (renderLayer === 'behindBridge') {
                      lowPrioritySprites.push(npcReflection);
                    } else {
                      allSprites.push(npcReflection);
                    }
                  }

                  // Add grass effect if NPC is on tall grass (NOT long grass)
                  // Tall grass: renders ON TOP of NPC
                  // Long grass: NPC sprite is CLIPPED (handled above)
                  if (tileMeta && !isOnLongGrass) {
                    const grassSprite = createNPCGrassEffectSprite(npc, tileMeta.behavior, npcSortKey);
                    if (grassSprite) {
                      // Grass effects go to same batch as NPC sprite
                      if (renderLayer === 'behindBridge') {
                        lowPrioritySprites.push(grassSprite);
                      } else {
                        allSprites.push(grassSprite);
                      }
                    }
                  }
                }
              }
            }

            // Add player sprite and reflection (unless hidden)
            if (!playerHiddenRef.current) {
              const frameInfo = player.getFrameInfo();
              if (frameInfo) {
                const spriteKey = player.getCurrentSpriteKey();
                const atlasName = getPlayerAtlasName(spriteKey);
                if (spriteRenderer.hasSpriteSheet(atlasName)) {
                  // Render shadow if player is jumping (shadow stays on ground)
                  if (player.showShadow) {
                    const shadowAtlas = getPlayerAtlasName('shadow');
                    if (spriteRenderer.hasSpriteSheet(shadowAtlas)) {
                      const playerSortKey = calculateSortKey(player.y + 32, 128);
                      const shadowSprite = createPlayerShadowSprite(player.x, player.y, playerSortKey);
                      allSprites.push(shadowSprite);
                    }
                  }

                  // Clip player to half height when on long grass (matches GBA behavior)
                  const clipToHalf = player.isOnLongGrass();
                  const playerSprite = createSpriteFromFrameInfo(
                    frameInfo,
                    atlasName,
                    calculateSortKey(player.y + 32, 128), // feet Y + mid priority
                    clipToHalf
                  );
                  allSprites.push(playerSprite);

                  // Add reflection sprite if player has reflection (WebGL batched)
                  // Reflection state was computed above for debug display
                  const snapshot = worldSnapshotRef.current;
                  if (snapshot) {
                    const { width: spriteWidth, height: spriteHeight } = player.getSpriteSize();
                    const destTile = player.getDestinationTile();
                    const reflectionState = computeReflectionStateFromSnapshot(
                      snapshot,
                      destTile.x,
                      destTile.y,
                      player.tileX,
                      player.tileY,
                      spriteWidth,
                      spriteHeight
                    );

                    const reflectionSprite = createPlayerReflectionSprite(
                      playerSprite,
                      reflectionState,
                      player.dir
                    );
                    if (reflectionSprite) {
                      allSprites.push(reflectionSprite);
                    }
                  }
                }
              }
            }

            // Sort all sprites by sortKey for proper Y-ordering
            allSprites.sort((a, b) => a.sortKey - b.sortKey);

            // Split sprites into reflection-layer sprites and normal sprites
            // Reflection layer includes:
            // - Reflections (isReflection=true): player/NPC reflections with shimmer
            // - Water effects (isReflectionLayer=true): puddle splashes, ripples (no shimmer)
            // Both render between layer 0 and layer 1 with water mask clipping.
            const reflectionLayerSprites = allSprites.filter((s) => s.isReflection || s.isReflectionLayer);
            const normalSprites = allSprites.filter((s) => !s.isReflection && !s.isReflectionLayer);

            // Also filter low priority sprites (P2/P3 NPCs need same treatment)
            const lowPriorityReflections = lowPrioritySprites.filter((s) => s.isReflection || s.isReflectionLayer);
            const normalLowPrioritySprites = lowPrioritySprites.filter((s) => !s.isReflection && !s.isReflectionLayer);

            const gl = pipeline.getGL();
            const webglCanvas = webglCanvasRef.current;

            // === SPLIT LAYER RENDERING FOR REFLECTION-LAYER SPRITES ===
            // GBA renders reflections and water effects at OAM priority 3 (behind BG1).
            // BG1's opaque pixels naturally occlude them.
            //
            // For tiles like 177 (water with shore edge):
            // - Layer 0 = water (BG2)
            // - Layer 1 = shore edge (BG1) - should cover reflections and water effects
            //
            // Render order:
            // 1. Layer 0 only (water base)
            // 2. Reflection-layer sprites (reflections + water effects, with water mask)
            // 3. Layer 1 of ALL tiles (shore edges cover reflection-layer sprites)
            // 4. Normal sprites

            if (reflectionLayerSprites.length > 0) {
              // === STEP 1: Render and composite ONLY layer 0 ===
              pipeline.renderAndCompositeLayer0Only(ctx2d, view);

              // === STEP 2: Render reflection-layer sprites with water mask ===
              // Build a viewport-sized water mask from reflective tile pixels.
              // Non-reflective tiles (like grass) don't contribute to the mask, so
              // reflection-layer sprites are clipped away on those tiles.
              // This applies to both reflections AND water effects (puddle, ripple).
              if (webglCanvas) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                // Build water mask from current view
                const currentSnapshot = worldSnapshotRef.current;
                if (currentSnapshot) {
                  const waterMask = buildWaterMaskFromView(
                    view.pixelWidth,
                    view.pixelHeight,
                    view.cameraWorldX,
                    view.cameraWorldY,
                    (tileX, tileY) => {
                      const meta = getReflectionMetaFromSnapshot(
                        currentSnapshot,
                        tilesetRuntimesRef.current,
                        tileX,
                        tileY
                      );
                      return meta?.meta ? { isReflective: meta.meta.isReflective, pixelMask: meta.meta.pixelMask } : null;
                    }
                  );
                  spriteRenderer.setWaterMask(waterMask);
                }

                // Render all reflection sprites (including P2/P3 NPC reflections)
                const allReflectionSprites = [...reflectionLayerSprites, ...lowPriorityReflections];
                spriteRenderer.renderBatch(allReflectionSprites, spriteView);

                ctx2d.drawImage(webglCanvas, 0, 0);
              }

              // === STEP 2.5: Render low priority sprites (P2/P3) BEFORE layer 1 ===
              // These NPCs should always appear behind bridge/shore tiles
              if (normalLowPrioritySprites.length > 0 && webglCanvas) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                spriteRenderer.renderBatch(normalLowPrioritySprites, spriteView);

                ctx2d.drawImage(webglCanvas, 0, 0);
              }

              // === STEP 3: Render and composite layer 1 of ALL tiles ===
              // This covers reflections with shore edges, ground decorations, etc.
              pipeline.renderAndCompositeLayer1Only(ctx2d, view);

              // === STEP 3.5: Render door animations AFTER layer 1 but BEFORE sprites ===
              // Player should walk IN FRONT of the open door
              doorAnimations.render(ctx2d, view, nowTime);

              // === STEP 4: Render P1 normal sprites + player ===
              if (normalSprites.length > 0 && webglCanvas) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                spriteRenderer.renderBatch(normalSprites, spriteView);

                ctx2d.drawImage(webglCanvas, 0, 0);
              }
            } else {
              // No reflections - use standard compositing
              pipeline.compositeBackgroundOnly(ctx2d, view);

              // Render low priority sprites (P2/P3) BEFORE TopBelow
              // These NPCs should always appear behind bridge tiles
              if (lowPrioritySprites.length > 0 && webglCanvas) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                spriteRenderer.renderBatch(lowPrioritySprites, spriteView);

                ctx2d.drawImage(webglCanvas, 0, 0);
              }

              pipeline.compositeTopBelowOnly(ctx2d, view);

              // Render door animations AFTER TopBelow but BEFORE sprites
              // Player should walk IN FRONT of the open door
              doorAnimations.render(ctx2d, view, nowTime);

              // Render P1 sprites + player (between TopBelow and TopAbove)
              if (allSprites.length > 0 && webglCanvas) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                spriteRenderer.renderBatch(allSprites, spriteView);

                ctx2d.drawImage(webglCanvas, 0, 0);
              }
            }
          }

          // Render arrow overlay (inline - no ObjectRenderer dependency)
          if (arrowOverlay.isVisible() && !doorSequencer.isActive()) {
            const arrowState = arrowOverlay.getState();
            const arrowSprite = arrowOverlay.getSprite();
            if (arrowState && arrowSprite && arrowState.visible) {
              // Arrow animation constants (matches GBA: 32 ticks @ 60fps ≈ 533ms per frame)
              const ARROW_FRAME_SIZE = 16;
              const ARROW_FRAME_DURATION_MS = 533;
              const ARROW_FRAME_SEQUENCES: Record<'up' | 'down' | 'left' | 'right', number[]> = {
                down: [3, 7], up: [0, 4], left: [1, 5], right: [2, 6],
              };

              const framesPerRow = Math.max(1, Math.floor(arrowSprite.width / ARROW_FRAME_SIZE));
              const frameSequence = ARROW_FRAME_SEQUENCES[arrowState.direction];
              const elapsed = nowTime - arrowState.startedAt;
              const seqIndex = Math.floor(elapsed / ARROW_FRAME_DURATION_MS) % frameSequence.length;
              const frameIndex = frameSequence[seqIndex];
              const sx = (frameIndex % framesPerRow) * ARROW_FRAME_SIZE;
              const sy = Math.floor(frameIndex / framesPerRow) * ARROW_FRAME_SIZE;
              const dx = Math.round(arrowState.worldX * METATILE_SIZE - cameraX);
              const dy = Math.round(arrowState.worldY * METATILE_SIZE - cameraY);
              ctx2d.drawImage(arrowSprite, sx, sy, ARROW_FRAME_SIZE, ARROW_FRAME_SIZE, dx, dy, ARROW_FRAME_SIZE, ARROW_FRAME_SIZE);
            }
          }
        }

        pipeline.compositeTopAbove(ctx2d, view);

        // Render priority 0 NPCs (elevation 13-14) ABOVE TopAbove layer
        // These are special NPCs that render on top of all BG layers (GBA priority 0)
        const priority0Renderer = spriteRendererRef.current;
        if (priority0Sprites.length > 0 && priority0Renderer && prioritySpriteView) {
          const gl = pipeline.getGL();
          const webglCanvas = webglCanvasRef.current;
          if (webglCanvas) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            priority0Renderer.renderBatch(priority0Sprites, prioritySpriteView);

            ctx2d.drawImage(webglCanvas, 0, 0);
          }
        }

        // Render fade overlay (for warp transitions)
        const fade = fadeControllerRef.current;
        if (fade.isActive()) {
          fade.render(ctx2d, viewportWidth, viewportHeight, nowTime);
        }

        const renderTime = performance.now() - start;

        // Get tile count from pipeline stats
        const pipelineStats = pipeline.getStats();
        const tileCount = pipelineStats.passTileCounts.background +
                          pipelineStats.passTileCounts.topBelow +
                          pipelineStats.passTileCounts.topAbove;

        frameCount++;
        const now = performance.now();
        if (now - fpsTime >= 500) {
          const fps = Math.round((frameCount * 1000) / (now - fpsTime));
          setStats((s) => ({
            ...s,
            tileCount,
            renderTimeMs: renderTime,
            fps,
          }));
          if (cameraRef.current) {
            const pos = cameraRef.current.getPosition();
            setCameraDisplay({ x: pos.x, y: pos.y });
          }

          frameCount = 0;
          fpsTime = now;
        }
      }

      rafRef.current = requestAnimationFrame(renderLoop);
    };

    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
      spriteRendererRef.current?.dispose();
      spriteRendererRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerLoadedRef.current = false;
      worldManagerRef.current?.dispose();
      worldManagerRef.current = null;
    };
  }, []);

  // Load selected map assets and configure pipeline using WorldManager
  useEffect(() => {
    const entry = selectedMap;
    const pipeline = pipelineRef.current;
    if (!entry || !pipeline) return;

    let cancelled = false;
    setLoading(true);
    setStats((s) => ({ ...s, error: null }));
    // Reset/create camera when map changes
    if (cameraRef.current) {
      cameraRef.current.reset();
    } else {
      cameraRef.current = createWebGLCameraController(VIEWPORT_TILES_WIDE, VIEWPORT_TILES_HIGH);
    }
    setCameraDisplay({ x: 0, y: 0 });

    // Clean up previous world manager
    if (worldManagerRef.current) {
      worldManagerRef.current.dispose();
      worldManagerRef.current = null;
    }

    const load = async () => {
      try {
        // Create WorldManager and initialize with selected map
        const worldManager = new WorldManager();
        worldManagerRef.current = worldManager;

        // Subscribe to world events for dynamic updates
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

        // Set up GPU upload callback for scheduler
        worldManager.setGpuUploadCallback(createGpuUploadCallback(pipeline));

        // Initialize world from selected map
        const snapshot = await worldManager.initialize(entry.id);
        if (cancelled) return;

        // Initialize world state (shared helper)
        await initializeWorldFromSnapshot(snapshot, pipeline);

        // Invalidate pipeline cache (initial load only)
        pipeline.invalidate();

        // Set up player
        const player = playerRef.current;
        if (player) {
          const playerResolver = createSnapshotPlayerTileResolver(snapshot);
          player.setTileResolver(playerResolver);

          // Set up object collision checker for item balls, NPCs, etc.
          // Uses shared hasObjectCollisionAt from ObjectEventManager
          player.setObjectCollisionChecker((tileX, tileY) => {
            const objectManager = objectEventManagerRef.current;
            const playerElev = player.getCurrentElevation();
            return objectManager.hasObjectCollisionAt(tileX, tileY, playerElev);
          });

          // Spawn player at center of anchor map (offset 0,0)
          const spawnX = Math.floor(entry.width / 2);
          const spawnY = Math.floor(entry.height / 2);
          player.setPosition(spawnX, spawnY);
        }

        setStats((s) => ({ ...s, error: null }));
      } catch (err) {
        if (!cancelled) {
          setStats((s) => ({
            ...s,
            error: err instanceof Error ? err.message : 'Failed to load map assets',
          }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (worldManagerRef.current) {
        worldManagerRef.current.dispose();
        worldManagerRef.current = null;
      }
    };
  }, [selectedMap, initializeWorldFromSnapshot, createSnapshotPlayerTileResolver, loadObjectEventsFromSnapshot]);

  if (!selectedMap) {
    return (
      <div className="webgl-map-page">
        <h1>WebGL Map Viewer</h1>
        <p>No maps available.</p>
      </div>
    );
  }

  const pixelWidth = worldSize.width;
  const pixelHeight = worldSize.height;

  return (
    <div className="webgl-map-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>WebGL Map Viewer</h1>
        <a href="#/" style={{ color: '#88f' }}>Back to main</a>
      </div>
      <p style={{ marginTop: -6, color: '#ccc' }}>
        WebGL tile rendering with player sprite. Powered by the WebGL tile renderer + palette/animation system.
      </p>

      <div className="selector">
        <label htmlFor="map-select">Choose map</label>
        <select
          id="map-select"
          value={selectedMap.id}
          onChange={(e) => {
            setSelectedMapId(e.target.value);
            e.currentTarget.blur();
          }}
        >
          {renderableMaps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.width}x{map.height})
            </option>
          ))}
        </select>
        <div className="selector__meta">
          <span>
            Tilesets: {selectedMap.primaryTilesetId.replace('gTileset_', '')} / {selectedMap.secondaryTilesetId.replace('gTileset_', '')}
          </span>
          <span style={{ display: 'block', marginTop: 4 }}>
            Size: {selectedMap.width}×{selectedMap.height} metatiles ({pixelWidth}×{pixelHeight}px)
          </span>
          {stitchedMapCount > 1 && (
            <span style={{ display: 'block', marginTop: 4, color: '#8cf' }}>
              Stitched: {stitchedMapCount} maps ({worldSize.width}×{worldSize.height}px world)
            </span>
          )}
        </div>
        {loading && <div style={{ marginTop: 8, color: '#88f' }}>Loading map data…</div>}
        {stats.error && <div style={{ marginTop: 8, color: '#ff6666' }}>Error: {stats.error}</div>}
      </div>

      <div className="map-card">
        <div className="map-canvas-wrapper">
          <canvas
            ref={displayCanvasRef}
            className="webgl-map-canvas"
            style={{
              width: VIEWPORT_TILES_WIDE * METATILE_SIZE * zoom,
              height: VIEWPORT_TILES_HIGH * METATILE_SIZE * zoom,
              imageRendering: 'pixelated',
            }}
          />
        </div>
        <div className="map-stats">
          <div style={{ fontSize: 11, color: '#9fb0cc', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Arrow Keys to move. Z to run. ` for debug panel.</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Zoom:
              {[1, 2, 3].map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    background: zoom === z ? '#4a90d9' : '#2a3a4a',
                    color: zoom === z ? '#fff' : '#9fb0cc',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {z}x
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* Debug Panel - slide-out sidebar with WebGL tab */}
      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        state={debugState}
        webglState={webglDebugState}
      />
    </div>
  );
}

export default WebGLMapPage;
