/**
 * No-op weather effect used when visual changes are handled by the
 * weather color pipeline instead of dedicated sprite/overlay rendering.
 */

import type { WeatherEffect } from '../types';

export class NoopWeatherEffect implements WeatherEffect {
  onEnter(): void {}

  onExit(): void {}
}
