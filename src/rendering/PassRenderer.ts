/**
 * PassRenderer - Renders map tiles for a specific layer pass
 *
 * Each metatile has 2 layers (pokeemerald: BG2 and BG1):
 * - Layer 0 (tiles 0-3): Background layer (BG2)
 * - Layer 1 (tiles 4-7): Top layer (BG1)
 *
 * Layer rendering depends on MetatileLayerType:
 * - COVERED (1): Both layers in background pass
 * - NORMAL (0): Layer 0 in bg, Layer 1 in top
 * - SPLIT (2): Layer 0 in bg, Layer 1 in top
 *
 * Reference: pokeemerald/include/fieldmap.h METATILE_LAYER_TYPE_*
 */

import { TileRenderer } from './TileRenderer';
import { TilesetCanvasCache } from './TilesetCanvasCache';
import {
  METATILE_SIZE,
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_SPLIT,
} from '../utils/mapLoader';
import type {
  WorldCameraView,
  RenderContext,
  ElevationFilterFn,
  TileResolverFn,
  TilesetRuntime,
} from './types';

/**
 * Options for rendering a pass
 */
export interface PassRenderOptions {
  /** Skip animated tiles (for caching static layers) */
  skipAnimated?: boolean;
  /** Elevation filter for top layer splitting */
  elevationFilter?: ElevationFilterFn;
  /** Existing canvas to reuse (avoids allocation) */
  existingCanvas?: HTMLCanvasElement | null;
}

/**
 * PassRenderer - Renders a single pass (background or top layer)
 *
 * This class extracts the rendering logic from MapRenderer.renderPassCanvas
 * into a reusable, testable module.
 */
export class PassRenderer {
  private tileRenderer: TileRenderer;
  private tilesetCache: TilesetCanvasCache;

  constructor(tilesetCache: TilesetCanvasCache) {
    this.tilesetCache = tilesetCache;
    this.tileRenderer = new TileRenderer(tilesetCache);
  }

  /**
   * Render the background pass
   *
   * Background includes:
   * - Layer 0 of all metatiles
   * - Layer 1 of COVERED metatiles (tiles that are always behind sprites)
   *
   * @param ctx - Render context with world and tileset data
   * @param view - Camera view defining visible tiles
   * @param resolveTile - Function to resolve tile data at world coordinates
   * @param options - Rendering options
   * @returns Canvas with rendered background
   */
  renderBackground(
    ctx: RenderContext,
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    options: PassRenderOptions = {}
  ): HTMLCanvasElement {
    const canvas = this.prepareCanvas(view, options.existingCanvas);
    const canvasCtx = canvas.getContext('2d', { alpha: true })!;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    this.forEachVisibleTile(view, (tileX, tileY, screenX, screenY) => {
      const resolved = resolveTile(tileX, tileY);
      if (!resolved || !resolved.metatile) return;

      const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
      if (!runtime) return;

      const layerType = resolved.attributes?.layerType ?? METATILE_LAYER_TYPE_COVERED;
      const drawParams = this.createDrawParams(resolved, runtime, screenX, screenY, options);

      // Background: always draw layer 0
      this.tileRenderer.drawMetatileLayer(canvasCtx, { ...drawParams, layer: 0 });

      // COVERED: also draw layer 1 in background
      if (layerType === METATILE_LAYER_TYPE_COVERED) {
        this.tileRenderer.drawMetatileLayer(canvasCtx, { ...drawParams, layer: 1 });
      }
    });

    return canvas;
  }

