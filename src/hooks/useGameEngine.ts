import { useEffect, useMemo, useRef, useState } from 'react';
import { GameLoop, type FrameHandler } from '../engine/GameLoop';
import { AnimationTimer } from '../engine/AnimationTimer';
import { UpdateCoordinator } from '../engine/UpdateCoordinator';
import type { ObservableState } from '../engine/GameState';

export interface UseGameEngineOptions {
  state: ObservableState | null;
  createCoordinator: (state: ObservableState) => UpdateCoordinator | null;
  onFrame: FrameHandler;
  animationTimer?: AnimationTimer;
}

/**
 * useGameEngine - manages the lifecycle of the core GameLoop.
 *
 * The hook expects the caller to provide an already-prepared game state and
 * a factory that builds the UpdateCoordinator with any per-instance deps
 * (player controller, map manager, etc).
 */
export function useGameEngine(options: UseGameEngineOptions): { isRunning: boolean } {
  const { state, createCoordinator, onFrame, animationTimer } = options;
  const loopRef = useRef<GameLoop | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const coordinator = useMemo(() => {
    if (!state) return null;
    return createCoordinator(state);
  }, [createCoordinator, state]);

  useEffect(() => {
    if (!state || !coordinator) {
      return () => undefined;
    }

    const loop = new GameLoop(state, coordinator, animationTimer);
    loopRef.current = loop;
    loop.start(onFrame);
    setIsRunning(true);

    return () => {
      loop.stop();
      loopRef.current = null;
      setIsRunning(false);
    };
  }, [animationTimer, coordinator, onFrame, state]);

  return { isRunning };
}
