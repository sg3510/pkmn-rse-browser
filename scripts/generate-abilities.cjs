#!/usr/bin/env node
/**
 * Generate Abilities Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/abilities.h (ABILITY_* constants)
 *
 * Outputs:
 *   - src/data/abilities.ts (ability constants and names)
 *
 * Usage: node scripts/generate-abilities.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ABILITIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/abilities.h');
const OUTPUT_FILE = path.join(ROOT, 'src/data/abilities.ts');

/**
 * Parse abilities.h to extract ABILITY_* constants
 * Format: #define ABILITY_NAME 123
 */
function parseAbilities(content) {
  const abilities = [];
  const regex = /#define\s+(ABILITY_\w+)\s+(\d+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const id = parseInt(match[2], 10);

    // Skip count constant
    if (name === 'ABILITIES_COUNT') {
      continue;
    }

    abilities.push({ id, key: name });
  }

  return abilities.sort((a, b) => a.id - b.id);
}

/**
 * Convert ABILITY_SPEED_BOOST to "Speed Boost"
 */
function abilityKeyToDisplayName(key) {
  return key
    .replace('ABILITY_', '')
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function generate() {
  console.log('Generating abilities data from pokeemerald source...\n');

  const content = fs.readFileSync(ABILITIES_FILE, 'utf8');
  const abilities = parseAbilities(content);

  console.log(`Parsed ${abilities.length} abilities`);

  const output = `/**
 * Abilities Data
 *
 * Auto-generated from pokeemerald source:
 *   - public/pokeemerald/include/constants/abilities.h
 *
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate:abilities
 *
 * Generated: ${new Date().toISOString()}
 */

// Ability ID constants
export const ABILITIES = {
${abilities.map(a => `  ${a.key.replace('ABILITY_', '')}: ${a.id},`).join('\n')}
} as const;

export type AbilityId = typeof ABILITIES[keyof typeof ABILITIES];

// Total ability count
export const ABILITIES_COUNT = ${abilities.length};

// Ability display names (index by ability ID)
export const ABILITY_NAMES: Record<number, string> = {
${abilities.map(a => `  ${a.id}: ${JSON.stringify(abilityKeyToDisplayName(a.key))},`).join('\n')}
};

/**
 * Get ability display name
 */
export function getAbilityName(abilityId: number): string {
  return ABILITY_NAMES[abilityId] ?? '---';
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

generate();
