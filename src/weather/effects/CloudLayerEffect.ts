/**
 * WEATHER_SUNNY_CLOUDS cloud drift effect.
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Clouds_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';

const CLOUD_ASSETS: readonly WeatherAssetDescriptor[] = [
  {
    key: 'cloud',
    path: '/pokeemerald/graphics/weather/cloud.png',
    transparency: { type: 'top-left' },
  },
] as const;

interface CloudSprite {
  worldX: number;
  worldY: number;
}

const CLOUD_MAP_OFFSET = 7;
const CLOUD_WRAP_SPAN_PX = 512;
const CLOUD_BLEND_ALPHA_GAIN = 1.35;
const CLOUD_SPRITE_MAP_COORDS = [
  { x: 0, y: 66 },
  { x: 5, y: 73 },
  { x: 10, y: 78 },
] as const;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export class CloudLayerEffect implements WeatherEffect {
  private cloudCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;
  private cloudLayerCanvas: HTMLCanvasElement | null = null;
  private cloudLayerCtx: CanvasRenderingContext2D | null = null;
  private waterMaskCanvas: HTMLCanvasElement | null = null;
  private waterMaskCtx: CanvasRenderingContext2D | null = null;
  private waterMaskImageData: ImageData | null = null;

  private readonly clouds: CloudSprite[] = [];

  private frameAccumulator = 0;
  private moveCounter = 0;

  onEnter(): void {
    this.clouds.length = 0;
    this.frameAccumulator = 0;
    this.moveCounter = 0;
    void this.ensureAssetsLoaded();
  }

  update(context: WeatherUpdateContext): void {
    void this.ensureAssetsLoaded();

    if (this.clouds.length === 0) {
      this.initializeClouds(context);
    }

    this.frameAccumulator += context.deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame(context.view);
    }
  }

  render(context: WeatherRenderContext): void {
    if (!this.cloudCanvas || this.clouds.length === 0) return;
    const eva = clamp(Math.round(clamp(context.blendEva, 0, 16) * CLOUD_BLEND_ALPHA_GAIN), 0, 16);
    if (eva <= 0) {
      return;
    }

    const layerReady = this.prepareCloudLayer(context);
    if (!layerReady) {
      this.renderSourceOverFallback(context);
      return;
    }

    this.blendCloudLayerIntoTarget(context);
  }

  private prepareCloudLayer(context: WeatherRenderContext): boolean {
    const { ctx2d, view, waterMask } = context;
    if (!this.cloudCanvas) return false;

    const viewW = Math.max(0, Math.trunc(ctx2d.canvas.width || view.pixelWidth));
    const viewH = Math.max(0, Math.trunc(ctx2d.canvas.height || view.pixelHeight));
    if (viewW <= 0 || viewH <= 0) {
      return false;
    }

    if (!this.ensureMaskSurfaces(viewW, viewH)) {
      return false;
    }

    const cloudLayerCtx = this.cloudLayerCtx;
    const cloudLayerCanvas = this.cloudLayerCanvas;
    if (!cloudLayerCtx || !cloudLayerCanvas) {
      return false;
    }

    const prevLayerSmoothing = cloudLayerCtx.imageSmoothingEnabled;
    cloudLayerCtx.imageSmoothingEnabled = false;
    cloudLayerCtx.clearRect(0, 0, viewW, viewH);
    this.drawCloudSprites(cloudLayerCtx, view);

    const hasWaterMask =
      waterMask != null
      && waterMask.width === viewW
      && waterMask.height === viewH
      && this.updateWaterMaskCanvas(waterMask);
    if (hasWaterMask) {
      const waterMaskCanvas = this.waterMaskCanvas;
      if (!waterMaskCanvas) {
        return false;
      }
      cloudLayerCtx.save();
      cloudLayerCtx.globalCompositeOperation = 'destination-in';
      cloudLayerCtx.drawImage(waterMaskCanvas, 0, 0);
      cloudLayerCtx.restore();
    }

    cloudLayerCtx.imageSmoothingEnabled = prevLayerSmoothing;
    return true;
  }

  private blendCloudLayerIntoTarget(context: WeatherRenderContext): void {
    const { ctx2d, blendEva, blendEvb } = context;
    const cloudLayerCtx = this.cloudLayerCtx;
    const cloudLayerCanvas = this.cloudLayerCanvas;
    if (!cloudLayerCtx || !cloudLayerCanvas) {
      return;
    }

    const width = cloudLayerCanvas.width;
    const height = cloudLayerCanvas.height;
    if (width <= 0 || height <= 0) {
      return;
    }

    const transitionAlpha = clamp(ctx2d.globalAlpha, 0, 1);
    if (transitionAlpha <= 0) {
      return;
    }

    const eva = clamp(
      Math.round(clamp(Math.trunc(blendEva), 0, 16) * CLOUD_BLEND_ALPHA_GAIN),
      0,
      16
    );
    const evb = clamp(Math.trunc(blendEvb), 0, 16);
    if (eva <= 0) {
      return;
    }

    const dstImage = ctx2d.getImageData(0, 0, width, height);
    const srcImage = cloudLayerCtx.getImageData(0, 0, width, height);
    const dst = dstImage.data;
    const src = srcImage.data;

    for (let i = 0; i < src.length; i += 4) {
      const srcAlpha = src[i + 3];
      if (srcAlpha === 0) continue;

      const coverage = srcAlpha / 255;
      const dstR = dst[i];
      const dstG = dst[i + 1];
      const dstB = dst[i + 2];

      const blendR = Math.min(255, ((src[i] * eva + dstR * evb + 8) >> 4));
      const blendG = Math.min(255, ((src[i + 1] * eva + dstG * evb + 8) >> 4));
      const blendB = Math.min(255, ((src[i + 2] * eva + dstB * evb + 8) >> 4));

      const coveredR = dstR + (blendR - dstR) * coverage;
      const coveredG = dstG + (blendG - dstG) * coverage;
      const coveredB = dstB + (blendB - dstB) * coverage;

      dst[i] = Math.round(dstR + (coveredR - dstR) * transitionAlpha);
      dst[i + 1] = Math.round(dstG + (coveredG - dstG) * transitionAlpha);
      dst[i + 2] = Math.round(dstB + (coveredB - dstB) * transitionAlpha);
    }

    ctx2d.putImageData(dstImage, 0, 0);
  }

  private renderSourceOverFallback(context: WeatherRenderContext): void {
    const { ctx2d } = context;
    const blendAlpha = clamp((context.blendEva / 16) * CLOUD_BLEND_ALPHA_GAIN, 0, 1);
    if (blendAlpha <= 0) {
      return;
    }

    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.save();
    ctx2d.globalAlpha *= blendAlpha;
    this.drawCloudSprites(ctx2d, context.view);
    ctx2d.restore();
    ctx2d.imageSmoothingEnabled = prevSmoothing;
  }

  private ensureMaskSurfaces(width: number, height: number): boolean {
    if (!this.cloudLayerCanvas) {
      this.cloudLayerCanvas = document.createElement('canvas');
      this.cloudLayerCtx = this.cloudLayerCanvas.getContext('2d');
    }
    if (!this.waterMaskCanvas) {
      this.waterMaskCanvas = document.createElement('canvas');
      this.waterMaskCtx = this.waterMaskCanvas.getContext('2d');
    }

    if (!this.cloudLayerCanvas || !this.cloudLayerCtx || !this.waterMaskCanvas || !this.waterMaskCtx) {
      return false;
    }

    if (this.cloudLayerCanvas.width !== width || this.cloudLayerCanvas.height !== height) {
      this.cloudLayerCanvas.width = width;
      this.cloudLayerCanvas.height = height;
    }
    if (this.waterMaskCanvas.width !== width || this.waterMaskCanvas.height !== height) {
      this.waterMaskCanvas.width = width;
      this.waterMaskCanvas.height = height;
      this.waterMaskImageData = null;
    }

    return true;
  }

  private updateWaterMaskCanvas(waterMask: WeatherRenderContext['waterMask']): boolean {
    const maskCtx = this.waterMaskCtx;
    if (!maskCtx || !waterMask) {
      return false;
    }

    const width = waterMask.width;
    const height = waterMask.height;
    if (!this.waterMaskImageData || this.waterMaskImageData.width !== width || this.waterMaskImageData.height !== height) {
      this.waterMaskImageData = maskCtx.createImageData(width, height);
    }

    const rgba = this.waterMaskImageData.data;
    const source = waterMask.data;
    for (let y = 0; y < height; y++) {
      const sourceRow = (height - 1 - y) * width;
      const destRow = y * width * 4;
      for (let x = 0; x < width; x++) {
        const alpha = source[sourceRow + x];
        const dest = destRow + x * 4;
        rgba[dest] = 255;
        rgba[dest + 1] = 255;
        rgba[dest + 2] = 255;
        rgba[dest + 3] = alpha;
      }
    }

    maskCtx.putImageData(this.waterMaskImageData, 0, 0);
    return true;
  }

  private initializeClouds(context: WeatherUpdateContext): void {
    if (this.clouds.length > 0) return;

    const { mapOffsetX, mapOffsetY, view } = context;
    if (mapOffsetX != null && mapOffsetY != null) {
      for (const coord of CLOUD_SPRITE_MAP_COORDS) {
        this.clouds.push({
          worldX: (mapOffsetX + coord.x + CLOUD_MAP_OFFSET) * 16,
          worldY: (mapOffsetY + coord.y + CLOUD_MAP_OFFSET) * 16,
        });
      }
      return;
    }

    // Fallback when map offsets are unavailable.
    const safeW = Math.max(1, view.pixelWidth);
    const safeH = Math.max(1, view.pixelHeight);
    const yTop = Math.max(4, Math.floor(safeH * 0.2));
    const yMid = Math.max(yTop + 6, Math.floor(safeH * 0.35));
    const yLow = Math.max(yMid + 6, Math.floor(safeH * 0.48));
    const worldLeft = Math.floor(view.cameraWorldX);
    const worldTop = Math.floor(view.cameraWorldY);

    this.clouds.push(
      { worldX: worldLeft + Math.floor(safeW * 0.08), worldY: worldTop + yTop },
      { worldX: worldLeft + Math.floor(safeW * 0.42), worldY: worldTop + yMid },
      { worldX: worldLeft + Math.floor(safeW * 0.76), worldY: worldTop + yLow }
    );
  }

  private stepFrame(view: WeatherUpdateContext['view']): void {
    // C parity: move 1px every 2 frames.
    this.moveCounter = (this.moveCounter + 1) & 1;
    if (this.moveCounter === 0) {
      return;
    }

    for (const cloud of this.clouds) {
      cloud.worldX -= 1;
      const screenX = cloud.worldX - view.cameraWorldX;
      if (screenX < -64) {
        cloud.worldX += CLOUD_WRAP_SPAN_PX;
      } else if (screenX > view.pixelWidth + 64) {
        cloud.worldX -= CLOUD_WRAP_SPAN_PX;
      }
    }
  }

  private drawCloudSprites(
    targetCtx: CanvasRenderingContext2D,
    view: WeatherRenderContext['view']
  ): void {
    if (!this.cloudCanvas) return;
    for (const cloud of this.clouds) {
      const drawX = Math.round(cloud.worldX - view.cameraWorldX);
      const drawY = Math.round(cloud.worldY - view.cameraWorldY);
      targetCtx.drawImage(this.cloudCanvas, drawX, drawY);
    }
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.cloudCanvas) return;

    if (!this.assetsPromise) {
      this.assetsPromise = loadWeatherAssets(CLOUD_ASSETS)
        .then((assets) => {
          this.cloudCanvas = assets.get('cloud') ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
