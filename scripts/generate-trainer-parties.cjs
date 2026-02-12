#!/usr/bin/env node
/**
 * Generate Trainer Party Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/src/data/trainers.h (gTrainers[] — class, name, AI, items, party ref)
 *   - public/pokeemerald/src/data/trainer_parties.h (4 struct variants for party Pokemon)
 *   - public/pokeemerald/include/constants/trainers.h (TRAINER_* IDs)
 *   - public/pokeemerald/include/constants/moves.h (MOVE_* IDs)
 *   - public/pokeemerald/include/constants/species.h (SPECIES_* IDs)
 *   - public/pokeemerald/include/constants/items.h (ITEM_* IDs)
 *
 * Outputs:
 *   - src/data/trainerParties.gen.ts
 *
 * Usage: node scripts/generate-trainer-parties.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRAINERS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/trainers.h');
const PARTIES_FILE = path.join(ROOT, 'public/pokeemerald/src/data/trainer_parties.h');
const TRAINER_IDS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/opponents.h');
const TRAINER_CONSTS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/trainers.h');
const SPECIES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/species.h');
const MOVES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/moves.h');
const ITEMS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/items.h');
const OUT_FILE = path.join(ROOT, 'src/data/trainerParties.gen.ts');

// ---------------------------------------------------------------------------
// Helper: parse #define NAME NUMBER from a file
// ---------------------------------------------------------------------------
function parseDefines(content, prefix) {
  const map = {};
  const re = new RegExp(`^#define\\s+(${prefix}\\w+)\\s+(\\d+)\\s*$`, 'gm');
  let m;
  while ((m = re.exec(content)) !== null) {
    map[m[1]] = parseInt(m[2], 10);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 1. Parse all constants
// ---------------------------------------------------------------------------
const speciesIds = parseDefines(fs.readFileSync(SPECIES_FILE, 'utf-8'), 'SPECIES_');
const moveIds = parseDefines(fs.readFileSync(MOVES_FILE, 'utf-8'), 'MOVE_');
const itemIds = parseDefines(fs.readFileSync(ITEMS_FILE, 'utf-8'), 'ITEM_');
const trainerIds = parseDefines(fs.readFileSync(TRAINER_IDS_FILE, 'utf-8'), 'TRAINER_');

// Parse AI_SCRIPT_* flags from battle_ai.h
const AI_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/battle_ai.h');
const aiH = fs.readFileSync(AI_FILE, 'utf-8');
const aiFlags = {};
const aiFlagRe = /^#define\s+(AI_SCRIPT_\w+)\s+\(1\s*<<\s*(\d+)\)/gm;
let match;
while ((match = aiFlagRe.exec(aiH)) !== null) {
  aiFlags[match[1]] = 1 << parseInt(match[2], 10);
}

console.log(`Parsed ${Object.keys(speciesIds).length} species, ${Object.keys(moveIds).length} moves, ${Object.keys(itemIds).length} items, ${Object.keys(trainerIds).length} trainer IDs`);

// Resolve a constant name to its numeric value
function resolveConst(name, maps) {
  for (const map of maps) {
    if (map[name] !== undefined) return map[name];
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 2. Parse trainer_parties.h — all 4 struct variants
// ---------------------------------------------------------------------------
const partiesH = fs.readFileSync(PARTIES_FILE, 'utf-8');

// Parse all party arrays into a map: varName -> [{ species, level, iv, heldItem?, moves? }]
const partyMap = {};

// Match each array block
const partyArrayRe = /static\s+const\s+struct\s+TrainerMon(\w+)\s+(s\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g;
while ((match = partyArrayRe.exec(partiesH)) !== null) {
  const structType = match[1]; // NoItemDefaultMoves, NoItemCustomMoves, ItemDefaultMoves, ItemCustomMoves
  const varName = match[2];
  const body = match[3];

  const hasItem = structType.includes('Item') && !structType.startsWith('NoItem');
  const hasMoves = structType.includes('CustomMoves');

  const mons = [];

  // Split into individual mon blocks by .iv or .lvl (each mon starts with { and has these fields)
  const monBlocks = body.split(/\}\s*,?\s*\{/).map(s => s.replace(/^\s*\{/, '').replace(/\}\s*$/, ''));

  for (const block of monBlocks) {
    if (!block.trim()) continue;

    const ivMatch = block.match(/\.iv\s*=\s*(\d+)/);
    const lvlMatch = block.match(/\.lvl\s*=\s*(\d+)/);
    const specMatch = block.match(/\.species\s*=\s*(SPECIES_\w+)/);

    if (!lvlMatch || !specMatch) continue;

    const mon = {
      species: resolveConst(specMatch[1], [speciesIds]),
      level: parseInt(lvlMatch[1], 10),
      iv: ivMatch ? parseInt(ivMatch[1], 10) : 0,
    };

    if (hasItem) {
      const itemMatch = block.match(/\.heldItem\s*=\s*(ITEM_\w+)/);
      mon.heldItem = itemMatch ? resolveConst(itemMatch[1], [itemIds]) : 0;
    }

    if (hasMoves) {
      const movesMatch = block.match(/\.moves\s*=\s*\{([^}]+)\}/);
      if (movesMatch) {
        const moveTokens = movesMatch[1].match(/MOVE_\w+/g) || [];
        mon.moves = moveTokens.map(m => resolveConst(m, [moveIds])).filter(id => id !== 0);
      }
    }

    mons.push(mon);
  }

  if (mons.length > 0) {
    partyMap[varName] = mons;
  }
}
console.log(`Parsed ${Object.keys(partyMap).length} party arrays`);

// ---------------------------------------------------------------------------
// 3. Parse trainers.h — gTrainers[]
// ---------------------------------------------------------------------------
const trainersH = fs.readFileSync(TRAINERS_FILE, 'utf-8');

// Parse trainer name text
function parseText(str) {
  const m = str.match(/_\("([^"]*)"\)/);
  return m ? m[1] : '';
}

const trainers = [];
const trainerBlocks = trainersH.split(/\[TRAINER_/);

for (const block of trainerBlocks) {
  const nameMatch = block.match(/^(\w+)\]\s*=/);
  if (!nameMatch) continue;

  const trainerConst = 'TRAINER_' + nameMatch[1];
  const id = trainerIds[trainerConst];
  if (id === undefined) continue;

  const classMatch = block.match(/\.trainerClass\s*=\s*(TRAINER_CLASS_\w+)/);
  const nameTextMatch = block.match(/\.trainerName\s*=\s*(_\("[^"]*"\))/);
  const doubleBattleMatch = block.match(/\.doubleBattle\s*=\s*(\w+)/);
  const picMatch = block.match(/\.trainerPic\s*=\s*(TRAINER_PIC_\w+)/);

  // Parse AI flags
  const aiFlagsMatch = block.match(/\.aiFlags\s*=\s*([^,}]+)/);
  let aiFlagValue = 0;
  if (aiFlagsMatch) {
    const flagStr = aiFlagsMatch[1].trim();
    for (const [flagName, flagBit] of Object.entries(aiFlags)) {
      if (flagStr.includes(flagName)) aiFlagValue |= flagBit;
    }
  }

  // Parse items array
  const itemsMatch = block.match(/\.items\s*=\s*\{([^}]*)\}/);
  const items = [];
  if (itemsMatch) {
    const itemTokens = itemsMatch[1].match(/ITEM_\w+/g) || [];
    for (const it of itemTokens) {
      const itemId = resolveConst(it, [itemIds]);
      if (itemId > 0) items.push(itemId);
    }
  }

  // Parse party reference — one of the 4 macros
  const partyMacroRe = /\.party\s*=\s*(?:NO_ITEM_DEFAULT_MOVES|NO_ITEM_CUSTOM_MOVES|ITEM_DEFAULT_MOVES|ITEM_CUSTOM_MOVES)\((s\w+)\)/;
  const partyMatch = block.match(partyMacroRe);

  // Also handle raw assignment: .party = {.NoItemDefaultMoves = sParty_X}
  const partyRawRe = /\.party\s*=\s*\{\s*\.\w+\s*=\s*(s\w+)\s*\}/;
  const partyRawMatch = block.match(partyRawRe);

  const partyVarName = partyMatch ? partyMatch[1] : (partyRawMatch ? partyRawMatch[1] : null);
  const party = partyVarName ? (partyMap[partyVarName] || []) : [];

  trainers.push({
    id,
    constName: trainerConst,
    trainerClass: classMatch ? classMatch[1] : 'TRAINER_CLASS_PKMN_TRAINER_1',
    name: nameTextMatch ? parseText(nameTextMatch[1]) : '',
    doubleBattle: doubleBattleMatch ? doubleBattleMatch[1] === 'TRUE' : false,
    aiFlags: aiFlagValue,
    items,
    trainerPic: picMatch ? picMatch[1] : '',
    party,
  });
}

trainers.sort((a, b) => a.id - b.id);
console.log(`Parsed ${trainers.length} trainers`);

// ---------------------------------------------------------------------------
// 4. Generate output
// ---------------------------------------------------------------------------
let out = '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/src/data/trainers.h + trainer_parties.h\n';
out += '// Regenerate: node scripts/generate-trainer-parties.cjs\n\n';

out += 'export interface TrainerMon {\n';
out += '  species: number;\n';
out += '  level: number;\n';
out += '  iv: number;\n';
out += '  heldItem?: number;\n';
out += '  moves?: number[];\n';
out += '}\n\n';

out += 'export interface TrainerData {\n';
out += '  id: number;\n';
out += '  constName: string;\n';
out += '  trainerClass: string;\n';
out += '  name: string;\n';
out += '  doubleBattle: boolean;\n';
out += '  aiFlags: number;\n';
out += '  items: number[];\n';
out += '  trainerPic: string;\n';
out += '  party: TrainerMon[];\n';
out += '}\n\n';

out += '/** All trainer data indexed by trainer ID. */\n';
out += 'export const TRAINERS: Record<number, TrainerData> = {\n';
for (const t of trainers) {
  const partyStr = t.party.map(m => {
    let s = `{ species: ${m.species}, level: ${m.level}, iv: ${m.iv}`;
    if (m.heldItem !== undefined) s += `, heldItem: ${m.heldItem}`;
    if (m.moves && m.moves.length > 0) s += `, moves: [${m.moves.join(', ')}]`;
    s += ' }';
    return s;
  }).join(', ');

  const itemsStr = t.items.length > 0 ? `[${t.items.join(', ')}]` : '[]';

  out += `  ${t.id}: { id: ${t.id}, constName: '${t.constName}', trainerClass: '${t.trainerClass}', name: ${JSON.stringify(t.name)}, doubleBattle: ${t.doubleBattle}, aiFlags: ${t.aiFlags}, items: ${itemsStr}, trainerPic: '${t.trainerPic}', party: [${partyStr}] },\n`;
}
out += '};\n\n';

out += '/** Get trainer data by trainer ID. */\n';
out += 'export function getTrainerData(trainerId: number): TrainerData | undefined {\n';
out += '  return TRAINERS[trainerId];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf-8');
console.log(`\nWrote ${OUT_FILE}`);
