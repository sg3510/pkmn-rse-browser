/**
 * RenderPipeline - Orchestrates the 3-pass rendering system
 *
 * This mirrors pokeemerald's BG layer system:
 * - Background pass: BG2 (always behind sprites)
 * - TopBelow pass: BG1 (behind player at certain elevations)
 * - TopAbove pass: BG1 (above player at certain elevations)
 *
 * The pipeline coordinates:
 * - PassRenderer for tile rendering
 * - ElevationFilter for layer splitting
 * - LayerCompositor for final composition
 *
 * Reference: pokeemerald/src/bg.c, sElevationToPriority in event_object_movement.c
 */

import { TilesetCanvasCache } from './TilesetCanvasCache';
import { PassRenderer } from './PassRenderer';
import { ElevationFilter } from './ElevationFilter';
import { LayerCompositor, type LayerCanvases } from './LayerCompositor';
import type {
  WorldCameraView,
  RenderContext,
  RenderOptions,
  TileResolverFn,
  IsVerticalObjectFn,
} from './types';

/**
 * RenderPipeline - Main orchestrator for the 3-pass rendering system
 *
 * Usage:
 * 1. Create pipeline with tileset cache
 * 2. Call render() each frame with context, view, and player elevation
 * 3. Between composite and compositeTopAbove, render sprites
 *
 * The pipeline caches rendered passes and only re-renders when necessary
 * (view changed, animation changed, elevation changed).
 */
export class RenderPipeline {
  private passRenderer: PassRenderer;
  private compositor: LayerCompositor;
  private elevationFilter: ElevationFilter;
  private tilesetCache: TilesetCanvasCache;

  // Cached canvases for each pass
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private topBelowCanvas: HTMLCanvasElement | null = null;
  private topAboveCanvas: HTMLCanvasElement | null = null;

  // Cache invalidation tracking
  private lastPlayerElevation: number = -1;

  // Resolve and helper functions (set by caller)
  private resolveTile: TileResolverFn | null = null;
  private isVerticalObject: IsVerticalObjectFn = () => false;

  constructor(tilesetCache: TilesetCanvasCache) {
    this.tilesetCache = tilesetCache;
    this.passRenderer = new PassRenderer(tilesetCache);
    this.compositor = new LayerCompositor();
    this.elevationFilter = new ElevationFilter(this.isVerticalObject);
  }

  /**
   * Set the tile resolver function
   *
   * This must be called before rendering to provide
   * the function that resolves world coordinates to tile data.
   *
   * @param fn - Function to resolve tiles at world coordinates
   */
  setTileResolver(fn: TileResolverFn): void {
    this.resolveTile = fn;
  }

  /**
   * Set the vertical object checker function
   *
   * @param fn - Function to check if a tile is a vertical object
   */
  setVerticalObjectChecker(fn: IsVerticalObjectFn): void {
    this.isVerticalObject = fn;
    this.elevationFilter.setVerticalObjectChecker(fn);
  }

  /**
   * Render all three passes for the current frame
   *
   * This re-renders passes only when necessary based on:
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
    options: RenderOptions = {}
  ): void {
    if (!this.resolveTile) {
      console.warn('RenderPipeline: No tile resolver set');
      return;
    }

    const { needsFullRender, animationChanged, elevationChanged: optionElevationChanged } = options;

    // Check if elevation actually changed
    const elevationChanged = optionElevationChanged || playerElevation !== this.lastPlayerElevation;
    this.lastPlayerElevation = playerElevation;

    // Determine if we need to re-render
    const needsRender = needsFullRender || animationChanged || elevationChanged ||
      !this.backgroundCanvas || !this.topBelowCanvas || !this.topAboveCanvas;

    if (needsRender) {
      // Create elevation filters for this player elevation
      const { below: filterBelow, above: filterAbove } = this.elevationFilter.createFilter(playerElevation);

      // Render background pass
      this.backgroundCanvas = this.passRenderer.renderBackground(
        ctx,
        view,
        this.resolveTile,
        { existingCanvas: this.backgroundCanvas }
      );

      // Render top layer below player
      this.topBelowCanvas = this.passRenderer.renderTopLayer(
        ctx,
        view,
        this.resolveTile,
        {
          elevationFilter: filterBelow,
          existingCanvas: this.topBelowCanvas,
        }
      );

      // Render top layer above player
      this.topAboveCanvas = this.passRenderer.renderTopLayer(
        ctx,
        view,
        this.resolveTile,
        {
          elevationFilter: filterAbove,
          existingCanvas: this.topAboveCanvas,
        }
      );
    }
  }

  /**
   * Composite background and topBelow layers to the main canvas
   *
   * Call this before rendering sprites.
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  composite(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    const layers: LayerCanvases = {
      background: this.backgroundCanvas,
      topBelow: this.topBelowCanvas,
    };
    this.compositor.composite(mainCtx, view, layers);
  }

  /**
   * Composite only the background layer to the main canvas
   *
   * Call this first when you need to render priority 2 sprites
   * between background and topBelow (matching GBA sprite priority).
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  compositeBackgroundOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    const layers: LayerCanvases = {
      background: this.backgroundCanvas,
      topBelow: this.topBelowCanvas,
    };
    this.compositor.compositeBackgroundOnly(mainCtx, view, layers);
  }

  /**
   * Composite only the topBelow layer to the main canvas
   *
   * Call this after priority 2 sprites are rendered.
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  compositeTopBelowOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    const layers: LayerCanvases = {
      background: this.backgroundCanvas,
      topBelow: this.topBelowCanvas,
    };
    this.compositor.compositeTopBelowOnly(mainCtx, view, layers);
  }

  /**
   * Composite the topAbove layer to the main canvas
   *
   * Call this after rendering sprites.
   *
   * @param mainCtx - Main canvas context to draw to
   * @param view - Camera view for offset calculation
   */
  compositeTopAbove(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    this.compositor.compositeTopAbove(mainCtx, view, this.topAboveCanvas);
  }

  /**
   * Get the cached layer canvases
   *
   * Useful for debugging or external composition.
   */
  getLayers(): LayerCanvases {
    return {
      background: this.backgroundCanvas,
      topBelow: this.topBelowCanvas,
      topAbove: this.topAboveCanvas,
    };
  }

  /**
   * Invalidate all cached canvases
   *
   * Call this when the world or tilesets change.
   */
  invalidate(): void {
    this.backgroundCanvas = null;
    this.topBelowCanvas = null;
    this.topAboveCanvas = null;
    this.lastPlayerElevation = -1;
  }

  /**
   * Clear tileset cache
   *
   * Call this when animation frames change.
   */
  clearTilesetCache(): void {
    this.tilesetCache.clear();
  }

  /**
   * Get the pass renderer instance
   */
  getPassRenderer(): PassRenderer {
    return this.passRenderer;
  }

  /**
   * Get the layer compositor instance
   */
  getCompositor(): LayerCompositor {
    return this.compositor;
  }

  /**
   * Get the tileset cache instance
   */
  getTilesetCache(): TilesetCanvasCache {
    return this.tilesetCache;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      tilesetCache: this.tilesetCache.getStats(),
      hasBackground: !!this.backgroundCanvas,
      hasTopBelow: !!this.topBelowCanvas,
      hasTopAbove: !!this.topAboveCanvas,
    };
  }
}
