import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
// UPNG import removed - now in useTilesetAnimations hook
import { PlayerController, type DoorWarpRequest } from '../game/PlayerController';
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
  getMetatileIdFromMapTile,
  SECONDARY_TILE_OFFSET,
} from '../utils/mapLoader';
// Palette, TilesetKind, getSpritePriorityForElevation, METATILE_LAYER_TYPE_*, MapTileData removed - now using RenderPipeline
// TILESET_ANIMATION_CONFIGS removed - now in useTilesetAnimations hook
import type { CardinalDirection } from '../utils/metatileBehaviors';
import {
  getArrowDirectionFromBehavior,
  isArrowWarpBehavior,
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
// computeCameraView moved to useRunUpdate hook
import type { CameraView } from '../utils/camera';
// WarpEvent type used via WarpTrigger from './map/utils'

// PROJECT_ROOT removed - now in useTilesetAnimations hook

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

import {
  type ReflectionState,
  type TilesetBuffers,
  type TilesetRuntime,
  type RenderContext,
  type ResolvedTile,
  // LoadedAnimation removed - now in useTilesetAnimations hook
  type DebugTileInfo,
} from './map/types';
import {
  resolveTileAt,
  findWarpEventAt,
  // detectWarpTrigger moved to useRunUpdate hook
  isVerticalObject,
  classifyWarpKind,
  // computeReflectionState moved to useRunUpdate hook
  type WarpTrigger,
} from './map/utils';
import { DebugRenderer } from './map/renderers/DebugRenderer';
import { ObjectRenderer } from './map/renderers/ObjectRenderer';
import { DialogBox, useDialog } from './dialog';
// Field effect types and controllers from refactored modules
import { DOOR_TIMING } from '../field/types';
import { FadeController } from '../field/FadeController';
// ArrowOverlay import removed - now using useArrowOverlay hook
import { WarpHandler } from '../field/WarpHandler';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDebugCallbacks } from '../hooks/useDebugCallbacks';
import { useTilesetAnimations } from '../hooks/useTilesetAnimations';
import { useRunUpdate, type RunUpdateRefs, type RunUpdateCallbacks, type EngineFrameResult } from '../hooks/useRunUpdate';
import { buildTilesetRuntime } from '../utils/tilesetUtils';
import { getSpritePriorityForElevation } from '../utils/elevationPriority';
import { npcSpriteCache, renderNPCs, renderNPCReflections, renderNPCGrassEffects } from '../game/npc';
// ARROW_SPRITE_PATH removed - now in useArrowOverlay hook
import { useFieldSprites } from '../hooks/useFieldSprites';
import { DebugPanel, DEFAULT_DEBUG_OPTIONS, type DebugOptions, type DebugState } from './debug';

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
// Door timing constants imported from '../field/types' as DOOR_TIMING
// DOOR_ASSET_MAP and getDoorAssetForMetatile moved to ../data/doorAssets.ts
// ARROW_SPRITE_PATH moved to ../data/doorAssets.ts

const DEBUG_MODE_FLAG = 'DEBUG_MODE'; // Global debug flag for console logging

// Feature flag for viewport buffer (overscan scrolling optimization)
// DISABLED: The incremental edge rendering approach has bugs with sub-tile offsets
// USE_VIEWPORT_BUFFER removed - using RenderPipeline exclusively

// Feature flag for using the new modular RenderPipeline
const USE_RENDER_PIPELINE = true;

function applyBehaviorOverrides(attributes: MetatileAttributes[]): MetatileAttributes[] {
  return attributes;
}

