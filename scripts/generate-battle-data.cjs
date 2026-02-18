#!/usr/bin/env node
/**
 * Run battle-data generators as one scalable mass-import pass.
 *
 * Usage:
 *   node scripts/generate-battle-data.cjs
 *   node scripts/generate-battle-data.cjs --list
 *   node scripts/generate-battle-data.cjs --only trainer-ids,learnsets
 *   node scripts/generate-battle-data.cjs --skip battle-scripts
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { BATTLE_DATA_GENERATORS, BATTLE_DATA_GENERATOR_IDS } = require('./battle-data-manifest.cjs');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseArgs(argv) {
  const args = {
    list: false,
    help: false,
    only: [],
    skip: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') {
      args.list = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--only' && i + 1 < argv.length) {
      args.only = parseCsv(argv[i + 1]);
      i++;
      continue;
    }
    if (arg === '--skip' && i + 1 < argv.length) {
      args.skip = parseCsv(argv[i + 1]);
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printUsage() {
  console.log('Usage: node scripts/generate-battle-data.cjs [--list] [--only ids] [--skip ids]');
  console.log('Example: node scripts/generate-battle-data.cjs --only trainer-ids,learnsets');
}

function assertKnownIds(ids, argName) {
  const known = new Set(BATTLE_DATA_GENERATOR_IDS);
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown ${argName} generator id(s): ${unknown.join(', ')}.\nKnown ids: ${BATTLE_DATA_GENERATOR_IDS.join(', ')}`,
    );
  }
}

function runGenerator(entry, index, total) {
  console.log(`[generate:battle-data] [${index + 1}/${total}] ${entry.id} (${entry.description})`);
  execFileSync('node', [entry.script], { stdio: 'inherit' });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (args.list) {
    console.log('[generate:battle-data] Available generator IDs:');
    for (const entry of BATTLE_DATA_GENERATORS) {
      console.log(`- ${entry.id}: ${entry.script}`);
      console.log(`  outputs: ${entry.outputs.join(', ')}`);
    }
    return;
  }

  assertKnownIds(args.only, '--only');
  assertKnownIds(args.skip, '--skip');

  const onlySet = new Set(args.only);
  const skipSet = new Set(args.skip);

  const selected = BATTLE_DATA_GENERATORS.filter((entry) => {
    if (onlySet.size > 0 && !onlySet.has(entry.id)) return false;
    if (skipSet.has(entry.id)) return false;
    return true;
  });

  if (selected.length === 0) {
    throw new Error('No battle-data generators selected.');
  }

  console.log(`[generate:battle-data] Running ${selected.length} generator(s)`);
  selected.forEach((entry, index) => runGenerator(entry, index, selected.length));
  console.log('[generate:battle-data] Complete');
}

try {
  main();
} catch (error) {
  console.error('[generate:battle-data] Failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

