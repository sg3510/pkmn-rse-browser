import { isOutdoorsMapType } from '../../game/mapTypeUtils';

interface WeatherSpecialServices {
  setSavedWeather?: (weather: string | number) => void;
}

interface WeatherSpecialContext {
  weather?: WeatherSpecialServices;
  lastUsedWarpMapType?: string | null;
}

const ROUTE_WEATHER_SPECIALS = {
  SetRoute119Weather: 'WEATHER_ROUTE119_CYCLE',
  SetRoute123Weather: 'WEATHER_ROUTE123_CYCLE',
} as const;

type RouteWeatherSpecialName = keyof typeof ROUTE_WEATHER_SPECIALS;

/**
 * Dispatch weather-related script specials.
 *
 * Returns true when a special name is recognized (even if it no-ops by condition),
 * false when the caller should continue with other special handlers.
 */
export function executeWeatherSpecial(
  name: string,
  context: WeatherSpecialContext
): boolean {
  if (!(name in ROUTE_WEATHER_SPECIALS)) {
    return false;
  }

  const routeSpecial = name as RouteWeatherSpecialName;
  const lastWarpMapType = context.lastUsedWarpMapType ?? null;

  // C parity:
  // SetRoute119Weather/SetRoute123Weather sets saved weather to cycle only when
  // the previous map was NOT outdoors.
  if (!isOutdoorsMapType(lastWarpMapType)) {
    context.weather?.setSavedWeather?.(ROUTE_WEATHER_SPECIALS[routeSpecial]);
  }

  return true;
}
