#!/usr/bin/env node
/**
 * Generate Type Effectiveness Chart from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/src/battle_main.c (gTypeEffectiveness[] — 112 triples)
 *   - public/pokeemerald/include/constants/pokemon.h (TYPE_* constants)
 *
 * Outputs:
 *   - src/data/typeEffectiveness.gen.ts
 *
 * Usage: node scripts/generate-type-effectiveness.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POKEMON_H = path.join(ROOT, 'public/pokeemerald/include/constants/pokemon.h');
const BATTLE_MAIN_C = path.join(ROOT, 'public/pokeemerald/src/battle_main.c');
const OUT_FILE = path.join(ROOT, 'src/data/typeEffectiveness.gen.ts');

// ---------------------------------------------------------------------------
// 1. Parse TYPE_* constants from pokemon.h
// ---------------------------------------------------------------------------
const pokemonH = fs.readFileSync(POKEMON_H, 'utf-8');

const TYPE_MAP = {};
const typeDefRe = /^#define\s+(TYPE_\w+)\s+(\d+)\s*$/gm;
let match;
while ((match = typeDefRe.exec(pokemonH)) !== null) {
  const name = match[1];
  const id = parseInt(match[2], 10);
  if (name === 'TYPE_NONE') continue;
  TYPE_MAP[name] = id;
}

// Build ordered type list (skip TYPE_MYSTERY = 9)
const typeById = {};
for (const [name, id] of Object.entries(TYPE_MAP)) {
  if (name === 'TYPE_MYSTERY') continue;
  typeById[id] = name.replace('TYPE_', '');
}
const TYPE_IDS = Object.keys(typeById).map(Number).sort((a, b) => a - b);
const TYPE_NAMES = TYPE_IDS.map(id => typeById[id]);

console.log(`Parsed ${TYPE_NAMES.length} types: ${TYPE_NAMES.join(', ')}`);

// ---------------------------------------------------------------------------
// 2. Parse gTypeEffectiveness[] from battle_main.c
// ---------------------------------------------------------------------------
const battleC = fs.readFileSync(BATTLE_MAIN_C, 'utf-8');

const arrayRe = /gTypeEffectiveness\[\d*\]\s*=\s*\{([\s\S]*?)\};/;
const arrayMatch = battleC.match(arrayRe);
if (!arrayMatch) {
  console.error('ERROR: Could not find gTypeEffectiveness in battle_main.c');
  process.exit(1);
}

const arrayBody = arrayMatch[1];
const tokenRe = /\b(TYPE_\w+)\b/g;
const tokens = [];
while ((match = tokenRe.exec(arrayBody)) !== null) {
  tokens.push(match[1]);
}

console.log(`Found ${tokens.length} tokens (${Math.floor(tokens.length / 3)} triples)`);

// Multiplier mapping: TYPE_MUL_NO_EFFECT=0, NOT_EFFECTIVE=0.5, SUPER_EFFECTIVE=2
function resolveMultiplier(token) {
  if (token === 'TYPE_MUL_NO_EFFECT') return 0;
  if (token === 'TYPE_MUL_NOT_EFFECTIVE') return 0.5;
  if (token === 'TYPE_MUL_SUPER_EFFECTIVE') return 2;
  if (token === 'TYPE_MUL_NORMAL') return 1;
  return null;
}

function typeName(token) {
  return token.replace('TYPE_', '');
}

const chart = {};       // atkType -> { defType -> multiplier }
const foresight = [];   // entries after FORESIGHT sentinel
let pastForesight = false;
let normalCount = 0;

for (let i = 0; i + 2 < tokens.length; i += 3) {
  const atk = tokens[i];
  const def = tokens[i + 1];
  const mul = tokens[i + 2];

  // FORESIGHT sentinel
  if (atk === 'TYPE_FORESIGHT') {
    pastForesight = true;
    continue;
  }
  // End table sentinel
  if (atk === 'TYPE_ENDTABLE') break;

  const multiplier = resolveMultiplier(mul);
  if (multiplier === null) continue;

  const atkName = typeName(atk);
  const defName = typeName(def);

  if (!chart[atkName]) chart[atkName] = {};
  chart[atkName][defName] = multiplier;
  normalCount++;

  if (pastForesight) {
    foresight.push({ attack: atkName, defense: defName, multiplier });
  }
}

console.log(`Parsed ${normalCount} normal entries, ${foresight.length} foresight entries`);

// ---------------------------------------------------------------------------
// 3. Generate TypeScript output
// ---------------------------------------------------------------------------
let out = '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/src/battle_main.c (gTypeEffectiveness)\n';
out += '// Regenerate: node scripts/generate-type-effectiveness.cjs\n\n';

out += '/** All type names in index order (skipping TYPE_MYSTERY at index 9). */\n';
out += 'export const TYPE_NAMES = [\n';
for (const name of TYPE_NAMES) {
  out += `  '${name}',\n`;
}
out += '] as const;\n\n';

out += '/** Sparse type chart — only non-1.0x entries stored. */\n';
out += 'export const TYPE_CHART: Record<string, Record<string, number>> = {\n';
for (const atkType of TYPE_NAMES) {
  const row = chart[atkType];
  if (!row || Object.keys(row).length === 0) continue;
  const entries = Object.entries(row)
    .sort(([a], [b]) => TYPE_NAMES.indexOf(a) - TYPE_NAMES.indexOf(b))
    .map(([def, mult]) => `${def}: ${mult}`)
    .join(', ');
  out += `  ${atkType}: { ${entries} },\n`;
}
out += '};\n\n';

out += '/**\n';
out += ' * Foresight/Odor Sleuth overrides.\n';
out += ' * When active, these entries replace normal chart values (Ghost immunities → neutral).\n';
out += ' */\n';
out += 'export const FORESIGHT_OVERRIDES: Array<{ attack: string; defense: string; multiplier: number }> = [\n';
for (const e of foresight) {
  out += `  { attack: '${e.attack}', defense: '${e.defense}', multiplier: ${e.multiplier} },\n`;
}
out += '];\n\n';

out += '/** Get effectiveness multiplier for a move type vs one or two defender types. */\n';
out += 'export function getTypeEffectiveness(\n';
out += '  moveType: string,\n';
out += '  defenderType1: string,\n';
out += '  defenderType2?: string,\n';
out += '): number {\n';
out += '  const row = TYPE_CHART[moveType];\n';
out += '  let mult = 1;\n';
out += '  if (row) {\n';
out += '    if (row[defenderType1] !== undefined) mult *= row[defenderType1];\n';
out += '    if (defenderType2 && defenderType2 !== defenderType1 && row[defenderType2] !== undefined)\n';
out += '      mult *= row[defenderType2];\n';
out += '  }\n';
out += '  return mult;\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf-8');
console.log(`\nWrote ${OUT_FILE}`);
