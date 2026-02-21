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
import type { WaterMaskData } from './ISpriteRenderer';
import type { WorldSnapshot } from '../game/WorldManager';
import type { TilesetRuntime as TilesetRuntimeType } from '../utils/tilesetUtils';
import { buildWaterMaskFromView } from './spriteUtils';
import { getReflectionMetaFromSnapshot } from '../game/snapshotUtils';
import { incrementRuntimePerfCounter } from '../game/perf/runtimePerfRecorder';

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
  /** Optional 2D context for final compositing/fallback overlays */
  ctx2d?: CanvasRenderingContext2D | null;
  /** WebGL canvas for sprite rendering */
  webglCanvas: HTMLCanvasElement;
  /** Camera view for rendering */
  view: WorldCameraView;
  /** Current world snapshot */
  snapshot: WorldSnapshot | null;
  /** Tileset runtimes for reflection detection */
  tilesetRuntimes: Map<string, TilesetRuntimeType>;
  /** Optional weather renderer (runs below scanline/fade overlays) */
  renderWeather?: (
    ctx2d: CanvasRenderingContext2D,
    view: WorldCameraView,
    nowMs: number,
    waterMask: WaterMaskData | null,
    gl: WebGL2RenderingContext,
    webglCanvas: HTMLCanvasElement
  ) => void;
  /** Optional scripted full-screen effect renderer (runs after weather, before scanline/fade) */
  renderScriptScreenEffect?: (ctx: {
    ctx2d: CanvasRenderingContext2D;
    view: WorldCameraView;
    nowMs: number;
    gl: WebGL2RenderingContext;
    webglCanvas: HTMLCanvasElement;
  }) => void;
  /** Optional darkness/pinhole overlay renderer (runs before scanline/fade). */
  renderDarknessMask?: (ctx: {
    ctx2d: CanvasRenderingContext2D;
    view: WorldCameraView;
    nowMs: number;
  }) => void;
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

const compositeScratch = {
  spritesWithBlob: [] as SpriteInstance[],
  reflectionLayerSprites: [] as SpriteInstance[],
  normalSprites: [] as SpriteInstance[],
  lowPriorityReflections: [] as SpriteInstance[],
  normalLowPrioritySprites: [] as SpriteInstance[],
  overlaySprites: [] as SpriteInstance[],
};

const waterMaskCache: {
  key: string;
  mask: WaterMaskData | null;
} = {
  key: '',
  mask: null,
};

