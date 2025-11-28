/**
 * WebGLRenderPipeline - Main WebGL rendering pipeline
 *
 * Implements the same 3-pass rendering system as the Canvas2D RenderPipeline
 * but using WebGL for hardware-accelerated rendering.
 *
 * The pipeline:
 * 1. Renders tiles to three off-screen framebuffers (background, topBelow, topAbove)
 * 2. Composites these framebuffers to the main canvas with proper ordering
 * 3. Allows sprite rendering between passes for correct z-ordering
 *
 * This is a drop-in replacement for the Canvas2D RenderPipeline.
 */

import { WebGLContext } from './WebGLContext';
import { WebGLTileRenderer } from './WebGLTileRenderer';
import { WebGLFramebufferManager } from './WebGLFramebufferManager';
import { WebGLPassRenderer } from './WebGLPassRenderer';
import { WebGLCompositor } from './WebGLCompositor';
import { WebGLTextureManager } from './WebGLTextureManager';
import { ElevationFilter } from '../ElevationFilter';
import { WebGLAnimationManager } from './WebGLAnimationManager';
import { RENDERING_CONFIG } from '../../config/rendering';
import type {
  WorldCameraView,
  RenderContext,
  RenderOptions,
  TileResolverFn,
  IsVerticalObjectFn,
} from '../types';
import type { Palette } from '../../utils/mapLoader';
import type { LoadedAnimation } from '../types';

export class WebGLRenderPipeline {
  private glContext: WebGLContext;
  private tileRenderer: WebGLTileRenderer;
  private framebufferManager: WebGLFramebufferManager;
  private passRenderer: WebGLPassRenderer;
  private compositor: WebGLCompositor;
  private elevationFilter: ElevationFilter;
  private animationManager: WebGLAnimationManager;

  // Configuration
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  // State
  private resolveTile: TileResolverFn | null = null;
  private isVerticalObject: IsVerticalObjectFn = () => false;
  private lastPlayerElevation: number = -1;
  private lastViewHash: string = '';
  private needsFullRender: boolean = true;

  // Track if tilesets have been uploaded
  private tilesetsUploaded: boolean = false;

  // External callbacks for context events
  private onContextLostCallback: (() => void) | null = null;
  private onContextRestoredCallback: (() => void) | null = null;

  // Cache latest tileset buffers for animation updates
  // (kept in animationManager)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize WebGL context
    this.glContext = new WebGLContext(canvas);
    if (!this.glContext.initialize()) {
      throw new Error('Failed to initialize WebGL2 context');
    }

    this.gl = this.glContext.getGL();

    // Initialize managers
    this.framebufferManager = new WebGLFramebufferManager(this.gl);
    this.tileRenderer = new WebGLTileRenderer(this.glContext);
    this.passRenderer = new WebGLPassRenderer(
      this.gl,
      this.framebufferManager,
      this.tileRenderer
    );
    this.compositor = new WebGLCompositor(this.gl);
    this.animationManager = new WebGLAnimationManager(
      this.gl,
      this.tileRenderer.getTextureManager()
    );

    // Initialize elevation filter
    this.elevationFilter = new ElevationFilter(this.isVerticalObject);

    // Initialize components
    this.tileRenderer.initialize();
    this.compositor.initialize();

