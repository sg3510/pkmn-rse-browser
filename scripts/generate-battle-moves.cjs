#!/usr/bin/env node
/**
 * Generate Enhanced Battle Move Data from pokeemerald source
 *
 * Extends the existing moves.ts with battle-specific fields:
 *   effect, secondaryEffectChance, target, priority, flags
 *
 * Parses:
 *   - public/pokeemerald/src/data/battle_moves.h (gBattleMoves[] — full struct)
 *   - public/pokeemerald/include/constants/battle_move_effects.h (EFFECT_* IDs)
 *   - public/pokeemerald/include/constants/moves.h (MOVE_* IDs)
 *
 * Outputs:
 *   - src/data/battleMoves.gen.ts
 *
 * Usage: node scripts/generate-battle-moves.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BATTLE_MOVES_FILE = path.join(ROOT, 'public/pokeemerald/src/data/battle_moves.h');
const EFFECTS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/battle_move_effects.h');
const MOVES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/moves.h');
const OUT_FILE = path.join(ROOT, 'src/data/battleMoves.gen.ts');

// ---------------------------------------------------------------------------
// 1. Parse EFFECT_* constants
// ---------------------------------------------------------------------------
const effectsH = fs.readFileSync(EFFECTS_FILE, 'utf-8');
const effects = {};
const effectRe = /^#define\s+(EFFECT_\w+)\s+(\d+)/gm;
let match;
while ((match = effectRe.exec(effectsH)) !== null) {
  effects[match[1]] = parseInt(match[2], 10);
}
console.log(`Parsed ${Object.keys(effects).length} effect constants`);

// Build reverse map: id -> name
const effectNames = {};
for (const [name, id] of Object.entries(effects)) {
  effectNames[id] = name;
}

// ---------------------------------------------------------------------------
// 2. Parse MOVE_* IDs for resolving move names
// ---------------------------------------------------------------------------
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
// 3. Parse gBattleMoves[] structs
// ---------------------------------------------------------------------------
const battleH = fs.readFileSync(BATTLE_MOVES_FILE, 'utf-8');

// Type mapping
const TYPE_MAP = {
  TYPE_NORMAL: 'NORMAL', TYPE_FIGHTING: 'FIGHTING', TYPE_FLYING: 'FLYING',
  TYPE_POISON: 'POISON', TYPE_GROUND: 'GROUND', TYPE_ROCK: 'ROCK',
  TYPE_BUG: 'BUG', TYPE_GHOST: 'GHOST', TYPE_STEEL: 'STEEL',
  TYPE_MYSTERY: 'MYSTERY', TYPE_FIRE: 'FIRE', TYPE_WATER: 'WATER',
  TYPE_GRASS: 'GRASS', TYPE_ELECTRIC: 'ELECTRIC', TYPE_PSYCHIC: 'PSYCHIC',
  TYPE_ICE: 'ICE', TYPE_DRAGON: 'DRAGON', TYPE_DARK: 'DARK',
};

// Target mapping
const TARGET_MAP = {
  MOVE_TARGET_SELECTED: 'SELECTED',
  MOVE_TARGET_DEPENDS: 'DEPENDS',
  MOVE_TARGET_USER_OR_SELECTED: 'USER_OR_SELECTED',
  MOVE_TARGET_RANDOM: 'RANDOM',
  MOVE_TARGET_BOTH: 'BOTH',
  MOVE_TARGET_USER: 'USER',
  MOVE_TARGET_FOES_AND_ALLY: 'FOES_AND_ALLY',
  MOVE_TARGET_OPPONENTS_FIELD: 'OPPONENTS_FIELD',
};

// Flag definitions
const FLAG_DEFS = {
  FLAG_MAKES_CONTACT: 0x01,
  FLAG_PROTECT_AFFECTED: 0x02,
  FLAG_MAGIC_COAT_AFFECTED: 0x04,
  FLAG_SNATCH_AFFECTED: 0x08,
  FLAG_MIRROR_MOVE_AFFECTED: 0x10,
  FLAG_KINGS_ROCK_AFFECTED: 0x20,
};

// Split by [MOVE_...] blocks
const blocks = battleH.split(/\[MOVE_/);
const moveData = [];

for (const block of blocks) {
  const nameMatch = block.match(/^(\w+)\]\s*=/);
  if (!nameMatch) continue;

  const moveName = 'MOVE_' + nameMatch[1];
  const id = moveIds[moveName];
  if (id === undefined) continue;

  // Extract each field
  const effectMatch = block.match(/\.effect\s*=\s*(\w+)/);
  const powerMatch = block.match(/\.power\s*=\s*(\d+)/);
  const typeMatch = block.match(/\.type\s*=\s*(TYPE_\w+)/);
  const accMatch = block.match(/\.accuracy\s*=\s*(\d+)/);
  const ppMatch = block.match(/\.pp\s*=\s*(\d+)/);
  const secMatch = block.match(/\.secondaryEffectChance\s*=\s*(\d+)/);
  const targetMatch = block.match(/\.target\s*=\s*(MOVE_TARGET_\w+)/);
  const priorityMatch = block.match(/\.priority\s*=\s*(-?\d+)/);

  // Parse flags — combine all FLAG_* with |
  let flagsValue = 0;
  const flagsMatch = block.match(/\.flags\s*=\s*([^,}]+)/);
  if (flagsMatch) {
    const flagStr = flagsMatch[1].trim();
    for (const [flagName, flagBit] of Object.entries(FLAG_DEFS)) {
      if (flagStr.includes(flagName)) flagsValue |= flagBit;
    }
  }

  const effectName = effectMatch ? effectMatch[1] : 'EFFECT_HIT';
  const effectId = effects[effectName] !== undefined ? effects[effectName] : 0;

  moveData.push({
    id,
    name: moveName,
    effect: effectId,
    effectName,
    power: powerMatch ? parseInt(powerMatch[1], 10) : 0,
    type: typeMatch ? (TYPE_MAP[typeMatch[1]] || 'NORMAL') : 'NORMAL',
    accuracy: accMatch ? parseInt(accMatch[1], 10) : 0,
    pp: ppMatch ? parseInt(ppMatch[1], 10) : 0,
    secondaryEffectChance: secMatch ? parseInt(secMatch[1], 10) : 0,
    target: targetMatch ? (TARGET_MAP[targetMatch[1]] || 'SELECTED') : 'SELECTED',
    priority: priorityMatch ? parseInt(priorityMatch[1], 10) : 0,
    flags: flagsValue,
  });
}

moveData.sort((a, b) => a.id - b.id);
console.log(`Parsed ${moveData.length} battle move entries`);

// ---------------------------------------------------------------------------
// 4. Generate output
// ---------------------------------------------------------------------------
let out = '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/src/data/battle_moves.h\n';
out += '// Regenerate: node scripts/generate-battle-moves.cjs\n\n';

// Effect constants
out += '/** Move effect IDs from battle_move_effects.h */\n';
out += 'export const MOVE_EFFECTS = {\n';
for (const [name, id] of Object.entries(effects).sort((a, b) => a[1] - b[1])) {
  out += `  ${name}: ${id},\n`;
}
out += '} as const;\n\n';

