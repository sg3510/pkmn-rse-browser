import assert from 'node:assert/strict';
import test from 'node:test';
import { getFieldEffectDimensions, getFieldEffectYOffset } from '../fieldEffectUtils.ts';

test('GROUND_IMPACT_DUST uses feet-aligned offset and 16x8 dimensions', () => {
  assert.equal(getFieldEffectYOffset('GROUND_IMPACT_DUST'), 4);
  assert.deepEqual(getFieldEffectDimensions('GROUND_IMPACT_DUST'), { width: 16, height: 8 });
});
