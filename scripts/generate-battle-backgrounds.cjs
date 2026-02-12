#!/usr/bin/env node
/**
 * Generate battle background/environment mappings from pokeemerald source.
 *
 * Parses:
 * - public/pokeemerald/include/constants/battle.h (BATTLE_ENVIRONMENT_* ids)
 * - public/pokeemerald/src/battle_bg.c (sBattleEnvironmentTable)
 * - public/pokeemerald/src/data/graphics/battle_environment.h (asset symbol -> path)
 *
 * Outputs:
 * - src/data/battleEnvironments.gen.ts
 *
 * Usage:
 *   node scripts/generate-battle-backgrounds.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BATTLE_CONSTANTS_H = path.join(ROOT, 'public/pokeemerald/include/constants/battle.h');
const BATTLE_BG_C = path.join(ROOT, 'public/pokeemerald/src/battle_bg.c');
const BATTLE_ENVIRONMENT_H = path.join(ROOT, 'public/pokeemerald/src/data/graphics/battle_environment.h');
const OUT_FILE = path.join(ROOT, 'src/data/battleEnvironments.gen.ts');

const battleConstantsSrc = fs.readFileSync(BATTLE_CONSTANTS_H, 'utf8');
const battleBgSrc = fs.readFileSync(BATTLE_BG_C, 'utf8');
const environmentGraphicsSrc = fs.readFileSync(BATTLE_ENVIRONMENT_H, 'utf8');

/** @type {Record<string, number>} */
const environmentIds = {};
for (const match of battleConstantsSrc.matchAll(/^#define\s+(BATTLE_ENVIRONMENT_[A-Z_]+)\s+(\d+)\s*$/gm)) {
  environmentIds[match[1]] = Number(match[2]);
}

/** @type {Record<string, string>} */
const symbolPaths = {};
for (const match of environmentGraphicsSrc.matchAll(/const u32\s+(\w+)\[\]\s*=\s*INCBIN_U32\("([^"]+)"\);/g)) {
  symbolPaths[match[1]] = match[2];
}

const tableMatch = battleBgSrc.match(
  /static const struct BattleBackground sBattleEnvironmentTable\[\]\s*=\s*\{([\s\S]*?)\n\};/
);
if (!tableMatch) {
  console.error('ERROR: Could not find sBattleEnvironmentTable in battle_bg.c');
  process.exit(1);
}

const tableBody = tableMatch[1];

/** @type {Array<{
 *   environment: string,
 *   environmentId: number,
 *   terrain: string,
 *   tilesSymbol: string,
 *   tilemapSymbol: string,
 *   entryTilesSymbol: string,
 *   entryTilemapSymbol: string,
 *   paletteSymbol: string,
 *   tilesDir: string,
 *   entryDir: string,
 *   paletteDir: string,
 * }>} */
const entries = [];

for (const match of tableBody.matchAll(/\[(BATTLE_ENVIRONMENT_[A-Z_]+)\]\s*=\s*\{([\s\S]*?)\n\s*\},/g)) {
  const environment = match[1];
  const body = match[2];

  const tilesSymbol = extractAssignedSymbol(body, 'tileset');
  const tilemapSymbol = extractAssignedSymbol(body, 'tilemap');
  const entryTilesSymbol = extractAssignedSymbol(body, 'entryTileset');
  const entryTilemapSymbol = extractAssignedSymbol(body, 'entryTilemap');
  const paletteSymbol = extractAssignedSymbol(body, 'palette');

  const tilesDir = getBattleEnvironmentDir(symbolPaths[tilesSymbol]);
  const entryDir = getBattleEnvironmentDir(symbolPaths[entryTilesSymbol]);
  const paletteDir = getBattleEnvironmentDir(symbolPaths[paletteSymbol]);

  if (!tilesDir || !entryDir || !paletteDir) {
    console.error(`ERROR: Failed to resolve directories for ${environment}`);
    process.exit(1);
  }

  const terrain = environment === 'BATTLE_ENVIRONMENT_PLAIN'
    ? 'plain'
    : tilesDir;

  const environmentId = environmentIds[environment];
  if (environmentId === undefined) {
    console.error(`ERROR: Missing environment id for ${environment}`);
    process.exit(1);
  }

  entries.push({
    environment,
    environmentId,
    terrain,
    tilesSymbol,
    tilemapSymbol,
    entryTilesSymbol,
    entryTilemapSymbol,
    paletteSymbol,
    tilesDir,
    entryDir,
    paletteDir,
  });
}

entries.sort((a, b) => a.environmentId - b.environmentId);

const terrainSet = new Set();
for (const entry of entries) {
  if (terrainSet.has(entry.terrain)) {
    console.error(`ERROR: Duplicate terrain key generated: ${entry.terrain}`);
    process.exit(1);
  }
  terrainSet.add(entry.terrain);
}

let out = '';
out += '// Auto-generated — do not edit\n';
out += '// Source: battle_bg.c + battle_environment.h + constants/battle.h\n';
out += '// Regenerate: node scripts/generate-battle-backgrounds.cjs\n\n';
out += 'export interface BattleEnvironmentMapping {\n';
out += '  environment: string;\n';
out += '  environmentId: number;\n';
out += '  terrain: string;\n';
out += '  tilesDir: string;\n';
out += '  entryDir: string;\n';
out += '  paletteDir: string;\n';
out += '  tilesSymbol: string;\n';
out += '  tilemapSymbol: string;\n';
out += '  entryTilesSymbol: string;\n';
out += '  entryTilemapSymbol: string;\n';
out += '  paletteSymbol: string;\n';
out += '}\n\n';
out += 'export const BATTLE_ENVIRONMENT_BY_TERRAIN = {\n';
for (const entry of entries) {
  out += `  ${entry.terrain}: { `;
  out += `environment: '${entry.environment}', `;
  out += `environmentId: ${entry.environmentId}, `;
  out += `terrain: '${entry.terrain}', `;
  out += `tilesDir: '${entry.tilesDir}', `;
  out += `entryDir: '${entry.entryDir}', `;
  out += `paletteDir: '${entry.paletteDir}', `;
  out += `tilesSymbol: '${entry.tilesSymbol}', `;
  out += `tilemapSymbol: '${entry.tilemapSymbol}', `;
  out += `entryTilesSymbol: '${entry.entryTilesSymbol}', `;
  out += `entryTilemapSymbol: '${entry.entryTilemapSymbol}', `;
  out += `paletteSymbol: '${entry.paletteSymbol}' `;
  out += '},\n';
}
out += '} as const;\n\n';
out += 'export type BattleTerrain = keyof typeof BATTLE_ENVIRONMENT_BY_TERRAIN;\n\n';
out += 'export const BATTLE_ENVIRONMENTS: BattleEnvironmentMapping[] = Object.values(\n';
out += '  BATTLE_ENVIRONMENT_BY_TERRAIN\n';
out += ') as BattleEnvironmentMapping[];\n\n';
out += 'export const BATTLE_ENVIRONMENT_BY_ID: Record<number, BattleEnvironmentMapping> =\n';
out += '  BATTLE_ENVIRONMENTS.reduce((acc, env) => {\n';
out += '    acc[env.environmentId] = env;\n';
out += '    return acc;\n';
out += '  }, {} as Record<number, BattleEnvironmentMapping>);\n\n';
out += 'export function getBattleEnvironmentByTerrain(terrain: BattleTerrain): BattleEnvironmentMapping {\n';
out += '  return BATTLE_ENVIRONMENT_BY_TERRAIN[terrain];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log(`Wrote ${OUT_FILE} (${entries.length} environments)`);

function extractAssignedSymbol(block, field) {
  const re = new RegExp(`\\.${field}\\s*=\\s*(\\w+)`);
  const match = block.match(re);
  if (!match) {
    throw new Error(`Missing .${field} in environment block`);
  }
  return match[1];
}

function getBattleEnvironmentDir(assetPath) {
  if (!assetPath) return null;
  const match = assetPath.match(/graphics\/battle_environment\/([^/]+)\//);
  return match ? match[1] : null;
}
