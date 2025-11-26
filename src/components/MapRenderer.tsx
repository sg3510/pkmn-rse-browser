import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import UPNG from 'upng-js';
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
  loadBinary,
  type MetatileAttributes,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  getMetatileIdFromMapTile,
  SECONDARY_TILE_OFFSET,
} from '../utils/mapLoader';
// Palette, TilesetKind, getSpritePriorityForElevation, METATILE_LAYER_TYPE_*, MapTileData removed - now using RenderPipeline
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import type { CardinalDirection } from '../utils/metatileBehaviors';
import {
  getArrowDirectionFromBehavior,
  isArrowWarpBehavior,
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { computeCameraView, type CameraView } from '../utils/camera';
// WarpEvent type used via WarpTrigger from './map/utils'

const PROJECT_ROOT = '/pokeemerald';

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
  type LoadedAnimation,
  type DebugTileInfo,
} from './map/types';
import {
  resolveTileAt,
  findWarpEventAt,
  detectWarpTrigger,
  isVerticalObject,
  classifyWarpKind,
  computeReflectionState,
  type WarpTrigger,
} from './map/utils';
import { DebugRenderer } from './map/renderers/DebugRenderer';
import { ObjectRenderer } from './map/renderers/ObjectRenderer';
import { DialogBox, useDialog } from './dialog';
// Field effect types and controllers from refactored modules
import {
  type DoorSize,
  type DoorAnimDrawable,
  type DoorEntryStage,
  type DoorExitStage,
  DOOR_TIMING,
} from '../field/types';
import { FadeController } from '../field/FadeController';
import { ArrowOverlay } from '../field/ArrowOverlay';
import { WarpHandler } from '../field/WarpHandler';
import { isDoorAnimationDone } from '../field/DoorSequencer';
import { buildTilesetRuntime } from '../utils/tilesetUtils';
import { getSpritePriorityForElevation } from '../utils/elevationPriority';
import { npcSpriteCache, renderNPCs, renderNPCReflections, renderNPCGrassEffects } from '../game/npc';
import { getDoorAssetForMetatile, ARROW_SPRITE_PATH } from '../data/doorAssets';
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

interface EngineFrameResult {
  view: WorldCameraView | null;
  viewChanged: boolean;
  animationFrameChanged: boolean;
  shouldRender: boolean;
  timestamp: number;
}



// WarpTrigger imported from './map/utils'
// WarpHandler manages warp state (imported from '../field/WarpHandler')

// DoorSize and DoorAnimDrawable types imported from '../field/types'

interface DoorEntrySequence {
  stage: DoorEntryStage;
  trigger: WarpTrigger | null;
  targetX: number;
  targetY: number;
  metatileId: number;
  isAnimatedDoor?: boolean; // If false, skip door animation but still do entry sequence
  entryDirection?: CardinalDirection;
  openAnimId?: number;
  closeAnimId?: number;
  playerHidden?: boolean;
  waitStartedAt?: number;
}

