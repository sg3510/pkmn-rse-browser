import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isBerryTreeGraphicsId,
  listBerryTreeAtlasDescriptors,
  resolveBerryTreeSpriteFrame,
} from '../berryTreeSpriteResolver.ts';
import { BERRY_STAGE } from '../../game/berry/berryConstants.ts';

test('resolveBerryTreeSpriteFrame returns null for NO_BERRY stage', () => {
  const frame = resolveBerryTreeSpriteFrame(1, BERRY_STAGE.NO_BERRY);
  assert.equal(frame, null);
});

test('resolveBerryTreeSpriteFrame maps PLANTED to dirt and BERRIES to berry-specific art', () => {
  const planted = resolveBerryTreeSpriteFrame(1, BERRY_STAGE.PLANTED);
  assert.ok(planted);
  assert.equal(planted.spritePath, '/berry_trees/dirt_pile.png');
  assert.equal(planted.width, 16);
  assert.equal(planted.height, 16);

  const sprouted = resolveBerryTreeSpriteFrame(1, BERRY_STAGE.SPROUTED);
  assert.ok(sprouted);
  assert.equal(sprouted.spritePath, '/berry_trees/sprout.png');
  assert.equal(sprouted.width, 16);
  assert.equal(sprouted.height, 16);

  const pechaBerries = resolveBerryTreeSpriteFrame(3, BERRY_STAGE.BERRIES);
  const oranBerries = resolveBerryTreeSpriteFrame(7, BERRY_STAGE.BERRIES);
  assert.ok(pechaBerries);
  assert.ok(oranBerries);
  assert.equal(pechaBerries.width, 16);
  assert.equal(pechaBerries.height, 32);
  assert.equal(oranBerries.width, 16);
  assert.equal(oranBerries.height, 32);
  assert.equal(pechaBerries.spritePath, '/berry_trees/pecha.png');
  assert.equal(oranBerries.spritePath, '/berry_trees/oran.png');
});

test('listBerryTreeAtlasDescriptors includes mixed-source berry atlases', () => {
  const atlasPaths = new Set(listBerryTreeAtlasDescriptors().map((descriptor) => descriptor.spritePath));
  assert.ok(atlasPaths.has('/berry_trees/dirt_pile.png'));
  assert.ok(atlasPaths.has('/berry_trees/sprout.png'));
  assert.ok(atlasPaths.has('/berry_trees/pecha.png'));
  assert.ok(atlasPaths.has('/berry_trees/oran.png'));
});

test('isBerryTreeGraphicsId recognizes berry tree graphics IDs', () => {
  assert.equal(isBerryTreeGraphicsId('OBJ_EVENT_GFX_BERRY_TREE'), true);
  assert.equal(isBerryTreeGraphicsId('OBJ_EVENT_GFX_BERRY_TREE_EARLY_STAGES'), true);
  assert.equal(isBerryTreeGraphicsId('OBJ_EVENT_GFX_BERRY_TREE_LATE_STAGES'), true);
  assert.equal(isBerryTreeGraphicsId('OBJ_EVENT_GFX_BOY_1'), false);
});
