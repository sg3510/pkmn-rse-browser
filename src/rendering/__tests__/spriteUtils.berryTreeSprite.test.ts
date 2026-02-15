import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSortKey, createScriptObjectSpriteInstance } from '../spriteUtils.ts';
import { berryManager } from '../../game/berry/BerryManager.ts';
import { BERRY_STAGE } from '../../game/berry/berryConstants.ts';
import type { ScriptObject } from '../../types/objectEvents.ts';
import { resolveBerryTreeSpriteFrame } from '../../utils/berryTreeSpriteResolver.ts';

function makeBerryScriptObject(): ScriptObject {
  return {
    id: 'MAP_ROUTE119_script_1',
    mapId: 'MAP_ROUTE119',
    localId: '1',
    localIdNumber: 1,
    tileX: 28,
    tileY: 90,
    elevation: 3,
    graphicsId: 'OBJ_EVENT_GFX_BERRY_TREE',
    script: 'BerryTreeScript',
    flag: '0',
    visible: true,
    berryTreeId: 34,
  };
}

test('berry script objects are hidden when stage is NO_BERRY', () => {
  berryManager.reset();
  berryManager.setBerryTree(34, 3, BERRY_STAGE.NO_BERRY, true);
  const sprite = createScriptObjectSpriteInstance(makeBerryScriptObject(), 123);
  assert.equal(sprite, null);
});

test('PLANTED berry script objects use 16x16 dirt frame anchoring', () => {
  berryManager.reset();
  berryManager.setBerryTree(34, 3, BERRY_STAGE.PLANTED, true);
  const sprite = createScriptObjectSpriteInstance(makeBerryScriptObject(), 456);
  const resolved = resolveBerryTreeSpriteFrame(3, BERRY_STAGE.PLANTED);

  assert.ok(sprite);
  assert.ok(resolved);
  assert.equal(sprite.atlasName, resolved.atlasName);
  assert.equal(sprite.atlasWidth, 16);
  assert.equal(sprite.atlasHeight, 16);
  assert.equal(sprite.width, 16);
  assert.equal(sprite.height, 16);
  assert.equal(sprite.worldY, makeBerryScriptObject().tileY * 16);
  const expectedFeetY = makeBerryScriptObject().tileY * 16 + 16;
  assert.equal(sprite.worldY + sprite.height, expectedFeetY);
  assert.equal(calculateSortKey(sprite.worldY + sprite.height, 128), calculateSortKey(expectedFeetY, 128));
});

test('TALLER berry script objects use 16x32 berry-sheet anchoring', () => {
  berryManager.reset();
  berryManager.setBerryTree(34, 3, BERRY_STAGE.TALLER, true);
  const sprite = createScriptObjectSpriteInstance(makeBerryScriptObject(), 789);
  const resolved = resolveBerryTreeSpriteFrame(3, BERRY_STAGE.TALLER);

  assert.ok(sprite);
  assert.ok(resolved);
  assert.equal(sprite.atlasName, resolved.atlasName);
  assert.equal(sprite.atlasWidth, 16);
  assert.equal(sprite.atlasHeight, 32);
  assert.equal(sprite.width, 16);
  assert.equal(sprite.height, 32);
  assert.equal(sprite.worldY, makeBerryScriptObject().tileY * 16 - 16);
  const expectedFeetY = makeBerryScriptObject().tileY * 16 + 16;
  assert.equal(sprite.worldY + sprite.height, expectedFeetY);
  assert.equal(calculateSortKey(sprite.worldY + sprite.height, 128), calculateSortKey(expectedFeetY, 128));
});
