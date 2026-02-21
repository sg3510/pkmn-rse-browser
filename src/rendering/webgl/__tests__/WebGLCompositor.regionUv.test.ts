import assert from 'node:assert/strict';
import test from 'node:test';
import { computeCompositeRegionUv } from '../compositeRegionUv.ts';

test('maps top-left source Y to bottom-left UV origin', () => {
  const uv = computeCompositeRegionUv(
    336, // pass texture width
    176, // pass texture height (11 tiles)
    0,
    0,
    320, // viewport width (20 tiles)
    160 // viewport height (10 tiles)
  );

  assert.equal(uv.uvOffsetX, 0);
  assert.equal(uv.uvScaleX, 320 / 336);
  assert.equal(uv.uvScaleY, 160 / 176);
  assert.equal(uv.uvOffsetY, 16 / 176);
});

test('positive sourceY scrolls downward without sign inversion', () => {
  const uv = computeCompositeRegionUv(336, 176, 0, 8, 320, 160);
  assert.equal(uv.uvOffsetY, 8 / 176);
});

test('clamps source and region to valid bounds', () => {
  const uv = computeCompositeRegionUv(100, 50, -20, 60, 200, 100);

  assert.equal(uv.uvOffsetX, 0);
  assert.equal(uv.uvOffsetY, 0);
  assert.equal(uv.uvScaleX, 1);
  assert.equal(uv.uvScaleY, 1 / 50);
});