// Effect name reverse map
out += '/** Reverse map: effect ID → name */\n';
out += 'export const EFFECT_NAMES: Record<number, string> = {\n';
for (const [id, name] of Object.entries(effectNames).sort((a, b) => Number(a) - Number(b))) {
  out += `  ${id}: '${name}',\n`;
}
out += '};\n\n';

// Flag constants
out += '/** Move flag bitmasks */\n';
out += 'export const MOVE_FLAGS = {\n';
for (const [name, bit] of Object.entries(FLAG_DEFS)) {
  out += `  ${name}: 0x${bit.toString(16).padStart(2, '0')},\n`;
}
out += '} as const;\n\n';

// Target constants
out += '/** Move target types */\n';
out += 'export const MOVE_TARGETS = {\n';
for (const [cName, tsName] of Object.entries(TARGET_MAP)) {
  out += `  ${tsName}: '${tsName}',\n`;
}
out += '} as const;\n\n';

// Data interface
out += 'export interface BattleMoveData {\n';
out += '  effect: number;\n';
out += '  power: number;\n';
out += '  type: string;\n';
out += '  accuracy: number;\n';
out += '  pp: number;\n';
out += '  secondaryEffectChance: number;\n';
out += '  target: string;\n';
out += '  priority: number;\n';
out += '  flags: number;\n';
out += '}\n\n';

// Main data table
out += '/** Full battle move data indexed by move ID. */\n';
out += 'export const BATTLE_MOVES: Record<number, BattleMoveData> = {\n';
for (const m of moveData) {
  out += `  ${m.id}: { effect: ${m.effect}, power: ${m.power}, type: '${m.type}', accuracy: ${m.accuracy}, pp: ${m.pp}, secondaryEffectChance: ${m.secondaryEffectChance}, target: '${m.target}', priority: ${m.priority}, flags: 0x${m.flags.toString(16).padStart(2, '0')} },\n`;
}
out += '};\n\n';

out += '/** Get battle move data by move ID. */\n';
out += 'export function getBattleMoveData(moveId: number): BattleMoveData | undefined {\n';
out += '  return BATTLE_MOVES[moveId];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf-8');
console.log(`\nWrote ${OUT_FILE}`);
