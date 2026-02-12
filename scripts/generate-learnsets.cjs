#!/usr/bin/env node
/**
 * Generate Level-Up Learnset Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/species.h (SPECIES_* constants)
 *   - public/pokeemerald/include/constants/moves.h (MOVE_* constants)
 *   - public/pokeemerald/src/data/pokemon/level_up_learnsets.h (move lists per species)
 *   - public/pokeemerald/src/data/pokemon/level_up_learnset_pointers.h (species → learnset mapping)
 *
 * Outputs:
 *   - src/data/learnsets.gen.ts
 *
 * Usage: node scripts/generate-learnsets.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPECIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/species.h');
const MOVES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/moves.h');
const LEARNSETS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon/level_up_learnsets.h');
const POINTERS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon/level_up_learnset_pointers.h');
const OUT_FILE = path.join(ROOT, 'src/data/learnsets.gen.ts');

// ---------------------------------------------------------------------------
// 1. Parse SPECIES_* and MOVE_* constants
// ---------------------------------------------------------------------------
const speciesH = fs.readFileSync(SPECIES_FILE, 'utf-8');
const species = {};
let match;
const specRe = /^#define\s+(SPECIES_\w+)\s+(\d+)\s*$/gm;
while ((match = specRe.exec(speciesH)) !== null) {
  species[match[1]] = parseInt(match[2], 10);
}
console.log(`Parsed ${Object.keys(species).length} species constants`);

const movesH = fs.readFileSync(MOVES_FILE, 'utf-8');
const moveIds = {};
const moveRe = /^#define\s+(MOVE_\w+)\s+(\d+)\s*$/gm;
while ((match = moveRe.exec(movesH)) !== null) {
  const name = match[1];
  const id = parseInt(match[2], 10);
  if (name === 'MOVES_COUNT' || name === 'MOVES_COUNT_GEN3' || name === 'MOVE_UNAVAILABLE') continue;
  moveIds[name] = id;
}
console.log(`Parsed ${Object.keys(moveIds).length} move IDs`);

// ---------------------------------------------------------------------------
// 2. Parse individual learnset arrays
// ---------------------------------------------------------------------------
const learnsetsH = fs.readFileSync(LEARNSETS_FILE, 'utf-8');

// Each learnset is: static const u16 sBulbasaurLevelUpLearnset[] = { LEVEL_UP_MOVE(1, MOVE_TACKLE), ... };
const learnsetArrays = {}; // varName -> [{ level, moveId }]
const arrayRe = /static\s+const\s+u16\s+(s\w+LevelUpLearnset)\[\]\s*=\s*\{([\s\S]*?)\};/g;
while ((match = arrayRe.exec(learnsetsH)) !== null) {
  const varName = match[1];
  const body = match[2];
  const moves = [];

  const moveRe2 = /LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*(MOVE_\w+)\s*\)/g;
  let m2;
  while ((m2 = moveRe2.exec(body)) !== null) {
    const level = parseInt(m2[1], 10);
    const moveId = moveIds[m2[2]];
    if (moveId !== undefined) {
      moves.push({ level, moveId });
    }
  }
  learnsetArrays[varName] = moves;
}
console.log(`Parsed ${Object.keys(learnsetArrays).length} learnset arrays`);

// ---------------------------------------------------------------------------
// 3. Parse pointer table to map species → learnset
// ---------------------------------------------------------------------------
const pointersH = fs.readFileSync(POINTERS_FILE, 'utf-8');
const speciesLearnsets = {}; // speciesId -> [{ level, moveId }]

const ptrRe = /\[(SPECIES_\w+)\]\s*=\s*(s\w+LevelUpLearnset)/g;
while ((match = ptrRe.exec(pointersH)) !== null) {
  const specName = match[1];
  const varName = match[2];
  const specId = species[specName];
  if (specId === undefined || specId === 0) continue; // skip SPECIES_NONE

  const learnset = learnsetArrays[varName];
  if (learnset) {
    speciesLearnsets[specId] = learnset;
  }
}
console.log(`Mapped ${Object.keys(speciesLearnsets).length} species to learnsets`);

// ---------------------------------------------------------------------------
// 4. Generate output
// ---------------------------------------------------------------------------
let out = '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/src/data/pokemon/level_up_learnsets.h\n';
out += '// Regenerate: node scripts/generate-learnsets.cjs\n\n';

out += 'export interface LearnsetEntry {\n';
out += '  level: number;\n';
out += '  moveId: number;\n';
out += '}\n\n';

out += '/** Level-up learnsets indexed by species ID. */\n';
out += 'export const LEARNSETS: Record<number, LearnsetEntry[]> = {\n';
const sortedIds = Object.keys(speciesLearnsets).map(Number).sort((a, b) => a - b);
for (const id of sortedIds) {
  const moves = speciesLearnsets[id];
  const entries = moves.map(m => `{ level: ${m.level}, moveId: ${m.moveId} }`).join(', ');
  out += `  ${id}: [${entries}],\n`;
}
out += '};\n\n';

out += '/** Get learnset for a species. */\n';
out += 'export function getLearnset(speciesId: number): LearnsetEntry[] {\n';
out += '  return LEARNSETS[speciesId] ?? [];\n';
out += '}\n\n';

out += '/** Get moves a Pokemon should know at a given level (last 4 learned moves at or below level). */\n';
out += 'export function getMovesAtLevel(speciesId: number, level: number): number[] {\n';
out += '  const learnset = getLearnset(speciesId);\n';
out += '  const learned = learnset.filter(e => e.level <= level).map(e => e.moveId);\n';
out += '  // Return last 4 unique moves (most recently learned)\n';
out += '  const unique = [...new Set(learned.reverse())].reverse();\n';
out += '  return unique.slice(-4);\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf-8');
console.log(`\nWrote ${OUT_FILE}`);
