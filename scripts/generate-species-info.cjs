#!/usr/bin/env node
/**
 * Generate Species Info (Base Stats) from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/src/data/pokemon/species_info.h
 *
 * Outputs:
 *   - src/data/speciesInfo.ts (base stats, types, abilities, growth rates)
 *
 * Usage: node scripts/generate-species-info.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SPECIES_INFO_FILE = path.join(ROOT, 'public/pokeemerald/src/data/pokemon/species_info.h');
const OUTPUT_FILE = path.join(ROOT, 'src/data/speciesInfo.ts');

/**
 * Parse species_info.h to extract all species data
 * Format:
 *   [SPECIES_NAME] = {
 *     .baseHP = XX,
 *     .baseAttack = XX,
 *     ...
 *   },
 */
function parseSpeciesInfo(content) {
  const speciesInfo = new Map();

  // Match each species block - need to handle nested braces
  // Find [SPECIES_NAME] = and then match balanced braces
  const speciesStartRegex = /\[(SPECIES_\w+)\]\s*=\s*\{/g;
  let startMatch;

  while ((startMatch = speciesStartRegex.exec(content)) !== null) {
    const speciesKey = startMatch[1];
    const startIndex = startMatch.index + startMatch[0].length;

    // Find matching closing brace by counting brace depth
    let depth = 1;
    let endIndex = startIndex;
    while (depth > 0 && endIndex < content.length) {
      const char = content[endIndex];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      endIndex++;
    }

    const blockContent = content.slice(startIndex, endIndex - 1);

    // Skip special entries
    if (speciesKey === 'SPECIES_NONE' || speciesKey.includes('OLD_UNOWN')) {
      continue;
    }

    const info = {
      baseHP: 0,
      baseAttack: 0,
      baseDefense: 0,
      baseSpeed: 0,
      baseSpAttack: 0,
      baseSpDefense: 0,
      types: ['NORMAL', 'NORMAL'],
      catchRate: 0,
      expYield: 0,
      evYield: { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 },
      genderRatio: 127, // default 50/50
      eggCycles: 20,
      friendship: 70,
      growthRate: 'MEDIUM_FAST',
      abilities: ['NONE', 'NONE'],
    };

    // Parse each field - handle both simple values and brace-enclosed values
    // Match: .field = value, or .field = { ... },
    const fieldRegex = /\.(\w+)\s*=\s*(\{[^}]+\}|[^,\n]+)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(blockContent)) !== null) {
      const field = fieldMatch[1];
      let value = fieldMatch[2].trim();

      switch (field) {
        case 'baseHP':
          info.baseHP = parseInt(value, 10);
          break;
        case 'baseAttack':
          info.baseAttack = parseInt(value, 10);
          break;
        case 'baseDefense':
          info.baseDefense = parseInt(value, 10);
          break;
        case 'baseSpeed':
          info.baseSpeed = parseInt(value, 10);
          break;
        case 'baseSpAttack':
          info.baseSpAttack = parseInt(value, 10);
          break;
        case 'baseSpDefense':
          info.baseSpDefense = parseInt(value, 10);
          break;
        case 'types':
          // Format: { TYPE_X, TYPE_Y }
          const typeMatch = value.match(/\{\s*(TYPE_\w+)\s*,\s*(TYPE_\w+)\s*\}/);
          if (typeMatch) {
            info.types = [
              typeMatch[1].replace('TYPE_', ''),
              typeMatch[2].replace('TYPE_', '')
            ];
          }
          break;
        case 'catchRate':
          info.catchRate = parseInt(value, 10);
          break;
        case 'expYield':
          info.expYield = parseInt(value, 10);
          break;
        case 'evYield_HP':
          info.evYield.hp = parseInt(value, 10);
          break;
        case 'evYield_Attack':
          info.evYield.attack = parseInt(value, 10);
          break;
        case 'evYield_Defense':
          info.evYield.defense = parseInt(value, 10);
          break;
        case 'evYield_Speed':
          info.evYield.speed = parseInt(value, 10);
          break;
        case 'evYield_SpAttack':
          info.evYield.spAttack = parseInt(value, 10);
          break;
        case 'evYield_SpDefense':
          info.evYield.spDefense = parseInt(value, 10);
          break;
        case 'genderRatio':
          // Convert gender ratio - can be MON_MALE, MON_FEMALE, MON_GENDERLESS, or PERCENT_FEMALE(x)
          if (value === 'MON_MALE') {
            info.genderRatio = 0;
          } else if (value === 'MON_FEMALE') {
            info.genderRatio = 254;
          } else if (value === 'MON_GENDERLESS') {
            info.genderRatio = 255;
          } else {
            // PERCENT_FEMALE(12.5) -> extract number
            const percentMatch = value.match(/PERCENT_FEMALE\((\d+(?:\.\d+)?)\)/);
            if (percentMatch) {
              const percent = parseFloat(percentMatch[1]);
              info.genderRatio = Math.min(254, Math.floor((percent * 255) / 100));
            }
          }
          break;
        case 'eggCycles':
          info.eggCycles = parseInt(value, 10);
          break;
        case 'friendship':
          if (value === 'STANDARD_FRIENDSHIP') {
            info.friendship = 70;
          } else {
            info.friendship = parseInt(value, 10) || 70;
          }
          break;
        case 'growthRate':
          info.growthRate = value.replace('GROWTH_', '');
          break;
        case 'abilities':
          // Format: {ABILITY_X, ABILITY_Y}
          const abilityMatch = value.match(/\{\s*(ABILITY_\w+)\s*,\s*(ABILITY_\w+)\s*\}/);
          if (abilityMatch) {
            info.abilities = [
              abilityMatch[1].replace('ABILITY_', ''),
              abilityMatch[2].replace('ABILITY_', '')
            ];
          }
          break;
      }
    }

    speciesInfo.set(speciesKey, info);
  }

  return speciesInfo;
}

