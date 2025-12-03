/**
 * IFadeRenderer - Common interface for fade renderers
 *
 * This interface defines the contract for screen fade effects (fade to black,
 * fade from black, etc.). Both Canvas2D and WebGL renderers implement this.
 *
 * Usage:
 * ```typescript
 * // During fade transition
 * const fadeAlpha = fadeController.getAlpha(nowTime);
 * if (fadeAlpha > 0) {
 *   fadeRenderer.render(fadeAlpha); // Fade to black
 * }
 * ```
 */

import type { RendererType } from './IRenderPipeline';

/**
 * Common interface for fade renderers
 *
 * Implemented by:
 * - WebGLFadeRenderer (GPU-accelerated fullscreen quad)
 * - Canvas2DFadeRenderer (simple rect fill)
 */
export interface IFadeRenderer {
  /**
   * Get the renderer type identifier
   */
  readonly rendererType: RendererType;

  /**
   * Render a fullscreen fade overlay
   *
   * @param alpha - Fade alpha (0 = transparent/no fade, 1 = fully opaque)
   * @param r - Red component (0-1), defaults to 0 (black)
   * @param g - Green component (0-1), defaults to 0 (black)
   * @param b - Blue component (0-1), defaults to 0 (black)
   */
  render(alpha: number, r?: number, g?: number, b?: number): void;

  /**
   * Check if the renderer is in a valid state
   *
   * For WebGL, returns false if context is lost.
   * For Canvas2D, always returns true.
   */
  isValid(): boolean;

  /**
   * Clean up resources
   *
   * Call when the renderer is no longer needed.
   * For WebGL, releases GPU resources.
   */
  dispose(): void;
}
