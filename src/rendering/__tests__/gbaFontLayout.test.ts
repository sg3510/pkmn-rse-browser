import assert from 'node:assert/strict';
import test from 'node:test';
import { GBA_FONT_WIDTHS, GBA_GLYPHS } from '../../data/gbaFonts.gen.ts';

const width = (text: string, font: keyof typeof GBA_FONT_WIDTHS) => [...text].reduce(
  (sum, char) => sum + GBA_FONT_WIDTHS[font][GBA_GLYPHS[char]], 0,
);

test('ten-character names, gender and level 100 fit the original 80px heading', () => {
  for (const name of ['CHARMANDER', 'BUTTERFREE', 'POOCHYENA', 'FARFETCH’D']) {
    for (const gender of ['♂', '♀']) {
      assert.ok(width(name + gender + '⒧100', 'small') <= 80, `${name}${gender} level 100`);
    }
  }
});

test('the narrow battle font fits long move names in their 64px windows', () => {
  for (const name of ['ANCIENTPOWER', 'FEATHERDANCE', 'THUNDERPUNCH', 'SOLARBEAM']) {
    assert.ok(width(name, 'narrow') <= 64, name);
  }
  assert.ok(width('ANCIENTPOWER', 'normal') > 64, 'the normal font reproduces the old overflow');
});
