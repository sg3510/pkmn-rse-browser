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
  x: number;
  y: number;
}

export class CloudLayerEffect implements WeatherEffect {
  private cloudCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

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
      this.initializeClouds(context.view.pixelWidth, context.view.pixelHeight);
    }

    this.frameAccumulator += context.deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame(context.view.pixelWidth);
    }
  }

  render(context: WeatherRenderContext): void {
    if (!this.cloudCanvas || this.clouds.length === 0) return;

    const { ctx2d } = context;
    ctx2d.save();
    ctx2d.globalAlpha = 0.34;
    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;

    for (const cloud of this.clouds) {
      ctx2d.drawImage(this.cloudCanvas, Math.round(cloud.x), Math.round(cloud.y));
    }

    ctx2d.imageSmoothingEnabled = prevSmoothing;
    ctx2d.restore();
  }

  private initializeClouds(viewW: number, viewH: number): void {
    if (this.clouds.length > 0) return;
    const safeW = Math.max(1, viewW);
    const safeH = Math.max(1, viewH);
    const yTop = Math.max(4, Math.floor(safeH * 0.2));
    const yMid = Math.max(yTop + 6, Math.floor(safeH * 0.35));
    const yLow = Math.max(yMid + 6, Math.floor(safeH * 0.48));

    this.clouds.push(
      { x: Math.floor(safeW * 0.08), y: yTop },
      { x: Math.floor(safeW * 0.42), y: yMid },
      { x: Math.floor(safeW * 0.76), y: yLow }
    );
  }

  private stepFrame(viewW: number): void {
    // C parity: move 1px every 2 frames.
    this.moveCounter = (this.moveCounter + 1) & 1;
    if (this.moveCounter === 0) {
      return;
    }

    const wrapThreshold = -64;
    for (const cloud of this.clouds) {
      cloud.x -= 1;
      if (cloud.x < wrapThreshold) {
        cloud.x = viewW + 64;
      }
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
