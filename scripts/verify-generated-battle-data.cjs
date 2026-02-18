#!/usr/bin/env node
/**
 * Verify battle-critical generated data is up-to-date.
 *
 * Strategy:
 * 1) Run required battle generators.
 * 2) Fail if tracked generated outputs changed.
 */

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const generators = [
  'scripts/generate-trainer-ids.cjs',
  'scripts/generate-trainer-parties.cjs',
  'scripts/generate-learnsets.cjs',
  'scripts/generate-battle-moves.cjs',
];

const generatedFiles = [
  'src/data/trainerIds.gen.ts',
  'src/data/trainerParties.gen.ts',
  'src/data/learnsets.gen.ts',
  'src/data/battleMoves.gen.ts',
];

for (const script of generators) {
  console.log(`[verify:generated:battle] running ${script}`);
  execFileSync('node', [script], { stdio: 'inherit' });
}

const diff = spawnSync('git', ['diff', '--name-only', '--', ...generatedFiles], {
  encoding: 'utf8',
});

if (diff.status !== 0) {
  console.error('[verify:generated:battle] Failed to check git diff for generated files.');
  process.exit(diff.status ?? 1);
}

const changed = diff.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (changed.length > 0) {
  console.error('[verify:generated:battle] Generated files are stale. Please regenerate and commit updates:');
  for (const file of changed) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log('[verify:generated:battle] OK (battle generated files are up-to-date)');