const waterMaskSnapshotIds = new WeakMap<WorldSnapshot, number>();
let nextWaterMaskSnapshotId = 1;

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
  const {
    pipeline,
    spriteRenderer,
    fadeRenderer,
    scanlineRenderer,
    ctx2d = null,
    webglCanvas,
    view,
    snapshot,
    tilesetRuntimes,
  } = ctx;
  const { renderWeather, renderScriptScreenEffect, renderDarknessMask } = ctx;
  const { lowPrioritySprites, allSprites, priority0Sprites, doorSprites, arrowSprite, surfBlobSprite } = sprites;
  const { fadeAlpha, scanlineIntensity = 0, zoom = 1, nowMs = performance.now() } = options;

  const gl = pipeline.getGL();

  // Add surf blob to main sprites in sorted position without mutating the original array.
  let spritesForPartition = allSprites;
  if (surfBlobSprite) {
    const spritesWithBlob = compositeScratch.spritesWithBlob;
    spritesWithBlob.length = 0;
    const insertIndex = findSortedInsertIndex(allSprites, surfBlobSprite.sortKey);
    for (let i = 0; i < insertIndex; i++) {
      spritesWithBlob.push(allSprites[i]);
    }
    spritesWithBlob.push(surfBlobSprite);
    for (let i = insertIndex; i < allSprites.length; i++) {
      spritesWithBlob.push(allSprites[i]);
    }
    spritesForPartition = spritesWithBlob;
  }

  // One-pass partition into reflection and normal sprites to avoid per-frame filter allocations.
  const reflectionLayerSprites = compositeScratch.reflectionLayerSprites;
  const normalSprites = compositeScratch.normalSprites;
  const lowPriorityReflections = compositeScratch.lowPriorityReflections;
  const normalLowPrioritySprites = compositeScratch.normalLowPrioritySprites;
  reflectionLayerSprites.length = 0;
  normalSprites.length = 0;
  lowPriorityReflections.length = 0;
  normalLowPrioritySprites.length = 0;

  for (let i = 0; i < spritesForPartition.length; i++) {
    const sprite = spritesForPartition[i];
    if (sprite.isReflection || sprite.isReflectionLayer) {
      reflectionLayerSprites.push(sprite);
    } else {
      normalSprites.push(sprite);
    }
  }
  for (let i = 0; i < lowPrioritySprites.length; i++) {
    const sprite = lowPrioritySprites[i];
    if (sprite.isReflection || sprite.isReflectionLayer) {
      lowPriorityReflections.push(sprite);
    } else {
      normalLowPrioritySprites.push(sprite);
    }
  }

  // Build overlay sprites (doors + arrow) without array spread allocation.
  const overlaySprites = compositeScratch.overlaySprites;
  overlaySprites.length = 0;
  for (let i = 0; i < doorSprites.length; i++) {
    overlaySprites.push(doorSprites[i]);
  }
  if (arrowSprite) overlaySprites.push(arrowSprite);

  // Build a viewport water mask once so both reflection rendering and weather effects
  // can share the same clipping data.
  const needsWaterMask = !!snapshot && (
    !!renderWeather
    || reflectionLayerSprites.length > 0
    || lowPriorityReflections.length > 0
  );
  const weatherWaterMask = needsWaterMask
    ? buildViewportWaterMask(view, snapshot as WorldSnapshot, tilesetRuntimes)
    : null;

  if ((reflectionLayerSprites.length > 0 || lowPriorityReflections.length > 0) && snapshot) {
    // === Split layer rendering for reflections ===
    compositeWithReflections(
      ctx,
      reflectionLayerSprites,
      lowPriorityReflections,
      normalSprites,
      normalLowPrioritySprites,
      overlaySprites,
      gl,
      weatherWaterMask
    );
  } else {
    // === Standard compositing (no reflections) ===
    compositeStandard(ctx, lowPrioritySprites, spritesForPartition, overlaySprites, gl);
  }

  // TopAbove layer (renders on both paths)
  pipeline.compositeTopAboveToScreen(view);

  // Priority 0 sprites (above all BG layers)
  if (priority0Sprites.length > 0) {
    renderSpriteBatchToScreen(spriteRenderer, priority0Sprites, gl, webglCanvas, view);
  }

  if (ctx2d) {
    // One full-scene copy from WebGL -> Canvas2D, then apply any 2D-only overlays.
    blitWebGLCanvasTo2D(ctx2d, webglCanvas, true);

    // Weather renders as a post-composite field layer, below scanline/fade overlays.
    renderWeather?.(ctx2d, view, nowMs, weatherWaterMask, gl, webglCanvas);

    // Scripted screen effects render after weather but before scanline/fade overlays.
    renderScriptScreenEffect?.({
      ctx2d,
      view,
      nowMs,
      gl,
      webglCanvas,
    });

    // Darkness mask renders after scripted/weather effects and before scanline/fade.
    renderDarknessMask?.({
      ctx2d,
      view,
      nowMs,
    });

    // Scanline overlay (CRT effect when menu is open)
    if (scanlineIntensity > 0 && scanlineRenderer) {
      bindDefaultFramebuffer(gl, webglCanvas, view, true);
      scanlineRenderer.render(scanlineIntensity, view.pixelWidth, view.pixelHeight, zoom);
      blitWebGLCanvasTo2D(ctx2d, webglCanvas, false);
    }

    // Fade overlay
    if (fadeAlpha > 0 && fadeRenderer) {
      bindDefaultFramebuffer(gl, webglCanvas, view, true);
      fadeRenderer.render(fadeAlpha);
      blitWebGLCanvasTo2D(ctx2d, webglCanvas, false);
    }
  } else {
    // Pure WebGL output path.
    if (scanlineIntensity > 0 && scanlineRenderer) {
      bindDefaultFramebuffer(gl, webglCanvas, view, false);
      scanlineRenderer.render(scanlineIntensity, view.pixelWidth, view.pixelHeight, zoom);
    }
    if (fadeAlpha > 0 && fadeRenderer) {
      bindDefaultFramebuffer(gl, webglCanvas, view, false);
      fadeRenderer.render(fadeAlpha);
    }
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
  waterMask: WaterMaskData | null
): void {
  const { pipeline, spriteRenderer, webglCanvas, view } = ctx;

  // Step 1: Background layer (layer 0 + COVERED layer 1)
  pipeline.compositeBackgroundToScreen(view);

  // Step 2: Render reflection-layer sprites with water mask
  spriteRenderer.setWaterMask(waterMask);
  renderSpriteBatchToScreen(spriteRenderer, reflectionLayerSprites, gl, webglCanvas, view);
  renderSpriteBatchToScreen(spriteRenderer, lowPriorityReflections, gl, webglCanvas, view);

  // Step 2.5: Render low priority sprites before topBelow
  renderSpriteBatchToScreen(spriteRenderer, normalLowPrioritySprites, gl, webglCanvas, view);

  // Step 3: TopBelow layer (BG1 tiles that render behind player)
  pipeline.compositeTopBelowToScreen(view);

  // Step 3.5: Door + arrow overlays
  renderSpriteBatchToScreen(spriteRenderer, overlaySprites, gl, webglCanvas, view);

  // Step 4: Render P1 normal sprites + player
  renderSpriteBatchToScreen(spriteRenderer, normalSprites, gl, webglCanvas, view);
}

