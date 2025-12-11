#!/usr/bin/env node
/**
 * Generate Moves Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/include/constants/moves.h (MOVE_* constants)
 *   - public/pokeemerald/src/data/battle_moves.h (move power/type/accuracy/pp)
 *   - public/pokeemerald/src/data/text/move_descriptions.h (descriptions)
 *
 * Outputs:
 *   - src/data/moves.ts (move constants, names, battle info, and descriptions)
 *
 * Usage: node scripts/generate-moves.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOVES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/moves.h');
const BATTLE_MOVES_FILE = path.join(ROOT, 'public/pokeemerald/src/data/battle_moves.h');
const DESCRIPTIONS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/text/move_descriptions.h');
const OUTPUT_FILE = path.join(ROOT, 'src/data/moves.ts');

/**
 * Parse moves.h to extract MOVE_* constants
 * Format: #define MOVE_NAME 123
 */
function parseMoves(content) {
  const moves = [];
  // Match decimal numbers only (not hex like 0xFFFF)
  const regex = /#define\s+(MOVE_\w+)\s+(\d+)\s*$/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const id = parseInt(match[2], 10);

    // Skip internal constants
    if (name === 'MOVES_COUNT' || name === 'MOVES_COUNT_GEN3') {
      continue;
    }

    // Skip MOVE_UNAVAILABLE (0xFFFF would be parsed incorrectly)
    if (name === 'MOVE_UNAVAILABLE') {
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

// Type mapping from pokeemerald TYPE_* to our type strings
const TYPE_MAP = {
  TYPE_NORMAL: 'NORMAL',
  TYPE_FIGHTING: 'FIGHTING',
  TYPE_FLYING: 'FLYING',
  TYPE_POISON: 'POISON',
  TYPE_GROUND: 'GROUND',
  TYPE_ROCK: 'ROCK',
  TYPE_BUG: 'BUG',
  TYPE_GHOST: 'GHOST',
  TYPE_STEEL: 'STEEL',
  TYPE_FIRE: 'FIRE',
  TYPE_WATER: 'WATER',
  TYPE_GRASS: 'GRASS',
  TYPE_ELECTRIC: 'ELECTRIC',
  TYPE_PSYCHIC: 'PSYCHIC',
  TYPE_ICE: 'ICE',
  TYPE_DRAGON: 'DRAGON',
  TYPE_DARK: 'DARK',
  TYPE_MYSTERY: 'NORMAL', // ??? type fallback
};

/**
 * Parse move_descriptions.h to extract move descriptions
 * Format: static const u8 sPoundDescription[] = _("...");
 * Returns: { "Pound": "description text" }
 */
function parseMoveDescriptions(content) {
  const descriptions = {};

  // Match pattern: s[MoveName]Description[] = _("text");
  // The description may span multiple lines with \n concatenation
  const regex = /static const u8 s(\w+)Description\[\]\s*=\s*_\(\s*([\s\S]*?)\);/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const varName = match[1]; // e.g., "Pound", "KarateChop"
    const rawText = match[2];

    // Parse the description text - handle multi-line strings
    // Format: "line1\n" "line2" or just "single line"
    const textParts = rawText.match(/"([^"]*)"/g);
    if (textParts) {
      const description = textParts
        .map(part => part.slice(1, -1)) // Remove quotes
        .join(' ')
        .replace(/\\n/g, ' ')  // Replace \n with space
        .replace(/\s+/g, ' ')  // Collapse whitespace
        .trim();

      descriptions[varName] = description;
    }
  }

  return descriptions;
}

/**
 * Convert variable name to move key
 * e.g., "KarateChop" -> "KARATE_CHOP"
 */
function descNameToMoveKey(name) {
  // Insert underscore before capitals and convert to uppercase
  return 'MOVE_' + name
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, ''); // Remove leading underscore
}

/**
 * Parse battle_moves.h to extract move data
 * Returns: { [MOVE_NAME]: { power, type, accuracy, pp } }
 */
