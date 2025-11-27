import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
// UPNG import removed - now in useTilesetAnimations hook
import { PlayerController } from '../game/PlayerController';
import { MapManager, type TilesetResources, type WorldState } from '../services/MapManager';
import { ObjectEventManager } from '../game/ObjectEventManager';
import { saveManager, type SaveData, type SaveResult, type LocationState } from '../save';
// CanvasRenderer removed - now using RenderPipeline exclusively
// ViewportBuffer removed - using RenderPipeline exclusively
import { TilesetCanvasCache } from '../rendering/TilesetCanvasCache';
import { RenderPipeline } from '../rendering/RenderPipeline';
import { AnimationTimer } from '../engine/AnimationTimer';
import { GameLoop, type FrameHandler } from '../engine/GameLoop';
import { createInitialState, ObservableState, type Position } from '../engine/GameState';
import { UpdateCoordinator } from '../engine/UpdateCoordinator';
import { useInput } from '../hooks/useInput';
import {
  // loadBinary removed - now in useTilesetAnimations hook
  type MetatileAttributes,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  SECONDARY_TILE_OFFSET,
} from '../utils/mapLoader';
// Palette, TilesetKind, getSpritePriorityForElevation, METATILE_LAYER_TYPE_*, MapTileData removed - now using RenderPipeline
// TILESET_ANIMATION_CONFIGS removed - now in useTilesetAnimations hook
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
// computeCameraView moved to useRunUpdate hook
import type { CameraView } from '../utils/camera';
// WarpEvent type used via WarpTrigger from './map/utils'

// PROJECT_ROOT removed - now in useTilesetAnimations hook

import {
  type ReflectionState,
  type TilesetBuffers,
  type TilesetRuntime,
  type RenderContext,
  // LoadedAnimation removed - now in useTilesetAnimations hook
  type DebugTileInfo,
} from './map/types';
import {
  resolveTileAt,
  // detectWarpTrigger moved to useRunUpdate hook
  isVerticalObject,
  // computeReflectionState moved to useRunUpdate hook
} from './map/utils';
// DebugRenderer moved to useCompositeScene hook
// ObjectRenderer moved to useCompositeScene hook
import { DialogBox, useDialog } from './dialog';
// Field effect types and controllers from refactored modules
import { FadeController } from '../field/FadeController';
// ArrowOverlay import removed - now using useArrowOverlay hook
import { WarpHandler } from '../field/WarpHandler';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDebugCallbacks } from '../hooks/useDebugCallbacks';
import { useTilesetAnimations } from '../hooks/useTilesetAnimations';
import { useRunUpdate, type RunUpdateRefs, type RunUpdateCallbacks, type EngineFrameResult } from '../hooks/useRunUpdate';
import { useCompositeScene, type CompositeSceneRefs } from '../hooks/useCompositeScene';
import { buildTilesetRuntime } from '../utils/tilesetUtils';
// getSpritePriorityForElevation moved to useCompositeScene hook
import { npcSpriteCache } from '../game/npc';
// renderNPCs, renderNPCReflections, renderNPCGrassEffects moved to useCompositeScene hook
// ARROW_SPRITE_PATH removed - now in useArrowOverlay hook
import { useFieldSprites } from '../hooks/useFieldSprites';
import { DebugPanel, DEFAULT_DEBUG_OPTIONS, type DebugOptions, type DebugState } from './debug';
import { useWarpExecution, type WarpExecutionRefs, type WarpExecutionCallbacks } from '../hooks/useWarpExecution';

interface MapRendererProps {
  mapId: string;
  mapName: string;
  width: number;
  height: number;
  layoutPath: string;
  primaryTilesetPath: string;
  secondaryTilesetPath: string;
  primaryTilesetId: string;
  secondaryTilesetId: string;
  zoom?: number;
}

/**
 * Handle for imperative methods exposed via ref
 */
export interface MapRendererHandle {
  /** Save current game state */
  saveGame: () => SaveResult;
  /** Load game from save slot 0 */
  loadGame: () => SaveData | null;
  /** Get current player position */
  getPlayerPosition: () => { tileX: number; tileY: number; direction: string; mapId: string } | null;
}

type AnimationState = Record<string, number>;

// TileDrawCall interface removed - now using RenderPipeline types

export interface WorldCameraView extends CameraView {
  worldStartTileX: number;
  worldStartTileY: number;
  cameraWorldX: number;
  cameraWorldY: number;
}

// EngineFrameResult imported from useRunUpdate hook



