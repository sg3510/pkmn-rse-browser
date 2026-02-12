#!/usr/bin/env node
/**
 * Generate Flag/Var ID → Name lookup tables from pokeemerald C headers
 *
 * Parses:
 *   - public/pokeemerald/include/constants/rematches.h (REMATCH_* enum)
 *   - public/pokeemerald/include/constants/opponents.h (MAX_TRAINERS_COUNT)
 *   - public/pokeemerald/include/constants/flags.h (FLAG_* defines)
 *   - public/pokeemerald/include/constants/vars.h (VAR_* defines)
 *
 * Outputs:
 *   - src/data/flagVarMaps.gen.ts (TypeScript module with ID→name lookup tables)
 *
 * Usage: node scripts/generate-flag-var-maps.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REMATCHES_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/rematches.h');
const OPPONENTS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/opponents.h');
const FLAGS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/flags.h');
const VARS_FILE = path.join(ROOT, 'public/pokeemerald/include/constants/vars.h');
const OUTPUT_FILE = path.join(ROOT, 'src/data/flagVarMaps.gen.ts');

/**
 * Parse rematches.h enum to get REMATCH_* values (0-based sequential)
 */
function parseRematchEnum(content) {
  const symbols = {};
  const enumMatch = content.match(/enum\s*\{([\s\S]*?)\}/);
  if (!enumMatch) return symbols;

  let value = 0;
  for (const line of enumMatch[1].split('\n')) {
    const trimmed = line.replace(/\/\/.*$/, '').trim().replace(/,\s*$/, '');
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Check for explicit assignment (none in this file, but handle it)
    const assignMatch = trimmed.match(/^(\w+)\s*=\s*(\d+)/);
    if (assignMatch) {
      value = parseInt(assignMatch[2], 10);
      symbols[assignMatch[1]] = value;
      value++;
    } else if (/^\w+$/.test(trimmed)) {
      symbols[trimmed] = value;
      value++;
    }
  }

  return symbols;
}

/**
 * Parse MAX_TRAINERS_COUNT from opponents.h
 */
