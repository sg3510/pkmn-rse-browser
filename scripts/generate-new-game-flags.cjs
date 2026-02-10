/**
 * Generate new-game flags from pokeemerald source.
 *
 * Parses `data/scripts/new_game.inc` → `src/data/newGameFlags.gen.ts`
 * containing the array of FLAG_HIDE_* flags that must be set when starting
 * a new game (EventScript_ResetAllMapFlags).
 *
 * Usage: node scripts/generate-new-game-flags.cjs
 */

const fs = require('fs');
const path = require('path');

const SRC_FILE = path.join(
  __dirname,
  '../public/pokeemerald/data/scripts/new_game.inc'
);
const OUT_FILE = path.join(__dirname, '../src/data/newGameFlags.gen.ts');

const src = fs.readFileSync(SRC_FILE, 'utf-8');

// Extract all setflag lines inside EventScript_ResetAllMapFlags
const flags = [];
let inSection = false;

for (const line of src.split('\n')) {
  const trimmed = line.trim();

  if (trimmed === 'EventScript_ResetAllMapFlags::') {
    inSection = true;
    continue;
  }

  if (!inSection) continue;

  // End of section: `call`, `end`, `return`, or next label
  if (
    trimmed.startsWith('call ') ||
    trimmed === 'end' ||
    trimmed === 'return' ||
    (trimmed.endsWith('::') && !trimmed.startsWith('@'))
  ) {
    break;
  }

  // Match `setflag FLAG_*`
  const match = trimmed.match(/^setflag\s+(FLAG_\S+)/);
  if (match) {
    flags.push(match[1]);
  }
}

const output = `// Auto-generated from pokeemerald source. DO NOT EDIT.
// Source: public/pokeemerald/data/scripts/new_game.inc (EventScript_ResetAllMapFlags)
// Regenerate with: npm run generate:new-game-flags
export const NEW_GAME_FLAGS: readonly string[] = [
${flags.map((f) => `  '${f}',`).join('\n')}
];
`;

fs.writeFileSync(OUT_FILE, output, 'utf-8');
console.log(`Generated ${flags.length} flags → ${path.relative(process.cwd(), OUT_FILE)}`);
