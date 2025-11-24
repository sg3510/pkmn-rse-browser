import React, { useCallback, useEffect, useRef, useState } from 'react';
import UPNG from 'upng-js';
import { PlayerController, type DoorWarpRequest } from '../game/PlayerController';
import { MapManager, type TilesetResources, type WorldState } from '../services/MapManager';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { ChunkManager, type RenderRegion, type ChunkStats, setChunkDebugOptions, getChunkDebugOptions } from '../rendering/ChunkManager';
import { DebugPanel, type DebugOptions, DEFAULT_DEBUG_OPTIONS } from './DebugPanel';
import {
  loadBinary,
  type Palette,
  type MapTileData,
  METATILE_SIZE,
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_SPLIT,
  getMetatileIdFromMapTile,
  SECONDARY_TILE_OFFSET,
} from '../utils/mapLoader';
import {
  TILESET_ANIMATION_CONFIGS,
  type TilesetKind,
} from '../data/tilesetAnimations';
import type { BridgeType, CardinalDirection } from '../utils/metatileBehaviors';
import {
  getArrowDirectionFromBehavior,

  isArrowWarpBehavior,
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
} from '../utils/metatileBehaviors';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import { computeCameraView } from '../utils/camera';
import { DialogSystem, useDialog } from './dialog';

const PROJECT_ROOT = '/pokeemerald';
const FRAME_MS = 1000 / 60;

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

import {
  type ReflectionType,
  type TilesetRuntime,
  type RenderContext,
  type ResolvedTile,
  type LoadedAnimation,
  type DebugTileInfo,
  type AnimationState,
  type WorldCameraView,
  type WarpTrigger,
  type ArrowOverlayState,
} from './map/types';
import {
  resolveTileAt,
  findWarpEventAt,
  detectWarpTrigger,
  isVerticalObject,
  classifyWarpKind,
  computeReflectionState,
} from './map/utils';
import { DebugRenderer } from './map/renderers/DebugRenderer';
import { ObjectRenderer } from './map/renderers/ObjectRenderer';
import {
  applyBehaviorOverrides,
  buildTilesetRuntime,
  buildPatchedTilesForRuntime,
} from './map/logic/TilesetProcessing';

import { logDoor } from './map/logic/DoorManager';
import {
  ensureGrassSprite,
  ensureLongGrassSprite,
  ensureSandSprite,
  ensureArrowSprite,
  getGrassSprite,
  getLongGrassSprite,
  getSandSprite,
  getArrowSprite,
} from './map/logic/FieldEffectAssets';
import { useDoorSystem } from './map/hooks/useDoorSystem';
import { useWarpSystem } from './map/hooks/useWarpSystem';
import { useMapInput } from './map/hooks/useMapInput';

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



// AnimationState moved to types.ts

interface TileDrawCall {
  tileId: number;
  destX: number;
  destY: number;
  palette: Palette;
  xflip: boolean;
  yflip: boolean;
  source: TilesetKind;
  layer: 0 | 1;
}







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
const CONNECTION_DEPTH = 3; // anchor + 3 levels of neighbors (needed for proper coverage when walking between maps)
const DEBUG_MODE_FLAG = 'DEBUG_MODE'; // Global debug flag for console logging
// ARROW_SPRITE_PATH moved to map/logic/FieldEffectAssets.ts
const DIRECTION_VECTORS: Record<CardinalDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Feature flag for hardware-accelerated rendering
// Set to false to fall back to original ImageData-based rendering
const USE_HARDWARE_RENDERING = true;
// Feature flag for chunk-based caching (currently used for background layer only) - off by default
const USE_CHUNK_CACHE = (() => {
  // Enable via ?enableChunks=1 or window.ENABLE_CHUNKS = true
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('enableChunks')) return true;
    if ((window as unknown as { ENABLE_CHUNKS?: boolean }).ENABLE_CHUNKS) return true;
  } catch {
    // Ignore in non-browser contexts
  }
  return false;
})();

interface ReflectionState {
  hasReflection: boolean;
  reflectionType: ReflectionType | null;
  bridgeType: BridgeType;
}



// Tileset processing logic moved to map/logic/TilesetProcessing.ts





