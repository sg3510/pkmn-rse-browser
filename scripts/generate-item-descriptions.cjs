#!/usr/bin/env node
/**
 * Generate Item Descriptions from pokeemerald source
 *
 * Parses:
 *   - public/pokeemerald/src/data/text/item_descriptions.h (description strings)
 *   - public/pokeemerald/src/data/items.h (item ID to description mapping)
 *   - public/pokeemerald/include/constants/items.h (ITEM_* constants)
 *
 * Outputs:
 *   - src/data/itemDescriptions.ts (TypeScript module with descriptions)
 *
 * Usage: node scripts/generate-item-descriptions.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DESCRIPTIONS_FILE = path.join(ROOT, 'public/pokeemerald/src/data/text/item_descriptions.h');
const ITEMS_DATA_FILE = path.join(ROOT, 'public/pokeemerald/src/data/items.h');
const ITEMS_CONSTANTS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/items.h');
const OUTPUT_FILE = path.join(ROOT, 'src/data/itemDescriptions.ts');

/**
 * Parse item_descriptions.h to extract description variable names and text
 * Format: static const u8 sVarName[] = _("line1\n" "line2\n" "line3");
 */
function parseDescriptions(content) {
  const descriptions = new Map();

  // Match multi-line description definitions
  // Pattern: static const u8 sName[] = _( followed by quoted strings, ending with );
  const regex = /static const u8 (s\w+Desc)\[\] = _\(\s*([\s\S]*?)\);/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const varName = match[1];
    const rawText = match[2];

    // Extract quoted strings and join them
    const stringParts = [];
    const stringRegex = /"([^"]*)"/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(rawText)) !== null) {
      stringParts.push(stringMatch[1]);
    }

    // Join parts and clean up
    let text = stringParts.join('')
      .replace(/\\n/g, ' ')  // Replace newlines with spaces
      .replace(/\{POKEBLOCK\}/g, 'POKéBLOCK')  // Replace game macros
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    descriptions.set(varName, text);
  }

  return descriptions;
}

/**
 * Parse items.h constants file to get ITEM_* to numeric ID mapping
 */
function parseItemConstants(content) {
  const constants = new Map();

  // Match #define ITEM_NAME value or ITEM_NAME = value in enum
  // Handle both formats:
  // #define ITEM_NONE 0
  // [ITEM_NONE] = {...}
  const defineRegex = /#define\s+(ITEM_\w+)\s+(\d+)/g;
  let match;

  while ((match = defineRegex.exec(content)) !== null) {
    constants.set(match[1], parseInt(match[2], 10));
  }

  return constants;
}

/**
 * Parse items.h data file to get ITEM_* to description variable mapping
 * Format: [ITEM_NAME] = { ... .description = sDescVarName, ... }
 */
function parseItemDescriptionMapping(content) {
  const mapping = new Map();

  // Match item entries with their description references
  const entryRegex = /\[(ITEM_\w+)\]\s*=\s*\{[^}]*\.description\s*=\s*(s\w+Desc)/g;
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    mapping.set(match[1], match[2]);
  }

  return mapping;
}

/**
 * Main generation function
 */
function generate() {
  console.log('Generating item descriptions from pokeemerald source...\n');

  // Read source files
  const descriptionsContent = fs.readFileSync(DESCRIPTIONS_FILE, 'utf8');
  const itemsDataContent = fs.readFileSync(ITEMS_DATA_FILE, 'utf8');
  const itemsConstantsContent = fs.readFileSync(ITEMS_CONSTANTS_FILE, 'utf8');

  // Parse everything
  const descriptions = parseDescriptions(descriptionsContent);
  console.log(`Parsed ${descriptions.size} description strings`);

  const itemConstants = parseItemConstants(itemsConstantsContent);
  console.log(`Parsed ${itemConstants.size} item constants`);

  const itemToDesc = parseItemDescriptionMapping(itemsDataContent);
  console.log(`Parsed ${itemToDesc.size} item->description mappings`);

  // Build the final mapping: item ID -> description text
  const result = new Map();
  let matched = 0;
  let missing = 0;

  for (const [itemName, descVar] of itemToDesc) {
    const itemId = itemConstants.get(itemName);
    const descText = descriptions.get(descVar);

    if (itemId !== undefined && descText) {
      result.set(itemId, descText);
      matched++;
    } else {
      if (itemId === undefined) {
        console.warn(`  Missing constant for: ${itemName}`);
      }
      if (!descText) {
        console.warn(`  Missing description for: ${descVar}`);
      }
      missing++;
    }
  }

  console.log(`\nMatched ${matched} items with descriptions`);
  if (missing > 0) {
    console.log(`Could not match ${missing} items`);
  }

  // Sort by item ID
  const sortedEntries = [...result.entries()].sort((a, b) => a[0] - b[0]);

  // Generate TypeScript output
  const output = `/**
 * Item Descriptions
 *
 * Auto-generated from pokeemerald source files:
 *   - public/pokeemerald/src/data/text/item_descriptions.h
 *   - public/pokeemerald/src/data/items.h
 *
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate:items
 *
 * Generated: ${new Date().toISOString()}
 */

export const ITEM_DESCRIPTIONS: Record<number, string> = {
${sortedEntries.map(([id, desc]) => `  ${id}: ${JSON.stringify(desc)},`).join('\n')}
};

/**
 * Get description for an item ID
 */
export function getItemDescription(itemId: number): string {
  return ITEM_DESCRIPTIONS[itemId] ?? 'No description available.';
}
`;

  // Write output
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nWrote ${OUTPUT_FILE}`);
  console.log(`Total items: ${sortedEntries.length}`);
}

// Run
generate();