interface DoorExitSequence {
  stage: DoorExitStage;
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  isAnimatedDoor?: boolean; // If false, skip door animation but still do scripted movement
  exitDirection?: 'up' | 'down' | 'left' | 'right'; // Direction to walk when exiting
  openAnimId?: number;
  closeAnimId?: number;
}

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
  const doorSpriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const doorAnimsRef = useRef<DoorAnimDrawable[]>([]);
  const doorAnimIdRef = useRef<number>(1);
  const playerHiddenRef = useRef<boolean>(false);

  // Dialog system for surf prompts, etc.
  const { showYesNo, showMessage, isOpen: dialogIsOpen } = useDialog();
  const surfPromptInProgressRef = useRef<boolean>(false);
  const itemPickupInProgressRef = useRef<boolean>(false);
  const currentTimestampRef = useRef<number>(0);
  // ArrowOverlay manages arrow warp indicator state
  const arrowOverlayRef = useRef<ArrowOverlay>(new ArrowOverlay());
  // WarpHandler manages warp detection and cooldown state
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  const arrowSpriteRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const arrowSpritePromiseRef = useRef<Promise<HTMLImageElement | HTMLCanvasElement> | null>(null);
  // Field sprites (grass, sand, splash, etc.) managed by useFieldSprites hook
  const fieldSprites = useFieldSprites();
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());
  // canvasRendererRef removed - now using RenderPipeline exclusively
  // viewportBufferRef removed - now using RenderPipeline exclusively
  const tilesetCacheRef = useRef<TilesetCanvasCache | null>(null); // Shared tileset cache
  const renderPipelineRef = useRef<RenderPipeline | null>(null); // Modular render pipeline
  const doorExitRef = useRef<DoorExitSequence>({
    stage: 'idle',
    doorWorldX: 0,
    doorWorldY: 0,
    metatileId: 0,
  });
  // FadeController manages screen fade in/out transitions
  const fadeRef = useRef<FadeController>(new FadeController());

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

  const ensureDoorSprite = useCallback(
    async (metatileId: number): Promise<{ image: HTMLImageElement; size: DoorSize }> => {
      const asset = getDoorAssetForMetatile(metatileId);
      const cached = doorSpriteCacheRef.current.get(asset.path);
      if (cached && cached.complete) {
        return { image: cached, size: asset.size };
      }
      const img = new Image();
      img.src = asset.path;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (err) => reject(err);
      });
      doorSpriteCacheRef.current.set(asset.path, img);
      return { image: img, size: asset.size };
    },
    []
  );

  const renderDoorAnimations = useCallback(
    (mainCtx: CanvasRenderingContext2D, view: WorldCameraView, now: number) => {
      const doorAnims = doorAnimsRef.current;
      if (doorAnims.length === 0) return;
      for (const anim of doorAnims) {
        const totalDuration = anim.frameCount * anim.frameDuration;
        const elapsed = now - anim.startedAt;
        
        // Skip rendering if animation is done AND not held
        if (elapsed >= totalDuration && !anim.holdOnComplete) continue;
        
        // Clamp elapsed time to totalDuration when holding on complete
        const clampedElapsed = anim.holdOnComplete ? Math.min(elapsed, totalDuration - 1) : elapsed;
        const frameIndexRaw = Math.floor(clampedElapsed / anim.frameDuration);
        const frameIndex =
          anim.direction === 'open' ? frameIndexRaw : Math.max(0, anim.frameCount - 1 - frameIndexRaw);
        const logKey = `${anim.id}:${frameIndex}`;
        if (!(anim as unknown as { _lastLog?: string })._lastLog || (anim as unknown as { _lastLog?: string })._lastLog !== logKey) {
          (anim as unknown as { _lastLog?: string })._lastLog = logKey;
          logDoor('anim-frame', {
            id: anim.id,
            dir: anim.direction,
            metatileId: anim.metatileId,
            frame: frameIndex,
            worldX: anim.worldX,
            worldY: anim.worldY,
            elapsed,
          });
        }
        const sy = frameIndex * anim.frameHeight;
        const sw = anim.image.width;
        const sh = anim.frameHeight;
        const dx = Math.round(anim.worldX * METATILE_SIZE - view.cameraWorldX);
        const dy = Math.round((anim.worldY - 1) * METATILE_SIZE - view.cameraWorldY);
        const dw = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE;
        const dh = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE * 2;
        mainCtx.drawImage(anim.image, 0, sy, sw, sh, dx, dy, dw, dh);
      }
    },
    []
  );


  const spawnDoorAnimation = useCallback(
    async (
      direction: 'open' | 'close',
      worldX: number,
      worldY: number,
      metatileId: number,
      startedAt: number,
      holdOnComplete: boolean = false
    ): Promise<number | null> => {
      // COMPREHENSIVE DEBUG LOGGING
      const stackTrace = new Error().stack;
      if (isDebugMode()) {
        console.log('[DOOR_SPAWN]', {
          direction,
          worldX,
          worldY,
          metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
          holdOnComplete,
          calledFrom: stackTrace?.split('\n')[2]?.trim() || 'unknown',
        });
      }
      
      try {
        const { image, size } = await ensureDoorSprite(metatileId);
        const frameCount = Math.max(1, Math.floor(image.height / DOOR_TIMING.FRAME_HEIGHT));
        const anim: DoorAnimDrawable = {
          id: doorAnimIdRef.current++,
          image,
          direction,
          frameCount,
          frameHeight: DOOR_TIMING.FRAME_HEIGHT,
          frameDuration: DOOR_TIMING.FRAME_DURATION_MS,
          worldX,
          worldY,
          size,
          startedAt,
          holdOnComplete,
          metatileId,
        };
        doorAnimsRef.current = [...doorAnimsRef.current, anim];
        logDoor('anim-start', { id: anim.id, direction, metatileId, frameCount, worldX, worldY });
        return anim.id;
      } catch (err) {
        if (isDebugMode()) {
          console.warn('Failed to spawn door animation', err);
        }
        return null;
      }
    },
    [ensureDoorSprite]
  );

  // isDoorAnimDone wrapper - uses imported isDoorAnimationDone from DoorSequencer
  const isDoorAnimDone = useCallback((anim: DoorAnimDrawable | undefined, now: number) => {
    return isDoorAnimationDone(anim, now);
  }, []);

  const pruneDoorAnimations = useCallback(
    (now: number) => {
      doorAnimsRef.current = doorAnimsRef.current.filter((anim) => {
        if (anim.holdOnComplete) {
          return true;
        }
        return !isDoorAnimationDone(anim, now);
      });
    },
    []
  );

  const ensureArrowSprite = useCallback((): Promise<HTMLImageElement | HTMLCanvasElement> => {
    if (arrowSpriteRef.current) {
      return Promise.resolve(arrowSpriteRef.current);
    }
    if (!arrowSpritePromiseRef.current) {
      arrowSpritePromiseRef.current = new Promise<HTMLImageElement | HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        img.src = ARROW_SPRITE_PATH;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to acquire arrow sprite context'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const colorCounts = new Map<number, number>();
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha === 0) continue;
            const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
          }
          let bgKey = 0;
          let bgCount = -1;
          for (const [key, count] of colorCounts.entries()) {
            if (count > bgCount) {
              bgKey = key;
              bgCount = count;
            }
          }
          const bgR = (bgKey >> 16) & 0xff;
          const bgG = (bgKey >> 8) & 0xff;
          const bgB = bgKey & 0xff;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imageData, 0, 0);
          arrowSpriteRef.current = canvas;
          resolve(canvas);
        };
        img.onerror = (err) => reject(err);
      }).finally(() => {
        arrowSpritePromiseRef.current = null;
      }) as Promise<HTMLImageElement | HTMLCanvasElement>;
    }
    return arrowSpritePromiseRef.current!;
  }, []);

  const updateArrowOverlay = useCallback(
    (
      player: PlayerController | null,
      ctx: RenderContext | null,
      resolvedTile: ResolvedTile | null,
      now: number,
      warpInProgress: boolean
    ) => {
      if (!player || !ctx || warpInProgress) {
        arrowOverlayRef.current.hide();
        return;
      }
      const tile = resolvedTile ?? resolveTileAt(ctx, player.tileX, player.tileY);
      if (!tile) {
        arrowOverlayRef.current.hide();
        return;
      }
      const behavior = tile.attributes?.behavior ?? -1;
      const arrowDir = getArrowDirectionFromBehavior(behavior);

      // Ensure arrow sprite is loaded
      if (arrowDir && !arrowSpriteRef.current && !arrowSpritePromiseRef.current) {
        ensureArrowSprite().catch((err) => {
          if (isDebugMode()) {
            console.warn('Failed to load arrow sprite', err);
          }
        });
      }

      // Update arrow overlay state using ArrowOverlay class
      arrowOverlayRef.current.update(
        player.dir,
        arrowDir,
        player.tileX,
        player.tileY,
        now,
        warpInProgress
      );
    },
    [ensureArrowSprite]
  );

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
  
  // Set global debug flag when debug enabled changes
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG] = debugOptions.enabled;
  }, [debugOptions.enabled]);

  // Player Controller


  const refreshDebugOverlay = useCallback(
    (ctx: RenderContext, player: PlayerController, view: WorldCameraView | null) => {
      if (!debugEnabledRef.current || !view) return;
      const mainCanvas = canvasRef.current;
      const dbgCanvas = debugCanvasRef.current;
      if (!dbgCanvas || !mainCanvas) return;

      DebugRenderer.renderDebugOverlay(
        ctx,
        player,
        view,
        mainCanvas,
        dbgCanvas,
        setCenterTileDebugInfo,
        debugTilesRef
      );
    },
    [setCenterTileDebugInfo]
  );

  // Render layer decomposition canvases
  const renderLayerDecomposition = useCallback((ctx: RenderContext, tileInfo: DebugTileInfo) => {
    if (!tileInfo || !tileInfo.inBounds) return;
    
    const bottomCanvas = bottomLayerCanvasRef.current;
    const topCanvas = topLayerCanvasRef.current;
    const compositeCanvas = compositeLayerCanvasRef.current;
    
    if (!bottomCanvas || !topCanvas || !compositeCanvas) return;

    DebugRenderer.renderLayerDecomposition(
      ctx,
      tileInfo,
      bottomCanvas,
      topCanvas,
      compositeCanvas
    );
  }, []);

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

  const handleCopyTileDebug = useCallback(async () => {
    const player = playerControllerRef.current;
    if (!player) return;
    const payload = {
      timestamp: new Date().toISOString(),
      player: {
        tileX: player.tileX,
        tileY: player.tileY,
        x: player.x,
        y: player.y,
        dir: player.dir,
      },
      reflectionState: reflectionStateRef.current,
      tiles: debugTilesRef.current,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy debug info', err);
    }
  }, []);

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

  const loadIndexedFrame = async (url: string) => {
    const buffer = await loadBinary(url);
    const img = UPNG.decode(buffer);

    let data: Uint8Array;
    if (img.ctype === 3 && img.depth === 4) {
      const packed = new Uint8Array(img.data);
      const unpacked = new Uint8Array(packed.length * 2);
      for (let i = 0; i < packed.length; i++) {
        const byte = packed[i];
        unpacked[i * 2] = (byte >> 4) & 0xF;
        unpacked[i * 2 + 1] = byte & 0xF;
      }
      data = unpacked;
    } else {
      data = new Uint8Array(img.data);
    }

    return { data, width: img.width, height: img.height };
  };

  const loadTilesetAnimations = useCallback(
    async (primaryId: string, secondaryId: string): Promise<LoadedAnimation[]> => {
      const loaded: LoadedAnimation[] = [];
      const requested = [
        ...(TILESET_ANIMATION_CONFIGS[primaryId] ?? []),
        ...(TILESET_ANIMATION_CONFIGS[secondaryId] ?? []),
      ];

      for (const def of requested) {
        try {
          const frames: Uint8Array[] = [];
          let width = 0;
          let height = 0;

          for (const framePath of def.frames) {
            const frame = await loadIndexedFrame(`${PROJECT_ROOT}/${framePath}`);
            frames.push(frame.data);
            width = frame.width;
            height = frame.height;
          }

          const tilesWide = Math.max(1, Math.floor(width / TILE_SIZE));
          const tilesHigh = Math.max(1, Math.floor(height / TILE_SIZE));
          const sequence = def.sequence ?? frames.map((_, i) => i);

          loaded.push({
            ...def,
            frames,
            width,
            height,
            tilesWide,
            tilesHigh,
            sequence,
            destinations: def.destinations,
          });
        } catch (err) {
          if (isDebugMode()) {
            console.warn(`Animation ${def.id} not loaded:`, err);
          }
        }
      }

      return loaded;
    },
    []
  );

  const computeAnimatedTileIds = (animations: LoadedAnimation[]) => {
    const primary = new Set<number>();
    const secondary = new Set<number>();

    for (const anim of animations) {
      for (const dest of anim.destinations) {
        let destId = dest.destStart;
        for (let ty = 0; ty < anim.tilesHigh; ty++) {
          for (let tx = 0; tx < anim.tilesWide; tx++) {
            if (anim.tileset === 'primary') {
              primary.add(destId);
            } else {
              secondary.add(destId);
            }
            destId++;
          }
        }
      }
    }

    return { primary, secondary };
  };

  const ensureTilesetRuntime = useCallback(
    async (tilesets: TilesetResources): Promise<TilesetRuntime> => {
      const cached = tilesetRuntimeCacheRef.current.get(tilesets.key);
      if (cached) return cached;
      const runtime = buildTilesetRuntime(tilesets);
      const animations = await loadTilesetAnimations(tilesets.primaryTilesetId, tilesets.secondaryTilesetId);
      runtime.animations = animations;
      runtime.animatedTileIds = computeAnimatedTileIds(animations);
      tilesetRuntimeCacheRef.current.set(tilesets.key, runtime);
      return runtime;
    },
    [loadTilesetAnimations]
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

      renderDoorAnimations(mainCtx, view, nowMs);
      // Render arrow overlay using ArrowOverlay class
      const arrowState = arrowOverlayRef.current.getState();
      if (arrowState && arrowSpriteRef.current) {
        ObjectRenderer.renderArrow(mainCtx, arrowState, arrowSpriteRef.current, view, nowMs);
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
          arrow: arrowSpriteRef.current,
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
          arrow: arrowSpriteRef.current,
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
    [renderDoorAnimations]
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

        let reanchorInFlight = false;
        // Reset WarpHandler and set initial position if anchor exists
        const warpHandler = warpHandlerRef.current;
        warpHandler.reset();
        if (anchor) {
          warpHandler.updateLastCheckedTile(startTileX, startTileY, anchor.entry.id);
        }
        let doorEntry: DoorEntrySequence = {
          stage: 'idle',
          trigger: null,
          targetX: 0,
          targetY: 0,
          metatileId: 0,
          entryDirection: 'up',
        };
        doorExitRef.current = {
          stage: 'idle',
          doorWorldX: 0,
          doorWorldY: 0,
          metatileId: 0,
        };
        const startAutoDoorWarp = (
          trigger: WarpTrigger,
          resolved: ResolvedTile,
          player: PlayerController,
          entryDirection: CardinalDirection = 'up',
          options?: { isAnimatedDoor?: boolean }
        ) => {
          if (doorEntry.stage !== 'idle') return false;
          const now = performance.now();
          const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
          logDoor('entry: auto door warp (non-animated)', {
            worldX: player.tileX,
            worldY: player.tileY,
            metatileId,
            behavior: trigger.behavior,
          });
          arrowOverlayRef.current.hide();
          doorEntry = {
            stage: 'waitingBeforeFade',
            trigger,
            targetX: player.tileX,
            targetY: player.tileY,
            metatileId,
            isAnimatedDoor: options?.isAnimatedDoor ?? false,
            entryDirection,
            playerHidden: false,
            waitStartedAt: now - 250,
          };
          warpHandler.setInProgress(true);
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
          reanchorInFlight = true;
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
                doorExitRef.current = {
                  stage: 'opening',
                  doorWorldX: destWorldX,
                  doorWorldY: destWorldY,
                  metatileId: destMetatileId,
                  isAnimatedDoor, // Store whether to play door animation
                  exitDirection, // Store which direction to walk when exiting
                };
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
                // No door exit sequence needed
                doorExitRef.current = {
                  stage: 'idle',
                  doorWorldX: 0,
                  doorWorldY: 0,
                  metatileId: 0,
                };
                // CRITICAL: Unlock input here since there's no door exit sequence to handle it
                playerControllerRef.current?.unlockInput();
                warpHandler.setInProgress(false);
              }
            } else if (options?.fromDoor) {
              fadeRef.current.startFadeIn(DOOR_TIMING.FADE_DURATION_MS, currentTimestampRef.current);
              playerHiddenRef.current = false;
              doorExitRef.current = {
                stage: 'idle',
                doorWorldX: 0,
                doorWorldY: 0,
                metatileId: 0,
              };
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
            doorAnimsRef.current = [];
          } catch (err) {
            console.error('Warp failed', err);
          } finally {
            if (shouldUnlockInput) {
              playerControllerRef.current?.unlockInput();
              warpHandler.setInProgress(false);
            }
            reanchorInFlight = false;
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
          if (doorEntry.stage === 'idle') return;
          const player = playerControllerRef.current;
          if (!player || !doorEntry.trigger) return;
          if (doorEntry.stage === 'opening') {
            // Only check for animation completion if this is an animated door
            if (doorEntry.isAnimatedDoor !== false) {
              const anim = doorEntry.openAnimId
                ? doorAnimsRef.current.find((a) => a.id === doorEntry.openAnimId)
                : null;
              const openDone = !anim || isDoorAnimDone(anim, now);
              if (openDone) {
                logDoor('entry: door fully open (animated), force step into tile', doorEntry.targetX, doorEntry.targetY);
                player.forceMove(doorEntry.entryDirection ?? 'up', true);
                doorEntry.stage = 'stepping';
              }
            } else {
              // Non-animated door: skip straight to stepping
              logDoor('entry: non-animated door, force step into tile', doorEntry.targetX, doorEntry.targetY);
              player.forceMove(doorEntry.entryDirection ?? 'up', true);
              doorEntry.stage = 'stepping';
            }
          } else if (doorEntry.stage === 'stepping') {
            if (!player.isMoving) {
              // Only spawn close animation if this is an animated door
              if (doorEntry.isAnimatedDoor !== false) {
                const startedAt = now;
                logDoor('entry: start door close (animated), hide player');
                spawnDoorAnimation(
                  'close',
                  doorEntry.targetX,
                  doorEntry.targetY,
                  doorEntry.metatileId,
                  startedAt
                ).then((closeAnimId) => {
                  doorEntry.closeAnimId = closeAnimId ?? undefined;
                });
                doorAnimsRef.current = doorAnimsRef.current.filter(
                  (anim) => anim.id !== doorEntry.openAnimId
                );
                doorEntry.stage = 'closing';
                playerHiddenRef.current = true;
                doorEntry.playerHidden = true;
              } else {
                // Non-animated door: skip straight to fading
                logDoor('entry: non-animated door, skip to fade');
                playerHiddenRef.current = true;
                doorEntry.playerHidden = true;
                doorEntry.stage = 'waitingBeforeFade';
                doorEntry.waitStartedAt = now;
              }
            }
          } else if (doorEntry.stage === 'closing') {
            const anim = doorEntry.closeAnimId
              ? doorAnimsRef.current.find((a) => a.id === doorEntry.closeAnimId)
              : null;
            const closeDone = !anim || isDoorAnimDone(anim, now);
            if (closeDone) {
              logDoor('entry: door close complete, showing base tile');
              // Remove the close animation so the base tile shows
              doorAnimsRef.current = doorAnimsRef.current.filter(
                (a) => a.id !== doorEntry.closeAnimId
              );
              doorEntry.stage = 'waitingBeforeFade';
              doorEntry.waitStartedAt = now;
            }
          } else if (doorEntry.stage === 'waitingBeforeFade') {
            const WAIT_DURATION = 250; // ms to show the closed door base tile before fading
            const waitDone = now - (doorEntry.waitStartedAt ?? now) >= WAIT_DURATION;
            if (waitDone) {
              logDoor('entry: start fade out');
              fadeRef.current.startFadeOut(DOOR_TIMING.FADE_DURATION_MS, now);
              doorEntry.stage = 'fadingOut';
            }
          } else if (doorEntry.stage === 'fadingOut') {
            // Check if fade out is complete using FadeController
            const fadeDone = !fadeRef.current.isActive() || fadeRef.current.isComplete(now);
            if (fadeDone) {
              doorEntry.stage = 'warping';
              void (async () => {
                logDoor('entry: warp now');
                await performWarp(doorEntry.trigger as WarpTrigger, { force: true, fromDoor: true });
                doorEntry = {
                  stage: 'idle',
                  trigger: null,
                  targetX: 0,
                  targetY: 0,
                  metatileId: 0,
                  playerHidden: false,
                };
              })();
            }
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
            if (doorEntry.stage !== 'idle' || warpHandler.isInProgress()) return;
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
              openAnimId = await spawnDoorAnimation(
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
          
          doorEntry = {
            stage: 'opening',
            trigger,
            targetX: request.targetX,
            targetY: request.targetY,
            metatileId,
            isAnimatedDoor: isAnimated, // Track whether to animate
            openAnimId: openAnimId ?? undefined,
            playerHidden: false,
          };
          warpHandler.setInProgress(true);
          playerHiddenRef.current = false;
          player.lockInput();
        };

        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarpAttempt);

        const runUpdate = (deltaMs: number, timestamp: number) => {
          if (generation !== renderGenerationRef.current) {
            lastFrameResultRef.current = {
              view: null,
              viewChanged: false,
              animationFrameChanged: false,
              shouldRender: false,
              timestamp,
            };
            return { needsRender: false, viewChanged: false, animationFrameChanged: false, playerDirty: false };
          }

          const ctx = renderContextRef.current;
          if (!ctx) {
            lastFrameResultRef.current = {
              view: null,
              viewChanged: false,
              animationFrameChanged: false,
              shouldRender: false,
              timestamp,
            };
            return { needsRender: false, viewChanged: false, animationFrameChanged: false, playerDirty: false };
          }

          const safeDelta = Math.min(deltaMs, 50);
          currentTimestampRef.current = timestamp;

          // DEBUG: Track player position at start of each update
          {
            const p = playerControllerRef.current;
            if (p) {
              const posKey = `${p.tileX},${p.tileY},${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              if ((window as unknown as Record<string, unknown>).__lastPosKey !== posKey) {
                console.log(`[FRAME_POS] tile:(${p.tileX},${p.tileY}) pixel:(${p.x.toFixed(1)},${p.y.toFixed(1)}) moving:${p.isMoving} dir:${p.dir}`);
                (window as unknown as Record<string, unknown>).__lastPosKey = posKey;
              }
            }
          }

          pruneDoorAnimations(timestamp);
          advanceDoorEntry(timestamp);
          const doorExit = doorExitRef.current;
          if (doorExit.stage === 'opening') {
            // Only spawn door animation if this is an animated door
            // Non-animated doors (stairs) skip animation but still do scripted movement
            if (doorExit.isAnimatedDoor !== false) {
              if (doorExit.openAnimId === undefined) {
                logDoor('exit: start door open', {
                  worldX: doorExit.doorWorldX,
                  worldY: doorExit.doorWorldY,
                  metatileId: doorExit.metatileId,
                  isAnimatedDoor: doorExit.isAnimatedDoor,
                });
                spawnDoorAnimation('open', doorExit.doorWorldX, doorExit.doorWorldY, doorExit.metatileId, timestamp, true).then(
                  (id) => {
                    doorExitRef.current.openAnimId = id ?? undefined;
                  }
                );
              }
              const anim = doorExit.openAnimId
                ? doorAnimsRef.current.find((a) => a.id === doorExit.openAnimId)
                : null;
              const done = !anim || isDoorAnimDone(anim, timestamp);
              if (done) {
                const exitDir = doorExit.exitDirection ?? 'down';
                logDoor('exit: step out of door (animated)', { exitDirection: exitDir });
                playerControllerRef.current?.forceMove(exitDir, true);
                playerHiddenRef.current = false;
                doorExitRef.current.stage = 'stepping';
              }
            } else {
              // Non-animated door: skip straight to stepping
              const exitDir = doorExit.exitDirection ?? 'down';
              logDoor('exit: step out of door (non-animated, no door animation)', { exitDirection: exitDir });
              playerControllerRef.current?.forceMove(exitDir, true);
              playerHiddenRef.current = false;
              doorExitRef.current.stage = 'stepping';
            }
          } else if (doorExit.stage === 'stepping') {
            if (!playerControllerRef.current?.isMoving) {
              // Only close door animation if this is an animated door
              if (doorExit.isAnimatedDoor !== false) {
                const start = timestamp;
                logDoor('exit: start door close (animated)');
                // Remove the open animation now that we're starting the close
                doorAnimsRef.current = doorAnimsRef.current.filter(
                  (anim) => anim.id !== doorExit.openAnimId
                );
                spawnDoorAnimation('close', doorExit.doorWorldX, doorExit.doorWorldY, doorExit.metatileId, start).then(
                  (id) => {
                    doorExitRef.current.closeAnimId = id ?? undefined;
                  }
                );
                doorExitRef.current.stage = 'closing';
              } else {
                // Non-animated door: skip straight to done, unlock immediately
                logDoor('exit: done (non-animated, no door close)');
                doorExitRef.current.stage = 'done';
                warpHandler.setInProgress(false);
                playerControllerRef.current?.unlockInput();
                playerHiddenRef.current = false;
              }
            }
          } else if (doorExit.stage === 'closing') {
            const anim = doorExit.closeAnimId
              ? doorAnimsRef.current.find((a) => a.id === doorExit.closeAnimId)
              : null;
            const done = !anim || isDoorAnimDone(anim, timestamp);
            if (done) {
              logDoor('exit: door close complete');
              // Remove the close animation so the base tile shows
              doorAnimsRef.current = doorAnimsRef.current.filter(
                (a) => a.id !== doorExit.closeAnimId
              );
              doorExitRef.current.stage = 'done';
              warpHandler.setInProgress(false);
              playerControllerRef.current?.unlockInput();
              playerHiddenRef.current = false;
            }
          }
          warpHandler.update(safeDelta);
          const playerDirty = playerControllerRef.current?.update(safeDelta) ?? false;
          const player = playerControllerRef.current;
          if (player && ctx) {
            const resolvedForWarp = resolveTileAt(ctx, player.tileX, player.tileY);
            const lastChecked = warpHandler.getState().lastCheckedTile;
            const tileChanged =
              !lastChecked ||
              lastChecked.mapId !== resolvedForWarp?.map.entry.id ||
              lastChecked.x !== player.tileX ||
              lastChecked.y !== player.tileY;
            if (tileChanged && resolvedForWarp) {
              const behavior = resolvedForWarp.attributes?.behavior ?? -1;
              if (isDebugMode() && (behavior === 96 || behavior === 97)) {
                console.log('[TILE_CHANGED_STAIR_LADDER]', {
                  playerTile: { x: player.tileX, y: player.tileY },
                  behavior: `0x${behavior.toString(16)} (${behavior})`,
                  mapId: resolvedForWarp.map.entry.id,
                  warpInProgress: warpHandler.isInProgress(),
                  warpOnCooldown: warpHandler.isOnCooldown(),
                });
              }
              warpHandler.updateLastCheckedTile(player.tileX, player.tileY, resolvedForWarp.map.entry.id);
              if (!warpHandler.isInProgress() && !warpHandler.isOnCooldown()) {
                const trigger = detectWarpTrigger(ctx, player);
                if (trigger) {
                  // Arrow warps are handled through PlayerController's doorWarpHandler
                  // (triggered when player tries to move in the arrow direction)
                  if (trigger.kind === 'arrow') {
                    // Do nothing - wait for player movement input
                    if (isDebugMode()) {
                      console.log('[DETECT_WARP] Arrow warp detected, waiting for player input');
                    }
                  } else if (isNonAnimatedDoorBehavior(trigger.behavior)) {
                    startAutoDoorWarp(trigger, resolvedForWarp, player, 'up', { isAnimatedDoor: false });
                  } else {
                    void performWarp(trigger);
                  }
                }
              }
            }
            updateArrowOverlay(player, ctx, resolvedForWarp, timestamp, warpHandler.isInProgress());
          } else {
            updateArrowOverlay(null, null, null, timestamp, warpHandler.isInProgress());
          }
          let view: WorldCameraView | null = null;
          if (player) {
            const focus = player.getCameraFocus();
            if (focus) {
              const bounds = ctx.world.bounds;
              const padX = VIEWPORT_CONFIG.tilesWide;
              const padY = VIEWPORT_CONFIG.tilesHigh;
              const paddedMinX = bounds.minX - padX;
              const paddedMinY = bounds.minY - padY;
              const paddedMaxX = bounds.maxX + padX;
              const paddedMaxY = bounds.maxY + padY;
              const worldWidth = paddedMaxX - paddedMinX;
              const worldHeight = paddedMaxY - paddedMinY;
              const baseView = computeCameraView(
                worldWidth,
                worldHeight,
                focus.x - paddedMinX * METATILE_SIZE,
                focus.y - paddedMinY * METATILE_SIZE,
                VIEWPORT_CONFIG
              );
              view = {
                ...baseView,
                worldStartTileX: baseView.startTileX + paddedMinX,
                worldStartTileY: baseView.startTileY + paddedMinY,
                cameraWorldX: baseView.cameraX + paddedMinX * METATILE_SIZE,
                cameraWorldY: baseView.cameraY + paddedMinY * METATILE_SIZE,
              };
            }
          }
          cameraViewRef.current = view;

          // DEBUG: Track camera position changes
          if (view) {
            const camKey = `${view.cameraWorldX.toFixed(1)},${view.cameraWorldY.toFixed(1)}`;
            if ((window as unknown as Record<string, unknown>).__lastCamKey !== camKey) {
              const prevCam = (window as unknown as Record<string, unknown>).__lastCamKey as string | undefined;
              if (prevCam) {
                const [prevX, prevY] = prevCam.split(',').map(Number);
                const deltaX = view.cameraWorldX - prevX;
                const deltaY = view.cameraWorldY - prevY;
                // Only log if camera jumped more than 2 pixels (could indicate teleport)
                if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                  console.log(`[CAMERA_JUMP] cam:(${prevX.toFixed(1)},${prevY.toFixed(1)}) -> (${view.cameraWorldX.toFixed(1)},${view.cameraWorldY.toFixed(1)}) delta:(${deltaX.toFixed(1)},${deltaY.toFixed(1)})`);
                }
              }
              (window as unknown as Record<string, unknown>).__lastCamKey = camKey;
            }
          }

          const viewKey = view
            ? `${view.worldStartTileX},${view.worldStartTileY},${view.tilesWide},${view.tilesHigh}`
            : '';
          const viewChanged = viewKey !== lastViewKeyRef.current;
          if (viewChanged) {
            lastViewKeyRef.current = viewKey;
          }

          // Detect if player entered a different map; re-anchor world if needed.
          if (!reanchorInFlight && player) {
            const resolved = resolveTileAt(ctx, player.tileX, player.tileY);
            if (resolved && resolved.map.entry.id !== ctx.anchor.entry.id) {
              reanchorInFlight = true;
              const targetId = resolved.map.entry.id;
              const targetOffsetX = resolved.map.offsetX;
              const targetOffsetY = resolved.map.offsetY;
              // DEBUG: Log re-anchor start
              console.log(`[REANCHOR] Starting: player at tile(${player.tileX},${player.tileY}) pixel(${player.x.toFixed(1)},${player.y.toFixed(1)}) moving:${player.isMoving}`);
              (async () => {
                const newWorldRaw = await mapManagerRef.current.buildWorld(targetId, CONNECTION_DEPTH);
                // Shift new world so the target map stays at the same world offset as before reanchor.
                const newWorld = shiftWorld(newWorldRaw, targetOffsetX, targetOffsetY);
                await rebuildContextForWorld(newWorld, targetId);
                // FIX: Don't reset player position - shiftWorld maintains coordinate continuity.
                // The old setPosition() call was causing a jump/teleport back effect because:
                // 1. Player continued moving during async world rebuild
                // 2. setPosition() would snap player back to stale captured coordinates
                // 3. setPosition() resets isMoving=false and pixelsMoved=0, canceling sub-tile movement
                applyTileResolver();
                applyPipelineResolvers();
                // Invalidate pipeline caches after re-anchor
                renderPipelineRef.current?.invalidate();
                // Update warpHandler with current player position
                const currentPlayer = playerControllerRef.current;
                if (currentPlayer) {
                  // DEBUG: Log re-anchor complete
                  console.log(`[REANCHOR] Complete: player at tile(${currentPlayer.tileX},${currentPlayer.tileY}) pixel(${currentPlayer.x.toFixed(1)},${currentPlayer.y.toFixed(1)}) moving:${currentPlayer.isMoving}`);
                  warpHandler.updateLastCheckedTile(currentPlayer.tileX, currentPlayer.tileY, targetId);
                }
                warpHandler.setCooldown(Math.max(warpHandler.getCooldownRemaining(), 50));
              })().finally(() => {
                reanchorInFlight = false;
              });
            }
          }

          // Use AnimationTimer's tick count for animation timing
          // CRITICAL: Must use animationTimer (not raw timestamp) because GameLoop's
          // accumulator pattern can run multiple update cycles per RAF to catch up.
          // Raw timestamp stays the same for all iterations, but animationTimer.tickCount
          // advances with each iteration, ensuring animations progress correctly.
          const frameTick = animationTimerRef.current?.getTickCount() ?? 0;
          let animationFrameChanged = false;
          for (const runtime of ctx.tilesetRuntimes.values()) {
            const animationState: AnimationState = {};
            for (const anim of runtime.animations) {
              const seqIndex = Math.floor(frameTick / anim.interval);
              animationState[anim.id] = seqIndex;
            }
            const prevKey = runtime.lastPatchedKey;
            buildPatchedTilesForRuntime(runtime, animationState);
            if (runtime.lastPatchedKey !== prevKey) {
              animationFrameChanged = true;
            }
          }

          // CRITICAL FIX: Clear tileset cache when animation frames change
          // This ensures animated tiles show the correct frame (matching original code behavior)
          if (animationFrameChanged && tilesetCacheRef.current) {
            tilesetCacheRef.current.clear();
          }

          const shouldRender =
            animationFrameChanged ||
            playerDirty ||
            !hasRenderedRef.current ||
            viewChanged ||
            doorAnimsRef.current.length > 0 ||
            fadeRef.current.isActive() ||
            arrowOverlayRef.current.isVisible() || // Keep rendering while arrow animates
            debugOptionsRef.current.showCollisionOverlay || // Keep rendering while collision overlay is enabled
            debugOptionsRef.current.showElevationOverlay; // Keep rendering while elevation overlay is enabled

          // DEBUG: Log render decision
          if (!shouldRender && player?.isMoving) {
            console.warn(`[RENDER_SKIP] Player moving but shouldRender=false! animChanged=${animationFrameChanged} playerDirty=${playerDirty} viewChanged=${viewChanged}`);
          }
          const reflectionState = computeReflectionState(ctx, playerControllerRef.current);
          reflectionStateRef.current = reflectionState;

          lastFrameResultRef.current = {
            view,
            viewChanged,
            animationFrameChanged,
            shouldRender,
            timestamp,
          };

          return {
            needsRender: shouldRender,
            viewChanged,
            animationFrameChanged,
            playerDirty,
          };
        };

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
    loadTilesetAnimations,
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
