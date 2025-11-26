/**
 * LayerCompositor - Composites rendered layers to screen
 *
 * Render order (back to front):
 * 1. Background (BG2) - always behind sprites
 * 2. TopBelow (BG1, behind player) - tiles at different elevation
 * 3. [Player/NPCs render here - handled externally]
 * 4. TopAbove (BG1, above player) - vertical objects, same-elevation blocked tiles
 *
 * This class handles the final composition of pre-rendered layer canvases
 * to the main display canvas, applying camera offsets for smooth scrolling.
 *
 * Reference: pokeemerald's BG layer system (bg.c)
 */

import type { WorldCameraView } from './types';

/**
 * Layer canvases for composition
 */
export interface LayerCanvases {
  /** Background layer canvas (always behind sprites) */
  background: HTMLCanvasElement | null;
  /** Top layer below player (renders before player) */
  topBelow: HTMLCanvasElement | null;
  /** Top layer above player (renders after player) */
  topAbove?: HTMLCanvasElement | null;
}

/**
 * Options for composition
 */
export interface CompositeOptions {
  /** Clear the canvas before drawing (default: true) */
  clear?: boolean;
}

/**
 * LayerCompositor - Handles final layer composition to screen
 *
 * The compositor takes pre-rendered layer canvases and draws them
 * to the main display canvas in the correct order with proper
 * sub-pixel offsets for smooth scrolling.
 */
export class LayerCompositor {
  /**
   * Composite background and topBelow layers
   *
   * This is called before sprites are rendered.
   * TopAbove is rendered separately after sprites.
   *
   * @param ctx - Main canvas context to draw to
   * @param view - Camera view with offset information
   * @param layers - Layer canvases to composite
   * @param options - Composition options
   */
  composite(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    layers: LayerCanvases,
    options: CompositeOptions = {}
  ): void {
    const { clear = true } = options;
    const offsetX = -Math.round(view.subTileOffsetX);
    const offsetY = -Math.round(view.subTileOffsetY);

    if (clear) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // Draw background layer (BG2)
    if (layers.background) {
      ctx.drawImage(layers.background, offsetX, offsetY);
    }

    // Draw top layer below player (BG1 tiles behind player)
    if (layers.topBelow) {
      ctx.drawImage(layers.topBelow, offsetX, offsetY);
    }
  }

  /**
   * Composite the topAbove layer
   *
   * This is called after sprites are rendered to draw
   * tiles that should appear in front of the player
   * (vertical objects, same-elevation blocked tiles).
   *
   * @param ctx - Main canvas context to draw to
   * @param view - Camera view with offset information
   * @param topAbove - Top-above layer canvas (or null to skip)
   */
  compositeTopAbove(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    topAbove: HTMLCanvasElement | null
  ): void {
    if (!topAbove) return;

    const offsetX = -Math.round(view.subTileOffsetX);
    const offsetY = -Math.round(view.subTileOffsetY);
    ctx.drawImage(topAbove, offsetX, offsetY);
  }

  /**
   * Composite all layers at once (for simple cases without sprites)
   *
   * This draws all three layers in order, useful for testing
   * or rendering without player/NPC sprites.
   *
   * @param ctx - Main canvas context to draw to
   * @param view - Camera view with offset information
   * @param layers - All layer canvases to composite
   */
  compositeAll(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    layers: LayerCanvases
  ): void {
    this.composite(ctx, view, layers);
    this.compositeTopAbove(ctx, view, layers.topAbove ?? null);
  }

  /**
   * Calculate the offset for compositing based on camera view
   *
   * @param view - Camera view with sub-tile offset
   * @returns Object with x and y offsets
   */
  getOffset(view: WorldCameraView): { x: number; y: number } {
    return {
      x: -Math.round(view.subTileOffsetX),
      y: -Math.round(view.subTileOffsetY),
    };
  }
}
