#!/usr/bin/env node
/**
 * Generate battle animation script tables and script bodies.
 *
 * Parses:
 * - public/pokeemerald/data/battle_anim_scripts.s
 * - public/pokeemerald/include/constants/moves.h
 *
 * Outputs:
 * - src/data/battleAnimations.gen.ts
 *
 * Usage:
 *   node scripts/generate-battle-animations.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ANIM_S = path.join(ROOT, 'public/pokeemerald/data/battle_anim_scripts.s');
const MOVES_H = path.join(ROOT, 'public/pokeemerald/include/constants/moves.h');
const OUT_FILE = path.join(ROOT, 'src/data/battleAnimations.gen.ts');

const animSrc = fs.readFileSync(ANIM_S, 'utf8');
const movesSrc = fs.readFileSync(MOVES_H, 'utf8');

const moveNameById = parseMoveNameById(movesSrc);

const moveAnimTable = parsePointerTable(animSrc, 'gBattleAnims_Moves');
const statusAnimTable = parsePointerTable(animSrc, 'gBattleAnims_StatusConditions');
const generalAnimTable = parsePointerTable(animSrc, 'gBattleAnims_General');
const specialAnimTable = parsePointerTable(animSrc, 'gBattleAnims_Special');
const quietBgmMoves = parseQuietBgmMoves(animSrc, moveNameById);

const referencedLabels = new Set([
  ...moveAnimTable,
  ...statusAnimTable,
  ...generalAnimTable,
  ...specialAnimTable,
]);
const labelBlocks = parseLabelBlocks(animSrc, referencedLabels);

let out = '';
out += '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/data/battle_anim_scripts.s\n';
out += '// Regenerate: node scripts/generate-battle-animations.cjs\n\n';
out += 'export interface MoveAnimationScriptEntry {\n';
out += '  moveId: number;\n';
out += '  moveName: string;\n';
out += '  scriptLabel: string;\n';
out += '}\n\n';
out += 'export interface IndexedAnimationScriptEntry {\n';
out += '  index: number;\n';
out += '  scriptLabel: string;\n';
out += '}\n\n';
out += 'export const MOVE_ANIMATION_SCRIPTS: MoveAnimationScriptEntry[] = [\n';
for (let i = 0; i < moveAnimTable.length; i++) {
  const scriptLabel = moveAnimTable[i];
  const moveName = moveNameById[i] ?? `MOVE_${i}`;
  out += `  { moveId: ${i}, moveName: '${moveName}', scriptLabel: '${scriptLabel}' },\n`;
}
out += '];\n\n';
out += 'export const STATUS_ANIMATION_SCRIPTS: IndexedAnimationScriptEntry[] = [\n';
for (let i = 0; i < statusAnimTable.length; i++) {
  out += `  { index: ${i}, scriptLabel: '${statusAnimTable[i]}' },\n`;
}
out += '];\n\n';
out += 'export const GENERAL_ANIMATION_SCRIPTS: IndexedAnimationScriptEntry[] = [\n';
for (let i = 0; i < generalAnimTable.length; i++) {
  out += `  { index: ${i}, scriptLabel: '${generalAnimTable[i]}' },\n`;
}
out += '];\n\n';
out += 'export const SPECIAL_ANIMATION_SCRIPTS: IndexedAnimationScriptEntry[] = [\n';
for (let i = 0; i < specialAnimTable.length; i++) {
  out += `  { index: ${i}, scriptLabel: '${specialAnimTable[i]}' },\n`;
}
out += '];\n\n';
out += 'export const MOVES_WITH_QUIET_BGM: Array<{ moveId: number; moveName: string }> = [\n';
for (const entry of quietBgmMoves) {
  out += `  { moveId: ${entry.moveId}, moveName: '${entry.moveName}' },\n`;
}
out += '];\n\n';
out += 'export const BATTLE_ANIMATION_SCRIPTS: Record<string, string[]> = {\n';
for (const label of Array.from(referencedLabels).sort()) {
  const body = labelBlocks[label] ?? [];
  out += `  ${label}: [\n`;
  for (const line of body) {
    out += `    '${escapeSingleQuoted(line)}',\n`;
  }
  out += '  ],\n';
}
out += '};\n\n';
out += 'export function getMoveAnimationScript(moveId: number): MoveAnimationScriptEntry | undefined {\n';
out += '  return MOVE_ANIMATION_SCRIPTS[moveId];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log(
  `Wrote ${OUT_FILE} `
  + `(${moveAnimTable.length} move anims, ${statusAnimTable.length} status, `
  + `${generalAnimTable.length} general, ${specialAnimTable.length} special)`
);

/**
 * @param {string} movesHeader
 * @returns {Record<number, string>}
 */
