const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { compile, createConstants } = require('../lib/battle-animation-compiler.cjs');
const constants = createConstants(['#define BASE 10000\n#define TAG (BASE + 135)\nenum { ZERO, ONE, TWO, FOUR = 4, FIVE };']);
const source = (body) => `gBattleAnims_Moves::\n .4byte Move_NONE\nMove_NONE:\n${body}`;
test('explicit constant parser handles enum references, signed/bit expressions and RGB', () => {
  assert.equal(constants.evaluate('(TAG - BASE) | (FIVE << 8)'), 1415);
  assert.equal(constants.evaluate('RGB(31, 0, 8)'), 8223);
  assert.equal(constants.evaluate('-0x80'), -128);
  assert.throws(() => constants.evaluate('process.exit()'), /Unsupported/);
  assert.throws(() => constants.evaluate('MISSING'), /Unknown constant/);
});
test('aliases, fallthrough, helper calls and conditional branches are all in the dependency closure', () => {
  const out = compile(source('Alias:\n call Helper\n jumpargeq 0, 1, Alternate\n end\nHelper:\n createsprite gOne, 0, 2\n return\nAlternate:\n createsprite gTwo, 0, 2\n goto Done\nDone:\n end'), constants);
  assert.equal(out.labels.Alias, out.labels.Move_NONE);
  assert.deepEqual(out.dependencies.Move_NONE.sprites, ['gOne', 'gTwo']);
  assert.deepEqual(out.dependencies.Move_NONE.helpers, ['Alternate', 'Done', 'Helper']);
});
test('missing helper and bad expressions fail with source locations', () => {
  assert.throws(() => compile(source(' call Missing\n end'), constants), /Line 4: missing label Missing/);
  assert.throws(() => compile(source(' delay NOT_DEFINED\n end'), constants), /Line 4.*Unknown constant/);
});
test('all original roots compile deterministically, including Growl helper and first-eight dependencies', () => {
  const root = path.resolve(__dirname, '../../public/pokeemerald');
  const original = fs.readFileSync(path.join(root, 'data/battle_anim_scripts.s'), 'utf8');
  const headers = [...original.matchAll(/#include "([^"]+)"/g)].map((m) => fs.readFileSync(path.join(root, 'include', m[1]), 'utf8'));
  headers.push(fs.readFileSync(path.join(root, 'include/gba/io_reg.h'), 'utf8'));
  const constants = createConstants(headers), out = compile(original, constants);
  assert.deepEqual(out, compile(original, constants));
  assert.deepEqual(Object.values(out.tables).map((entries) => entries.length), [356, 9, 23, 7]);
  assert(out.dependencies.Move_GROWL.helpers.includes('RoarEffect'));
  for (const name of ['TACKLE', 'GROWL', 'POUND', 'SCRATCH', 'TAIL_WHIP', 'EMBER', 'WATER_GUN', 'ABSORB']) {
    assert(out.dependencies[`Move_${name}`].addresses.length > 0);
  }
});
