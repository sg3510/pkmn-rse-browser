/**
 * AnimationTimer - Manages tileset animation frame timing.
 *
 * This mirrors the handheld tick rate where most tileset animations
 * advance every 10 ticks (roughly 166.67ms at 60fps).
 */
export class AnimationTimer {
  private elapsed = 0;
  private currentFrame = 0;
  private tickCounter = 0;

  // GBA tick = 1/60 second = 16.67ms
  private readonly TICK_MS = 1000 / 60;

  // Default frame period in ticks (10 ticks is the common tileset cadence)
  private readonly FRAME_TICKS = 10;

  /**
   * Update timer with elapsed milliseconds.
   */
  update(deltaMs: number): void {
    this.elapsed += deltaMs;

    while (this.elapsed >= this.TICK_MS) {
      this.elapsed -= this.TICK_MS;
      this.tickCounter++;
      if (this.tickCounter % this.FRAME_TICKS === 0) {
        this.currentFrame++;
      }
    }
  }

  /**
   * Get current animation frame index (global counter).
   */
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * Get frame index for a specific animation period.
   */
  getFrameForPeriod(periodTicks: number, frameCount: number): number {
    const cyclePosition = this.tickCounter % (periodTicks * frameCount);
    return Math.floor(cyclePosition / periodTicks);
  }

  getTickCount(): number {
    return this.tickCounter;
  }

  reset(): void {
    this.elapsed = 0;
    this.currentFrame = 0;
    this.tickCounter = 0;
  }
}
