#!/usr/bin/env node
/**
 * Generate Item Battle Effects Data from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/src/data/items.h (item properties: battleUsage, holdEffect)
 *   - public/pokeemerald/include/constants/items.h (ITEM_* IDs)
 *   - public/pokeemerald/include/constants/hold_effects.h (HOLD_EFFECT_* constants)
 *
 * Outputs:
 *   - src/data/itemBattleEffects.gen.ts
 *
 * Usage: node scripts/generate-item-battle-effects.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ITEMS_DATA_FILE = path.join(ROOT, 'public/pokeemerald/src/data/items.h');
const ITEMS_CONST_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/items.h');
const HOLD_EFFECTS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/hold_effects.h');
const OUT_FILE = path.join(ROOT, 'src/data/itemBattleEffects.gen.ts');

// ---------------------------------------------------------------------------
// 1. Parse constants
// ---------------------------------------------------------------------------
function parseDefines(content, prefix) {
  const map = {};
  const re = new RegExp(`^#define\\s+(${prefix}\\w+)\\s+(\\d+)`, 'gm');
  let m;
  while ((m = re.exec(content)) !== null) {
    map[m[1]] = parseInt(m[2], 10);
  }
  return map;
}

const itemIds = parseDefines(fs.readFileSync(ITEMS_CONST_FILE, 'utf-8'), 'ITEM_');
console.log(`Parsed ${Object.keys(itemIds).length} item constants`);

const holdEffectsH = fs.readFileSync(HOLD_EFFECTS_FILE, 'utf-8');
const holdEffects = {};
const holdRe = /^#define\s+(HOLD_EFFECT_\w+)\s+(\d+)/gm;
let match;
while ((match = holdRe.exec(holdEffectsH)) !== null) {
  holdEffects[match[1]] = parseInt(match[2], 10);
}
console.log(`Parsed ${Object.keys(holdEffects).length} hold effect constants`);

// Build reverse map: id -> name
const holdEffectNames = {};
for (const [name, id] of Object.entries(holdEffects)) {
  holdEffectNames[id] = name;
}

// ---------------------------------------------------------------------------
// 2. Parse items.h for battle-relevant fields
// ---------------------------------------------------------------------------
const itemsH = fs.readFileSync(ITEMS_DATA_FILE, 'utf-8');

const items = [];
const itemBlocks = itemsH.split(/\[ITEM_/);

for (const block of itemBlocks) {
  const nameMatch = block.match(/^(\w+)\]\s*=/);
  if (!nameMatch) continue;

  const itemConst = 'ITEM_' + nameMatch[1];
  const id = itemIds[itemConst];
  if (id === undefined) continue;

  // holdEffect
  const holdEffectMatch = block.match(/\.holdEffect\s*=\s*(HOLD_EFFECT_\w+)/);
  const holdEffect = holdEffectMatch ? (holdEffects[holdEffectMatch[1]] || 0) : 0;
  const holdEffectName = holdEffectMatch ? holdEffectMatch[1] : '';

  // holdEffectParam
  const paramMatch = block.match(/\.holdEffectParam\s*=\s*(\d+)/);
  const holdEffectParam = paramMatch ? parseInt(paramMatch[1], 10) : 0;

  // battleUsage
  const battleUsageMatch = block.match(/\.battleUsage\s*=\s*(\d+)/);
  const battleUsage = battleUsageMatch ? parseInt(battleUsageMatch[1], 10) : 0;

  // pocket — useful for filtering
  const pocketMatch = block.match(/\.pocket\s*=\s*(\w+)/);
  const pocket = pocketMatch ? pocketMatch[1] : '';

  // Only include items with battle relevance (held effect or battle usage)
  if (holdEffect === 0 && battleUsage === 0) continue;

  items.push({
    id,
    constName: itemConst,
    holdEffect,
    holdEffectName,
    holdEffectParam,
    battleUsage,
    pocket,
  });
}

items.sort((a, b) => a.id - b.id);
console.log(`Found ${items.length} items with battle effects`);

// ---------------------------------------------------------------------------
// 3. Generate output
// ---------------------------------------------------------------------------
let out = '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/src/data/items.h + hold_effects.h\n';
out += '// Regenerate: node scripts/generate-item-battle-effects.cjs\n\n';

// Hold effect constants
out += '/** Hold effect constants from hold_effects.h */\n';
out += 'export const HOLD_EFFECTS = {\n';
for (const [name, id] of Object.entries(holdEffects).sort((a, b) => a[1] - b[1])) {
  out += `  ${name}: ${id},\n`;
}
out += '} as const;\n\n';

out += 'export interface ItemBattleEffect {\n';
out += '  holdEffect: number;\n';
out += '  holdEffectParam: number;\n';
out += '  battleUsage: number;\n';
out += '}\n\n';

out += '/** Items with battle effects, indexed by item ID. */\n';
out += 'export const ITEM_BATTLE_EFFECTS: Record<number, ItemBattleEffect> = {\n';
for (const item of items) {
  out += `  ${item.id}: { holdEffect: ${item.holdEffect}, holdEffectParam: ${item.holdEffectParam}, battleUsage: ${item.battleUsage} }, // ${item.constName}${item.holdEffectName ? ' — ' + item.holdEffectName : ''}\n`;
}
out += '};\n\n';

out += '/** Get battle effect data for an item. */\n';
out += 'export function getItemBattleEffect(itemId: number): ItemBattleEffect | undefined {\n';
out += '  return ITEM_BATTLE_EFFECTS[itemId];\n';
out += '}\n\n';

out += '/** Check if an item can be used in battle (e.g. Potion, Pokeball). */\n';
out += 'export function canUseInBattle(itemId: number): boolean {\n';
out += '  const effect = ITEM_BATTLE_EFFECTS[itemId];\n';
out += '  return effect !== undefined && effect.battleUsage > 0;\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf-8');
console.log(`\nWrote ${OUT_FILE}`);
