/**
 * WEATHER_VOLCANIC_ASH tiled ash fall effect.
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Ash_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';

const ASH_ASSETS: readonly WeatherAssetDescriptor[] = [
  {
    key: 'ash',
    path: '/pokeemerald/graphics/weather/ash.png',
    transparency: { type: 'top-left' },
  },
] as const;

export class AshEffect implements WeatherEffect {
  private ashCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

  private frameAccumulator = 0;
  private driftCounter = 0;
  private frameCounter = 0;
  private frameIndex: 0 | 1 = 0;
  private offsetY = 0;

  onEnter(): void {
    this.frameAccumulator = 0;
    this.driftCounter = 0;
    this.frameCounter = 0;
    this.frameIndex = 0;
    this.offsetY = 0;
    void this.ensureAssetsLoaded();
  }

  update(context: WeatherUpdateContext): void {
    void this.ensureAssetsLoaded();

    this.frameAccumulator += context.deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame();
    }
  }

  render(context: WeatherRenderContext): void {
    if (!this.ashCanvas) return;

    const { ctx2d, view } = context;
    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;

    const frameY = this.frameIndex * 64;
    const anchorX = -this.wrapPositive(Math.floor(view.cameraWorldX), 240);
    const anchorY =
      -this.wrapPositive(Math.floor(view.cameraWorldY), 160)
      + this.wrapPositive(this.offsetY, 64);

    ctx2d.save();
    ctx2d.globalAlpha = 0.65;

    for (let drawY = anchorY - 64; drawY < view.pixelHeight + 64; drawY += 64) {
      for (let drawX = anchorX - 64; drawX < view.pixelWidth + 64; drawX += 64) {
        ctx2d.drawImage(
          this.ashCanvas,
          0,
          frameY,
          64,
          64,
          drawX,
          drawY,
          64,
          64
        );
      }
    }

    ctx2d.restore();
    ctx2d.imageSmoothingEnabled = prevSmoothing;
  }

  private stepFrame(): void {
    // C parity: ash y offset moves down by 1 every 6 frames.
    this.driftCounter += 1;
    if (this.driftCounter > 5) {
      this.driftCounter = 0;
      this.offsetY += 1;
    }

    // C parity: two-frame ash animation, 60f each frame.
    this.frameCounter += 1;
    if (this.frameCounter >= 60) {
      this.frameCounter = 0;
      this.frameIndex = this.frameIndex === 0 ? 1 : 0;
    }
  }

  private wrapPositive(value: number, modulo: number): number {
    return ((value % modulo) + modulo) % modulo;
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.ashCanvas) return;

    if (!this.assetsPromise) {
      this.assetsPromise = loadWeatherAssets(ASH_ASSETS)
        .then((assets) => {
          this.ashCanvas = assets.get('ash') ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