// WarpTrigger imported from './map/utils'
// WarpHandler manages warp state (imported from '../field/WarpHandler')

// DoorSize and DoorAnimDrawable types imported from '../field/types'
// DoorEntrySequence removed - now using DoorSequencer via useDoorSequencer hook
// DoorExitSequence removed - now using DoorSequencer via useDoorSequencer hook

// ArrowOverlayState type imported from '../field/types'

// FadeState type imported from '../field/types'

function shiftWorld(state: WorldState, shiftX: number, shiftY: number): WorldState {
  const shiftedMaps = state.maps.map((m) => ({
    ...m,
    offsetX: m.offsetX + shiftX,
    offsetY: m.offsetY + shiftY,
  }));
  const minX = Math.min(...shiftedMaps.map((m) => m.offsetX));
  const minY = Math.min(...shiftedMaps.map((m) => m.offsetY));
  const maxX = Math.max(...shiftedMaps.map((m) => m.offsetX + m.mapData.width));
  const maxY = Math.max(...shiftedMaps.map((m) => m.offsetY + m.mapData.height));
  return {
    anchorId: state.anchorId,
    maps: shiftedMaps,
    bounds: { minX, minY, maxX, maxY },
  };
}


const DEBUG_CELL_SCALE = 3;
const DEBUG_CELL_SIZE = METATILE_SIZE * DEBUG_CELL_SCALE;
const DEBUG_GRID_SIZE = DEBUG_CELL_SIZE * 3;
const VIEWPORT_CONFIG = DEFAULT_VIEWPORT_CONFIG;
const VIEWPORT_PIXEL_SIZE = getViewportPixelSize(VIEWPORT_CONFIG);
const CONNECTION_DEPTH = 2; // anchor + direct neighbors + their neighbors
// Door timing constants now used inside useWarpExecution hook
// DOOR_ASSET_MAP and getDoorAssetForMetatile moved to ../data/doorAssets.ts
// ARROW_SPRITE_PATH moved to ../data/doorAssets.ts

const DEBUG_MODE_FLAG = 'DEBUG_MODE'; // Global debug flag for console logging

// Feature flag for viewport buffer (overscan scrolling optimization)
// DISABLED: The incremental edge rendering approach has bugs with sub-tile offsets
// USE_VIEWPORT_BUFFER removed - using RenderPipeline exclusively

// USE_RENDER_PIPELINE moved to useCompositeScene hook

function applyBehaviorOverrides(attributes: MetatileAttributes[]): MetatileAttributes[] {
  return attributes;
}

// Tileset utility functions moved to ../utils/tilesetUtils.ts
// buildTilesetRuntime imported from there



