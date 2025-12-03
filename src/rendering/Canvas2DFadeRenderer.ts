/**
 * Canvas2DFadeRenderer - Simple Canvas2D fade overlay
 *
 * Renders a fullscreen rectangle with a solid color and alpha value.
 * Used for screen fade transitions (fade to black, fade from black).
 */

import type { IFadeRenderer } from './IFadeRenderer';
import type { RendererType } from './IRenderPipeline';

export class Canvas2DFadeRenderer implements IFadeRenderer {
  readonly rendererType: RendererType = 'canvas2d';
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /**
   * Update dimensions (call when canvas resizes)
   */
  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Render a fullscreen fade overlay
   *
   * @param alpha - Fade alpha (0 = transparent, 1 = fully opaque)
   * @param r - Red component (0-1), defaults to 0 (black)
   * @param g - Green component (0-1), defaults to 0 (black)
   * @param b - Blue component (0-1), defaults to 0 (black)
   */
  render(alpha: number, r: number = 0, g: number = 0, b: number = 0): void {
    if (alpha <= 0) return; // Nothing to render

    // Convert 0-1 to 0-255 for CSS
    const red = Math.round(r * 255);
    const green = Math.round(g * 255);
    const blue = Math.round(b * 255);

    this.ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Canvas2D is always valid (no context loss)
   */
  isValid(): boolean {
    return true;
  }

  /**
   * Clean up resources (nothing to do for Canvas2D)
   */
  dispose(): void {
    // Canvas2D doesn't need explicit cleanup
  }
}
