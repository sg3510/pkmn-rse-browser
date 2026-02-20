/**
 * WEATHER_UNDERWATER_BUBBLES visual effect.
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (FogHorizontal_* and Bubbles_*)
 */

import type { WeatherAssetDescriptor, WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';
import { loadWeatherAssets } from '../assets';
import { TiledLayerRenderer } from './primitives/TiledLayerRenderer';
import { SpriteParticleEmitter } from './primitives/SpriteParticleEmitter';

interface BubbleParticle {
  x: number;
  y: number;
  xOffset: number;
  scrollCounter: number;
  scrollDir: 0 | 1;
  ageFrames: number;
}

const BASE_WIDTH = 240;
const BASE_HEIGHT = 160;

const BUBBLE_START_DELAYS = [40, 90, 60, 90, 2, 60, 40, 30] as const;

const BUBBLE_START_COORDS = [
  [120, 160],
  [376, 160],
  [40, 140],
  [296, 140],
  [180, 130],
  [436, 130],
  [60, 160],
  [436, 160],
  [220, 180],
  [476, 180],
  [10, 90],
  [266, 90],
  [256, 160],
] as const;

const UNDERWATER_ASSETS: readonly WeatherAssetDescriptor[] = [
  {
    key: 'fog',
    path: '/pokeemerald/graphics/weather/fog_horizontal.png',
    transparency: { type: 'top-left' },
  },
  {
    key: 'bubble',
    path: '/pokeemerald/graphics/weather/bubble.png',
    transparency: { type: 'top-left' },
  },
] as const;

export class UnderwaterBubblesEffect implements WeatherEffect {
  private fogCanvas: HTMLCanvasElement | null = null;
  private bubbleCanvas: HTMLCanvasElement | null = null;
  private assetsPromise: Promise<void> | null = null;

  private readonly bubbles = new SpriteParticleEmitter<BubbleParticle>();
  private readonly fogRenderer = new TiledLayerRenderer();

  private bubbleDelayIndex = 0;
  private bubbleDelayCounter: number = BUBBLE_START_DELAYS[0];
  private bubbleCoordsIndex = 0;

  private frameAccumulator = 0;
  private fogScrollOffset = 0;
  private fogScrollCounter = 0;

  onEnter(): void {
    this.bubbles.clear();
    this.bubbleDelayIndex = 0;
    this.bubbleDelayCounter = BUBBLE_START_DELAYS[0];
    this.bubbleCoordsIndex = 0;
    this.frameAccumulator = 0;
    this.fogScrollOffset = 0;
    this.fogScrollCounter = 0;
    void this.ensureAssetsLoaded();
  }

  onExit(): void {
    this.bubbles.clear();
  }

  update(context: WeatherUpdateContext): void {
    void this.ensureAssetsLoaded();

    const frameDelta = context.deltaMs / (1000 / 60);
    this.frameAccumulator += frameDelta;

    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.stepFrame(context.view);
    }
  }

  render(context: WeatherRenderContext): void {
    const { ctx2d, view } = context;
    const blendAlpha = Math.max(0, Math.min(1, context.blendEva / 16));
    if (blendAlpha <= 0) {
      return;
    }

    if (this.fogCanvas) {
      this.fogRenderer.render(ctx2d, this.fogCanvas, view, {
        alpha: blendAlpha,
        scrollX: this.fogScrollOffset,
      });
    }

    if (this.bubbleCanvas) {
      ctx2d.save();
      ctx2d.globalAlpha = blendAlpha;
      const prevSmoothing = ctx2d.imageSmoothingEnabled;
      ctx2d.imageSmoothingEnabled = false;
      this.bubbles.forEach((bubble) => {
        const frame = Math.floor(bubble.ageFrames / 16) % 2;
        const drawX = Math.round(bubble.x + bubble.xOffset);
        const drawY = Math.round(bubble.y);

        ctx2d.drawImage(
          this.bubbleCanvas as HTMLCanvasElement,
          0,
          frame * 8,
          8,
          8,
          drawX,
          drawY,
          8,
          8
        );
      });
      ctx2d.imageSmoothingEnabled = prevSmoothing;
      ctx2d.restore();
      return;
    }

    // Fallback while bubble sheet is loading.
    ctx2d.save();
    ctx2d.globalAlpha = blendAlpha;
    ctx2d.fillStyle = 'rgb(220, 240, 255)';
    this.bubbles.forEach((bubble) => {
      const drawX = Math.round(bubble.x + bubble.xOffset);
      const drawY = Math.round(bubble.y);
      ctx2d.beginPath();
      ctx2d.arc(drawX + 4, drawY + 4, 4, 0, Math.PI * 2);
      ctx2d.fill();
    });
    ctx2d.restore();
  }

  private stepFrame(view: WeatherUpdateContext['view']): void {
    // C parity: fog horizontal scroll advances by 1 every 4 frames.
    this.fogScrollCounter += 1;
    if (this.fogScrollCounter > 3) {
      this.fogScrollCounter = 0;
      this.fogScrollOffset += 1;
    }

    this.bubbleDelayCounter += 1;
    if (this.bubbleDelayCounter > BUBBLE_START_DELAYS[this.bubbleDelayIndex]) {
      this.bubbleDelayCounter = 0;
      this.bubbleDelayIndex = (this.bubbleDelayIndex + 1) % BUBBLE_START_DELAYS.length;
      this.spawnBubble(view);
      this.bubbleCoordsIndex = (this.bubbleCoordsIndex + 1) % BUBBLE_START_COORDS.length;
    }

    this.bubbles.update((bubble) => {
      bubble.scrollCounter += 2;
      if (bubble.scrollCounter > 8) {
        bubble.scrollCounter = 0;
        if (bubble.scrollDir === 0) {
          bubble.xOffset += 1;
          if (bubble.xOffset > 4) {
            bubble.scrollDir = 1;
          }
        } else {
          bubble.xOffset -= 1;
          if (bubble.xOffset <= 0) {
            bubble.scrollDir = 0;
          }
        }
      }

      bubble.y -= 3;
      bubble.ageFrames += 1;
      return bubble.ageFrames < 120;
    });
  }

  private spawnBubble(view: WeatherUpdateContext['view']): void {
    const [rawX, rawY] = BUBBLE_START_COORDS[this.bubbleCoordsIndex];

    this.bubbles.add({
      x: (rawX % BASE_WIDTH) + Math.floor((view.pixelWidth - BASE_WIDTH) / 2),
      y: rawY + Math.floor((view.pixelHeight - BASE_HEIGHT) / 2),
      xOffset: 0,
      scrollCounter: 0,
      scrollDir: 0,
      ageFrames: 0,
    });
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.fogCanvas && this.bubbleCanvas) {
      return;
    }

    if (!this.assetsPromise) {
      this.assetsPromise = loadWeatherAssets(UNDERWATER_ASSETS)
        .then((assets) => {
          this.fogCanvas = assets.get('fog') ?? null;
          this.bubbleCanvas = assets.get('bubble') ?? null;
        })
        .finally(() => {
          this.assetsPromise = null;
        });
    }

    await this.assetsPromise;
  }
}
