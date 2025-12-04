/**
 * Game Page (WebGL Renderer)
 *
 * Main game page using WebGL rendering for hardware-accelerated
 * tile and sprite rendering. Supports dynamic map loading, NPCs,
 * warps, and all gameplay systems.
 *
 * This is the default page at /
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { isWebGL2Supported } from '../rendering/webgl/WebGLContext';
import { WebGLRenderPipeline } from '../rendering/webgl/WebGLRenderPipeline';
import { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import { WebGLFadeRenderer } from '../rendering/webgl/WebGLFadeRenderer';
import { uploadTilesetsFromSnapshot } from '../rendering/webgl/TilesetUploader';
import {
  getPlayerAtlasName,
  getFieldEffectAtlasName,
  getNPCAtlasName,
} from '../rendering/spriteUtils';
import type { SpriteInstance } from '../rendering/types';
import type { TileResolverFn, RenderContext } from '../rendering/types';
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
import { setupObjectCollisionChecker } from '../game/setupObjectCollisionChecker';
import { buildWorldCameraView } from '../game/buildWorldCameraView';
import { npcSpriteCache } from '../game/npc/NPCSpriteLoader';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { WorldManager, type WorldSnapshot } from '../game/WorldManager';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import type { NPCObject, ItemBallObject } from '../types/objectEvents';
import { METATILE_SIZE } from '../utils/mapLoader';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { findPlayerSpawnPosition } from '../game/findPlayerSpawnPosition';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import {
  computeReflectionState,
  getGlobalShimmer,
  type ReflectionMetaProvider,
} from '../field/ReflectionRenderer';
import { resolveTileAt, findWarpEventAt, type WarpTrigger } from '../components/map/utils';
import { processWarpTrigger, updateWarpHandlerTile } from '../game/WarpTriggerProcessor';
import { runDoorEntryUpdate, runDoorExitUpdate, type DoorSequenceDeps } from '../game/DoorSequenceRunner';
import type { ReflectionState } from '../components/map/types';
import { WarpHandler } from '../field/WarpHandler';
import { FadeController } from '../field/FadeController';
import { FADE_TIMING, type CardinalDirection } from '../field/types';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import { useWebGLSpriteBuilder } from '../hooks/useWebGLSpriteBuilder';
import { compositeWebGLFrame } from '../rendering/compositeWebGLFrame';
import {
  DebugPanel,
  DEFAULT_DEBUG_OPTIONS,
  getReflectionTileGridDebug,
  type DebugOptions,
  type DebugState,
  type WebGLDebugState,
  type PlayerDebugInfo,
  type ReflectionTileGridDebugInfo,
  type PriorityDebugInfo,
  type SpriteSortDebugInfo,
} from '../components/debug';
import {
  getPlayerFeetY,
  getPlayerCenterY,
  getPlayerSortKey,
  DEFAULT_SPRITE_SUBPRIORITY,
} from '../game/playerCoords';
import { getMetatileIdFromMapTile } from '../utils/mapLoader';
import {
  startDoorWarpSequence,
  type DoorWarpContext,
} from '../game/DoorActionDispatcher';
import { DialogProvider, DialogBox, useDialog } from '../components/dialog';
import { useActionInput } from '../hooks/useActionInput';
import './GamePage.css';

const GBA_FRAME_MS = 1000 / 59.7275; // Match real GBA vblank timing (~59.73 Hz)

type RenderStats = {
  webgl2Supported: boolean;
  tileCount: number;
  renderTimeMs: number;
  fps: number;
  error: string | null;
  pipelineDebug?: {
    tilesetVersion: number;
    lastRenderedTilesetVersion: number;
    needsFullRender: boolean;
    needsWarmupRender: boolean;
    lastViewHash: string;
    hasCachedInstances: boolean;
    tilesetsUploaded: boolean;
    cachedInstances: { background: number; topBelow: number; topAbove: number };
    lastRenderInfo: {
      timestamp: number;
      reason: string;
      animationOnly: boolean;
      tilesetVersion: number;
      viewHash: string;
      updatedAnimations: boolean;
      hadCaches: boolean;
    } | null;
    renderHistory: Array<{
      timestamp: number;
      reason: string;
      animationOnly: boolean;
      tilesetVersion: number;
      viewHash: string;
      updatedAnimations: boolean;
      hadCaches: boolean;
    }>;
    samples?: {
      background?: Uint8Array | null;
      topBelow?: Uint8Array | null;
    };
  };
};

// CameraState type replaced by CameraController from '../game/CameraController'
// StitchedWorldData now imported from '../game/snapshotUtils'

const mapIndexData = mapIndexJson as MapIndexEntry[];

// Viewport configuration (shared with MapRenderer)
const VIEWPORT_TILES_WIDE = DEFAULT_VIEWPORT_CONFIG.tilesWide;
const VIEWPORT_TILES_HIGH = DEFAULT_VIEWPORT_CONFIG.tilesHigh;
const VIEWPORT_PIXEL_SIZE = getViewportPixelSize();

/**
 * GamePage wrapper - provides DialogProvider context
 */
