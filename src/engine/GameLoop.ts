import { AnimationTimer } from './AnimationTimer';
import type { GameState } from './GameState';
import type { ObservableState } from './GameState';
import { UpdateCoordinator, type UpdateResult } from './UpdateCoordinator';

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
  private readonly FRAME_MS = 1000 / 60;
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

      let lastResult: UpdateResult = { needsRender: false };

      while (this.accumulator >= this.FRAME_MS) {
        this.animationTimer.update(this.FRAME_MS);
        this.state.update({
          animationFrame: this.animationTimer.getCurrentFrame(),
          animationTime: this.state.get().animationTime + this.FRAME_MS,
        });

        lastResult = this.updateCoordinator.update(this.FRAME_MS, currentTime);
        this.accumulator -= this.FRAME_MS;
      }

      onFrame(this.state.get(), lastResult, deltaMs, currentTime);
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
