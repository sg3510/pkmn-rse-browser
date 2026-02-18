#!/usr/bin/env node
/**
 * Report battle move-effect implementation coverage.
 *
 * Uses the runtime move-effect handler registry plus generated move/effect data.
 */

const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

async function importModule(relPath) {
  const url = pathToFileURL(path.join(ROOT, relPath)).href;
  return import(url);
}

function parseArgs(argv) {
  const args = { json: false, top: 25 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--top' && i + 1 < argv.length) {
      const n = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) {
        args.top = n;
      }
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [{ getMoveEffectCoverageReport }, { MOVE_NAMES }] = await Promise.all([
    importModule('src/battle/engine/MoveEffects.ts'),
    importModule('src/data/moves.ts'),
  ]);

  const report = getMoveEffectCoverageReport();
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const implementedPct = report.totalDefinedEffects > 0
    ? ((report.implementedEffects / report.totalDefinedEffects) * 100).toFixed(1)
    : '0.0';
  const referencedPct = report.totalReferencedEffects > 0
    ? ((report.implementedReferencedEffects / report.totalReferencedEffects) * 100).toFixed(1)
    : '0.0';

  console.log('[battle:move-effects] Coverage summary');
  console.log(`- Implemented effects: ${report.implementedEffects}/${report.totalDefinedEffects} (${implementedPct}%)`);
  console.log(`- Referenced effects covered: ${report.implementedReferencedEffects}/${report.totalReferencedEffects} (${referencedPct}%)`);
  console.log(`- Missing referenced effects: ${report.missingReferencedEffects.length}`);
  console.log('');
  console.log(`[battle:move-effects] Top ${Math.min(args.top, report.missingReferencedEffects.length)} missing referenced effects`);

  const rows = report.missingReferencedEffects.slice(0, args.top);
  for (const entry of rows) {
    const movePreview = entry.moveIds
      .slice(0, 5)
      .map((moveId) => MOVE_NAMES[moveId] ?? `MOVE_${moveId}`)
      .join(', ');
    const script = entry.scriptLabel ?? 'n/a';
    console.log(
      `- ${entry.effectId} ${entry.effectName} | moves=${entry.moveCount} | script=${script} | sample=[${movePreview}]`,
    );
  }
}

main().catch((error) => {
  console.error('[battle:move-effects] Failed to build coverage report.');
  console.error(error);
  process.exit(1);
});
