/**
 * Fog weather effect (horizontal/diagonal variants).
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (FogHorizontal_* / FogDiagonal_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherUpdateContext, WeatherRenderContext } from '../types';
import { TiledLayerRenderer } from './primitives/TiledLayerRenderer';

interface FogLayerOptions {
  assetPath: string;
  scrollXStepFrames: number;
  scrollYStepFrames?: number;
  scrollXDirection?: 1 | -1;
  scrollYDirection?: 1 | -1;
}

const FOG_ASSET_KEY = 'fog';

export class FogLayerEffect implements WeatherEffect {
  private fogCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

  private readonly renderer = new TiledLayerRenderer();
  private readonly options: Required<FogLayerOptions>;

  private frameAccumulator = 0;
  private scrollX = 0;
  private scrollY = 0;
  private scrollXCounter = 0;
  private scrollYCounter = 0;

  constructor(options: FogLayerOptions) {
    this.options = {
      scrollXDirection: 1,
      scrollYDirection: 1,
      ...options,
      scrollXStepFrames: Math.max(1, options.scrollXStepFrames),
      scrollYStepFrames: Math.max(0, options.scrollYStepFrames ?? 0),
    };
  }

  onEnter(): void {
    this.frameAccumulator = 0;
    this.scrollX = 0;
    this.scrollY = 0;
    this.scrollXCounter = 0;
    this.scrollYCounter = 0;
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
    if (!this.fogCanvas) return;
    const blendAlpha = Math.max(0, Math.min(1, context.blendEva / 16));
    if (blendAlpha <= 0) return;

    this.renderer.render(context.ctx2d, this.fogCanvas, context.view, {
      alpha: blendAlpha,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
    });
  }

  private stepFrame(): void {
    if (++this.scrollXCounter >= this.options.scrollXStepFrames) {
      this.scrollXCounter = 0;
      this.scrollX += this.options.scrollXDirection;
    }

    if (
      this.options.scrollYStepFrames > 0
      && ++this.scrollYCounter >= this.options.scrollYStepFrames
    ) {
      this.scrollYCounter = 0;
      this.scrollY += this.options.scrollYDirection;
    }
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.fogCanvas) return;

    if (!this.assetsPromise) {
      const descriptors: readonly WeatherAssetDescriptor[] = [
        {
          key: FOG_ASSET_KEY,
          path: this.options.assetPath,
          transparency: { type: 'top-left' },
        },
      ] as const;

      this.assetsPromise = loadWeatherAssets(descriptors)
        .then((assets) => {
          this.fogCanvas = assets.get(FOG_ASSET_KEY) ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
