/**
 * Battle overlay frame renderer using Emerald text window frame assets.
 *
 * C reference:
 * - public/pokeemerald/src/text_window.c
 */
import { saveManager } from '../../save/SaveManager';
import { loadImageCanvasAsset } from '../../utils/assetLoader';

const FRAME_TILE_SIZE = 8;
const FRAME_STYLE_MIN = 1;
const FRAME_STYLE_MAX = 20;

/** Border thickness around the battle scene when overlay mode is active. */
export const BATTLE_OVERLAY_FRAME_BORDER_PX = FRAME_TILE_SIZE;

const frameCache = new Map<number, HTMLCanvasElement>();
const frameLoadPromises = new Map<number, Promise<HTMLCanvasElement>>();
const failedFrameStyles = new Set<number>();

function clampFrameStyle(style: number): number {
  if (!Number.isFinite(style)) return FRAME_STYLE_MIN;
  return Math.max(FRAME_STYLE_MIN, Math.min(FRAME_STYLE_MAX, Math.floor(style)));
}

function getActiveFrameStyle(): number {
  const options = saveManager.getOptions();
  return clampFrameStyle((options.windowFrame ?? 0) + 1);
}

function getFrameAssetPath(style: number): string {
  return `/pokeemerald/graphics/text_window/${style}.png`;
}

function getFallbackStyle(style: number): number | null {
  return style === FRAME_STYLE_MIN ? null : FRAME_STYLE_MIN;
}

function getCachedFrameForStyle(style: number): HTMLCanvasElement | null {
  const preferred = frameCache.get(style);
  if (preferred) return preferred;
  const fallbackStyle = getFallbackStyle(style);
  if (fallbackStyle === null) return null;
  return frameCache.get(fallbackStyle) ?? null;
}

function drawNineSliceFrame(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (width < FRAME_TILE_SIZE * 2 || height < FRAME_TILE_SIZE * 2) {
    return;
  }

  const srcTile = FRAME_TILE_SIZE;

  // Corners.
  ctx.drawImage(source, 0, 0, srcTile, srcTile, x, y, FRAME_TILE_SIZE, FRAME_TILE_SIZE);
  ctx.drawImage(
    source,
    srcTile * 2,
    0,
    srcTile,
    srcTile,
    x + width - FRAME_TILE_SIZE,
    y,
    FRAME_TILE_SIZE,
    FRAME_TILE_SIZE,
  );
  ctx.drawImage(
    source,
    0,
    srcTile * 2,
    srcTile,
    srcTile,
    x,
    y + height - FRAME_TILE_SIZE,
    FRAME_TILE_SIZE,
    FRAME_TILE_SIZE,
  );
  ctx.drawImage(
    source,
    srcTile * 2,
    srcTile * 2,
    srcTile,
    srcTile,
    x + width - FRAME_TILE_SIZE,
    y + height - FRAME_TILE_SIZE,
    FRAME_TILE_SIZE,
    FRAME_TILE_SIZE,
  );

  // Horizontal edges.
  for (let dx = FRAME_TILE_SIZE; dx < width - FRAME_TILE_SIZE; dx += FRAME_TILE_SIZE) {
    const drawWidth = Math.min(FRAME_TILE_SIZE, (width - FRAME_TILE_SIZE) - dx);
    ctx.drawImage(
      source,
      srcTile,
      0,
      srcTile,
      srcTile,
      x + dx,
      y,
      drawWidth,
      FRAME_TILE_SIZE,
    );
    ctx.drawImage(
      source,
      srcTile,
      srcTile * 2,
      srcTile,
      srcTile,
      x + dx,
      y + height - FRAME_TILE_SIZE,
      drawWidth,
      FRAME_TILE_SIZE,
    );
  }

  // Vertical edges.
  for (let dy = FRAME_TILE_SIZE; dy < height - FRAME_TILE_SIZE; dy += FRAME_TILE_SIZE) {
    const drawHeight = Math.min(FRAME_TILE_SIZE, (height - FRAME_TILE_SIZE) - dy);
    ctx.drawImage(
      source,
      0,
      srcTile,
      srcTile,
      srcTile,
      x,
      y + dy,
      FRAME_TILE_SIZE,
      drawHeight,
    );
    ctx.drawImage(
      source,
      srcTile * 2,
      srcTile,
      srcTile,
      srcTile,
      x + width - FRAME_TILE_SIZE,
      y + dy,
      FRAME_TILE_SIZE,
      drawHeight,
    );
  }
}

async function loadFrameImage(style: number): Promise<HTMLCanvasElement> {
  const cached = frameCache.get(style);
  if (cached) {
    return cached;
  }

  const existingPromise = frameLoadPromises.get(style);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = loadImageCanvasAsset(getFrameAssetPath(style), {
    transparency: { type: 'top-left' },
  }).then((canvas) => {
    frameCache.set(style, canvas);
    frameLoadPromises.delete(style);
    failedFrameStyles.delete(style);
    return canvas;
  }).catch((error) => {
    frameLoadPromises.delete(style);
    if (!failedFrameStyles.has(style)) {
      failedFrameStyles.add(style);
      console.warn(`[BattleOverlayFrame] Failed to load frame style ${style}:`, error);
    }
    throw error;
  });

  frameLoadPromises.set(style, promise);
  return promise;
}

async function loadFrameImageWithFallback(style: number): Promise<HTMLCanvasElement> {
  try {
    return await loadFrameImage(style);
  } catch (error) {
    const fallbackStyle = getFallbackStyle(style);
    if (fallbackStyle === null) {
      throw error;
    }
    return loadFrameImage(fallbackStyle);
  }
}

export function primeBattleOverlayFrameAssets(): void {
  const style = getActiveFrameStyle();
  void loadFrameImageWithFallback(style).catch(() => undefined);
}

export function drawBattleOverlayFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const style = getActiveFrameStyle();
  const frame = getCachedFrameForStyle(style);
  if (!frame) {
    if (!frameLoadPromises.has(style) && !failedFrameStyles.has(style)) {
      void loadFrameImageWithFallback(style).catch(() => undefined);
    }
    return;
  }

  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  drawNineSliceFrame(ctx, frame, x, y, width, height);
  ctx.imageSmoothingEnabled = previousSmoothing;
}
