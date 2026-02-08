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

type RenderInfoEntry = {
  timestamp: number;
  reason: string;
  animationOnly: boolean;
  tilesetVersion: number;
  viewHash: string;
  updatedAnimations: boolean;
  hadCaches: boolean;
};

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
  private needsWarmupRender: boolean = true;

  // Track if tilesets have been uploaded
  private tilesetsUploaded: boolean = false;
  // Monotonic version for tileset content; included in view hash
  private tilesetVersion: number = 0;
  private lastRenderedTilesetVersion: number = -1;
  private lastRenderInfo: RenderInfoEntry | null = null;
  private renderHistory: RenderInfoEntry[] = [];

  // External callbacks for context events
  private onContextLostCallback: (() => void) | null = null;
  private onContextRestoredCallback: (() => void) | null = null;

  // P2 Diagnostic: Track FBO empty state to only log on change
  private lastFBODiagnosticState: string = '';

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
   * Get the WebGL2 rendering context
   *
   * Useful for creating additional renderers (e.g., WebGLSpriteRenderer)
   * that share the same GL context.
   */
  getGL(): WebGL2RenderingContext {
    return this.gl;
  }

  /**
   * Set the tile resolver function
   */
  setTileResolver(fn: TileResolverFn): void {
    this.resolveTile = fn;
    this.needsFullRender = true;
    this.needsWarmupRender = true;
  }

  /**
   * Set the vertical object checker function
   */
  setVerticalObjectChecker(fn: IsVerticalObjectFn): void {
    this.isVerticalObject = fn;
    this.elevationFilter.setVerticalObjectChecker(fn);
    this.needsFullRender = true;
    this.needsWarmupRender = true;
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
    this.needsWarmupRender = true;
    this.tilesetVersion++;
  }

  /**
   * Upload palette data to GPU
   */
  uploadPalettes(palettes: Palette[]): void {
    this.tileRenderer.uploadPalettes(palettes);
    this.needsFullRender = true;
  }

  /**
   * Upload second tileset pair to GPU (for multi-tileset worlds)
   */
  uploadTilesetsPair1(
    primaryTileset: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondaryTileset: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number,
    animations?: LoadedAnimation[]
  ): void {
    this.tileRenderer.uploadTilesetPair1('primary', primaryTileset, primaryWidth, primaryHeight);
    this.tileRenderer.uploadTilesetPair1('secondary', secondaryTileset, secondaryWidth, secondaryHeight);

    // Configure animation manager for pair 1
    this.animationManager.setTilesetBuffersPair1(
      primaryTileset,
      primaryWidth,
      primaryHeight,
      secondaryTileset,
      secondaryWidth,
      secondaryHeight
    );
    if (animations) {
      this.animationManager.registerAnimationsPair1(animations);
    }

    this.needsFullRender = true;
    this.needsWarmupRender = true;
    this.tilesetVersion++;
  }

  /**
   * Upload palettes for second tileset pair (for multi-tileset worlds)
   */
  uploadPalettesPair1(palettes: Palette[]): void {
    this.tileRenderer.uploadPalettesPair1(palettes);
    this.needsFullRender = true;
  }

  /**
   * Upload third tileset pair to GPU (for viewing 3+ tilesets)
   */
  uploadTilesetsPair2(
    primaryTileset: Uint8Array,
    primaryWidth: number,
    primaryHeight: number,
    secondaryTileset: Uint8Array,
    secondaryWidth: number,
    secondaryHeight: number,
    animations?: LoadedAnimation[]
  ): void {
    this.tileRenderer.uploadTilesetPair2('primary', primaryTileset, primaryWidth, primaryHeight);
    this.tileRenderer.uploadTilesetPair2('secondary', secondaryTileset, secondaryWidth, secondaryHeight);

    // Configure animation manager for pair 2
    this.animationManager.setTilesetBuffersPair2(
      primaryTileset,
      primaryWidth,
      primaryHeight,
      secondaryTileset,
      secondaryWidth,
      secondaryHeight
    );
    if (animations) {
      this.animationManager.registerAnimationsPair2(animations);
    }

    this.needsFullRender = true;
    this.needsWarmupRender = true;
    this.tilesetVersion++;
  }

  /**
   * Upload palettes for third tileset pair (for viewing 3+ tilesets)
   */
  uploadPalettesPair2(palettes: Palette[]): void {
    this.tileRenderer.uploadPalettesPair2(palettes);
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
      needsFullRender: forceFullRender = false,
      animationChanged = false,
      elevationChanged: optionElevationChanged,
      gameFrame = 0,
    } = options;

    // Check if elevation changed
    const elevationChanged = optionElevationChanged || playerElevation !== this.lastPlayerElevation;
    this.lastPlayerElevation = playerElevation;

    // Check if view changed (include tilesetVersion so tileset updates force a render)
    const viewHash = `${this.tilesetVersion}:${view.worldStartTileX},${view.worldStartTileY},${view.tilesWide},${view.tilesHigh}`;
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
      !this.needsFullRender &&
      !this.needsWarmupRender &&
      this.passRenderer.hasCachedInstances() &&
      this.lastRenderedTilesetVersion === this.tilesetVersion;

    if (animationOnly) {
      const updated = this.animationManager.updateAnimations(gameFrame);
      if (updated) {
        this.passRenderer.rerenderCached();
      }

      // P2 Diagnostic: Check if FBOs are empty despite having caches
      this.checkFBOEmptyBug('animationOnly', updated);

      this.recordRenderEvent({
        reason: 'animationOnly',
        animationOnly: true,
        tilesetVersion: this.tilesetVersion,
        viewHash,
        updatedAnimations: updated,
        hadCaches: this.passRenderer.hasCachedInstances(),
      });
      return;
    }

    // Ensure textures reflect latest animation frame before full/partial renders
    if (animationChanged) {
      this.animationManager.updateAnimations(gameFrame);
    }

    // Determine if we need to re-render
    const shouldRender = this.needsWarmupRender ||
                         this.needsFullRender ||
                         forceFullRender ||
                         viewChanged ||
                         elevationChanged ||
                         animationChanged;

    if (!shouldRender) {
      // P2 Diagnostic: Check if FBOs are empty despite having caches
      this.checkFBOEmptyBug('skipped-nochange', false);

      this.recordRenderEvent({
        reason: 'skipped-nochange',
        animationOnly: false,
        tilesetVersion: this.tilesetVersion,
        viewHash,
        updatedAnimations: animationChanged,
        hadCaches: this.passRenderer.hasCachedInstances(),
      });
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

    // P3 Diagnostic: Check if full render produced pixels
    this.checkFullRenderProducedPixels();

    this.needsFullRender = false;
    this.needsWarmupRender = false;
    this.lastRenderedTilesetVersion = this.tilesetVersion;

    this.recordRenderEvent({
      reason: this.composeRenderReason({
        warmup: this.needsWarmupRender,
        forceFullRender,
        viewChanged,
        elevationChanged,
        animationChanged,
      }),
      animationOnly: false,
      tilesetVersion: this.tilesetVersion,
      viewHash,
      updatedAnimations: animationChanged,
      hadCaches: this.passRenderer.hasCachedInstances(),
    });
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
   * Render ONLY layer 0 and composite immediately
   *
   * Used for reflection rendering. The order should be:
   * 1. renderAndCompositeLayer0Only() - water/ground base
   * 2. [render reflections]
   * 3. renderAndCompositeLayer1Only() - shore edges cover reflections
   */
  renderAndCompositeLayer0Only(
    mainCtx: CanvasRenderingContext2D,
    view: WorldCameraView
  ): void {
    if (!this.resolveTile) return;

    const renderWidth = view.tilesWide * 16;
    const renderHeight = view.tilesHigh * 16;

    this.passRenderer.renderLayer0Only(view, this.resolveTile, renderWidth, renderHeight);
    this.compositePassToCanvas('background', mainCtx, view, true);
  }

  /**
   * Render ONLY layer 1 (of ALL tiles) and composite immediately
   *
   * Used after reflection rendering. This renders layer 1 of ALL tiles
   * (including COVERED tiles) so shore edges properly cover reflections.
   */
  renderAndCompositeLayer1Only(
    mainCtx: CanvasRenderingContext2D,
    view: WorldCameraView
  ): void {
    if (!this.resolveTile) return;

    const renderWidth = view.tilesWide * 16;
    const renderHeight = view.tilesHigh * 16;

    this.passRenderer.renderLayer1Only(view, this.resolveTile, renderWidth, renderHeight);
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
    this.needsWarmupRender = true;
    this.lastViewHash = '';
    this.lastRenderedTilesetVersion = -1;
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
    tilesetVersion: number;
    lastRenderedTilesetVersion: number;
    needsFullRender: boolean;
    needsWarmupRender: boolean;
    lastViewHash: string;
    hasCachedInstances: boolean;
    lastRenderInfo: RenderInfoEntry | null;
    renderHistory: RenderInfoEntry[];
    renderMeta: {
      background?: { instances: number; width: number; height: number; timestamp: number };
      topBelow?: { instances: number; width: number; height: number; timestamp: number };
      topAbove?: { instances: number; width: number; height: number; timestamp: number };
    };
    samples?: { background?: Uint8Array | null; topBelow?: Uint8Array | null };
  } {
    return {
      webglSupported: true,
      contextValid: this.glContext.isValid(),
      tilesetsUploaded: this.tilesetsUploaded,
      passTileCounts: this.passRenderer.getStats(),
      tilesetVersion: this.tilesetVersion,
      lastRenderedTilesetVersion: this.lastRenderedTilesetVersion,
      needsFullRender: this.needsFullRender,
      needsWarmupRender: this.needsWarmupRender,
      lastViewHash: this.lastViewHash,
      hasCachedInstances: this.passRenderer.hasCachedInstances(),
      lastRenderInfo: this.lastRenderInfo,
      renderHistory: this.renderHistory,
      renderMeta: this.passRenderer.getStats().renderMeta,
      samples: undefined,
    };
  }

  /**
   * Sample center pixels from background/topBelow for debugging.
   * Avoids permanent cost; call only when needed (e.g., debug panel open).
   */
  getPassSamples(): { background?: Uint8Array | null; topBelow?: Uint8Array | null } {
    const dimsBg = this.framebufferManager.getDimensions('background');
    const dimsTb = this.framebufferManager.getDimensions('topBelow');

    const cxBg = dimsBg ? Math.floor(dimsBg.width / 2) : 0;
    const cyBg = dimsBg ? Math.floor(dimsBg.height / 2) : 0;
    const cxTb = dimsTb ? Math.floor(dimsTb.width / 2) : 0;
    const cyTb = dimsTb ? Math.floor(dimsTb.height / 2) : 0;

    return {
      background: dimsBg ? this.framebufferManager.readPixel('background', cxBg, cyBg) : null,
      topBelow: dimsTb ? this.framebufferManager.readPixel('topBelow', cxTb, cyTb) : null,
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
    this.needsWarmupRender = true;
    this.lastRenderedTilesetVersion = -1;
    this.recordRenderEvent({
      reason: 'contextLost',
      animationOnly: false,
      tilesetVersion: this.tilesetVersion,
      viewHash: this.lastViewHash,
      updatedAnimations: false,
      hadCaches: false,
    });

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
    this.needsWarmupRender = true;
    this.lastRenderedTilesetVersion = -1;
    this.recordRenderEvent({
      reason: 'contextRestored',
      animationOnly: false,
      tilesetVersion: this.tilesetVersion,
      viewHash: this.lastViewHash,
      updatedAnimations: false,
      hadCaches: false,
    });

    // Notify external callback
    if (this.onContextRestoredCallback) {
      this.onContextRestoredCallback();
    }
  }

  /**
   * Helper to record a render event into a small ring buffer (max 12)
   */
  private recordRenderEvent(info: {
    reason: string;
    animationOnly: boolean;
    tilesetVersion: number;
    viewHash: string;
    updatedAnimations: boolean;
    hadCaches: boolean;
  }): void {
    const entry = {
      timestamp: performance.now(),
      ...info,
    };
    this.lastRenderInfo = entry;
    this.renderHistory.push(entry);
    const MAX_HISTORY = 12;
    if (this.renderHistory.length > MAX_HISTORY) {
      this.renderHistory.splice(0, this.renderHistory.length - MAX_HISTORY);
    }
  }

  /**
   * Compose a human-readable render reason from flags
   */
  private composeRenderReason(flags: {
    warmup: boolean;
    forceFullRender: boolean;
    viewChanged: boolean;
    elevationChanged: boolean;
    animationChanged: boolean;
  }): string {
    const parts: string[] = [];
    if (flags.warmup) parts.push('warmup');
    if (flags.forceFullRender) parts.push('force');
    if (flags.viewChanged) parts.push('view');
    if (flags.elevationChanged) parts.push('elev');
    if (flags.animationChanged) parts.push('anim');
    if (parts.length === 0) return 'full';
    return parts.join('+');
  }

  /**
   * P3 Diagnostic: Check if full render actually produced pixels in FBOs
   * Only warns if instances exist but pixels don't (empty FBOs with 0 instances are normal)
   */
  private checkFullRenderProducedPixels(): void {
    const bgPixel = this.passRenderer.sampleFBOPixel('background', 168, 168);
    const tbPixel = this.passRenderer.sampleFBOPixel('topBelow', 168, 168);

    const bgInstances = this.passRenderer.getInstanceCount('background');
    const tbInstances = this.passRenderer.getInstanceCount('topBelow');

    const bgEmpty = bgPixel ? bgPixel[3] === 0 : true;
    const tbEmpty = tbPixel ? tbPixel[3] === 0 : true;

    // Only warn if instances exist but pixels don't - empty with 0 instances is normal
    const bgBug = bgEmpty && bgInstances > 0;
    const tbBug = tbEmpty && tbInstances > 0;

    if (bgBug || tbBug) {
      console.error('[P3-FULL-RENDER-EMPTY] Full render completed but FBO(s) empty despite instances!', {
        bgEmpty,
        tbEmpty,
        bgInstances,
        tbInstances,
        taInstances: this.passRenderer.getInstanceCount('topAbove'),
        bgPixel: bgPixel ? Array.from(bgPixel) : null,
        tbPixel: tbPixel ? Array.from(tbPixel) : null,
        tilesetVersion: this.tilesetVersion,
      });
    }
  }

  /**
   * P2 Diagnostic: Check if FBOs are empty despite having cached instances
   * Only logs ONCE when bug is first detected (ignores path changes)
   */
  private checkFBOEmptyBug(path: string, updated: boolean): void {
    // Sample center pixel from each FBO
    const bgPixel = this.passRenderer.sampleFBOPixel('background', 168, 168);
    const tbPixel = this.passRenderer.sampleFBOPixel('topBelow', 168, 168);

    const bgEmpty = bgPixel ? bgPixel[3] === 0 : true;
    const tbEmpty = tbPixel ? tbPixel[3] === 0 : true;
    const hasCaches = this.passRenderer.hasCachedInstances();

    // Only report if we have caches but FBOs are empty
    const hasBug = hasCaches && bgEmpty && tbEmpty;

    // State ignores path - just tracks BUG vs OK
    const state = hasBug ? 'BUG' : 'OK';

    if (state !== this.lastFBODiagnosticState) {
      if (hasBug) {
        console.error('[P2-EMPTY-FBO] FBOs are empty despite having caches!', {
          path,
          updated,
          bgPixel: bgPixel ? Array.from(bgPixel) : null,
          tbPixel: tbPixel ? Array.from(tbPixel) : null,
          bgInstances: this.passRenderer.getInstanceCount('background'),
          tbInstances: this.passRenderer.getInstanceCount('topBelow'),
          tilesetVersion: this.tilesetVersion,
          lastRenderedVersion: this.lastRenderedTilesetVersion,
        });
      }
      this.lastFBODiagnosticState = state;
    }
  }
}
