import assert from 'node:assert';
import test from 'node:test';
import { getSurfingFrameSelection } from '../playerFrameSelection';

test('getSurfingFrameSelection returns idle logical frames', () => {
  assert.deepStrictEqual(getSurfingFrameSelection('down', false), { logicalFrame: 0, flip: false });
  assert.deepStrictEqual(getSurfingFrameSelection('up', false), { logicalFrame: 1, flip: false });
  assert.deepStrictEqual(getSurfingFrameSelection('left', false), { logicalFrame: 2, flip: false });
  assert.deepStrictEqual(getSurfingFrameSelection('right', false), { logicalFrame: 2, flip: true });
});

test('getSurfingFrameSelection returns mount/dismount logical frames', () => {
  assert.deepStrictEqual(getSurfingFrameSelection('down', true), { logicalFrame: 9, flip: false });
  assert.deepStrictEqual(getSurfingFrameSelection('up', true), { logicalFrame: 10, flip: false });
  assert.deepStrictEqual(getSurfingFrameSelection('left', true), { logicalFrame: 11, flip: false });
  assert.deepStrictEqual(getSurfingFrameSelection('right', true), { logicalFrame: 11, flip: true });
});