  /**
   * Render the top layer pass
   *
   * Top layer includes layer 1 of NORMAL and SPLIT metatiles.
   * An optional elevation filter can split this into below/above player passes.
   *
   * @param ctx - Render context with world and tileset data
   * @param view - Camera view defining visible tiles
   * @param resolveTile - Function to resolve tile data at world coordinates
   * @param options - Rendering options (including elevation filter)
   * @returns Canvas with rendered top layer
   */
  renderTopLayer(
    ctx: RenderContext,
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    options: PassRenderOptions = {}
  ): HTMLCanvasElement {
    const canvas = this.prepareCanvas(view, options.existingCanvas);
    const canvasCtx = canvas.getContext('2d', { alpha: true })!;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const { elevationFilter } = options;

    this.forEachVisibleTile(view, (tileX, tileY, screenX, screenY) => {
      const resolved = resolveTile(tileX, tileY);
      if (!resolved || !resolved.metatile) return;

      const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
      if (!runtime) return;

      const layerType = resolved.attributes?.layerType ?? METATILE_LAYER_TYPE_COVERED;

      // Top pass: only NORMAL and SPLIT have layer 1 here
      if (layerType === METATILE_LAYER_TYPE_COVERED) return;

      // Apply elevation filter if provided
      if (elevationFilter && !elevationFilter(resolved.mapTile, tileX, tileY)) {
        return;
      }

      // Only render layer 1 for NORMAL or SPLIT layer types
      if (layerType === METATILE_LAYER_TYPE_NORMAL || layerType === METATILE_LAYER_TYPE_SPLIT) {
        const drawParams = this.createDrawParams(resolved, runtime, screenX, screenY, options);
        this.tileRenderer.drawMetatileLayer(canvasCtx, { ...drawParams, layer: 1 });
      }
    });

    return canvas;
  }

  /**
   * Prepare a canvas for rendering
   *
   * @param view - Camera view defining dimensions
   * @param existingCanvas - Optional existing canvas to reuse
   * @returns Canvas ready for drawing
   */
  private prepareCanvas(
    view: WorldCameraView,
    existingCanvas?: HTMLCanvasElement | null
  ): HTMLCanvasElement {
    const widthPx = view.tilesWide * METATILE_SIZE;
    const heightPx = view.tilesHigh * METATILE_SIZE;

    // Reuse existing canvas if dimensions match
    if (existingCanvas && existingCanvas.width === widthPx && existingCanvas.height === heightPx) {
      return existingCanvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    return canvas;
  }

  /**
   * Iterate over all visible tiles in the view
   *
   * @param view - Camera view defining visible area
   * @param callback - Function called for each tile with world and screen coordinates
   */
  private forEachVisibleTile(
    view: WorldCameraView,
    callback: (tileX: number, tileY: number, screenX: number, screenY: number) => void
  ): void {
    for (let localY = 0; localY < view.tilesHigh; localY++) {
      const tileY = view.worldStartTileY + localY;
      for (let localX = 0; localX < view.tilesWide; localX++) {
        const tileX = view.worldStartTileX + localX;
        const screenX = localX * METATILE_SIZE;
        const screenY = localY * METATILE_SIZE;
        callback(tileX, tileY, screenX, screenY);
      }
    }
  }

  /**
   * Create draw parameters for a metatile
   */
  private createDrawParams(
    resolved: NonNullable<ReturnType<TileResolverFn>>,
    runtime: TilesetRuntime,
    screenX: number,
    screenY: number,
    options: PassRenderOptions
  ) {
    const patchedTiles = runtime.patchedTiles ?? {
      primary: runtime.resources.primaryTilesImage,
      secondary: runtime.resources.secondaryTilesImage,
    };

    return {
      metatile: resolved.metatile!,
      screenX,
      screenY,
      layer: 0 as const,
      patchedTiles,
      primaryPalettes: resolved.tileset.primaryPalettes,
      secondaryPalettes: resolved.tileset.secondaryPalettes,
      animatedTileIds: runtime.animatedTileIds,
      skipAnimated: options.skipAnimated,
    };
  }

  /**
   * Get the tile renderer instance
   */
  getTileRenderer(): TileRenderer {
    return this.tileRenderer;
  }

  /**
   * Get the tileset cache instance
   */
  getTilesetCache(): TilesetCanvasCache {
    return this.tilesetCache;
  }
}