function parseMoveNameById(movesHeader) {
  /** @type {Record<number, string>} */
  const byId = {};
  for (const match of movesHeader.matchAll(/^#define\s+(MOVE_[A-Z0-9_]+)\s+(\d+)\s*$/gm)) {
    byId[Number(match[2])] = match[1];
  }
  return byId;
}

/**
 * Parse contiguous .4byte pointer table under a label.
 *
 * @param {string} source
 * @param {string} label
 * @returns {string[]}
 */
function parsePointerTable(source, label) {
  const lines = source.split(/\r?\n/);
  const out = [];
  let collecting = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!collecting) {
      if (line === `${label}::`) {
        collecting = true;
      }
      continue;
    }
    if (!line.startsWith('.4byte')) {
      break;
    }
    const match = line.match(/^\.4byte\s+([A-Za-z0-9_]+)/);
    if (match) {
      out.push(match[1]);
    }
  }
  return out;
}

/**
 * Parse gMovesWithQuietBGM list from .2byte list.
 *
 * @param {string} source
 * @param {Record<number, string>} moveNameById
 * @returns {Array<{ moveId: number; moveName: string }>}
 */
function parseQuietBgmMoves(source, moveNameById) {
  const lines = source.split(/\r?\n/);
  let collecting = false;
  const names = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!collecting) {
      if (line === 'gMovesWithQuietBGM::') {
        collecting = true;
      }
      continue;
    }
    if (!line.startsWith('.2byte')) {
      break;
    }
    const body = line.replace(/^\.2byte\s+/, '');
    for (const token of body.split(',').map((s) => s.trim())) {
      if (!token || token === '0xFFFF') continue;
      names.push(token);
    }
  }

  const moveIdByName = {};
  for (const [id, name] of Object.entries(moveNameById)) {
    moveIdByName[name] = Number(id);
  }

  return names
    .map((name) => ({
      moveId: moveIdByName[name] ?? -1,
      moveName: name,
    }))
    .filter((entry) => entry.moveId >= 0);
}

/**
 * Parse label bodies only for a selected set of labels.
 *
 * @param {string} source
 * @param {Set<string>} wantedLabels
 * @returns {Record<string, string[]>}
 */
function parseLabelBlocks(source, wantedLabels) {
  const lines = source.split(/\r?\n/);
  const blocks = {};
  let currentLabel = null;
  let currentBody = [];

  for (const rawLine of lines) {
    const labelMatch = rawLine.match(/^([A-Za-z0-9_]+)::?\s*$/);
    if (labelMatch) {
      if (currentLabel && wantedLabels.has(currentLabel)) {
        blocks[currentLabel] = currentBody;
      }
      currentLabel = labelMatch[1];
      currentBody = [];
      continue;
    }

    if (!currentLabel || !wantedLabels.has(currentLabel)) continue;

    const noComment = rawLine.split('@')[0].trim();
    if (!noComment) continue;
    if (noComment.startsWith('.include')) continue;
    if (noComment.startsWith('.section')) continue;
    if (noComment.startsWith('.align')) continue;
    if (noComment.startsWith('.2byte')) continue;
    if (noComment.startsWith('.4byte')) continue;
    if (noComment.startsWith('#include')) continue;
    currentBody.push(noComment);
  }

  if (currentLabel && wantedLabels.has(currentLabel)) {
    blocks[currentLabel] = currentBody;
  }

  return blocks;
}

function escapeSingleQuoted(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}
