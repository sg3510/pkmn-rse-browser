/**
 * WEATHER_SANDSTORM effect (tiled sand + swirl particles).
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Sandstorm_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';
import { TiledLayerRenderer } from './primitives/TiledLayerRenderer';

interface SwirlParticle {
  x: number;
  y: number;
  radius: number;
  waveIndex: number;
  radiusCounter: number;
  entranceDelay: number;
}

const SAND_ASSETS: readonly WeatherAssetDescriptor[] = [
  {
    key: 'sand',
    path: '/pokeemerald/graphics/weather/sandstorm.png',
    transparency: { type: 'top-left' },
  },
] as const;

const SWIRL_ENTRANCE_DELAYS = [0, 120, 80, 160, 40] as const;

export class SandstormEffect implements WeatherEffect {
  private sandCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;
  private readonly renderer = new TiledLayerRenderer();

  private frameAccumulator = 0;
  private waveCounter = 0;
  private waveIndex = 8;
  private xOffset = 0;
  private yOffset = 0;

  private readonly swirlParticles: SwirlParticle[] = [];

  onEnter(): void {
    this.frameAccumulator = 0;
    this.waveCounter = 0;
    this.waveIndex = 8;
    this.xOffset = 0;
    this.yOffset = 0;
    this.swirlParticles.length = 0;
    void this.ensureAssetsLoaded();
  }

  update(context: WeatherUpdateContext): void {
    void this.ensureAssetsLoaded();

    if (this.swirlParticles.length === 0) {
      this.initializeSwirls(context.view.pixelWidth, context.view.pixelHeight);
    }

    this.frameAccumulator += context.deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame(context.view.pixelWidth, context.view.pixelHeight);
    }
  }

  render(context: WeatherRenderContext): void {
    const { ctx2d, view } = context;

    if (this.sandCanvas) {
      this.renderer.render(ctx2d, this.sandCanvas, view, {
        alpha: 0.5,
        scrollX: this.xOffset,
        scrollY: this.yOffset,
      });
    }

    ctx2d.save();
    ctx2d.fillStyle = 'rgba(220, 188, 120, 0.72)';
    for (const swirl of this.swirlParticles) {
      if (swirl.entranceDelay >= 0) continue;
      const angle = (swirl.waveIndex / 256) * Math.PI * 2;
      const sx = Math.round(swirl.x + Math.sin(angle) * swirl.radius);
      const sy = Math.round(swirl.y + Math.cos(angle) * swirl.radius);
      ctx2d.fillRect(sx, sy, 3, 3);
    }
    ctx2d.restore();
  }

  private initializeSwirls(viewW: number, viewH: number): void {
    this.swirlParticles.length = 0;
    for (let i = 0; i < SWIRL_ENTRANCE_DELAYS.length; i++) {
      this.swirlParticles.push({
        x: Math.floor(((i + 1) * viewW) / (SWIRL_ENTRANCE_DELAYS.length + 1)),
        y: viewH + 48,
        radius: 8,
        waveIndex: i * 51,
        radiusCounter: 0,
        entranceDelay: SWIRL_ENTRANCE_DELAYS[i],
      });
    }
  }

  private stepFrame(viewW: number, viewH: number): void {
    if (this.waveCounter++ > 4) {
      this.waveCounter = 0;
      this.waveIndex = (this.waveIndex + 1) & 0xff;
    }

    const angle = (this.waveIndex / 256) * Math.PI * 2;
    this.xOffset -= Math.sin(angle) * 1.2;
    this.yOffset -= Math.sin(angle) * 0.35;

    for (const swirl of this.swirlParticles) {
      swirl.entranceDelay -= 1;
      if (swirl.entranceDelay >= 0) continue;

      swirl.y -= 1;
      if (swirl.y < -48) {
        swirl.y = viewH + 48;
        swirl.x = 24 + Math.random() * Math.max(1, viewW - 48);
        swirl.radius = 4;
        swirl.radiusCounter = 0;
      }

      swirl.waveIndex = (swirl.waveIndex + 10) & 0xff;
      if (++swirl.radiusCounter > 8) {
        swirl.radiusCounter = 0;
        swirl.radius = Math.min(swirl.radius + 1, 12);
      }
    }
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.sandCanvas) return;

    if (!this.assetsPromise) {
      this.assetsPromise = loadWeatherAssets(SAND_ASSETS)
        .then((assets) => {
          this.sandCanvas = assets.get('sand') ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
