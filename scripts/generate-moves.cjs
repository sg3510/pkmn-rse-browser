#!/usr/bin/env node
/**
 * Generate Moves Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/moves.h (MOVE_* constants)
 *
 * Outputs:
 *   - src/data/moves.ts (move constants and names)
 *
 * Usage: node scripts/generate-moves.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOVES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/moves.h');
const OUTPUT_FILE = path.join(ROOT, 'src/data/moves.ts');

/**
 * Parse moves.h to extract MOVE_* constants
 * Format: #define MOVE_NAME 123
 */
function parseMoves(content) {
  const moves = [];
  const regex = /#define\s+(MOVE_\w+)\s+(\d+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const id = parseInt(match[2], 10);

    // Skip internal constants
    if (name === 'MOVES_COUNT' || name === 'MOVES_COUNT_GEN3') {
      continue;
    }

    moves.push({ id, key: name });
  }

  return moves.sort((a, b) => a.id - b.id);
}

/**
 * Convert MOVE_FIRE_PUNCH to "Fire Punch"
 */
function moveKeyToDisplayName(key) {
  return key
    .replace('MOVE_', '')
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function generate() {
  console.log('Generating moves data from pokeemerald source...\n');

  const content = fs.readFileSync(MOVES_FILE, 'utf8');
  const moves = parseMoves(content);

  console.log(`Parsed ${moves.length} moves`);

  const output = `/**
 * Moves Data
 *
 * Auto-generated from pokeemerald source:
 *   - public/pokeemerald/include/constants/moves.h
 *
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate:moves
 *
 * Generated: ${new Date().toISOString()}
 */

// Move ID constants
export const MOVES = {
${moves.map(m => `  ${m.key.replace('MOVE_', '')}: ${m.id},`).join('\n')}
} as const;

export type MoveId = typeof MOVES[keyof typeof MOVES];

// Total move count
export const MOVES_COUNT = ${moves.length};

// Move display names (index by move ID)
export const MOVE_NAMES: Record<number, string> = {
${moves.map(m => `  ${m.id}: ${JSON.stringify(moveKeyToDisplayName(m.key))},`).join('\n')}
};

/**
 * Get move display name
 */
export function getMoveName(moveId: number): string {
  return MOVE_NAMES[moveId] ?? '---';
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

generate();