export function GamePage() {
  const [zoom, setZoom] = useState(2); // Default to 2x zoom for better visibility

  return (
    <DialogProvider zoom={zoom}>
      <GamePageContent zoom={zoom} onZoomChange={setZoom} />
    </DialogProvider>
  );
}

interface GamePageContentProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

/**
 * GamePageContent - main game rendering and logic
 */
function GamePageContent({ zoom, onZoomChange }: GamePageContentProps) {
  // Canvas refs - we use two canvases: hidden WebGL and visible 2D
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pipeline and state refs
  const pipelineRef = useRef<WebGLRenderPipeline | null>(null);
  const spriteRendererRef = useRef<WebGLSpriteRenderer | null>(null);
  const fadeRendererRef = useRef<WebGLFadeRenderer | null>(null);
  const stitchedWorldRef = useRef<StitchedWorldData | null>(null);
  const worldManagerRef = useRef<WorldManager | null>(null);
  const worldSnapshotRef = useRef<WorldSnapshot | null>(null);
  const worldBoundsRef = useRef<{ width: number; height: number; minX: number; minY: number }>({ width: 0, height: 0, minX: 0, minY: 0 });
  const rafRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const gbaFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const gbaAccumRef = useRef<number>(0);

  // Animation frame tracking for dirty tracking optimization
  // Animation updates every 10 GBA frames (~167ms) to match GBA behavior
  const ANIMATION_FRAME_TICKS = 10;
  const lastAnimationFrameRef = useRef<number>(0);

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

  // Sprite building hook (extracts complex sprite batch logic)
  const { buildSprites } = useWebGLSpriteBuilder();

  // Tileset runtimes for reflection detection (built from TilesetPairInfo)
  const tilesetRuntimesRef = useRef<Map<string, TilesetRuntimeType>>(new Map());

  // Object event manager for NPCs and items
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());
  const npcSpritesLoadedRef = useRef<Set<string>>(new Set());

  // Track door sprites uploaded to WebGL (keyed by metatileId hex)
  const doorSpritesUploadedRef = useRef<Set<string>>(new Set());
  // Track if arrow sprite is uploaded to WebGL
  const arrowSpriteUploadedRef = useRef<boolean>(false);

  // Track visible NPCs/items for debug panel (updated during render loop)
  const visibleNPCsRef = useRef<NPCObject[]>([]);
  const visibleItemsRef = useRef<ItemBallObject[]>([]);

  // Dialog system
  const { showYesNo, showMessage, isOpen: dialogIsOpen } = useDialog();

  // Action input hook (handles X key for surf/item pickup dialogs)
  useActionInput({
    playerControllerRef: playerRef,
    objectEventManagerRef,
    dialogIsOpen,
    showMessage,
    showYesNo,
  });

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
  // Sampling cooldown ref (unused when debug disabled)
  const sampleCooldownRef = useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [cameraDisplay, setCameraDisplay] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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
  const [priorityDebugInfo, setPriorityDebugInfo] = useState<PriorityDebugInfo | null>(null);

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
      pipelineDebug: stats.pipelineDebug,
      viewportTilesWide: VIEWPORT_TILES_WIDE,
      viewportTilesHigh: VIEWPORT_TILES_HIGH,
      cameraX: Math.round(cameraDisplay.x),
      cameraY: Math.round(cameraDisplay.y),
      worldWidthPx: worldSize.width,
      worldHeightPx: worldSize.height,
      stitchedMapCount,
    },
    shimmer: getGlobalShimmer().getDebugInfo(),
    reflectionTileGrid: reflectionTileGridDebug,
    priority: priorityDebugInfo,
  }), [mapDebugInfo, warpDebugInfo, stats, cameraDisplay, worldSize, stitchedMapCount, reflectionTileGridDebug, priorityDebugInfo]);

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

      // Set up object collision checker (shared utility)
      setupObjectCollisionChecker(player, objectEventManagerRef.current);

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
      // WebGL2 not supported - redirect to legacy Canvas2D mode
      console.warn('WebGL2 not supported, redirecting to legacy Canvas2D mode');
      window.location.hash = '#/legacy';
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

      // Initialize fade renderer (for screen fade transitions)
      const fadeRenderer = new WebGLFadeRenderer(pipeline.getGL());
      fadeRenderer.initialize();
      fadeRendererRef.current = fadeRenderer;
    } catch (e) {
      // WebGL pipeline creation failed - redirect to legacy Canvas2D mode
      console.error('Failed to create WebGL pipeline, redirecting to legacy Canvas2D mode:', e);
      window.location.hash = '#/legacy';
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
            // Surfing uses 32x32 frames, shadow uses 16x8, others use 16x32
            let frameWidth = 16;
            let frameHeight = 32;
            if (key === 'shadow') {
              frameWidth = 16;
              frameHeight = 8;
            } else if (key === 'surfing') {
              frameWidth = 32;
              frameHeight = 32;
            }
            spriteRenderer.uploadSpriteSheet(atlasName, canvas, {
              frameWidth,
              frameHeight,
            });
            console.log(`[WebGL] Uploaded sprite sheet: ${atlasName} (${canvas.width}x${canvas.height}, frame: ${frameWidth}x${frameHeight})`);
          }

          // Upload surf blob sprite - await its loading first
          const blobRenderer = player.getSurfingController().getBlobRenderer();
          await blobRenderer.waitForLoad();
          const blobCanvas = blobRenderer.getSpriteCanvas();
          if (blobCanvas) {
            spriteRenderer.uploadSpriteSheet('surf-blob', blobCanvas, {
              frameWidth: 32,
              frameHeight: 32,
            });
            console.log(`[WebGL] Uploaded surf blob sprite (${blobCanvas.width}x${blobCanvas.height})`);
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
              currentElevation: player.getCurrentElevation(),
              previousElevation: player.getPreviousElevation(),
              isMoving: player.isMoving,
              isSurfing: player.isSurfing(),
              isJumping: player.getSurfingController().isJumping(),
              mapId: debugInfo?.currentMap ?? selectedMap.id,
              stateName: player.getStateName(),
              hasCollisionChecker: player.hasObjectCollisionChecker(),
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

          // Check for warps using shared WarpTriggerProcessor
          if (snapshot) {
            const renderContext = getRenderContextFromSnapshot(snapshot);
            if (renderContext) {
              const warpResult = processWarpTrigger({
                player,
                renderContext,
                warpHandler: warpHandlerRef.current,
                isDoorSequencerActive: doorSequencer.isActive(),
              });

              // Update warp handler's last checked tile if tile changed
              if (warpResult.tileChanged) {
                updateWarpHandlerTile(warpHandlerRef.current, warpResult);
              }

              // Handle warp actions
              const action = warpResult.action;
              if (action.type === 'arrow') {
                // Arrow warps are handled through PlayerController's doorWarpHandler
                // Just update arrow overlay, don't auto-warp
              } else if (action.type === 'autoDoorWarp') {
                // Non-animated doors (stairs, ladders): auto-warp with fade
                arrowOverlay.hide();
                doorSequencer.startAutoWarp({
                  targetX: player.tileX,
                  targetY: player.tileY,
                  metatileId: getMetatileIdFromMapTile(action.resolvedTile.mapTile),
                  isAnimatedDoor: false,
                  entryDirection: player.dir as CardinalDirection,
                  warpTrigger: action.trigger,
                }, nowTime, true);
                player.lockInput();
              } else if (action.type === 'walkOverWarp') {
                // Other walk-over warps: simple warp
                warpHandlerRef.current.startWarp(player.tileX, player.tileY, warpResult.currentTile!.mapId);
                pendingWarpRef.current = action.trigger;
                warpingRef.current = true;
                player.lockInput();
                fadeControllerRef.current.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
              }
            }
          }
        }
      }

      // Advance door sequences using shared DoorSequenceRunner
      if (player) {
        const doorDeps: DoorSequenceDeps = {
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

        runDoorEntryUpdate(doorDeps, nowTime);
        runDoorExitUpdate(doorDeps, nowTime);
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

      const viewportWidth = VIEWPORT_PIXEL_SIZE.width;
      const viewportHeight = VIEWPORT_PIXEL_SIZE.height;

      if (width > 0 && height > 0 && camera) {
        // Ensure display canvas is sized to viewport
        if (displayCanvas.width !== viewportWidth || displayCanvas.height !== viewportHeight) {
          displayCanvas.width = viewportWidth;
          displayCanvas.height = viewportHeight;
        }

        const start = performance.now();

        // Get camera view for rendering
        const camView = camera.getView(1);  // +1 tile for sub-tile scrolling
        // Build world camera view using shared utility
        const view = buildWorldCameraView({
          cameraX: camView.x,
          cameraY: camView.y,
          startTileX: camView.startTileX,
          startTileY: camView.startTileY,
          subTileOffsetX: camView.subTileOffsetX,
          subTileOffsetY: camView.subTileOffsetY,
          tilesWide: camView.tilesWide,
          tilesHigh: camView.tilesHigh,
          pixelWidth: camView.tilesWide * METATILE_SIZE,
          pixelHeight: camView.tilesHigh * METATILE_SIZE,
        });

        // Get player elevation for layer splitting (same as useCompositeScene)
        const playerElevation = player && playerLoadedRef.current ? player.getElevation() : 0;

        // Calculate animation frame and whether it changed
        // Animation updates every 10 GBA frames (~167ms) to match GBA water/flower animations
        const currentAnimationFrame = Math.floor(gbaFrameRef.current / ANIMATION_FRAME_TICKS);
        const animationChanged = currentAnimationFrame !== lastAnimationFrameRef.current;
        lastAnimationFrameRef.current = currentAnimationFrame;

        // Render using pipeline with proper dirty tracking
        // The pipeline internally tracks view changes and elevation changes
        // needsFullRender: false allows the pipeline to use its internal dirty tracking
        // animationChanged: only true when animation frame ticks (every ~167ms)
        pipeline.render(
          null as any, // RenderContext not used by WebGL pipeline
          view,
          playerElevation,
          { gameFrame: gbaFrameRef.current, needsFullRender: false, animationChanged }
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

        // Render field effects and player with proper Y-sorting
        if (player && playerLoadedRef.current) {
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
            // Use WorldCameraView for sprite renderer
            const spriteView = view;

            // Get visible NPCs and items for debug panel
            const npcs = objectEventManagerRef.current.getVisibleNPCs();
            const items = objectEventManagerRef.current.getVisibleItemBalls();
            visibleNPCsRef.current = npcs;
            visibleItemsRef.current = items;

            // Get field effects for sprite batching
            const fieldEffects = fieldSpritesLoadedRef.current
              ? player.getGrassEffectManager().getEffectsForRendering()
              : [];

            // Build all sprites using extracted hook
            const spriteBuildResult = buildSprites({
              player,
              playerLoaded: playerLoadedRef.current,
              playerHidden: playerHiddenRef.current,
              snapshot: currentSnapshot,
              tilesetRuntimes: tilesetRuntimesRef.current,
              npcs,
              fieldEffects,
              spriteRenderer,
              doorAnimations,
              arrowOverlay,
              doorSequencer,
              doorSpritesUploaded: doorSpritesUploadedRef.current,
              arrowSpriteUploaded: arrowSpriteUploadedRef.current,
              nowTime,
              computeReflectionState: computeReflectionStateFromSnapshot,
            });

            // Track newly uploaded sprites
            for (const atlasName of spriteBuildResult.newDoorSpritesUploaded) {
              doorSpritesUploadedRef.current.add(atlasName);
            }
            if (spriteBuildResult.arrowSpriteWasUploaded) {
              arrowSpriteUploadedRef.current = true;
            }

            // Extract sprite groups from result
            const { lowPrioritySprites: builtLowPriority, allSprites, priority0Sprites: builtP0, doorSprites, arrowSprite, surfBlobSprite } = spriteBuildResult;
            lowPrioritySprites = builtLowPriority;
            priority0Sprites = builtP0;

            // Collect priority debug info if debug panel is enabled
            if (debugOptionsRef.current.enabled && player) {
              const playerFeetY = getPlayerFeetY(player);
              const playerSortKeyY = playerFeetY;
              const playerSubpriority = DEFAULT_SPRITE_SUBPRIORITY;
              const playerSortKey = getPlayerSortKey(player);

              // Build sorted sprites list with debug info
              const sortedSpritesDebug: SpriteSortDebugInfo[] = [];
              const fieldEffectsDebug: SpriteSortDebugInfo[] = [];
              const npcsDebug: SpriteSortDebugInfo[] = [];
              let npcWithPlayer = 0, npcBehindBridge = 0, npcAboveAll = 0;
              let effectsBottom = 0, effectsTop = 0;

              // Process all sprites - extract actual position data from SpriteInstance
              for (const sprite of allSprites) {
                // Determine sprite type and name from atlas name or other properties
                let name = sprite.atlasName || 'unknown';
                let type: SpriteSortDebugInfo['type'] = 'npc';
                let renderLayer = 'withPlayer';

                // Use actual sprite world position
                const spriteWorldY = sprite.worldY;
                const spriteFeetY = sprite.worldY + sprite.height; // feet at bottom of sprite
                const spriteTileX = Math.floor((sprite.worldX + sprite.width / 2) / 16);
                const spriteTileY = Math.floor(spriteFeetY / 16);

                // Extract info based on atlas name patterns
                // Note: NPC atlas names use 'npc-' prefix (with hyphen)
                if (name.includes('player_') || name.includes('player-')) {
                  type = 'player';
                  name = 'Player';
                } else if (name.includes('grass') || name.includes('sand') || name.includes('ripple') || name.includes('splash')) {
                  type = 'fieldEffect';
                  renderLayer = sprite.sortKey < playerSortKey ? 'bottom' : 'top';
                  if (sprite.sortKey < playerSortKey) effectsBottom++; else effectsTop++;
                } else if (sprite.isReflection) {
                  type = 'reflection';
                  name = `Refl: ${name.replace(/npc[-_]/, '').replace('OBJ_EVENT_GFX_', '')}`;
                } else if (name.startsWith('npc-') || name.startsWith('npc_')) {
                  type = 'npc';
                  name = name.replace(/npc[-_]/, '').replace('OBJ_EVENT_GFX_', '');
                  npcWithPlayer++;
                }

                const debugInfo: SpriteSortDebugInfo = {
                  name: name.length > 20 ? name.slice(0, 17) + '...' : name,
                  type,
                  tileX: spriteTileX,
                  tileY: spriteTileY,
                  worldY: spriteWorldY,
                  feetY: spriteFeetY,
                  sortKeyY: (sprite.sortKey >> 8), // Extract Y from sortKey
                  subpriority: sprite.sortKey & 0xFF,
                  sortKey: sprite.sortKey,
                  renderLayer,
                };

                sortedSpritesDebug.push(debugInfo);
                if (type === 'fieldEffect') fieldEffectsDebug.push(debugInfo);
                if (type === 'npc') npcsDebug.push(debugInfo);
              }

              // Count low priority and P0 NPCs
              for (const sprite of lowPrioritySprites) {
                if (!sprite.isReflection) npcBehindBridge++;
              }
              for (const sprite of priority0Sprites) {
                if (!sprite.isReflection) npcAboveAll++;
              }

              // Build comparison list (nearby sprites)
              const nearbySprites = sortedSpritesDebug
                .filter(s => s.type !== 'reflection')
                .map(s => ({
                  name: s.name,
                  sortKey: s.sortKey,
                  diff: s.sortKey - playerSortKey,
                  rendersAfterPlayer: s.sortKey > playerSortKey,
                }))
                .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
                .slice(0, 15);

              setPriorityDebugInfo({
                player: {
                  tileX: player.tileX,
                  tileY: player.tileY,
                  pixelY: player.y,
                  feetY: playerFeetY,
                  spriteCenter: getPlayerCenterY(player),
                  sortKeyY: playerSortKeyY,
                  subpriority: playerSubpriority,
                  sortKey: playerSortKey,
                  elevation: player.getElevation(),
                },
                sortedSprites: sortedSpritesDebug,
                fieldEffects: {
                  total: fieldEffectsDebug.length,
                  bottom: effectsBottom,
                  top: effectsTop,
                  effects: fieldEffectsDebug,
                },
                npcs: {
                  total: npcsDebug.length + npcBehindBridge + npcAboveAll,
                  withPlayer: npcWithPlayer,
                  behindBridge: npcBehindBridge,
                  aboveAll: npcAboveAll,
                  list: npcsDebug,
                },
                comparison: {
                  playerSortKey,
                  nearbySprites,
                },
              });
            }

        // Use extracted compositing function for GBA-accurate layer ordering
        const webglCanvas = webglCanvasRef.current;
        if (webglCanvas) {
          const fadeAlpha = fadeControllerRef.current.isActive()
            ? fadeControllerRef.current.getAlpha(nowTime)
            : 0;

          compositeWebGLFrame(
            {
              pipeline,
              spriteRenderer,
              fadeRenderer: fadeRendererRef.current,
              ctx2d,
              webglCanvas,
              view: spriteView,
              snapshot: currentSnapshot,
              tilesetRuntimes: tilesetRuntimesRef.current,
            },
            {
              lowPrioritySprites,
              allSprites,
              priority0Sprites,
              doorSprites,
              arrowSprite,
              surfBlobSprite,
            },
            { fadeAlpha }
          );
        }
      }
        }

        const renderTime = performance.now() - start;

        // Get tile count from pipeline stats
        const pipelineStats = pipeline.getStats();
        const samples = debugOptionsRef.current.enabled ? pipeline.getPassSamples() : undefined;
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
            pipelineDebug: {
              tilesetVersion: pipelineStats.tilesetVersion,
              lastRenderedTilesetVersion: pipelineStats.lastRenderedTilesetVersion,
              needsFullRender: pipelineStats.needsFullRender,
              needsWarmupRender: pipelineStats.needsWarmupRender,
              lastViewHash: pipelineStats.lastViewHash,
              hasCachedInstances: pipelineStats.hasCachedInstances,
              tilesetsUploaded: pipelineStats.tilesetsUploaded,
              cachedInstances: pipelineStats.passTileCounts,
              lastRenderInfo: pipelineStats.lastRenderInfo,
              renderHistory: pipelineStats.renderHistory,
              renderMeta: pipelineStats.renderMeta,
              samples,
            },
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
      fadeRendererRef.current?.dispose();
      fadeRendererRef.current = null;
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

          // Set up object collision checker (shared utility)
          setupObjectCollisionChecker(player, objectEventManagerRef.current);

          // Spawn player using shared spawn finder utility
          const anchorMap = snapshot.maps.find(m => m.entry.id === entry.id) ?? snapshot.maps[0];
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
      <div className="game-page">
        <h1>Pkmn RSE Browser</h1>
        <p>No maps available.</p>
      </div>
    );
  }

  return (
    <div className="game-page">
      <h1>Pkmn RSE Browser</h1>
      {stats.error && <div style={{ marginBottom: 8, color: '#ff6666' }}>Error: {stats.error}</div>}

      <div className="map-card">
        <div className="map-canvas-wrapper" style={{ position: 'relative' }}>
          <canvas
            ref={displayCanvasRef}
            className="game-canvas"
            style={{
              width: VIEWPORT_PIXEL_SIZE.width * zoom,
              height: VIEWPORT_PIXEL_SIZE.height * zoom,
              imageRendering: 'pixelated',
            }}
          />
          {/* Dialog box overlay - positioned within viewport */}
          <DialogBox
            viewportWidth={VIEWPORT_PIXEL_SIZE.width * zoom}
            viewportHeight={VIEWPORT_PIXEL_SIZE.height * zoom}
          />
        </div>
        <div className="map-stats">
          <div style={{ fontSize: 11, color: '#9fb0cc', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Arrow Keys to move. Z to run. X to interact. ` for debug panel.</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Zoom:
              {[1, 2, 3].map((z) => (
                <button
                  key={z}
                  onClick={() => onZoomChange(z)}
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

      {/* Debug Panel - slide-out sidebar with map selection and WebGL tab */}
      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        state={debugState}
        webglState={webglDebugState}
        maps={renderableMaps}
        selectedMapId={selectedMapId}
        onMapChange={setSelectedMapId}
        mapLoading={loading}
      />
    </div>
  );
}

export default GamePage;
