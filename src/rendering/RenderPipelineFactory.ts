/**
 * RenderPipelineFactory - Creates render pipelines with automatic fallback
 *
 * This factory:
 * - Detects WebGL2 support
 * - Creates the appropriate pipeline (WebGL or Canvas2D)
 * - Provides automatic fallback if WebGL fails
 *
 * Usage:
 * ```typescript
 * const pipeline = RenderPipelineFactory.create(canvas, { preferWebGL: true });
 * // pipeline implements IRenderPipeline
 * ```
 */

import type { IRenderPipeline, RendererType } from './IRenderPipeline';
import { RenderPipeline } from './RenderPipeline';
import { TilesetCanvasCache } from './TilesetCanvasCache';
import { WebGLRenderPipeline } from './webgl/WebGLRenderPipeline';
import { RENDERING_CONFIG } from '../config/rendering';

/**
 * Factory options for creating render pipelines
 */
export interface RenderPipelineFactoryOptions {
  /** Prefer WebGL if available (default: true) */
  preferWebGL?: boolean;

  /** Existing tileset cache to use for Canvas2D (optional) */
  tilesetCache?: TilesetCanvasCache;

  /** Callback when WebGL context is lost */
  onContextLost?: () => void;

  /** Callback when WebGL context is restored */
  onContextRestored?: () => void;
}

/**
 * Factory result with pipeline and metadata
 */
export interface RenderPipelineFactoryResult {
  /** The created pipeline */
  pipeline: IRenderPipeline;

  /** The renderer type that was selected */
  rendererType: RendererType;

  /** Whether WebGL was available but not selected */
  webglAvailable: boolean;

  /** For WebGL pipelines, the canvas used for rendering */
  webglCanvas?: HTMLCanvasElement;
}

/**
 * Check if WebGL2 is supported with required capabilities
 * Uses a temporary canvas to avoid affecting the actual rendering canvas.
 */
function supportsWebGL2(_canvas: HTMLCanvasElement): boolean {
  try {
    // Use a temporary canvas for testing to avoid affecting the real one
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;

    const gl = testCanvas.getContext('webgl2');
    if (!gl) {
      if (RENDERING_CONFIG.debug.logContextEvents) {
        console.log('[RenderPipelineFactory] WebGL2 not available');
      }
      return false;
    }

    // Check required capabilities
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);

    if (maxTextureSize < 2048) {
      if (RENDERING_CONFIG.debug.logContextEvents) {
        console.log(`[RenderPipelineFactory] WebGL2 texture size too small: ${maxTextureSize}`);
      }
      return false;
    }

    if (maxTextureUnits < 4) {
      if (RENDERING_CONFIG.debug.logContextEvents) {
        console.log(`[RenderPipelineFactory] WebGL2 texture units too few: ${maxTextureUnits}`);
      }
      return false;
    }

    // Release the test context (on the temporary canvas, not the real one)
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext();
    }

    if (RENDERING_CONFIG.debug.logContextEvents) {
      console.log(`[RenderPipelineFactory] WebGL2 supported (max texture: ${maxTextureSize})`);
    }

    return true;
  } catch (e) {
    if (RENDERING_CONFIG.debug.logContextEvents) {
      console.log('[RenderPipelineFactory] WebGL2 check failed:', e);
    }
    return false;
  }
}

/**
 * Create a Canvas2D pipeline wrapped in IRenderPipeline
 */
function createCanvas2DPipeline(
  tilesetCache?: TilesetCanvasCache
): IRenderPipeline {
  const cache = tilesetCache ?? new TilesetCanvasCache();
  return new CanvasRenderPipelineAdapter(new RenderPipeline(cache));
}

/**
 * Adapter to make Canvas2D RenderPipeline implement IRenderPipeline
 *
 * This wraps the existing RenderPipeline class to provide the
 * IRenderPipeline interface methods.
 */
class CanvasRenderPipelineAdapter implements IRenderPipeline {
  private pipeline: RenderPipeline;

  readonly rendererType: RendererType = 'canvas2d';

  constructor(pipeline: RenderPipeline) {
    this.pipeline = pipeline;
  }

  setTileResolver(fn: Parameters<RenderPipeline['setTileResolver']>[0]): void {
    this.pipeline.setTileResolver(fn);
  }

  setVerticalObjectChecker(fn: Parameters<RenderPipeline['setVerticalObjectChecker']>[0]): void {
    this.pipeline.setVerticalObjectChecker(fn);
  }

