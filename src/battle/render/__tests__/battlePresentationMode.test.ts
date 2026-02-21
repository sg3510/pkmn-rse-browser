import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBattlePresentationMode } from '../battlePresentationMode.ts';

test('15x10 uses dedicated battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 15, tilesHigh: 10 }), 'dedicated');
});

test('17x12 (GBA +2) still uses dedicated battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 17, tilesHigh: 12 }), 'dedicated');
});

test('18x12 uses dedicated battle presentation (height gate not met)', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 18, tilesHigh: 12 }), 'dedicated');
});

test('17x13 uses dedicated battle presentation (width gate not met)', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 17, tilesHigh: 13 }), 'dedicated');
});

test('18x13 uses overlay battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 18, tilesHigh: 13 }), 'overlay');
});

test('30x30 uses overlay battle presentation', () => {
  assert.equal(getBattlePresentationMode({ tilesWide: 30, tilesHigh: 30 }), 'overlay');
});
