// C reference: public/pokeemerald/data/battle_anim_scripts.s and asm/macros/battle_anim_script.inc.
// Build-time parser only. Never evaluates source as JavaScript.
const TABLES = {
  move: 'gBattleAnims_Moves', status: 'gBattleAnims_StatusConditions',
  general: 'gBattleAnims_General', special: 'gBattleAnims_Special',
};
const BRANCH_ARGS = {
  call: [0], goto: [0], jumpargeq: [2], jumpifmoveturn: [1],
  choosetwoturnanim: [0, 1], jumpifcontest: [0],
  jumpreteq: [1], jumprettrue: [0], jumpretfalse: [0],
};
function splitArgs(text) {
  let depth = 0, start = 0;
  const args = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (text[i] === ',' && depth === 0) { args.push(text.slice(start, i).trim()); start = i + 1; }
  }
  if (text.slice(start).trim()) args.push(text.slice(start).trim());
  return args;
}
function createConstants(headers) {
  const definitions = new Map([['TRUE', '1'], ['FALSE', '0']]);
  for (const source of headers) {
    const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const match of clean.matchAll(/^#define[ \t]+([A-Za-z_]\w*)[ \t]+([^\n]+)/gm)) {
      definitions.set(match[1], match[2].trim());
    }
    for (const match of clean.matchAll(/enum\s*\w*\s*\{([^}]+)\}/g)) {
      let previous = null;
      for (const entry of splitArgs(match[1])) {
        const item = entry.match(/^(\w+)(?:\s*=\s*(.*))?$/s);
        if (!item) throw new Error(`Unsupported enum entry ${entry}`);
        definitions.set(item[1], item[2] ?? (previous ? `${previous} + 1` : '0'));
        previous = item[1];
      }
    }
  }
  const cache = new Map();
  const resolve = (name, seen = new Set()) => {
    if (cache.has(name)) return cache.get(name);
    if (!definitions.has(name)) throw new Error(`Unknown constant ${name}`);
    if (seen.has(name)) throw new Error(`Circular constant ${name}`);
    const next = new Set(seen).add(name);
    const result = evaluate(definitions.get(name), (key) => resolve(key, next));
    cache.set(name, result);
    return result;
  };
  return { resolve, evaluate: (value) => evaluate(value, resolve) };
}
function evaluate(expression, resolve) {
  const tokens = expression.match(/0x[\da-f]+(?:u|l)*|\d+(?:u|l)*|[A-Za-z_]\w*|<<|>>|[()+\-~|&^*/,]/gi) ?? [];
  if (tokens.join('').toLowerCase() !== expression.replace(/\s/g, '').toLowerCase()) {
    throw new Error(`Unsupported expression ${expression}`);
  }
  const precedence = { '|': 1, '^': 2, '&': 3, '<<': 4, '>>': 4, '+': 5, '-': 5, '*': 6, '/': 6 };
  let cursor = 0;
  function atom() {
    const token = tokens[cursor++];
    if (token === '-' || token === '+' || token === '~') {
      const value = atom(); return token === '-' ? -value : token === '~' ? ~value : value;
    }
    if (token === '(') {
      const value = binary(0); if (tokens[cursor++] !== ')') throw new Error(`Unclosed expression ${expression}`);
      return value;
    }
    if (token === 'RGB' || token === 'RGB2') {
      if (tokens[cursor++] !== '(') throw new Error('Expected RGB arguments');
      const values = [];
      for (let i = 0; i < 3; i++) {
        values.push(binary(0));
        if (tokens[cursor++] !== (i < 2 ? ',' : ')')) throw new Error('Invalid RGB arguments');
      }
      return values[0] | (values[1] << 5) | (values[2] << 10);
    }
    if (/^(0x[\da-f]+|\d+)[ul]*$/i.test(token ?? '')) return Number(token.replace(/[ul]+$/i, ''));
    if (/^[A-Za-z_]\w*$/.test(token ?? '')) return resolve(token);
    throw new Error(`Invalid expression ${expression}`);
  }
  function binary(min) {
    let left = atom();
    while ((precedence[tokens[cursor]] ?? -1) >= min) {
      const op = tokens[cursor++]; const right = binary(precedence[op] + 1);
      switch (op) {
        case '|': left |= right; break; case '^': left ^= right; break; case '&': left &= right; break;
        case '<<': left <<= right; break; case '>>': left >>= right; break;
        case '+': left += right; break; case '-': left -= right; break; case '*': left *= right; break;
        case '/': if (right === 0) throw new Error('Division by zero'); left = Math.trunc(left / right); break;
      }
    }
    return left;
  }
  const result = binary(0);
  if (cursor !== tokens.length || !Number.isSafeInteger(result)) throw new Error(`Invalid expression ${expression}`);
  return result;
}
function compile(source, constants) {
  const instructions = [], labels = {}, tables = {}, rawBlocks = {};
  let currentLabel = '';
  const tableDomains = Object.fromEntries(Object.entries(TABLES).map(([domain, label]) => [label, domain]));
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.split('@')[0].trim();
    if (!line || line.startsWith('#') || line.startsWith('.include')) continue;
    const label = line.match(/^(\w+)::?$/);
    if (label) { currentLabel = label[1]; labels[currentLabel] = instructions.length; rawBlocks[currentLabel] = []; continue; }
    if (line.startsWith('.4byte') && tableDomains[currentLabel]) {
      (tables[tableDomains[currentLabel]] ??= []).push(line.replace(/^\.4byte\s+/, '')); continue;
    }
    if (line.startsWith('.')) continue;
    const match = line.match(/^(\w+)(?:\s+(.*))?$/);
    if (!match) throw new Error(`Line ${index + 1}: cannot parse ${line}`);
    let op = match[1];
    let args = splitArgs(match[2] ?? '').map((arg) => {
      // C callback/template and assembly label symbols are the only symbolic operands.
      if (/^[a-zA-Z_]\w*$/.test(arg) && !/^[A-Z_][A-Z0-9_]*$/.test(arg)) return arg;
      try { return constants.evaluate(arg); }
      catch (error) { throw new Error(`Line ${index + 1}: ${line}: ${error.message}`); }
    });
    // Convenience macros from the original macro file.
    if (op === 'jumpreteq') { op = 'jumpargeq'; args = [7, ...args]; }
    if (op === 'jumprettrue' || op === 'jumpretfalse') { args = [7, op === 'jumprettrue' ? 1 : 0, ...args]; op = 'jumpargeq'; }
    instructions.push({ op, args, line: index + 1 });
    (rawBlocks[currentLabel] ??= []).push(line);
  }
  for (const instruction of instructions) {
    for (const arg of BRANCH_ARGS[instruction.op] ?? []) {
      if (labels[instruction.args[arg]] === undefined) throw new Error(`Line ${instruction.line}: missing label ${instruction.args[arg]}`);
    }
  }
  for (const [domain, entries] of Object.entries(tables)) {
    for (const label of entries) if (labels[label] === undefined) throw new Error(`Missing ${domain} root ${label}`);
  }
  const dependencies = {};
  for (const root of new Set(Object.values(tables).flat())) {
    const seen = new Set(), pending = [labels[root]], commands = new Set(), sprites = new Set(), tasks = new Set(), tags = new Set(), helpers = new Set();
    while (pending.length) {
      const pc = pending.pop(); if (seen.has(pc)) continue; seen.add(pc);
      const ins = instructions[pc]; if (!ins) throw new Error(`Root ${root}: falls beyond the program`);
      commands.add(ins.op);
      if (ins.op === 'createsprite') sprites.add(ins.args[0]);
      if (ins.op === 'createvisualtask' || ins.op === 'createsoundtask') tasks.add(ins.args[0]);
      if (ins.op === 'loadspritegfx') tags.add(ins.args[0]);
      for (const arg of BRANCH_ARGS[ins.op] ?? []) { helpers.add(ins.args[arg]); pending.push(labels[ins.args[arg]]); }
      if (!['end', 'return', 'goto', 'choosetwoturnanim'].includes(ins.op)) pending.push(pc + 1);
    }
    dependencies[root] = {
      commands: [...commands].sort(), sprites: [...sprites].sort(), tasks: [...tasks].sort(),
      tags: [...tags].sort((a, b) => a - b), helpers: [...helpers].sort(), addresses: [...seen].sort((a, b) => a - b),
    };
  }
  return { instructions, labels, tables, dependencies, rawBlocks };
}
module.exports = { compile, createConstants, splitArgs, evaluate };