function buildViewportWaterMask(
  view: WorldCameraView,
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntimeType>
): WaterMaskData {
  const cacheKey = buildWaterMaskCacheKey(view, snapshot, tilesetRuntimes);
  if (waterMaskCache.mask && waterMaskCache.key === cacheKey) {
    return waterMaskCache.mask;
  }

  incrementRuntimePerfCounter('waterMaskBuilds');
  const mask = buildWaterMaskFromView(
    view.pixelWidth,
    view.pixelHeight,
    view.cameraWorldX,
    view.cameraWorldY,
    (tileX, tileY) => {
      const meta = getReflectionMetaFromSnapshot(snapshot, tilesetRuntimes, tileX, tileY);
      return meta?.meta ? { isReflective: meta.meta.isReflective, pixelMask: meta.meta.pixelMask } : null;
    }
  );
  waterMaskCache.key = cacheKey;
  waterMaskCache.mask = mask;
  return mask;
}

function compositeStandard(
  ctx: CompositeFrameContext,
  lowPrioritySprites: SpriteInstance[],
  allSprites: SpriteInstance[],
  overlaySprites: SpriteInstance[],
  gl: WebGL2RenderingContext
): void {
  const { pipeline, spriteRenderer, webglCanvas, view } = ctx;

  // Background layer
  pipeline.compositeBackgroundToScreen(view);

  // Low priority sprites before TopBelow
  renderSpriteBatchToScreen(spriteRenderer, lowPrioritySprites, gl, webglCanvas, view);

  // TopBelow layer
  pipeline.compositeTopBelowToScreen(view);

  // Door + arrow overlays
  renderSpriteBatchToScreen(spriteRenderer, overlaySprites, gl, webglCanvas, view);

  // P1 sprites + player
  renderSpriteBatchToScreen(spriteRenderer, allSprites, gl, webglCanvas, view);
}

/**
 * Render one sprite batch directly to the default framebuffer.
 */
function renderSpriteBatchToScreen(
  spriteRenderer: WebGLSpriteRenderer,
  sprites: SpriteInstance[],
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  view: WorldCameraView
): void {
  if (sprites.length === 0) return;
  bindDefaultFramebuffer(gl, canvas, view, false);
  spriteRenderer.renderBatch(sprites, view);
}

/**
 * Bind the default framebuffer, resize canvas to match view, and set viewport.
 */
function bindDefaultFramebuffer(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  view: WorldCameraView,
  clearFirst: boolean
): void {
  // Ensure canvas matches the view dimensions for proper 1:1 pixel rendering
  if (canvas.width !== view.pixelWidth || canvas.height !== view.pixelHeight) {
    canvas.width = view.pixelWidth;
    canvas.height = view.pixelHeight;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, view.pixelWidth, view.pixelHeight);
  if (clearFirst) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

function blitWebGLCanvasTo2D(
  ctx2d: CanvasRenderingContext2D,
  webglCanvas: HTMLCanvasElement,
  clearFirst: boolean
): void {
  ctx2d.imageSmoothingEnabled = false;
  if (clearFirst) {
    ctx2d.clearRect(0, 0, ctx2d.canvas.width, ctx2d.canvas.height);
  }
  incrementRuntimePerfCounter('webglCanvasBlits');
  ctx2d.drawImage(webglCanvas, 0, 0);
}

function buildWaterMaskCacheKey(
  view: WorldCameraView,
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntimeType>
): string {
  const snapshotId = getOrCreateWaterMaskSnapshotId(snapshot);
  const tilesetVersionKey = buildTilesetRuntimeVersionKey(tilesetRuntimes);
  const cameraWorldX = Number.isFinite(view.cameraWorldX) ? view.cameraWorldX.toFixed(3) : '0';
  const cameraWorldY = Number.isFinite(view.cameraWorldY) ? view.cameraWorldY.toFixed(3) : '0';
  return `${snapshotId}:${tilesetVersionKey}:${view.pixelWidth}x${view.pixelHeight}:${cameraWorldX},${cameraWorldY}`;
}

function getOrCreateWaterMaskSnapshotId(snapshot: WorldSnapshot): number {
  let snapshotId = waterMaskSnapshotIds.get(snapshot);
  if (snapshotId === undefined) {
    snapshotId = nextWaterMaskSnapshotId++;
    waterMaskSnapshotIds.set(snapshot, snapshotId);
  }
  return snapshotId;
}

function buildTilesetRuntimeVersionKey(tilesetRuntimes: Map<string, TilesetRuntimeType>): string {
  if (tilesetRuntimes.size === 0) return 'none';
  let key = '';
  for (const [tilesetPairId, runtime] of tilesetRuntimes.entries()) {
    key += `${tilesetPairId}:${runtime.lastPatchedKey};`;
  }
  return key;
}

export const __testBuildWaterMaskCacheKey = buildWaterMaskCacheKey;
export const __testBuildTilesetRuntimeVersionKey = buildTilesetRuntimeVersionKey;

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
