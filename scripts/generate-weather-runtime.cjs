#!/usr/bin/env node
/**
 * Generate runtime weather effect mapping from pokeemerald weather callback table.
 *
 * Parses:
 * - public/pokeemerald/src/field_weather.c (sWeatherFuncs)
 *
 * Outputs:
 * - src/weather/runtime.gen.ts
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'public/pokeemerald/src/field_weather.c');
const WEATHER_EFFECT_INPUT_PATH = path.join(ROOT, 'public/pokeemerald/src/field_weather_effect.c');
const OUTPUT_PATH = path.join(ROOT, 'src/weather/runtime.gen.ts');

const CALLBACK_TO_EFFECT_KEY = {
  None_Init: 'none',
  Clouds_InitVars: 'clouds',
  Sunny_InitVars: 'sunny',
  Rain_InitVars: 'rain',
  Snow_InitVars: 'snow',
  Thunderstorm_InitVars: 'thunderstorm',
  FogHorizontal_InitVars: 'fog_horizontal',
  Ash_InitVars: 'volcanic_ash',
  Sandstorm_InitVars: 'sandstorm',
  FogDiagonal_InitVars: 'fog_diagonal',
  Shade_InitVars: 'shade',
  Drought_InitVars: 'drought',
  Downpour_InitVars: 'downpour',
  Bubbles_InitVars: 'underwater_bubbles',
};

function parseWeatherCallbackTable(source) {
  const tableMatch = source.match(/static const struct WeatherCallbacks sWeatherFuncs\[\]\s*=\s*\{([\s\S]*?)\};/);
  if (!tableMatch) {
    throw new Error('Unable to find sWeatherFuncs table in field_weather.c');
  }

  const tableBody = tableMatch[1];
  const entries = [];
  const entryRegex = /\[(WEATHER_[A-Z0-9_]+)\]\s*=\s*\{\s*([A-Za-z0-9_]+)\s*,/g;
  let match;
  while ((match = entryRegex.exec(tableBody)) !== null) {
    entries.push({
      weather: match[1],
      initCallback: match[2],
    });
  }
  return entries;
}

function parseWeatherCycles(weatherEffectSource) {
  const cycleTableByName = {};

  const tableRegex = /static const u8\s+(sWeatherCycle[A-Za-z0-9_]+)\[WEATHER_CYCLE_LENGTH\]\s*=\s*\{([\s\S]*?)\};/g;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(weatherEffectSource)) !== null) {
    const tableName = tableMatch[1];
    const tableValues = Array.from(tableMatch[2].matchAll(/WEATHER_[A-Z0-9_]+/g)).map(
      (match) => match[0]
    );
    if (tableValues.length > 0) {
      cycleTableByName[tableName] = tableValues;
    }
  }

  const weatherCycles = {};
  const cycleReferenceRegex = /case\s+(WEATHER_[A-Z0-9_]+)\s*:\s*return\s+(sWeatherCycle[A-Za-z0-9_]+)\[gSaveBlock1Ptr->weatherCycleStage\];/g;
  let cycleReferenceMatch;
  while ((cycleReferenceMatch = cycleReferenceRegex.exec(weatherEffectSource)) !== null) {
    const weatherName = cycleReferenceMatch[1];
    const tableName = cycleReferenceMatch[2];
    const cycleValues = cycleTableByName[tableName];
    if (cycleValues?.length) {
      weatherCycles[weatherName] = cycleValues;
    }
  }

  return weatherCycles;
}

function toSortedObject(entries) {
  return Object.fromEntries(
    entries.sort(([a], [b]) => a.localeCompare(b))
  );
}

function main() {
  const source = fs.readFileSync(INPUT_PATH, 'utf8');
  const weatherEffectSource = fs.readFileSync(WEATHER_EFFECT_INPUT_PATH, 'utf8');
  const parsedEntries = parseWeatherCallbackTable(source);
  const weatherCycles = parseWeatherCycles(weatherEffectSource);

  const weatherToEffectKeyEntries = [];
  const weatherToInitCallbackEntries = [];

  for (const entry of parsedEntries) {
    weatherToInitCallbackEntries.push([entry.weather, entry.initCallback]);
    const effectKey = CALLBACK_TO_EFFECT_KEY[entry.initCallback];
    if (effectKey) {
      weatherToEffectKeyEntries.push([entry.weather, effectKey]);
    }
  }

  weatherToEffectKeyEntries.push(['WEATHER_ABNORMAL', 'abnormal']);

  const runtimeAliases = {};

  const weatherToEffectKey = toSortedObject(weatherToEffectKeyEntries);
  const weatherToInitCallback = toSortedObject(weatherToInitCallbackEntries);
  const weatherCyclesByWeather = toSortedObject(Object.entries(weatherCycles));

  const effectKeys = Array.from(new Set(Object.values(weatherToEffectKey))).sort();
  const effectKeyUnion = effectKeys.map((k) => `'${k}'`).join(' | ');

  const output = `// ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from pokeemerald weather callback table.
// Run 'npm run generate:weather-runtime' to regenerate.

import type { WeatherName } from '../data/weather.gen';

export type RuntimeWeatherEffectKey = ${effectKeyUnion};

export const WEATHER_INIT_CALLBACKS: Readonly<Partial<Record<WeatherName, string>>> = ${JSON.stringify(
    weatherToInitCallback,
    null,
    2
  )};

export const WEATHER_EFFECT_KEYS_BY_WEATHER: Readonly<
  Partial<Record<WeatherName, RuntimeWeatherEffectKey>>
> = ${JSON.stringify(weatherToEffectKey, null, 2)};

export const WEATHER_CYCLES_BY_WEATHER: Readonly<
  Partial<Record<WeatherName, readonly string[]>>
> = ${JSON.stringify(weatherCyclesByWeather, null, 2)};

export const RUNTIME_WEATHER_ALIASES: Readonly<Partial<Record<WeatherName, WeatherName>>> = ${JSON.stringify(
    runtimeAliases,
    null,
    2
  )};
`;

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`Generated ${OUTPUT_PATH}`);
  console.log(`Mapped weather entries: ${Object.keys(weatherToEffectKey).length}`);
  console.log(`Mapped weather cycles: ${Object.keys(weatherCyclesByWeather).length}`);
}

main();