function logDoor(...args: unknown[]) {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[door]', ...args);
  }
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

  // Set up refs object for useRunUpdate hook
  const runUpdateRefs: RunUpdateRefs = {
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
  };

  // useRunUpdate hook provides the game update loop logic
  const { createRunUpdate } = useRunUpdate({
    refs: runUpdateRefs,
    doorAnimations,
    arrowOverlay,
    warpHandler: warpHandlerRef.current,
    viewportConfig: VIEWPORT_CONFIG,
    connectionDepth: CONNECTION_DEPTH,
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

  const ensureAuxiliaryCanvases = (widthPx: number, heightPx: number) => {
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
  };

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

  const lastPlayerElevationRef = useRef<number>(0);

  // renderPass and renderPassCanvas removed - now using RenderPipeline exclusively

  const compositeScene = useCallback(
    (
      reflectionState: ReflectionState,
      view: WorldCameraView,
      viewChanged: boolean,
      animationFrameChanged: boolean,
      nowMs: number
    ) => {
      const ctx = renderContextRef.current;
      if (!ctx) return;
      const mainCanvas = canvasRef.current;
      if (!mainCanvas) return;
      const mainCtx = mainCanvas.getContext('2d');
      if (!mainCtx) return;

      const widthPx = view.pixelWidth;
      const heightPx = view.pixelHeight;
      ensureAuxiliaryCanvases(widthPx, heightPx);

      const bgCtx = backgroundCanvasRef.current?.getContext('2d');
      const topCtx = topCanvasRef.current?.getContext('2d');
      if (!bgCtx || !topCtx) return;

      const player = playerControllerRef.current;
      const playerElevation = player ? player.getElevation() : 0;
      const playerPriority = getSpritePriorityForElevation(playerElevation);
      const elevationChanged = lastPlayerElevationRef.current !== playerElevation;
      lastPlayerElevationRef.current = playerElevation;

      // Split rendering: Top layer split into "Below Player" and "Above Player"
      // This fixes the visual issue where player on a bridge (Elev 4) is covered by the bridge

      // RENDER PIPELINE MODE: Uses the new modular RenderPipeline
      if (USE_RENDER_PIPELINE && renderPipelineRef.current) {
        const pipeline = renderPipelineRef.current;

        // Render all three passes (cached when view/elevation unchanged)
        pipeline.render(ctx, view, playerElevation, {
          needsFullRender: viewChanged,
          animationChanged: animationFrameChanged,
          elevationChanged,
        });

        // Composite background first (for priority 2 sprites to appear behind topBelow)
        mainCtx.clearRect(0, 0, widthPx, heightPx);
        pipeline.compositeBackgroundOnly(mainCtx, view);

        // Render priority 2 NPCs that are NOT at player's priority
        // NPCs at player's priority will be Y-sorted with player in the player layer
        if (player) {
          const npcs = objectEventManagerRef.current.getVisibleNPCs();
          renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom', 2, playerPriority);
          renderNPCs(mainCtx, npcs, view, player.tileY, 'top', 2, playerPriority);
        }

        // Now composite topBelow layer (bridges, tree tops rendered behind player)
        pipeline.compositeTopBelowOnly(mainCtx, view);

        // Note: NPCs at player's priority are Y-sorted with player in the player layer
        // Priority 0 sprites are rendered after topAbove
      }
      // ViewportBuffer and old rendering modes removed - now using RenderPipeline exclusively

      doorAnimations.render(mainCtx, view, nowMs);
      // Render arrow overlay using useArrowOverlay hook
      const arrowState = arrowOverlay.getState();
      const arrowSprite = arrowOverlay.getSprite();
      if (arrowState && arrowSprite) {
        ObjectRenderer.renderArrow(mainCtx, arrowState, arrowSprite, view, nowMs);
      }
      if (player) {
        ObjectRenderer.renderReflection(mainCtx, player, reflectionState, view, ctx);
      }

      // Render NPC reflections (before NPCs so reflections appear underneath)
      {
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCReflections(mainCtx, npcs, view, ctx);
      }

      const playerY = player ? player.y : 0;

      // Render field effects behind player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: fieldSprites.sprites.grass,
          longGrass: fieldSprites.sprites.longGrass,
          sand: fieldSprites.sprites.sand,
          splash: fieldSprites.sprites.splash,
          ripple: fieldSprites.sprites.ripple,
          arrow: arrowOverlay.getSprite(),
          itemBall: fieldSprites.sprites.itemBall,
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'bottom', ctx);

        // Render item balls behind player
        const itemBalls = objectEventManagerRef.current.getVisibleItemBalls();
        ObjectRenderer.renderItemBalls(mainCtx, itemBalls, fieldSprites.sprites.itemBall, view, player.tileY, 'bottom');

        // Render NPCs at player's priority behind player (Y-sorted with player)
        // Other priority NPCs are rendered in their respective passes (before topBelow or after topAbove)
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom', playerPriority);

        // Render grass effects over NPCs (so grass covers their lower body)
        renderNPCGrassEffects(mainCtx, npcs, view, ctx, {
          tallGrass: fieldSprites.sprites.grass,
          longGrass: fieldSprites.sprites.longGrass,
        });
      }

      // Render surf blob (if surfing or mounting/dismounting)
      // The blob is rendered BEFORE player so player appears on top
      if (player && !playerHiddenRef.current) {
        const surfCtrl = player.getSurfingController();
        const blobRenderer = surfCtrl.getBlobRenderer();
        const shouldRenderBlob = player.isSurfing() || surfCtrl.isJumping();

        if (shouldRenderBlob && blobRenderer.isReady()) {
          const bobOffset = blobRenderer.getBobOffset();
          let blobScreenX: number;
          let blobScreenY: number;

          // Determine blob position based on current animation phase
          if (surfCtrl.isJumpingOn()) {
            // MOUNTING: Blob is at target water tile (destination)
            const targetPos = surfCtrl.getTargetPosition();
            if (targetPos) {
              const blobWorldX = targetPos.tileX * 16 - 8;
              const blobWorldY = targetPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else if (surfCtrl.isJumpingOff()) {
            // DISMOUNTING: Blob stays at fixed water tile position
            const fixedPos = surfCtrl.getBlobFixedPosition();
            if (fixedPos) {
              const blobWorldX = fixedPos.tileX * 16 - 8;
              const blobWorldY = fixedPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else {
            // Normal surfing: Blob follows player
            blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
            blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
          }

          // applyBob = false because we already added bobOffset to blobScreenY
          blobRenderer.render(mainCtx, blobScreenX, blobScreenY, player.dir, false);
        }
      }

      if (player && !playerHiddenRef.current) {
        player.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
      }

      // Render field effects in front of player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: fieldSprites.sprites.grass,
          longGrass: fieldSprites.sprites.longGrass,
          sand: fieldSprites.sprites.sand,
          splash: fieldSprites.sprites.splash,
          ripple: fieldSprites.sprites.ripple,
          arrow: arrowOverlay.getSprite(),
          itemBall: fieldSprites.sprites.itemBall,
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'top', ctx);

        // Render item balls in front of player
        const itemBalls = objectEventManagerRef.current.getVisibleItemBalls();
        ObjectRenderer.renderItemBalls(mainCtx, itemBalls, fieldSprites.sprites.itemBall, view, player.tileY, 'top');

        // Render NPCs at player's priority in front of player (Y-sorted with player)
        // Other priority NPCs are rendered in their respective passes (before topBelow or after topAbove)
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCs(mainCtx, npcs, view, player.tileY, 'top', playerPriority);

        // Render grass effects over NPCs (so grass covers their lower body)
        renderNPCGrassEffects(mainCtx, npcs, view, ctx, {
          tallGrass: fieldSprites.sprites.grass,
          longGrass: fieldSprites.sprites.longGrass,
        });
      }

      // 3. Draw Top Layer (Above Player)
      if (USE_RENDER_PIPELINE && renderPipelineRef.current) {
        // RenderPipeline mode - composite topAbove layer
        renderPipelineRef.current.compositeTopAbove(mainCtx, view);
      }

      // Render priority 0 NPCs (elevation 13, 14) that are NOT at player's priority
      // They appear ABOVE everything including topAbove (GBA priority 0 sprites)
      // NPCs at player's priority are already Y-sorted with player in the player layer
      if (player) {
        const npcs = objectEventManagerRef.current.getVisibleNPCs();
        renderNPCs(mainCtx, npcs, view, player.tileY, 'bottom', 0, playerPriority);
        renderNPCs(mainCtx, npcs, view, player.tileY, 'top', 0, playerPriority);
      }

      // Render debug overlays if enabled
      DebugRenderer.renderCollisionElevationOverlay(mainCtx, ctx, view, {
        showCollision: debugOptionsRef.current.showCollisionOverlay,
        showElevation: debugOptionsRef.current.showElevationOverlay,
      });

      // Render fade overlay using FadeController
      if (fadeRef.current.isActive()) {
        const alpha = fadeRef.current.getAlpha(nowMs);
        mainCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        mainCtx.fillRect(0, 0, widthPx, heightPx);
        if (fadeRef.current.isComplete(nowMs)) {
          fadeRef.current.clear();
        }
      }

      if (isDebugMode()) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    // doorAnimations functions are stable (useCallback with []), so no dependency needed
    []
  );

  // Field sprite loading functions removed - now using useFieldSprites hook

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
        // Reset door sequencer for new map load (handles both entry and exit)
        doorSequencer.reset();
        const startAutoDoorWarp = (
          trigger: WarpTrigger,
          resolved: ResolvedTile,
          player: PlayerController,
          entryDirection: CardinalDirection = 'up',
          _options?: { isAnimatedDoor?: boolean }
        ) => {
          if (doorSequencer.isEntryActive()) return false;
          const now = performance.now();
          const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
          logDoor('entry: auto door warp (non-animated)', {
            worldX: player.tileX,
            worldY: player.tileY,
            metatileId,
            behavior: trigger.behavior,
          });
          arrowOverlay.hide();
          // Use the sequencer's startAutoWarp to skip to fade phase
          doorSequencer.startAutoWarp({
            targetX: player.tileX,
            targetY: player.tileY,
            metatileId,
            isAnimatedDoor: false,
            entryDirection,
            warpTrigger: trigger,
          }, now, true);
          player.lockInput();
          return true;
        };

        /**
         * Perform Warp (Map Transition)
         * 
         * Handles the actual map change and player positioning after fade out.
         * 
         * Critical Logic for Door Exit Animations:
         * - Check if DESTINATION tile has door behavior before playing exit animation
         * - Many indoor exits use arrow warps (behavior 101) or stairs with NO door
         * - Only play door exit animation if destination tile is actually a door
         * 
         * Example: Exiting Brendan's House to Littleroot Town
         * - Player walks onto arrow warp at (8,8) in BRENDANS_HOUSE_1F (behavior 101, no door)
         * - Warp destination (5,8) in MAP_LITTLEROOT_TOWN has metatile 0x248 (IS a door)
         * - We check destination behavior and play door exit animation at (5,8)
         */
        const performWarp = async (
          trigger: WarpTrigger,
          options?: { force?: boolean; fromDoor?: boolean }
        ) => {
          if (warpHandler.isInProgress() && !options?.force) return;
          warpHandler.setInProgress(true);
          // reanchorInFlight now managed in useRunUpdate hook for automatic transitions
          const shouldUnlockInput = !options?.fromDoor;
          playerControllerRef.current?.lockInput();
          try {
            const targetMapId = trigger.warpEvent.destMap;
            const targetWarpId = trigger.warpEvent.destWarpId;
            const newWorld = await mapManagerRef.current.buildWorld(targetMapId, CONNECTION_DEPTH);
            if (generation !== renderGenerationRef.current) return;
            await rebuildContextForWorld(newWorld, targetMapId);
            if (generation !== renderGenerationRef.current) return;

            const ctxAfter = renderContextRef.current;
            const anchorAfter = ctxAfter?.anchor ?? newWorld.maps[0];
            const destMap =
              ctxAfter?.world.maps.find((m) => m.entry.id === targetMapId) ?? anchorAfter;
            const warpEvents = destMap?.warpEvents ?? [];
            const destWarp = warpEvents[targetWarpId] ?? warpEvents[0];
            if (!destMap || !destWarp) {
              if (isDebugMode()) {
                console.warn(`Warp target missing for ${targetMapId} warp ${targetWarpId}`);
              }
              return;
            }
            const destWorldX = destMap.offsetX + destWarp.x;
            const destWorldY = destMap.offsetY + destWarp.y;
            
            // Determine facing direction based on context
            let facing: PlayerController['dir'] = trigger.facing;
            if (trigger.kind === 'door' && options?.fromDoor && ctxAfter) {
              const destResolved = resolveTileAt(ctxAfter, destWorldX, destWorldY);
              const destBehavior = destResolved?.attributes?.behavior ?? -1;
              const destIsArrow = isArrowWarpBehavior(destBehavior);
              
              if (isDoorBehavior(destBehavior)) {
                facing = 'down'; // Exiting through a door
              } else if (destIsArrow) {
                // Arriving at an arrow warp: preserve movement direction
                facing = trigger.facing;
              } else {
                facing = 'up'; // Arrived at non-door, non-arrow destination (stairs, etc.)
              }
            } else if (trigger.kind === 'door') {
              facing = 'down'; // Default for door warps when not using door entry sequence
            } else if (trigger.kind === 'arrow') {
              // Arrow warps: always preserve the movement direction
              // This ensures you face the direction you were moving, not the destination arrow's direction
              facing = trigger.facing;
            }

            if (isDebugMode()) {
              console.log('[WARP_FACING]', {
                triggerKind: trigger.kind,
                triggerFacing: trigger.facing,
                finalFacing: facing,
                fromDoor: options?.fromDoor,
              });
            }

            playerControllerRef.current?.setPositionAndDirection(destWorldX, destWorldY, facing);
            
            // Check if destination tile actually has a door before playing door exit animation
            if (options?.fromDoor && ctxAfter) {
              const destResolved = resolveTileAt(ctxAfter, destWorldX, destWorldY);
              const destBehavior = destResolved?.attributes?.behavior ?? -1;
              const destMetatileId = destResolved ? getMetatileIdFromMapTile(destResolved.mapTile) : 0;
              
              const isAnimatedDoor = isDoorBehavior(destBehavior);
              const isNonAnimatedDoor = isNonAnimatedDoorBehavior(destBehavior);
              const requiresExitSequence = requiresDoorExitSequence(destBehavior);
              
              console.log('[WARP_DEST_CHECK]', {
                fromDoor: options?.fromDoor,
                triggerKind: trigger.kind,
                destWorldX,
                destWorldY,
                destMetatileId: `0x${destMetatileId.toString(16)} (${destMetatileId})`,
                destBehavior,
                isAnimatedDoor,
                isNonAnimatedDoor,
                requiresExitSequence,
              });
              
              // Check if destination requires exit sequence (animated or non-animated)
              if (requiresExitSequence) {
                // Determine exit direction: for arrow warps, continue in same direction; for doors, exit down
                const exitDirection = trigger.kind === 'arrow' ? trigger.facing : 'down';
                
                if (isDebugMode()) {
                  console.log('[EXIT_SEQUENCE_START]', {
                    triggerKind: trigger.kind,
                    triggerFacing: trigger.facing,
                    exitDirection,
                    destBehavior,
                    isAnimatedDoor,
                  });
                }
                
                logDoor('performWarp: destination requires exit sequence', {
                  destWorldX,
                  destWorldY,
                  destMetatileId,
                  destBehavior,
                  isAnimatedDoor,
                  isNonAnimatedDoor,
                  exitDirection,
                  triggerKind: trigger.kind,
                });
                playerHiddenRef.current = true;
                // Start exit sequence using door sequencer
                doorSequencer.startExit({
                  doorWorldX: destWorldX,
                  doorWorldY: destWorldY,
                  metatileId: destMetatileId,
                  isAnimatedDoor,
                  exitDirection: exitDirection as CardinalDirection,
                }, currentTimestampRef.current);
                fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
              } else {
                if (isDebugMode()) {
                  console.log('[NO_EXIT_SEQUENCE]', {
                    triggerKind: trigger.kind,
                    destBehavior,
                    requiresExitSequence,
                    finalFacing: facing,
                  });
                }
                // No door on destination side (e.g., arrow warp, stairs, teleport pad)
                // Must unlock input immediately since there's no door exit sequence
                logDoor('performWarp: destination has no door, simple fade in', {
                  destWorldX,
                  destWorldY,
                  destMetatileId,
                  destBehavior,
                  behaviorLabel: classifyWarpKind(destBehavior) ?? 'unknown',
                });
                playerHiddenRef.current = false;
                fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
                // No door exit sequence needed - reset sequencer
                doorSequencer.sequencer.resetExit();
                // CRITICAL: Unlock input here since there's no door exit sequence to handle it
                playerControllerRef.current?.unlockInput();
                warpHandler.setInProgress(false);
              }
            } else if (options?.fromDoor) {
              fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
              playerHiddenRef.current = false;
              doorSequencer.sequencer.resetExit();
              playerControllerRef.current?.unlockInput();
              warpHandler.setInProgress(false);
            }
            applyTileResolver();
            applyPipelineResolvers();
            // Invalidate pipeline caches after warp
            renderPipelineRef.current?.invalidate();
            warpHandler.updateLastCheckedTile(destWorldX, destWorldY, destMap.entry.id);
            warpHandler.setCooldown(350);
            hasRenderedRef.current = false;
            // Clear any remaining door animations from the previous map
            doorAnimations.clearAll();
          } catch (err) {
            console.error('Warp failed', err);
          } finally {
            if (shouldUnlockInput) {
              playerControllerRef.current?.unlockInput();
              warpHandler.setInProgress(false);
            }
            // reanchorInFlight now managed in useRunUpdate hook
          }
        };

        const handleDoorWarp = (request: DoorWarpRequest) => {
          const ctx = renderContextRef.current;
          if (!ctx) return;
          const resolved = resolveTileAt(ctx, request.targetX, request.targetY);
          if (!resolved) return;
          
          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) return;

          const trigger: WarpTrigger = {
            kind: classifyWarpKind(request.behavior) ?? 'door',
            sourceMap: resolved.map,
            warpEvent,
            behavior: request.behavior,
            facing: playerControllerRef.current?.dir ?? 'down'
          };
          
          if (playerControllerRef.current) {
            startAutoDoorWarp(trigger, resolved, playerControllerRef.current);
          }
        };
        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarp);

        const advanceDoorEntry = (now: number) => {
          if (!doorSequencer.isEntryActive()) return;
          const player = playerControllerRef.current;
          if (!player) return;

          const entryState = doorSequencer.sequencer.getEntryState();
          const isAnimationDone = (animId: number | undefined) => {
            if (animId === undefined) return true;
            // -1 is sentinel for "loading in progress" - not done
            if (animId === -1) return false;
            const anim = doorAnimations.findById(animId);
            return !anim || doorAnimations.isAnimDone(anim, now);
          };
          const isFadeDone = !fadeRef.current.isActive() || fadeRef.current.isComplete(now);

          const result = doorSequencer.updateEntry(
            now,
            player.isMoving,
            isAnimationDone,
            isFadeDone
          );

          // Handle actions returned by the sequencer
          if (result.action === 'startPlayerStep' && result.direction) {
            const pos = doorSequencer.getEntryDoorPosition();
            logDoor('entry: door fully open, force step into tile', pos?.x, pos?.y);
            player.forceMove(result.direction, true);
          } else if (result.action === 'hidePlayer') {
            logDoor('entry: hide player');
            playerHiddenRef.current = true;
            // Also spawn close animation if animated door
            if (entryState.isAnimatedDoor) {
              const pos = doorSequencer.getEntryDoorPosition();
              logDoor('entry: start door close (animated)');
              // Set to -1 as sentinel for "loading in progress" to prevent race condition
              doorSequencer.setEntryCloseAnimId(-1);
              doorAnimations.spawn(
                'close',
                pos?.x ?? 0,
                pos?.y ?? 0,
                entryState.metatileId,
                now
              ).then((closeAnimId) => {
                if (closeAnimId !== null) {
                  doorSequencer.setEntryCloseAnimId(closeAnimId);
                }
              });
              // Remove open animation
              if (entryState.openAnimId !== undefined) {
                doorAnimations.clearById(entryState.openAnimId);
              }
            }
          } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
            logDoor('entry: door close complete, showing base tile');
            doorAnimations.clearById(result.animId);
          } else if (result.action === 'startFadeOut' && result.duration) {
            logDoor('entry: start fade out');
            fadeRef.current.startFadeOut(result.duration, now);
          } else if (result.action === 'executeWarp' && result.trigger) {
            logDoor('entry: warp now');
            void performWarp(result.trigger as WarpTrigger, { force: true, fromDoor: true });
          }
        };

        /**
         * Advance Door Exit Sequence
         *
         * Handles the door exit state machine using the door sequencer.
         * Called every frame in runUpdate to progress the exit animation.
         */
        const advanceDoorExit = (now: number) => {
          if (!doorSequencer.isExitActive()) return;
          const player = playerControllerRef.current;
          if (!player) return;

          const exitState = doorSequencer.sequencer.getExitState();
          const isAnimationDone = (animId: number | undefined) => {
            if (animId === undefined) return true;
            // -1 is sentinel for "loading in progress" - not done
            if (animId === -1) return false;
            const anim = doorAnimations.findById(animId);
            return !anim || doorAnimations.isAnimDone(anim, now);
          };
          // Per pokeemerald: wait for fade-in to complete before showing player
          // Fade is complete when it's not active OR when it's marked as complete
          const isFadeInDone = !fadeRef.current.isActive() || fadeRef.current.isComplete(now);

          const result = doorSequencer.updateExit(
            now,
            player.isMoving,
            isAnimationDone,
            isFadeInDone
          );

          // Handle actions returned by the sequencer
          if (result.action === 'spawnOpenAnimation') {
            const pos = doorSequencer.getExitDoorPosition();
            logDoor('exit: set door to open state (not animating)', {
              worldX: pos?.x,
              worldY: pos?.y,
              metatileId: exitState.metatileId,
            });
            // Set to -1 as sentinel for "loading in progress"
            doorSequencer.setExitOpenAnimId(-1);
            // Per pokeemerald: FieldSetDoorOpened() sets door to fully-open state BEFORE fade completes
            // We achieve this by setting startedAt far in the past so animation is already on last frame
            // Door animation: 4 frames * 90ms = 360ms, so 500ms in past ensures we're on last frame
            const alreadyOpenStartedAt = now - 500;
            doorAnimations.spawn(
              'open',
              pos?.x ?? 0,
              pos?.y ?? 0,
              exitState.metatileId,
              alreadyOpenStartedAt,
              true // holdOnComplete - stay on last frame
            ).then((openAnimId) => {
              if (openAnimId !== null) {
                doorSequencer.setExitOpenAnimId(openAnimId);
              }
            });
          } else if (result.action === 'startPlayerStep' && result.direction) {
            logDoor('exit: step out of door', { exitDirection: result.direction });
            player.forceMove(result.direction, true);
            playerHiddenRef.current = false;
          } else if (result.action === 'spawnCloseAnimation') {
            const pos = doorSequencer.getExitDoorPosition();
            logDoor('exit: start door close');
            // Remove open animation
            if (exitState.openAnimId !== undefined && exitState.openAnimId !== -1) {
              doorAnimations.clearById(exitState.openAnimId);
            }
            // Set to -1 as sentinel for "loading in progress"
            doorSequencer.setExitCloseAnimId(-1);
            doorAnimations.spawn(
              'close',
              pos?.x ?? 0,
              pos?.y ?? 0,
              exitState.metatileId,
              now
            ).then((closeAnimId) => {
              if (closeAnimId !== null) {
                doorSequencer.setExitCloseAnimId(closeAnimId);
              }
            });
          } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
            logDoor('exit: door close complete');
            doorAnimations.clearById(result.animId);
          }

          // Handle completion
          if (result.done) {
            logDoor('exit: sequence complete');
            playerControllerRef.current?.unlockInput();
            playerHiddenRef.current = false;
          }
        };

          /**
           * Door Entry Handler
           * 
           * Triggered when player attempts to enter a door (from outdoor → indoor, etc.)
           * 
           * Important: Uses the SOURCE tile's metatile ID (the door tile being entered)
           * to determine which door animation to play. This is correct because we're
           * animating the door the player is walking INTO, not the destination tile.
           * 
           * Example: Entering Brendan's House from Littleroot Town
           * - Source tile (5,8) in MAP_LITTLEROOT_TOWN has metatile 0x248 (METATILE_Petalburg_Door_Littleroot)
           * - Destination tile (8,8) in BRENDANS_HOUSE_1F has metatile 514 (arrow warp, NOT a door)
           * - We play door animation using 0x248, not 514
           */
          const handleDoorWarpAttempt = async (request: DoorWarpRequest) => {
            if (doorSequencer.isEntryActive() || warpHandler.isInProgress()) return;
            const ctx = renderContextRef.current;
            const player = playerControllerRef.current;
            if (!ctx || !player) return;
            const resolved = resolveTileAt(ctx, request.targetX, request.targetY);
          if (!resolved) return;
          const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
          if (!warpEvent) return;
          const behavior = resolved.attributes?.behavior ?? -1;
          
          // Check if this is an arrow warp
          const isArrow = isArrowWarpBehavior(behavior);
          const requiresExitSeq = requiresDoorExitSequence(behavior);
          const isAnimated = isDoorBehavior(behavior);
          
          if (isDebugMode()) {
            console.log('[DOOR_WARP_ATTEMPT]', {
              targetX: request.targetX,
              targetY: request.targetY,
              behavior,
              metatileId: `0x${getMetatileIdFromMapTile(resolved.mapTile).toString(16)} (${getMetatileIdFromMapTile(resolved.mapTile)})`,
              isDoor: isAnimated,
              isNonAnimatedDoor: isNonAnimatedDoorBehavior(behavior),
              isArrowWarp: isArrow,
              requiresExitSequence: requiresExitSeq,
              playerDir: player.dir,
            });
          }
          
          // Handle arrow warps
          if (isArrow) {
            const arrowDir = getArrowDirectionFromBehavior(behavior);
            if (isDebugMode()) {
              console.log('[ARROW_WARP_ATTEMPT]', {
                arrowDir,
                playerDir: player.dir,
                match: arrowDir === player.dir,
              });
            }
            if (!arrowDir || player.dir !== arrowDir) {
              if (isDebugMode()) {
                console.warn('[ARROW_WARP_ATTEMPT] Player not facing arrow direction - REJECTING');
              }
              return;
            }
            // Arrow warp: trigger auto door warp with no animation
            const trigger: WarpTrigger = {
              kind: 'arrow',
              sourceMap: resolved.map,
              warpEvent,
              behavior,
              facing: player.dir,
            };
            if (isDebugMode()) {
              console.log('[ARROW_WARP_START]', { trigger });
            }
            startAutoDoorWarp(trigger, resolved, player, arrowDir, { isAnimatedDoor: false });
            return;
          }
          
          if (!requiresExitSeq) {
            if (isDebugMode()) {
              console.warn('[DOOR_WARP_ATTEMPT] Called for non-door/non-arrow tile - REJECTING', {
                targetX: request.targetX,
                targetY: request.targetY,
                behavior,
                metatileId: getMetatileIdFromMapTile(resolved.mapTile),
              });
            }
            return;
          }
          
          const trigger: WarpTrigger = {
            kind: 'door', // Use 'door' for both animated and non-animated door sequences
            sourceMap: resolved.map,
            warpEvent,
            behavior,
            facing: player.dir,
          };
            // Use SOURCE tile's metatile ID for door animation (the door being entered)
            const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
            const startedAt = performance.now();
            
            // Only spawn door animation if this is an animated door
            // Non-animated doors (stairs) skip animation but still do entry sequence
            let openAnimId: number | null | undefined = undefined;
            if (isAnimated) {
              logDoor('entry: start door open (animated)', {
                worldX: request.targetX,
                worldY: request.targetY,
                metatileId,
                map: resolved.map.entry.id,
              });
              openAnimId = await doorAnimations.spawn(
                'open',
                request.targetX,
                request.targetY,
                metatileId,
                startedAt,
                true
              );
            } else {
              logDoor('entry: start (non-animated, no door animation)', {
                worldX: request.targetX,
                worldY: request.targetY,
                metatileId,
                map: resolved.map.entry.id,
              });
            }
          
          // Start the entry sequence using the door sequencer
          const entryResult = doorSequencer.startEntry({
            targetX: request.targetX,
            targetY: request.targetY,
            metatileId,
            isAnimatedDoor: isAnimated,
            entryDirection: player.dir as CardinalDirection,
            warpTrigger: trigger,
            openAnimId: openAnimId ?? undefined,
          }, startedAt);

          // If the sequencer wants to spawn an open animation and we haven't already
          if (entryResult.action === 'spawnOpenAnimation' && !openAnimId && isAnimated) {
            // Animation was already spawned above, set the ID
          }

          // Set the open animation ID if it was spawned
          if (openAnimId) {
            doorSequencer.setEntryOpenAnimId(openAnimId);
          }

          playerHiddenRef.current = false;
          player.lockInput();
        };

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
