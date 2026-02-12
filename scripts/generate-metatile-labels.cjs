#!/usr/bin/env node
/**
 * Generate metatile label constants from pokeemerald header.
 *
 * Parses: public/pokeemerald/include/constants/metatile_labels.h
 * Outputs: src/data/metatileLabels.gen.ts
 *
 * Usage: node scripts/generate-metatile-labels.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'public/pokeemerald/include/constants/metatile_labels.h');
const OUTPUT = path.join(ROOT, 'src/data/metatileLabels.gen.ts');

function generate() {
  const content = fs.readFileSync(INPUT, 'utf8');
  const entries = [];

  for (const line of content.split('\n')) {
    const m = line.match(/^\s*#define\s+(METATILE_\w+)\s+(0x[0-9a-fA-F]+|\d+)/);
    if (m) {
      const name = m[1];
      const value = m[2].startsWith('0x') ? parseInt(m[2], 16) : parseInt(m[2], 10);
      entries.push({ name, value });
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const lines = [];
  lines.push('// Auto-generated from pokeemerald metatile_labels.h. DO NOT EDIT.');
  lines.push('// Regenerate with: npm run generate:metatile-labels');
  lines.push('');
  lines.push('export const METATILE_LABELS: Record<string, number> = {');
  for (const { name, value } of entries) {
    lines.push(`  '${name}': 0x${value.toString(16).toUpperCase()},`);
  }
  lines.push('};');
  lines.push('');

  fs.writeFileSync(OUTPUT, lines.join('\n'));
  console.log(`Generated ${entries.length} metatile labels → ${OUTPUT}`);
}

generate();
