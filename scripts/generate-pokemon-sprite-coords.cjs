#!/usr/bin/env node
/**
 * Generate Pokemon Battle Sprite Coordinate Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/species.h (SPECIES_* constants)
 *   - public/pokeemerald/src/data/pokemon_graphics/front_pic_coordinates.h
 *   - public/pokeemerald/src/data/pokemon_graphics/back_pic_coordinates.h
 *   - public/pokeemerald/src/data/pokemon_graphics/enemy_mon_elevation.h
 *
 * Outputs:
 *   - src/data/pokemonSpriteCoords.gen.ts
 *
 * Usage: node scripts/generate-pokemon-sprite-coords.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPECIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/species.h');
const FRONT_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon_graphics/front_pic_coordinates.h');
const BACK_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon_graphics/back_pic_coordinates.h');
const ELEV_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon_graphics/enemy_mon_elevation.h');
const OUT_FILE = path.join(ROOT, 'src/data/pokemonSpriteCoords.gen.ts');

// ---------------------------------------------------------------------------
// 1. Parse SPECIES_* constants
// ---------------------------------------------------------------------------
const speciesH = fs.readFileSync(SPECIES_FILE, 'utf-8');
const species = {};
const specRe = /^#define\s+(SPECIES_\w+)\s+(\d+)\s*$/gm;
let match;
while ((match = specRe.exec(speciesH)) !== null) {
  species[match[1]] = parseInt(match[2], 10);
}
console.log(`Parsed ${Object.keys(species).length} species constants`);

// ---------------------------------------------------------------------------
// 2. Parse front/back coordinates
// ---------------------------------------------------------------------------
function parseCoords(content) {
  const coords = {};
  const re = /\[(SPECIES_\w+)\]\s*=\s*\{\s*\.size\s*=\s*MON_COORDS_SIZE\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*\.y_offset\s*=\s*(\d+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    coords[m[1]] = {
      width: parseInt(m[2], 10),
      height: parseInt(m[3], 10),
      yOffset: parseInt(m[4], 10),
    };
  }
  return coords;
}

const frontCoords = parseCoords(fs.readFileSync(FRONT_FILE, 'utf-8'));
const backCoords = parseCoords(fs.readFileSync(BACK_FILE, 'utf-8'));
console.log(`Parsed ${Object.keys(frontCoords).length} front coords, ${Object.keys(backCoords).length} back coords`);

// ---------------------------------------------------------------------------
// 3. Parse enemy elevation
// ---------------------------------------------------------------------------
const elevH = fs.readFileSync(ELEV_FILE, 'utf-8');
const elevation = {};
const elevRe = /\[(SPECIES_\w+)\]\s*=\s*(\d+)/g;
while ((match = elevRe.exec(elevH)) !== null) {
  elevation[match[1]] = parseInt(match[2], 10);
}
console.log(`Parsed ${Object.keys(elevation).length} elevation entries`);

// ---------------------------------------------------------------------------
// 4. Merge and generate
// ---------------------------------------------------------------------------
const entries = [];
for (const [specName, specId] of Object.entries(species)) {
  if (specName === 'SPECIES_NONE') continue;
  if (specName.startsWith('SPECIES_OLD_UNOWN_')) continue;

  const front = frontCoords[specName];
  const back = backCoords[specName];
  if (!front || !back) continue;

  entries.push({
    id: specId,
    frontWidth: front.width,
    frontHeight: front.height,
    frontYOffset: front.yOffset,
    backWidth: back.width,
    backHeight: back.height,
    backYOffset: back.yOffset,
    elevation: elevation[specName] || 0,
  });
}
entries.sort((a, b) => a.id - b.id);
console.log(`Merged ${entries.length} species with complete coordinate data`);

let out = '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/src/data/pokemon_graphics/\n';
out += '// Regenerate: node scripts/generate-pokemon-sprite-coords.cjs\n\n';

out += 'export interface PokemonSpriteCoords {\n';
out += '  frontWidth: number;\n';
out += '  frontHeight: number;\n';
out += '  frontYOffset: number;\n';
out += '  backWidth: number;\n';
out += '  backHeight: number;\n';
out += '  backYOffset: number;\n';
out += '  elevation: number;\n';
out += '}\n\n';

out += 'export const POKEMON_SPRITE_COORDS: Record<number, PokemonSpriteCoords> = {\n';
for (const e of entries) {
  out += `  ${e.id}: { frontWidth: ${e.frontWidth}, frontHeight: ${e.frontHeight}, frontYOffset: ${e.frontYOffset}, backWidth: ${e.backWidth}, backHeight: ${e.backHeight}, backYOffset: ${e.backYOffset}, elevation: ${e.elevation} },\n`;
}
out += '};\n\n';

out += '/** Get sprite coordinates for a species. */\n';
out += 'export function getPokemonSpriteCoords(speciesId: number): PokemonSpriteCoords | undefined {\n';
out += '  return POKEMON_SPRITE_COORDS[speciesId];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf-8');
console.log(`\nWrote ${OUT_FILE}`);