  render(
    ctx: Parameters<RenderPipeline['render']>[0],
    view: Parameters<RenderPipeline['render']>[1],
    playerElevation: Parameters<RenderPipeline['render']>[2],
    options?: Parameters<RenderPipeline['render']>[3]
  ): void {
    this.pipeline.render(ctx, view, playerElevation, options);
  }

  composite(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<RenderPipeline['composite']>[1]
  ): void {
    this.pipeline.composite(mainCtx, view);
  }

  compositeBackgroundOnly(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<RenderPipeline['compositeBackgroundOnly']>[1]
  ): void {
    this.pipeline.compositeBackgroundOnly(mainCtx, view);
  }

  compositeTopBelowOnly(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<RenderPipeline['compositeTopBelowOnly']>[1]
  ): void {
    this.pipeline.compositeTopBelowOnly(mainCtx, view);
  }

  compositeTopAbove(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<RenderPipeline['compositeTopAbove']>[1]
  ): void {
    this.pipeline.compositeTopAbove(mainCtx, view);
  }

  invalidate(): void {
    this.pipeline.invalidate();
  }

  isValid(): boolean {
    // Canvas2D is always valid
    return true;
  }

  dispose(): void {
    // Canvas2D doesn't have resources to dispose
    this.pipeline.clearTilesetCache();
  }

  getStats() {
    const stats = this.pipeline.getCacheStats();
    return {
      rendererType: 'canvas2d' as const,
      isValid: true,
      ...stats,
    };
  }

  /**
   * Get the underlying RenderPipeline (for accessing Canvas2D-specific features)
   */
  getUnderlyingPipeline(): RenderPipeline {
    return this.pipeline;
  }
}

/**
 * Adapter to make WebGLRenderPipeline implement IRenderPipeline
 */
class WebGLRenderPipelineAdapter implements IRenderPipeline {
  private pipeline: WebGLRenderPipeline;

  readonly rendererType: RendererType = 'webgl';

  constructor(
    canvas: HTMLCanvasElement,
    onContextLost?: () => void,
    onContextRestored?: () => void
  ) {
    this.pipeline = new WebGLRenderPipeline(canvas);

    // Set up context loss callbacks
    if (onContextLost) {
      this.pipeline.setContextLostCallback(onContextLost);
    }
    if (onContextRestored) {
      this.pipeline.setContextRestoredCallback(onContextRestored);
    }
  }

  setTileResolver(fn: Parameters<WebGLRenderPipeline['setTileResolver']>[0]): void {
    this.pipeline.setTileResolver(fn);
  }

  setVerticalObjectChecker(fn: Parameters<WebGLRenderPipeline['setVerticalObjectChecker']>[0]): void {
    this.pipeline.setVerticalObjectChecker(fn);
  }

  render(
    ctx: Parameters<WebGLRenderPipeline['render']>[0],
    view: Parameters<WebGLRenderPipeline['render']>[1],
    playerElevation: Parameters<WebGLRenderPipeline['render']>[2],
    options?: Parameters<WebGLRenderPipeline['render']>[3]
  ): void {
    this.pipeline.render(ctx, view, playerElevation, options);
  }

  composite(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<WebGLRenderPipeline['composite']>[1]
  ): void {
    this.pipeline.composite(mainCtx, view);
  }

  compositeBackgroundOnly(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<WebGLRenderPipeline['compositeBackgroundOnly']>[1]
  ): void {
    this.pipeline.compositeBackgroundOnly(mainCtx, view);
  }

  compositeTopBelowOnly(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<WebGLRenderPipeline['compositeTopBelowOnly']>[1]
  ): void {
    this.pipeline.compositeTopBelowOnly(mainCtx, view);
  }

  compositeTopAbove(
    mainCtx: CanvasRenderingContext2D,
    view: Parameters<WebGLRenderPipeline['compositeTopAbove']>[1]
  ): void {
    this.pipeline.compositeTopAbove(mainCtx, view);
  }

  invalidate(): void {
    this.pipeline.invalidate();
  }

  isValid(): boolean {
    return this.pipeline.getStats().contextValid;
  }

  dispose(): void {
    this.pipeline.dispose();
  }

  getStats() {
    const stats = this.pipeline.getStats();
    return {
      rendererType: 'webgl' as const,
      isValid: stats.contextValid,
      ...stats,
    };
  }

  /**
   * Get the underlying WebGLRenderPipeline (for accessing WebGL-specific features)
   */
  getUnderlyingPipeline(): WebGLRenderPipeline {
    return this.pipeline;
  }