    // Set up context loss handling
    this.glContext.setContextLostCallback(() => this.handleContextLost());
    this.glContext.setContextRestoredCallback(() => this.handleContextRestored());
  }

  /**
   * Set the tile resolver function
   */
  setTileResolver(fn: TileResolverFn): void {
    this.resolveTile = fn;
    this.needsFullRender = true;
  }

  /**
   * Set the vertical object checker function
   */
  setVerticalObjectChecker(fn: IsVerticalObjectFn): void {
    this.isVerticalObject = fn;
    this.elevationFilter.setVerticalObjectChecker(fn);
    this.needsFullRender = true;
  }

  /**
   * Upload tileset data to GPU
   *
   * Must be called before rendering when tilesets are loaded/changed.
   */
  uploadTilesets(
    primaryTileset: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondaryTileset: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number,
    animations?: LoadedAnimation[]
  ): void {
    this.tileRenderer.uploadTileset('primary', primaryTileset, primaryWidth, primaryHeight);
    this.tileRenderer.uploadTileset('secondary', secondaryTileset, secondaryWidth, secondaryHeight);

    // Configure animation manager
    this.animationManager.setTilesetBuffers(
      primaryTileset,
      primaryWidth,
      primaryHeight,
      secondaryTileset,
      secondaryWidth,
      secondaryHeight
    );
    if (animations) {
      this.animationManager.registerAnimations(animations);
    }

    this.tilesetsUploaded = true;
    this.needsFullRender = true;
  }

  /**
   * Upload palette data to GPU
   */
  uploadPalettes(palettes: Palette[]): void {
    this.tileRenderer.uploadPalettes(palettes);
    this.needsFullRender = true;
  }

  /**
   * Render all three passes for the current frame
   *
   * @param ctx - Render context with world and tileset data
   * @param view - Camera view defining visible tiles
   * @param playerElevation - Current player elevation (0-15)
   * @param options - Rendering options
   */
  render(
    _ctx: RenderContext,
    view: WorldCameraView,
    playerElevation: number,
    options: RenderOptions = {}
  ): void {
    if (!this.resolveTile) {
      console.warn('WebGLRenderPipeline: No tile resolver set');
      return;
    }

    if (!this.tilesetsUploaded) {
      console.warn('WebGLRenderPipeline: Tilesets not uploaded');
      return;
    }

    if (!this.glContext.isValid()) {
      console.warn('WebGLRenderPipeline: WebGL context is lost');
      return;
    }

    const {
      needsFullRender: forceFullRender,
      animationChanged,
      elevationChanged: optionElevationChanged,
      gameFrame = 0,
    } = options;

    // Check if elevation changed
    const elevationChanged = optionElevationChanged || playerElevation !== this.lastPlayerElevation;
    this.lastPlayerElevation = playerElevation;

    // Check if view changed
    const viewHash = `${view.worldStartTileX},${view.worldStartTileY},${view.tilesWide},${view.tilesHigh}`;
    const viewChanged = viewHash !== this.lastViewHash;
    this.lastViewHash = viewHash;

    const allowDirtyTracking = RENDERING_CONFIG.webgl.enableDirtyTracking;

    // Handle animation-only frame: update textures and re-blit cached instances
    const animationOnly =
      allowDirtyTracking &&
      animationChanged &&
      !forceFullRender &&
      !viewChanged &&
      !elevationChanged &&
      !this.needsFullRender;

    if (animationOnly) {
      const updated = this.animationManager.updateAnimations(gameFrame);
      const dims = this.passRenderer.getCurrentDimensions();
      if (updated && dims) {
        this.passRenderer.rerenderCached();
      }
      return;
    }

    // Ensure textures reflect latest animation frame before full/partial renders
    if (animationChanged) {
      this.animationManager.updateAnimations(gameFrame);
    }

    // Determine if we need to re-render
    const shouldRender = this.needsFullRender ||
                         forceFullRender ||
                         viewChanged ||
                         elevationChanged ||
                         animationChanged;

    if (!shouldRender) {
      return;
    }

    // Calculate render dimensions (in pixels)
    const renderWidth = view.tilesWide * 16; // 16px per metatile
    const renderHeight = view.tilesHigh * 16;

    // Create elevation filters
    const { below: filterBelow, above: filterAbove } = this.elevationFilter.createFilter(playerElevation);

    // Render all three passes
    this.passRenderer.renderBackground(
      view,
      this.resolveTile,
      renderWidth,
      renderHeight
    );

    this.passRenderer.renderTopBelow(
      view,
      this.resolveTile,
      filterBelow,
      renderWidth,
      renderHeight
    );

    this.passRenderer.renderTopAbove(
      view,
      this.resolveTile,
      filterAbove,
      renderWidth,
      renderHeight
    );

    this.needsFullRender = false;
  }

  /**
   * Composite background and topBelow layers to the main canvas
   *
   * Call this before rendering sprites.
   */
  composite(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    this.compositeBackgroundOnly(mainCtx, view);
    this.compositeTopBelowOnly(mainCtx, view);
  }

  /**
   * Composite only the background layer
   */
  compositeBackgroundOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    this.compositePassToCanvas('background', mainCtx, view, true);
  }

  /**
   * Composite only the topBelow layer
   */
  compositeTopBelowOnly(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    this.compositePassToCanvas('topBelow', mainCtx, view, false);
  }

  /**
   * Composite the topAbove layer
   *
   * Call this after rendering sprites.
   */
  compositeTopAbove(mainCtx: CanvasRenderingContext2D, view: WorldCameraView): void {
    this.compositePassToCanvas('topAbove', mainCtx, view, false);
  }

  /**
   * Invalidate all cached passes
   */
  invalidate(): void {
    this.needsFullRender = true;
    this.lastViewHash = '';
    this.passRenderer.invalidate();
  }

  /**
   * Get rendering statistics
   */
  getStats(): {
    webglSupported: boolean;
    contextValid: boolean;
    tilesetsUploaded: boolean;
    passTileCounts: { background: number; topBelow: number; topAbove: number };
  } {
    return {
      webglSupported: true,
      contextValid: this.glContext.isValid(),
      tilesetsUploaded: this.tilesetsUploaded,
      passTileCounts: this.passRenderer.getStats(),
    };
  }

  /**
   * Get the WebGL texture manager (for advanced usage like animation updates)
   */
  getTextureManager(): WebGLTextureManager {
    return this.tileRenderer.getTextureManager();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.compositor.dispose();
    this.tileRenderer.dispose();
    this.framebufferManager.dispose();
    this.glContext.dispose();
  }

  /**
   * Composite a pass texture to a Canvas2D context
   *
   * This copies the WebGL framebuffer to the Canvas2D context,
   * allowing interleaving with sprite rendering.
   */
  private compositePassToCanvas(
    pass: 'background' | 'topBelow' | 'topAbove',
    mainCtx: CanvasRenderingContext2D,
    view: WorldCameraView,
    clearFirst: boolean
  ): void {
    // Ensure pixel-perfect copy from WebGL to 2D canvas (avoid smoothing artifacts)
    mainCtx.imageSmoothingEnabled = false;

    const dims = this.framebufferManager.getDimensions(pass);
    if (!dims) return;

    // Ensure WebGL canvas matches render dimensions
    if (this.canvas.width !== dims.width || this.canvas.height !== dims.height) {
      this.canvas.width = dims.width;
      this.canvas.height = dims.height;
    }

    // Read pixels from framebuffer
    const passTexture = this.framebufferManager.getPassTexture(pass);

    // Always clear WebGL canvas before drawing each pass texture
    // (we want just this pass's content, not blended with previous)
    this.compositor.compositeToScreen(
      passTexture,
      dims.width,
      dims.height,
      0, // No sub-pixel offset for now
      0,
      true // Always clear WebGL canvas
    );

    // Calculate sub-tile offset for smooth scrolling (0-15 pixels within the tile)
    const offsetX = view.subTileOffsetX;
    const offsetY = view.subTileOffsetY;

    // Copy WebGL canvas to 2D context with offset
    if (clearFirst) {
      mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    }

    mainCtx.drawImage(
      this.canvas,
      -offsetX,
      -offsetY
    );
  }

  /**
   * Set callback for when WebGL context is lost
   */
  setContextLostCallback(callback: () => void): void {
    this.onContextLostCallback = callback;
  }

  /**
   * Set callback for when WebGL context is restored
   */
  setContextRestoredCallback(callback: () => void): void {
    this.onContextRestoredCallback = callback;
  }

  /**
   * Handle WebGL context loss
   */
  private handleContextLost(): void {
    console.warn('WebGL context lost');
    this.tilesetsUploaded = false;
    this.needsFullRender = true;

    // Notify external callback
    if (this.onContextLostCallback) {
      this.onContextLostCallback();
    }
  }

  /**
   * Handle WebGL context restoration
   */
  private handleContextRestored(): void {
    console.info('WebGL context restored');

    // Re-initialize components
    this.tileRenderer.initialize();
    this.compositor.initialize();

    // Tilesets need to be re-uploaded by the application
    this.tilesetsUploaded = false;
    this.needsFullRender = true;

    // Notify external callback
    if (this.onContextRestoredCallback) {
      this.onContextRestoredCallback();
    }
  }
}
