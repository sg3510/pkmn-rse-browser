import {
  WEATHER_CONSTANTS,
  WEATHER_ID_TO_NAME,
  COORD_EVENT_WEATHER_CONSTANTS,
  COORD_EVENT_WEATHER_ID_TO_NAME,
  COORD_EVENT_WEATHER_TO_WEATHER,
  type WeatherName,
  type CoordEventWeatherName,
} from '../data/weather.gen';
import type { WeatherEffect } from './types';
import {
  WEATHER_EFFECT_KEYS_BY_WEATHER,
  WEATHER_CYCLES_BY_WEATHER,
  RUNTIME_WEATHER_ALIASES,
  type RuntimeWeatherEffectKey,
} from './runtime.gen';
import { AbnormalWeatherEffect } from './effects/AbnormalWeatherEffect';
import { AshEffect } from './effects/AshEffect';
import { CloudLayerEffect } from './effects/CloudLayerEffect';
import { FogLayerEffect } from './effects/FogLayerEffect';
import { NoopWeatherEffect } from './effects/NoopWeatherEffect';
import { RainEffect } from './effects/RainEffect';
import { SandstormEffect } from './effects/SandstormEffect';
import { SnowEffect } from './effects/SnowEffect';
import { UnderwaterBubblesEffect } from './effects/UnderwaterBubblesEffect';

export type WeatherEffectFactory = () => WeatherEffect;

const WEATHER_EFFECT_FACTORIES_BY_KEY: Partial<
  Record<RuntimeWeatherEffectKey, WeatherEffectFactory>
> = {
  abnormal: () => new AbnormalWeatherEffect(),
  clouds: () => new CloudLayerEffect(),
  downpour: () => new RainEffect('downpour'),
  drought: () => new NoopWeatherEffect(),
  fog_diagonal: () =>
    new FogLayerEffect({
      assetPath: '/pokeemerald/graphics/weather/fog_diagonal.png',
      scrollXStepFrames: 3,
      scrollYStepFrames: 5,
      scrollXDirection: 1,
      scrollYDirection: 1,
    }),
  fog_horizontal: () =>
    new FogLayerEffect({
      assetPath: '/pokeemerald/graphics/weather/fog_horizontal.png',
      scrollXStepFrames: 4,
      scrollXDirection: 1,
    }),
  rain: () => new RainEffect('rain'),
  sandstorm: () => new SandstormEffect(),
  shade: () => new NoopWeatherEffect(),
  snow: () => new SnowEffect(),
  sunny: () => new NoopWeatherEffect(),
  thunderstorm: () => new RainEffect('thunderstorm'),
  underwater_bubbles: () => new UnderwaterBubblesEffect(),
  volcanic_ash: () => new AshEffect(),
};

const WEATHER_NAME_SET = new Set(Object.keys(WEATHER_CONSTANTS) as WeatherName[]);
const COORD_EVENT_WEATHER_NAME_SET = new Set(
  Object.keys(COORD_EVENT_WEATHER_CONSTANTS) as CoordEventWeatherName[]
);

export function getWeatherEffectFactory(
  weather: WeatherName
): WeatherEffectFactory | null {
  const effectKey = WEATHER_EFFECT_KEYS_BY_WEATHER[weather];
  if (!effectKey) return null;
  return WEATHER_EFFECT_FACTORIES_BY_KEY[effectKey] ?? null;
}

export function resolveRuntimeWeather(
  weather: WeatherName,
  weatherCycleStage: number = 0
): WeatherName {
  let resolvedWeather: WeatherName = weather;
  const cycle = WEATHER_CYCLES_BY_WEATHER[weather];
  if (cycle && cycle.length > 0) {
    const normalizedStage = Number.isFinite(weatherCycleStage)
      ? Math.floor(weatherCycleStage)
      : 0;
    const cycleIndex = ((normalizedStage % cycle.length) + cycle.length) % cycle.length;
    const cycleWeather = resolveWeatherName(cycle[cycleIndex]);
    if (cycleWeather) {
      resolvedWeather = cycleWeather;
    }
  }

  return RUNTIME_WEATHER_ALIASES[resolvedWeather] ?? resolvedWeather;
}

export function resolveWeatherName(value: string | number): WeatherName | null {
  if (typeof value === 'number') {
    return WEATHER_ID_TO_NAME[value] ?? null;
  }

  if (WEATHER_NAME_SET.has(value as WeatherName)) {
    return value as WeatherName;
  }

  return null;
}

export function resolveCoordEventWeatherToWeatherName(
  value: string | number
): WeatherName | null {
  let coordName: CoordEventWeatherName | null = null;

  if (typeof value === 'number') {
    coordName = COORD_EVENT_WEATHER_ID_TO_NAME[value] ?? null;
  } else if (COORD_EVENT_WEATHER_NAME_SET.has(value as CoordEventWeatherName)) {
    coordName = value as CoordEventWeatherName;
  }

  if (!coordName) {
    return null;
  }

  return COORD_EVENT_WEATHER_TO_WEATHER[coordName] ?? null;
}

export const WEATHER_NONE_NAME: WeatherName = 'WEATHER_NONE';
