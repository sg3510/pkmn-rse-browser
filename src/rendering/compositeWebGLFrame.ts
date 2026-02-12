/**
 * compositeWebGLFrame - Layer compositing for WebGL sprite rendering
 *
 * Handles the complex layer ordering required for GBA-accurate rendering:
 * - Background layer (BG2)
 * - Reflection-layer sprites (rendered with water mask)
 * - Low priority sprites (P2/P3)
 * - TopBelow layer (BG1 tiles behind player)
 * - Door and arrow overlays
 * - Main sprites (player, NPCs, field effects)
 * - TopAbove layer (BG1 tiles in front)
 * - Priority 0 sprites (above all BG layers)
 * - Fade overlay
 */

import type { SpriteInstance, WorldCameraView } from './types';
import type { WebGLRenderPipeline } from './webgl/WebGLRenderPipeline';
import type { WebGLSpriteRenderer } from './webgl/WebGLSpriteRenderer';
import type { WebGLFadeRenderer } from './webgl/WebGLFadeRenderer';
import type { WebGLScanlineRenderer } from './webgl/WebGLScanlineRenderer';
import type { WorldSnapshot } from '../game/WorldManager';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import { buildWaterMaskFromView } from './spriteUtils';
import { getReflectionMetaFromSnapshot } from '../game/snapshotUtils';

// =============================================================================
// Types
// =============================================================================

export interface CompositeFrameContext {
  /** WebGL pipeline for tile rendering */
  pipeline: WebGLRenderPipeline;
  /** Sprite renderer for sprite batches */
  spriteRenderer: WebGLSpriteRenderer;
  /** Fade renderer for screen transitions */
  fadeRenderer: WebGLFadeRenderer | null;
  /** Scanline renderer for CRT effect */
  scanlineRenderer: WebGLScanlineRenderer | null;
  /** 2D context for final compositing */
  ctx2d: CanvasRenderingContext2D;
  /** WebGL canvas for sprite rendering */
  webglCanvas: HTMLCanvasElement;
  /** Camera view for rendering */
  view: WorldCameraView;
  /** Current world snapshot */
  snapshot: WorldSnapshot | null;
  /** Tileset runtimes for reflection detection */
  tilesetRuntimes: Map<string, TilesetRuntimeType>;
  /** Optional weather renderer (runs below scanline/fade overlays) */
  renderWeather?: (ctx2d: CanvasRenderingContext2D, view: WorldCameraView, nowMs: number) => void;
}

export interface SpriteGroups {
  /** Low priority sprites (P2/P3 NPCs) */
  lowPrioritySprites: SpriteInstance[];
  /** Main sprites (player, NPCs, effects) */
  allSprites: SpriteInstance[];
  /** High priority sprites (P0 NPCs) */
  priority0Sprites: SpriteInstance[];
  /** Door animation sprites */
  doorSprites: SpriteInstance[];
  /** Arrow overlay sprite */
  arrowSprite: SpriteInstance | null;
  /** Surf blob sprite (rendered behind player) */
  surfBlobSprite?: SpriteInstance | null;
}

export interface CompositeFrameOptions {
  /** Current fade alpha (0-1) */
  fadeAlpha: number;
  /** Scanline intensity (0 = off, 1 = full CRT effect) */
  scanlineIntensity?: number;
  /** Display zoom level for scanline scaling */
  zoom?: number;
  /** Frame timestamp from the game loop */
  nowMs?: number;
}

// =============================================================================
// Main Compositing Function
// =============================================================================

/**
 * Composite a full frame with proper layer ordering.
 *
 * This implements GBA-accurate layer compositing:
 * 1. Layer 0 (BG2 water base)
 * 2. Reflection-layer sprites with water mask
 * 3. Low priority sprites (P2/P3)
 * 4. Layer 1 (BG1 tiles)
 * 5. Door + arrow overlays
 * 6. Main sprites (P1)
 * 7. TopAbove layer
 * 8. Priority 0 sprites
 * 9. Fade overlay
 */
