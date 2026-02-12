import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import { PlayerController } from '../game/PlayerController';
import { MapManager } from '../services/MapManager';
import { ObjectEventManager } from '../game/ObjectEventManager';
import { saveManager, type SaveData, type SaveResult, type LocationState } from '../save';
import { TilesetCanvasCache } from '../rendering/TilesetCanvasCache';
import type { IRenderPipeline } from '../rendering/IRenderPipeline';
import { AnimationTimer } from '../engine/AnimationTimer';
import { GameLoop } from '../engine/GameLoop';
import { ObservableState } from '../engine/GameState';
import { UpdateCoordinator } from '../engine/UpdateCoordinator';
import { METATILE_SIZE } from '../utils/mapLoader';
import { DEFAULT_VIEWPORT_CONFIG, getViewportPixelSize } from '../config/viewport';
import type { WorldCameraView } from '../rendering/types';

import {
  type ReflectionState,
  type RenderContext,
  type DebugTileInfo,
} from './map/types';
import { DialogBox, useDialog } from './dialog';
import { FadeController } from '../field/FadeController';
import { WarpHandler } from '../field/WarpHandler';
import { useDoorSequencer } from '../hooks/useDoorSequencer';
import { useDoorAnimations } from '../hooks/useDoorAnimations';
import { useArrowOverlay } from '../hooks/useArrowOverlay';
import { useDebugCallbacks } from '../hooks/useDebugCallbacks';
import { useRunUpdate, type RunUpdateRefs, type EngineFrameResult } from '../hooks/useRunUpdate';
import { useCompositeScene, type CompositeSceneRefs } from '../hooks/useCompositeScene';
import { useFieldSprites } from '../hooks/useFieldSprites';
import { DebugPanel, DEFAULT_DEBUG_OPTIONS, type DebugOptions, type DebugState } from './debug';
import { useWarpExecution, type WarpExecutionRefs } from '../hooks/useWarpExecution';
import { useActionInput } from '../hooks/useActionInput';
import { useTilesetPatching } from '../hooks/useTilesetPatching';
import { shiftWorld } from '../utils/worldUtils';
import { initializeGame } from './MapRendererInit';

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

export interface MapRendererHandle {
  saveGame: () => SaveResult;
  loadGame: () => SaveData | null;
  getPlayerPosition: () => { tileX: number; tileY: number; direction: string; mapId: string } | null;
}

// WorldCameraView is imported from src/rendering/types.ts (canonical definition)
export type { WorldCameraView };

