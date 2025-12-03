/**
 * RendererFactory - Creates complete renderer sets for game rendering
 *
 * Wraps RenderPipelineFactory and creates sprite/fade renderers to provide
 * a complete rendering backend.
 */

import { RenderPipelineFactory, type RenderPipelineFactoryResult } from './RenderPipelineFactory';
import { WebGLSpriteRenderer } from './webgl/WebGLSpriteRenderer';
import { WebGLFadeRenderer } from './webgl/WebGLFadeRenderer';
import { WebGLRenderPipeline } from './webgl/WebGLRenderPipeline';
import { Canvas2DSpriteRenderer } from './Canvas2DSpriteRenderer';
import { Canvas2DFadeRenderer } from './Canvas2DFadeRenderer';
import type { IRenderPipeline, RendererType } from './IRenderPipeline';
import type { ISpriteRenderer } from './ISpriteRenderer';
import type { IFadeRenderer } from './IFadeRenderer';

export type { RendererType };

export interface RendererSet {
  type: RendererType;
  pipeline: IRenderPipeline;
  spriteRenderer: ISpriteRenderer;
  fadeRenderer: IFadeRenderer;
  /** WebGL canvas (only for WebGL renderer) */
  webglCanvas: HTMLCanvasElement | null;
  /** For WebGL: access to underlying WebGLRenderPipeline */
  getWebGLPipeline?: () => WebGLRenderPipeline;
  /** Dispose all renderers */
  dispose: () => void;
}

export interface RendererFactoryOptions {
  /** Force a specific renderer type (skips auto-detection) */
  forceType?: RendererType;
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Detect the best available renderer type
 */
export function detectRendererType(): RendererType {
  const testCanvas = document.createElement('canvas');
  testCanvas.width = 1;
  testCanvas.height = 1;
  return RenderPipelineFactory.supportsWebGL2(testCanvas) ? 'webgl' : 'canvas2d';
}

/**
 * Create a complete renderer set
 */
export function createRenderers(options: RendererFactoryOptions): RendererSet {
  const { forceType, viewportWidth, viewportHeight } = options;
  const type = forceType ?? detectRendererType();

  if (type === 'webgl') {
    return createWebGLRenderers(viewportWidth, viewportHeight);
  } else {
    return createCanvas2DRenderers(viewportWidth, viewportHeight);
  }
}

/**
 * Create WebGL renderer set
 */
function createWebGLRenderers(
  viewportWidth: number,
  viewportHeight: number
): RendererSet {
  // Create WebGL canvas
  const webglCanvas = document.createElement('canvas');
  webglCanvas.width = viewportWidth;
  webglCanvas.height = viewportHeight;

  console.log('[RendererFactory] Creating WebGL pipeline, canvas:', viewportWidth, 'x', viewportHeight);

  // Create pipeline using factory
  let pipelineResult: RenderPipelineFactoryResult;
  try {
    pipelineResult = RenderPipelineFactory.create(webglCanvas, {
      preferWebGL: true,
    });
    console.log('[RendererFactory] Pipeline created, type:', pipelineResult.rendererType);
  } catch (e) {
    console.error('[RendererFactory] Pipeline creation threw:', e);
    return createCanvas2DRenderers(viewportWidth, viewportHeight);
  }

  if (pipelineResult.rendererType !== 'webgl') {
    // WebGL failed, fall back to Canvas2D
    console.warn('[RendererFactory] WebGL not available, falling back to Canvas2D');
    return createCanvas2DRenderers(viewportWidth, viewportHeight);
  }

  // Get the underlying WebGL pipeline to access GL context
  const webglAdapter = pipelineResult.pipeline as ReturnType<typeof RenderPipelineFactory.createWebGL>;
  const webglPipeline = webglAdapter.getUnderlyingPipeline();
  const gl = webglPipeline.getGL();

  // Create and initialize sprite renderer
  const spriteRenderer = new WebGLSpriteRenderer(gl);
  spriteRenderer.initialize();

  // Create and initialize fade renderer
  const fadeRenderer = new WebGLFadeRenderer(gl);
  fadeRenderer.initialize();

  return {
    type: 'webgl',
    pipeline: pipelineResult.pipeline,
    spriteRenderer,
    fadeRenderer,
    webglCanvas,
    getWebGLPipeline: () => webglPipeline,
    dispose: () => {
      pipelineResult.pipeline.dispose();
      spriteRenderer.dispose();
      fadeRenderer.dispose();
    },
  };
}

/**
 * Create Canvas2D renderer set
 */
function createCanvas2DRenderers(
  viewportWidth: number,
  viewportHeight: number
): RendererSet {
  // Create offscreen canvas for rendering
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = viewportWidth;
  offscreenCanvas.height = viewportHeight;

  const ctx = offscreenCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Create pipeline using factory
  const pipelineResult = RenderPipelineFactory.create(undefined, {
    preferWebGL: false,
  });

  // Create sprite renderer
  const spriteRenderer = new Canvas2DSpriteRenderer(ctx);

  // Create fade renderer
  const fadeRenderer = new Canvas2DFadeRenderer(ctx, viewportWidth, viewportHeight);

  return {
    type: 'canvas2d',
    pipeline: pipelineResult.pipeline,
    spriteRenderer,
    fadeRenderer,
    webglCanvas: null,
    dispose: () => {
      pipelineResult.pipeline.dispose();
      spriteRenderer.dispose();
      fadeRenderer.dispose();
    },
  };
}

/**
 * Get renderer type from URL query param
 */
export function getRendererTypeFromURL(): RendererType | null {
  const params = new URLSearchParams(window.location.search);
  const renderer = params.get('renderer');
  if (renderer === 'webgl' || renderer === 'canvas2d') {
    return renderer;
  }
  return null;
}
