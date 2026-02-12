#!/usr/bin/env node
/**
 * Generate multichoice menu data from pokeemerald C source.
 *
 * Parses:
 *   - include/constants/script_menu.h (MULTI_* IDs)
 *   - src/data/script_menu.h (MultichoiceList_* arrays + sMultichoiceLists table)
 *   - src/strings.c (gText_* string values)
 *
 * Outputs: src/data/multichoice.gen.ts
 *
 * Usage: node scripts/generate-multichoice.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POKE = path.join(ROOT, 'public/pokeemerald');
const OUTPUT = path.join(ROOT, 'src/data/multichoice.gen.ts');

function generate() {
  // Step 1: Parse MULTI_* constant IDs
  const constantsContent = fs.readFileSync(
    path.join(POKE, 'include/constants/script_menu.h'), 'utf8'
  );
  const multiIds = new Map(); // name → numeric value
  for (const line of constantsContent.split('\n')) {
    const m = line.match(/^\s*#define\s+(MULTI_\w+)\s+(\d+)/);
    if (m) {
      multiIds.set(m[1], parseInt(m[2], 10));
    }
  }

  // Step 2: Parse gText_* and gMenuText_* strings from strings.c
  const stringsContent = fs.readFileSync(
    path.join(POKE, 'src/strings.c'), 'utf8'
  );
  const textStrings = new Map(); // gText_Name → "TEXT"
  for (const line of stringsContent.split('\n')) {
    // Match: const u8 gText_Name[] = _("TEXT");
    const m = line.match(/const\s+u8\s+(g(?:Text|MenuText)_\w+)\[\]\s*=\s*_\("(.*)"\);/);
    if (m) {
      textStrings.set(m[1], m[2]);
    }
  }

  // Step 3: Parse MultichoiceList_* arrays from data/script_menu.h
  const dataContent = fs.readFileSync(
    path.join(POKE, 'src/data/script_menu.h'), 'utf8'
  );

  const multichoiceArrays = new Map(); // MultichoiceList_Name → string[]
  const arrayRegex = /static\s+const\s+struct\s+MenuAction\s+(\w+)\[\]\s*=\s*\{([^;]+)\};/gs;
  let match;
  while ((match = arrayRegex.exec(dataContent)) !== null) {
    const arrayName = match[1];
    const body = match[2];
    const items = [];
    // Extract {gText_Name} entries
    const itemRegex = /\{(g(?:Text|MenuText)_\w+)\}/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(body)) !== null) {
      const textRef = itemMatch[1];
      const text = textStrings.get(textRef);
      if (text !== undefined) {
        items.push(text);
      } else {
        // Fallback: use the ref name cleaned up
        items.push(textRef.replace(/^gText_/, '').replace(/^gMenuText_/, ''));
      }
    }
    multichoiceArrays.set(arrayName, items);
  }

  // Step 4: Parse sMultichoiceLists[] to map MULTI_* → MultichoiceList_*
  const listRegex = /\[(MULTI_\w+)\]\s*=\s*MULTICHOICE\((\w+)\)/g;
  const multichoiceLists = new Map(); // numeric ID → string[]
  while ((match = listRegex.exec(dataContent)) !== null) {
    const constName = match[1];
    const arrayName = match[2];
    const id = multiIds.get(constName);
    const items = multichoiceArrays.get(arrayName);
    if (id !== undefined && items) {
      multichoiceLists.set(id, items);
    }
  }

  // Step 5: Generate TS output
  const maxId = Math.max(...multichoiceLists.keys());
  const lines = [];
  lines.push('// Auto-generated from pokeemerald script_menu data. DO NOT EDIT.');
  lines.push('// Regenerate with: npm run generate:multichoice');
  lines.push('');
  lines.push('/**');
  lines.push(' * Multichoice menu items indexed by multichoice ID.');
  lines.push(' * C reference: public/pokeemerald/src/data/script_menu.h');
  lines.push(' */');
  lines.push('const MULTICHOICE_LISTS: (string[] | null)[] = [');

  for (let i = 0; i <= maxId; i++) {
    const items = multichoiceLists.get(i);
    if (items) {
      const itemsStr = items.map(s => JSON.stringify(s)).join(', ');
      lines.push(`  /* ${i} */ [${itemsStr}],`);
    } else {
      lines.push(`  /* ${i} */ null,`);
    }
  }
  lines.push('];');
  lines.push('');
  lines.push('/**');
  lines.push(' * Get the menu items for a multichoice ID.');
  lines.push(' * Returns null if the multichoice ID is unknown.');
  lines.push(' */');
  lines.push('export function getMultichoiceList(id: number): string[] | null {');
  lines.push('  if (id < 0 || id >= MULTICHOICE_LISTS.length) return null;');
  lines.push('  return MULTICHOICE_LISTS[id];');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(OUTPUT, lines.join('\n'));
  console.log(`Generated ${multichoiceLists.size} multichoice lists (max ID ${maxId}) → ${OUTPUT}`);
}

generate();
