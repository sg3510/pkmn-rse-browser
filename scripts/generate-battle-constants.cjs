#!/usr/bin/env node
/**
 * Generate core battle constants from pokeemerald battle headers.
 *
 * Parses:
 * - public/pokeemerald/include/constants/battle.h
 *
 * Outputs:
 * - src/data/battleConstants.gen.ts
 *
 * Usage:
 *   node scripts/generate-battle-constants.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BATTLE_H = path.join(ROOT, 'public/pokeemerald/include/constants/battle.h');
const OUT_FILE = path.join(ROOT, 'src/data/battleConstants.gen.ts');

const GROUPS = [
  { name: 'BATTLE_TYPE', prefixes: ['BATTLE_TYPE_'] },
  { name: 'B_OUTCOME', prefixes: ['B_OUTCOME_'] },
  { name: 'STATUS1', prefixes: ['STATUS1_'] },
  { name: 'STATUS2', prefixes: ['STATUS2_'] },
  { name: 'STATUS3', prefixes: ['STATUS3_'] },
  { name: 'HITMARKER', prefixes: ['HITMARKER_'] },
  { name: 'SIDE_STATUS', prefixes: ['SIDE_STATUS_'] },
  { name: 'MOVE_RESULT', prefixes: ['MOVE_RESULT_'] },
  { name: 'B_WEATHER', prefixes: ['B_WEATHER_'] },
  { name: 'BATTLE_ENVIRONMENT', prefixes: ['BATTLE_ENVIRONMENT_'] },
  { name: 'BATTLE_RUN', prefixes: ['BATTLE_RUN_'] },
  { name: 'B_WIN_TYPE', prefixes: ['B_WIN_TYPE_'] },
  { name: 'B_SIDE', prefixes: ['B_SIDE_'] },
  { name: 'B_FLANK', prefixes: ['B_FLANK_'] },
  { name: 'BIT', prefixes: ['BIT_'] },
];

const source = fs.readFileSync(BATTLE_H, 'utf8');
const logicalLines = collapseContinuations(source);

/** @type {Map<string, string>} */
const defineExpr = new Map();
/** @type {string[]} */
const defineOrder = [];

for (const line of logicalLines) {
  const match = line.match(/^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
  if (!match) continue;

  const name = match[1];
  const expr = stripComments(match[2]).trim();
  if (!expr) continue;

  if (!defineExpr.has(name)) {
    defineOrder.push(name);
  }
  defineExpr.set(name, expr);
}

/** @type {Map<string, bigint>} */
const valueCache = new Map();
/** @type {Set<string>} */
const evalStack = new Set();

function evalDefine(name) {
  if (valueCache.has(name)) {
    return valueCache.get(name);
  }

  const expr = defineExpr.get(name);
  if (!expr) {
    throw new Error(`Missing define expression for ${name}`);
  }
  if (evalStack.has(name)) {
    throw new Error(`Circular define reference at ${name}`);
  }

  evalStack.add(name);
  const value = parseExpression(tokenize(expr), (identifier) => {
    if (!defineExpr.has(identifier)) {
      throw new Error(`Unknown identifier ${identifier} used by ${name}`);
    }
    return evalDefine(identifier);
  });
  evalStack.delete(name);

  valueCache.set(name, value);
  return value;
}

/** @type {Record<string, Record<string, number>>} */
const grouped = {};

for (const group of GROUPS) {
  /** @type {Record<string, number>} */
  const entries = {};

  for (const name of defineOrder) {
    if (!group.prefixes.some((prefix) => name.startsWith(prefix))) continue;

    const value = evalDefine(name);
    const asNumber = Number(value);
    if (!Number.isSafeInteger(asNumber)) {
      throw new Error(`Value for ${name} is not a safe integer: ${value}`);
    }
    entries[name] = asNumber;
  }

  grouped[group.name] = entries;
}

const flatConstantEntries = Object.values(grouped)
  .flatMap((group) => Object.entries(group));

const uniqueNames = new Set(flatConstantEntries.map(([name]) => name));
if (uniqueNames.size !== flatConstantEntries.length) {
  throw new Error('Duplicate constant names emitted across groups');
}

let out = '';
out += '// Auto-generated — do not edit\n';
out += '// Source: public/pokeemerald/include/constants/battle.h\n';
out += '// Regenerate: node scripts/generate-battle-constants.cjs\n\n';
out += 'export interface BattleConstantMap {\n';
out += '  [constantName: string]: number;\n';
out += '}\n\n';

for (const group of GROUPS) {
  const entries = grouped[group.name];
  out += `export const ${group.name}: BattleConstantMap = {\n`;
  for (const [name, value] of Object.entries(entries)) {
    out += `  ${name}: ${value},\n`;
  }
  out += '};\n\n';
}

out += 'export const BATTLE_CONSTANT_GROUPS = {\n';
for (const group of GROUPS) {
  out += `  ${group.name},\n`;
}
out += '} as const;\n\n';
out += 'export type BattleConstantGroup = keyof typeof BATTLE_CONSTANT_GROUPS;\n\n';
out += 'export const BATTLE_CONSTANTS: BattleConstantMap = Object.values(BATTLE_CONSTANT_GROUPS).reduce(\n';
out += '  (acc, group) => Object.assign(acc, group),\n';
out += '  {} as BattleConstantMap\n';
out += ');\n\n';
out += 'export function getBattleConstant(group: BattleConstantGroup, constantName: string): number | undefined {\n';
out += '  return BATTLE_CONSTANT_GROUPS[group][constantName];\n';
out += '}\n\n';
out += 'export function getAnyBattleConstant(constantName: string): number | undefined {\n';
out += '  return BATTLE_CONSTANTS[constantName];\n';
out += '}\n';

fs.writeFileSync(OUT_FILE, out, 'utf8');

const total = Object.values(grouped).reduce((sum, group) => sum + Object.keys(group).length, 0);
console.log(`Wrote ${OUT_FILE} (${total} constants in ${GROUPS.length} groups)`);

function collapseContinuations(text) {
  const lines = text.split(/\r?\n/);
  const logical = [];
  let buffer = '';

  for (const line of lines) {
    const merged = buffer ? `${buffer}${line.trimStart()}` : line;
    if (merged.endsWith('\\')) {
      buffer = merged.slice(0, -1);
      continue;
    }
    logical.push(merged);
    buffer = '';
  }

  if (buffer) {
    logical.push(buffer);
  }

  return logical;
}

function stripComments(line) {
  return line
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/, '');
}

