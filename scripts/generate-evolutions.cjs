#!/usr/bin/env node
/**
 * Generate evolution rule data from pokeemerald source.
 *
 * Parses:
 * - public/pokeemerald/include/constants/species.h
 * - public/pokeemerald/include/constants/pokemon.h
 * - public/pokeemerald/include/constants/items.h
 * - public/pokeemerald/src/data/pokemon/evolution.h
 *
 * Outputs:
 * - src/data/evolutions.gen.ts
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPECIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/species.h');
const POKEMON_CONST_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/pokemon.h');
const ITEMS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/items.h');
const EVOLUTION_TABLE_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon/evolution.h');
const OUT_FILE = path.join(ROOT, 'src/data/evolutions.gen.ts');

function parseDefineConstants(filePath, predicate) {
  const content = fs.readFileSync(filePath, 'utf8');
  const constants = {};
  const re = /^#define\s+([A-Z0-9_]+)\s+([0-9xa-fA-F]+)\s*(?:\/\/.*)?$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    const raw = match[2];
    if (predicate && !predicate(name)) continue;
    const value = raw.startsWith('0x') || raw.startsWith('0X')
      ? parseInt(raw, 16)
      : parseInt(raw, 10);
    if (!Number.isNaN(value)) {
      constants[name] = value;
    }
  }
  return constants;
}

function parseEvolutionTable(evolutionContent, speciesMap, methodMap, itemMap) {
  const bySpecies = {};
  const lines = evolutionContent.split(/\r?\n/);
  let currentSpeciesName = null;
  let buffer = '';

  const speciesStartRe = /^\s*\[(SPECIES_[A-Z0-9_]+)\]\s*=\s*\{/;
  const ruleRe = /\{(EVO_[A-Z0-9_]+)\s*,\s*([A-Z0-9_x]+)\s*,\s*(SPECIES_[A-Z0-9_]+)\}/g;

  function flushSpeciesBuffer() {
    if (!currentSpeciesName) return;

    const speciesId = speciesMap[currentSpeciesName];
    if (!speciesId || speciesId <= 0) {
      currentSpeciesName = null;
      buffer = '';
      return;
    }

    const rules = [];
    let match;
    while ((match = ruleRe.exec(buffer)) !== null) {
      const methodName = match[1];
      const paramToken = match[2];
      const targetSpeciesName = match[3];

      const method = methodMap[methodName];
      const targetSpecies = speciesMap[targetSpeciesName];
      if (method === undefined || targetSpecies === undefined) {
        continue;
      }

      let param = 0;
      if (/^0x/i.test(paramToken)) {
        param = parseInt(paramToken, 16);
      } else if (/^\d+$/.test(paramToken)) {
        param = parseInt(paramToken, 10);
      } else if (itemMap[paramToken] !== undefined) {
        param = itemMap[paramToken];
      } else {
        param = 0;
      }

      rules.push({
        method,
        param,
        targetSpecies,
      });
    }

    if (rules.length > 0) {
      bySpecies[speciesId] = rules;
    }

    currentSpeciesName = null;
    buffer = '';
  }

  for (const line of lines) {
    if (currentSpeciesName === null) {
      const startMatch = line.match(speciesStartRe);
      if (!startMatch) continue;
      currentSpeciesName = startMatch[1];
      buffer = line;
      if (line.includes('}},')) {
        flushSpeciesBuffer();
      }
      continue;
    }

    buffer += `\n${line}`;
    if (line.includes('}},')) {
      flushSpeciesBuffer();
    }
  }

  flushSpeciesBuffer();
  return bySpecies;
}

function renderConstObject(name, sourceMap) {
  const entries = Object.entries(sourceMap)
    .sort((a, b) => a[1] - b[1])
    .map(([key, value]) => `  ${key}: ${value},`)
    .join('\n');
  return `export const ${name} = {\n${entries}\n} as const;\n`;
}

function main() {
  const speciesMap = parseDefineConstants(
    SPECIES_FILE,
    (name) => name.startsWith('SPECIES_'),
  );
  const methodMap = parseDefineConstants(
    POKEMON_CONST_FILE,
    (name) => name.startsWith('EVO_') && !name.startsWith('EVO_MODE_') && name !== 'EVOS_PER_MON',
  );
  const modeMap = parseDefineConstants(
    POKEMON_CONST_FILE,
    (name) => name.startsWith('EVO_MODE_'),
  );
  const itemMap = parseDefineConstants(
    ITEMS_FILE,
    (name) => name.startsWith('ITEM_'),
  );
  const evolutionContent = fs.readFileSync(EVOLUTION_TABLE_FILE, 'utf8');
  const bySpecies = parseEvolutionTable(evolutionContent, speciesMap, methodMap, itemMap);

  const sortedSpecies = Object.keys(bySpecies)
    .map((id) => parseInt(id, 10))
    .sort((a, b) => a - b);

  let out = '';
  out += '// Auto-generated - do not edit\n';
  out += '// Source: public/pokeemerald/src/data/pokemon/evolution.h\n';
  out += '// Regenerate: node scripts/generate-evolutions.cjs\n\n';
  out += renderConstObject('EVOLUTION_METHODS', methodMap);
  out += '\n';
  out += renderConstObject('EVOLUTION_MODES', modeMap);
  out += '\n';
  out += 'export interface EvolutionRule {\n';
  out += '  method: number;\n';
  out += '  param: number;\n';
  out += '  targetSpecies: number;\n';
  out += '}\n\n';
  out += 'export const EVOLUTIONS: Record<number, EvolutionRule[]> = {\n';
  for (const speciesId of sortedSpecies) {
    const rules = bySpecies[speciesId];
    const ruleEntries = rules
      .map((rule) => `{ method: ${rule.method}, param: ${rule.param}, targetSpecies: ${rule.targetSpecies} }`)
      .join(', ');
    out += `  ${speciesId}: [${ruleEntries}],\n`;
  }
  out += '};\n\n';
  out += 'export function getEvolutionRules(speciesId: number): EvolutionRule[] {\n';
  out += '  return EVOLUTIONS[speciesId] ?? [];\n';
  out += '}\n';

  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.log(`[generate-evolutions] Wrote ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`[generate-evolutions] Species with evolution rules: ${sortedSpecies.length}`);
}

main();
