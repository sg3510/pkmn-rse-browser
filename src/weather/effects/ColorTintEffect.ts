/**
 * Screen-tint weather overlays (sunny/shade/drought-like looks).
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Sunny_*, Shade_*, Drought_*)
 * - public/pokeemerald/src/field_weather.c (color-map/blend behavior)
 */

import type { WeatherEffect, WeatherRenderContext } from '../types';

interface ColorTintOptions {
  color: string;
  alpha: number;
  pulseAmplitude?: number;
  pulseHz?: number;
}

export class ColorTintEffect implements WeatherEffect {
  private readonly options: Required<ColorTintOptions>;

  constructor(options: ColorTintOptions) {
    this.options = {
      pulseAmplitude: 0,
      pulseHz: 0,
      ...options,
    };
  }

  onEnter(): void {
    // No stateful setup needed for tint overlays.
  }

  onExit(): void {
    // No teardown needed for tint overlays.
  }

  render(context: WeatherRenderContext): void {
    const { ctx2d, view, nowMs } = context;
    const baseAlpha = this.options.alpha;
    const pulseAmplitude = this.options.pulseAmplitude;

    let alpha = baseAlpha;
    if (pulseAmplitude > 0 && this.options.pulseHz > 0) {
      const t = nowMs / 1000;
      alpha += Math.sin(t * Math.PI * 2 * this.options.pulseHz) * pulseAmplitude;
    }
    alpha = Math.max(0, Math.min(1, alpha));

    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.fillStyle = this.options.color;
    ctx2d.fillRect(0, 0, view.pixelWidth, view.pixelHeight);
    ctx2d.restore();
  }
}
