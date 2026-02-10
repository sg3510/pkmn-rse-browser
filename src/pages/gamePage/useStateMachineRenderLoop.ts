import { useEffect } from 'react';
import { GameState, type GameStateManager } from '../../core';

interface MutableRef<T> {
  current: T;
}

export interface UseStateMachineRenderLoopParams {
  currentState: GameState;
  stateManager: GameStateManager | null;
  zoom: number;
  stateCanvasRef: MutableRef<HTMLCanvasElement | null>;
  viewportPixelSizeRef: MutableRef<{ width: number; height: number }>;
}

export function useStateMachineRenderLoop(params: UseStateMachineRenderLoopParams): void {
  const {
    currentState,
    stateManager,
    zoom,
    stateCanvasRef,
    viewportPixelSizeRef,
  } = params;

  useEffect(() => {
    if (currentState === GameState.OVERWORLD) {
      console.log('[StateRenderLoop] Skipping - in OVERWORLD state');
      return;
    }

    if (!stateManager) {
      console.log('[StateRenderLoop] Skipping - no stateManager yet');
      return;
    }

    const stateCanvas = stateCanvasRef.current;
    if (!stateCanvas) {
      console.log('[StateRenderLoop] Skipping - no canvas ref');
      return;
    }

    console.log('[StateRenderLoop] Starting render loop for state:', currentState);

    const resizeCanvas = () => {
      const logicalWidth = viewportPixelSizeRef.current.width;
      const logicalHeight = viewportPixelSizeRef.current.height;

      const dpr = window.devicePixelRatio || 1;
      const scale = dpr * zoom;
      const targetWidth = Math.round(logicalWidth * scale);
      const targetHeight = Math.round(logicalHeight * scale);

      if (stateCanvas.width !== targetWidth || stateCanvas.height !== targetHeight) {
        stateCanvas.width = targetWidth;
        stateCanvas.height = targetHeight;
      }

      stateCanvas.style.width = `${logicalWidth * zoom}px`;
      stateCanvas.style.height = `${logicalHeight * zoom}px`;

      return { scale, logicalWidth, logicalHeight };
    };

    let { scale, logicalWidth, logicalHeight } = resizeCanvas();

    const ctx = stateCanvas.getContext('2d');
    if (!ctx) {
      console.log('[StateRenderLoop] Failed to get 2d context');
      return;
    }

    let lastTime = performance.now();
    let frameCount = 0;
    let animationId: number;

    const stateRenderLoop = () => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      frameCount++;

      ({ scale, logicalWidth, logicalHeight } = resizeCanvas());

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;

      stateManager.update(dt, frameCount);

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      stateManager.render(ctx);

      if (frameCount === 1) {
        console.log('[StateRenderLoop] First frame rendered');
      }

      animationId = requestAnimationFrame(stateRenderLoop);
    };

    animationId = requestAnimationFrame(stateRenderLoop);

    return () => {
      console.log('[StateRenderLoop] Cleanup');
      cancelAnimationFrame(animationId);
    };
  }, [currentState, stateManager, zoom, stateCanvasRef, viewportPixelSizeRef]);
}
