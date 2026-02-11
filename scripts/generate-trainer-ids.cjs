#!/usr/bin/env node
/**
 * Generate Trainer ID mapping from pokeemerald opponents.h
 *
 * Parses:
 *   public/pokeemerald/include/constants/opponents.h
 *
 * Outputs:
 *   src/data/trainerIds.gen.ts
 *
 * Usage: node scripts/generate-trainer-ids.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'public/pokeemerald/include/constants/opponents.h');
const OUTPUT = path.join(ROOT, 'src/data/trainerIds.gen.ts');

function main() {
  const src = fs.readFileSync(INPUT, 'utf-8');
  const entries = [];

  for (const line of src.split('\n')) {
    const m = line.match(/^#define\s+(TRAINER_\w+)\s+(\d+)/);
    if (m) {
      const name = m[1];
      const id = parseInt(m[2], 10);
      if (name !== 'TRAINER_NONE') {
        entries.push({ name, id });
      }
    }
  }

  entries.sort((a, b) => a.id - b.id);

  const lines = [
    '// Auto-generated from public/pokeemerald/include/constants/opponents.h',
    '// Do not edit manually. Run: npm run generate:trainers',
    '',
    'export const TRAINER_IDS: Record<string, number> = {',
  ];

  for (const { name, id } of entries) {
    lines.push(`  ${name}: ${id},`);
  }

  lines.push('};');
  lines.push('');

  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf-8');
  console.log(`Generated ${OUTPUT} with ${entries.length} trainer IDs.`);
}

main();
