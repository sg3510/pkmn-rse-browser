#!/usr/bin/env node
/**
 * Generate battle script data (move-effect table + script bodies).
 *
 * Parses:
 * - public/pokeemerald/data/battle_scripts_1.s
 * - public/pokeemerald/data/battle_scripts_2.s
 * - public/pokeemerald/include/constants/battle_move_effects.h
 *
 * Outputs:
 * - src/data/battleScripts.gen.ts
 *
 * Usage:
 *   node scripts/generate-battle-scripts.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS_1 = path.join(ROOT, 'public/pokeemerald/data/battle_scripts_1.s');
const SCRIPTS_2 = path.join(ROOT, 'public/pokeemerald/data/battle_scripts_2.s');
const EFFECTS_H = path.join(ROOT, 'public/pokeemerald/include/constants/battle_move_effects.h');
const OUT_FILE = path.join(ROOT, 'src/data/battleScripts.gen.ts');

const scripts1Src = fs.readFileSync(SCRIPTS_1, 'utf8');
const scripts2Src = fs.readFileSync(SCRIPTS_2, 'utf8');
const effectsSrc = fs.readFileSync(EFFECTS_H, 'utf8');

/** @type {Record<string, number>} */
const effectIds = {};
for (const match of effectsSrc.matchAll(/^#define\s+(EFFECT_[A-Z0-9_]+)\s+(\d+)\s*$/gm)) {
  effectIds[match[1]] = Number(match[2]);
}

const effectTable = parseMoveEffectTable(scripts1Src, effectIds);
const scriptBlocks = {
  ...parseBattleScriptBlocks(scripts1Src),
  ...parseBattleScriptBlocks(scripts2Src),
};

const sortedLabels = Object.keys(scriptBlocks).sort();

let out = '';
out += '// Auto-generated — do not edit\n';
out += '// Source: battle_scripts_1.s + battle_scripts_2.s\n';
out += '// Regenerate: node scripts/generate-battle-scripts.cjs\n\n';
out += 'export interface BattleMoveEffectScriptEntry {\n';
out += '  tableIndex: number;\n';
out += '  effectName: string;\n';
out += '  effectId: number;\n';
out += '  scriptLabel: string;\n';
out += '}\n\n';
out += 'export const BATTLE_MOVE_EFFECT_SCRIPTS: BattleMoveEffectScriptEntry[] = [\n';
for (const entry of effectTable) {
  out += `  { tableIndex: ${entry.tableIndex}, effectName: '${entry.effectName}', effectId: ${entry.effectId}, scriptLabel: '${entry.scriptLabel}' },\n`;
}
out += '];\n\n';
out += 'export const BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID: Record<number, BattleMoveEffectScriptEntry> =\n';
out += '  BATTLE_MOVE_EFFECT_SCRIPTS.reduce((acc, entry) => {\n';
out += '    acc[entry.effectId] = entry;\n';
out += '    return acc;\n';
out += '  }, {} as Record<number, BattleMoveEffectScriptEntry>);\n\n';
out += 'export interface BattleScriptOp {\n';
out += '  opcode: string;\n';
out += '  args: string[];\n';
out += '  raw: string;\n';
out += '}\n\n';
out += 'export const BATTLE_SCRIPTS: Record<string, string[]> = {\n';
for (const label of sortedLabels) {
  out += `  ${label}: [\n`;
  for (const command of scriptBlocks[label]) {
    out += `    '${escapeSingleQuoted(command)}',\n`;
  }
  out += '  ],\n';
}
out += '};\n\n';
out += 'export const BATTLE_SCRIPT_OPS: Record<string, BattleScriptOp[]> = {\n';
for (const label of sortedLabels) {
  out += `  ${label}: [\n`;
  for (const command of scriptBlocks[label]) {
    const op = parseBattleScriptOp(command);
    const argsList = op.args.map((arg) => `'${escapeSingleQuoted(arg)}'`).join(', ');
    out += `    { opcode: '${escapeSingleQuoted(op.opcode)}', args: [${argsList}], raw: '${escapeSingleQuoted(op.raw)}' },\n`;
  }
  out += '  ],\n';
}
out += '};\n\n';
out += 'export const BATTLE_SCRIPT_LABELS: string[] = Object.keys(BATTLE_SCRIPTS);\n\n';
out += 'export function getBattleScript(label: string): string[] | undefined {\n';
out += '  return BATTLE_SCRIPTS[label];\n';
out += '}\n\n';
out += 'export function getBattleScriptOps(label: string): BattleScriptOp[] | undefined {\n';
out += '  return BATTLE_SCRIPT_OPS[label];\n';
out += '}\n\n';
out += 'export function getMoveEffectScript(effectId: number): BattleMoveEffectScriptEntry | undefined {\n';
out += '  return BATTLE_MOVE_EFFECT_SCRIPT_BY_EFFECT_ID[effectId];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log(`Wrote ${OUT_FILE} (${effectTable.length} effect entries, ${sortedLabels.length} scripts)`);

/**
 * Parse gBattleScriptsForMoveEffects pointer table from battle_scripts_1.s.
 *
 * @param {string} source
 * @param {Record<string, number>} effectIdsMap
 */
function parseMoveEffectTable(source, effectIdsMap) {
  const lines = source.split(/\r?\n/);
  const entries = [];

  let inTable = false;
  let tableIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!inTable) {
      if (line === 'gBattleScriptsForMoveEffects::') {
        inTable = true;
      }
      continue;
    }

    if (!line.startsWith('.4byte')) {
      break;
    }

    const match = line.match(/^\.4byte\s+([A-Za-z0-9_]+)(?:\s*@\s*(EFFECT_[A-Z0-9_]+))?/);
    if (!match) continue;

    const scriptLabel = match[1];
    const effectName = match[2] ?? `EFFECT_UNKNOWN_${tableIndex}`;
    const effectId = effectIdsMap[effectName] ?? tableIndex;
    entries.push({
      tableIndex,
      effectName,
      effectId,
      scriptLabel,
    });
    tableIndex++;
  }

  return entries;
}

