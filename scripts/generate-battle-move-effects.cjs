#!/usr/bin/env node
/**
 * Generate battle move-effect index from generated battle move/script sources.
 *
 * Inputs:
 * - src/data/battleMoves.gen.ts
 * - src/data/battleScripts.gen.ts
 * - src/data/moves.ts
 *
 * Output:
 * - src/data/battleMoveEffects.gen.ts
 *
 * Usage:
 *   node scripts/generate-battle-move-effects.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'src/data/battleMoveEffects.gen.ts');

function toTsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function formatNullableString(value) {
  return value ? toTsString(value) : 'null';
}

async function importModule(relPath) {
  const absolute = path.join(ROOT, relPath);
  return import(pathToFileURL(absolute).href);
}

async function main() {
  const [
    { BATTLE_MOVES, EFFECT_NAMES },
    { BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID },
    { MOVE_NAMES },
  ] = await Promise.all([
    importModule('src/data/battleMoves.gen.ts'),
    importModule('src/data/battleScripts.gen.ts'),
    importModule('src/data/moves.ts'),
  ]);

  const effectToMoveIds = new Map();
  const moveToEffectRows = [];

  for (const [moveIdRaw, moveData] of Object.entries(BATTLE_MOVES)) {
    const moveId = Number(moveIdRaw);
    if (!Number.isFinite(moveId) || moveId <= 0) continue;

    const effectId = moveData.effect;
    const bucket = effectToMoveIds.get(effectId) ?? [];
    bucket.push(moveId);
    effectToMoveIds.set(effectId, bucket);

    const scriptLabel = BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID[effectId]?.scriptLabel ?? null;
    moveToEffectRows.push({
      moveId,
      moveName: MOVE_NAMES[moveId] ?? `MOVE_${moveId}`,
      effectId,
      effectName: EFFECT_NAMES[effectId] ?? `EFFECT_${effectId}`,
      scriptLabel,
    });
  }

  const effectRows = Array.from(effectToMoveIds.entries())
    .map(([effectId, moveIds]) => {
      const sortedMoveIds = [...moveIds].sort((a, b) => a - b);
      const scriptLabel = BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID[effectId]?.scriptLabel ?? null;
      const effectName = EFFECT_NAMES[effectId] ?? `EFFECT_${effectId}`;
      return {
        effectId,
        effectName,
        scriptLabel,
        moveCount: sortedMoveIds.length,
        moveIds: sortedMoveIds,
      };
    })
    .sort((a, b) => a.effectId - b.effectId);

  moveToEffectRows.sort((a, b) => a.moveId - b.moveId);

  let out = '';
  out += '// Auto-generated — do not edit\n';
  out += '// Source: battleMoves.gen.ts + battleScripts.gen.ts + moves.ts\n';
  out += '// Regenerate: node scripts/generate-battle-move-effects.cjs\n\n';
  out += 'export interface BattleMoveEffectIndexEntry {\n';
  out += '  effectId: number;\n';
  out += '  effectName: string;\n';
  out += '  scriptLabel: string | null;\n';
  out += '  moveCount: number;\n';
  out += '  moveIds: number[];\n';
  out += '}\n\n';
  out += 'export interface BattleMoveToEffectEntry {\n';
  out += '  moveId: number;\n';
  out += '  moveName: string;\n';
  out += '  effectId: number;\n';
  out += '  effectName: string;\n';
  out += '  scriptLabel: string | null;\n';
  out += '}\n\n';
  out += 'export const BATTLE_MOVE_EFFECT_INDEX: Record<number, BattleMoveEffectIndexEntry> = {\n';
  for (const row of effectRows) {
    out += `  ${row.effectId}: {\n`;
    out += `    effectId: ${row.effectId},\n`;
    out += `    effectName: ${toTsString(row.effectName)},\n`;
    out += `    scriptLabel: ${formatNullableString(row.scriptLabel)},\n`;
    out += `    moveCount: ${row.moveCount},\n`;
    out += `    moveIds: [${row.moveIds.join(', ')}],\n`;
    out += '  },\n';
  }
  out += '};\n\n';
  out += 'export const BATTLE_MOVE_TO_EFFECT: Record<number, BattleMoveToEffectEntry> = {\n';
  for (const row of moveToEffectRows) {
    out += `  ${row.moveId}: {\n`;
    out += `    moveId: ${row.moveId},\n`;
    out += `    moveName: ${toTsString(row.moveName)},\n`;
    out += `    effectId: ${row.effectId},\n`;
    out += `    effectName: ${toTsString(row.effectName)},\n`;
    out += `    scriptLabel: ${formatNullableString(row.scriptLabel)},\n`;
    out += '  },\n';
  }
  out += '};\n\n';
  out += 'export const BATTLE_MOVE_EFFECT_IDS: number[] = [\n';
  for (const row of effectRows) {
    out += `  ${row.effectId},\n`;
  }
  out += '];\n\n';
  out += 'export function getBattleMoveEffectIndex(effectId: number): BattleMoveEffectIndexEntry | undefined {\n';
  out += '  return BATTLE_MOVE_EFFECT_INDEX[effectId];\n';
  out += '}\n\n';
  out += 'export function getBattleMoveEffectByMoveId(moveId: number): BattleMoveToEffectEntry | undefined {\n';
  out += '  return BATTLE_MOVE_TO_EFFECT[moveId];\n';
  out += '}\n';

  fs.writeFileSync(OUT_FILE, out, 'utf8');
  console.log(`Wrote ${OUT_FILE} (${effectRows.length} effects, ${moveToEffectRows.length} moves)`);
}

main().catch((error) => {
  console.error('[generate-battle-move-effects] Failed.');
  console.error(error);
  process.exit(1);
});
