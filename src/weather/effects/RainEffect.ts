/**
 * Rain-family weather effects (rain / thunderstorm / downpour).
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Rain_*, Thunderstorm_*, Downpour_*)
 */

import { loadWeatherAssets } from '../assets';
import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';
import type { WeatherColorCommand } from '../types';
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
}

type LightningPhase =
  | 'idleWait'
  | 'shortFlash'
  | 'shortGap'
  | 'longPrep'
  | 'longFlash'
  | 'longFade';

const LONG_BOLT_FADE_FRAMES = 80;

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
  },
  thunderstorm: {
    targetDrops: 16,
    velX: -4,
    velY: 10,
    lightning: true,
  },
  downpour: {
    targetDrops: 24,
    velX: -5,
    velY: 12,
    lightning: true,
  },
};

const EMPTY_COLOR_COMMANDS: readonly WeatherColorCommand[] = [];

export class RainEffect implements WeatherEffect {
  private rainCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

  private readonly drops = new SpriteParticleEmitter<RainDrop>();
  private readonly options: RainVariantOptions;

  private frameAccumulator = 0;

  private lightningPhase: LightningPhase = 'idleWait';
  private lightningTimerFrames = 0;
  private lightningShortBoltsRemaining = 0;
  private lightningHasLongBolt = false;
  private colorCommandQueue: WeatherColorCommand[] = [];

  constructor(variant: RainVariant) {
    this.options = VARIANT_OPTIONS[variant];
  }

  onEnter(): void {
    this.drops.clear();
    this.frameAccumulator = 0;
    if (this.options.lightning) {
      this.startImmediateCycle();
    } else {
      this.lightningPhase = 'idleWait';
      this.lightningTimerFrames = 0;
      this.lightningShortBoltsRemaining = 0;
      this.lightningHasLongBolt = false;
    }
    this.colorCommandQueue = [];
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

    ctx2d.imageSmoothingEnabled = prevSmoothing;
  }

  consumeColorCommands(): readonly WeatherColorCommand[] {
    if (this.colorCommandQueue.length === 0) {
      return EMPTY_COLOR_COMMANDS;
    }

    const commands = this.colorCommandQueue;
    this.colorCommandQueue = [];
    return commands;
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
    this.stepLightningFrame();

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

  private stepLightningFrame(): void {
    if (!this.options.lightning) {
      return;
    }

    switch (this.lightningPhase) {
    case 'idleWait':
      if (this.tickLightningTimer()) {
        this.lightningHasLongBolt = Math.random() < 0.5;
        this.lightningShortBoltsRemaining = this.randomFrameRange(1, 2);
        this.startShortBolt();
      }
      break;
    case 'shortFlash':
      if (this.tickLightningTimer()) {
        this.enqueueColorCommand({ kind: 'applyColorMapIfIdle', colorMapIndex: 3 });
        if (--this.lightningShortBoltsRemaining > 0) {
          this.lightningTimerFrames = this.randomFrameRange(60, 75);
          this.lightningPhase = 'shortGap';
        } else if (this.lightningHasLongBolt) {
          this.lightningTimerFrames = this.randomFrameRange(60, 75);
          this.lightningPhase = 'longPrep';
        } else {
          this.startCycleWait();
        }
      }
      break;
    case 'shortGap':
      if (this.tickLightningTimer()) {
        this.startShortBolt();
      }
      break;
    case 'longPrep':
      if (this.tickLightningTimer()) {
        this.enqueueColorCommand({ kind: 'applyColorMapIfIdle', colorMapIndex: 19 });
        this.lightningTimerFrames = this.randomFrameRange(30, 45);
        this.lightningPhase = 'longFlash';
      }
      break;
    case 'longFlash':
      if (this.tickLightningTimer()) {
        this.enqueueColorCommand({
          kind: 'applyColorMapIfIdleGradual',
          colorMapIndex: 19,
          targetColorMapIndex: 3,
          colorMapStepDelay: 5,
        });
        this.lightningTimerFrames = LONG_BOLT_FADE_FRAMES;
        this.lightningPhase = 'longFade';
      }
      break;
    case 'longFade':
      this.lightningTimerFrames -= 1;
      if (this.lightningTimerFrames <= 0) {
        this.startCycleWait();
      }
      break;
    }
  }

  private startShortBolt(): void {
    this.enqueueColorCommand({ kind: 'applyColorMapIfIdle', colorMapIndex: 19 });
    this.lightningTimerFrames = this.randomFrameRange(6, 8);
    this.lightningPhase = 'shortFlash';
  }

  private startImmediateCycle(): void {
    this.lightningHasLongBolt = Math.random() < 0.5;
    this.lightningShortBoltsRemaining = this.randomFrameRange(1, 2);
    this.startShortBolt();
  }

  private startCycleWait(): void {
    this.lightningPhase = 'idleWait';
    this.lightningTimerFrames = this.randomFrameRange(360, 719);
    this.lightningShortBoltsRemaining = 0;
    this.lightningHasLongBolt = false;
  }

  private tickLightningTimer(): boolean {
    if (this.lightningTimerFrames > 0) {
      this.lightningTimerFrames -= 1;
    }
    return this.lightningTimerFrames <= 0;
  }

  private randomFrameRange(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private enqueueColorCommand(command: WeatherColorCommand): void {
    this.colorCommandQueue.push(command);
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
