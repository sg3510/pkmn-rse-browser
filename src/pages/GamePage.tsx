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
import { inputMap, GameButton } from '../core/InputMap';
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
import { WebGLOrbEffectRenderer } from '../rendering/webgl/WebGLOrbEffectRenderer';
import { uploadTilesetsFromSnapshot } from '../rendering/webgl/TilesetUploader';
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
import { ObjectEventManager, type VisibleObjectEventSnapshot } from '../game/ObjectEventManager';
import { buildWorldCameraView } from '../game/buildWorldCameraView';
import { loadObjectEventsFromSnapshot as loadObjectEventsFromSnapshotUtil } from '../game/loadObjectEventsFromSnapshot';
import { npcSpriteCache } from '../game/npc/NPCSpriteLoader';
import { npcAnimationManager } from '../game/npc/NPCAnimationEngine';
import { objectEventAffineManager } from '../game/npc/ObjectEventAffineManager';
import { ScriptFieldEffectAnimationManager } from '../game/ScriptFieldEffectAnimationManager';
import { OrbEffectRuntime } from '../game/scriptEffects/orbEffectRuntime';
import { MirageTowerCollapseRuntime } from '../game/scriptEffects/mirageTowerCollapseRuntime';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { useNPCMovement } from '../hooks/useNPCMovement';
import type { WorldManager, WorldSnapshot } from '../game/WorldManager';
import mapIndexJson from '../data/mapIndex.json';
import type { MapIndexEntry } from '../types/maps';
import { type NPCObject, type ItemBallObject, type ObjectEventRuntimeState } from '../types/objectEvents';
import { METATILE_SIZE, loadMapLayout, loadBorderMetatiles } from '../utils/mapLoader';
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
import type { ReflectionState } from '../components/map/types';
import { WarpHandler } from '../field/WarpHandler';
import { FadeController } from '../field/FadeController';
import { type CardinalDirection } from '../field/types';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import { useLavaridgeWarpSequencer } from '../hooks/useLavaridgeWarpSequencer';
import { FallWarpArrivalSequencer } from '../game/FallWarpArrivalSequencer';
import { TransientMetatilePulseManager } from '../game/TransientMetatilePulseManager';
import { useWebGLSpriteBuilder } from '../hooks/useWebGLSpriteBuilder';
import {
  DebugPanel,
  DEFAULT_DEBUG_OPTIONS,
  isDiagnosticsEnabled,
  type DebugOptions,
  type DebugState,
  type DebugTileInfo,
  type WebGLDebugState,
  type PlayerDebugInfo,
  type ReflectionTileGridDebugInfo,
  type PriorityDebugInfo,
} from '../components/debug';
import { clearAssetCaches } from '../utils/assetLoader';
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
import { getDynamicWarpTarget } from '../game/DynamicWarp';
import { bagManager } from '../game/BagManager';
import { moneyManager } from '../game/MoneyManager';
import { ITEMS } from '../data/items';
import type { MapScriptData } from '../data/scripts/types';
import type { ScriptRuntimeServices } from '../scripting/ScriptRunner';
import type { DiveActionResolution } from '../game/fieldActions/FieldActionResolver';
import { ensureOverworldRuntimeAssets as ensureOverworldRuntimeAssetsUtil } from './gamePage/overworldAssets';
import { executeDiveFieldAction } from '../game/dive/executeDiveFieldAction';
import { buildWebGLDebugState } from '../components/debug/buildWebGLDebugState';
import { buildDebugState } from '../components/debug/buildDebugState';
import { useStateMachineRenderLoop } from './gamePage/useStateMachineRenderLoop';
import { useOverworldContinueLocation, type OverworldEntryReason } from './gamePage/useOverworldContinueLocation';
import { performWarpTransition } from '../game/overworld/warp/performWarpTransition';
import { loadSelectedOverworldMap } from '../game/overworld/load/loadSelectedOverworldMap';
import { useHandledStoryScript } from './gamePage/useHandledStoryScript';
import { setMapMetatileInSnapshot, createMetatileUpdater } from '../game/overworld/metatile/mapMetatileUtils';
import type { InputUnlockGuards } from '../game/overworld/inputLock/scheduleInputUnlock';
import { applyTruckOnLoadMetatileCompatibility } from '../game/overworld/load/storyCompatibility';
import { createNPCMovementProviders } from './gamePage/npcMovementProviders';
import { useDebugTileGrid } from './gamePage/useDebugTileGrid';
import { createScriptRuntimeServices } from '../scripting/runtime/createScriptRuntimeServices';
import { renderOverworldSprites } from '../rendering/overworld/renderOverworldSprites';
import {
  evaluateOnFrameScripts,
  evaluateOnFrameSafetyNets,
  runStepCallbacks,
  checkWarpTriggers,
  advanceWarpSequences,
  handleWorldUpdateAndEvents,
  updateRenderStats,
  type PendingScriptedWarp,
  type ScriptedWarpLoadMonitor,
  type FrameCounter,
} from './gamePage/overworldGameUpdate';
import { createRotatingGateCollisionChecker } from './gamePage/collisionChecker';
import { executeSeamTransitionScripts } from '../game/overworld/seam/seamTransitionScripts';
import { createActionCallbacks } from './gamePage/actionCallbacks';
import {
  applyTruckSequenceFrame,
  createTruckSequenceRuntime,
  isTruckSequenceLocked,
  syncTruckSequenceRuntime,
} from '../game/TruckSequenceRunner';
import { rotatingGateManager } from '../game/RotatingGateManager';
import { WeatherManager } from '../weather/WeatherManager';
import {
  beginRuntimePerfFrame,
  endRuntimePerfFrame,
  incrementRuntimePerfCounter,
  recordRuntimePerfSection,
} from '../game/perf/runtimePerfRecorder';
import { useIsTouchMobile } from '../hooks/useIsTouchMobile';
import { useVirtualKeyboardBridge } from '../hooks/useVirtualKeyboardBridge';
import { MobileControlDeck } from '../components/controls/MobileControlDeck';
import './GamePage.css';

const gamePageLogger = createLogger('GamePage');
const POKEEMERALD_ASSET_ROOT = '/pokeemerald';

interface LayoutCatalogEntry {
  id: string;
  width: number;
  height: number;
  blockdata_filepath: string;
  border_filepath: string;
}

interface LayoutCatalogJson {
  layouts?: LayoutCatalogEntry[];
}

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
const EMPTY_WEBGL_DEBUG_STATE: WebGLDebugState = {
  mapStitching: null,
  warp: null,
  renderStats: null,
  truck: null,
  shimmer: null,
  reflectionTileGrid: null,
  priority: null,
};
const EMPTY_DEBUG_STATE: DebugState = {
  player: null,
  tile: null,
  objectsAtPlayerTile: null,
  objectsAtFacingTile: null,
  adjacentObjects: null,
  allVisibleNPCs: [],
  allVisibleItems: [],
  totalNPCCount: 0,
  totalItemCount: 0,
  fade: null,
  allNPCs: [],
  offscreenDespawnedNpcIds: [],
};
const LOCAL_MAP_SCRIPT_CACHE_MAX_ENTRIES = 32;
const MOBILE_MIN_VIEWPORT_TILES_WIDE = 14;
const MOBILE_MAX_VIEWPORT_TILES_WIDE = 42;
const MOBILE_MIN_VIEWPORT_TILES_HIGH = 12;
const MOBILE_MAX_VIEWPORT_TILES_HIGH = 30;
const MOBILE_MIN_SCREEN_ASPECT = 0.75;
const MOBILE_MAX_SCREEN_ASPECT = 2.1;
const MOBILE_MIN_VIEWPORT_ASPECT = 1.0;
const MOBILE_MAX_VIEWPORT_ASPECT = 16 / 9;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

