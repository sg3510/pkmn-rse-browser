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
const CLOUD_SPRITE_MAP_COORDS = [
  { x: 0, y: 66 },
  { x: 5, y: 73 },
  { x: 10, y: 78 },
] as const;

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
    const blendAlpha = Math.max(0, Math.min(1, context.blendEva / 16));
    if (blendAlpha <= 0) {
      return;
    }

    if (this.renderMaskedClouds(context, blendAlpha)) {
      return;
    }

    const { ctx2d } = context;
    ctx2d.save();
    ctx2d.globalAlpha = blendAlpha;
    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;

    this.drawCloudSprites(ctx2d, context.view);

    ctx2d.imageSmoothingEnabled = prevSmoothing;
    ctx2d.restore();
  }

  private renderMaskedClouds(context: WeatherRenderContext, blendAlpha: number): boolean {
    const { ctx2d, view, waterMask } = context;
    if (!waterMask || !this.cloudCanvas) {
      return false;
    }

    const viewW = view.pixelWidth;
    const viewH = view.pixelHeight;
    if (viewW <= 0 || viewH <= 0) {
      return false;
    }
    if (waterMask.width !== viewW || waterMask.height !== viewH) {
      return false;
    }

    if (!this.ensureMaskSurfaces(viewW, viewH)) {
      return false;
    }
    if (!this.updateWaterMaskCanvas(waterMask)) {
      return false;
    }

    const cloudLayerCtx = this.cloudLayerCtx;
    const cloudLayerCanvas = this.cloudLayerCanvas;
    const waterMaskCanvas = this.waterMaskCanvas;
    if (!cloudLayerCtx || !cloudLayerCanvas || !waterMaskCanvas) {
      return false;
    }

    const prevLayerSmoothing = cloudLayerCtx.imageSmoothingEnabled;
    cloudLayerCtx.imageSmoothingEnabled = false;
    cloudLayerCtx.clearRect(0, 0, viewW, viewH);

    cloudLayerCtx.save();
    cloudLayerCtx.globalAlpha = blendAlpha;
    this.drawCloudSprites(cloudLayerCtx, view);
    cloudLayerCtx.restore();

    cloudLayerCtx.save();
    cloudLayerCtx.globalCompositeOperation = 'destination-in';
    cloudLayerCtx.drawImage(waterMaskCanvas, 0, 0);
    cloudLayerCtx.restore();
    cloudLayerCtx.imageSmoothingEnabled = prevLayerSmoothing;

    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(cloudLayerCanvas, 0, 0);
    ctx2d.imageSmoothingEnabled = prevSmoothing;
    return true;
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
