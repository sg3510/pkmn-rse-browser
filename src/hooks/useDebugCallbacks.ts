/**
 * useDebugCallbacks Hook
 *
 * Provides debug-related callback functions for the MapRenderer.
 * Extracted to reduce component complexity.
 */

import { useCallback, useMemo, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { DebugRenderer } from '../components/map/renderers/DebugRenderer';
import type { RenderContext, DebugTileInfo, ReflectionState } from '../components/map/types';
import type { PlayerController } from '../game/PlayerController';
import type { WorldCameraView } from '../components/MapRendererTypes';

export interface UseDebugCallbacksOptions {
  /** Ref to main canvas */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Ref to debug canvas */
  debugCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Ref to debug enabled flag */
  debugEnabledRef: RefObject<boolean>;
  /** Ref to debug tiles array */
  debugTilesRef: RefObject<DebugTileInfo[]>;
  /** Ref to reflection state */
  reflectionStateRef: RefObject<ReflectionState>;
  /** Ref to player controller */
  playerControllerRef: RefObject<PlayerController | null>;
  /** Layer decomposition canvas refs */
  bottomLayerCanvasRef: RefObject<HTMLCanvasElement | null>;
  topLayerCanvasRef: RefObject<HTMLCanvasElement | null>;
  compositeLayerCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** State setter for center tile debug info */
  setCenterTileDebugInfo: Dispatch<SetStateAction<DebugTileInfo | null>>;
}

export interface UseDebugCallbacksReturn {
  /** Refresh the debug overlay */
  refreshDebugOverlay: (ctx: RenderContext, player: PlayerController, view: WorldCameraView | null) => void;
  /** Render layer decomposition canvases */
  renderLayerDecomposition: (ctx: RenderContext, tileInfo: DebugTileInfo) => void;
  /** Copy debug info to clipboard */
  handleCopyTileDebug: () => Promise<void>;
}

/**
 * Hook providing debug callback functions
 */
export function useDebugCallbacks(options: UseDebugCallbacksOptions): UseDebugCallbacksReturn {
  const {
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
  } = options;

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
    [canvasRef, debugCanvasRef, debugEnabledRef, debugTilesRef, setCenterTileDebugInfo]
  );

  const renderLayerDecomposition = useCallback(
    (ctx: RenderContext, tileInfo: DebugTileInfo) => {
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
    },
    [bottomLayerCanvasRef, topLayerCanvasRef, compositeLayerCanvasRef]
  );

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
  }, [playerControllerRef, reflectionStateRef, debugTilesRef]);

  return useMemo(() => ({
    refreshDebugOverlay,
    renderLayerDecomposition,
    handleCopyTileDebug,
  }), [refreshDebugOverlay, renderLayerDecomposition, handleCopyTileDebug]);
}