function parseBattleMoves(content) {
  const moveData = {};

  // Split into move blocks
  const blocks = content.split(/\[MOVE_/);

  for (const block of blocks) {
    const nameMatch = block.match(/^(\w+)\]\s*=/);
    if (!nameMatch) continue;

    const moveName = 'MOVE_' + nameMatch[1];

    // Extract .power = X
    const powerMatch = block.match(/\.power\s*=\s*(\d+)/);
    const power = powerMatch ? parseInt(powerMatch[1], 10) : 0;

    // Extract .type = TYPE_X
    const typeMatch = block.match(/\.type\s*=\s*(TYPE_\w+)/);
    const typeRaw = typeMatch ? typeMatch[1] : 'TYPE_NORMAL';
    const type = TYPE_MAP[typeRaw] || 'NORMAL';

    // Extract .accuracy = X
    const accMatch = block.match(/\.accuracy\s*=\s*(\d+)/);
    const accuracy = accMatch ? parseInt(accMatch[1], 10) : 0;

    // Extract .pp = X
    const ppMatch = block.match(/\.pp\s*=\s*(\d+)/);
    const pp = ppMatch ? parseInt(ppMatch[1], 10) : 0;

    moveData[moveName] = { power, type, accuracy, pp };
  }

  return moveData;
}

function generate() {
  console.log('Generating moves data from pokeemerald source...\n');

  const movesContent = fs.readFileSync(MOVES_FILE, 'utf8');
  const moves = parseMoves(movesContent);
  console.log(`Parsed ${moves.length} move constants`);

  const battleContent = fs.readFileSync(BATTLE_MOVES_FILE, 'utf8');
  const battleData = parseBattleMoves(battleContent);
  console.log(`Parsed ${Object.keys(battleData).length} move battle data entries`);

  const descContent = fs.readFileSync(DESCRIPTIONS_FILE, 'utf8');
  const descData = parseMoveDescriptions(descContent);
  console.log(`Parsed ${Object.keys(descData).length} move descriptions`);

  // Merge battle data and descriptions into moves
  for (const move of moves) {
    const data = battleData[move.key];
    if (data) {
      move.power = data.power;
      move.type = data.type;
      move.accuracy = data.accuracy;
      move.pp = data.pp;
    } else {
      move.power = 0;
      move.type = 'NORMAL';
      move.accuracy = 0;
      move.pp = 0;
    }

    // Match description by converting MOVE_FIRE_PUNCH -> FirePunch
    const descKey = move.key
      .replace('MOVE_', '')
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join('');
    move.description = descData[descKey] || '';
  }

  const output = `/**
 * Moves Data
 *
 * Auto-generated from pokeemerald source:
 *   - public/pokeemerald/include/constants/moves.h
 *   - public/pokeemerald/src/data/battle_moves.h
 *   - public/pokeemerald/src/data/text/move_descriptions.h
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

// Move descriptions (index by move ID)
export const MOVE_DESCRIPTIONS: Record<number, string> = {
${moves.map(m => `  ${m.id}: ${JSON.stringify(m.description)},`).join('\n')}
};

// Move battle info (power, type, accuracy, pp)
export interface MoveInfo {
  power: number;
  type: string;
  accuracy: number;
  pp: number;
  description: string;
}

export const MOVE_INFO: Record<number, MoveInfo> = {
${moves.map(m => `  ${m.id}: { power: ${m.power}, type: ${JSON.stringify(m.type)}, accuracy: ${m.accuracy}, pp: ${m.pp}, description: ${JSON.stringify(m.description)} },`).join('\n')}
};

/**
 * Get move display name
 */
export function getMoveName(moveId: number): string {
  return MOVE_NAMES[moveId] ?? '---';
}

/**
 * Get move description
 */
export function getMoveDescription(moveId: number): string {
  return MOVE_DESCRIPTIONS[moveId] ?? '';
}

/**
 * Get move battle info
 */
export function getMoveInfo(moveId: number): MoveInfo | null {
  return MOVE_INFO[moveId] ?? null;
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

generate();