const DEBUG_CELL_SCALE = 3;
const DEBUG_CELL_SIZE = METATILE_SIZE * DEBUG_CELL_SCALE;
const DEBUG_GRID_SIZE = DEBUG_CELL_SIZE * 3;
const VIEWPORT_CONFIG = DEFAULT_VIEWPORT_CONFIG;
const VIEWPORT_PIXEL_SIZE = getViewportPixelSize(VIEWPORT_CONFIG);
const CONNECTION_DEPTH = 2;

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
  // Core refs
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

  // Rendering refs
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
  const debugTilesRef = useRef<DebugTileInfo[]>([]);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const playerHiddenRef = useRef<boolean>(false);
  const currentTimestampRef = useRef<number>(0);
  const lastPlayerElevationRef = useRef<number>(0);

  // Tileset and pipeline refs
  const tilesetCacheRef = useRef<TilesetCanvasCache | null>(null);
  const renderPipelineRef = useRef<IRenderPipeline | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Field effect refs and controllers
  const warpHandlerRef = useRef<WarpHandler>(new WarpHandler());
  const fadeRef = useRef<FadeController>(new FadeController());
  const objectEventManagerRef = useRef<ObjectEventManager>(new ObjectEventManager());

  // Hooks for door animations and field effects
  const doorAnimations = useDoorAnimations();
  const arrowOverlay = useArrowOverlay();
  const fieldSprites = useFieldSprites();
  const doorSequencer = useDoorSequencer({ warpHandler: warpHandlerRef.current });

  // Dialog system
  const { showYesNo, showMessage, isOpen: dialogIsOpen } = useDialog();

  // Tileset patching hook
  const { buildPatchedTilesForRuntime, ensureTilesetRuntime, tilesetRuntimeCacheRef } = useTilesetPatching();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centerTileDebugInfo, setCenterTileDebugInfo] = useState<DebugTileInfo | null>(null);
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

  // Auxiliary canvas setup
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

  // Debug callbacks
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

  // Set up refs for useRunUpdate hook
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

  // useRunUpdate hook provides game update loop logic
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

  // Set up refs for useCompositeScene hook
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

  // useCompositeScene hook provides scene rendering logic
  const { compositeScene } = useCompositeScene({
    refs: compositeSceneRefs,
    doorAnimations,
    arrowOverlay,
    fieldSprites,
    ensureAuxiliaryCanvases,
  });

  // Action input hook (X key for surf, item pickup)
  useActionInput({
    playerControllerRef,
    objectEventManagerRef,
    dialogIsOpen,
    showMessage,
    showYesNo,
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
        isUnderwater: player.isUnderwater(),
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
        player.setTraversalState({
          surfing: saveData.location.isSurfing,
          underwater: saveData.location.isUnderwater ?? false,
        });
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

  // Sync debug options to refs
  useEffect(() => {
    debugEnabledRef.current = debugOptions.enabled;
    debugOptionsRef.current = debugOptions;
    if (debugOptions.enabled && renderContextRef.current && canvasRef.current && playerControllerRef.current) {
      refreshDebugOverlay(renderContextRef.current, playerControllerRef.current, cameraViewRef.current);
    }
  }, [debugOptions, refreshDebugOverlay]);

  // Update layer decomposition when center tile changes
  useEffect(() => {
    if (debugOptions.enabled && centerTileDebugInfo && renderContextRef.current) {
      renderLayerDecomposition(renderContextRef.current, centerTileDebugInfo);
    }
  }, [debugOptions.enabled, centerTileDebugInfo, renderLayerDecomposition]);

  // Initialize player controller
  useEffect(() => {
    playerControllerRef.current = new PlayerController();
    return () => {
      playerControllerRef.current?.destroy();
    };
  }, []);

  // Main game initialization effect - uses extracted hooks
  useEffect(() => {
    const generation = renderGenerationRef.current;

    initializeGame({
      mapId,
      generation,
      refs: {
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
        webglCanvasRef,
        gameLoopRef,
        updateCoordinatorRef,
        gameStateRef,
        objectEventManagerRef,
        warpHandlerRef,
        debugEnabledRef,
        tilesetRuntimeCacheRef,
      },
      hooks: {
        ensureTilesetRuntime,
        createRunUpdate,
        createWarpExecutors,
        resetDoorSequencer,
        fieldSpritesLoadAll: fieldSprites.loadAll,
        compositeScene,
        refreshDebugOverlay,
      },
      callbacks: {
        setLoading,
        setError,
        setDebugState,
        buildPatchedTilesForRuntime,
        shiftWorld,
      },
      connectionDepth: CONNECTION_DEPTH,
    });

    return () => {
      renderGenerationRef.current += 1;
      gameLoopRef.current?.stop();
    };
  }, [
    mapId,
    mapName,
    compositeScene,
    buildPatchedTilesForRuntime,
    refreshDebugOverlay,
    ensureTilesetRuntime,
    createRunUpdate,
    createWarpExecutors,
    resetDoorSequencer,
    fieldSprites.loadAll,
  ]);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      {loading && <div>Loading {mapName}...</div>}
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
        <DialogBox
          viewportWidth={VIEWPORT_PIXEL_SIZE.width * zoom}
          viewportHeight={VIEWPORT_PIXEL_SIZE.height * zoom}
        />
      </div>

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