export function compositeWebGLFrame(
  ctx: CompositeFrameContext,
  sprites: SpriteGroups,
  options: CompositeFrameOptions
): void {
  const { pipeline, spriteRenderer, fadeRenderer, scanlineRenderer, ctx2d, webglCanvas, view, snapshot, tilesetRuntimes } = ctx;
  const { renderWeather } = ctx;
  const { lowPrioritySprites, allSprites, priority0Sprites, doorSprites, arrowSprite, surfBlobSprite } = sprites;
  const { fadeAlpha, scanlineIntensity = 0, zoom = 1, nowMs = performance.now() } = options;

  const gl = pipeline.getGL();

  // Add surf blob to main sprites in sorted position without mutating the original array
  // The original array is reused by debug/split layers; mutation caused disappearing sprites on sand
  let spritesWithBlob = allSprites;
  if (surfBlobSprite) {
    const insertIndex = findSortedInsertIndex(allSprites, surfBlobSprite.sortKey);
    spritesWithBlob = [
      ...allSprites.slice(0, insertIndex),
      surfBlobSprite,
      ...allSprites.slice(insertIndex),
    ];
  }

  // Split sprites into reflection-layer and normal
  const reflectionLayerSprites = spritesWithBlob.filter((s) => s.isReflection || s.isReflectionLayer);
  const normalSprites = spritesWithBlob.filter((s) => !s.isReflection && !s.isReflectionLayer);
  const lowPriorityReflections = lowPrioritySprites.filter((s) => s.isReflection || s.isReflectionLayer);
  const normalLowPrioritySprites = lowPrioritySprites.filter((s) => !s.isReflection && !s.isReflectionLayer);

  // Build overlay sprites (doors + arrow)
  const overlaySprites = [...doorSprites];
  if (arrowSprite) overlaySprites.push(arrowSprite);

  if (reflectionLayerSprites.length > 0 && snapshot) {
    // === Split layer rendering for reflections ===
    compositeWithReflections(
      ctx,
      reflectionLayerSprites,
      lowPriorityReflections,
      normalSprites,
      normalLowPrioritySprites,
      overlaySprites,
      gl,
      snapshot,
      tilesetRuntimes
    );
  } else {
    // === Standard compositing (no reflections) ===
    compositeStandard(ctx, lowPrioritySprites, spritesWithBlob, overlaySprites, gl);
  }

  // TopAbove layer (renders on both paths)
  pipeline.compositeTopAbove(ctx2d, view);

  // Priority 0 sprites (above all BG layers)
  if (priority0Sprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(priority0Sprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  // Weather renders as a post-composite field layer, below scanline/fade overlays.
  renderWeather?.(ctx2d, view, nowMs);

  // Scanline overlay (CRT effect when menu is open)
  if (scanlineIntensity > 0 && scanlineRenderer) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    scanlineRenderer.render(scanlineIntensity, view.pixelWidth, view.pixelHeight, zoom);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  // Fade overlay
  if (fadeAlpha > 0 && fadeRenderer) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    fadeRenderer.render(fadeAlpha);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function compositeWithReflections(
  ctx: CompositeFrameContext,
  reflectionLayerSprites: SpriteInstance[],
  lowPriorityReflections: SpriteInstance[],
  normalSprites: SpriteInstance[],
  normalLowPrioritySprites: SpriteInstance[],
  overlaySprites: SpriteInstance[],
  gl: WebGL2RenderingContext,
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntimeType>
): void {
  const { pipeline, spriteRenderer, ctx2d, webglCanvas, view } = ctx;

  // Step 1: Background layer (layer 0 + COVERED layer 1)
  pipeline.compositeBackgroundOnly(ctx2d, view);

  // Step 2: Render reflection-layer sprites with water mask
  clearAndBindFramebuffer(gl, webglCanvas, view);

  const waterMask = buildWaterMaskFromView(
    view.pixelWidth,
    view.pixelHeight,
    view.cameraWorldX,
    view.cameraWorldY,
    (tileX, tileY) => {
      const meta = getReflectionMetaFromSnapshot(snapshot, tilesetRuntimes, tileX, tileY);
      return meta?.meta ? { isReflective: meta.meta.isReflective, pixelMask: meta.meta.pixelMask } : null;
    }
  );
  spriteRenderer.setWaterMask(waterMask);

  const allReflectionSprites = [...reflectionLayerSprites, ...lowPriorityReflections];
  spriteRenderer.renderBatch(allReflectionSprites, view);
  ctx2d.drawImage(webglCanvas, 0, 0);

  // Step 2.5: Render low priority sprites before topBelow
  if (normalLowPrioritySprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(normalLowPrioritySprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  // Step 3: TopBelow layer (BG1 tiles that render behind player)
  pipeline.compositeTopBelowOnly(ctx2d, view);

  // Step 3.5: Door + arrow overlays
  if (overlaySprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(overlaySprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  // Step 4: Render P1 normal sprites + player
  if (normalSprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(normalSprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }
}

function compositeStandard(
  ctx: CompositeFrameContext,
  lowPrioritySprites: SpriteInstance[],
  allSprites: SpriteInstance[],
  overlaySprites: SpriteInstance[],
  gl: WebGL2RenderingContext
): void {
  const { pipeline, spriteRenderer, ctx2d, webglCanvas, view } = ctx;

  // Background layer
  pipeline.compositeBackgroundOnly(ctx2d, view);

  // Low priority sprites before TopBelow
  if (lowPrioritySprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(lowPrioritySprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  // TopBelow layer
  pipeline.compositeTopBelowOnly(ctx2d, view);

  // Door + arrow overlays
  if (overlaySprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(overlaySprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }

  // P1 sprites + player
  if (allSprites.length > 0) {
    clearAndBindFramebuffer(gl, webglCanvas, view);
    spriteRenderer.renderBatch(allSprites, view);
    ctx2d.drawImage(webglCanvas, 0, 0);
  }
}

/**
 * Clear framebuffer, resize canvas to match view, and set viewport
 */
function clearAndBindFramebuffer(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  view: WorldCameraView
): void {
  // Ensure canvas matches the view dimensions for proper 1:1 pixel rendering
  if (canvas.width !== view.pixelWidth || canvas.height !== view.pixelHeight) {
    canvas.width = view.pixelWidth;
    canvas.height = view.pixelHeight;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, view.pixelWidth, view.pixelHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/**
 * Find insertion index for a sorted array (binary search)
 * Returns the index where an element with the given sortKey should be inserted
 * to maintain sorted order.
 */
function findSortedInsertIndex(sprites: SpriteInstance[], sortKey: number): number {
  let low = 0;
  let high = sprites.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sprites[mid].sortKey < sortKey) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}