export const MapRenderer = forwardRef<MapRendererHandle, MapRendererProps>(({
  mapId,
  mapName,
  width: _width,
  height: _height,
  layoutPath: _layoutPath,
  primaryTilesetPath: _primaryTilesetPath,
  secondaryTilesetPath: _secondaryTilesetPath,
  primaryTilesetId: _primaryTilesetId,
  secondaryTilesetId: _secondaryTilesetId,
  zoom = 1,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const cameraViewRef = useRef<WorldCameraView | null>(null);
  const mapManagerRef = useRef<MapManager>(new MapManager());
  const gameStateRef = useRef<ObservableState | null>(null);
  const animationTimerRef = useRef<AnimationTimer | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const updateCoordinatorRef = useRef<UpdateCoordinator | null>(null);
  const lastFrameResultRef = useRef<EngineFrameResult | null>(null);
  const hasRenderedRef = useRef<boolean>(false);
  const renderGenerationRef = useRef<number>(0);
  const lastViewKeyRef = useRef<string>('');

  // Old ImageData refs removed - now using RenderPipeline exclusively
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugEnabledRef = useRef<boolean>(false);
  const debugOptionsRef = useRef<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const reflectionStateRef = useRef<ReflectionState>({
    hasReflection: false,
    reflectionType: null,
    bridgeType: 'none',
  });
  const tilesetRuntimeCacheRef = useRef<Map<string, TilesetRuntime>>(new Map());
  const debugTilesRef = useRef<DebugTileInfo[]>([]);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // Door animations managed by useDoorAnimations hook
  const doorAnimations = useDoorAnimations();
  const playerHiddenRef = useRef<boolean>(false);

  // Dialog system for surf prompts, etc.
  const { showYesNo, showMessage, isOpen: dialogIsOpen } = useDialog();
  const surfPromptInProgressRef = useRef<boolean>(false);
  const itemPickupInProgressRef = useRef<boolean>(false);
  const currentTimestampRef = useRef<number>(0);
  // Arrow overlay manages arrow warp indicator state - now using hook
  const arrowOverlay = useArrowOverlay();
  // Tileset animations loading - now using hook
  const tilesetAnimations = useTilesetAnimations();
  // WarpHandler manages warp detection and cooldown state
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  // Field sprites (grass, sand, splash, etc.) managed by useFieldSprites hook
  const fieldSprites = useFieldSprites();
  // Door sequencer manages door entry/exit animations via state machine
  const doorSequencer = useDoorSequencer({
    warpHandler: warpHandlerRef.current,
  });
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());
  // canvasRendererRef removed - now using RenderPipeline exclusively
  // viewportBufferRef removed - now using RenderPipeline exclusively
  const tilesetCacheRef = useRef<TilesetCanvasCache | null>(null); // Shared tileset cache
  const renderPipelineRef = useRef<RenderPipeline | null>(null); // Modular render pipeline
  // doorExitRef removed - now using DoorSequencer via useDoorSequencer hook
  // FadeController manages screen fade in/out transitions
  const fadeRef = useRef<FadeController>(new FadeController());
  // Track last player elevation for split-layer rendering
  const lastPlayerElevationRef = useRef<number>(0);

  // ensureAuxiliaryCanvases - needed by useCompositeScene hook
  const ensureAuxiliaryCanvases = useCallback((widthPx: number, heightPx: number) => {
    if (!backgroundCanvasRef.current) {
      backgroundCanvasRef.current = document.createElement('canvas');
    }
    if (!topCanvasRef.current) {
      topCanvasRef.current = document.createElement('canvas');
    }
    if (backgroundCanvasRef.current && topCanvasRef.current) {
      const sizeChanged = canvasSizeRef.current.w !== widthPx || canvasSizeRef.current.h !== heightPx;
      if (sizeChanged) {
        backgroundCanvasRef.current.width = widthPx;
        backgroundCanvasRef.current.height = heightPx;
        topCanvasRef.current.width = widthPx;
        topCanvasRef.current.height = heightPx;
        canvasSizeRef.current = { w: widthPx, h: heightPx };
      }
    }
  }, []);

  // Set up refs object for useRunUpdate hook
  const runUpdateRefs: RunUpdateRefs = useMemo(() => ({
    renderGenerationRef,
    lastFrameResultRef,
    renderContextRef,
    currentTimestampRef,
    playerControllerRef,
    cameraViewRef,
    lastViewKeyRef,
    animationTimerRef,
    tilesetCacheRef,
    hasRenderedRef,
    fadeRef,
    debugOptionsRef,
    reflectionStateRef,
    mapManagerRef,
    renderPipelineRef,
  }), []);

  const warpExecutionRefs: WarpExecutionRefs = useMemo(() => ({
    renderContextRef,
    playerControllerRef,
    playerHiddenRef,
    fadeRef,
    currentTimestampRef,
    hasRenderedRef,
    renderGenerationRef,
    mapManagerRef,
    renderPipelineRef,
  }), []);

  // useRunUpdate hook provides the game update loop logic
  const { createRunUpdate } = useRunUpdate({
    refs: runUpdateRefs,
    doorAnimations,
    arrowOverlay,
    warpHandler: warpHandlerRef.current,
    viewportConfig: VIEWPORT_CONFIG,
    connectionDepth: CONNECTION_DEPTH,
  });

  const { createWarpExecutors, resetDoorSequencer } = useWarpExecution({
    refs: warpExecutionRefs,
    doorSequencer,
    doorAnimations,
    arrowOverlay,
    warpHandler: warpHandlerRef.current,
    connectionDepth: CONNECTION_DEPTH,
  });

  // Set up refs object for useCompositeScene hook
  const compositeSceneRefs: CompositeSceneRefs = useMemo(() => ({
    renderContextRef,
    canvasRef,
    backgroundCanvasRef,
    topCanvasRef,
    playerControllerRef,
    lastPlayerElevationRef,
    renderPipelineRef,
    objectEventManagerRef,
    playerHiddenRef,
    debugOptionsRef,
    fadeRef,
  }), []);

  // useCompositeScene hook provides the scene rendering logic
  const { compositeScene } = useCompositeScene({
    refs: compositeSceneRefs,
    doorAnimations,
    arrowOverlay,
    fieldSprites,
    ensureAuxiliaryCanvases,
  });

  // Expose save/load methods via ref
  useImperativeHandle(ref, () => ({
    saveGame: (): SaveResult => {
      const player = playerControllerRef.current;
      const ctx = renderContextRef.current;
      if (!player || !ctx) {
        return { success: false, error: 'Game not initialized' };
      }

      const currentMapId = ctx.anchor.entry.id;
      const locationState: LocationState = {
        pos: { x: player.tileX, y: player.tileY },
        location: { mapId: currentMapId, warpId: 0, x: player.tileX, y: player.tileY },
        continueGameWarp: { mapId: currentMapId, warpId: 0, x: player.tileX, y: player.tileY },
        lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
        escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
        direction: player.dir,
        elevation: 3,
        isSurfing: player.isSurfing(),
      };

      return saveManager.save(0, locationState);
    },

    loadGame: (): SaveData | null => {
      const saveData = saveManager.load(0);
      if (!saveData) return null;

      const player = playerControllerRef.current;
      if (player) {
        player.setPositionAndDirection(
          saveData.location.pos.x,
          saveData.location.pos.y,
          saveData.location.direction
        );
        // Refresh object events to reflect loaded flag state
        objectEventManagerRef.current.refreshCollectedState();
      }

      return saveData;
    },

    getPlayerPosition: () => {
      const player = playerControllerRef.current;
      const ctx = renderContextRef.current;
      if (!player || !ctx) return null;
      return {
        tileX: player.tileX,
        tileY: player.tileY,
        direction: player.dir,
        mapId: ctx.anchor.entry.id,
      };
    },
  }), []);

  // Door animation functions removed - now using useDoorAnimations hook
  // Arrow overlay functions removed - now using useArrowOverlay hook

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centerTileDebugInfo, setCenterTileDebugInfo] = useState<DebugTileInfo | null>(null);

  // Debug panel state - unified (replaces old showTileDebug)
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [debugState, setDebugState] = useState<DebugState>({
    player: null,
    tile: null,
    objectsAtPlayerTile: null,
    objectsAtFacingTile: null,
    adjacentObjects: null,
    allVisibleNPCs: [],
    allVisibleItems: [],
    totalNPCCount: 0,
    totalItemCount: 0,
  });
  
  // Canvas refs for layer decomposition
  const bottomLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Debug callbacks extracted to useDebugCallbacks hook
  const { refreshDebugOverlay, renderLayerDecomposition, handleCopyTileDebug } = useDebugCallbacks({
    canvasRef,
    debugCanvasRef,
    debugEnabledRef,
    debugTilesRef,
    reflectionStateRef,
    playerControllerRef,
    bottomLayerCanvasRef,
    topLayerCanvasRef,
    compositeLayerCanvasRef,
    setCenterTileDebugInfo,
  });

  // Set global debug flag when debug enabled changes
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG] = debugOptions.enabled;
  }, [debugOptions.enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    playerControllerRef.current = new PlayerController();
    return () => {
      playerControllerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    debugEnabledRef.current = debugOptions.enabled;
    debugOptionsRef.current = debugOptions;
    if (
      debugOptions.enabled &&
      renderContextRef.current &&
      canvasRef.current &&
      playerControllerRef.current
    ) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [debugOptions, refreshDebugOverlay]);

  // Update layer decomposition when center tile changes
  useEffect(() => {
    if (debugOptions.enabled && centerTileDebugInfo && renderContextRef.current) {
      renderLayerDecomposition(renderContextRef.current, centerTileDebugInfo);
    }
  }, [debugOptions.enabled, centerTileDebugInfo, renderLayerDecomposition]);

  const copyTile = (
    src: Uint8Array,
    srcX: number,
    srcY: number,
    srcStride: number,
    dest: Uint8Array,
    destX: number,
    destY: number,
    destStride: number
  ) => {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const val = src[(srcY + y) * srcStride + (srcX + x)];
        dest[(destY + y) * destStride + (destX + x)] = val;
      }
    }
  };

  // handleCopyTileDebug removed - now in useDebugCallbacks hook

  const buildPatchedTilesForRuntime = useCallback(
    (runtime: TilesetRuntime, animationState: AnimationState): TilesetBuffers => {
      const animKey = runtime.animations
        .map((anim) => `${anim.id}:${animationState[anim.id] ?? 0}`)
        .join('|');

      if (animKey === runtime.lastPatchedKey && runtime.patchedTiles) {
        return runtime.patchedTiles;
      }

      let patchedPrimary = runtime.resources.primaryTilesImage;
      let patchedSecondary = runtime.resources.secondaryTilesImage;
      let primaryPatched = false;
      let secondaryPatched = false;

      for (const anim of runtime.animations) {
        const rawCycle = animationState[anim.id] ?? 0;
        const tilesetTarget = anim.tileset;
        if (tilesetTarget === 'primary' && !primaryPatched) {
          patchedPrimary = new Uint8Array(runtime.resources.primaryTilesImage);
          primaryPatched = true;
        }
        if (tilesetTarget === 'secondary' && !secondaryPatched) {
          patchedSecondary = new Uint8Array(runtime.resources.secondaryTilesImage);
          secondaryPatched = true;
        }

        for (const destination of anim.destinations) {
          const effectiveCycle = rawCycle + (destination.phase ?? 0);
          const useAlt =
            anim.altSequence !== undefined &&
            anim.altSequenceThreshold !== undefined &&
            effectiveCycle >= anim.altSequenceThreshold;
          const seq = useAlt && anim.altSequence ? anim.altSequence : anim.sequence;
          const seqIndexRaw = effectiveCycle % seq.length;
          const seqIndex = seqIndexRaw < 0 ? seqIndexRaw + seq.length : seqIndexRaw;
          const frameIndex = seq[seqIndex] ?? 0;
          const frameData = anim.frames[frameIndex];
          if (!frameData) continue;

          let destId = destination.destStart;
          for (let ty = 0; ty < anim.tilesHigh; ty++) {
            for (let tx = 0; tx < anim.tilesWide; tx++) {
              const sx = tx * TILE_SIZE;
              const sy = ty * TILE_SIZE;
              const targetBuffer = tilesetTarget === 'primary' ? patchedPrimary : patchedSecondary;
              const adjustedDestId =
                tilesetTarget === 'secondary' ? destId - SECONDARY_TILE_OFFSET : destId; // 512 offset removal
              copyTile(
                frameData,
                sx,
                sy,
                anim.width,
                targetBuffer,
                (adjustedDestId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE,
                Math.floor(adjustedDestId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE,
                128
              );
              destId++;
            }
          }
        }
      }

      const patched: TilesetBuffers = {
        primary: patchedPrimary,
        secondary: patchedSecondary,
      };

      runtime.lastPatchedKey = animKey;
      runtime.patchedTiles = patched;
      return patched;
    },
    []
  );

  // ensureAuxiliaryCanvases moved to top near useCompositeScene hook
  // loadIndexedFrame, loadTilesetAnimations, computeAnimatedTileIds moved to useTilesetAnimations hook

  const ensureTilesetRuntime = useCallback(
    async (tilesets: TilesetResources): Promise<TilesetRuntime> => {
      const cached = tilesetRuntimeCacheRef.current.get(tilesets.key);
      if (cached) return cached;
      const runtime = buildTilesetRuntime(tilesets);
      const animations = await tilesetAnimations.loadAnimations(tilesets.primaryTilesetId, tilesets.secondaryTilesetId);
      runtime.animations = animations;
      runtime.animatedTileIds = tilesetAnimations.computeAnimatedTileIds(animations);
      tilesetRuntimeCacheRef.current.set(tilesets.key, runtime);
      return runtime;
    },
    [] // tilesetAnimations functions are stable (useCallback with [])
  );

  const rebuildContextForWorld = useCallback(
    async (world: WorldState, anchorId: string) => {
      const anchor = world.maps.find((m) => m.entry.id === anchorId) ?? world.maps[0];
      const tilesetRuntimes = new Map<string, TilesetRuntime>();
      for (const map of world.maps) {
        const runtime = await ensureTilesetRuntime(map.tilesets);
        runtime.resources.primaryAttributes = applyBehaviorOverrides(runtime.resources.primaryAttributes);
        runtime.resources.secondaryAttributes = applyBehaviorOverrides(runtime.resources.secondaryAttributes);
        tilesetRuntimes.set(map.tilesets.key, runtime);
      }
      renderContextRef.current = {
        world,
        tilesetRuntimes,
        anchor,
      };
      hasRenderedRef.current = false;

      // Re-parse object events for the new world
      const objectEventManager = objectEventManagerRef.current;
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
    },
    [ensureTilesetRuntime]
  );

  // Old rendering functions (drawTileToImageData, drawTileToCanvas, renderPass, renderPassCanvas) removed
  // Now using RenderPipeline exclusively
  // compositeScene moved to useCompositeScene hook

  useEffect(() => {
    (window as unknown as { DEBUG_RENDER?: boolean }).DEBUG_RENDER = false;

    const loadAndRender = async () => {
      const generation = renderGenerationRef.current;

      try {
        setLoading(true);
        setError(null);
        hasRenderedRef.current = false;
        renderContextRef.current = null;
        cameraViewRef.current = null;
        lastViewKeyRef.current = '';
        gameLoopRef.current?.stop();
        gameLoopRef.current = null;
        updateCoordinatorRef.current = null;
        gameStateRef.current = null;
        animationTimerRef.current = null;
        lastFrameResultRef.current = null;

        const world = await mapManagerRef.current.buildWorld(mapId, CONNECTION_DEPTH);
        await rebuildContextForWorld(world, mapId);

        // Abort if a newer render cycle started while loading
        if (generation !== renderGenerationRef.current) {
          return;
        }
        // Load player sprite
        const player = new PlayerController();
        await player.loadSprite('walking', '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png');
        await player.loadSprite('running', '/pokeemerald/graphics/object_events/pics/people/brendan/running.png');
        await player.loadSprite('surfing', '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png');
        await player.loadSprite('shadow', '/pokeemerald/graphics/field_effects/pics/shadow_medium.png');
        
        // Load field effect sprites (grass, sand, splash, etc.)
        await fieldSprites.loadAll();

        // Note: Object events are parsed in rebuildContextForWorld() which was called above

        // Initialize shared tileset cache and render pipeline
        if (!tilesetCacheRef.current) {
          tilesetCacheRef.current = new TilesetCanvasCache();
        }
        renderPipelineRef.current = new RenderPipeline(tilesetCacheRef.current);
        console.log('[PERF] RenderPipeline initialized');

        // Initialize player position
        const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
        if (!anchor) {
          throw new Error('Failed to determine anchor map for warp setup');
        }
        const startTileX = Math.floor(anchor.mapData.width / 2);
        const startTileY = Math.floor(anchor.mapData.height / 2);
        player.setPositionAndDirection(startTileX, startTileY, 'down');

        const resolveTileForPlayer = (tileX: number, tileY: number) => {
          const ctx = renderContextRef.current;
          if (!ctx) return null;
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved) return null;
          return { mapTile: resolved.mapTile, attributes: resolved.attributes };
        };
        player.setTileResolver(resolveTileForPlayer);
        // player.setDoorWarpHandler(handleDoorWarp); // This will be defined later

        // Set up object collision checker for item balls, NPCs, etc.
        // Uses elevation-aware checking: objects at different elevations don't block
        player.setObjectCollisionChecker((tileX, tileY) => {
          const objectManager = objectEventManagerRef.current;
          const playerElev = player.getCurrentElevation();

          // Block if there's an uncollected item ball at same elevation
          if (objectManager.getItemBallAtWithElevation(tileX, tileY, playerElev) !== null) {
            return true;
          }
          // Block if there's a visible NPC at same elevation
          if (objectManager.hasNPCAtWithElevation(tileX, tileY, playerElev)) {
            return true;
          }
          return false;
        });

        playerControllerRef.current = player;

        // The original code had a try/catch block for loading a single sprite here.
        // This has been replaced by the new PlayerController initialization above.

        // const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
        // if (!anchor) {
        //   throw new Error('Failed to determine anchor map for warp setup');
        // }
        const applyTileResolver = () => {
          playerControllerRef.current?.setTileResolver((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return null;
            const resolved = resolveTileAt(ctx, tileX, tileY);
            if (!resolved) return null;
            return { mapTile: resolved.mapTile, attributes: resolved.attributes };
          });
        };

        // Set up pipeline tile resolver and vertical object checker
        const applyPipelineResolvers = () => {
          const pipeline = renderPipelineRef.current;
          if (!pipeline) return;

          pipeline.setTileResolver((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return null;
            return resolveTileAt(ctx, tileX, tileY);
          });

          pipeline.setVerticalObjectChecker((tileX, tileY) => {
            const ctx = renderContextRef.current;
            if (!ctx) return false;
            return isVerticalObject(ctx, tileX, tileY);
          });
        };

        applyTileResolver();
        applyPipelineResolvers();
        setLoading(false);

        const startingPosition: Position = {
          x: player.x,
          y: player.y,
          tileX: player.tileX,
          tileY: player.tileY,
        };
        const gameState = new ObservableState(createInitialState(world, startingPosition));
        gameStateRef.current = gameState;
        const animationTimer = new AnimationTimer();
        animationTimerRef.current = animationTimer;

        // reanchorInFlight moved to useRunUpdate hook (managed as ref)
        // Reset WarpHandler and set initial position if anchor exists
        const warpHandler = warpHandlerRef.current;
        warpHandler.reset();
        if (anchor) {
          warpHandler.updateLastCheckedTile(startTileX, startTileY, anchor.entry.id);
        }
        resetDoorSequencer();

        const warpCallbacks: WarpExecutionCallbacks = {
          rebuildContextForWorld,
          applyTileResolver,
          applyPipelineResolvers,
        };

        const {
          performWarp,
          startAutoDoorWarp,
          advanceDoorEntry,
          advanceDoorExit,
          handleDoorWarpAttempt,
        } = createWarpExecutors(generation, warpCallbacks);

        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarpAttempt);

        // Create runUpdate function using the hook's factory
        // Callbacks are passed here since they're defined in this useEffect scope
        const runUpdateCallbacks: RunUpdateCallbacks = {
          advanceDoorEntry,
          advanceDoorExit,
          startAutoDoorWarp,
          performWarp,
          rebuildContextForWorld,
          applyTileResolver,
          applyPipelineResolvers,
          buildPatchedTilesForRuntime,
          shiftWorld,
        };
        const runUpdate = createRunUpdate(generation, runUpdateCallbacks);

        const renderFrame = (frame: EngineFrameResult) => {
          if (!frame.shouldRender || !frame.view) return;
          const ctxForRender = renderContextRef.current;
          if (!ctxForRender) return;

          compositeScene(
            reflectionStateRef.current ?? { hasReflection: false, reflectionType: null, bridgeType: 'none' },
            frame.view,
            frame.viewChanged,
            frame.animationFrameChanged,
            currentTimestampRef.current
          );

          if (debugEnabledRef.current && playerControllerRef.current) {
            refreshDebugOverlay(ctxForRender, playerControllerRef.current, frame.view);
          }

          // Update debug panel state when enabled
          if (debugEnabledRef.current && playerControllerRef.current) {
            const player = playerControllerRef.current;
            const objectManager = objectEventManagerRef.current;

            // Get direction vector for facing tile
            const dirVectors: Record<string, { dx: number; dy: number }> = {
              up: { dx: 0, dy: -1 },
              down: { dx: 0, dy: 1 },
              left: { dx: -1, dy: 0 },
              right: { dx: 1, dy: 0 },
            };
            const vec = dirVectors[player.dir] ?? { dx: 0, dy: 0 };
            const facingX = player.tileX + vec.dx;
            const facingY = player.tileY + vec.dy;

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

            // Get objects at player tile (usually empty due to collision)
            const objectsAtPlayer = getObjectsAtTile(player.tileX, player.tileY);

            // Get objects at facing tile
            const objectsAtFacing = getObjectsAtTile(facingX, facingY);

            // Get objects at all adjacent tiles
            const adjacentObjects = {
              north: getObjectsAtTile(player.tileX, player.tileY - 1),
              south: getObjectsAtTile(player.tileX, player.tileY + 1),
              east: getObjectsAtTile(player.tileX + 1, player.tileY),
              west: getObjectsAtTile(player.tileX - 1, player.tileY),
            };

            setDebugState({
              player: {
                tileX: player.tileX,
                tileY: player.tileY,
                pixelX: player.x,
                pixelY: player.y,
                direction: player.dir,
                elevation: player.getElevation(),
                isMoving: player.isMoving,
                isSurfing: player.isSurfing(),
                mapId: renderContextRef.current?.anchor.entry.id ?? 'unknown',
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

          hasRenderedRef.current = true;
        };

        const coordinator = new UpdateCoordinator(gameState, {
          update: ({ deltaMs, timestamp }) => runUpdate(deltaMs, timestamp),
        });
        updateCoordinatorRef.current = coordinator;

        const handleFrame: FrameHandler = (_state, combinedResult) => {
          const frame = lastFrameResultRef.current;
          if (!frame) return;

          // CRITICAL: Use combinedResult.needsRender from GameLoop, not frame.shouldRender
          // GameLoop accumulates needsRender across all catch-up iterations, so if ANY
          // iteration moved the player, we render. The frame ref only has the LAST iteration.
          const frameWithCombinedFlags: EngineFrameResult = {
            ...frame,
            shouldRender: combinedResult.needsRender ?? false,
            viewChanged: combinedResult.viewChanged ?? false,
            animationFrameChanged: combinedResult.animationFrameChanged ?? false,
          };
          renderFrame(frameWithCombinedFlags);
        };

        const loop = new GameLoop(gameState, coordinator, animationTimer);
        gameLoopRef.current = loop;
        loop.start(handleFrame);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(err);
        setError(message);
        setLoading(false);
      }
    };

    loadAndRender();

    return () => {
      renderGenerationRef.current += 1;
      gameLoopRef.current?.stop();
    };
  }, [
    mapId,
    mapName,
    compositeScene,
    // tilesetAnimations removed - stable hook functions
    buildPatchedTilesForRuntime,
    refreshDebugOverlay,
    rebuildContextForWorld,
    createRunUpdate,
    createWarpExecutors,
    resetDoorSequencer,
  ]);

  const handleActionKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (e.code !== 'KeyX') return;

    const player = playerControllerRef.current;
    if (!player) return;

    // Avoid conflicts with dialog or concurrent prompts
    if (dialogIsOpen) return;

    // Surf prompt takes priority when available
    if (!surfPromptInProgressRef.current && !player.isMoving && !player.isSurfing()) {
      const surfCheck = player.canInitiateSurf();
      if (surfCheck.canSurf) {
        surfPromptInProgressRef.current = true;
        player.lockInput();

        try {
          const wantsToSurf = await showYesNo(
            "The water is dyed a deep blue…\nWould you like to SURF?"
          );

          if (wantsToSurf) {
            await showMessage("You used SURF!");
            player.startSurfing();
          }
        } finally {
          surfPromptInProgressRef.current = false;
          player.unlockInput();
        }
        return; // Don't process other actions on the same key press
      }
    }

    // Item pickup flow
    if (surfPromptInProgressRef.current || itemPickupInProgressRef.current || player.isMoving || player.isSurfing()) return;

    // Calculate the tile the player is facing
    let facingTileX = player.tileX;
    let facingTileY = player.tileY;
    if (player.dir === 'up') facingTileY -= 1;
    else if (player.dir === 'down') facingTileY += 1;
    else if (player.dir === 'left') facingTileX -= 1;
    else if (player.dir === 'right') facingTileX += 1;

    const objectEventManager = objectEventManagerRef.current;
    const interactable = objectEventManager.getInteractableAt(facingTileX, facingTileY);
    if (!interactable || interactable.type !== 'item') return;

    const itemBall = interactable.data;
    itemPickupInProgressRef.current = true;
    player.lockInput();

    try {
      objectEventManager.collectItem(itemBall.id);
      const itemName = itemBall.itemName;
      await showMessage(`BRENDAN found one ${itemName}!`);
    } finally {
      itemPickupInProgressRef.current = false;
      player.unlockInput();
    }
  }, [dialogIsOpen, showMessage, showYesNo]);

  useInput({ onKeyDown: handleActionKeyDown });

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
      {/* Game viewport container */}
      <div style={{
        position: 'relative',
        width: VIEWPORT_PIXEL_SIZE.width * zoom,
        height: VIEWPORT_PIXEL_SIZE.height * zoom
      }}>
        <canvas
          ref={canvasRef}
          width={VIEWPORT_PIXEL_SIZE.width}
          height={VIEWPORT_PIXEL_SIZE.height}
          style={{
            border: '1px solid #ccc',
            imageRendering: 'pixelated',
            width: VIEWPORT_PIXEL_SIZE.width * zoom,
            height: VIEWPORT_PIXEL_SIZE.height * zoom
          }}
        />
        {/* Dialog overlay */}
        <DialogBox
          viewportWidth={VIEWPORT_PIXEL_SIZE.width * zoom}
          viewportHeight={VIEWPORT_PIXEL_SIZE.height * zoom}
        />
      </div>

      {/* Debug Panel Sidebar */}
      <DebugPanel
        options={debugOptions}
        onChange={setDebugOptions}
        state={debugState}
        debugCanvasRef={debugCanvasRef}
        debugGridSize={DEBUG_GRID_SIZE}
        centerTileInfo={centerTileDebugInfo}
        bottomLayerCanvasRef={bottomLayerCanvasRef}
        topLayerCanvasRef={topLayerCanvasRef}
        compositeLayerCanvasRef={compositeLayerCanvasRef}
        onCopyTileDebug={handleCopyTileDebug}
      />
    </div>
  );
});

MapRenderer.displayName = 'MapRenderer';