const MapRendererContent: React.FC<MapRendererProps> = ({
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderContextRef = useRef<RenderContext | null>(null);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const cameraViewRef = useRef<WorldCameraView | null>(null);
  const mapManagerRef = useRef<MapManager>(new MapManager());
  const animRef = useRef<number>(0);
  const hasRenderedRef = useRef<boolean>(false);
  const renderGenerationRef = useRef<number>(0);
  const lastViewKeyRef = useRef<string>('');

  const backgroundImageDataRef = useRef<ImageData | null>(null);
  const topImageDataRef = useRef<ImageData | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugEnabledRef = useRef<boolean>(false);
  const reflectionStateRef = useRef<ReflectionState>({
    hasReflection: false,
    reflectionType: null,
    bridgeType: 'none',
  });
  const tilesetRuntimeCacheRef = useRef<Map<string, TilesetRuntime>>(new Map());
  const debugTilesRef = useRef<DebugTileInfo[]>([]);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  
  // Door system hook
  const {
    doorAnimsRef,
    doorExitRef,
    fadeRef,
    playerHiddenRef,
    doorEntryRef,
    spawnDoorAnimation,
    isDoorAnimDone,
    pruneDoorAnimations,
    renderDoorAnimations,
    handleDoorWarpAttempt,
    startAutoDoorWarp,
    advanceDoorEntry,
  } = useDoorSystem();

  const currentTimestampRef = useRef<number>(0);

  const applyTileResolver = useCallback(() => {
    if (playerControllerRef.current && renderContextRef.current) {
      playerControllerRef.current.setTileResolver((x, y) => {
        return resolveTileAt(renderContextRef.current!, x, y);
      });
    }
  }, []);

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
    async (world: WorldState, anchorId: string, options?: { preserveChunks?: boolean }) => {
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
      backgroundImageDataRef.current = null;
      topImageDataRef.current = null;
      backgroundCanvasDataRef.current = null;
      topBelowCanvasDataRef.current = null;
      topAboveCanvasDataRef.current = null;
      if (!options?.preserveChunks) {
        chunkManagerRef.current?.clear();
      }
      hasRenderedRef.current = false;
    },
    [ensureTilesetRuntime]
  );

  const {
    warpStateRef,
    performWarp,
    reanchorInFlightRef,
  } = useWarpSystem(
    mapManagerRef,
    playerControllerRef,
    renderContextRef,
    renderGenerationRef,
    rebuildContextForWorld,
    applyTileResolver,
    doorExitRef,
    fadeRef,
    doorAnimsRef,
    playerHiddenRef,
    backgroundImageDataRef,
    topImageDataRef,
    hasRenderedRef,
    currentTimestampRef
  );
  

  const reanchorPendingRef = useRef<{
    targetId: string;
    targetOffsetX: number;
    targetOffsetY: number;
    playerWorldX: number;
    playerWorldY: number;
    playerX: number;
    playerY: number;
    dir: CardinalDirection;
    pixelsMoved: number;
    wasMoving: boolean;
  } | null>(null);

  const performReanchor = useCallback(
    async (payload: {
      targetId: string;
      targetOffsetX: number;
      targetOffsetY: number;
      playerWorldX: number;
      playerWorldY: number;
      playerX: number;
      playerY: number;
      dir: CardinalDirection;
      pixelsMoved: number;
      wasMoving: boolean;
    }) => {
      if (reanchorInFlightRef.current) return;
      reanchorInFlightRef.current = true;
      try {
        let newWorldRaw: WorldState;
        const existing = reanchorBuildRef.current;
        if (existing && existing.targetId === payload.targetId && existing.result) {
          newWorldRaw = existing.result;
        } else if (existing && existing.targetId === payload.targetId) {
          newWorldRaw = await existing.promise;
          reanchorBuildRef.current = { ...existing, result: newWorldRaw };
        } else {
          const promise = mapManagerRef.current.buildWorld(payload.targetId, CONNECTION_DEPTH);
          reanchorBuildRef.current = {
            targetId: payload.targetId,
            offsetX: payload.targetOffsetX,
            offsetY: payload.targetOffsetY,
            promise,
          };
          newWorldRaw = await promise;
          reanchorBuildRef.current = { ...reanchorBuildRef.current, result: newWorldRaw };
        }
        // Shift new world so the target map stays at the same world offset as before reanchor.
        const newWorld = shiftWorld(newWorldRaw, payload.targetOffsetX, payload.targetOffsetY);
        await rebuildContextForWorld(newWorld, payload.targetId, { preserveChunks: true });
        const player = playerControllerRef.current;
        if (player) {
          player.setPosition(payload.playerWorldX, payload.playerWorldY);
          player.dir = payload.dir;
          if (payload.wasMoving) {
            // Restore mid-step interpolation so reanchor does not snap the player back.
            player.isMoving = true;
            player.pixelsMoved = payload.pixelsMoved;
            player.x = payload.playerX;
            player.y = payload.playerY;
          }
        }
        applyTileResolver();
        warpStateRef.current.lastCheckedTile = {
          mapId: payload.targetId,
          x: payload.playerWorldX,
          y: payload.playerWorldY,
        };
        warpStateRef.current.cooldownMs = Math.max(warpStateRef.current.cooldownMs, 50);
      } finally {
        reanchorPendingRef.current = null;
        reanchorInFlightRef.current = false;
      }
    },
    [applyTileResolver, mapManagerRef, rebuildContextForWorld, warpStateRef, reanchorInFlightRef]
  );

  const arrowOverlayRef = useRef<ArrowOverlayState | null>(null);
  const canvasRendererRef = useRef<CanvasRenderer | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const chunkClearPendingRef = useRef<{ mapId: string; worldX: number; worldY: number } | null>(null);
  const reanchorBuildRef = useRef<{
    targetId: string;
    offsetX: number;
    offsetY: number;
    promise: Promise<WorldState>;
    result?: WorldState;
  } | null>(null);

  const dialog = useDialog();
  const dialogOpenRef = useRef<boolean>(false);
  dialogOpenRef.current = dialog.isOpen;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugOptions, setDebugOptions] = useState<DebugOptions>(DEFAULT_DEBUG_OPTIONS);
  const [inspectTarget, setInspectTarget] = useState<{ tileX: number; tileY: number } | null>(null);
  const [centerTileDebugInfo, setCenterTileDebugInfo] = useState<DebugTileInfo | null>(null);
  const [chunkStats, setChunkStats] = useState<ChunkStats | null>(null);
  const chunkStatsUpdateRef = useRef<number>(0);

  const showTileDebug = debugOptions.enabled;
  const debugFocusMode = debugOptions.focusMode;

  const { handleCanvasClick } = useMapInput({
    playerControllerRef,
    cameraViewRef,
    canvasRef,
    showTileDebug,
    debugFocusMode,
    dialogIsOpen: dialog.isOpen,
    onInspectTile: (tileX, tileY) => {
      setInspectTarget({ tileX, tileY });
      if (renderContextRef.current) {
        refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current, { tileX, tileY });
      }
    },
    onSurfDialogShow: async (message, options) => {
      return await dialog.showYesNo(message, options);
    },
    onSurfMessageShow: async (message) => {
      await dialog.showMessage(message);
    },
  });

  const updateArrowOverlay = useCallback(
    (
      player: PlayerController | null,
      ctx: RenderContext | null,
      resolvedTile: ResolvedTile | null,
      now: number,
      warpInProgress: boolean
    ) => {
      if (!player || !ctx || warpInProgress) {
        arrowOverlayRef.current = null;
        return;
      }
      const tile = resolvedTile ?? resolveTileAt(ctx, player.tileX, player.tileY);
      if (!tile) {
        arrowOverlayRef.current = null;
        return;
      }
      const behavior = tile.attributes?.behavior ?? -1;
      const arrowDir = getArrowDirectionFromBehavior(behavior);
      if (!arrowDir || player.dir !== arrowDir) {
        arrowOverlayRef.current = null;
        return;
      }
      if (!getArrowSprite()) {
        ensureArrowSprite().catch((err) => {
          if (isDebugMode()) {
            console.warn('Failed to load arrow sprite', err);
          }
        });
      }
      const vector = DIRECTION_VECTORS[arrowDir];
      const overlayWorldX = player.tileX + vector.dx;
      const overlayWorldY = player.tileY + vector.dy;
      const prev = arrowOverlayRef.current;
      const isNewOverlay = !prev || !prev.visible || prev.direction !== arrowDir;
      arrowOverlayRef.current = {
        visible: true,
        worldX: overlayWorldX,
        worldY: overlayWorldY,
        direction: arrowDir,
        startedAt: isNewOverlay ? now : prev.startedAt,
      };
    },
    [ensureArrowSprite]
  );


  // Refs to avoid refreshDebugOverlay identity changes (which would trigger full map reload)
  const debugFocusModeRef = useRef(debugFocusMode);
  const inspectTargetRef = useRef(inspectTarget);
  const logChunkOperationsRef = useRef(debugOptions.logChunkOperations);
  debugFocusModeRef.current = debugFocusMode;
  inspectTargetRef.current = inspectTarget;
  logChunkOperationsRef.current = debugOptions.logChunkOperations;

  // Canvas refs for layer decomposition
  const bottomLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync debug options with chunk manager and global flag
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG] = debugOptions.enabled;
    setChunkDebugOptions({
      showBorders: debugOptions.showChunkBorders,
      logOperations: debugOptions.logChunkOperations,
    });
  }, [debugOptions]);

  // Player Controller


  const refreshDebugOverlay = useCallback(
    (
      ctx: RenderContext,
      player: PlayerController | null,
      view: WorldCameraView | null,
      centerOverride?: { tileX: number; tileY: number }
    ) => {
      if (!debugEnabledRef.current || !view) return;
      const mainCanvas = canvasRef.current;
      const dbgCanvas = debugCanvasRef.current;
      if (!dbgCanvas || !mainCanvas) return;

      // Use refs to avoid callback identity changes triggering map reload
      const focusMode = debugFocusModeRef.current;
      const target = inspectTargetRef.current;

      const centerTile =
        centerOverride ??
        (focusMode === 'inspect' && target
          ? target
          : player
            ? { tileX: player.tileX, tileY: player.tileY }
            : null);

      if (!centerTile) return;

      DebugRenderer.renderDebugOverlay(
        ctx,
        centerTile,
        player ?? undefined,
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
    debugEnabledRef.current = showTileDebug;
    if (
      showTileDebug &&
      renderContextRef.current &&
      canvasRef.current
    ) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [showTileDebug, refreshDebugOverlay]);

  useEffect(() => {
    if (!showTileDebug || !renderContextRef.current) return;
    refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
  }, [debugFocusMode, inspectTarget, showTileDebug, refreshDebugOverlay]);
  
  // Update layer decomposition when center tile changes
  useEffect(() => {
    if (showTileDebug && centerTileDebugInfo && renderContextRef.current) {
      renderLayerDecomposition(renderContextRef.current, centerTileDebugInfo);
    }
  }, [showTileDebug, centerTileDebugInfo, renderLayerDecomposition]);

// buildPatchedTilesForRuntime moved to map/logic/TilesetProcessing.ts

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



  const drawTileToImageData = (
    imageData: ImageData,
    drawCall: TileDrawCall,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ) => {
    const tiles = drawCall.source === 'primary' ? primaryTiles : secondaryTiles;
    const effectiveTileId =
      drawCall.source === 'secondary'
        ? drawCall.tileId % SECONDARY_TILE_OFFSET
        : drawCall.tileId;

    const tx = (effectiveTileId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const ty = Math.floor(effectiveTileId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE;
    const data = imageData.data;
    const widthPx = imageData.width;

    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const sourceX = tx + (drawCall.xflip ? TILE_SIZE - 1 - px : px);
        const sourceY = ty + (drawCall.yflip ? TILE_SIZE - 1 - py : py);
        const paletteIndex = tiles[sourceY * 128 + sourceX];
        if (paletteIndex === 0) continue;

        const targetX = drawCall.destX + px;
        const targetY = drawCall.destY + py;
        const pixelIndex = (targetY * widthPx + targetX) * 4;
        const colorHex = drawCall.palette.colors[paletteIndex];
        if (!colorHex) continue;

        data[pixelIndex] = parseInt(colorHex.slice(1, 3), 16);
        data[pixelIndex + 1] = parseInt(colorHex.slice(3, 5), 16);
        data[pixelIndex + 2] = parseInt(colorHex.slice(5, 7), 16);
        data[pixelIndex + 3] = 255;
      }
    }
  };

  // Hardware-accelerated version using Canvas drawImage
  const drawTileToCanvas = (
    ctx: CanvasRenderingContext2D,
    drawCall: TileDrawCall,
    primaryTiles: Uint8Array,
    secondaryTiles: Uint8Array
  ) => {
    const renderer = canvasRendererRef.current;
    if (!renderer) {
      // Fallback shouldn't happen, but handle gracefully
      if (isDebugMode()) {
        console.warn('Canvas renderer not initialized');
      }
      return;
    }

    renderer.drawTile(
      ctx,
      {
        tileId: drawCall.tileId,
        destX: drawCall.destX,
        destY: drawCall.destY,
        palette: drawCall.palette,
        xflip: drawCall.xflip,
        yflip: drawCall.yflip,
        source: drawCall.source,
      },
      primaryTiles,
      secondaryTiles  // FIX: Pass both tileset arrays correctly
    );
  };

  const topBelowImageDataRef = useRef<ImageData | null>(null);
  const topAboveImageDataRef = useRef<ImageData | null>(null);
  const lastPlayerElevationRef = useRef<number>(0);
  const lastPlayerMapIdRef = useRef<string>(''); // Track map changes to clear chunk cache

  // Canvas-based rendering refs (for hardware-accelerated mode)
  const backgroundCanvasDataRef = useRef<HTMLCanvasElement | null>(null);
  const topBelowCanvasDataRef = useRef<HTMLCanvasElement | null>(null);
  const topAboveCanvasDataRef = useRef<HTMLCanvasElement | null>(null);

  const renderPass = useCallback(
    (
      ctx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      view: WorldCameraView,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
    ): ImageData => {
      const widthPx = view.tilesWide * METATILE_SIZE;
      const heightPx = view.tilesHigh * METATILE_SIZE;
      const imageData = new ImageData(widthPx, heightPx);
      for (let localY = 0; localY < view.tilesHigh; localY++) {
        const tileY = view.worldStartTileY + localY;
        for (let localX = 0; localX < view.tilesWide; localX++) {
          const tileX = view.worldStartTileX + localX;
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved || !resolved.metatile) continue;

          // DEBUG: Trace rendering decision for specific tile
          if (tileX === 19 && tileY === 70) {
             const playerElev = playerControllerRef.current?.getElevation() ?? 0;
             const tileElev = resolved.mapTile.elevation;
             const tileCol = resolved.mapTile.collision;
             const filteredOut = elevationFilter ? !elevationFilter(resolved.mapTile, tileX, tileY) : false;
             if (isDebugMode()) {
               console.log(`[RENDER_DEBUG] Tile (19, 70) Pass=${pass} PlayerElev=${playerElev} TileElev=${tileElev} Col=${tileCol} FilteredOut=${filteredOut}`);
             }
          }
          
          // Apply elevation filter if provided
          if (elevationFilter && !elevationFilter(resolved.mapTile, tileX, tileY)) {
            continue;
          }

          const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
          if (!runtime) continue;

          const attr = resolved.attributes;
          const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

          const screenX = localX * METATILE_SIZE;
          const screenY = localY * METATILE_SIZE;

          const patchedTiles = runtime.patchedTiles ?? {
            primary: runtime.resources.primaryTilesImage,
            secondary: runtime.resources.secondaryTilesImage,
          };
          const animatedTileIds = runtime.animatedTileIds;
          const metatile = resolved.metatile;

          const drawLayer = (layer: number) => {
            for (let i = 0; i < 4; i++) {
              const tileIndex = layer * 4 + i;
              const tile = metatile.tiles[tileIndex];
              const tileSource: TilesetKind =
                tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';
              if (skipAnimated) {
                const shouldSkip =
                  tileSource === 'primary'
                    ? animatedTileIds.primary.has(tile.tileId)
                    : animatedTileIds.secondary.has(tile.tileId);
                const skipsForTopPass = pass === 'top' && layer === 1 && shouldSkip;
                const skipsForBottomPass = pass === 'background' && shouldSkip;
                if (skipsForTopPass || skipsForBottomPass) continue;
              }

              const subX = (i % 2) * TILE_SIZE;
              const subY = Math.floor(i / 2) * TILE_SIZE;
              // Palette selection based on palette INDEX, not tile source
              // Palettes 0-5 come from primary tileset, 6-15 from secondary
              // (Secondary tiles can use primary palettes and vice versa)
              const NUM_PALS_IN_PRIMARY = 6;
              const palette = tile.palette < NUM_PALS_IN_PRIMARY
                ? resolved.tileset.primaryPalettes[tile.palette]
                : resolved.tileset.secondaryPalettes[tile.palette];
              if (!palette) continue;

              drawTileToImageData(
                imageData,
                {
                  tileId: tile.tileId,
                  destX: screenX + subX,
                  destY: screenY + subY,
                  palette,
                  xflip: tile.xflip,
                  yflip: tile.yflip,
                  source: tileSource,
                  layer: layer as 0 | 1,
                },
                patchedTiles.primary,
                patchedTiles.secondary
              );
            }
          };

          if (pass === 'background') {
            // Background pass: always draw layer 0
            drawLayer(0);
            // For COVERED type, also draw layer 1 in background (both layers behind player)
            if (layerType === METATILE_LAYER_TYPE_COVERED) {
              drawLayer(1);
            }
            // For SPLIT type, layer 1 goes to top pass only (layer 0 behind, layer 1 above player)
          } else {
            // Top pass: draw layer 1 for NORMAL and SPLIT types (above player)
            if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
              // CRITICAL FIX: Check elevation filter before rendering
              // If an elevationFilter is provided, only render if the filter returns true
              // This allows splitting NORMAL tiles between topBelow and topAbove passes
              const shouldRender = !elevationFilter || elevationFilter(resolved.mapTile, tileX, tileY);
              
              if (shouldRender) {
                // Debug logging for metatile 13
                if (isDebugMode() && metatile.id === 13 && tileX >= 0 && tileX < 5 && tileY >= 0 && tileY < 5) {
                  console.log(`[METATILE 13] Top pass rendering layer 1 at (${tileX}, ${tileY}), layerType=${layerType}`);
                }
                drawLayer(1);
              } else if (isDebugMode() && metatile.id >= 14 && metatile.id <= 15) {
                console.log(`[RENDER_FIX] Skipping metatile ${metatile.id} at (${tileX}, ${tileY}) due to elevation filter. Elev=${resolved.mapTile.elevation}, PlayerElev=${playerControllerRef.current?.getElevation()}`);
              }
            }
          }
        }
      }

      return imageData;
    },
    []
  );

  const drawRegionToContext = useCallback(
    (
      targetCtx: CanvasRenderingContext2D,
      renderCtx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      onlyAnimated: boolean,
      startTileX: number,
      startTileY: number,
      tilesWide: number,
      tilesHigh: number,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
    ) => {
      for (let localY = 0; localY < tilesHigh; localY++) {
        const tileY = startTileY + localY;
        for (let localX = 0; localX < tilesWide; localX++) {
          const tileX = startTileX + localX;
          const resolved = resolveTileAt(renderCtx, tileX, tileY);
          if (!resolved || !resolved.metatile) continue;

          // DEBUG: Trace rendering decision for specific tile
          if (tileX === 19 && tileY === 70) {
            const playerElev = playerControllerRef.current?.getElevation() ?? 0;
            const tileElev = resolved.mapTile.elevation;
            const tileCol = resolved.mapTile.collision;
            const filteredOut = elevationFilter ? !elevationFilter(resolved.mapTile, tileX, tileY) : false;
            if (isDebugMode()) {
              console.log(`[RENDER_DEBUG_CANVAS] Tile (19, 70) Pass=${pass} PlayerElev=${playerElev} TileElev=${tileElev} Col=${tileCol} FilteredOut=${filteredOut}`);
            }
          }

          // Apply elevation filter if provided
          if (elevationFilter && !elevationFilter(resolved.mapTile, tileX, tileY)) {
            continue;
          }

          const runtime = renderCtx.tilesetRuntimes.get(resolved.tileset.key);
          if (!runtime) continue;

          const attr = resolved.attributes;
          const layerType = attr ? attr.layerType : METATILE_LAYER_TYPE_COVERED;

          const screenX = localX * METATILE_SIZE;
          const screenY = localY * METATILE_SIZE;

          const patchedTiles = runtime.patchedTiles ?? {
            primary: runtime.resources.primaryTilesImage,
            secondary: runtime.resources.secondaryTilesImage,
          };
          const animatedTileIds = runtime.animatedTileIds;
          const metatile = resolved.metatile;

          const drawLayer = (layer: number) => {
            for (let i = 0; i < 4; i++) {
              const tileIndex = layer * 4 + i;
              const tile = metatile.tiles[tileIndex];
              const tileSource = tile.tileId >= SECONDARY_TILE_OFFSET ? 'secondary' : 'primary';

              if (skipAnimated) {
              const shouldSkip =
                tileSource === 'primary'
                  ? animatedTileIds.primary.has(tile.tileId)
                  : animatedTileIds.secondary.has(tile.tileId);
              const skipsForTopPass = pass === 'top' && layer === 1 && shouldSkip;
              const skipsForBottomPass = pass === 'background' && shouldSkip;
              if (skipsForTopPass || skipsForBottomPass) continue;
            }

            if (onlyAnimated) {
              const isAnimatedTile =
                tileSource === 'primary'
                  ? animatedTileIds.primary.has(tile.tileId)
                  : animatedTileIds.secondary.has(tile.tileId);
              if (!isAnimatedTile) continue;

              // FIX: For COVERED metatiles, don't draw animated bottom-layer tiles
              // at positions where the top layer has content. This prevents the
              // animated overlay from overwriting static rocks/content that was
              // already correctly rendered in the cached chunk.
              if (layerType === METATILE_LAYER_TYPE_COVERED && layer === 0) {
                const topLayerTileIndex = i + 4;  // Corresponding tile in top layer
                const topTile = metatile.tiles[topLayerTileIndex];
                // If top layer has a non-transparent tile (tileId != 0), skip this position
                if (topTile && topTile.tileId !== 0) {
                  continue;
                }
              }
            }

              const subX = (i % 2) * TILE_SIZE;
              const subY = Math.floor(i / 2) * TILE_SIZE;

              // Palette selection based on palette INDEX, not tile source
              // Palettes 0-5 come from primary tileset, 6-15 from secondary
              // (Secondary tiles can use primary palettes and vice versa)
              const NUM_PALS_IN_PRIMARY = 6;
              const palette = tile.palette < NUM_PALS_IN_PRIMARY
                ? resolved.tileset.primaryPalettes[tile.palette]
                : resolved.tileset.secondaryPalettes[tile.palette];
              if (!palette) continue;

              // Draw using hardware-accelerated renderer
              drawTileToCanvas(
                targetCtx,
                {
                  tileId: tile.tileId,
                  destX: screenX + subX,
                  destY: screenY + subY,
                  palette,
                  xflip: tile.xflip,
                  yflip: tile.yflip,
                  source: tileSource,
                  layer: layer as 0 | 1,
                },
                patchedTiles.primary,
                patchedTiles.secondary
              );
            }
          };

          if (pass === 'background') {
            drawLayer(0);
            if (layerType === METATILE_LAYER_TYPE_COVERED) {
              drawLayer(1);
            }
          } else {
            if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
              const shouldRender = !elevationFilter || elevationFilter(resolved.mapTile, tileX, tileY);
              
              if (shouldRender) {
                if (isDebugMode() && metatile.id === 13 && tileX >= 0 && tileX < 5 && tileY >= 0 && tileY < 5) {
                  console.log(`[METATILE 13] Top pass rendering layer 1 at (${tileX}, ${tileY}), layerType=${layerType}`);
                }
                drawLayer(1);
              } else if (isDebugMode() && metatile.id >= 14 && metatile.id <= 15) {
                console.log(`[RENDER_FIX] Skipping metatile ${metatile.id} at (${tileX}, ${tileY}) due to elevation filter. Elev=${resolved.mapTile.elevation}, PlayerElev=${playerControllerRef.current?.getElevation()}`);
              }
            }
          }
        }
      }
    },
    []
  );

  // NEW: Hardware-accelerated Canvas-based render pass
  // This is 5-10× faster than renderPass but produces IDENTICAL output
  const renderPassCanvas = useCallback(
    (
      ctx: RenderContext,
      pass: 'background' | 'top',
      skipAnimated: boolean,
      view: WorldCameraView,
      elevationFilter?: (mapTile: MapTileData, tileX: number, tileY: number) => boolean
    ): HTMLCanvasElement => {
      const widthPx = view.tilesWide * METATILE_SIZE;
      const heightPx = view.tilesHigh * METATILE_SIZE;
      
      // Create offscreen canvas for this pass
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const canvasCtx = canvas.getContext('2d', { alpha: true })!;
      drawRegionToContext(
        canvasCtx,
        ctx,
        pass,
        skipAnimated,
        false,
        view.worldStartTileX,
        view.worldStartTileY,
        view.tilesWide,
        view.tilesHigh,
        elevationFilter
      );

      return canvas;
    },
    [drawRegionToContext]
  );

  const getAnimationStateHash = useCallback((ctx: RenderContext): string => {
    const keys: string[] = [];
    ctx.tilesetRuntimes.forEach((runtime, runtimeKey) => {
      keys.push(`${runtimeKey}:${runtime.lastPatchedKey ?? ''}`);
    });
    return keys.join('|');
  }, []);

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
      const elevationChanged = lastPlayerElevationRef.current !== playerElevation;
      lastPlayerElevationRef.current = playerElevation;

      // Split rendering: Top layer split into "Below Player" and "Above Player"
      // This fixes the visual issue where player on a bridge (Elev 4) is covered by the bridge
      
      const usingChunkCache = USE_HARDWARE_RENDERING && USE_CHUNK_CACHE && !!chunkManagerRef.current;

      // Reset chunk frame stats at start of each frame (only when Log Chunk Operations is enabled)
      if (usingChunkCache && logChunkOperationsRef.current) {
        chunkManagerRef.current!.resetFrameStats();
      }

      if (USE_HARDWARE_RENDERING) {
        const needsBackgroundCanvas =
          !usingChunkCache &&
          (
            !backgroundCanvasDataRef.current ||
            animationFrameChanged ||
            viewChanged
          );

        if (usingChunkCache) {
          backgroundCanvasDataRef.current = null;
        }

        if (needsBackgroundCanvas) {
          backgroundCanvasDataRef.current = renderPassCanvas(ctx, 'background', false, view);
        }

        const needsTopRender =
          !topBelowCanvasDataRef.current ||
          !topAboveCanvasDataRef.current ||
          animationFrameChanged ||
          viewChanged ||
          elevationChanged;

        if (needsTopRender) {
          topBelowCanvasDataRef.current = renderPassCanvas(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return false;
              }
              // Elevation-based rendering:
              // - Player above tile elevation: tile renders below player (player is on higher level)
              // - Player at or below tile elevation: tile renders above player (default top-layer behavior)
              // This correctly handles:
              // - Bridges: when player is ON bridge (same elevation), bridge is below player
              // - Tree tops: when player walks under tree (same elevation), tree top is above player
              // The key is that bridge FLOOR tiles are in the bottom layer, not top layer.
              // Top layer contains decorative elements that should overlay the player at same elevation.
              if (playerElevation > mapTile.elevation) return true;
              return false;
            }
          );

          topAboveCanvasDataRef.current = renderPassCanvas(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return true;
              }
              // Elevation-based rendering (inverse of topBelow)
              if (playerElevation > mapTile.elevation) return false;
              return true;
            }
          );
        }
      } else {
        // Original ImageData mode
        const needsImageData =
          !backgroundImageDataRef.current || 
          !topBelowImageDataRef.current || 
          !topAboveImageDataRef.current || 
          animationFrameChanged || 
          viewChanged ||
          elevationChanged;

        if (needsImageData) {
          backgroundImageDataRef.current = renderPass(ctx, 'background', false, view);

          topBelowImageDataRef.current = renderPass(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return false;
              }
              // Elevation-based rendering:
              // - Player above tile elevation: tile renders below player (player is on higher level)
              // - Player at or below tile elevation: tile renders above player (default top-layer behavior)
              if (playerElevation > mapTile.elevation) return true;
              return false;
            }
          );

          topAboveImageDataRef.current = renderPass(
            ctx,
            'top',
            false,
            view,
            (mapTile, tileX, tileY) => {
              if (isVerticalObject(ctx, tileX, tileY)) {
                return true;
              }
              // Elevation-based rendering (inverse of topBelow)
              if (playerElevation > mapTile.elevation) return false;
              return true;
            }
          );
        }
      }
      // CRITICAL: Use same coordinate calculation as ChunkManager to avoid rounding artifacts
      // All layers must round in the same direction to prevent 1px flickering
      // Canvas starts at worldStartTileX * METATILE_SIZE in world coords
      // Screen position = world position - camera position
      const offsetX = Math.round(view.worldStartTileX * METATILE_SIZE - view.cameraWorldX);
      const offsetY = Math.round(view.worldStartTileY * METATILE_SIZE - view.cameraWorldY);

      mainCtx.clearRect(0, 0, widthPx, heightPx);
      
      const animHash = usingChunkCache ? 'static' : getAnimationStateHash(ctx);

      if (USE_HARDWARE_RENDERING) {
        // Hardware-accelerated Canvas mode - direct drawImage
        if (usingChunkCache && chunkManagerRef.current) {
          const renderBackgroundChunk = (chunkCtx: CanvasRenderingContext2D, region: RenderRegion) => {
            drawRegionToContext(
              chunkCtx,
              ctx,
              'background',
              false,
              false,
              region.startTileX,
              region.startTileY,
              region.width,
              region.height
            );
          };
          chunkManagerRef.current.drawLayer(mainCtx, view, 'background', animHash, renderBackgroundChunk);
          // Draw animated tiles as a lightweight overlay (no cache key churn)
          mainCtx.save();
          mainCtx.translate(offsetX, offsetY);
          drawRegionToContext(
            mainCtx,
            ctx,
            'background',
            false,
            true, // only animated tiles
            view.worldStartTileX,
            view.worldStartTileY,
            view.tilesWide,
            view.tilesHigh
          );
          mainCtx.restore();
        } else if (backgroundCanvasDataRef.current) {
          mainCtx.drawImage(backgroundCanvasDataRef.current, offsetX, offsetY);
        }

        if (topBelowCanvasDataRef.current) {
          mainCtx.drawImage(topBelowCanvasDataRef.current, offsetX, offsetY);
        }
      } else {
        // Original ImageData mode
        bgCtx.clearRect(0, 0, widthPx, heightPx);
        topCtx.clearRect(0, 0, widthPx, heightPx);
        
        if (backgroundImageDataRef.current) {
          bgCtx.putImageData(backgroundImageDataRef.current, offsetX, offsetY);
        }
        
        if (backgroundCanvasRef.current) {
          mainCtx.drawImage(backgroundCanvasRef.current, 0, 0);
        }

        if (topBelowImageDataRef.current && topCanvasRef.current) {
          topCtx.clearRect(0, 0, widthPx, heightPx);
          topCtx.putImageData(topBelowImageDataRef.current, offsetX, offsetY);
          mainCtx.drawImage(topCanvasRef.current, 0, 0);
        }
      }

      renderDoorAnimations(mainCtx, view, nowMs);
      if (arrowOverlayRef.current) {
        ObjectRenderer.renderArrow(mainCtx, arrowOverlayRef.current, getArrowSprite()!, view, nowMs);
      }
      if (player) {
        ObjectRenderer.renderReflection(mainCtx, player, reflectionState, view, ctx);
      }

      const playerY = player ? player.y : 0;

      // Render field effects behind player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: getGrassSprite(),
          longGrass: getLongGrassSprite(),
          sand: getSandSprite(),
          arrow: getArrowSprite(),
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'bottom');
      }

      // Render surf blob (if surfing or mounting/dismounting)
      // The blob is rendered BEFORE player so player appears on top
      if (player && !playerHiddenRef.current) {
        const surfCtrl = player.surfingController;
        const blobRenderer = player.surfBlobRenderer;
        const shouldRenderBlob = player.isSurfing() || surfCtrl.isJumping();

        if (shouldRenderBlob && blobRenderer.isReady()) {
          const bobOffset = blobRenderer.getBobOffset();
          let blobScreenX: number;
          let blobScreenY: number;

          // Determine blob position based on current animation phase
          if (surfCtrl.isJumpingOn()) {
            // MOUNTING: Blob is at target water tile (destination)
            // Player jumps FROM land TO blob
            const targetPos = surfCtrl.getTargetPosition();
            if (targetPos) {
              // Convert tile coords to pixel coords
              // Blob is centered on tile: tileX * 16 - 8 for 32px sprite on 16px tile
              const blobWorldX = targetPos.tileX * 16 - 8;
              const blobWorldY = targetPos.tileY * 16 - 16; // Sprite is 32px tall, anchor at bottom
              blobScreenX = Math.round(blobWorldX + bobOffset * 0 - view.cameraWorldX); // No X bob
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              // Fallback to player position
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else if (surfCtrl.isJumpingOff()) {
            // DISMOUNTING: Blob stays at fixed water tile position
            // Player jumps off TO land, blob remains on water
            const fixedPos = surfCtrl.getBlobFixedPosition();
            if (fixedPos) {
              // Convert tile coords to pixel coords
              const blobWorldX = fixedPos.tileX * 16 - 8;
              const blobWorldY = fixedPos.tileY * 16 - 16;
              blobScreenX = Math.round(blobWorldX - view.cameraWorldX);
              blobScreenY = Math.round(blobWorldY + bobOffset - view.cameraWorldY + 8);
            } else {
              // Fallback
              blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
              blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
            }
          } else {
            // Normal surfing: Blob follows player
            blobScreenX = Math.round(player.x - 8 - view.cameraWorldX);
            blobScreenY = Math.round(player.y + bobOffset - view.cameraWorldY + 8);
          }

          // DEBUG: Detect shivering during normal surfing movement
          if (player.isMoving && !surfCtrl.isJumping() && isDebugMode()) {
            const playerFrame = player.getFrameInfo();
            if (playerFrame) {
              const playerFinalX = Math.round(playerFrame.renderX - view.cameraWorldX);
              const playerFinalY = Math.round(playerFrame.renderY - view.cameraWorldY);

              // Track previous position to detect direction reversals
              const prevX = (window as any).__lastSurfX ?? playerFinalX;
              const prevY = (window as any).__lastSurfY ?? playerFinalY;
              (window as any).__lastSurfX = playerFinalX;
              (window as any).__lastSurfY = playerFinalY;

              const deltaX = playerFinalX - prevX;
              const deltaY = playerFinalY - prevY;

              // Check if movement is in wrong direction
              const dir = player.dir;
              const wrongDir =
                (dir === 'right' && deltaX < 0) ||
                (dir === 'left' && deltaX > 0) ||
                (dir === 'down' && deltaY < 0) ||
                (dir === 'up' && deltaY > 0);

              if (wrongDir || deltaX !== 0 || deltaY !== 0) {
                console.log('[SURF DEBUG]', {
                  dir,
                  delta: { x: deltaX, y: deltaY },
                  wrongDir: wrongDir ? '⚠️ SHIVER!' : 'ok',
                  blobFinal: { x: blobScreenX, y: blobScreenY },
                  playerFinal: { x: playerFinalX, y: playerFinalY },
                  raw: {
                    playerX: player.x.toFixed(4),
                    playerY: player.y.toFixed(4),
                    cameraX: view.cameraWorldX.toFixed(4),
                    cameraY: view.cameraWorldY.toFixed(4),
                  },
                  bobOffset,
                });
              }
            }
          }

          blobRenderer.render(mainCtx, blobScreenX, blobScreenY, player.dir);
        }
      }

      if (player && !playerHiddenRef.current) {
        player.render(mainCtx, view.cameraWorldX, view.cameraWorldY);
      }

      // Render field effects in front of player
      if (player) {
        const effects = player.getGrassEffectManager().getEffectsForRendering();
        const sprites = {
          grass: getGrassSprite(),
          longGrass: getLongGrassSprite(),
          sand: getSandSprite(),
          arrow: getArrowSprite(),
        };
        ObjectRenderer.renderFieldEffects(mainCtx, effects, sprites, view, playerY, 'top');
      }

      // 3. Draw Top Layer (Above Player)
      if (USE_HARDWARE_RENDERING) {
        if (topAboveCanvasDataRef.current) {
          mainCtx.drawImage(topAboveCanvasDataRef.current, offsetX, offsetY);
        }
      } else {
        if (topAboveImageDataRef.current && topCanvasRef.current) {
          topCtx.clearRect(0, 0, widthPx, heightPx);
          topCtx.putImageData(topAboveImageDataRef.current, offsetX, offsetY);
          mainCtx.drawImage(topCanvasRef.current, 0, 0);
        }
      }

      if (fadeRef.current.mode) {
        const elapsed = nowMs - fadeRef.current.startedAt;
        const t = Math.max(0, Math.min(1, elapsed / fadeRef.current.duration));
        const alpha = fadeRef.current.mode === 'out' ? t : 1 - t;
        mainCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        mainCtx.fillRect(0, 0, widthPx, heightPx);
        if (t >= 1) {
          fadeRef.current = { ...fadeRef.current, mode: null };
        }
      }

      if (isDebugMode()) {
        console.log(
          `[MapRender] view (${view.worldStartTileX}, ${view.worldStartTileY}) player (${playerControllerRef.current?.tileX}, ${playerControllerRef.current?.tileY})`
        );
      }
    },
    [renderPass, renderPassCanvas, renderDoorAnimations, drawRegionToContext, getAnimationStateHash]
  );

  // Sprite loading functions moved to map/logic/FieldEffectAssets.ts




  useEffect(() => {
    (window as unknown as { DEBUG_RENDER?: boolean }).DEBUG_RENDER = false;

    const loadAndRender = async () => {
      const generation = renderGenerationRef.current;

      try {
        setLoading(true);
        setError(null);
        backgroundImageDataRef.current = null;
        topImageDataRef.current = null;
        hasRenderedRef.current = false;
        renderContextRef.current = null;
        cameraViewRef.current = null;
        lastViewKeyRef.current = '';

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
        
        // Load grass sprite
        await ensureGrassSprite();
        await ensureLongGrassSprite();
        await ensureSandSprite();
        await ensureArrowSprite();
        
        // Initialize hardware-accelerated renderer
        if (USE_HARDWARE_RENDERING) {
          canvasRendererRef.current = new CanvasRenderer();
          chunkManagerRef.current = USE_CHUNK_CACHE ? new ChunkManager() : null;
          if (isDebugMode()) {
            console.log('[PERF] Hardware-accelerated rendering enabled');
          }
        } else {
          chunkManagerRef.current = null;
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
          const ctx = renderContextRef.current;
          if (!ctx) return null;
          const resolved = resolveTileAt(ctx, tileX, tileY);
          if (!resolved) return null;
          return { mapTile: resolved.mapTile, attributes: resolved.attributes };
        };
        player.setTileResolver(resolveTileForPlayer);
        // player.setDoorWarpHandler(handleDoorWarp); // This will be defined later
        playerControllerRef.current = player;

        // The original code had a try/catch block for loading a single sprite here.
        // This has been replaced by the new PlayerController initialization above.

        // const anchor = world.maps.find((m) => m.entry.id === mapId) ?? world.maps[0];
        // if (!anchor) {
        //   throw new Error('Failed to determine anchor map for warp setup');
        // }
        applyTileResolver();
        setLoading(false);

        let lastTime = 0;

        // Initialize warpStateRef and doorEntryRef from the hook
        warpStateRef.current = {
          inProgress: false,
          cooldownMs: 0,
          lastCheckedTile: anchor
            ? { mapId: anchor.entry.id, x: startTileX, y: startTileY }
            : undefined,
        };
        doorEntryRef.current = {
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
            const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
            arrowOverlayRef.current = null;
            startAutoDoorWarp(trigger, warpStateRef.current, playerControllerRef.current, metatileId, 'up');
          }
        };
        playerControllerRef.current?.setDoorWarpHandler(handleDoorWarp);



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
          const onDoorWarpRequest = async (request: DoorWarpRequest) => {
            if (doorEntryRef.current.stage !== 'idle' || warpStateRef.current.inProgress) return;
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
              const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
              arrowOverlayRef.current = null;
              startAutoDoorWarp(trigger, warpStateRef.current, player, metatileId, arrowDir, { isAnimatedDoor: false });
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
            
            // Call hook function
            handleDoorWarpAttempt(
              trigger,
              request.targetX,
              request.targetY,
              metatileId,
              warpStateRef.current,
              player
            );
          };

        playerControllerRef.current?.setDoorWarpHandler(onDoorWarpRequest);
        const loop = (timestamp: number) => {
          if (generation !== renderGenerationRef.current) {
            return;
          }
          if (!lastTime) lastTime = timestamp;
          const delta = timestamp - lastTime;
          lastTime = timestamp;

          const ctx = renderContextRef.current;
          if (!ctx) {
            animRef.current = requestAnimationFrame(loop);
            return;
          }

          const safeDelta = Math.min(delta, 50);
          currentTimestampRef.current = timestamp;
          pruneDoorAnimations(timestamp);
          advanceDoorEntry(timestamp, playerControllerRef.current!, performWarp);
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
                spawnDoorAnimation(
              doorExit.metatileId,
              doorExit.doorWorldX,
              doorExit.doorWorldY,
              'open',
              true
            ).then((id) => {
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

                logDoor('exit: start door close (animated)');
                // Remove the open animation now that we're starting the close
                doorAnimsRef.current = doorAnimsRef.current.filter(
                  (anim) => anim.id !== doorExit.openAnimId
                );
                spawnDoorAnimation(
              doorExit.metatileId,
              doorExit.doorWorldX,
              doorExit.doorWorldY,
              'close',
              false
            ).then((id) => {
                    doorExitRef.current.closeAnimId = id ?? undefined;
                  }
                );
                doorExitRef.current.stage = 'closing';
              } else {
                // Non-animated door: skip straight to done, unlock immediately
                logDoor('exit: done (non-animated, no door close)');
                doorExitRef.current.stage = 'done';
                warpStateRef.current.inProgress = false;
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
              warpStateRef.current.inProgress = false;
              playerControllerRef.current?.unlockInput();
              playerHiddenRef.current = false;
            }
          }
          warpStateRef.current.cooldownMs = Math.max(0, warpStateRef.current.cooldownMs - safeDelta);
          // Skip player input processing when dialog is open
          const playerDirty = dialogOpenRef.current
            ? false
            : (playerControllerRef.current?.update(safeDelta) ?? false);
          const player = playerControllerRef.current;
          if (player && ctx) {
            const resolvedForWarp = resolveTileAt(ctx, player.tileX, player.tileY);
            const lastChecked = warpStateRef.current.lastCheckedTile;
            const tileChanged =
              !lastChecked ||
              lastChecked.mapId !== resolvedForWarp?.map.entry.id ||
              lastChecked.x !== player.tileX ||
              lastChecked.y !== player.tileY;
            if (tileChanged && resolvedForWarp) {
              warpStateRef.current.lastCheckedTile = {
                mapId: resolvedForWarp.map.entry.id,
                x: player.tileX,
                y: player.tileY,
              };
              if (!warpStateRef.current.inProgress && warpStateRef.current.cooldownMs <= 0) {
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
                    const metatileId = getMetatileIdFromMapTile(resolvedForWarp.mapTile);
                    arrowOverlayRef.current = null;
                    startAutoDoorWarp(trigger, warpStateRef.current, player, metatileId, 'up', { isAnimatedDoor: false });
                  } else {
                    void performWarp(trigger);
                  }
                }
              }
            }
            updateArrowOverlay(player, ctx, resolvedForWarp, timestamp, warpStateRef.current.inProgress);
          } else {
            updateArrowOverlay(null, null, null, timestamp, warpStateRef.current.inProgress);
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
          const viewKey = view
            ? `${view.worldStartTileX},${view.worldStartTileY},${view.tilesWide},${view.tilesHigh}`
            : '';
          const viewChanged = viewKey !== lastViewKeyRef.current;
          if (viewChanged) {
            lastViewKeyRef.current = viewKey;
          }

          // Detect if player entered a different map; re-anchor world if needed.
          // To avoid hitching on every connected-map boundary, only re-anchor when near world edges.
          if (!reanchorInFlightRef.current && player) {
            const resolved = resolveTileAt(ctx, player.tileX, player.tileY);

            // Clear chunk cache when player enters a different map, but avoid doing so mid-move to prevent hitching.
            if (resolved) {
              const currentMapId = resolved.map.entry.id;
              if (currentMapId !== lastPlayerMapIdRef.current) {
                lastPlayerMapIdRef.current = currentMapId;
                if (player.isMoving) {
                  chunkClearPendingRef.current = { mapId: currentMapId, worldX: player.x, worldY: player.y };
                  if (getChunkDebugOptions().logOperations) {
                    console.log(`[CHUNK] Deferred cache clear until idle - entered map: ${currentMapId}`);
                  }
                } else {
                  chunkManagerRef.current?.invalidateAround(player.x, player.y, 3);
                  if (getChunkDebugOptions().logOperations) {
                    console.log(`[CHUNK] Invalidated chunks near player - entered map: ${currentMapId}`);
                  }
                }
              }
            }

            if (chunkClearPendingRef.current && !player.isMoving) {
              const pending = chunkClearPendingRef.current;
              chunkManagerRef.current?.invalidateAround(pending.worldX, pending.worldY, 3);
              if (pending && getChunkDebugOptions().logOperations) {
                console.log(`[CHUNK] Cleared deferred cache near player for map: ${pending.mapId}`);
              }
              chunkClearPendingRef.current = null;
            }

            // Run any deferred reanchor once movement has finished.
            if (reanchorPendingRef.current && !player.isMoving && !reanchorInFlightRef.current) {
              void performReanchor(reanchorPendingRef.current);
            }

            if (resolved && resolved.map.entry.id !== ctx.anchor.entry.id) {
              const bounds = ctx.world.bounds;
              const marginTiles = Math.max(VIEWPORT_CONFIG.tilesWide, VIEWPORT_CONFIG.tilesHigh);
              const nearEdge =
                player.tileX - bounds.minX < marginTiles ||
                bounds.maxX - player.tileX < marginTiles ||
                player.tileY - bounds.minY < marginTiles ||
                bounds.maxY - player.tileY < marginTiles;

              if (nearEdge && !reanchorInFlightRef.current) {
                const targetId = resolved.map.entry.id;
                const payload = {
                  targetId,
                  targetOffsetX: resolved.map.offsetX,
                  targetOffsetY: resolved.map.offsetY,
                  playerWorldX: player.tileX,
                  playerWorldY: player.tileY,
                  playerX: player.x,
                  playerY: player.y,
                  dir: player.dir,
                  pixelsMoved: player.pixelsMoved,
                  wasMoving: player.isMoving,
                };
                // Kick off background build for this target if not already started
                if (!reanchorBuildRef.current || reanchorBuildRef.current.targetId !== targetId) {
                  const promise = mapManagerRef.current.buildWorld(targetId, CONNECTION_DEPTH);
                  reanchorBuildRef.current = {
                    targetId,
                    offsetX: resolved.map.offsetX,
                    offsetY: resolved.map.offsetY,
                    promise,
                  };
                  promise.then((result) => {
                    // Save result unless another target superseded this one
                    if (reanchorBuildRef.current?.targetId === targetId) {
                      reanchorBuildRef.current = { ...reanchorBuildRef.current, result };
                    }
                  }).catch((err) => {
                    if (isDebugMode()) {
                      console.warn('[REANCHOR] Background build failed', err);
                    }
                  });
                }
                if (player.isMoving) {
                  reanchorPendingRef.current = payload;
                  if (isDebugMode()) {
                    console.log('[REANCHOR] Deferred until player stops moving', payload);
                  }
                } else {
                  void performReanchor(payload);
                }
              }
            }
          }

          const frameTick = Math.floor(timestamp / FRAME_MS);
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

          // CRITICAL FIX: Clear canvas cache when animation frames change
          // The palette canvas cache must be invalidated when tileset data changes (animations)
          if (animationFrameChanged && USE_HARDWARE_RENDERING && canvasRendererRef.current) {
            canvasRendererRef.current.clearCache();
          }

          const shouldRender =
            animationFrameChanged ||
            playerDirty ||
            !hasRenderedRef.current ||
            viewChanged ||
            doorAnimsRef.current.length > 0 ||
            fadeRef.current.mode !== null ||
            !!arrowOverlayRef.current?.visible; // Keep rendering while arrow animates
          const reflectionState = computeReflectionState(ctx, playerControllerRef.current);
          reflectionStateRef.current = reflectionState;

          if (shouldRender && view) {
            compositeScene(
              reflectionState,
              view,
              viewChanged,
              animationFrameChanged,
              currentTimestampRef.current
            );
            if (debugEnabledRef.current && playerControllerRef.current) {
              refreshDebugOverlay(ctx, playerControllerRef.current, view);
            }
            hasRenderedRef.current = true;

            // Update chunk stats for debug panel (throttled to ~10 Hz, only when Log Chunk Operations is enabled)
            if (logChunkOperationsRef.current && chunkManagerRef.current) {
              const now = timestamp;
              if (now - chunkStatsUpdateRef.current > 100) {
                chunkStatsUpdateRef.current = now;
                const stats = chunkManagerRef.current.getStats();
                // Add world bounds info
                stats.worldBounds = ctx.world.bounds;
                stats.loadedMapCount = ctx.world.maps.length;
                stats.loadedMaps = ctx.world.maps.map(m => ({
                  id: m.entry.id,
                  offsetX: m.offsetX,
                  offsetY: m.offsetY,
                  width: m.mapData.width,
                  height: m.mapData.height,
                }));
                setChunkStats(stats);
              }
            }
          }

          animRef.current = requestAnimationFrame(loop);
        };

        animRef.current = requestAnimationFrame(loop);
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
      if (animRef.current) cancelAnimationFrame(animRef.current);
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

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  // Calculate viewport dimensions for dialog system
  const viewportWidth = VIEWPORT_PIXEL_SIZE.width * zoom;
  const viewportHeight = VIEWPORT_PIXEL_SIZE.height * zoom;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
        <canvas
          ref={canvasRef}
          width={VIEWPORT_PIXEL_SIZE.width}
          height={VIEWPORT_PIXEL_SIZE.height}
          style={{
            display: 'block',
            border: '1px solid #ccc',
            imageRendering: 'pixelated',
            width: viewportWidth,
            height: viewportHeight,
          }}
          onClick={handleCanvasClick}
        />
      {/* Debug Panel - slides in from right side */}
      <DebugPanel
        options={debugOptions}
        onChange={(newOptions) => {
          // Handle focus mode change - clear inspect target when switching to player mode
          if (newOptions.focusMode === 'player' && debugOptions.focusMode === 'inspect') {
            setInspectTarget(null);
          }
          setDebugOptions(newOptions);
        }}
        tileInfo={centerTileDebugInfo}
        chunkStats={chunkStats}
        debugCanvasRef={debugCanvasRef}
        bottomLayerCanvasRef={bottomLayerCanvasRef}
        topLayerCanvasRef={topLayerCanvasRef}
        compositeLayerCanvasRef={compositeLayerCanvasRef}
        debugGridSize={DEBUG_GRID_SIZE}
      />
    </div>
  );
};

export const MapRenderer: React.FC<MapRendererProps> = (props) => {
  const zoom = props.zoom ?? 1;
  const viewportWidth = VIEWPORT_CONFIG.tilesWide * METATILE_SIZE * zoom;
  const viewportHeight = VIEWPORT_CONFIG.tilesHigh * METATILE_SIZE * zoom;

  return (
    <DialogSystem
      viewportWidth={viewportWidth}
      viewportHeight={viewportHeight}
      zoom={props.zoom}
      config={{
        frameStyle: 1,
        textSpeed: 'medium',
        linesVisible: 2,
      }}
    >
      <MapRendererContent {...props} />
    </DialogSystem>
  );
};
