/**
 * FadeController - Screen fade in/out transitions
 *
 * Manages fade-to-black and fade-from-black screen transitions used for:
 * - Map transitions (fade out, load, fade in)
 * - Door entries (fade out after door closes)
 * - Battle transitions
 *
 * Reference: pokeemerald/src/field_screen_effect.c
 * - FadeScreen function family
 * - gWeatherPtr->fadeScreenCounter timing
 *
 * Usage:
 * ```typescript
 * const fade = new FadeController();
 *
 * // Start fade out (to black)
 * fade.startFadeOut(500, performance.now());
 *
 * // In render loop
 * if (!fade.isComplete(now)) {
 *   fade.render(ctx, width, height, now);
 * }
 *
 * // Check when fade is done
 * if (fade.isComplete(now)) {
 *   // Perform map transition
 *   fade.startFadeIn(500, now);
 * }
 * ```
 */

import { type FadeState, type FadeDirection, FADE_TIMING } from './types';

/**
 * FadeController manages screen fade transitions
 *
 * Provides a simple interface for fade-to-black and fade-from-black
 * animations with configurable duration.
 */
export class FadeController {
  private state: FadeState = {
    mode: null,
    startedAt: 0,
    duration: FADE_TIMING.DEFAULT_DURATION_MS,
  };

  /**
   * Start fade out transition (screen goes to black)
   *
   * @param duration - Duration of fade in milliseconds
   * @param currentTime - Current timestamp (e.g., performance.now())
   */
  startFadeOut(duration: number, currentTime: number): void {
    this.state = {
      mode: 'out',
      startedAt: currentTime,
      duration,
    };
  }

  /**
   * Start fade in transition (screen comes from black)
   *
   * @param duration - Duration of fade in milliseconds
   * @param currentTime - Current timestamp (e.g., performance.now())
   */
  startFadeIn(duration: number, currentTime: number): void {
    this.state = {
      mode: 'in',
      startedAt: currentTime,
      duration,
    };
  }

  /**
   * Get current fade alpha value
   *
   * @param currentTime - Current timestamp
   * @returns Alpha value (0 = fully transparent, 1 = fully black)
   */
  getAlpha(currentTime: number): number {
    if (!this.state.mode) return 0;

    const elapsed = currentTime - this.state.startedAt;
    const progress = Math.min(1, Math.max(0, elapsed / this.state.duration));

    if (this.state.mode === 'out') {
      return progress; // 0 -> 1 (fade to black)
    } else {
      return 1 - progress; // 1 -> 0 (fade from black)
    }
  }

  /**
   * Check if current fade transition is complete
   *
   * @param currentTime - Current timestamp
   * @returns true if fade is complete or no fade is active
   */
  isComplete(currentTime: number): boolean {
    if (!this.state.mode) return true;
    return currentTime - this.state.startedAt >= this.state.duration;
  }

  /**
   * Render fade overlay to canvas
   *
   * Should be called as the last rendering step to overlay
   * the fade effect on top of all other content.
   *
   * @param ctx - Canvas 2D rendering context
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   * @param currentTime - Current timestamp
   */
  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentTime: number
  ): void {
    const alpha = this.getAlpha(currentTime);
    if (alpha <= 0) return;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /**
   * Check if a fade transition is currently active
   *
   * @returns true if a fade is in progress
   */
  isActive(): boolean {
    return this.state.mode !== null;
  }

  /**
   * Get the current fade direction
   *
   * @returns 'in', 'out', or null if no fade is active
   */
  getDirection(): FadeDirection | null {
    return this.state.mode;
  }

  /**
   * Clear fade state (cancel any active fade)
   *
   * Useful when transitioning to a new scene that doesn't
   * need the fade to complete.
   */
  clear(): void {
    this.state = {
      mode: null,
      startedAt: 0,
      duration: FADE_TIMING.DEFAULT_DURATION_MS,
    };
  }

  /**
   * Get raw fade state (for debugging/serialization)
   *
   * @returns Current fade state object
   */
  getState(): Readonly<FadeState> {
    return this.state;
  }

  /**
   * Get progress of current fade (0-1)
   *
   * @param currentTime - Current timestamp
   * @returns Progress value from 0 to 1, or 0 if no fade active
   */
  getProgress(currentTime: number): number {
    if (!this.state.mode) return 0;
    const elapsed = currentTime - this.state.startedAt;
    return Math.min(1, Math.max(0, elapsed / this.state.duration));
  }
}