function parseMaxTrainers(content) {
  const match = content.match(/#define\s+MAX_TRAINERS_COUNT\s+(\d+)/);
  return match ? parseInt(match[1], 10) : 864;
}

/**
 * Evaluate a simple C expression given a symbol table.
 * Handles: hex/decimal literals, symbol references, +, -, *, %, parentheses
 */
function evaluateExpression(expr, symbols) {
  // Replace all known symbols with their numeric values (longest-first to avoid partial matches)
  let resolved = expr.trim();
  const sortedSymbols = Object.keys(symbols).sort((a, b) => b.length - a.length);

  for (const sym of sortedSymbols) {
    // Use word boundary to avoid partial replacements
    const re = new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    resolved = resolved.replace(re, String(symbols[sym]));
  }

  // Remove any remaining parentheses and whitespace, check if it's purely numeric/arithmetic
  const simplified = resolved.replace(/\s+/g, '');

  // Verify it only contains digits, hex, arithmetic operators, and parens
  if (!/^[0-9a-fA-Fx+\-*%()]+$/.test(simplified)) {
    return null; // Unresolvable
  }

  try {
    // Safe eval: only arithmetic on numbers
    const result = Function(`"use strict"; return (${simplified})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
  } catch {
    // Expression evaluation failed
  }
  return null;
}

/**
 * Parse #define lines from a header file.
 * Returns array of { name, value } where value is the resolved numeric ID.
 */
function parseDefines(content, symbols) {
  const results = [];
  const defineRegex = /^#define\s+(\w+)\s+(.+)$/gm;
  let match;

  while ((match = defineRegex.exec(content)) !== null) {
    const name = match[1];
    let valueExpr = match[2].replace(/\/\/.*$/, '').trim(); // Strip comments

    // Try to resolve the expression
    const value = evaluateExpression(valueExpr, symbols);
    if (value !== null) {
      symbols[name] = value;
      results.push({ name, value });
    }
  }

  return results;
}

/**
 * Filter flags: keep meaningful named flags, skip temp/unused/meta
 */
function filterFlags(defines) {
  return defines.filter(({ name }) => {
    // Skip temp flags
    if (name.startsWith('FLAG_TEMP_') || name === 'TEMP_FLAGS_START' || name === 'TEMP_FLAGS_END') return false;
    // Skip unused flags
    if (name.startsWith('FLAG_UNUSED_')) return false;
    // Skip meta-defines (ranges, counts, starts, ends)
    if (name === 'NUM_TEMP_FLAGS') return false;
    if (name === 'NUM_BADGES') return false;
    if (name === 'NUM_WONDER_CARD_FLAGS') return false;
    if (name === 'TEMP_FLAGS_START' || name === 'TEMP_FLAGS_END') return false;
    if (name === 'TRAINER_FLAGS_START' || name === 'TRAINER_FLAGS_END') return false;
    if (name === 'TRAINER_REGISTERED_FLAGS_START') return false;
    if (name === 'SYSTEM_FLAGS') return false;
    if (name === 'FLAG_HIDDEN_ITEMS_START') return false;
    // Only keep FLAG_* names
    if (!name.startsWith('FLAG_')) return false;
    return true;
  });
}

/**
 * Filter vars: keep meaningful named vars, skip temp/unused/special/meta
 */
function filterVars(defines) {
  return defines.filter(({ name, value }) => {
    // Skip temp vars
    if (name.startsWith('VAR_TEMP_')) return false;
    if (name === 'TEMP_VARS_START' || name === 'TEMP_VARS_END') return false;
    // Skip unused vars
    if (name.startsWith('VAR_UNUSED_')) return false;
    // Skip meta-defines
    if (name === 'NUM_TEMP_VARS') return false;
    if (name === 'VARS_START' || name === 'VARS_END' || name === 'VARS_COUNT') return false;
    if (name === 'SPECIAL_VARS_START' || name === 'SPECIAL_VARS_END') return false;
    if (name === 'TRIGGER_RUN_IMMEDIATELY') return false;
    // Skip OBJ_GFX_ID vars (runtime sprite vars, not save-relevant)
    if (name.startsWith('VAR_OBJ_GFX_ID_')) return false;
    // Skip special vars (0x8000+) - these are runtime-only
    if (value >= 0x8000) return false;
    // Only keep VAR_* names
    if (!name.startsWith('VAR_')) return false;
    return true;
  });
}

// ============ Main ============

function main() {
  console.log('[generate-flag-var-maps] Starting...');

  // Step 1: Build symbol table from rematches enum
  const rematchContent = fs.readFileSync(REMATCHES_FILE, 'utf-8');
  const symbols = parseRematchEnum(rematchContent);
  console.log(`  Parsed ${Object.keys(symbols).length} rematch enum values`);

  // Step 2: Add MAX_TRAINERS_COUNT from opponents.h
  const opponentsContent = fs.readFileSync(OPPONENTS_FILE, 'utf-8');
  symbols.MAX_TRAINERS_COUNT = parseMaxTrainers(opponentsContent);
  console.log(`  MAX_TRAINERS_COUNT = ${symbols.MAX_TRAINERS_COUNT}`);

  // Step 3: Parse flags.h
  const flagsContent = fs.readFileSync(FLAGS_FILE, 'utf-8');
  const allFlagDefines = parseDefines(flagsContent, symbols);
  const flags = filterFlags(allFlagDefines);
  console.log(`  Parsed ${allFlagDefines.length} total flag defines, ${flags.length} after filtering`);

  // Step 4: Parse vars.h (symbols table already has flags context)
  const varsContent = fs.readFileSync(VARS_FILE, 'utf-8');
  const allVarDefines = parseDefines(varsContent, symbols);
  const vars = filterVars(allVarDefines);
  console.log(`  Parsed ${allVarDefines.length} total var defines, ${vars.length} after filtering`);

  // Step 5: Generate output
  // Sort by numeric value for readability
  flags.sort((a, b) => a.value - b.value);
  vars.sort((a, b) => a.value - b.value);

  const flagEntries = flags.map(f =>
    `  0x${f.value.toString(16).toUpperCase()}: '${f.name}',`
  ).join('\n');

  const varEntries = vars.map(v =>
    `  0x${v.value.toString(16).toUpperCase()}: '${v.name}',`
  ).join('\n');

  const output = `/**
 * AUTO-GENERATED — DO NOT EDIT
 * Generated by: scripts/generate-flag-var-maps.cjs
 *
 * Flag and Variable ID → name lookup tables parsed from pokeemerald C headers.
 * Used by Gen3SaveParser to convert binary flag/var data to named strings.
 */

/** Map of numeric flag ID → flag name string (${flags.length} entries) */
export const FLAG_ID_TO_NAME: Record<number, string> = {
${flagEntries}
};

/** Map of numeric var ID → var name string (${vars.length} entries) */
export const VAR_ID_TO_NAME: Record<number, string> = {
${varEntries}
};
`;

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`[generate-flag-var-maps] Generated ${OUTPUT_FILE}`);
  console.log(`  ${flags.length} flag entries, ${vars.length} var entries`);
}

main();
