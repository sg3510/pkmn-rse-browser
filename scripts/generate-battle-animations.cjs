#!/usr/bin/env node
// Source: public/pokeemerald/data/battle_anim_scripts.s, src/battle_anim*.c, src/data/battle_anim.h.
// Imports the full control-flow graph; ships only the explicitly enabled rollout to the browser.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compile, createConstants, splitArgs } = require('./lib/battle-animation-compiler.cjs');
const rollout = require('./lib/battle-animation-rollout.json');
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, 'public/pokeemerald', file), 'utf8');
const source = read('data/battle_anim_scripts.s');
const headers = [...source.matchAll(/#include "([^"]+)"/g)].map((m) => read(`include/${m[1]}`));
headers.push(read('include/gba/io_reg.h'));
const constants = createConstants(headers);
const compiled = compile(source, constants);
const hash = crypto.createHash('sha256').update(source).update(headers.join('\n'));
const cFiles = fs.readdirSync(path.join(ROOT, 'public/pokeemerald/src')).filter((file) => /^battle_anim.*\.c$/.test(file)).sort().map((file) => `src/${file}`);
const cSources = cFiles.map((file) => ({ file, text: read(file) }));
const graphics = read('src/graphics.c');
const tables = read('src/data/battle_anim.h');
for (const item of cSources) hash.update(item.text);
hash.update(graphics).update(tables).update(read('src/trig.c')).update(read('graphics_file_rules.mk'));
const sineTable = [...read('src/trig.c').matchAll(/Q_8_8\(([-.\d]+)\)/g)].slice(0, 256).map((match) => Math.trunc(Number(match[1]) * 256));
const sourceHash = hash.digest('hex');
const templates = {};
const assets = {};
function arrayBody(text, name) {
  const pattern = new RegExp(`\\b${name}\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = text.match(pattern) ?? cSources.map((source) => source.text.match(pattern)).find(Boolean);
  if (!match) throw new Error(`Missing C array ${name}`);
  return match[1];
}
function animationTables(text, name, affine) {
  if (name.startsWith('gDummySprite')) return [[{ op: 'END', args: [] }]];
  return splitArgs(arrayBody(text, name)).map((entry) => {
    const body = arrayBody(text, entry.replace(/^&/, ''));
    const prefix = affine ? 'AFFINEANIMCMD' : 'ANIMCMD';
    const commands = [...body.matchAll(new RegExp(`${prefix}_(\\w+)(?:\\(([^)]*)\\))?`, 'g'))];
    if (!commands.length) throw new Error(`Empty animation ${entry}`);
    return commands.map((m) => {
      const args = splitArgs(m[2] ?? '');
      const flags = Object.fromEntries(args.filter((value) => value.includes('=')).map((value) => value.trim().split(/\s*=\s*/)));
      return { op: m[1], args: args.filter((value) => !value.includes('=')).map((value) => constants.evaluate(value)),
        ...(flags.hFlip ? { hFlip: !!constants.evaluate(flags.hFlip) } : {}),
        ...(flags.vFlip ? { vFlip: !!constants.evaluate(flags.vFlip) } : {}) };
    });
  });
}
function assetPath(symbol, kind) {
  const match = graphics.match(new RegExp(`\\b${symbol}\\[\\]\\s*=\\s*INCBIN_U\\d+\\("([^"]+)"\\)`));
  if (!match) throw new Error(`Missing graphic ${symbol}`);
  const stem = match[1].replace(/\.(?:4bpp|gbapal)(?:\.lz)?$/, '');
  const png = `${stem}.png`;
  if (kind === 'palette' && fs.existsSync(path.join(ROOT, 'public/pokeemerald', `${stem}.pal`))) return `${stem}.pal`;
  if (!fs.existsSync(path.join(ROOT, 'public/pokeemerald', png))) {
    if (kind === 'graphics') {
      const rules = read('graphics_file_rules.mk').replace(/\\\r?\n/g, '');
      const basename = path.basename(stem);
      const rule = rules.split('\n').find((line) => line.startsWith(`$(BTLANMSPRGFXDIR)/${basename}.4bpp:`));
      const parts = rule?.split(':')[1].trim().split(/\s+/).map((item) => item.replace('$(BTLANMSPRGFXDIR)', 'graphics/battle_anims/sprites').replace(/\.4bpp$/, '.png'));
      if (parts?.length && parts.every((file) => fs.existsSync(path.join(ROOT, 'public/pokeemerald', file)))) return parts;
    }
    throw new Error(`Missing asset ${png}`);
  }
  return png;
}
function readPalette(file) {
  if (file.endsWith('.pal')) return read(file).trim().split(/\r?\n/).slice(3).map((line) => line.split(/\s+/).map(Number));
  const bytes = fs.readFileSync(path.join(ROOT, 'public/pokeemerald', file));
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'PLTE') {
      const colors = [];
      for (let i = 0; i < length; i += 3) colors.push([...bytes.subarray(offset + 8 + i, offset + 11 + i)]);
      return colors;
    }
    offset += length + 12;
  }
  throw new Error(`No indexed palette in ${file}`);
}
for (const name of rollout.spriteTemplates) {
  const owner = cSources.find(({ text }) => text.includes(`struct SpriteTemplate ${name} =`));
  if (!owner) throw new Error(`Missing template ${name}`);
  const body = owner.text.match(new RegExp(`struct SpriteTemplate ${name} =\\s*\\{([\\s\\S]*?)\\};`))[1];
  const fields = Object.fromEntries([...body.matchAll(/\.(\w+)\s*=\s*&?(\w+)/g)].map((m) => [m[1], m[2]]));
  const dimensions = fields.oam.match(/_(\d+)x(\d+)$/);
  const tag = constants.evaluate(fields.tileTag);
  templates[name] = {
    callback: fields.callback, tag, width: Number(dimensions?.[1] ?? 0), height: Number(dimensions?.[2] ?? 0),
    blend: fields.oam.includes('ObjBlend'), affine: /Affine(Normal|Double)/.test(fields.oam),
    ...(rollout.extraFrames?.[name] ? { extraFrames: rollout.extraFrames[name] } : {}),
    frames: animationTables(owner.text, fields.anims, false),
    affineFrames: animationTables(owner.text, fields.affineAnims, true),
    source: `${owner.file}:${owner.text.slice(0, owner.text.indexOf(`struct SpriteTemplate ${name} =`)).split('\n').length}`,
  };
  if (tag === 0) continue;
  const gfx = tables.match(new RegExp(`\\{(\\w+),\\s*(0x[\\da-f]+|\\d+),\\s*${fields.tileTag}\\}`, 'i'));
  const pal = tables.match(new RegExp(`\\{(\\w+),\\s*${fields.paletteTag}\\}`));
  if (!gfx || !pal) throw new Error(`Missing tag tables ${name}`);
  const paths = [assetPath(gfx[1], 'graphics')].flat().map((file) => `/pokeemerald/${file}`);
  assets[tag] = { path: paths[0], ...(paths.length > 1 ? { parts: paths } : {}), palette: readPalette(assetPath(pal[1], 'palette')), byteSize: Number(gfx[2]) };
}
const backgrounds = {};
for (const name of rollout.backgrounds ?? []) {
  const match = tables.match(new RegExp(`\\[${name}\\]\\s*=\\s*\\{(\\w+),\\s*(\\w+),\\s*(\\w+)\\}`));
  if (!match) throw new Error(`Missing background ${name}`);
  const mapFile = graphics.match(new RegExp(`\\b${match[3]}\\[\\]\\s*=\\s*INCBIN_U\\d+\\("([^"]+)"\\)`))[1].replace(/\.lz$/, '');
  backgrounds[constants.resolve(name)] = { path: `/pokeemerald/${assetPath(match[1], 'graphics')}`,
    tilemap: `/pokeemerald/${mapFile}`, palette: readPalette(assetPath(match[2], 'palette')),
    cycleColors: name === 'BG_PSYCHIC' ? 11 : 0 };
}
const addresses = [...new Set(rollout.moveLabels.flatMap((label) => {
  if (!compiled.dependencies[label]) throw new Error(`Unknown rollout root ${label}`);
  return compiled.dependencies[label].addresses;
}))].sort((a, b) => a - b);
const remap = new Map(addresses.map((pc, i) => [pc, i]));
const labels = Object.fromEntries(Object.entries(compiled.labels).filter(([, pc]) => remap.has(pc)).map(([label, pc]) => [label, remap.get(pc)]));
const instructions = addresses.map((pc) => compiled.instructions[pc]);
const moveEntries = Object.fromEntries(compiled.tables.move.map((label, id) => [id, label]).filter(([, label]) => rollout.moveLabels.includes(label)));
const quietMoveNames = source.match(/gMovesWithQuietBGM::\s*\.2byte ([^\n]+)/)[1].split(',').map((name) => name.trim()).filter((name) => name.startsWith('MOVE_'));
const quietMoves = quietMoveNames.map((moveName) => ({ moveId: constants.resolve(moveName), moveName }));
const banner = '// Auto-generated; do not edit.\n// Source: public/pokeemerald/data/battle_anim_scripts.s and src/battle_anim*.c\n// Regenerate: npm run generate:battle-animations\n';
function write(file, text) { fs.writeFileSync(path.join(ROOT, file), text); }
write('src/data/battleAnimationPrograms.gen.ts', `${banner}import type { AnimationProgram, AnimationTemplate, AnimationAsset, AnimationBackground } from '../battle/animation/types.ts';\n\nexport const BATTLE_ANIMATION_PROGRAM: AnimationProgram = ${JSON.stringify({ sourceHash, instructions, labels, moveEntries }, null, 2)};\n\nexport const BATTLE_ANIMATION_TEMPLATES: Readonly<Record<string, AnimationTemplate>> = ${JSON.stringify(templates, null, 2)};\n\nexport const BATTLE_ANIMATION_ASSETS: Readonly<Record<number, AnimationAsset>> = ${JSON.stringify(assets, null, 2)};\n\nexport const BATTLE_ANIMATION_BACKGROUNDS: Readonly<Record<number, AnimationBackground>> = ${JSON.stringify(backgrounds, null, 2)};\n`);
fs.appendFileSync(path.join(ROOT, 'src/data/battleAnimationPrograms.gen.ts'), `\nexport const BATTLE_ANIMATION_SINE: readonly number[] = ${JSON.stringify(sineTable)};\n`);
// Full import/inventory stays separate from the small shipped program.
const inventory = Object.fromEntries(Object.entries(compiled.dependencies).map(([label, { addresses, ...dep }]) => [label, { ...dep, instructionCount: addresses.length }]));
write('src/data/battleAnimationInventory.gen.json', JSON.stringify({ sourceHash, tables: compiled.tables, dependencies: inventory, note: 'Static script closure; callback-created children require explicit behavior declarations. Audio is deferred.' }, null, 2) + '\n');
const entryTable = (domain) => compiled.tables[domain].map((label, index) => domain === 'move' ? { moveId: index, moveName: label.replace(/^Move_/, 'MOVE_'), scriptLabel: label } : { index, scriptLabel: label });
write('src/data/battleAnimations.gen.ts', `${banner}\nexport interface MoveAnimationScriptEntry { moveId: number; moveName: string; scriptLabel: string }\nexport interface IndexedAnimationScriptEntry { index: number; scriptLabel: string }\nexport const MOVES_WITH_QUIET_BGM = ${JSON.stringify(quietMoves)};\nexport const MOVE_ANIMATION_SCRIPTS = ${JSON.stringify(entryTable('move'), null, 2)};\nexport const STATUS_ANIMATION_SCRIPTS = ${JSON.stringify(entryTable('status'), null, 2)};\nexport const GENERAL_ANIMATION_SCRIPTS = ${JSON.stringify(entryTable('general'), null, 2)};\nexport const SPECIAL_ANIMATION_SCRIPTS = ${JSON.stringify(entryTable('special'), null, 2)};\nexport const BATTLE_ANIMATION_SCRIPTS: Record<string, string[]> = ${JSON.stringify(compiled.rawBlocks, null, 2)};\nexport const BATTLE_ANIMATION_LABELS: Record<string, number> = ${JSON.stringify(compiled.labels)};\nexport function getMoveAnimationScript(moveId: number) { return MOVE_ANIMATION_SCRIPTS[moveId]; }\n`);
console.log(`Imported ${compiled.instructions.length} commands across ${Object.keys(compiled.labels).length} labels; ${Object.values(compiled.tables).flat().length} roots. Shipped ${instructions.length} instructions for ${rollout.moveLabels.join(', ')}.`);
