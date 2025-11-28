/**
 * IRenderPipeline - Common interface for render pipelines
 *
 * This interface defines the contract that both Canvas2D and WebGL
 * render pipelines must implement. It enables:
 * - Automatic fallback from WebGL to Canvas2D
 * - Consistent API across rendering backends
 * - Easy testing with mock implementations
 *
 * The 3-pass rendering system:
 * - Background: BG2 layer (always behind sprites)
 * - TopBelow: BG1 tiles that render behind the player
 * - TopAbove: BG1 tiles that render above the player
 */

import type {
  WorldCameraView,
  RenderContext,
  RenderOptions,
  TileResolverFn,
  IsVerticalObjectFn,
} from './types';

/**
 * Renderer type identifier
 */
export type RendererType = 'canvas2d' | 'webgl';

/**
 * Rendering statistics (common fields)
 */
export interface RenderStats {
  /** Which renderer is being used */
  rendererType: RendererType;
  /** Whether the renderer is in a valid state */
  isValid: boolean;
}

/**
 * Common interface for render pipelines
 *
 * Usage:
 * 1. Obtain pipeline from RenderPipelineFactory.create()
 * 2. Set tile resolver and vertical object checker
 * 3. Each frame, call render() then composite methods with sprite rendering between
 *
 * Example:
 * ```typescript
 * pipeline.render(ctx, view, playerElevation, options);
 * pipeline.compositeBackgroundOnly(mainCtx, view);
 * // ... render priority 2 sprites ...
 * pipeline.compositeTopBelowOnly(mainCtx, view);
 * // ... render player and other sprites ...
 * pipeline.compositeTopAbove(mainCtx, view);
 * ```
 */
export interface IRenderPipeline {
  /**
   * Get the renderer type identifier
   */
  readonly rendererType: RendererType;

  /**
   * Set the tile resolver function
   *
   * This must be called before rendering to provide
   * the function that resolves world coordinates to tile data.
   *
   * @param fn - Function to resolve tiles at world coordinates
   */
  setTileResolver(fn: TileResolverFn): void;

  /**
   * Set the vertical object checker function
   *
   * Vertical objects (trees, poles, etc.) always render above the player
   * regardless of elevation.
   *
   * @param fn - Function to check if a tile is a vertical object
   */
  setVerticalObjectChecker(fn: IsVerticalObjectFn): void;

  /**
   * Render all three passes for the current frame
   *
   * This renders tiles to internal buffers (framebuffers for WebGL,
   * canvases for Canvas2D). Call composite methods after to draw
   * to the main canvas.
   *
   * Caching: Passes are only re-rendered when necessary based on:
   * - needsFullRender: Force re-render all passes
   * - animationChanged: Tileset animation frame changed
   * - elevationChanged: Player elevation changed (affects layer split)
   *
   * @param ctx - Render context with world and tileset data
   * @param view - Camera view defining visible tiles
   * @param playerElevation - Current player elevation (0-15)
   * @param options - Rendering options
   */
  render(
    ctx: RenderContext,
    view: WorldCameraView,
    playerElevation: number,
    options?: RenderOptions
  ): void;

  /**
   * Composite background and topBelow layers to the main canvas
   *
   * Convenience method that calls compositeBackgroundOnly and compositeTopBelowOnly.
   * Use separate methods when you need to render sprites between layers.
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  composite(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;

  /**
   * Composite only the background layer to the main canvas
   *
   * Call this first when you need to render priority 2 sprites
   * between background and topBelow (matching GBA sprite priority).
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  compositeBackgroundOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;

  /**
   * Composite only the topBelow layer to the main canvas
   *
   * Call this after priority 2 sprites are rendered.
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  compositeTopBelowOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;

  /**
   * Composite the topAbove layer to the main canvas
   *
   * Call this after rendering the player and other sprites.
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  compositeTopAbove(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void;

  /**
   * Invalidate all cached passes
   *
   * Call this when the world or tilesets change significantly
   * and a full re-render is needed.
   */
  invalidate(): void;

  /**
   * Check if the pipeline is in a valid state
   *
   * For WebGL, this returns false if context is lost.
   * For Canvas2D, this always returns true.
   */
  isValid(): boolean;

  /**
   * Clean up resources
   *
   * Call this when the pipeline is no longer needed.
   * For WebGL, this releases GPU resources.
   */
  dispose(): void;

  /**
   * Get rendering statistics
   */
  getStats(): RenderStats;
}
