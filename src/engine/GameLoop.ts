import { AnimationTimer } from './AnimationTimer';
import type { GameState } from './GameState';
import type { ObservableState } from './GameState';
import { UpdateCoordinator, type UpdateResult } from './UpdateCoordinator';
import { TICK_60FPS_MS } from '../config/timing';

export type FrameHandler = (
  state: GameState,
  result: UpdateResult,
  deltaMs: number,
  timestamp: number
) => void;

/**
 * GameLoop - Main loop with a fixed 60fps timestep.
 *
 * This owns the RAF scheduling and delegates per-frame work to the
 * UpdateCoordinator, while the AnimationTimer maintains the global
 * animation frame counter.
 */
export class GameLoop {
  private readonly FRAME_MS = TICK_60FPS_MS;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private rafId: number | null = null;
  private state: ObservableState;
  private animationTimer: AnimationTimer;
  private updateCoordinator: UpdateCoordinator;

  constructor(state: ObservableState, updateCoordinator: UpdateCoordinator, animationTimer?: AnimationTimer) {
    this.state = state;
    this.updateCoordinator = updateCoordinator;
    this.animationTimer = animationTimer ?? new AnimationTimer();
  }

  start(onFrame: FrameHandler): void {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    // Ensure the first RAF triggers at least one update cycle.
    this.accumulator = this.FRAME_MS;

    const tick = (currentTime: number) => {
      if (!this.running) return;

      const deltaMs = currentTime - this.lastTime;
      this.lastTime = currentTime;
      this.accumulator += deltaMs;

      // CRITICAL: Accumulate results across all catch-up iterations
      // If ANY iteration needs rendering, we must render. Otherwise jitter occurs
      // when the last iteration has needsRender=false but earlier iterations moved.
      let combinedResult: UpdateResult = {
        needsRender: false,
        viewChanged: false,
        elevationChanged: false,
        animationFrameChanged: false,
        playerDirty: false,
      };

      while (this.accumulator >= this.FRAME_MS) {
        this.animationTimer.update(this.FRAME_MS);
        this.state.update({
          animationFrame: this.animationTimer.getCurrentFrame(),
          animationTime: this.state.get().animationTime + this.FRAME_MS,
        });

        const result = this.updateCoordinator.update(this.FRAME_MS, currentTime);

        // OR all boolean flags - if ANY iteration needs render, we render
        combinedResult = {
          needsRender: combinedResult.needsRender || result.needsRender,
          viewChanged: combinedResult.viewChanged || result.viewChanged,
          elevationChanged: combinedResult.elevationChanged || result.elevationChanged,
          animationFrameChanged: combinedResult.animationFrameChanged || result.animationFrameChanged,
          playerDirty: combinedResult.playerDirty || result.playerDirty,
        };

        this.accumulator -= this.FRAME_MS;
      }

      onFrame(this.state.get(), combinedResult, deltaMs, currentTime);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
