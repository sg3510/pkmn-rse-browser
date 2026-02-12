/**
 * WEATHER_ABNORMAL cycling effect (Marine/Terra cave behavior).
 *
 * C references:
 * - public/pokeemerald/src/field_weather_effect.c (Task_DoAbnormalWeather, CreateAbnormalWeatherTask)
 */

import type { WeatherEffect, WeatherRenderContext, WeatherUpdateContext } from '../types';
import { ColorTintEffect } from './ColorTintEffect';
import { RainEffect } from './RainEffect';

type AbnormalMode = 'downpour' | 'drought';

const CYCLE_FRAMES = 600;

export class AbnormalWeatherEffect implements WeatherEffect {
  private readonly downpour = new RainEffect('downpour');
  private readonly drought = new ColorTintEffect({
    color: '#ffb060',
    alpha: 0.16,
    pulseAmplitude: 0.03,
    pulseHz: 0.9,
  });

  private activeMode: AbnormalMode = 'downpour';
  private frameAccumulator = 0;
  private modeFrames = 0;

  onEnter(): void {
    this.frameAccumulator = 0;
    this.modeFrames = 0;
    this.activeMode = 'downpour';
    this.downpour.onEnter?.();
    this.drought.onExit?.();
  }

  onExit(): void {
    this.downpour.onExit?.();
    this.drought.onExit?.();
  }

  update(context: WeatherUpdateContext): void {
    this.frameAccumulator += context.deltaMs / (1000 / 60);
    while (this.frameAccumulator >= 1) {
      this.frameAccumulator -= 1;
      this.modeFrames += 1;
      if (this.modeFrames >= CYCLE_FRAMES) {
        this.modeFrames = 0;
        this.activeMode = this.activeMode === 'downpour' ? 'drought' : 'downpour';
        this.getActiveEffect().onEnter?.();
      }
    }

    this.getActiveEffect().update?.(context);
  }

  render(context: WeatherRenderContext): void {
    this.getActiveEffect().render?.(context);
  }

  private getActiveEffect(): WeatherEffect {
    return this.activeMode === 'downpour' ? this.downpour : this.drought;
  }
}
