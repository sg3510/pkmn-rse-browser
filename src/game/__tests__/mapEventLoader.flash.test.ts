import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMapRequiresFlash } from '../mapRequiresFlash.ts';

test('parseMapRequiresFlash reads requires_flash map metadata', () => {
  assert.equal(parseMapRequiresFlash(true), true);
  assert.equal(parseMapRequiresFlash(false), false);
  assert.equal(parseMapRequiresFlash(undefined), false);
  assert.equal(parseMapRequiresFlash('true'), false);
  assert.equal(parseMapRequiresFlash(1), false);
});
