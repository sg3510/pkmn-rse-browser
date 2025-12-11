#!/usr/bin/env node
/**
 * Generate Abilities Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/abilities.h (ABILITY_* constants)
 *   - public/pokeemerald/src/data/text/abilities.h (descriptions)
 *
 * Outputs:
 *   - src/data/abilities.ts (ability constants, names, and descriptions)
 *
 * Usage: node scripts/generate-abilities.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ABILITIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/abilities.h');
const DESCRIPTIONS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/text/abilities.h');
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

/**
 * Parse abilities.h (text) to extract descriptions
 * Format: static const u8 sSpeedBoostDescription[] = _("...");
 * Returns: { "SpeedBoost": "description" }
 */
function parseAbilityDescriptions(content) {
  const descriptions = {};

  // Match pattern: s[AbilityName]Description[] = _("text");
  const regex = /static const u8 s(\w+)Description\[\]\s*=\s*_\("([^"]*)"\);/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const varName = match[1]; // e.g., "SpeedBoost"
    const description = match[2]
      .replace(/\\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    descriptions[varName] = description;
  }

  return descriptions;
}

function generate() {
  console.log('Generating abilities data from pokeemerald source...\n');

  const content = fs.readFileSync(ABILITIES_FILE, 'utf8');
  const abilities = parseAbilities(content);
  console.log(`Parsed ${abilities.length} abilities`);

  const descContent = fs.readFileSync(DESCRIPTIONS_FILE, 'utf8');
  const descData = parseAbilityDescriptions(descContent);
  console.log(`Parsed ${Object.keys(descData).length} ability descriptions`);

  // Add descriptions to abilities
  for (const ability of abilities) {
    // Convert ABILITY_SPEED_BOOST -> SpeedBoost
    const descKey = ability.key
      .replace('ABILITY_', '')
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join('');
    ability.description = descData[descKey] || '';
  }

  const output = `/**
 * Abilities Data
 *
 * Auto-generated from pokeemerald source:
 *   - public/pokeemerald/include/constants/abilities.h
 *   - public/pokeemerald/src/data/text/abilities.h
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

// Ability descriptions (index by ability ID)
export const ABILITY_DESCRIPTIONS: Record<number, string> = {
${abilities.map(a => `  ${a.id}: ${JSON.stringify(a.description)},`).join('\n')}
};

/**
 * Get ability display name
 */
export function getAbilityName(abilityId: number): string {
  return ABILITY_NAMES[abilityId] ?? '---';
}

/**
 * Get ability description
 */
export function getAbilityDescription(abilityId: number): string {
  return ABILITY_DESCRIPTIONS[abilityId] ?? '';
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

generate();
