/**
 * WebGLPassRenderer - Renders tile passes to framebuffers
 *
 * Coordinates TileInstanceBuilder and WebGLTileRenderer to render
 * each pass (background, topBelow, topAbove) to its own framebuffer.
 *
 * Mirrors the 3-pass system from Canvas2D PassRenderer:
 * - Background: BG2 (layer 0 + COVERED layer 1)
 * - TopBelow: BG1 tiles below player elevation
 * - TopAbove: BG1 tiles above player elevation
 */

import { WebGLFramebufferManager } from './WebGLFramebufferManager';
import { WebGLTileRenderer } from './WebGLTileRenderer';
import { TileInstanceBuilder } from './TileInstanceBuilder';
import type { TileInstance } from './types';
import type {
  WorldCameraView,
  TileResolverFn,
  ElevationFilterFn,
} from '../types';

type PassName = 'background' | 'topBelow' | 'topAbove';

export interface PassRenderOptions {
  /** Elevation filter for top layer splitting */
  elevationFilter?: ElevationFilterFn;
  /** Game frame for animation timing */
  gameFrame?: number;
}

export class WebGLPassRenderer {
  private framebufferManager: WebGLFramebufferManager;
  private tileRenderer: WebGLTileRenderer;
  private instanceBuilder: TileInstanceBuilder;

  // Cached instances to avoid re-building when only compositing
  private cachedInstances: Map<PassName, TileInstance[]> = new Map();
  private lastRenderMeta: Map<PassName, { instances: number; width: number; height: number; timestamp: number }> = new Map();

  // Diagnostic state - only logs on change to avoid console pollution
  private lastDiagnosticState: string = '';

  constructor(
    _gl: WebGL2RenderingContext,
    framebufferManager: WebGLFramebufferManager,
    tileRenderer: WebGLTileRenderer
  ) {
    this.framebufferManager = framebufferManager;
    this.tileRenderer = tileRenderer;
    this.instanceBuilder = new TileInstanceBuilder();
  }

  /**
   * Render the background pass
   *
   * Background includes:
   * - Layer 0 of all metatiles
   * - Layer 1 of COVERED metatiles
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver function
   * @param width - Framebuffer width
   * @param height - Framebuffer height
   */
  renderBackground(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    width: number,
    height: number
  ): void {
    // Build instances
    const instances = this.instanceBuilder.buildBackgroundInstances(view, resolveTile);
    this.cachedInstances.set('background', instances);

    // Render to framebuffer
    this.renderPassToFramebuffer('background', instances, width, height);
  }

  /**
   * Render all three passes from a single tile iteration.
   */
  renderAllPasses(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    filterBelow: ElevationFilterFn,
    filterAbove: ElevationFilterFn,
    width: number,
    height: number
  ): void {
    const split = this.instanceBuilder.buildSplitPassInstances(
      view,
      resolveTile,
      filterBelow,
      filterAbove
    );

    this.cachedInstances.set('background', split.background);
    this.cachedInstances.set('topBelow', split.topBelow);
    this.cachedInstances.set('topAbove', split.topAbove);

    this.renderPassToFramebuffer('background', split.background, width, height);
    this.renderPassToFramebuffer('topBelow', split.topBelow, width, height);
    this.renderPassToFramebuffer('topAbove', split.topAbove, width, height);

    this.checkArrayReferenceBug();
  }

  /**
   * Render ONLY layer 0 (bottom layer) of all metatiles
   *
   * Used for reflection rendering where we need to insert reflections
   * between layer 0 and layer 1. The order should be:
   * 1. renderLayer0Only() - water/ground base
   * 2. [render reflections]
   * 3. renderLayer1Only() - shore edges cover reflections
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver function
   * @param width - Framebuffer width
   * @param height - Framebuffer height
   */
  renderLayer0Only(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    width: number,
    height: number
  ): void {
    const instances = this.instanceBuilder.buildLayer0Instances(view, resolveTile);
    this.cachedInstances.set('background', instances);
    this.renderPassToFramebuffer('background', instances, width, height);
  }

  /**
   * Render ONLY layer 1 (top layer) of ALL metatiles
   *
   * Renders layer 1 for ALL tiles regardless of layer type (NORMAL, COVERED, SPLIT).
   * Used after reflection rendering to ensure layer 1 covers reflections.
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver function
   * @param width - Framebuffer width
   * @param height - Framebuffer height
   */
  renderLayer1Only(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    width: number,
    height: number
  ): void {
    const instances = this.instanceBuilder.buildLayer1Instances(view, resolveTile);
    // Use topBelow framebuffer for layer 1
    this.cachedInstances.set('topBelow', instances);
    this.renderPassToFramebuffer('topBelow', instances, width, height);
  }

  /**
   * Render the top layer below player
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver
   * @param filterBelow - Elevation filter for tiles below player
   * @param width - Framebuffer width
   * @param height - Framebuffer height
   */
  renderTopBelow(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    filterBelow: ElevationFilterFn,
    width: number,
    height: number
  ): void {
    const instances = this.instanceBuilder.buildTopLayerInstances(
      view,
      resolveTile,
      filterBelow
    );
    this.cachedInstances.set('topBelow', instances);

    this.renderPassToFramebuffer('topBelow', instances, width, height);
  }