  /**
   * Upload tileset data to GPU (WebGL-specific)
   */
  uploadTilesets(
    primaryTileset: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondaryTileset: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number,
    animations?: Parameters<WebGLRenderPipeline['uploadTilesets']>[6]
  ): void {
    this.pipeline.uploadTilesets(
      primaryTileset,
      primaryWidth,
      primaryHeight,
      secondaryTileset,
      secondaryWidth,
      secondaryHeight,
      animations
    );
  }

  /**
   * Upload palette data to GPU (WebGL-specific)
   */
  uploadPalettes(palettes: Parameters<WebGLRenderPipeline['uploadPalettes']>[0]): void {
    this.pipeline.uploadPalettes(palettes);
  }

  /**
   * Get the texture manager (WebGL-specific, for animation updates)
   */
  getTextureManager() {
    return this.pipeline.getTextureManager();
  }
}

/**
 * Render Pipeline Factory
 *
 * Creates render pipelines with automatic WebGL fallback to Canvas2D.
 */
export class RenderPipelineFactory {
  /**
   * Create a render pipeline
   *
   * @param canvas - Canvas element for WebGL rendering (optional for Canvas2D-only)
   * @param options - Factory options
   * @returns Factory result with pipeline and metadata
   */
  static create(
    canvas?: HTMLCanvasElement,
    options: RenderPipelineFactoryOptions = {}
  ): RenderPipelineFactoryResult {
    const {
      preferWebGL = RENDERING_CONFIG.enableWebGL,
      tilesetCache,
      onContextLost,
      onContextRestored,
    } = options;

    // Check if WebGL is forced off
    const forceCanvas2D = RENDERING_CONFIG.forceCanvas2D;

    // Check WebGL availability
    const webglAvailable = canvas ? supportsWebGL2(canvas) : false;

    // Determine if we should use WebGL
    const useWebGL = !forceCanvas2D && preferWebGL && webglAvailable && canvas;

    if (useWebGL && canvas) {
      try {
        const adapter = new WebGLRenderPipelineAdapter(
          canvas,
          onContextLost,
          onContextRestored
        );

        if (RENDERING_CONFIG.debug.showRendererType) {
          console.log('[RenderPipelineFactory] Created WebGL pipeline');
        }

        return {
          pipeline: adapter,
          rendererType: 'webgl',
          webglAvailable: true,
          webglCanvas: canvas,
        };
      } catch (e) {
        console.warn('[RenderPipelineFactory] WebGL pipeline creation failed, falling back to Canvas2D:', e);
      }
    }

    // Fallback to Canvas2D
    const pipeline = createCanvas2DPipeline(tilesetCache);

    if (RENDERING_CONFIG.debug.showRendererType) {
      console.log('[RenderPipelineFactory] Created Canvas2D pipeline');
    }

    return {
      pipeline,
      rendererType: 'canvas2d',
      webglAvailable,
    };
  }

  /**
   * Check if WebGL2 is supported
   *
   * @param canvas - Canvas element to test
   * @returns true if WebGL2 is supported
   */
  static supportsWebGL2(canvas: HTMLCanvasElement): boolean {
    return supportsWebGL2(canvas);
  }

  /**
   * Create a Canvas2D pipeline directly (no WebGL)
   *
   * @param tilesetCache - Optional existing tileset cache
   * @returns Canvas2D render pipeline
   */
  static createCanvas2D(tilesetCache?: TilesetCanvasCache): IRenderPipeline {
    return createCanvas2DPipeline(tilesetCache);
  }

  /**
   * Create a WebGL pipeline directly (throws if not supported)
   *
   * @param canvas - Canvas element for WebGL rendering
   * @param options - Optional context callbacks
   * @returns WebGL render pipeline adapter
   * @throws Error if WebGL2 is not supported
   */
  static createWebGL(
    canvas: HTMLCanvasElement,
    options?: {
      onContextLost?: () => void;
      onContextRestored?: () => void;
    }
  ): WebGLRenderPipelineAdapter {
    if (!supportsWebGL2(canvas)) {
      throw new Error('WebGL2 is not supported on this device');
    }

    return new WebGLRenderPipelineAdapter(
      canvas,
      options?.onContextLost,
      options?.onContextRestored
    );
  }
}

// Re-export the adapter types for type checking
export { CanvasRenderPipelineAdapter, WebGLRenderPipelineAdapter };
