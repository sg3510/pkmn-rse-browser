/**
 * Game Page (WebGL Renderer)
 *
 * Main game page using WebGL rendering for hardware-accelerated
 * tile and sprite rendering. Supports dynamic map loading, NPCs,
 * warps, and all gameplay systems.
 *
 * Now includes a state machine for Title Screen → Main Menu → Overworld flow.
 *
 * This is the default page at /
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GameState, GameStateManager } from '../core';
import {
  createTitleScreenState,
  createMainMenuState,
  createBirchSpeechState,
  createOverworldState,
  createBattleState,
} from '../states';
import { isWebGL2Supported } from '../rendering/webgl/WebGLContext';
import { WebGLRenderPipeline } from '../rendering/webgl/WebGLRenderPipeline';
import { WebGLSpriteRenderer } from '../rendering/webgl/WebGLSpriteRenderer';
import { WebGLFadeRenderer } from '../rendering/webgl/WebGLFadeRenderer';
import { WebGLScanlineRenderer } from '../rendering/webgl/WebGLScanlineRenderer';
import { uploadTilesetsFromSnapshot } from '../rendering/webgl/TilesetUploader';
import type { SpriteInstance } from '../rendering/types';
import type { TileResolverFn, RenderContext } from '../rendering/types';
import { PlayerController, type TileResolver as PlayerTileResolver } from '../game/PlayerController';
import { CameraController } from '../game/CameraController';
import { TileResolverFactory } from '../game/TileResolverFactory';
import {
  getReflectionMetaFromSnapshot,
  createRenderContextFromSnapshot,
  createStitchedWorldFromSnapshot,
  buildTilesetRuntimesForSnapshot,
  type StitchedWorldData,
} from '../game/snapshotUtils';
import { updateWorldBounds } from '../game/worldManagerEvents';
import { ObjectEventManager } from '../game/ObjectEventManager';
import { buildWorldCameraView } from '../game/buildWorldCameraView';
import { loadObjectEventsFromSnapshot as loadObjectEventsFromSnapshotUtil } from '../game/loadObjectEventsFromSnapshot';
import { npcSpriteCache } from '../game/npc/NPCSpriteLoader';
import { npcAnimationManager } from '../game/npc/NPCAnimationEngine';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { useNPCMovement } from '../hooks/useNPCMovement';
import type { WorldManager, WorldSnapshot } from '../game/WorldManager';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import { isNPCGraphicsId, type NPCObject, type ItemBallObject } from '../types/objectEvents';
import { METATILE_SIZE, isCollisionPassable } from '../utils/mapLoader';
import { createLogger } from '../utils/logger';
import { isDebugMode } from '../utils/debug';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize, type ViewportConfig } from '../config/viewport';
import { GBA_FRAME_MS } from '../config/timing';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import {
  computeReflectionState,
  getGlobalShimmer,
  type ReflectionMetaProvider,
} from '../field/ReflectionRenderer';
import { resolveTileAt, type WarpTrigger } from '../components/map/utils';
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
} from '../components/debug';
import { getMetatileIdFromMapTile } from '../utils/mapLoader';
import {
  MB_DEEP_SAND,
  MB_SAND,
  MB_SECRET_BASE_WALL,
  MB_IMPASSABLE_EAST,
  MB_IMPASSABLE_SOUTH_AND_NORTH,
  MB_IMPASSABLE_WEST_AND_EAST,
  MB_JUMP_SOUTHWEST,
  isDoorBehavior,
  isSurfableBehavior,
} from '../utils/metatileBehaviors';
import {
  DialogProvider,
  DialogBox,
  useDialog,
  registerDialogBridge,
  unregisterDialogBridge,
} from '../components/dialog';
import { useActionInput } from '../hooks/useActionInput';
import { SaveLoadButtons } from '../components/SaveLoadButtons';
import { MenuOverlay, menuStateManager } from '../menu';
import type { LocationState } from '../save/types';
import { gameVariables, GAME_VARS } from '../game/GameVariables';
import { saveManager } from '../save/SaveManager';
import { bagManager } from '../game/BagManager';
import { getItemId, getItemName } from '../data/items';
import { getDynamicWarpTarget } from '../game/DynamicWarp';
import { shouldRunCoordEvent } from '../game/NewGameFlow';
import { getMapScripts } from '../data/scripts';
import type { MapScriptData } from '../data/scripts/types';
import { ensureOverworldRuntimeAssets as ensureOverworldRuntimeAssetsUtil } from './gamePage/overworldAssets';
import { buildWebGLDebugState } from './gamePage/buildWebGLDebugState';
import { buildDebugState } from './gamePage/buildDebugState';
import { buildPriorityDebugInfo } from './gamePage/buildPriorityDebugInfo';
import { useStateMachineRenderLoop } from './gamePage/useStateMachineRenderLoop';
import { useOverworldContinueLocation } from './gamePage/useOverworldContinueLocation';
import { performWarpTransition } from './gamePage/performWarpTransition';
import { loadSelectedOverworldMap } from './gamePage/loadSelectedOverworldMap';
import { useHandledStoryScript } from './gamePage/useHandledStoryScript';
import {
  applyTruckSequenceFrame,
  createTruckSequenceRuntime,
  isTruckSequenceLocked,
  syncTruckSequenceRuntime,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM,
} from '../game/TruckSequenceRunner';
import './GamePage.css';

const gamePageLogger = createLogger('GamePage');

// C reference: public/pokeemerald/include/constants/metatile_labels.h
const METATILE_HOUSE_MOVING_BOX_CLOSED = 0x268;
const METATILE_HOUSE_MOVING_BOX_OPEN = 0x270;

type ScriptedWarpDirection = 'up' | 'down' | 'left' | 'right';
type ScriptedWarpPhase = 'pending' | 'fading' | 'loading';

type PendingScriptedWarp = {
  mapId: string;
  x: number;
  y: number;
  direction: ScriptedWarpDirection;
  phase: ScriptedWarpPhase;
};

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
    renderMeta?: {
      background?: { instances: number; width: number; height: number; timestamp: number };
      topBelow?: { instances: number; width: number; height: number; timestamp: number };
      topAbove?: { instances: number; width: number; height: number; timestamp: number };
    };
    samples?: {
      background?: Uint8Array | null;
      topBelow?: Uint8Array | null;
    };
  };
};

// CameraState type replaced by CameraController from '../game/CameraController'
// StitchedWorldData now imported from '../game/snapshotUtils'

const mapIndexData = mapIndexJson as MapIndexEntry[];

/**
 * GamePage wrapper - provides DialogProvider context and state machine
 */