/**
 * Parse BattleScript_* blocks from a battle script assembly file.
 *
 * @param {string} source
 * @returns {Record<string, string[]>}
 */
function parseBattleScriptBlocks(source) {
  const lines = source.split(/\r?\n/);
  const scripts = {};
  let currentLabel = null;
  let currentBody = [];

  for (const rawLine of lines) {
    const labelMatch = rawLine.match(/^([A-Za-z0-9_]+)::?\s*$/);
    if (labelMatch) {
      if (currentLabel && currentLabel.startsWith('BattleScript_')) {
        scripts[currentLabel] = currentBody;
      }
      currentLabel = labelMatch[1];
      currentBody = [];
      continue;
    }

    if (!currentLabel || !currentLabel.startsWith('BattleScript_')) {
      continue;
    }

    const noComment = rawLine.split('@')[0].trim();
    if (!noComment) continue;
    if (noComment.startsWith('.include')) continue;
    if (noComment.startsWith('.section')) continue;
    if (noComment.startsWith('.align')) continue;
    if (noComment.startsWith('#include')) continue;
    if (noComment.startsWith('.2byte')) continue;
    if (noComment.startsWith('.4byte')) continue;
    currentBody.push(noComment);
  }

  if (currentLabel && currentLabel.startsWith('BattleScript_')) {
    scripts[currentLabel] = currentBody;
  }

  return scripts;
}

function parseBattleScriptOp(command) {
  const [head, ...rest] = command.trim().split(/\s+/);
  const opcode = head || '';
  const argsText = rest.join(' ').trim();
  if (!argsText) {
    return {
      opcode,
      args: [],
      raw: command,
    };
  }
  return {
    opcode,
    args: argsText
      .split(',')
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0),
    raw: command,
  };
}

function escapeSingleQuoted(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}
