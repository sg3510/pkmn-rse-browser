/**
 * Field text-window 9-slice skin.
 *
 * C refs:
 * - public/pokeemerald/src/text_window.c
 */
import { loadImageCanvasAsset } from '../../../utils/assetLoader';
import type { PromptWindowSkin, PromptWindowSkinDrawRequest, PromptWindowSkinPreloadOptions } from '../PromptWindowSkin';

const TILE_SIZE = 8;
const FRAME_STYLE_MIN = 1;
const FRAME_STYLE_MAX = 20;

const frameCache = new Map<number, HTMLCanvasElement>();

function clampFrameStyle(frameStyle: number): number {
  return Math.max(FRAME_STYLE_MIN, Math.min(FRAME_STYLE_MAX, Math.trunc(frameStyle)));
}

function getFramePath(frameStyle: number): string {
  return `/pokeemerald/graphics/text_window/${clampFrameStyle(frameStyle)}.png`;
}

async function loadFrame(style: number): Promise<HTMLCanvasElement> {
  const normalizedStyle = clampFrameStyle(style);
  const cached = frameCache.get(normalizedStyle);
  if (cached) {
    return cached;
  }

  const frame = await loadImageCanvasAsset(getFramePath(normalizedStyle), {
    transparency: { type: 'top-left' },
  });
  frameCache.set(normalizedStyle, frame);
  return frame;
}

function drawFallbackWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#1f1f1f';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x + 1, y + 1, Math.max(0, width - 2), Math.max(0, height - 2));
}

function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): void {
  const srcTile = TILE_SIZE;
  const dstTile = TILE_SIZE * scale;
  const rightX = x + width - dstTile;
  const bottomY = y + height - dstTile;

  ctx.drawImage(frame, 0, 0, srcTile, srcTile, x, y, dstTile, dstTile);
  ctx.drawImage(frame, srcTile * 2, 0, srcTile, srcTile, rightX, y, dstTile, dstTile);
  ctx.drawImage(frame, 0, srcTile * 2, srcTile, srcTile, x, bottomY, dstTile, dstTile);
  ctx.drawImage(frame, srcTile * 2, srcTile * 2, srcTile, srcTile, rightX, bottomY, dstTile, dstTile);

  for (let drawX = x + dstTile; drawX < rightX; drawX += dstTile) {
    const drawWidth = Math.min(dstTile, rightX - drawX);
    ctx.drawImage(frame, srcTile, 0, srcTile, srcTile, drawX, y, drawWidth, dstTile);
    ctx.drawImage(frame, srcTile, srcTile * 2, srcTile, srcTile, drawX, bottomY, drawWidth, dstTile);
  }

  for (let drawY = y + dstTile; drawY < bottomY; drawY += dstTile) {
    const drawHeight = Math.min(dstTile, bottomY - drawY);
    ctx.drawImage(frame, 0, srcTile, srcTile, srcTile, x, drawY, dstTile, drawHeight);
    ctx.drawImage(frame, srcTile * 2, srcTile, srcTile, srcTile, rightX, drawY, dstTile, drawHeight);
  }

  for (let drawY = y + dstTile; drawY < bottomY; drawY += dstTile) {
    for (let drawX = x + dstTile; drawX < rightX; drawX += dstTile) {
      const drawWidth = Math.min(dstTile, rightX - drawX);
      const drawHeight = Math.min(dstTile, bottomY - drawY);
      ctx.drawImage(frame, srcTile, srcTile, srcTile, srcTile, drawX, drawY, drawWidth, drawHeight);
    }
  }
}

export class FieldTextWindowSkin implements PromptWindowSkin {
  readonly id = 'FieldTextWindowSkin';
  private frameStyle: number;

  constructor(frameStyle: number = FRAME_STYLE_MIN) {
    this.frameStyle = clampFrameStyle(frameStyle);
  }

  setFrameStyle(frameStyle: number): void {
    this.frameStyle = clampFrameStyle(frameStyle);
  }

  async preload(options?: PromptWindowSkinPreloadOptions): Promise<void> {
    const style = clampFrameStyle(options?.frameStyle ?? this.frameStyle);
    await loadFrame(style);
  }

  draw(ctx: CanvasRenderingContext2D, request: PromptWindowSkinDrawRequest): void {
    const style = clampFrameStyle(request.frameStyle ?? this.frameStyle);
    const frame = frameCache.get(style) ?? null;
    const x = request.originX + (request.profile.window.x * request.scale);
    const y = request.originY + (request.profile.window.y * request.scale);
    const width = request.profile.window.width * request.scale;
    const height = request.profile.window.height * request.scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (!frame) {
      drawFallbackWindow(ctx, x, y, width, height);
      ctx.restore();
      return;
    }

    drawNineSlice(ctx, frame, x, y, width, height, request.scale);
    ctx.restore();
  }
}