/**
 * GamePage wrapper - provides DialogProvider context and state machine
 */
export function GamePage() {
  const [zoom, setZoom] = useState(2); // Default to 2x zoom for better visibility
  const [currentState, setCurrentState] = useState<GameState>(GameState.TITLE_SCREEN);
  const isTouchMobile = useIsTouchMobile();
  // Viewport configuration - can be changed via debug panel
  const [viewportConfig, setViewportConfig] = useState<ViewportConfig>(DEFAULT_VIEWPORT_CONFIG);
  // Use state instead of ref so child re-renders when manager is ready
  const [stateManager, setStateManager] = useState<GameStateManager | null>(null);
  const [windowMetrics, setWindowMetrics] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateWindowMetrics = () => {
      setWindowMetrics({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const viewport = window.visualViewport;
    window.addEventListener('resize', updateWindowMetrics);
    window.addEventListener('orientationchange', updateWindowMetrics);
    viewport?.addEventListener('resize', updateWindowMetrics);

    return () => {
      window.removeEventListener('resize', updateWindowMetrics);
      window.removeEventListener('orientationchange', updateWindowMetrics);
      viewport?.removeEventListener('resize', updateWindowMetrics);
    };
  }, []);

  const mobileLayout = useMemo(() => {
    const isLandscape = windowMetrics.width > windowMetrics.height;
    // Reserve shell + controls area before fitting viewport.
    const horizontalReservePx = isLandscape ? 360 : 72;
    const verticalReservePx = isLandscape ? 32 : 290;
    const fitWidth = Math.max(180, windowMetrics.width - horizontalReservePx);
    const fitHeight = Math.max(180, windowMetrics.height - verticalReservePx);

    const screenAspect = windowMetrics.width / Math.max(1, windowMetrics.height);
    const aspectLerp = clampNumber(
      (screenAspect - MOBILE_MIN_SCREEN_ASPECT) / (MOBILE_MAX_SCREEN_ASPECT - MOBILE_MIN_SCREEN_ASPECT),
      0,
      1
    );
    // Smoothly shift viewport shape from square-ish to cinema-like as the screen gets wider.
    const targetViewportAspect = lerp(MOBILE_MIN_VIEWPORT_ASPECT, MOBILE_MAX_VIEWPORT_ASPECT, aspectLerp);

    const maxScreenAxis = Math.max(windowMetrics.width, windowMetrics.height);
    const targetZoom = clampNumber(1.9 + ((maxScreenAxis - 640) / 900) * 0.8, 1.8, 2.7);

    const maxTilesWideAtTargetZoom = Math.max(
      MOBILE_MIN_VIEWPORT_TILES_WIDE,
      Math.floor(fitWidth / (METATILE_SIZE * targetZoom))
    );
    const maxTilesHighAtTargetZoom = Math.max(
      MOBILE_MIN_VIEWPORT_TILES_HIGH,
      Math.floor(fitHeight / (METATILE_SIZE * targetZoom))
    );

    let tilesHigh = clampNumber(
      maxTilesHighAtTargetZoom,
      MOBILE_MIN_VIEWPORT_TILES_HIGH,
      MOBILE_MAX_VIEWPORT_TILES_HIGH
    );
    let tilesWide = Math.round(tilesHigh * targetViewportAspect);

    if (tilesWide > maxTilesWideAtTargetZoom) {
      tilesWide = maxTilesWideAtTargetZoom;
      tilesHigh = Math.round(tilesWide / targetViewportAspect);
    }

    tilesWide = clampNumber(tilesWide, MOBILE_MIN_VIEWPORT_TILES_WIDE, MOBILE_MAX_VIEWPORT_TILES_WIDE);
    tilesHigh = clampNumber(tilesHigh, MOBILE_MIN_VIEWPORT_TILES_HIGH, MOBILE_MAX_VIEWPORT_TILES_HIGH);

    const viewportWidthPx = tilesWide * METATILE_SIZE;
    const viewportHeightPx = tilesHigh * METATILE_SIZE;
    const fitZoom = Math.min(fitWidth / viewportWidthPx, fitHeight / viewportHeightPx);
    const zoomForViewport = clampNumber(fitZoom, 0.3, 2.8);

    return {
      viewportConfig: {
        tilesWide,
        tilesHigh,
      } satisfies ViewportConfig,
      zoom: zoomForViewport,
    };
  }, [windowMetrics.height, windowMetrics.width]);

  const activeViewportConfig = isTouchMobile ? mobileLayout.viewportConfig : viewportConfig;

  // Initialize state manager once
  useEffect(() => {
    const manager = new GameStateManager({
      initialState: GameState.TITLE_SCREEN,
      viewport: isTouchMobile ? mobileLayout.viewportConfig : viewportConfig,
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
  }, []); // Only initialize once - viewport changes handled separately

  // Update state manager when viewport changes (without resetting state)
  useEffect(() => {
    if (stateManager) {
      stateManager.setViewport(activeViewportConfig);
    }
  }, [activeViewportConfig, stateManager]);

  // Compute viewport pixel size for responsive menus
  const viewportPixelSize = getViewportPixelSize(activeViewportConfig);
  const activeZoom = isTouchMobile ? mobileLayout.zoom : zoom;

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
    <DialogProvider zoom={activeZoom} viewport={viewportPixelSize} config={dialogConfig}>
      <GamePageContent
        zoom={activeZoom}
        onZoomChange={setZoom}
        currentState={currentState}
        stateManager={stateManager}
        viewportConfig={activeViewportConfig}
        onViewportChange={isTouchMobile ? undefined : setViewportConfig}
        isTouchMobile={isTouchMobile}
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
  onViewportChange?: (config: ViewportConfig) => void;
  isTouchMobile: boolean;
}

/**
 * GamePageContent - main game rendering and logic
 */
function GamePageContent({ zoom, onZoomChange, currentState, stateManager, viewportConfig, onViewportChange, isTouchMobile }: GamePageContentProps) {
  const { pressButton, releasePointer, releaseAll } = useVirtualKeyboardBridge();

  // Compute viewport dimensions from config
  const viewportTilesWide = viewportConfig.tilesWide;
  const viewportTilesHigh = viewportConfig.tilesHigh;
  const viewportPixelSize = useMemo(() => getViewportPixelSize(viewportConfig), [viewportConfig]);

  // Ref to store current viewport size for render loop (avoids stale closure)
  const viewportPixelSizeRef = useRef(viewportPixelSize);
  viewportPixelSizeRef.current = viewportPixelSize;
  const viewportTilesRef = useRef({ tilesWide: viewportTilesWide, tilesHigh: viewportTilesHigh });
  viewportTilesRef.current = { tilesWide: viewportTilesWide, tilesHigh: viewportTilesHigh };

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

  // Debug tile refs
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const bottomLayerCanvasRef = useRef<HTMLCanvasElement>(null);
  const topLayerCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeLayerCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugTilesRef = useRef<DebugTileInfo[]>([]);

  // Pipeline and state refs
  const pipelineRef = useRef<WebGLRenderPipeline | null>(null);
  const spriteRendererRef = useRef<WebGLSpriteRenderer | null>(null);
  const fadeRendererRef = useRef<WebGLFadeRenderer | null>(null);
  const scanlineRendererRef = useRef<WebGLScanlineRenderer | null>(null);
  const orbEffectRendererRef = useRef<WebGLOrbEffectRenderer | null>(null);
  const stitchedWorldRef = useRef<StitchedWorldData | null>(null);
  const worldManagerRef = useRef<WorldManager | null>(null);
  const worldSnapshotRef = useRef<WorldSnapshot | null>(null);
  const renderContextCacheRef = useRef<{ snapshot: WorldSnapshot; context: RenderContext | null } | null>(null);
  const worldBoundsRef = useRef<{ width: number; height: number; minX: number; minY: number }>({ width: 0, height: 0, minX: 0, minY: 0 });
  const rafRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraController | null>(null);
  const scriptedCameraStateRef = useRef<{
    active: boolean;
    focusX: number;
    focusY: number;
  }>({
    active: false,
    focusX: 0,
    focusY: 0,
  });
  const scriptedCameraMoveTokenRef = useRef(0);
  const scriptedCameraShakeTokenRef = useRef(0);
  const scriptedCameraTargetRef = useRef({
    getCameraFocus: () => ({
      x: scriptedCameraStateRef.current.focusX,
      y: scriptedCameraStateRef.current.focusY,
    }),
  });
  const activeScriptFieldEffectsRef = useRef<Map<string, Set<Promise<void>>>>(new Map());
  const orbEffectRuntimeRef = useRef<OrbEffectRuntime>(new OrbEffectRuntime());
  const mirageTowerCollapseRuntimeRef = useRef<MirageTowerCollapseRuntime>(
    new MirageTowerCollapseRuntime()
  );
  const scriptFieldEffectAnimationManagerRef = useRef<ScriptFieldEffectAnimationManager>(
    new ScriptFieldEffectAnimationManager({
      getPlayerWorldPosition: () => {
        const player = playerRef.current;
        if (!player || !playerLoadedRef.current) return null;
        return {
          x: player.x + METATILE_SIZE / 2,
          y: player.y + METATILE_SIZE,
        };
      },
      getNpcWorldPosition: (mapId, localId) => {
        const npc = objectEventManagerRef.current.getNPCByLocalId(mapId, localId);
        if (!npc) return null;
        const subTileX = npc.subTileX ?? 0;
        const subTileY = npc.subTileY ?? 0;
        return {
          x: npc.tileX * METATILE_SIZE + subTileX + METATILE_SIZE / 2,
          y: npc.tileY * METATILE_SIZE + subTileY + METATILE_SIZE,
        };
      },
    })
  );
  const mewEmergingGrassEffectIdRef = useRef<string | null>(null);
  const deoxysRockRenderDebugRef = useRef<{
    active: boolean;
    startMs: number;
    lastLogMs: number;
  }>({
    active: false,
    startMs: 0,
    lastLogMs: 0,
  });
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
  const lavaridgeWarpSequencer = useLavaridgeWarpSequencer();
  const fallWarpArrivalSequencerRef = useRef<FallWarpArrivalSequencer>(new FallWarpArrivalSequencer());
  const transientMetatilePulseManagerRef = useRef<TransientMetatilePulseManager>(new TransientMetatilePulseManager());

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
  const pruneLocalMapScriptCache = useCallback((snapshot: WorldSnapshot): void => {
    const cache = mapScriptCacheRef.current;
    const keepMapIds = new Set(snapshot.maps.map((map) => map.entry.id));
    keepMapIds.add(snapshot.anchorMapId);

    for (const mapId of cache.keys()) {
      if (!keepMapIds.has(mapId)) {
        cache.delete(mapId);
      }
    }

    while (cache.size > LOCAL_MAP_SCRIPT_CACHE_MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      cache.delete(oldestKey);
    }
  }, []);
  const weatherManagerRef = useRef<WeatherManager>(new WeatherManager());
  const weatherDefaultsSnapshotRef = useRef<WorldSnapshot | null>(null);

  // Safety net: suppress ON_FRAME scripts that ran but didn't change their trigger var.
  // Keyed by "scriptName" → trigger value when suppressed. Only un-suppress when var changes.
  // Cleared on warp. Prevents infinite loops from unimplemented cmds.
  const onFrameSuppressedRef = useRef<Map<string, number>>(new Map());
  const seamTransitionScriptsInFlightRef = useRef<Set<string>>(new Set());

  // NPC movement hook - provides collision-aware movement updates
  const npcMovementProviders = useMemo(
    () => createNPCMovementProviders(playerRef, objectEventManagerRef),
    []
  );

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

  useEffect(() => {
    if (!isTouchMobile) {
      releaseAll();
    }
  }, [isTouchMobile, releaseAll]);

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

  const showFieldMessage = useCallback(async (text: string): Promise<void> => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return;
    activePlayer.lockInput();
    try {
      await showMessage(text);
    } finally {
      if (!warpingRef.current && !storyScriptRunningRef.current) {
        activePlayer.unlockInput();
      }
    }
  }, [showMessage]);

  const tryUseFieldItem = useCallback(async (itemId: number): Promise<boolean> => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return false;

    if (!bagManager.hasItem(itemId, 1)) {
      await showFieldMessage("There's no such item in your BAG.");
      return false;
    }

    if (itemId !== ITEMS.ITEM_MACH_BIKE && itemId !== ITEMS.ITEM_ACRO_BIKE) {
      await showFieldMessage("OAK: This isn't the time to use that!");
      return false;
    }

    const bikeMode = itemId === ITEMS.ITEM_MACH_BIKE ? 'mach' : 'acro';
    const bikeResult = activePlayer.tryUseBikeItem(bikeMode);
    if (bikeResult === 'blocked') {
      await showFieldMessage("You can't dismount your BIKE here.");
      return false;
    }
    if (bikeResult === 'forbidden') {
      await showFieldMessage("OAK: This isn't the time to use that!");
      return false;
    }

    // Keep SELECT registration synced to the bike the player just used.
    moneyManager.setRegisteredItem(itemId);
    return true;
  }, [showFieldMessage]);

  const registerFieldItem = useCallback((itemId: number): void => {
    moneyManager.setRegisteredItem(itemId);
  }, []);

  const getLocationStateForStartMenuSave = useCallback((): LocationState | null => {
    const player = playerRef.current;
    if (!player || !playerLoadedRef.current) return null;

    const worldManager = worldManagerRef.current;
    const mapInstance = worldManager?.findMapAtPosition(player.tileX, player.tileY) ?? null;
    const mapId = mapInstance?.entry.id ?? saveManager.getCurrentMapId();
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
      isUnderwater: player.isUnderwater(),
      bikeMode: player.getBikeMode(),
      isRidingBike: player.isBikeRiding(),
    };
  }, []);

  const saveToBrowserFromStartMenu = useCallback(() => {
    const locationState = getLocationStateForStartMenuSave();
    if (!locationState) {
      void showFieldMessage('Cannot save right now.');
      return;
    }

    const runtimeState = objectEventManagerRef.current.getRuntimeState();
    const result = saveManager.save(0, locationState, runtimeState);
    if (result.success) {
      gamePageLogger.info('Save completed');
      void showFieldMessage('Saved to browser.');
      return;
    }

    const error = result.error ?? 'Save failed';
    gamePageLogger.error('Save/Load error:', error);
    void showFieldMessage(`Save failed: ${error}`);
  }, [getLocationStateForStartMenuSave, showFieldMessage]);

  const openStartMenu = useCallback(() => {
    menuStateManager.open('start', {
      onFieldUseItem: tryUseFieldItem,
      onFieldRegisterItem: registerFieldItem,
      onSaveToBrowser: saveToBrowserFromStartMenu,
    });
  }, [tryUseFieldItem, registerFieldItem, saveToBrowserFromStartMenu]);

  // START/SELECT handler
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

      // START button opens menu
      if (inputMap.matchesCode(e.code, GameButton.START)) {
        e.preventDefault();
        openStartMenu();
        return;
      }

      // SELECT uses the registered key item (bike parity path).
      if (inputMap.matchesCode(e.code, GameButton.SELECT)) {
        e.preventDefault();

        void (async () => {
          const registeredItem = moneyManager.getRegisteredItem();
          if (!registeredItem || registeredItem === ITEMS.ITEM_NONE) {
            await showFieldMessage('There is no item registered.');
            return;
          }

          if (!bagManager.hasItem(registeredItem, 1)) {
            moneyManager.setRegisteredItem(ITEMS.ITEM_NONE);
            await showFieldMessage('There is no item registered.');
            return;
          }
          await tryUseFieldItem(registeredItem);
        })();
      }
    };

    window.addEventListener('keydown', handleMenuKey);
    return () => window.removeEventListener('keydown', handleMenuKey);
  }, [currentState, dialogIsOpen, showFieldMessage, openStartMenu, tryUseFieldItem]);

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
  // Incremented for every explicit map-load request so callers can force a reload
  // even when the requested map ID matches the current selectedMapId.
  const [mapLoadRequestId, setMapLoadRequestId] = useState(0);
  // Wrapper that updates both map-load state AND debug display (for user-driven map changes).
  const selectMapForLoad = useCallback((mapId: string) => {
    setSelectedMapId(mapId);
    setDisplayMapId(mapId);
    setMapLoadRequestId((id) => id + 1);
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

  // Controlled by loadSelectedOverworldMap for synchronous scripted-warp gating.
  const loadingRef = useRef(false);
  const scriptedWarpLoadMonitorRef = useRef<ScriptedWarpLoadMonitor | null>(null);

  // Ref for debug options so render loop can access current value
  const debugOptionsRef = useRef<DebugOptions>(debugOptions);
  debugOptionsRef.current = debugOptions;
  const diagnosticsEnabled = isDiagnosticsEnabled(debugOptions);

  const setDiagnosticsEnabled = useCallback((enabled: boolean) => {
    setDebugOptions((previous) => ({
      ...previous,
      diagnosticsEnabled: enabled,
      enabled,
    }));
  }, []);

  // Ref for pending saved location (set when Continue is selected, consumed on map load)
  const pendingSavedLocationRef = useRef<LocationState | null>(null);
  const pendingOverworldEntryReasonRef = useRef<OverworldEntryReason | null>(null);
  const pendingScriptedWarpRef = useRef<PendingScriptedWarp | null>(null);
  const layoutCatalogPromiseRef = useRef<Promise<Map<string, LayoutCatalogEntry>> | null>(null);

  const setMapMetatileLocal = useCallback((
    mapId: string,
    tileX: number,
    tileY: number,
    metatileId: number,
    collision?: number
  ): boolean => {
    return setMapMetatileInSnapshot(worldSnapshotRef.current, mapId, tileX, tileY, metatileId, collision);
  }, []);

  const setMapMetatileAndInvalidate = useMemo(
    () => createMetatileUpdater(setMapMetatileLocal, pipelineRef),
    [setMapMetatileLocal]
  );

  const getLayoutCatalog = useCallback(async (): Promise<Map<string, LayoutCatalogEntry>> => {
    if (!layoutCatalogPromiseRef.current) {
      layoutCatalogPromiseRef.current = (async () => {
        const response = await fetch(`${POKEEMERALD_ASSET_ROOT}/data/layouts/layouts.json`);
        if (!response.ok) {
          throw new Error(`Failed to load layouts.json (${response.status})`);
        }

        const payload = (await response.json()) as LayoutCatalogJson;
        const layouts = Array.isArray(payload.layouts) ? payload.layouts : [];
        const byId = new Map<string, LayoutCatalogEntry>();
        for (const layout of layouts) {
          if (!layout?.id) continue;
          byId.set(layout.id, layout);
        }
        return byId;
      })();
    }

    return layoutCatalogPromiseRef.current;
  }, []);

  const setCurrentMapLayoutById = useCallback(async (layoutId: string): Promise<boolean> => {
    const player = playerRef.current;
    const worldManager = worldManagerRef.current;
    const snapshot = worldSnapshotRef.current;
    if (!player || !worldManager || !snapshot) {
      return false;
    }

    const currentMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
    if (!currentMap) {
      console.warn('[setmaplayoutindex] Unable to resolve current map for layout swap.', { layoutId });
      return false;
    }

    let layoutMeta: LayoutCatalogEntry | undefined;
    try {
      const layoutCatalog = await getLayoutCatalog();
      layoutMeta = layoutCatalog.get(layoutId);
    } catch (error) {
      console.warn('[setmaplayoutindex] Failed to load layout catalog.', { layoutId, error });
      return false;
    }

    if (!layoutMeta) {
      console.warn('[setmaplayoutindex] Unknown layout ID.', { layoutId });
      return false;
    }

    if (layoutMeta.width !== currentMap.mapData.width || layoutMeta.height !== currentMap.mapData.height) {
      console.warn('[setmaplayoutindex] Layout dimension mismatch; skipping unsafe swap.', {
        mapId: currentMap.entry.id,
        layoutId,
        current: { width: currentMap.mapData.width, height: currentMap.mapData.height },
        next: { width: layoutMeta.width, height: layoutMeta.height },
      });
      return false;
    }

    const blockPath = `${POKEEMERALD_ASSET_ROOT}/${layoutMeta.blockdata_filepath.replace(/^\/+/, '')}`;
    const borderPath = `${POKEEMERALD_ASSET_ROOT}/${layoutMeta.border_filepath.replace(/^\/+/, '')}`;

    let nextLayoutData: Awaited<ReturnType<typeof loadMapLayout>>;
    let nextBorder: Awaited<ReturnType<typeof loadBorderMetatiles>>;
    try {
      [nextLayoutData, nextBorder] = await Promise.all([
        loadMapLayout(blockPath, layoutMeta.width, layoutMeta.height),
        loadBorderMetatiles(borderPath),
      ]);
    } catch (error) {
      console.warn('[setmaplayoutindex] Failed loading layout assets.', {
        layoutId,
        mapId: currentMap.entry.id,
        blockPath,
        borderPath,
        error,
      });
      return false;
    }

    currentMap.mapData.layout = nextLayoutData.layout;
    currentMap.borderMetatiles = nextBorder;
    const snapshotMap = snapshot.maps.find((map) => map.entry.id === currentMap.entry.id);
    if (snapshotMap && snapshotMap !== currentMap) {
      snapshotMap.mapData.layout = nextLayoutData.layout;
      snapshotMap.borderMetatiles = nextBorder;
    }
    if (snapshot.anchorMapId === currentMap.entry.id) {
      snapshot.anchorBorderMetatiles = nextBorder;
    }

    transientMetatilePulseManagerRef.current.clear();
    pipelineRef.current?.invalidate();
    return true;
  }, [getLayoutCatalog]);

  const inputUnlockGuards = useMemo<InputUnlockGuards>(() => ({
    warpingRef,
    storyScriptRunningRef,
    dialogIsOpenRef: dialogIsOpenRef,
  }), []);

  const applyTruckOnLoadMetatileCompatibilityLocal = useCallback((): void => {
    const changed = applyTruckOnLoadMetatileCompatibility(worldSnapshotRef.current, setMapMetatileLocal);
    if (changed) {
      pipelineRef.current?.invalidate();
    }
  }, [setMapMetatileLocal]);

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
      isUnderwater: player.isUnderwater(),
      bikeMode: player.getBikeMode(),
      isRidingBike: player.isBikeRiding(),
    };
  }, []);

  const waitScriptFrames = useCallback(async (frames: number): Promise<void> => {
    const frameCount = Math.max(0, Math.round(frames));
    if (frameCount <= 0) return;
    const delayMs = Math.max(1, Math.round(frameCount * GBA_FRAME_MS));
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }, []);

  const scriptRuntimeServices = useMemo<ScriptRuntimeServices>(
    () => createScriptRuntimeServices({
      worldSnapshotRef,
      objectEventManagerRef,
      spriteRendererRef,
      pipelineRef,
      fadeControllerRef,
      playerRef,
      cameraRef,
      scriptedCameraStateRef,
      scriptedCameraMoveTokenRef,
      scriptedCameraShakeTokenRef,
      activeScriptFieldEffectsRef,
      scriptFieldEffectAnimationManagerRef,
      orbEffectRuntimeRef,
      mirageTowerCollapseRuntimeRef,
      mewEmergingGrassEffectIdRef,
      deoxysRockRenderDebugRef,
      weatherManagerRef,
      waitScriptFrames,
    }),
    [waitScriptFrames]
  );

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
    overworldLoadingRef: loadingRef,
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    objectEventManagerRef,
    npcMovement,
    doorAnimations,
    gbaFrameRef,
    gbaFrameMs: GBA_FRAME_MS,
    setMapMetatile: setMapMetatileAndInvalidate,
    setCurrentMapLayoutById,
    scriptRuntimeServices,
    getSavedWeather: () => weatherManagerRef.current.getStateSnapshot().savedWeather,
  });

  const runHandledStoryScriptRef = useRef(runHandledStoryScript);
  runHandledStoryScriptRef.current = runHandledStoryScript;

  const handleDiveFieldAction = useCallback(async (request: DiveActionResolution): Promise<boolean> => {
    return executeDiveFieldAction({
      request,
      playerRef,
      worldSnapshotRef,
      objectEventManagerRef,
      playerHiddenRef,
      mapScriptCacheRef,
      setMapMetatileAndInvalidate,
      scriptRuntimeServices,
      pendingSavedLocationRef,
      pendingScriptedWarpRef,
      warpingRef,
      mapIndexData,
      showMessage,
    });
  }, [scriptRuntimeServices, setMapMetatileLocal, showMessage]);

  const runSeamTransitionScripts = useCallback(async (mapId: string): Promise<void> => {
    return executeSeamTransitionScripts({
      mapId,
      worldSnapshotRef,
      playerRef,
      pipelineRef,
      spriteRendererRef,
      objectEventManagerRef,
      npcSpritesLoadedRef,
      playerHiddenRef,
      mapScriptCacheRef,
      onFrameSuppressedRef,
      seamTransitionScriptsInFlightRef,
      setMapMetatile: setMapMetatileAndInvalidate,
      scriptRuntimeServices,
    });
  }, [scriptRuntimeServices, setMapMetatileLocal]);

  // Action input hook (handles X key for surf/item pickup dialogs)
  const actionCallbacks = useMemo(() => createActionCallbacks({
    playerRef,
    worldManagerRef,
    objectEventManagerRef,
    runHandledStoryScript,
    showMessage,
  }), [runHandledStoryScript, showMessage]);

  useActionInput({
    playerControllerRef: playerRef,
    objectEventManagerRef,
    worldManagerRef,
    enabled: currentState === GameState.OVERWORLD,
    dialogIsOpen,
    showMessage,
    showYesNo,
    onDiveFieldAction: handleDiveFieldAction,
    ...actionCallbacks,
  });

  // Create WebGL debug state from existing debug info
  const webglDebugState = useMemo<WebGLDebugState>(() => {
    if (!diagnosticsEnabled) {
      return EMPTY_WEBGL_DEBUG_STATE;
    }
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
    diagnosticsEnabled,
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
    if (!diagnosticsEnabled) {
      return EMPTY_DEBUG_STATE;
    }
    const npcs = visibleNPCsRef.current;
    const items = visibleItemsRef.current;
    const allNpcs = objectEventManagerRef.current.getAllNPCs();
    const objectRuntimeState = objectEventManagerRef.current.getRuntimeState();

    return buildDebugState({
      player: playerDebugInfo,
      visibleNPCs: npcs,
      allNPCs: allNpcs,
      visibleItems: items,
      totalNPCCount: allNpcs.length,
      totalItemCount: objectEventManagerRef.current.getAllItemBalls().length,
      offscreenDespawnedNpcIds: objectRuntimeState.offscreenDespawnedNpcIds,
      fade: (() => {
        const now = performance.now();
        const fadeController = fadeControllerRef.current;
        return {
          active: fadeController.isActive(),
          direction: fadeController.getDirection(),
          complete: fadeController.isComplete(now),
          alpha: fadeController.getAlpha(now),
        };
      })(),
    });
  }, [diagnosticsEnabled, playerDebugInfo]);

  // Track resolver creation for debugging
  const resolverIdRef = useRef(0);

  // Create tile resolver from WorldSnapshot using TileResolverFactory
  const createSnapshotTileResolver = useCallback((snapshot: WorldSnapshot): TileResolverFn => {
    const resolverId = ++resolverIdRef.current;
    gamePageLogger.debug(`[RESOLVER] #${resolverId} anchor:${snapshot.anchorMapId} maps:${snapshot.maps.length} pairs:${snapshot.tilesetPairs.length}`,
      snapshot.maps.map(m => m.entry.id));
    const baseResolver = TileResolverFactory.fromSnapshot(snapshot, resolverId);
    return (worldX: number, worldY: number) => {
      const pulseOverride = transientMetatilePulseManagerRef.current.resolveOverride(worldX, worldY, snapshot);
      if (pulseOverride) {
        return pulseOverride;
      }
      return baseResolver(worldX, worldY);
    };
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
  const loadObjectEventsFromSnapshot = useCallback(async (
    snapshot: WorldSnapshot,
    options?: { preserveExistingMapRuntimeState?: boolean }
  ): Promise<void> => {
    await loadObjectEventsFromSnapshotUtil({
      snapshot,
      objectEventManager: objectEventManagerRef.current,
      spriteCache: npcSpriteCache,
      spriteRenderer: spriteRendererRef.current,
      uploadedSpriteIds: npcSpritesLoadedRef.current,
      clearAnimations: () => npcAnimationManager.clear(),
      preserveExistingMapRuntimeState: options?.preserveExistingMapRuntimeState,
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
    scriptFieldEffectAnimationManagerRef.current.clear();
    orbEffectRuntimeRef.current.clear(cameraRef.current);
    mirageTowerCollapseRuntimeRef.current.clear();

    // Update snapshot ref
    worldSnapshotRef.current = snapshot;
    pruneLocalMapScriptCache(snapshot);
    renderContextCacheRef.current = null;
    weatherManagerRef.current.setMapDefaultsFromSources(
      snapshot.maps.map((map) => ({ mapId: map.entry.id, mapWeather: map.mapWeather }))
    );
    weatherDefaultsSnapshotRef.current = snapshot;
    fallWarpArrivalSequencerRef.current.reset(playerRef.current ?? undefined, cameraRef.current ?? undefined);
    transientMetatilePulseManagerRef.current.clear();

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
    applyTruckOnLoadMetatileCompatibilityLocal();
  }, [
    buildTilesetRuntimesFromSnapshot,
    createSnapshotTileResolver,
    uploadTilesetsFromSnapshot,
    loadObjectEventsFromSnapshot,
    applyTruckOnLoadMetatileCompatibilityLocal,
    pruneLocalMapScriptCache,
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

  // Debug tile grid (3x3 canvas, center tile info, copy to clipboard)
  const { getCenterTileInfo, handleCopyTileDebug } = useDebugTileGrid({
    debugOptions,
    playerDebugInfo,
    playerRef,
    worldSnapshotRef,
    cameraRef,
    viewportPixelSizeRef,
    debugCanvasRef,
    webglCanvasRef,
    debugTilesRef,
    getRenderContextFromSnapshot,
  });

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
    scriptFieldEffectAnimationManagerRef.current.clear();
    orbEffectRuntimeRef.current.clear(cameraRef.current);
    mirageTowerCollapseRuntimeRef.current.clear();

    // Clear ON_FRAME suppression — new map visit should re-evaluate frame scripts
    onFrameSuppressedRef.current.clear();
    return performWarpTransition({
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
      lavaridgeWarpSequencer,
      npcMovement,
      setWarpDebugInfo,
      resolverVersion: resolverIdRef.current,
      setLastCoordTriggerTile: (tile) => {
        lastCoordTriggerTileRef.current = tile;
        lastPlayerMapIdRef.current = tile.mapId;
      },
      warpingRef,
      resolveDynamicWarpTarget: () => getDynamicWarpTarget(),
      setMapMetatile: setMapMetatileAndInvalidate,
      mapScriptCache: mapScriptCacheRef.current,
      scriptRuntimeServices,
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
    npcMovement,
    scriptRuntimeServices,
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

      // Initialize orb effect renderer (scripted cutscene screen effects)
      const orbEffectRenderer = new WebGLOrbEffectRenderer(pipeline.getGL());
      orbEffectRenderer.initialize();
      orbEffectRendererRef.current = orbEffectRenderer;
    } catch (e) {
      // WebGL pipeline creation failed - redirect to legacy Canvas2D mode
      gamePageLogger.error('Failed to create WebGL pipeline, redirecting to legacy Canvas2D mode:', e);
      window.location.hash = '#/legacy';
      return;
    }

    // Initialize player controller
    const player = new PlayerController();
    playerRef.current = player;
    player.setDynamicCollisionChecker(
      createRotatingGateCollisionChecker(playerRef, worldManagerRef, worldSnapshotRef, rotatingGateManager)
    );
    const frameCounter: FrameCounter = { frameCount: 0, fpsTime: performance.now() };

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
      let gbaFramesAdvanced = 0;
      while (gbaAccumRef.current >= GBA_FRAME_MS) {
        gbaAccumRef.current -= GBA_FRAME_MS;
        gbaFrameRef.current++;
        gbaFramesAdvanced++;
      }
      beginRuntimePerfFrame(gbaFrameRef.current, nowTime);
      const framePerfStart = nowTime;

      // Update shimmer animation (GBA-accurate reflection distortion)
      getGlobalShimmer().update(nowTime);
      npcAnimationManager.update();
      scriptFieldEffectAnimationManagerRef.current.update(dt);
      orbEffectRuntimeRef.current.update(gbaFramesAdvanced, cameraRef.current);
      mirageTowerCollapseRuntimeRef.current.update(gbaFramesAdvanced);

      const objectSpawnDespawnStart = performance.now();
      const player = playerRef.current;
      if (player) {
        const viewportTiles = viewportTilesRef.current;
        const camera = cameraRef.current;
        if (camera && camera.getBounds()) {
          const view = camera.getView(0);
          objectEventManagerRef.current.updateObjectEventSpawnDespawnForCamera(
            view.startTileX,
            view.startTileY,
            viewportTiles.tilesWide,
            viewportTiles.tilesHigh
          );
        } else {
          objectEventManagerRef.current.updateObjectEventSpawnDespawn(
            player.tileX,
            player.tileY,
            viewportTiles.tilesWide,
            viewportTiles.tilesHigh
          );
        }
      }
      recordRuntimePerfSection('objectSpawnDespawn', performance.now() - objectSpawnDespawnStart);
      const seamTransitionScriptsRunning = seamTransitionScriptsInFlightRef.current.size > 0;
      const worldUpdateStart = performance.now();

      // Update overworld object-event affine animation state and prune stale NPC entries.
      const visibleObjectsForMovement: VisibleObjectEventSnapshot = objectEventManagerRef.current.getVisibleObjectsSnapshot();
      const visibleNpcsForFrame = visibleObjectsForMovement.npcs;
      objectEventAffineManager.syncNPCs(visibleNpcsForFrame);
      objectEventAffineManager.update(dt);

      const { width, height, minX, minY } = worldBoundsRef.current;

      // World bounds are tracked in pixel space.
      const worldMinX = minX;
      const worldMinY = minY;

      // Update warp handler cooldown
      warpHandlerRef.current.update(dt);

      // Update NPC movement (GBA-accurate wandering behavior)
      // Only update when not warping and game is active
      if (!warpingRef.current && !menuStateManager.isMenuOpen()) {
        if (visibleNpcsForFrame.length > 0) {
          npcMovement.update(dt, visibleNpcsForFrame);

          // Set NPC positions for grass effect cleanup
          if (player) {
            const npcPositions = npcMovement.getNPCOwnerPositions(visibleNpcsForFrame);
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
        if (!storyScriptRunningRef.current && !seamTransitionScriptsRunning && worldManager && !doorSequencer.isActive()) {
          const currentMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
          if (currentMap) {
            const currentMapId = currentMap.entry.id;
            const runScript = (scriptName: string, mapId: string) => void runHandledStoryScriptRef.current(scriptName, mapId);
            preInputOnFrameTriggered = evaluateOnFrameScripts({
              currentMapId,
              mapScriptCache: mapScriptCacheRef.current,
              mapScriptLoading: mapScriptLoadingRef.current,
              onFrameSuppressed: onFrameSuppressedRef.current,
              objectEventManager: objectEventManagerRef.current,
              currentMapObjectEventsLength: currentMap.objectEvents.length,
              runScript,
              gbaFrame: gbaFrameRef.current,
            });
            if (!preInputOnFrameTriggered) {
              const mapObjectsReady = currentMap.objectEvents.length === 0
                || objectEventManagerRef.current.hasMapObjects(currentMapId);
              preInputOnFrameTriggered = evaluateOnFrameSafetyNets(currentMapId, mapObjectsReady, runScript);
            }
          }
        }

        if (!preInputOnFrameTriggered && !seamTransitionScriptsRunning) {
          player.update(dt);
        }

        // Run per-step callback (Sootopolis ice, ash grass, etc.)
        if (worldManager) {
          runStepCallbacks({
            player,
            worldManager,
            storyScriptRunningRef,
            setMapMetatileLocal,
            drawMetatilePulseLocal: (mapId, localX, localY, metatileId, frames) => {
              transientMetatilePulseManagerRef.current.queueLocalPulse(
                mapId,
                localX,
                localY,
                metatileId,
                frames
              );
              pipelineRef.current?.invalidate();
            },
            pipelineRef,
            gbaFramesAdvanced,
            gbaFrame: gbaFrameRef.current,
          });
        }

        // World update, seam transitions, coord events, ON_FRAME, and debug info
        if (worldManager) {
          handleWorldUpdateAndEvents({
            player,
            worldManager,
            preInputOnFrameTriggered,
            worldSnapshotRef,
            weatherDefaultsSnapshotRef,
            weatherManagerRef,
            lastWorldUpdateRef,
            lastCoordTriggerTileRef,
            lastPlayerMapIdRef,
            cameraRef,
            worldBoundsRef,
            warpingRef,
            storyScriptRunningRef,
            dialogIsOpenRef,
            objectEventManagerRef,
            doorSequencerIsActive: doorSequencer.isActive(),
            seamTransitionScriptsInFlightRef,
            mapScriptCacheRef,
            mapScriptLoadingRef,
            onFrameSuppressedRef,
            runScript: (scriptName, mapId) => void runHandledStoryScriptRef.current(scriptName, mapId),
            runSeamTransitionScripts: (mapId) => void runSeamTransitionScripts(mapId),
            debugOptionsRef,
            gbaFrameRef,
            setMapDebugInfo,
            setPlayerDebugInfo,
            selectedMapId: selectedMap.id,
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
        checkWarpTriggers({
          player,
          snapshot,
          nowTime,
          storyScriptRunningRef,
          dialogIsOpenRef,
          pendingScriptedWarpRef,
          warpHandlerRef,
          warpingRef,
          pendingWarpRef,
          fadeControllerRef,
          getRenderContextFromSnapshot,
          doorSequencer,
          arrowOverlay,
          lavaridgeWarpSequencer,
        });
      }

      // Advance door sequences, Lavaridge warps, scripted warps, and pending warp execution
      advanceWarpSequences({
        nowTime,
        player,
        cameraRef,
        doorSequencer,
        doorAnimations,
        fadeControllerRef,
        playerHiddenRef,
        storyScriptRunningRef,
        warpingRef,
        dialogIsOpenRef,
        pendingWarpRef,
        lavaridgeWarpSequencer,
        fallWarpArrivalSequencer: fallWarpArrivalSequencerRef.current,
        pendingScriptedWarpRef,
        scriptedWarpLoadMonitorRef,
        loadingRef,
        pendingSavedLocationRef,
        warpHandlerRef,
        playerRef,
        worldManagerRef,
        inputUnlockGuards,
        selectMapForLoad,
        performWarp,
      });

      // Camera follows player (using CameraController)
      const camera = cameraRef.current;
      if (camera && player && playerLoadedRef.current) {
        // Update camera bounds (may have changed due to world updates)
        camera.setBounds({ minX: worldMinX, minY: worldMinY, width, height });
        if (scriptedCameraStateRef.current.active) {
          camera.followTarget(scriptedCameraTargetRef.current);
        } else {
          camera.followTarget(player);
        }
      }
      recordRuntimePerfSection('worldUpdate', performance.now() - worldUpdateStart);

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
          camera: cameraRef.current,
          objectEventManager: objectEventManagerRef.current,
          setMapMetatileLocal,
          invalidateMap: () => pipeline.invalidate(),
        });

        weatherManagerRef.current.update(nowTime, view);

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

        // Sprite rendering + compositing (extracted)
        const webglCanvas = webglCanvasRef.current;
        if (player && webglCanvas) {
          const visibleObjectsForRender: VisibleObjectEventSnapshot = objectEventManagerRef.current.getVisibleObjectsSnapshot();
          const spriteResult = renderOverworldSprites({
            player,
            playerLoaded: playerLoadedRef.current,
            playerHidden: playerHiddenRef.current,
            snapshot: worldSnapshotRef.current,
            view,
            nowTime,
            gbaFrame: gbaFrameRef.current,
            debugEnabled: isDiagnosticsEnabled(debugOptionsRef.current),
            spriteRenderer: spriteRendererRef.current,
            pipeline,
            fadeRenderer: fadeRendererRef.current,
            scanlineRenderer: scanlineRendererRef.current,
            ctx2d,
            webglCanvas,
            visibleNpcs: visibleObjectsForRender.npcs,
            visibleItems: visibleObjectsForRender.itemBalls,
            visibleScriptObjects: visibleObjectsForRender.scriptObjects,
            visibleLargeObjects: visibleObjectsForRender.largeObjects,
            worldManager: worldManagerRef.current,
            weatherManager: weatherManagerRef.current,
            rotatingGateManager,
            fadeController: fadeControllerRef.current,
            tilesetRuntimes: tilesetRuntimesRef.current,
            fieldSpritesLoaded: fieldSpritesLoadedRef.current,
            doorSpritesUploaded: doorSpritesUploadedRef.current,
            arrowSpriteUploaded: arrowSpriteUploadedRef.current,
            warpingRef,
            pendingScriptedWarpRef,
            deoxysRockRenderDebugRef,
            scriptFieldEffectAnimationManager: scriptFieldEffectAnimationManagerRef.current,
            orbEffectRuntime: orbEffectRuntimeRef.current,
            orbEffectRenderer: orbEffectRendererRef.current,
            mirageTowerCollapseRuntime: mirageTowerCollapseRuntimeRef.current,
            doorAnimations,
            doorSequencer,
            arrowOverlay,
            buildSprites,
            computeReflectionState: computeReflectionStateFromSnapshot,
            zoom: zoomRef.current,
          });

          // Track state from sprite result
          visibleNPCsRef.current = spriteResult.visibleNPCs;
          visibleItemsRef.current = spriteResult.visibleItems;
          for (const atlasName of spriteResult.newDoorSpritesUploaded) {
            doorSpritesUploadedRef.current.add(atlasName);
          }
          if (spriteResult.arrowSpriteWasUploaded) {
            arrowSpriteUploadedRef.current = true;
          }
          if (isDiagnosticsEnabled(debugOptionsRef.current) && spriteResult.reflectionTileGridDebug) {
            incrementRuntimePerfCounter('setStateFromRafCalls');
            setReflectionTileGridDebug(spriteResult.reflectionTileGridDebug);
          }
          if (isDiagnosticsEnabled(debugOptionsRef.current) && spriteResult.priorityDebugInfo) {
            incrementRuntimePerfCounter('setStateFromRafCalls');
            setPriorityDebugInfo(spriteResult.priorityDebugInfo);
          }
        }

        const renderStatsStart = performance.now();
        updateRenderStats({
          pipeline,
          debugEnabled: isDiagnosticsEnabled(debugOptionsRef.current),
          cameraRef,
          renderStartTime: start,
          setStats,
          setCameraDisplay,
          counter: frameCounter,
        });
        recordRuntimePerfSection('renderStats', performance.now() - renderStatsStart);
      }

      transientMetatilePulseManagerRef.current.tick(1);
      recordRuntimePerfSection('frameTotal', performance.now() - framePerfStart);
      endRuntimePerfFrame();
      rafRef.current = requestAnimationFrame(renderLoop);
    };

    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fallWarpArrivalSequencerRef.current.reset(playerRef.current ?? undefined, cameraRef.current ?? undefined);
      transientMetatilePulseManagerRef.current.clear();
      displayCtx2dRef.current = null;
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
      spriteRendererRef.current?.dispose();
      spriteRendererRef.current = null;
      fadeRendererRef.current?.dispose();
      fadeRendererRef.current = null;
      scanlineRendererRef.current?.dispose();
      scanlineRendererRef.current = null;
      orbEffectRendererRef.current?.dispose();
      orbEffectRendererRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerLoadedRef.current = false;
      playerSpritesLoadPromiseRef.current = null;
      fieldSpritesLoadPromiseRef.current = null;
      lastWorldUpdateRef.current = null;
      scriptFieldEffectAnimationManagerRef.current.clear();
      orbEffectRuntimeRef.current.clear(cameraRef.current);
      mirageTowerCollapseRuntimeRef.current.clear();
      renderContextCacheRef.current = null;
      weatherManagerRef.current.clear();
      weatherDefaultsSnapshotRef.current = null;
      tilesetRuntimesRef.current.clear();
      mapScriptCacheRef.current.clear();
      mapScriptLoadingRef.current.clear();
      activeScriptFieldEffectsRef.current.clear();
      clearAssetCaches();
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
    pendingOverworldEntryReasonRef,
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
      loadingRef,
      worldSnapshotRef,
      playerRef,
      cameraRef,
      worldBoundsRef,
      worldManagerRef,
      objectEventManagerRef,
      pendingSavedLocationRef,
      pendingOverworldEntryReasonRef,
      consumePendingObjectEventRuntimeState: () => saveManager.consumePendingObjectEventRuntimeState(),
      pendingScriptedWarpRef,
      warpingRef,
      playerHiddenRef,
      storyScriptRunningRef,
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
      createSnapshotTileResolver,
      createSnapshotPlayerTileResolver,
      loadObjectEventsFromSnapshot,
      initializeWorldFromSnapshot,
      setMapMetatile: setMapMetatileAndInvalidate,
      scriptRuntimeServices,
    });
  }, [
    selectedMap,
    mapLoadRequestId,
    currentState,
    overworldEntryReady,
    // NOTE: viewportTilesWide/viewportTilesHigh intentionally excluded.
    // Viewport changes are handled by the camera.updateConfig() effect below.
    // Including them here would tear down + reload the entire map on resize.
    initializeWorldFromSnapshot,
    createSnapshotTileResolver,
    createSnapshotPlayerTileResolver,
    loadObjectEventsFromSnapshot,
    scriptRuntimeServices,
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
      isUnderwater: player.isUnderwater(),
      bikeMode: player.getBikeMode(),
      isRidingBike: player.isBikeRiding(),
    };
  }, [mapDebugInfo?.currentMap, selectedMap.id]);

  const getObjectEventRuntimeState = useCallback((): ObjectEventRuntimeState | null => {
    return objectEventManagerRef.current.getRuntimeState();
  }, []);

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

  const viewportDisplayWidth = viewportPixelSize.width * zoom;
  const viewportDisplayHeight = viewportPixelSize.height * zoom;

  const defaultDialogViewport = {
    width: viewportDisplayWidth,
    height: viewportDisplayHeight,
  };

  const viewportStack = (
    <div style={{ position: 'relative' }}>
      {/* WebGL canvas for overworld rendering */}
      <canvas
        ref={displayCanvasRef}
        className="game-canvas"
        style={{
          width: viewportDisplayWidth,
          height: viewportDisplayHeight,
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
          width: viewportDisplayWidth,
          height: viewportDisplayHeight,
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
  );

  if (isTouchMobile) {
    return (
      <div className="game-page game-page--mobile">
        {stats.error && <div style={{ marginBottom: 8, color: '#ff6666' }}>Error: {stats.error}</div>}

        <div className="mobile-shell" data-orientation-shell>
          <div className="mobile-shell__screen-frame">
            <div className="map-canvas-wrapper map-canvas-wrapper--mobile">
              {viewportStack}
            </div>
          </div>
          <div className="mobile-shell__hinge" />
          <div className="mobile-shell__controls-frame">
            <MobileControlDeck
              enabled
              onPress={pressButton}
              onReleasePointer={releasePointer}
            />
          </div>
        </div>

        {/* Debug Panel - remains available on mobile */}
        <DebugPanel
          options={debugOptions}
          onChange={setDebugOptions}
          diagnosticsEnabled={diagnosticsEnabled}
          onDiagnosticsEnabledChange={setDiagnosticsEnabled}
          state={debugState}
          debugCanvasRef={debugCanvasRef}
          centerTileInfo={diagnosticsEnabled ? getCenterTileInfo() : null}
          bottomLayerCanvasRef={bottomLayerCanvasRef}
          topLayerCanvasRef={topLayerCanvasRef}
          compositeLayerCanvasRef={compositeLayerCanvasRef}
          onCopyTileDebug={handleCopyTileDebug}
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
                openStartMenu();
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
            getObjectEventRuntimeState={getObjectEventRuntimeState}
            onSave={handleSaveComplete}
            onLoad={handleLoadComplete}
            onError={handleSaveError}
          />
        </div>
      </div>
      {stats.error && <div style={{ marginBottom: 8, color: '#ff6666' }}>Error: {stats.error}</div>}

      <div className="map-card">
        <div className="map-canvas-wrapper">
          {viewportStack}
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

      <footer
        className="game-footer"
        style={{ width: viewportDisplayWidth, maxWidth: '100%' }}
      >
        <p>
          Pokemon Emerald TS is a fun side-project to be able to re-run the gba game from{' '}
          <a
            className="game-footer-gh-link"
            href="https://github.com/pret/pokeemerald"
            target="_blank"
            rel="noopener noreferrer"
          >
            pret/pokeemerald
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M12 0.3C5.4 0.3 0 5.7 0 12.4c0 5.3 3.4 9.8 8.2 11.4 0.6 0.1 0.8-0.2 0.8-0.6
                   0-0.3 0-1.1 0-2.2-3.4 0.8-4.1-1.5-4.1-1.5-0.6-1.4-1.3-1.8-1.3-1.8-1.1-0.8 0.1-0.8 0.1-0.8
                   1.2 0.1 1.9 1.3 1.9 1.3 1.1 1.9 2.8 1.3 3.5 1 0.1-0.8 0.4-1.3 0.7-1.6-2.7-0.3-5.6-1.4-5.6-6
                   0-1.3 0.5-2.4 1.2-3.3-0.1-0.3-0.5-1.5 0.1-3.1 0 0 1-0.3 3.3 1.2a11.5 11.5 0 0 1 6 0
                   c2.3-1.5 3.3-1.2 3.3-1.2 0.6 1.6 0.2 2.8 0.1 3.1 0.8 0.9 1.2 2 1.2 3.3 0 4.7-2.9 5.7-5.7 6
                   0.5 0.4 0.8 1.1 0.8 2.3 0 1.6 0 2.9 0 3.3 0 0.3 0.2 0.7 0.8 0.6 4.8-1.6 8.2-6.1 8.2-11.4
                   C24 5.7 18.6 0.3 12 0.3z"
              />
            </svg>
          </a>
          {' '}decompile in typescript - with added features like viewport change to be able to play it on a much bigger
          screen that was possible on GBA! There is still a lot to do like battle system!
        </p>
        <a
          className="game-footer-repo-link game-footer-gh-link"
          href="https://github.com/sg3510/pkmn-rse-browser"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open repository: sg3510/pkmn-rse-browser"
        >
          Repo: sg3510/pkmn-rse-browser
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M12 0.3C5.4 0.3 0 5.7 0 12.4c0 5.3 3.4 9.8 8.2 11.4 0.6 0.1 0.8-0.2 0.8-0.6
                 0-0.3 0-1.1 0-2.2-3.4 0.8-4.1-1.5-4.1-1.5-0.6-1.4-1.3-1.8-1.3-1.8-1.1-0.8 0.1-0.8 0.1-0.8
                 1.2 0.1 1.9 1.3 1.9 1.3 1.1 1.9 2.8 1.3 3.5 1 0.1-0.8 0.4-1.3 0.7-1.6-2.7-0.3-5.6-1.4-5.6-6
                 0-1.3 0.5-2.4 1.2-3.3-0.1-0.3-0.5-1.5 0.1-3.1 0 0 1-0.3 3.3 1.2a11.5 11.5 0 0 1 6 0
                 c2.3-1.5 3.3-1.2 3.3-1.2 0.6 1.6 0.2 2.8 0.1 3.1 0.8 0.9 1.2 2 1.2 3.3 0 4.7-2.9 5.7-5.7 6
                 0.5 0.4 0.8 1.1 0.8 2.3 0 1.6 0 2.9 0 3.3 0 0.3 0.2 0.7 0.8 0.6 4.8-1.6 8.2-6.1 8.2-11.4
                 C24 5.7 18.6 0.3 12 0.3z"
            />
          </svg>
        </a>
      </footer>

      {/* Debug Panel - slide-out sidebar with map selection and WebGL tab */}
      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        diagnosticsEnabled={diagnosticsEnabled}
        onDiagnosticsEnabledChange={setDiagnosticsEnabled}
        state={debugState}
        debugCanvasRef={debugCanvasRef}
        centerTileInfo={diagnosticsEnabled ? getCenterTileInfo() : null}
        bottomLayerCanvasRef={bottomLayerCanvasRef}
        topLayerCanvasRef={topLayerCanvasRef}
        compositeLayerCanvasRef={compositeLayerCanvasRef}
        onCopyTileDebug={handleCopyTileDebug}
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