  /**
   * Render the top layer above player
   *
   * @param view - Camera view
   * @param resolveTile - Tile resolver
   * @param filterAbove - Elevation filter for tiles above player
   * @param width - Framebuffer width
   * @param height - Framebuffer height
   */
  renderTopAbove(
    view: WorldCameraView,
    resolveTile: TileResolverFn,
    filterAbove: ElevationFilterFn,
    width: number,
    height: number
  ): void {
    const instances = this.instanceBuilder.buildTopLayerInstances(
      view,
      resolveTile,
      filterAbove
    );
    this.cachedInstances.set('topAbove', instances);

    this.renderPassToFramebuffer('topAbove', instances, width, height);

    // P1 Diagnostic: Check for array reference sharing bug (only log on change)
    this.checkArrayReferenceBug();
  }

  /**
   * Get the texture for a rendered pass
   */
  getPassTexture(pass: PassName): WebGLTexture {
    return this.framebufferManager.getPassTexture(pass);
  }

  /**
   * Check whether cached instances exist for animation-only rerenders.
   * We require at least the background pass to have instances; top passes
   * may legitimately be empty on some views.
   */
  hasCachedInstances(): boolean {
    const bg = this.cachedInstances.get('background');
    return !!bg && bg.length > 0;
  }

  /**
   * Get cached instance count for a pass
   */
  getInstanceCount(pass: PassName): number {
    const instances = this.cachedInstances.get(pass);
    return instances ? instances.length : 0;
  }

  /**
   * Re-render all cached passes without rebuilding instances.
   *
   * Used for animation-only frames where tileset textures changed but
   * viewport/elevation stayed the same.
   */
  rerenderCached(): void {
    const dims = this.framebufferManager.getDimensions('background') ??
      this.framebufferManager.getDimensions('topBelow') ??
      this.framebufferManager.getDimensions('topAbove');
    if (!dims) return;

    for (const pass of ['background', 'topBelow', 'topAbove'] as PassName[]) {
      const instances = this.cachedInstances.get(pass);
      if (!instances || instances.length === 0) continue;
      this.renderPassToFramebuffer(pass, instances, dims.width, dims.height);
    }
  }

  /**
   * Get current framebuffer dimensions (if any pass has been rendered)
   */
  getCurrentDimensions(): { width: number; height: number } | null {
    return (
      this.framebufferManager.getDimensions('background') ||
      this.framebufferManager.getDimensions('topBelow') ||
      this.framebufferManager.getDimensions('topAbove') ||
      null
    );
  }

  /**
   * Clear cached instances
   */
  invalidate(): void {
    this.cachedInstances.clear();
  }

  /**
   * Render instances to a framebuffer
   */
  private renderPassToFramebuffer(
    pass: PassName,
    instances: TileInstance[],
    width: number,
    height: number
  ): void {
    // Get/create framebuffer
    this.framebufferManager.getFramebuffer(pass, width, height);

    // Bind and clear
    this.framebufferManager.bindFramebuffer(pass);
    this.framebufferManager.clear(0, 0, 0, 0); // Transparent background

    // Render tiles if any
    if (instances.length > 0) {
      this.tileRenderer.render(
        instances,
        { width, height },
        { x: 0, y: 0 }
      );
    }

    // Unbind
    this.framebufferManager.unbindFramebuffer();

    this.lastRenderMeta.set(pass, {
      instances: instances.length,
      width,
      height,
      timestamp: performance.now(),
    });
  }

  /**
   * Get rendering statistics
   */
  getStats(): {
    background: number;
    topBelow: number;
    topAbove: number;
    renderMeta: {
      background?: { instances: number; width: number; height: number; timestamp: number };
      topBelow?: { instances: number; width: number; height: number; timestamp: number };
      topAbove?: { instances: number; width: number; height: number; timestamp: number };
    };
  } {
    return {
      background: this.cachedInstances.get('background')?.length ?? 0,
      topBelow: this.cachedInstances.get('topBelow')?.length ?? 0,
      topAbove: this.cachedInstances.get('topAbove')?.length ?? 0,
      renderMeta: {
        background: this.lastRenderMeta.get('background'),
        topBelow: this.lastRenderMeta.get('topBelow'),
        topAbove: this.lastRenderMeta.get('topAbove'),
      },
    };
  }

  /**
   * Get raw cached instances array for a pass (for diagnostics)
   */
  getCachedInstancesRaw(pass: PassName): TileInstance[] | undefined {
    return this.cachedInstances.get(pass);
  }

  /**
   * Sample a pixel from a pass framebuffer (for diagnostics)
   */
  sampleFBOPixel(pass: PassName, x: number, y: number): Uint8Array | null {
    return this.framebufferManager.readPixel(pass, x, y);
  }

  /**
   * P1 Diagnostic: Check if cached instance arrays are the same reference
   * Only logs when state changes to avoid console pollution
   */
  private checkArrayReferenceBug(): void {
    const bg = this.cachedInstances.get('background');
    const tb = this.cachedInstances.get('topBelow');
    const ta = this.cachedInstances.get('topAbove');

    const bgTbSame = bg === tb;
    const tbTaSame = tb === ta;
    const bgTaSame = bg === ta;
    const hasBug = bgTbSame || tbTaSame || bgTaSame;

    const state = hasBug
      ? `BUG:bg===tb:${bgTbSame},tb===ta:${tbTaSame},bg===ta:${bgTaSame}`
      : 'OK';

    if (state !== this.lastDiagnosticState) {
      if (hasBug) {
        console.error('[P1-ARRAY-REF] Cached instances are SAME REFERENCE!', {
          'bg===tb': bgTbSame,
          'tb===ta': tbTaSame,
          'bg===ta': bgTaSame,
          bgLen: bg?.length,
          tbLen: tb?.length,
          taLen: ta?.length,
        });
      }
      this.lastDiagnosticState = state;
    }
  }
}