/**
 * Get species ID from key using the species.ts we generated
 */
function getSpeciesIds() {
  const speciesFile = path.join(ROOT, 'src/data/species.ts');
  const content = fs.readFileSync(speciesFile, 'utf8');

  const ids = new Map();
  const regex = /(\w+):\s*(\d+),/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    ids.set('SPECIES_' + match[1], parseInt(match[2], 10));
  }

  return ids;
}

function generate() {
  console.log('Generating species info from pokeemerald source...\n');

  // Read and parse
  const content = fs.readFileSync(SPECIES_INFO_FILE, 'utf8');
  const speciesInfo = parseSpeciesInfo(content);
  console.log(`Parsed ${speciesInfo.size} species info entries`);

  // Get species IDs
  const speciesIds = getSpeciesIds();
  console.log(`Found ${speciesIds.size} species IDs`);

  // Build output
  const entries = [];
  let matched = 0;

  for (const [speciesKey, info] of speciesInfo) {
    const id = speciesIds.get(speciesKey);
    if (id !== undefined) {
      entries.push({ id, ...info });
      matched++;
    }
  }

  // Sort by ID
  entries.sort((a, b) => a.id - b.id);

  console.log(`Matched ${matched} species with IDs`);

  // Generate TypeScript
  const output = `/**
 * Species Info (Base Stats)
 *
 * Auto-generated from pokeemerald source:
 *   - public/pokeemerald/src/data/pokemon/species_info.h
 *
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate:species-info
 *
 * Generated: ${new Date().toISOString()}
 */

export interface SpeciesInfo {
  baseHP: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseSpAttack: number;
  baseSpDefense: number;
  types: [string, string];
  catchRate: number;
  expYield: number;
  evYield: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    spAttack: number;
    spDefense: number;
  };
  genderRatio: number;  // 0=male, 254=female, 255=genderless, else threshold
  eggCycles: number;
  friendship: number;
  growthRate: string;
  abilities: [string, string];
}

export const SPECIES_INFO: Record<number, SpeciesInfo> = {
${entries.map(e => `  ${e.id}: {
    baseHP: ${e.baseHP},
    baseAttack: ${e.baseAttack},
    baseDefense: ${e.baseDefense},
    baseSpeed: ${e.baseSpeed},
    baseSpAttack: ${e.baseSpAttack},
    baseSpDefense: ${e.baseSpDefense},
    types: [${JSON.stringify(e.types[0])}, ${JSON.stringify(e.types[1])}],
    catchRate: ${e.catchRate},
    expYield: ${e.expYield},
    evYield: { hp: ${e.evYield.hp}, attack: ${e.evYield.attack}, defense: ${e.evYield.defense}, speed: ${e.evYield.speed}, spAttack: ${e.evYield.spAttack}, spDefense: ${e.evYield.spDefense} },
    genderRatio: ${e.genderRatio},
    eggCycles: ${e.eggCycles},
    friendship: ${e.friendship},
    growthRate: ${JSON.stringify(e.growthRate)},
    abilities: [${JSON.stringify(e.abilities[0])}, ${JSON.stringify(e.abilities[1])}],
  },`).join('\n')}
};

/**
 * Get species info by ID
 */
export function getSpeciesInfo(speciesId: number): SpeciesInfo | null {
  return SPECIES_INFO[speciesId] ?? null;
}

/**
 * Get base stat total for a species
 */
export function getBaseStatTotal(speciesId: number): number {
  const info = SPECIES_INFO[speciesId];
  if (!info) return 0;
  return info.baseHP + info.baseAttack + info.baseDefense +
         info.baseSpeed + info.baseSpAttack + info.baseSpDefense;
}

/**
 * Get unique types for display (dedupes single-type Pokemon)
 * e.g., ["ELECTRIC", "ELECTRIC"] -> ["ELECTRIC"]
 *       ["GRASS", "POISON"] -> ["GRASS", "POISON"]
 */
export function getSpeciesTypes(speciesId: number): string[] {
  const info = SPECIES_INFO[speciesId];
  if (!info) return [];

  const [type1, type2] = info.types;
  if (type1 === type2) {
    return [type1];
  }
  return [type1, type2];
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nWrote ${OUTPUT_FILE}`);
}

generate();
