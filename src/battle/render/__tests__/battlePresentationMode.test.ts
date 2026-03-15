import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBattlePresentationMode } from '../battlePresentationMode.ts';

test('15x10 uses scene battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 15, tilesHigh: 10 }), 'scene');
});

test('17x12 (GBA +2) still uses scene battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 17, tilesHigh: 12 }), 'scene');
});

test('18x12 uses scene battle presentation (height gate not met)', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 18, tilesHigh: 12 }), 'scene');
});

test('17x13 uses scene battle presentation (width gate not met)', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 17, tilesHigh: 13 }), 'scene');
});

test('18x13 uses overlay battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 18, tilesHigh: 13 }), 'overlay');
});

test('30x30 uses overlay battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 30, tilesHigh: 30 }), 'overlay');
});

test('scene preference keeps the dedicated shell even on large viewports', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 30, tilesHigh: 30 }, 'scene'), 'scene');
});
