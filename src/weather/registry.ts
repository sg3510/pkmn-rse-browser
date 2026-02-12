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
import { UnderwaterBubblesEffect } from './effects/UnderwaterBubblesEffect';

export type WeatherEffectFactory = () => WeatherEffect;

const WEATHER_EFFECT_FACTORIES: Partial<Record<WeatherName, WeatherEffectFactory>> = {
  WEATHER_UNDERWATER_BUBBLES: () => new UnderwaterBubblesEffect(),
};

const RUNTIME_WEATHER_ALIASES: Partial<Record<WeatherName, WeatherName>> = {
  WEATHER_ROUTE119_CYCLE: 'WEATHER_SUNNY',
  WEATHER_ROUTE123_CYCLE: 'WEATHER_SUNNY',
};

const WEATHER_NAME_SET = new Set(Object.keys(WEATHER_CONSTANTS) as WeatherName[]);
const COORD_EVENT_WEATHER_NAME_SET = new Set(
  Object.keys(COORD_EVENT_WEATHER_CONSTANTS) as CoordEventWeatherName[]
);

export function getWeatherEffectFactory(
  weather: WeatherName
): WeatherEffectFactory | null {
  return WEATHER_EFFECT_FACTORIES[weather] ?? null;
}

export function getRuntimeWeatherAlias(weather: WeatherName): WeatherName {
  return RUNTIME_WEATHER_ALIASES[weather] ?? weather;
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