function tokenize(expr) {
  /** @type {Array<{type: 'number' | 'identifier' | 'op' | 'paren', value: string | bigint}>} */
  const tokens = [];

  for (let i = 0; i < expr.length;) {
    const ch = expr[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    const two = expr.slice(i, i + 2);
    if (two === '<<' || two === '>>') {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    if ('|&~+-*/%'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (/\d/.test(ch)) {
      let j = i;
      if (expr.slice(j, j + 2).toLowerCase() === '0x') {
        j += 2;
        while (j < expr.length && /[0-9a-fA-F]/.test(expr[j])) j++;
      } else {
        while (j < expr.length && /\d/.test(expr[j])) j++;
      }

      while (j < expr.length && /[uUlL]/.test(expr[j])) j++;

      const raw = expr.slice(i, j).replace(/[uUlL]+$/g, '');
      const value = raw.toLowerCase().startsWith('0x') ? BigInt(raw) : BigInt(parseInt(raw, 10));
      tokens.push({ type: 'number', value });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      tokens.push({ type: 'identifier', value: expr.slice(i, j) });
      i = j;
      continue;
    }

    throw new Error(`Unexpected token '${ch}' in expression: ${expr}`);
  }

  return tokens;
}

function parseExpression(tokens, resolveIdentifier) {
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume() {
    return tokens[index++];
  }

  function expectParen(value) {
    const token = consume();
    if (!token || token.type !== 'paren' || token.value !== value) {
      throw new Error(`Expected '${value}'`);
    }
  }

  function parsePrimary() {
    const token = consume();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    if (token.type === 'number') {
      return token.value;
    }

    if (token.type === 'identifier') {
      return resolveIdentifier(token.value);
    }

    if (token.type === 'paren' && token.value === '(') {
      const value = parseBitOr();
      expectParen(')');
      return value;
    }

    throw new Error(`Unexpected token in primary: ${String(token.value)}`);
  }

  function parseUnary() {
    const token = peek();
    if (token && token.type === 'op' && (token.value === '+' || token.value === '-' || token.value === '~')) {
      consume();
      const rhs = parseUnary();
      if (token.value === '+') return rhs;
      if (token.value === '-') return -rhs;
      return ~rhs;
    }
    return parsePrimary();
  }

  function parseMulDiv() {
    let value = parseUnary();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.value !== '*' && token.value !== '/' && token.value !== '%')) {
        break;
      }
      consume();
      const rhs = parseUnary();
      if (token.value === '*') value = value * rhs;
      else if (token.value === '/') value = value / rhs;
      else value = value % rhs;
    }
    return value;
  }

  function parseAddSub() {
    let value = parseMulDiv();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.value !== '+' && token.value !== '-')) {
        break;
      }
      consume();
      const rhs = parseMulDiv();
      if (token.value === '+') value = value + rhs;
      else value = value - rhs;
    }
    return value;
  }

  function parseShift() {
    let value = parseAddSub();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || (token.value !== '<<' && token.value !== '>>')) {
        break;
      }
      consume();
      const rhs = parseAddSub();
      if (rhs < 0n) {
        throw new Error('Negative shift count is not supported');
      }
      if (token.value === '<<') value = value << rhs;
      else value = value >> rhs;
    }
    return value;
  }

  function parseBitAnd() {
    let value = parseShift();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || token.value !== '&') {
        break;
      }
      consume();
      value = value & parseShift();
    }
    return value;
  }

  function parseBitOr() {
    let value = parseBitAnd();
    while (true) {
      const token = peek();
      if (!token || token.type !== 'op' || token.value !== '|') {
        break;
      }
      consume();
      value = value | parseBitAnd();
    }
    return value;
  }

  const value = parseBitOr();
  if (index !== tokens.length) {
    throw new Error(`Unexpected token at end of expression: ${String(tokens[index].value)}`);
  }

  return value;
}
