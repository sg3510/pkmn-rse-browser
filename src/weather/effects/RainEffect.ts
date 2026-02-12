/**
 * Rain-family weather effects (rain / thunderstorm / downpour).
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Rain_*, Thunderstorm_*, Downpour_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';
import { SpriteParticleEmitter } from './primitives/SpriteParticleEmitter';

type RainVariant = 'rain' | 'thunderstorm' | 'downpour';

interface RainDrop {
  x: number;
  y: number;
}

interface RainVariantOptions {
  targetDrops: number;
  velX: number;
  velY: number;
  lightning: boolean;
  screenTintColor: string;
  screenTintAlpha: number;
}

const RAIN_ASSETS: readonly WeatherAssetDescriptor[] = [
  {
    key: 'rain',
    path: '/pokeemerald/graphics/weather/rain.png',
    transparency: { type: 'top-left' },
  },
] as const;

const VARIANT_OPTIONS: Record<RainVariant, RainVariantOptions> = {
  rain: {
    targetDrops: 10,
    velX: -3.5,
    velY: 8.5,
    lightning: false,
    screenTintColor: '#0f1f32',
    screenTintAlpha: 0.12,
  },
  thunderstorm: {
    targetDrops: 16,
    velX: -4,
    velY: 10,
    lightning: true,
    screenTintColor: '#0c1b2d',
    screenTintAlpha: 0.15,
  },
  downpour: {
    targetDrops: 24,
    velX: -5,
    velY: 12,
    lightning: true,
    screenTintColor: '#081629',
    screenTintAlpha: 0.18,
  },
};

export class RainEffect implements WeatherEffect {
  private rainCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

  private readonly drops = new SpriteParticleEmitter<RainDrop>();
  private readonly options: RainVariantOptions;

  private frameAccumulator = 0;

  private lightningTimerFrames = 0;
  private lightningActiveFrames = 0;

  constructor(variant: RainVariant) {
    this.options = VARIANT_OPTIONS[variant];
  }

  onEnter(): void {
    this.drops.clear();
    this.frameAccumulator = 0;
    this.lightningTimerFrames = this.randomLightningDelay();
    this.lightningActiveFrames = 0;
    void this.ensureAssetsLoaded();
  }

  onExit(): void {
    this.drops.clear();
  }

  update(context: WeatherUpdateContext): void {
    void this.ensureAssetsLoaded();

    this.ensureDropCount(context.view.pixelWidth, context.view.pixelHeight);
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

    if (this.rainCanvas) {
      this.drops.forEach((drop) => {
        ctx2d.drawImage(
          this.rainCanvas as HTMLCanvasElement,
          0,
          0,
          16,
          32,
          Math.round(drop.x),
          Math.round(drop.y),
          16,
          32
        );
      });
    } else {
      // Loading fallback.
      ctx2d.strokeStyle = 'rgba(164, 210, 255, 0.55)';
      for (const drop of this.collectDrops()) {
        ctx2d.beginPath();
        ctx2d.moveTo(Math.round(drop.x), Math.round(drop.y));
        ctx2d.lineTo(Math.round(drop.x - 3), Math.round(drop.y + 8));
        ctx2d.stroke();
      }
    }

    if (this.options.screenTintAlpha > 0) {
      ctx2d.save();
      ctx2d.globalAlpha = this.options.screenTintAlpha;
      ctx2d.fillStyle = this.options.screenTintColor;
      ctx2d.fillRect(0, 0, context.view.pixelWidth, context.view.pixelHeight);
      ctx2d.restore();
    }

    if (this.options.lightning && this.lightningActiveFrames > 0) {
      const alpha = Math.min(0.35, 0.16 + this.lightningActiveFrames * 0.05);
      ctx2d.save();
      ctx2d.globalAlpha = alpha;
      ctx2d.fillStyle = '#ffffff';
      ctx2d.fillRect(0, 0, context.view.pixelWidth, context.view.pixelHeight);
      ctx2d.restore();
    }

    ctx2d.imageSmoothingEnabled = prevSmoothing;
  }

  private collectDrops(): RainDrop[] {
    const entries: RainDrop[] = [];
    this.drops.forEach((drop) => {
      entries.push(drop);
    });
    return entries;
  }

  private ensureDropCount(viewW: number, viewH: number): void {
    const drops = this.collectDrops();
    if (drops.length >= this.options.targetDrops) return;

    for (let i = drops.length; i < this.options.targetDrops; i++) {
      this.drops.add({
        x: Math.random() * (viewW + 32),
        y: Math.random() * (viewH + 64) - 64,
      });
    }
  }

  private stepFrame(viewW: number, viewH: number): void {
    if (this.options.lightning) {
      if (this.lightningActiveFrames > 0) {
        this.lightningActiveFrames -= 1;
      } else if (this.lightningTimerFrames > 0) {
        this.lightningTimerFrames -= 1;
      } else {
        // C parity approximation: periodic short lightning cycles.
        this.lightningActiveFrames = 2 + Math.floor(Math.random() * 3);
        this.lightningTimerFrames = this.randomLightningDelay();
      }
    }

    this.drops.update((drop) => {
      drop.x += this.options.velX;
      drop.y += this.options.velY;

      if (drop.y > viewH + 24 || drop.x < -24) {
        drop.x = Math.random() * (viewW + 32);
        drop.y = -32 - Math.random() * 64;
      }
      return true;
    });
  }

  private randomLightningDelay(): number {
    // C thunderstorm cycles sit in ~360-720 frame waits.
    return 360 + Math.floor(Math.random() * 360);
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.rainCanvas) return;

    if (!this.assetsPromise) {
      this.assetsPromise = loadWeatherAssets(RAIN_ASSETS)
        .then((assets) => {
          this.rainCanvas = assets.get('rain') ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
