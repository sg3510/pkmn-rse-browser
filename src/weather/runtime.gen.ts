// ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from pokeemerald weather callback table.
// Run 'npm run generate:weather-runtime' to regenerate.

import type { WeatherName } from '../data/weather.gen';

export type RuntimeWeatherEffectKey = 'abnormal' | 'clouds' | 'downpour' | 'drought' | 'fog_diagonal' | 'fog_horizontal' | 'none' | 'rain' | 'sandstorm' | 'shade' | 'snow' | 'sunny' | 'thunderstorm' | 'underwater_bubbles' | 'volcanic_ash';

export const WEATHER_INIT_CALLBACKS: Readonly<Partial<Record<WeatherName, string>>> = {
  "WEATHER_DOWNPOUR": "Downpour_InitVars",
  "WEATHER_DROUGHT": "Drought_InitVars",
  "WEATHER_FOG_DIAGONAL": "FogDiagonal_InitVars",
  "WEATHER_FOG_HORIZONTAL": "FogHorizontal_InitVars",
  "WEATHER_NONE": "None_Init",
  "WEATHER_RAIN": "Rain_InitVars",
  "WEATHER_RAIN_THUNDERSTORM": "Thunderstorm_InitVars",
  "WEATHER_SANDSTORM": "Sandstorm_InitVars",
  "WEATHER_SHADE": "Shade_InitVars",
  "WEATHER_SNOW": "Snow_InitVars",
  "WEATHER_SUNNY": "Sunny_InitVars",
  "WEATHER_SUNNY_CLOUDS": "Clouds_InitVars",
  "WEATHER_UNDERWATER": "FogHorizontal_InitVars",
  "WEATHER_UNDERWATER_BUBBLES": "Bubbles_InitVars",
  "WEATHER_VOLCANIC_ASH": "Ash_InitVars"
};

export const WEATHER_EFFECT_KEYS_BY_WEATHER: Readonly<
  Partial<Record<WeatherName, RuntimeWeatherEffectKey>>
> = {
  "WEATHER_ABNORMAL": "abnormal",
  "WEATHER_DOWNPOUR": "downpour",
  "WEATHER_DROUGHT": "drought",
  "WEATHER_FOG_DIAGONAL": "fog_diagonal",
  "WEATHER_FOG_HORIZONTAL": "fog_horizontal",
  "WEATHER_NONE": "none",
  "WEATHER_RAIN": "rain",
  "WEATHER_RAIN_THUNDERSTORM": "thunderstorm",
  "WEATHER_SANDSTORM": "sandstorm",
  "WEATHER_SHADE": "shade",
  "WEATHER_SNOW": "snow",
  "WEATHER_SUNNY": "sunny",
  "WEATHER_SUNNY_CLOUDS": "clouds",
  "WEATHER_UNDERWATER": "fog_horizontal",
  "WEATHER_UNDERWATER_BUBBLES": "underwater_bubbles",
  "WEATHER_VOLCANIC_ASH": "volcanic_ash"
};

export const WEATHER_CYCLES_BY_WEATHER: Readonly<
  Partial<Record<WeatherName, readonly string[]>>
> = {
  "WEATHER_ROUTE119_CYCLE": [
    "WEATHER_SUNNY",
    "WEATHER_RAIN",
    "WEATHER_RAIN_THUNDERSTORM",
    "WEATHER_RAIN"
  ],
  "WEATHER_ROUTE123_CYCLE": [
    "WEATHER_SUNNY",
    "WEATHER_SUNNY",
    "WEATHER_RAIN",
    "WEATHER_SUNNY"
  ]
};

export const RUNTIME_WEATHER_ALIASES: Readonly<Partial<Record<WeatherName, WeatherName>>> = {};