export function GamePage() {
  const [zoom, setZoom] = useState(2); // Default to 2x zoom for better visibility
  const [currentState, setCurrentState] = useState<GameState>(GameState.TITLE_SCREEN);
  // Viewport configuration - can be changed via debug panel
  const [viewportConfig, setViewportConfig] = useState<ViewportConfig>(DEFAULT_VIEWPORT_CONFIG);
  // Use state instead of ref so child re-renders when manager is ready
  const [stateManager, setStateManager] = useState<GameStateManager | null>(null);

  // Initialize state manager once
  useEffect(() => {
    const manager = new GameStateManager({
      initialState: GameState.TITLE_SCREEN,
      viewport: viewportConfig,
      onStateChange: (_from, to) => {
        gamePageLogger.info('State changed to:', to);
        setCurrentState(to);
      },
    });

    // Register all states
    manager.registerState(GameState.TITLE_SCREEN, createTitleScreenState);
    manager.registerState(GameState.MAIN_MENU, createMainMenuState);
    manager.registerState(GameState.NEW_GAME_BIRCH, createBirchSpeechState);
    manager.registerState(GameState.OVERWORLD, createOverworldState);
    manager.registerState(GameState.BATTLE, createBattleState);

    // Set state to trigger child re-render
    setStateManager(manager);

    // Initialize to title screen
    void manager.initialize(GameState.TITLE_SCREEN);

    return () => {
      manager.dispose();
      setStateManager(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only initialize once - viewport changes handled separately

  // Update state manager when viewport changes (without resetting state)
  useEffect(() => {
    if (stateManager) {
      stateManager.setViewport(viewportConfig);
    }
  }, [stateManager, viewportConfig]);

  // Compute viewport pixel size for responsive menus
  const viewportPixelSize = getViewportPixelSize(viewportConfig);
  const dialogConfig = useMemo(
    () => ({
      // C source passes `canABSpeedUpPrint = TRUE` for Birch speech text
      // (AddTextPrinterForMessage(TRUE) in main_menu.c:1339), so allow skip everywhere.
      allowSkip: true,
      textSpeed: 'medium' as const,
    }),
    []
  );

  return (
    <DialogProvider zoom={zoom} viewport={viewportPixelSize} config={dialogConfig}>
      <GamePageContent
        zoom={zoom}
        onZoomChange={setZoom}
        currentState={currentState}
        stateManager={stateManager}
        viewportConfig={viewportConfig}
        onViewportChange={setViewportConfig}
      />
    </DialogProvider>
  );
}

interface GamePageContentProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  currentState: GameState;
  stateManager: GameStateManager | null;
  viewportConfig: ViewportConfig;
  onViewportChange: (config: ViewportConfig) => void;
}

/**
 * GamePageContent - main game rendering and logic
 */
function GamePageContent({ zoom, onZoomChange, currentState, stateManager, viewportConfig, onViewportChange }: GamePageContentProps) {
  // Compute viewport dimensions from config
  const viewportTilesWide = viewportConfig.tilesWide;
  const viewportTilesHigh = viewportConfig.tilesHigh;
  const viewportPixelSize = useMemo(() => getViewportPixelSize(viewportConfig), [viewportConfig]);

  // Ref to store current viewport size for render loop (avoids stale closure)
  const viewportPixelSizeRef = useRef(viewportPixelSize);
  viewportPixelSizeRef.current = viewportPixelSize;

  // Ref to store current zoom for render loop (avoids stale closure)
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Refs to avoid stale closures in the long-lived render loop.
  const currentStateRef = useRef(currentState);
  currentStateRef.current = currentState;

  const dialogIsOpenRef = useRef(false);

  // Canvas refs - we use two canvases: hidden WebGL and visible 2D
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCtx2dRef = useRef<CanvasRenderingContext2D | null>(null);
  // State overlay canvas - used for title screen and menus (2D rendering)
  const stateCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pipeline and state refs
  const pipelineRef = useRef<WebGLRenderPipeline | null>(null);
  const spriteRendererRef = useRef<WebGLSpriteRenderer | null>(null);
  const fadeRendererRef = useRef<WebGLFadeRenderer | null>(null);
  const scanlineRendererRef = useRef<WebGLScanlineRenderer | null>(null);
  const stitchedWorldRef = useRef<StitchedWorldData | null>(null);
  const worldManagerRef = useRef<WorldManager | null>(null);
  const worldSnapshotRef = useRef<WorldSnapshot | null>(null);
  const renderContextCacheRef = useRef<{ snapshot: WorldSnapshot; context: RenderContext | null } | null>(null);
  const worldBoundsRef = useRef<{ width: number; height: number; minX: number; minY: number }>({ width: 0, height: 0, minX: 0, minY: 0 });
  const rafRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const gbaFrameRef = useRef<number>(0);
  const truckRuntimeRef = useRef(createTruckSequenceRuntime());
  const lastTimeRef = useRef<number>(performance.now());
  const gbaAccumRef = useRef<number>(0);

  // Animation frame tracking for dirty tracking optimization
  // Animation updates every 10 GBA frames (~167ms) to match GBA behavior
  const ANIMATION_FRAME_TICKS = 10;
  const lastAnimationFrameRef = useRef<number>(0);

  // Player controller ref
  const playerRef = useRef<PlayerController | null>(null);
  const playerSpritesLoadPromiseRef = useRef<Promise<void> | null>(null);
  const fieldSpritesLoadPromiseRef = useRef<Promise<void> | null>(null);
  const lastWorldUpdateRef = useRef<{ tileX: number; tileY: number; direction: 'up' | 'down' | 'left' | 'right' } | null>(null);

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
  const storyScriptRunningRef = useRef<boolean>(false);
  const lastCoordTriggerTileRef = useRef<{ mapId: string; x: number; y: number } | null>(null);
  const lastPlayerMapIdRef = useRef<string | null>(null);

  // Cached map script data for data-driven ON_FRAME triggering
  const mapScriptCacheRef = useRef<Map<string, MapScriptData | null>>(new Map());
  const mapScriptLoadingRef = useRef<Set<string>>(new Set());

  // Safety net: suppress ON_FRAME scripts that ran but didn't change their trigger var.
  // Keyed by "scriptName" → trigger value when suppressed. Only un-suppress when var changes.
  // Cleared on warp. Prevents infinite loops from unimplemented cmds.
  const onFrameSuppressedRef = useRef<Map<string, number>>(new Map());

  // NPC movement hook - provides collision-aware movement updates
  // The providers object uses closure over refs so it always has fresh data
  const npcMovementProviders = useMemo(() => ({
    isTileWalkable: (x: number, y: number): boolean => {
      // Use player's tile resolver to check walkability
      const player = playerRef.current;
      const resolver = player?.getTileResolver();
      const resolved = resolver?.(x, y);
      if (!resolved) return false;

      const { attributes, mapTile } = resolved;
      if (!attributes) return true;

      const behavior = attributes.behavior;
      const collision = mapTile.collision;

      // Sand tiles are always walkable (if no object collision, which NPCs handle separately).
      if (behavior === MB_SAND || behavior === MB_DEEP_SAND) return true;

      // Block tiles with impassable collision bits (doors are handled separately for player, but still walkable).
      if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) return false;

      // Hard-blocked behaviors.
      if (behavior === MB_SECRET_BASE_WALL) return false;

      // NPCs can't surf, so block surfable water tiles.
      if (isSurfableBehavior(behavior)) return false;

      // Directionally impassable + ledge/jump tiles are blocked for NPCs.
      if (behavior >= MB_IMPASSABLE_EAST && behavior <= MB_JUMP_SOUTHWEST) return false;
      if (behavior === MB_IMPASSABLE_SOUTH_AND_NORTH || behavior === MB_IMPASSABLE_WEST_AND_EAST) return false;

      return true;
    },
    getTileElevation: (x: number, y: number): number => {
      const player = playerRef.current;
      const resolver = player?.getTileResolver();
      const resolved = resolver?.(x, y);
      return resolved?.mapTile?.elevation ?? 0;
    },
    getAllNPCs: (): NPCObject[] => {
      return objectEventManagerRef.current.getVisibleNPCs();
    },
    hasPlayerAt: (x: number, y: number): boolean => {
      // Check if player is at this tile position
      const player = playerRef.current;
      if (!player) return false;
      return player.tileX === x && player.tileY === y;
    },
    getTileBehavior: (x: number, y: number): number | undefined => {
      // Get tile behavior for grass effect detection
      const player = playerRef.current;
      const resolver = player?.getTileResolver();
      const resolved = resolver?.(x, y);
      return resolved?.attributes?.behavior;
    },
    get fieldEffectManager() {
      // Use player's grass effect manager for NPC grass effects too
      return playerRef.current?.getGrassEffectManager();
    },
  }), []); // Empty deps - functions use refs internally

  const npcMovement = useNPCMovement(npcMovementProviders);

  // Dialog system
  const {
    showYesNo,
    showMessage,
    showChoice,
    showTextEntry,
    close: closeDialog,
    isOpen: dialogIsOpen,
  } = useDialog();
  dialogIsOpenRef.current = dialogIsOpen;

  // Expose dialog API to non-React state renderers (e.g. Birch intro state).
  useEffect(() => {
    registerDialogBridge({
      showMessage,
      showChoice,
      showTextEntry,
      close: closeDialog,
      isOpen: () => dialogIsOpenRef.current,
    });

    return () => {
      unregisterDialogBridge();
    };
  }, [showMessage, showChoice, showTextEntry, closeDialog]);

  // Menu open handler (Enter key)
  useEffect(() => {
    const handleMenuKey = (e: KeyboardEvent) => {
      // Only open menu in OVERWORLD state
      if (currentState !== GameState.OVERWORLD) return;
      // Don't open if dialog is open
      if (dialogIsOpen) return;
      // Don't open during cutscenes/truck sequence/warps
      if (storyScriptRunningRef.current) return;
      if (warpingRef.current) return;
      if (isTruckSequenceLocked(truckRuntimeRef.current)) return;
      // Don't open if player is moving
      const player = playerRef.current;
      if (player?.isMoving) return;
      if (player?.inputLocked) return;
      // Don't open if menu is already open
      if (menuStateManager.isMenuOpen()) return;

      // Enter key opens menu
      if (e.code === 'Enter') {
        e.preventDefault();
        menuStateManager.open('start');
      }
    };

    window.addEventListener('keydown', handleMenuKey);
    return () => window.removeEventListener('keydown', handleMenuKey);
  }, [currentState, dialogIsOpen]);

  const renderableMaps = useMemo(
    () =>
      mapIndexData
        .filter((map) => map.layoutPath && map.primaryTilesetPath && map.secondaryTilesetPath)
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const defaultMap = renderableMaps.find((m) => m.name === 'LittlerootTown') || renderableMaps[0];
  const [selectedMapId, setSelectedMapId] = useState<string>(defaultMap?.id ?? '');
  // Display-only map ID for the debug panel. Updated by warps without triggering the map-load effect.
  const [displayMapId, setDisplayMapId] = useState<string>(defaultMap?.id ?? '');
  // Wrapper that updates both map-load state AND debug display (for user-driven map changes).
  const selectMapForLoad = useCallback((mapId: string) => {
    setSelectedMapId(mapId);
    setDisplayMapId(mapId);
  }, []);
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
  const [overworldEntryReady, setOverworldEntryReady] = useState(false);
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
    tilesetAnimations: Array<{
      slot: 0 | 1 | 2;
      pairId: string;
      animationCount: number;
      animationIds: string[];
      destinationCount: number;
      frameCount: number;
    }>;
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

  // Ref for pending saved location (set when Continue is selected, consumed on map load)
  const pendingSavedLocationRef = useRef<LocationState | null>(null);
  const pendingScriptedWarpRef = useRef<PendingScriptedWarp | null>(null);

  const setMapMetatileLocal = useCallback((
    mapId: string,
    tileX: number,
    tileY: number,
    metatileId: number
  ): boolean => {
    const snapshot = worldSnapshotRef.current;
    if (!snapshot) return false;

    const map = snapshot.maps.find((m) => m.entry.id === mapId);
    if (!map) return false;

    if (tileX < 0 || tileY < 0 || tileX >= map.mapData.width || tileY >= map.mapData.height) {
      return false;
    }

    const index = tileY * map.mapData.width + tileX;
    const tile = map.mapData.layout[index];
    if (!tile || tile.metatileId === metatileId) {
      return false;
    }

    tile.metatileId = metatileId;
    return true;
  }, []);

  const applyStoryOnLoadMetatileParity = useCallback((): void => {
    const snapshot = worldSnapshotRef.current;
    if (!snapshot) return;

    const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
    let changed = false;

    for (const map of snapshot.maps) {
      if (map.entry.id === 'MAP_INSIDE_OF_TRUCK') {
        if (introState >= 0 && introState <= 2) {
          // Effective C behavior at new-game start: ExecuteTruckSequence immediately
          // swaps the truck door to closed state before the intro runs.
          changed = setMapMetatileLocal(map.entry.id, 4, 1, METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP) || changed;
          changed = setMapMetatileLocal(map.entry.id, 4, 2, METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID) || changed;
          changed = setMapMetatileLocal(map.entry.id, 4, 3, METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM) || changed;
        } else {
          changed = setMapMetatileLocal(map.entry.id, 4, 1, METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP) || changed;
          changed = setMapMetatileLocal(map.entry.id, 4, 2, METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID) || changed;
          changed = setMapMetatileLocal(map.entry.id, 4, 3, METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM) || changed;
        }
      }

      if (
        (map.entry.id === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        || map.entry.id === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F')
        && introState < 6
      ) {
        changed = setMapMetatileLocal(map.entry.id, 5, 4, METATILE_HOUSE_MOVING_BOX_OPEN) || changed;
        changed = setMapMetatileLocal(map.entry.id, 5, 2, METATILE_HOUSE_MOVING_BOX_CLOSED) || changed;
      }
    }

    if (changed) {
      pipelineRef.current?.invalidate();
    }
  }, [setMapMetatileLocal]);

  const applyStoryTransitionObjectParity = useCallback((mapId: string): void => {
    const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
    const objectManager = objectEventManagerRef.current;
    const map = worldSnapshotRef.current?.maps.find((m) => m.entry.id === mapId);
    const mapOffsetX = map?.offsetX ?? 0;
    const mapOffsetY = map?.offsetY ?? 0;
    const setNpcPositionLocal = (localId: string, localX: number, localY: number) => {
      objectManager.setNPCPositionByLocalId(mapId, localId, mapOffsetX + localX, mapOffsetY + localY);
    };

    if (mapId === 'MAP_LITTLEROOT_TOWN' && introState === 2) {
      setNpcPositionLocal('LOCALID_LITTLEROOT_MOM', 14, 8);
    }

    if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F' && introState === 3) {
      setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 9, 8);
      objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
    }

    if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F' && introState === 3) {
      setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 2, 8);
      objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
    }

    // State 5: Mom near stairs (waiting for player to go upstairs)
    if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F' && introState === 5) {
      setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 8, 4);
      objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
    }
    if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F' && introState === 5) {
      setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 2, 4);
      objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
    }

    // State 6: Mom near TV (watching for broadcast)
    if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F' && introState === 6) {
      setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 4, 5);
      objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
    }
    if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F' && introState === 6) {
      setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 6, 5);
      objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
    }

    // Rival's 2F: set ready to meet rival when player visits
    if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_2F'
        && gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE) < 2) {
      const isMale = saveManager.getProfile().gender === 0;
      if (isMale) gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE, 2);
    }
    if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F'
        && gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE) < 2) {
      const isMale = saveManager.getProfile().gender === 0;
      if (!isMale) gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE, 2);
    }
  }, []);

  const buildLocationStateFromPlayer = useCallback((player: PlayerController, mapId: string): LocationState => {
    const worldManager = worldManagerRef.current;
    const mapInstance =
      worldManager?.getSnapshot().maps.find((map) => map.entry.id === mapId)
      ?? worldManager?.findMapAtPosition(player.tileX, player.tileY)
      ?? null;

    // C parity: SaveBlock1 position and warp coordinates are map-local.
    // Reference: public/pokeemerald/include/global.h (struct SaveBlock1)
    const localX = mapInstance ? player.tileX - mapInstance.offsetX : player.tileX;
    const localY = mapInstance ? player.tileY - mapInstance.offsetY : player.tileY;

    return {
      pos: { x: localX, y: localY },
      location: { mapId, warpId: 0, x: localX, y: localY },
      continueGameWarp: { mapId, warpId: 0, x: localX, y: localY },
      lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      direction: player.getFacingDirection(),
      elevation: player.getElevation(),
      isSurfing: player.isSurfing(),
    };
  }, []);

  const runHandledStoryScript = useHandledStoryScript({
    showMessage,
    showChoice,
    showYesNo,
    stateManager,
    selectedMapId,
    buildLocationStateFromPlayer,
    playerRef,
    worldManagerRef,
    pendingSavedLocationRef,
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    objectEventManagerRef,
    npcMovement,
    doorAnimations,
    gbaFrameMs: GBA_FRAME_MS,
    setMapMetatile: (mapId, tileX, tileY, metatileId) => {
      const changed = setMapMetatileLocal(mapId, tileX, tileY, metatileId);
      if (changed) {
        pipelineRef.current?.invalidate();
      }
      return changed;
    },
  });

  const runHandledStoryScriptRef = useRef(runHandledStoryScript);
  runHandledStoryScriptRef.current = runHandledStoryScript;

  // Action input hook (handles X key for surf/item pickup dialogs)
  useActionInput({
    playerControllerRef: playerRef,
    objectEventManagerRef,
    enabled: currentState === GameState.OVERWORLD,
    dialogIsOpen,
    showMessage,
    showYesNo,
    onScriptInteract: async (scriptObject) => {
      const player = playerRef.current;
      const wm = worldManagerRef.current;
      const mapId = (player && wm)
        ? wm.findMapAtPosition(player.tileX, player.tileY)?.entry.id
        : undefined;
      // Set VAR_FACING so scripts can branch on player direction (GBA: gSpecialVar_Facing)
      if (player) {
        const dirMap: Record<string, number> = { down: 1, up: 2, left: 3, right: 4 };
        gameVariables.setVar('VAR_FACING', dirMap[player.dir] ?? 0);
      }
      await runHandledStoryScript(scriptObject.script, mapId);
    },
    onNpcInteract: async (npc) => {
      const player = playerRef.current;
      const wm = worldManagerRef.current;
      if (!player || !wm || !npc.script || npc.script === '0x0') return;
      const currentMap = wm.findMapAtPosition(player.tileX, player.tileY);
      if (!currentMap) return;
      const mapId = currentMap.entry.id;
      // Set VAR_FACING so scripts can branch on player direction (GBA: gSpecialVar_Facing)
      const dirMap: Record<string, number> = { down: 1, up: 2, left: 3, right: 4 };
      gameVariables.setVar('VAR_FACING', dirMap[player.dir] ?? 0);
      // Only face person NPCs toward the player. Inanimate objects (boxes,
      // boulders, etc.) have a single sprite frame and must not be rotated.
      // In the GBA game `faceplayer` is a script command, but almost every
      // NPC dialog opens with it, so we do it eagerly for real NPCs here.
      if (isNPCGraphicsId(npc.graphicsId)) {
        if (npc.localId) {
          objectEventManagerRef.current.faceNpcTowardPlayer(
            mapId, npc.localId, player.tileX, player.tileY
          );
        } else {
          const dx = player.tileX - npc.tileX;
          const dy = player.tileY - npc.tileY;
          if (Math.abs(dx) > Math.abs(dy)) {
            npc.direction = dx < 0 ? 'left' : 'right';
          } else if (dy !== 0) {
            npc.direction = dy < 0 ? 'up' : 'down';
          }
        }
      }
      await runHandledStoryScript(npc.script, mapId);
    },
    onTileInteract: async (facingTileX, facingTileY, _playerDir) => {
      const player = playerRef.current;
      const wm = worldManagerRef.current;
      if (!player || !wm) return;
      const currentMap = wm.findMapAtPosition(player.tileX, player.tileY);
      if (!currentMap) return;
      const mapId = currentMap.entry.id;

      // Priority: hardcoded wall clock override for intro (uses SimplifiedClock
      // since the real WallClock script requires unimplemented `special` commands)
      const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
      if (introState === 5) {
        const localX = facingTileX - currentMap.offsetX;
        const localY = facingTileY - currentMap.offsetY;
        if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F' && localX === 5 && localY === 1) {
          await runHandledStoryScript('PlayersHouse_2F_EventScript_SimplifiedClock', mapId);
          return;
        }
        if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_2F' && localX === 3 && localY === 1) {
          await runHandledStoryScript('PlayersHouse_2F_EventScript_SimplifiedClock', mapId);
          return;
        }
      }

      // Generic bg_event lookup (signs, hidden items)
      const bgEvent = objectEventManagerRef.current.getBgEventAt(facingTileX, facingTileY);
      if (bgEvent) {
        if (bgEvent.type === 'sign' && bgEvent.script) {
          await runHandledStoryScript(bgEvent.script, mapId);
          return;
        }
        if (bgEvent.type === 'hidden_item' && bgEvent.item) {
          const itemId = getItemId(bgEvent.item);
          if (itemId && itemId > 0) {
            objectEventManagerRef.current.collectHiddenItem(bgEvent.id);
            bagManager.addItem(itemId, 1);
            const playerName = saveManager.getPlayerName();
            const itemName = getItemName(itemId);
            await showMessage(`${playerName} found one ${itemName}!`);
          }
          return;
        }
      }
    },
  });

  // Create WebGL debug state from existing debug info
  const webglDebugState = useMemo<WebGLDebugState>(() => {
    const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
    return buildWebGLDebugState({
      mapStitching: mapDebugInfo,
      warp: warpDebugInfo,
      renderStats: {
        tileCount: stats.tileCount,
        fps: stats.fps,
        renderTimeMs: stats.renderTimeMs,
        webgl2Supported: stats.webgl2Supported,
        pipelineDebug: stats.pipelineDebug,
        viewportTilesWide: viewportTilesWide,
        viewportTilesHigh: viewportTilesHigh,
        cameraX: Math.round(cameraDisplay.x),
        cameraY: Math.round(cameraDisplay.y),
        worldWidthPx: worldSize.width,
        worldHeightPx: worldSize.height,
        stitchedMapCount,
      },
      shimmer: getGlobalShimmer().getDebugInfo(),
      reflectionTileGrid: reflectionTileGridDebug,
      priority: priorityDebugInfo,
      introState,
      playerMapId: playerDebugInfo?.mapId,
      anchorMapId: worldSnapshotRef.current?.anchorMapId,
      truckRuntime: truckRuntimeRef.current,
      gbaFrame: gbaFrameRef.current,
      objectEventManager: objectEventManagerRef.current,
      npcSpriteCache,
    });
  }, [
    mapDebugInfo,
    warpDebugInfo,
    stats,
    cameraDisplay,
    worldSize,
    stitchedMapCount,
    reflectionTileGridDebug,
    priorityDebugInfo,
    playerDebugInfo,
  ]);

  // Debug state for the panel - reads from refs updated during render loop
  const debugState = useMemo<DebugState>(() => {
    const npcs = visibleNPCsRef.current;
    const items = visibleItemsRef.current;

    return buildDebugState({
      player: playerDebugInfo,
      visibleNPCs: npcs,
      visibleItems: items,
      totalNPCCount: objectEventManagerRef.current.getAllNPCs().length,
      totalItemCount: objectEventManagerRef.current.getAllItemBalls().length,
    });
  }, [playerDebugInfo]);

  // Track resolver creation for debugging
  const resolverIdRef = useRef(0);

  // Create tile resolver from WorldSnapshot using TileResolverFactory
  const createSnapshotTileResolver = useCallback((snapshot: WorldSnapshot): TileResolverFn => {
    const resolverId = ++resolverIdRef.current;
    gamePageLogger.debug(`[RESOLVER] #${resolverId} anchor:${snapshot.anchorMapId} maps:${snapshot.maps.length} pairs:${snapshot.tilesetPairs.length}`,
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
    await loadObjectEventsFromSnapshotUtil({
      snapshot,
      objectEventManager: objectEventManagerRef.current,
      spriteCache: npcSpriteCache,
      spriteRenderer: spriteRendererRef.current,
      uploadedSpriteIds: npcSpritesLoadedRef.current,
      clearAnimations: () => npcAnimationManager.clear(),
      debugLog: isDebugMode()
        ? (message) => {
          gamePageLogger.debug(message);
        }
        : undefined,
    });
  }, []);

  // Initialize world state from a snapshot (shared between initial load and warps)
  const initializeWorldFromSnapshot = useCallback(async (
    snapshot: WorldSnapshot,
    pipeline: WebGLRenderPipeline
  ): Promise<void> => {
    // Update snapshot ref
    worldSnapshotRef.current = snapshot;
    renderContextCacheRef.current = null;

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
    applyStoryOnLoadMetatileParity();
  }, [
    buildTilesetRuntimesFromSnapshot,
    createSnapshotTileResolver,
    uploadTilesetsFromSnapshot,
    loadObjectEventsFromSnapshot,
    applyStoryOnLoadMetatileParity,
  ]);

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
    const cached = renderContextCacheRef.current;
    if (cached && cached.snapshot === snapshot) {
      return cached.context;
    }
    const context = createRenderContextFromSnapshot(snapshot, tilesetRuntimesRef.current);
    renderContextCacheRef.current = { snapshot, context };
    return context;
  }, []);

  const ensureOverworldRuntimeAssets = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    ensureOverworldRuntimeAssetsUtil({
      player,
      isDebugMode,
      playerLoadedRef,
      playerSpritesLoadPromiseRef,
      fieldSpritesLoadedRef,
      fieldSpritesLoadPromiseRef,
      spriteRendererRef,
      worldSnapshotRef,
      warpHandlerRef,
      fieldSprites,
      getRenderContextFromSnapshot,
      doorSequencer,
      doorAnimations,
      arrowOverlay,
    });
  }, [arrowOverlay, doorAnimations, doorSequencer, fieldSprites, getRenderContextFromSnapshot]);

  // Ref to avoid ensureOverworldRuntimeAssets destabilizing the world-loading useEffect
  const ensureOverworldRuntimeAssetsRef = useRef(ensureOverworldRuntimeAssets);
  ensureOverworldRuntimeAssetsRef.current = ensureOverworldRuntimeAssets;

  // Execute a warp to destination map
  const performWarp = useCallback(async (
    trigger: WarpTrigger,
    options?: { force?: boolean; fromDoor?: boolean }
  ) => {
    // Clear ON_FRAME suppression — new map visit should re-evaluate frame scripts
    onFrameSuppressedRef.current.clear();
    await performWarpTransition({
      trigger,
      options,
      worldManager: worldManagerRef.current,
      player: playerRef.current,
      pipeline: pipelineRef.current,
      initializeWorldFromSnapshot,
      createSnapshotPlayerTileResolver,
      objectEventManager: objectEventManagerRef.current,
      getRenderContextFromSnapshot,
      doorSequencer,
      fadeController: fadeControllerRef.current,
      warpHandler: warpHandlerRef.current,
      playerHiddenRef,
      doorAnimations,
      applyStoryTransitionObjectParity,
      npcMovement,
      setWarpDebugInfo,
      resolverVersion: resolverIdRef.current,
      setLastCoordTriggerTile: (tile) => {
        lastCoordTriggerTileRef.current = tile;
      },
      warpingRef,
      resolveDynamicWarpTarget: () => getDynamicWarpTarget(),
      setMapMetatile: (mapId, tileX, tileY, metatileId) => {
        const changed = setMapMetatileLocal(mapId, tileX, tileY, metatileId);
        if (changed) {
          pipelineRef.current?.invalidate();
        }
        return changed;
      },
      mapScriptCache: mapScriptCacheRef.current,
      onMapChanged: (mapId: string) => {
        setDisplayMapId(mapId);
      },
    });
  }, [
    initializeWorldFromSnapshot,
    createSnapshotPlayerTileResolver,
    getRenderContextFromSnapshot,
    doorSequencer,
    doorAnimations,
    applyStoryTransitionObjectParity,
    npcMovement,
  ]);

  // Initialize WebGL pipeline and player once
  useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const initialCtx2d = displayCanvas.getContext('2d');
    if (!initialCtx2d) return;
    displayCtx2dRef.current = initialCtx2d;

    // Create hidden WebGL canvas
    const webglCanvas = document.createElement('canvas');
    webglCanvasRef.current = webglCanvas;

    if (!isWebGL2Supported(webglCanvas)) {
      // WebGL2 not supported - redirect to legacy Canvas2D mode
      gamePageLogger.warn('WebGL2 not supported, redirecting to legacy Canvas2D mode');
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

      // Initialize scanline renderer (for CRT effect when menus open)
      const scanlineRenderer = new WebGLScanlineRenderer(pipeline.getGL());
      scanlineRenderer.initialize();
      scanlineRendererRef.current = scanlineRenderer;
    } catch (e) {
      // WebGL pipeline creation failed - redirect to legacy Canvas2D mode
      gamePageLogger.error('Failed to create WebGL pipeline, redirecting to legacy Canvas2D mode:', e);
      window.location.hash = '#/legacy';
      return;
    }

    // Initialize player controller
    const player = new PlayerController();
    playerRef.current = player;

    let frameCount = 0;
    let fpsTime = performance.now();

    const renderLoop = () => {
      if (currentStateRef.current !== GameState.OVERWORLD) {
        lastTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const pipeline = pipelineRef.current;
      const stitchedWorld = stitchedWorldRef.current;
      const displayCanvas = displayCanvasRef.current;
      // Need stitched world to render
      if (!pipeline || !stitchedWorld || !displayCanvas) {
        rafRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      let ctx2d = displayCtx2dRef.current;
      if (!ctx2d) {
        ctx2d = displayCanvas.getContext('2d');
        if (!ctx2d) {
          rafRef.current = requestAnimationFrame(renderLoop);
          return;
        }
        displayCtx2dRef.current = ctx2d;
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
      npcAnimationManager.update();

      const { width, height, minX, minY } = worldBoundsRef.current;

      // World bounds are tracked in pixel space.
      const worldMinX = minX;
      const worldMinY = minY;
      const player = playerRef.current;

      // Update warp handler cooldown
      warpHandlerRef.current.update(dt);

      // Update NPC movement (GBA-accurate wandering behavior)
      // Only update when not warping and game is active
      if (!warpingRef.current && !menuStateManager.isMenuOpen()) {
        // Get visible NPCs and update their movement
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        if (npcs.length > 0) {
          npcMovement.update(dt, npcs);

          // Set NPC positions for grass effect cleanup
          if (player) {
            const npcPositions = npcMovement.getNPCOwnerPositions(npcs);
            player.setAdditionalOwnerPositions(npcPositions);
          }
        }
      }

      // Keep truck sequence runtime in sync (works even before player sprites finish loading).
      {
        const wm = worldManagerRef.current;
        const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
        const playerMapId = (player && playerLoadedRef.current)
          ? wm?.findMapAtPosition(player.tileX, player.tileY)?.entry.id
          : undefined;
        const fallbackMapId = worldSnapshotRef.current?.anchorMapId;
        const activeMapId = playerMapId ?? fallbackMapId;
        const shouldRunTruckSequence =
          activeMapId === 'MAP_INSIDE_OF_TRUCK'
          && introState >= 0
          && introState <= 2;
        syncTruckSequenceRuntime(truckRuntimeRef.current, shouldRunTruckSequence, gbaFrameRef.current);
      }

      // Update player if loaded (handles its own input via keyboard events)
      // Skip player update when menu/dialog is open or during truck sequence to prevent movement
      const menuOpen = menuStateManager.isMenuOpen();
      const truckLocked = isTruckSequenceLocked(truckRuntimeRef.current);
      const dialogOpen = dialogIsOpenRef.current;
      if (player && playerLoadedRef.current && !warpingRef.current && !menuOpen && !truckLocked && !dialogOpen) {
        const worldManager = worldManagerRef.current;
        let preInputOnFrameTriggered = false;

        // GBA-style priority: run ON_FRAME scripts before free movement input.
        // This prevents held keys from moving the player out of scripted start positions.
        if (!storyScriptRunningRef.current && worldManager && !doorSequencer.isActive()) {
          const currentMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
          if (currentMap) {
            const currentMapId = currentMap.entry.id;
            const cachedData = mapScriptCacheRef.current.get(currentMapId);

            if (cachedData === undefined && !mapScriptLoadingRef.current.has(currentMapId)) {
              mapScriptLoadingRef.current.add(currentMapId);
              void getMapScripts(currentMapId).then((data) => {
                mapScriptCacheRef.current.set(currentMapId, data);
                mapScriptLoadingRef.current.delete(currentMapId);
              });
            }

            if (cachedData?.mapScripts.onFrame) {
              for (const entry of cachedData.mapScripts.onFrame) {
                const currentVarValue = gameVariables.getVar(entry.var);
                if (currentVarValue === entry.value) {
                  // Check if suppressed at this exact value
                  const suppressedValue = onFrameSuppressedRef.current.get(entry.script);
                  if (suppressedValue === entry.value) continue;
                  console.log(`[ON_FRAME] Triggered: map=${currentMapId} script=${entry.script} var=${entry.var} value=${entry.value}`);
                  // Suppress until var changes or warp occurs (prevents loops from unimplemented cmds)
                  onFrameSuppressedRef.current.set(entry.script, entry.value);
                  preInputOnFrameTriggered = true;
                  void runHandledStoryScriptRef.current(entry.script, currentMapId);
                  break;
                } else {
                  // Var no longer matches — un-suppress so it can fire again if var returns to this value
                  onFrameSuppressedRef.current.delete(entry.script);
                }
              }
            }

            // Safety net for Route 101 intro: run ON_FRAME hide-map-name script immediately
            // if script cache is not ready yet. This matches the C on-frame gate at map entry
            // and prevents missing the first coord trigger tile while cache loads.
            if (!preInputOnFrameTriggered && currentMapId === 'MAP_ROUTE101') {
              const route101State = gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE);
              if (route101State === 0) {
                preInputOnFrameTriggered = true;
                void runHandledStoryScriptRef.current('Route101_EventScript_HideMapNamePopup', currentMapId);
              }
            }

            // Safety net for the truck exit cutscene if ON_FRAME data is not cached yet.
            if (!preInputOnFrameTriggered && currentMapId === 'MAP_LITTLEROOT_TOWN') {
              const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
              if (introState === 1 || introState === 2) {
                preInputOnFrameTriggered = true;
                void runHandledStoryScriptRef.current(
                  introState === 1
                    ? 'LittlerootTown_EventScript_StepOffTruckMale'
                    : 'LittlerootTown_EventScript_StepOffTruckFemale',
                  currentMapId
                );
              }
            }
          }
        }

        if (!preInputOnFrameTriggered) {
          player.update(dt);
        }

        // Update world manager with player position and direction (triggers dynamic map loading)
          if (worldManager) {
            // Get player's current facing direction for predictive tileset loading
            const playerDirection = player.getFacingDirection();
            const lastWorldUpdate = lastWorldUpdateRef.current;
            if (
              !lastWorldUpdate
              || lastWorldUpdate.tileX !== player.tileX
              || lastWorldUpdate.tileY !== player.tileY
              || lastWorldUpdate.direction !== playerDirection
            ) {
              void worldManager.update(player.tileX, player.tileY, playerDirection);
              lastWorldUpdateRef.current = {
                tileX: player.tileX,
                tileY: player.tileY,
                direction: playerDirection,
              };
            }

          const currentMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
          if (currentMap) {
            const tileChanged =
              !lastCoordTriggerTileRef.current ||
              lastCoordTriggerTileRef.current.mapId !== currentMap.entry.id ||
              lastCoordTriggerTileRef.current.x !== player.tileX ||
              lastCoordTriggerTileRef.current.y !== player.tileY;

            if (tileChanged) {
              const previousMapId = lastPlayerMapIdRef.current;
              if (previousMapId !== currentMap.entry.id) {
                const seamTransition =
                  (previousMapId === 'MAP_LITTLEROOT_TOWN' && currentMap.entry.id === 'MAP_ROUTE101')
                  || (previousMapId === 'MAP_ROUTE101' && currentMap.entry.id === 'MAP_LITTLEROOT_TOWN');
                if (seamTransition) {
                  const snapshot = worldSnapshotRef.current;
                  const localX = player.tileX - currentMap.offsetX;
                  const localY = player.tileY - currentMap.offsetY;
                  const cameraPos = cameraRef.current?.getPosition();
                  const bounds = worldBoundsRef.current;
                  const seamMaps = (snapshot?.maps ?? [])
                    .filter((m) => m.entry.id === 'MAP_LITTLEROOT_TOWN' || m.entry.id === 'MAP_ROUTE101')
                    .map((m) => `${m.entry.id}@(${m.offsetX},${m.offsetY})`)
                    .join(' | ');
                  console.log(
                    `[SEAM] map transition ${previousMapId} -> ${currentMap.entry.id} `
                    + `world=(${player.tileX},${player.tileY}) local=(${localX},${localY}) `
                    + `camera=(${cameraPos ? `${cameraPos.x.toFixed(1)},${cameraPos.y.toFixed(1)}` : 'n/a'}) `
                    + `bounds=(${bounds.minX},${bounds.minY},${bounds.width}x${bounds.height}) `
                    + `anchor=${snapshot?.anchorMapId ?? 'unknown'} `
                    + `loaded=${snapshot?.maps.map((m) => m.entry.id).join(',') ?? 'none'} `
                    + `seamOffsets=${seamMaps || 'missing'}`
                  );
                }
              }
              lastPlayerMapIdRef.current = currentMap.entry.id;

              const canProcessCoordEvents =
                !storyScriptRunningRef.current
                && !dialogIsOpenRef.current
                && !warpingRef.current
                && !doorSequencer.isActive();

              if (canProcessCoordEvents) {
                const playerElevation = player.getCurrentElevation();
                const coordEventsAtTile = currentMap.coordEvents.filter((coordEvent) => {
                  const eventWorldX = currentMap.offsetX + coordEvent.x;
                  const eventWorldY = currentMap.offsetY + coordEvent.y;
                  if (eventWorldX !== player.tileX || eventWorldY !== player.tileY) {
                    return false;
                  }

                  const eventElevation = coordEvent.elevation;
                  return (
                    playerElevation === 0
                    || playerElevation === 15
                    || eventElevation === 0
                    || eventElevation === 15
                    || eventElevation === playerElevation
                  );
                });

                let firedCoordEvent = false;
                for (const coordEvent of coordEventsAtTile) {
                  if (!shouldRunCoordEvent(coordEvent.var, coordEvent.varValue)) {
                    continue;
                  }

                  console.log(`[CoordEvent] Firing: ${coordEvent.script} at (${coordEvent.x},${coordEvent.y}) var=${coordEvent.var}=${coordEvent.varValue}`);
                  void runHandledStoryScriptRef.current(coordEvent.script, currentMap.entry.id);
                  firedCoordEvent = true;
                  break;
                }

                const pendingRescueEvents = coordEventsAtTile.filter(
                  (coordEvent) => coordEvent.script === 'Route101_EventScript_StartBirchRescue'
                );
                if (!firedCoordEvent && pendingRescueEvents.length > 0) {
                  const pendingStates = pendingRescueEvents
                    .map(
                      (coordEvent) =>
                        `${coordEvent.var} current=${gameVariables.getVar(coordEvent.var)} required=${coordEvent.varValue}`
                    )
                    .join(' | ');
                  console.log(
                    `[CoordEvent] Pending Route101 rescue at (${player.tileX},${player.tileY}): ${pendingStates}`
                  );
                }

                // Consume this tile only if there are no coord events here, or one fired.
                // If events exist but vars are not ready yet (e.g. pending ON_FRAME setvar),
                // leave tile "pending" so we retry next frame without requiring movement.
                if (firedCoordEvent || coordEventsAtTile.length === 0) {
                  lastCoordTriggerTileRef.current = {
                    mapId: currentMap.entry.id,
                    x: player.tileX,
                    y: player.tileY,
                  };
                }
              }
            }

            // Data-driven ON_FRAME table: check generated mapScripts.onFrame entries
            // Skip if pre-input ON_FRAME already triggered this frame (prevents double-fire for sync scripts)
            if (!preInputOnFrameTriggered && !storyScriptRunningRef.current && !dialogIsOpenRef.current && !warpingRef.current && !doorSequencer.isActive()) {
              const currentMapId = currentMap.entry.id;

              // Load map script data (async, cached after first load)
              const cachedData = mapScriptCacheRef.current.get(currentMapId);
              if (cachedData === undefined && !mapScriptLoadingRef.current.has(currentMapId)) {
                mapScriptLoadingRef.current.add(currentMapId);
                void getMapScripts(currentMapId).then((data) => {
                  mapScriptCacheRef.current.set(currentMapId, data);
                  mapScriptLoadingRef.current.delete(currentMapId);
                });
              }

              if (cachedData) {
                const onFrameEntries = cachedData.mapScripts.onFrame;
                if (onFrameEntries) {
                  for (const entry of onFrameEntries) {
                    const currentVarValue = gameVariables.getVar(entry.var);
                    if (currentVarValue === entry.value) {
                      const suppressedValue = onFrameSuppressedRef.current.get(entry.script);
                      if (suppressedValue === entry.value) continue;
                      onFrameSuppressedRef.current.set(entry.script, entry.value);
                      void runHandledStoryScriptRef.current(entry.script, currentMapId);
                      break;
                    } else {
                      onFrameSuppressedRef.current.delete(entry.script);
                    }
                  }
                }
              }

              // Clock is triggered by player pressing A on the clock tile (bg_event),
              // handled via onTileInteract in useActionInput above.
            }
          }

          // Update debug info every ~500ms while debug panel is enabled
          if (debugOptionsRef.current.enabled && gbaFrameRef.current % 30 === 0) {
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
            const suppressWarpChecks =
              storyScriptRunningRef.current
              || dialogIsOpenRef.current
              || pendingScriptedWarpRef.current !== null;
            if (renderContext && !suppressWarpChecks) {
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
                console.log(`[WARP] autoDoorWarp at tile(${player.tileX},${player.tileY}) map=${warpResult.currentTile?.mapId} dest=${JSON.stringify(action.trigger)}`);
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
                console.log(`[WARP] walkOverWarp at tile(${player.tileX},${player.tileY}) map=${warpResult.currentTile?.mapId} dest=${JSON.stringify(action.trigger)}`);
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
          shouldUnlockInput: () =>
            !storyScriptRunningRef.current
            && !warpingRef.current
            && !dialogIsOpenRef.current,
          onExecuteWarp: (trigger) => {
            // CRITICAL: Set warpingRef to prevent worldManager.update() during warp
            warpingRef.current = true;
            void performWarp(trigger, { force: true, fromDoor: true });
          },
        };

        runDoorEntryUpdate(doorDeps, nowTime);
        runDoorExitUpdate(doorDeps, nowTime);
      }

      // Handle scripted (warpsilent-style) warps from story scripts.
      const scriptedWarp = pendingScriptedWarpRef.current;
      if (warpingRef.current && scriptedWarp) {
        const fade = fadeControllerRef.current;
        if (scriptedWarp.phase === 'pending') {
          // Start fade-out if no fade is running, OR if a previous fade already completed
          const fadeReady = !fade.isActive() || fade.isComplete(nowTime);
          if (fadeReady) {
            console.log(`[ScriptedWarp] pending → fading (fadeOut to ${scriptedWarp.mapId})`);
            fade.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
            scriptedWarp.phase = 'fading';
            pendingScriptedWarpRef.current = scriptedWarp;
          }
        } else if (
          scriptedWarp.phase === 'fading'
          && fade.getDirection() === 'out'
          && fade.isComplete(nowTime)
        ) {
          const activePlayer = playerRef.current;
          const activeMapId = activePlayer
            ? worldManagerRef.current?.findMapAtPosition(activePlayer.tileX, activePlayer.tileY)?.entry.id ?? null
            : null;

          console.log(`[ScriptedWarp] fade complete. activeMapId=${activeMapId} targetMapId=${scriptedWarp.mapId}`);
          if (activePlayer && activeMapId === scriptedWarp.mapId) {
            const currentMap = worldManagerRef.current?.findMapAtPosition(activePlayer.tileX, activePlayer.tileY);
            const targetWorldX = currentMap ? currentMap.offsetX + scriptedWarp.x : scriptedWarp.x;
            const targetWorldY = currentMap ? currentMap.offsetY + scriptedWarp.y : scriptedWarp.y;
            console.log(`[ScriptedWarp] same map reposition to local=(${scriptedWarp.x},${scriptedWarp.y}) world=(${targetWorldX},${targetWorldY})`);
            activePlayer.setPosition(targetWorldX, targetWorldY);
            activePlayer.dir = scriptedWarp.direction;
            fade.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
            pendingScriptedWarpRef.current = null;
            warpingRef.current = false;
            warpHandlerRef.current.updateLastCheckedTile(targetWorldX, targetWorldY, scriptedWarp.mapId);
            setTimeout(() => {
              if (!warpingRef.current && !storyScriptRunningRef.current && !dialogIsOpenRef.current) {
                activePlayer.unlockInput();
              }
            }, FADE_TIMING.DEFAULT_DURATION_MS);
          } else {
            console.log(`[ScriptedWarp] different map → loading ${scriptedWarp.mapId}`);
            scriptedWarp.phase = 'loading';
            pendingScriptedWarpRef.current = scriptedWarp;
            selectMapForLoad(scriptedWarp.mapId);
          }
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
                if (!warpingRef.current && !storyScriptRunningRef.current && !dialogIsOpenRef.current) {
                  player.unlockInput();
                }
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

      // Read current viewport size from ref (avoids stale closure)
      const viewportWidth = viewportPixelSizeRef.current.width;
      const viewportHeight = viewportPixelSizeRef.current.height;

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

        // Truck sequence: execute metatile swaps, camera panning, and moving-box offsets.
        applyTruckSequenceFrame({
          runtime: truckRuntimeRef.current,
          gbaFrame: gbaFrameRef.current,
          view,
          objectEventManager: objectEventManagerRef.current,
          setMapMetatileLocal,
          invalidateMap: () => pipeline.invalidate(),
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

            // Get visible NPCs, script objects, items, and large objects for rendering
            const npcs = objectEventManagerRef.current.getVisibleNPCs();
            const items = objectEventManagerRef.current.getVisibleItemBalls();
            const scriptObjects = objectEventManagerRef.current.getVisibleScriptObjects();
            const largeObjects = objectEventManagerRef.current.getVisibleLargeObjects();
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
              items,
              scriptObjects,
              largeObjects,
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

            // Collect priority debug info if debug panel is enabled (throttled to ~10fps)
            if (debugOptionsRef.current.enabled && player && gbaFrameRef.current % 6 === 0) {
              setPriorityDebugInfo(buildPriorityDebugInfo({
                player,
                allSprites,
                lowPrioritySprites,
                priority0Sprites,
              }));
            }

        // Use extracted compositing function for GBA-accurate layer ordering
        const webglCanvas = webglCanvasRef.current;
        if (webglCanvas) {
          // Fade barrier: keep screen fully black while warping to prevent
          // flashing the new map before transition scripts have finished.
          const fade = fadeControllerRef.current;
          let fadeAlpha = fade.isActive() ? fade.getAlpha(nowTime) : 0;
          if (warpingRef.current && fadeAlpha < 1.0) {
            // During warp, if fade-out is complete or fade-in hasn't progressed,
            // keep the screen black until warp finishes.
            const pendingScriptedWarp = pendingScriptedWarpRef.current;
            if (pendingScriptedWarp && pendingScriptedWarp.phase !== 'pending') {
              fadeAlpha = 1.0;
            }
          }

          // Scanline intensity: 1.0 when menu is open, 0.0 otherwise
          const scanlineIntensity = menuStateManager.isMenuOpen() ? 1.0 : 0.0;

          compositeWebGLFrame(
            {
              pipeline,
              spriteRenderer,
              fadeRenderer: fadeRendererRef.current,
              scanlineRenderer: scanlineRendererRef.current,
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
            { fadeAlpha, scanlineIntensity, zoom: zoomRef.current }
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
      displayCtx2dRef.current = null;
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
      spriteRendererRef.current?.dispose();
      spriteRendererRef.current = null;
      fadeRendererRef.current?.dispose();
      fadeRendererRef.current = null;
      scanlineRendererRef.current?.dispose();
      scanlineRendererRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerLoadedRef.current = false;
      playerSpritesLoadPromiseRef.current = null;
      fieldSpritesLoadPromiseRef.current = null;
      lastWorldUpdateRef.current = null;
      renderContextCacheRef.current = null;
      worldManagerRef.current?.dispose();
      worldManagerRef.current = null;
    };
  }, []);

  // Defer heavyweight sprite/field loading until gameplay actually enters OVERWORLD.
  useEffect(() => {
    if (currentState !== GameState.OVERWORLD || !overworldEntryReady) return;
    ensureOverworldRuntimeAssetsRef.current();
  }, [currentState, overworldEntryReady]);

  useStateMachineRenderLoop({
    currentState,
    stateManager,
    zoom,
    stateCanvasRef,
    viewportPixelSizeRef,
  });

  useOverworldContinueLocation({
    currentState,
    stateManager,
    selectedMapId,
    setSelectedMapId: selectMapForLoad,
    setOverworldEntryReady,
    pendingSavedLocationRef,
  });

  // Load selected map assets and configure pipeline when in OVERWORLD state.
  useEffect(() => {
    if (currentState !== GameState.OVERWORLD || !overworldEntryReady) return;

    const entry = selectedMap;
    const pipeline = pipelineRef.current;
    if (!entry || !pipeline) return;

    ensureOverworldRuntimeAssetsRef.current();
    return loadSelectedOverworldMap({
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
      mapScriptCacheRef,
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
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedMap,
    currentState,
    overworldEntryReady,
    // NOTE: viewportTilesWide/viewportTilesHigh intentionally excluded.
    // Viewport changes are handled by the camera.updateConfig() effect below.
    // Including them here would tear down + reload the entire map on resize.
    initializeWorldFromSnapshot,
    createSnapshotTileResolver,
    createSnapshotPlayerTileResolver,
    loadObjectEventsFromSnapshot,
    applyStoryTransitionObjectParity,
  ]);

  // Update camera controller when viewport config changes
  useEffect(() => {
    const camera = cameraRef.current;
    if (camera) {
      camera.updateConfig({
        viewportTilesWide: viewportConfig.tilesWide,
        viewportTilesHigh: viewportConfig.tilesHigh,
      });
    }
  }, [viewportConfig]);

  if (!selectedMap) {
    return (
      <div className="game-page">
        <h1>Pkmn RSE Browser</h1>
        <p>No maps available.</p>
      </div>
    );
  }

  // Get current location state for saving
  const getLocationState = useCallback((): LocationState | null => {
    const player = playerRef.current;
    if (!player || !playerLoadedRef.current) return null;

    const worldManager = worldManagerRef.current;
    const mapInstance = worldManager?.findMapAtPosition(player.tileX, player.tileY) ?? null;
    const mapId = mapInstance?.entry.id ?? mapDebugInfo?.currentMap ?? selectedMap.id;
    const localX = mapInstance ? player.tileX - mapInstance.offsetX : player.tileX;
    const localY = mapInstance ? player.tileY - mapInstance.offsetY : player.tileY;

    return {
      pos: { x: localX, y: localY },
      location: { mapId, warpId: 0, x: localX, y: localY },
      continueGameWarp: { mapId, warpId: 0, x: localX, y: localY },
      lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      direction: player.getFacingDirection(),
      elevation: player.getElevation(),
      isSurfing: player.isSurfing(),
    };
  }, [mapDebugInfo?.currentMap, selectedMap.id]);

  // Handle save completion - show feedback
  const handleSaveComplete = useCallback(() => {
    gamePageLogger.info('Save completed');
  }, []);

  // Handle load completion - redirect to main menu
  const handleLoadComplete = useCallback(() => {
    gamePageLogger.info('Load completed - redirecting to main menu');
    // Close any open menus
    menuStateManager.close();
    // Transition back to main menu so user can press Continue
    // This avoids being in a weird overworld state after loading a .sav
    if (stateManager) {
      stateManager.transitionTo(GameState.MAIN_MENU);
    }
  }, [stateManager]);

  // Handle save/load errors
  const handleSaveError = useCallback((error: string) => {
    gamePageLogger.error('Save/Load error:', error);
    // Could show a toast notification here
  }, []);

  const defaultDialogViewport = {
    width: viewportPixelSize.width * zoom,
    height: viewportPixelSize.height * zoom,
  };

  return (
    <div className="game-page">
      <div className="game-header">
        <h1>Pkmn RSE Browser</h1>
        <div className="header-buttons">
          <button
            className="menu-button"
            onClick={() => {
              const player = playerRef.current;
              const truckLocked = isTruckSequenceLocked(truckRuntimeRef.current);
              const canOpen =
                currentState === GameState.OVERWORLD
                && !dialogIsOpen
                && !storyScriptRunningRef.current
                && !warpingRef.current
                && !truckLocked
                && !player?.isMoving
                && !player?.inputLocked;

              if (canOpen) {
                menuStateManager.open('start');
              }
            }}
            disabled={
              currentState !== GameState.OVERWORLD
              || dialogIsOpen
              || storyScriptRunningRef.current
              || warpingRef.current
              || isTruckSequenceLocked(truckRuntimeRef.current)
            }
            title="Open Menu (Enter)"
          >
            Menu
          </button>
          <SaveLoadButtons
            canSave={currentState === GameState.OVERWORLD && playerLoadedRef.current}
            getLocationState={getLocationState}
            onSave={handleSaveComplete}
            onLoad={handleLoadComplete}
            onError={handleSaveError}
          />
        </div>
      </div>
      {stats.error && <div style={{ marginBottom: 8, color: '#ff6666' }}>Error: {stats.error}</div>}

      <div className="map-card">
        <div className="map-canvas-wrapper">
          <div style={{ position: 'relative' }}>
            {/* WebGL canvas for overworld rendering */}
            <canvas
              ref={displayCanvasRef}
              className="game-canvas"
              style={{
                width: viewportPixelSize.width * zoom,
                height: viewportPixelSize.height * zoom,
                imageRendering: 'pixelated',
                display: currentState === GameState.OVERWORLD ? 'block' : 'none',
              }}
            />
            {/* 2D canvas for state machine rendering (title screen, menus) */}
            <canvas
              ref={stateCanvasRef}
              className="game-canvas"
              width={viewportPixelSize.width}
              height={viewportPixelSize.height}
              style={{
                width: viewportPixelSize.width * zoom,
                height: viewportPixelSize.height * zoom,
                imageRendering: 'pixelated',
                display: currentState !== GameState.OVERWORLD ? 'block' : 'none',
              }}
            />
            {/* Dialog box overlay - positioned within viewport */}
            <DialogBox
              viewportWidth={defaultDialogViewport.width}
              viewportHeight={defaultDialogViewport.height}
            />
            {/* Menu overlay */}
            <MenuOverlay />
          </div>
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
        selectedMapId={displayMapId}
        onMapChange={selectMapForLoad}
        mapLoading={loading}
        viewportConfig={viewportConfig}
        onViewportChange={onViewportChange}
      />
    </div>
  );
}

export default GamePage;
