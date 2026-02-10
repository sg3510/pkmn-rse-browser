/**
 * useGameLoop - Unified game loop with GBA-accurate frame timing
 *
 * Provides:
 * - Fixed timestep at 59.7275 Hz (true GBA vblank timing)
 * - Animation frame counter for tileset animations
 * - Shimmer animation updates
 * - Delta time tracking
 *
 * Used by both WebGL and Canvas2D renderers.
 */

import { useRef, useEffect, useCallback } from 'react';
import { getGlobalShimmer } from '../field/ReflectionRenderer';
import { GBA_FPS, GBA_FRAME_MS } from '../config/timing';

// Animation frame period: every 10 GBA frames (~167ms)
const ANIMATION_FRAME_TICKS = 10;

/**
 * Frame state passed to callbacks
 */
export interface GameFrameState {
  /** Current GBA frame counter (increments at 59.7275 Hz) */
  gbaFrame: number;
  /** Animation frame for tileset animations (gbaFrame / 10) */
  animationFrame: number;
  /** Time since last RAF call in ms */
  deltaTime: number;
  /** Current timestamp from performance.now() */
  timestamp: number;
  /** Whether animation frame changed this tick */
  animationFrameChanged: boolean;
}

/**
 * Update function called each fixed timestep
 */
export type GameUpdateFn = (deltaMs: number, timestamp: number) => void;

/**
 * Render function called each animation frame
 */
export type GameRenderFn = (state: GameFrameState) => void;

export interface UseGameLoopOptions {
  /** Whether the loop should be running */
  running?: boolean;
  /** Optional custom frame rate (default: GBA 59.7275 Hz) */
  frameRateHz?: number;
}

export interface UseGameLoopReturn {
  /** Current GBA frame counter */
  gbaFrame: number;
  /** Current animation frame */
  animationFrame: number;
  /** Start the game loop */
  start: () => void;
  /** Stop the game loop */
  stop: () => void;
  /** Whether the loop is currently running */
  isRunning: boolean;
}

/**
 * Hook for running a GBA-accurate game loop.
 *
 * @param onUpdate - Called each fixed timestep (game logic)
 * @param onRender - Called each RAF (rendering)
 * @param options - Loop configuration
 */
export function useGameLoop(
  onUpdate: GameUpdateFn,
  onRender: GameRenderFn,
  options: UseGameLoopOptions = {}
): UseGameLoopReturn {
  const { running: initialRunning = true, frameRateHz = GBA_FPS } = options;

  const frameMs = 1000 / frameRateHz;

  // Refs for loop state
  const runningRef = useRef(initialRunning);
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());
  const accumulatorRef = useRef(0);
  const gbaFrameRef = useRef(0);
  const lastAnimationFrameRef = useRef(0);

  // Refs for callbacks (avoid stale closures)
  const onUpdateRef = useRef(onUpdate);
  const onRenderRef = useRef(onRender);
  onUpdateRef.current = onUpdate;
  onRenderRef.current = onRender;

  const tick = useCallback((currentTime: number) => {
    if (!runningRef.current) return;

    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;
    accumulatorRef.current += deltaTime;

    // Update shimmer animation
    getGlobalShimmer().update(currentTime);

    // Fixed timestep loop
    while (accumulatorRef.current >= frameMs) {
      accumulatorRef.current -= frameMs;
      gbaFrameRef.current++;

      // Call update function each fixed step
      onUpdateRef.current(frameMs, currentTime);
    }

    // Calculate animation frame
    const animationFrame = Math.floor(gbaFrameRef.current / ANIMATION_FRAME_TICKS);
    const animationFrameChanged = animationFrame !== lastAnimationFrameRef.current;
    lastAnimationFrameRef.current = animationFrame;

    // Build frame state for render
    const frameState: GameFrameState = {
      gbaFrame: gbaFrameRef.current,
      animationFrame,
      deltaTime,
      timestamp: currentTime,
      animationFrameChanged,
    };

    // Call render function
    onRenderRef.current(frameState);

    // Schedule next frame
    rafIdRef.current = requestAnimationFrame(tick);
  }, [frameMs]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTimeRef.current = performance.now();
    accumulatorRef.current = frameMs; // Ensure first frame runs update
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick, frameMs]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Auto-start/stop based on running option
  useEffect(() => {
    if (initialRunning) {
      start();
    }
    return () => {
      stop();
    };
  }, [initialRunning, start, stop]);

  return {
    gbaFrame: gbaFrameRef.current,
    animationFrame: lastAnimationFrameRef.current,
    start,
    stop,
    isRunning: runningRef.current,
  };
}

/**
 * Simpler hook that just provides GBA frame timing without callbacks.
 * Useful for components that need frame state but manage their own rendering.
 */
export function useGBAFrameCounter(): {
  gbaFrame: number;
  animationFrame: number;
  timestamp: number;
} {
  const gbaFrameRef = useRef(0);
  const animationFrameRef = useRef(0);
  const timestampRef = useRef(performance.now());
  const lastTimeRef = useRef(performance.now());
  const accumulatorRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      accumulatorRef.current += deltaTime;
      timestampRef.current = currentTime;

      // Update shimmer
      getGlobalShimmer().update(currentTime);

      // Fixed timestep
      while (accumulatorRef.current >= GBA_FRAME_MS) {
        accumulatorRef.current -= GBA_FRAME_MS;
        gbaFrameRef.current++;
      }

      animationFrameRef.current = Math.floor(gbaFrameRef.current / ANIMATION_FRAME_TICKS);
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    gbaFrame: gbaFrameRef.current,
    animationFrame: animationFrameRef.current,
    timestamp: timestampRef.current,
  };
}

// Re-export constants for use elsewhere
export { GBA_FRAME_MS, ANIMATION_FRAME_TICKS };
