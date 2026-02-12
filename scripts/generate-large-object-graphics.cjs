#!/usr/bin/env node
/**
 * Generate large object graphics metadata from pokeemerald C source.
 *
 * Parses:
 *   - src/types/objectEvents.ts (LARGE_OBJECT_GRAPHICS_IDS)
 *   - public/pokeemerald/src/data/object_events/object_event_graphics_info_pointers.h
 *   - public/pokeemerald/src/data/object_events/object_event_graphics_info.h
 *
 * Outputs:
 *   - src/data/largeObjectGraphics.gen.ts
 *
 * Usage: node scripts/generate-large-object-graphics.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OBJECT_EVENTS_PATH = path.join(ROOT, 'src/types/objectEvents.ts');
const POINTERS_PATH = path.join(
  ROOT,
  'public/pokeemerald/src/data/object_events/object_event_graphics_info_pointers.h'
);
const GRAPHICS_INFO_PATH = path.join(
  ROOT,
  'public/pokeemerald/src/data/object_events/object_event_graphics_info.h'
);
const OUTPUT_PATH = path.join(ROOT, 'src/data/largeObjectGraphics.gen.ts');
const MISC_ASSET_DIR = path.join(ROOT, 'public/pokeemerald/graphics/object_events/pics/misc');

function parseLargeObjectIds(objectEventsSource) {
  const listMatch = objectEventsSource.match(
    /export const LARGE_OBJECT_GRAPHICS_IDS = \[([\s\S]*?)\] as const;/
  );
  if (!listMatch) {
    throw new Error('Could not find LARGE_OBJECT_GRAPHICS_IDS in src/types/objectEvents.ts');
  }

  const ids = [];
  const idRegex = /'((?:OBJ_EVENT_GFX_[A-Z0-9_]+))'/g;
  let idMatch;
  while ((idMatch = idRegex.exec(listMatch[1])) !== null) {
    ids.push(idMatch[1]);
  }

  if (ids.length === 0) {
    throw new Error('LARGE_OBJECT_GRAPHICS_IDS is empty or contains non-literal values.');
  }

  return ids;
}

function parsePointerMap(pointerSource) {
  const map = new Map();
  const pointerRegex =
    /\[(OBJ_EVENT_GFX_[A-Z0-9_]+)\]\s*=\s*&?(gObjectEventGraphicsInfo_[A-Za-z0-9_]+)/g;

  let match;
  while ((match = pointerRegex.exec(pointerSource)) !== null) {
    map.set(match[1], match[2]);
  }

  return map;
}

function parseGraphicsInfo(graphicsInfoSource) {
  const map = new Map();
  const structRegex =
    /const struct ObjectEventGraphicsInfo (gObjectEventGraphicsInfo_[A-Za-z0-9_]+)\s*=\s*\{([\s\S]*?)\n\};/g;

  let match;
  while ((match = structRegex.exec(graphicsInfoSource)) !== null) {
    const structName = match[1];
    const body = match[2];

    const widthMatch = body.match(/\.width\s*=\s*(\d+)/);
    const heightMatch = body.match(/\.height\s*=\s*(\d+)/);

    if (!widthMatch || !heightMatch) {
      continue;
    }

    map.set(structName, {
      width: Number(widthMatch[1]),
      height: Number(heightMatch[1]),
    });
  }

  return map;
}

function camelToSnake(value) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([a-zA-Z])(\d+)/g, '$1_$2')
    .toLowerCase();
}

function toImagePath(structName) {
  const baseName = structName.replace('gObjectEventGraphicsInfo_', '');
  const fileName = `${camelToSnake(baseName)}.png`;
  const absolutePath = path.join(MISC_ASSET_DIR, fileName);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Expected misc sprite for ${structName} at ${absolutePath}, but file is missing.`);
  }

  return `/pokeemerald/graphics/object_events/pics/misc/${fileName}`;
}

function generateOutput(entries) {
  const lines = [
    '// Auto-generated from pokeemerald object event graphics C source.',
    '// Do not edit manually. Run: npm run generate:large-objects',
    '',
    "import type { LargeObjectGraphicsId } from '../types/objectEvents';",
    '',
    'export interface LargeObjectGraphicsInfo {',
    '  width: number;',
    '  height: number;',
    '  imagePath: string;',
    '}',
    '',
    'export const LARGE_OBJECT_GRAPHICS_INFO: Record<LargeObjectGraphicsId, LargeObjectGraphicsInfo> = {',
  ];

  for (const entry of entries) {
    lines.push(
      `  '${entry.id}': { width: ${entry.width}, height: ${entry.height}, imagePath: '${entry.imagePath}' },`
    );
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const objectEventsSource = fs.readFileSync(OBJECT_EVENTS_PATH, 'utf-8');
  const pointersSource = fs.readFileSync(POINTERS_PATH, 'utf-8');
  const graphicsInfoSource = fs.readFileSync(GRAPHICS_INFO_PATH, 'utf-8');

  const largeObjectIds = parseLargeObjectIds(objectEventsSource);
  const pointerMap = parsePointerMap(pointersSource);
  const graphicsMap = parseGraphicsInfo(graphicsInfoSource);

  const entries = largeObjectIds.map((id) => {
    const structName = pointerMap.get(id);
    if (!structName) {
      throw new Error(`No ObjectEventGraphicsInfo pointer mapping found for ${id}`);
    }

    const dimensions = graphicsMap.get(structName);
    if (!dimensions) {
      throw new Error(`No width/height found in object_event_graphics_info.h for ${structName}`);
    }

    return {
      id,
      width: dimensions.width,
      height: dimensions.height,
      imagePath: toImagePath(structName),
    };
  });

  const output = generateOutput(entries);
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
  console.log(`Generated ${OUTPUT_PATH} with ${entries.length} large object entries.`);
}

main();
