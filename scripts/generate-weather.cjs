#!/usr/bin/env node
/**
 * Generate weather constant metadata from pokeemerald headers.
 *
 * Parses:
 * - public/pokeemerald/include/constants/weather.h
 *
 * Outputs:
 * - src/data/weather.gen.ts
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT, 'public/pokeemerald/include/constants/weather.h');
const OUTPUT_PATH = path.join(ROOT, 'src/data/weather.gen.ts');

function parseNumericDefines(source) {
  const defines = new Map();
  const defineRegex = /^\s*#define\s+(\w+)\s+(.+?)\s*(?:\/\/.*)?$/gm;
  let match;
  while ((match = defineRegex.exec(source)) !== null) {
    const name = match[1];
    const rawValue = match[2].trim();
    // Skip function-like macros.
    if (name.includes('(')) continue;
    defines.set(name, rawValue);
  }

  const resolved = new Map();

  function evaluate(raw) {
    let expr = raw.trim();
    if (expr.startsWith('(') && expr.endsWith(')')) {
      expr = expr.slice(1, -1).trim();
    }

    if (/^-?\d+$/.test(expr)) return Number.parseInt(expr, 10);
    if (/^0x[0-9a-f]+$/i.test(expr)) return Number.parseInt(expr, 16);

    if (/^[A-Z0-9_]+$/.test(expr)) {
      return resolved.get(expr);
    }

    const substituted = expr.replace(/\b([A-Z][A-Z0-9_]*)\b/g, (full, token) => {
      if (!resolved.has(token)) return full;
      return String(resolved.get(token));
    });

    if (/\b[A-Z][A-Z0-9_]*\b/.test(substituted)) {
      return undefined;
    }

    if (!/^[0-9xXa-fA-F\s+\-*/()<>|&~^]+$/.test(substituted)) {
      return undefined;
    }

    try {
      const value = Function(`"use strict"; return (${substituted});`)();
      return Number.isFinite(value) ? (value | 0) : undefined;
    } catch {
      return undefined;
    }
  }

  for (let pass = 0; pass < 16; pass++) {
    let progress = false;
    for (const [name, raw] of defines.entries()) {
      if (resolved.has(name)) continue;
      const value = evaluate(raw);
      if (value !== undefined) {
        resolved.set(name, value);
        progress = true;
      }
    }
    if (!progress) break;
  }

  return resolved;
}

function toOrderedObject(entries) {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function invertNameMap(constants) {
  const byId = {};
  for (const [name, id] of Object.entries(constants)) {
    if (!(id in byId)) {
      byId[id] = name;
    }
  }
  return byId;
}

function main() {
  const source = fs.readFileSync(INPUT_PATH, 'utf8');
  const allDefines = parseNumericDefines(source);

  const weatherEntries = [];
  const coordEntries = [];

  for (const [name, value] of allDefines.entries()) {
    if (name.startsWith('WEATHER_')) {
      weatherEntries.push([name, value]);
    } else if (name.startsWith('COORD_EVENT_WEATHER_')) {
      coordEntries.push([name, value]);
    }
  }

  const weatherMap = new Map(weatherEntries);
  // C parity: WEATHER_NONE is 0, but it may be omitted from parsed #defines.
  if (!weatherMap.has('WEATHER_NONE')) {
    weatherMap.set('WEATHER_NONE', 0);
  }

  const weatherConstants = toOrderedObject(Array.from(weatherMap.entries()));
  const coordWeatherConstants = toOrderedObject(coordEntries);

  const coordToWeather = {};
  for (const coordName of Object.keys(coordWeatherConstants)) {
    const weatherName = coordName.replace('COORD_EVENT_', '');
    if (weatherName in weatherConstants) {
      coordToWeather[coordName] = weatherName;
    }
  }

  const weatherIdToName = invertNameMap(weatherConstants);
  const coordIdToName = invertNameMap(coordWeatherConstants);

  const output = `// ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from pokeemerald weather constants.
// Run 'npm run generate:weather' to regenerate.

export const WEATHER_CONSTANTS = ${JSON.stringify(weatherConstants, null, 2)} as const;

export const COORD_EVENT_WEATHER_CONSTANTS = ${JSON.stringify(coordWeatherConstants, null, 2)} as const;

export type WeatherName = keyof typeof WEATHER_CONSTANTS;
export type CoordEventWeatherName = keyof typeof COORD_EVENT_WEATHER_CONSTANTS;

export const WEATHER_ID_TO_NAME: Readonly<Record<number, WeatherName>> = ${JSON.stringify(weatherIdToName, null, 2)};

export const COORD_EVENT_WEATHER_ID_TO_NAME: Readonly<Record<number, CoordEventWeatherName>> = ${JSON.stringify(coordIdToName, null, 2)};

export const COORD_EVENT_WEATHER_TO_WEATHER: Readonly<Partial<Record<CoordEventWeatherName, WeatherName>>> = ${JSON.stringify(coordToWeather, null, 2)};
`;

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`Generated ${OUTPUT_PATH}`);
  console.log(`Weather constants: ${Object.keys(weatherConstants).length}`);
  console.log(`Coord weather constants: ${Object.keys(coordWeatherConstants).length}`);
}

main();
