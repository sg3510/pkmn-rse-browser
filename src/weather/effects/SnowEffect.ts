/**
 * WEATHER_SNOW particle effect.
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Snow_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';
import { SpriteParticleEmitter } from './primitives/SpriteParticleEmitter';

interface SnowflakeParticle {
  x: number;
  y: number;
  speedY: number;
  wavePhase: number;
  waveSpeed: number;
  sprite: 0 | 1;
}

const SNOW_COUNT = 16;

const SNOW_ASSETS: readonly WeatherAssetDescriptor[] = [
  {
    key: 'snow0',
    path: '/pokeemerald/graphics/weather/snow0.png',
    transparency: { type: 'top-left' },
  },
  {
    key: 'snow1',
    path: '/pokeemerald/graphics/weather/snow1.png',
    transparency: { type: 'top-left' },
  },
] as const;

export class SnowEffect implements WeatherEffect {
  private snowCanvas0: HTMLCanvasElement | null = null;
  private snowCanvas1: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

  private readonly flakes = new SpriteParticleEmitter<SnowflakeParticle>();
  private frameAccumulator = 0;

  onEnter(): void {
    this.flakes.clear();
    this.frameAccumulator = 0;
    void this.ensureAssetsLoaded();
  }

  onExit(): void {
    this.flakes.clear();
  }

  update(context: WeatherUpdateContext): void {
    void this.ensureAssetsLoaded();

    this.ensureFlakeCount(context.view.pixelWidth, context.view.pixelHeight);
    this.frameAccumulator += context.deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame(context.view.pixelWidth, context.view.pixelHeight);
    }
  }

  render(context: WeatherRenderContext): void {
    const { ctx2d } = context;
    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;

    this.flakes.forEach((flake) => {
      const x = Math.round(flake.x + Math.sin(flake.wavePhase) * 2);
      const y = Math.round(flake.y);
      const sprite = flake.sprite === 0 ? this.snowCanvas0 : this.snowCanvas1;
      if (sprite) {
        ctx2d.drawImage(sprite, x, y);
      } else {
        ctx2d.fillStyle = 'rgba(236, 246, 255, 0.88)';
        ctx2d.fillRect(x, y, 2, 2);
      }
    });

    ctx2d.imageSmoothingEnabled = prevSmoothing;
  }

  private ensureFlakeCount(viewW: number, viewH: number): void {
    const entries: SnowflakeParticle[] = [];
    this.flakes.forEach((flake) => {
      entries.push(flake);
    });
    if (entries.length >= SNOW_COUNT) return;

    for (let i = entries.length; i < SNOW_COUNT; i++) {
      this.flakes.add(this.createFlake(viewW, viewH, true));
    }
  }

  private createFlake(
    viewW: number,
    viewH: number,
    randomY: boolean
  ): SnowflakeParticle {
    return {
      x: Math.random() * Math.max(1, viewW),
      y: randomY ? Math.random() * Math.max(1, viewH) : -8,
      speedY: 0.5 + Math.random() * 1.2,
      wavePhase: Math.random() * Math.PI * 2,
      waveSpeed: 0.035 + Math.random() * 0.03,
      sprite: Math.random() < 0.5 ? 0 : 1,
    };
  }

  private stepFrame(viewW: number, viewH: number): void {
    this.flakes.update((flake) => {
      flake.y += flake.speedY;
      flake.wavePhase += flake.waveSpeed;

      if (flake.y > viewH + 10) {
        const reset = this.createFlake(viewW, viewH, false);
        flake.x = reset.x;
        flake.y = reset.y;
        flake.speedY = reset.speedY;
        flake.wavePhase = reset.wavePhase;
        flake.waveSpeed = reset.waveSpeed;
        flake.sprite = reset.sprite;
      }
      return true;
    });
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.snowCanvas0 && this.snowCanvas1) return;

    if (!this.assetsPromise) {
      this.assetsPromise = loadWeatherAssets(SNOW_ASSETS)
        .then((assets) => {
          this.snowCanvas0 = assets.get('snow0') ?? null;
          this.snowCanvas1 = assets.get('snow1') ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
