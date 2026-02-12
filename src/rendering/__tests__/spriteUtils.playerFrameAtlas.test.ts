import assert from 'node:assert';
import test from 'node:test';
import { createSpriteFromFrameInfo, getPlayerAtlasName } from '../spriteUtils';
import type { FrameInfo } from '../../game/PlayerController';

function makeFrameInfo(spriteKey: FrameInfo['spriteKey']): FrameInfo {
  return {
    spriteKey,
    sprite: {} as HTMLCanvasElement,
    sx: 32,
    sy: 0,
    sw: 32,
    sh: 32,
    renderX: 100,
    renderY: 200,
    flip: false,
  };
}

test('createSpriteFromFrameInfo derives atlas name from frameInfo.spriteKey', () => {
  const sprite = createSpriteFromFrameInfo(makeFrameInfo('surfing'), 999);
  assert.strictEqual(sprite.atlasName, getPlayerAtlasName('surfing'));
});

test('createSpriteFromFrameInfo clips to top half when requested', () => {
  const sprite = createSpriteFromFrameInfo(makeFrameInfo('underwater'), 999, true);
  assert.strictEqual(sprite.height, 16);
  assert.strictEqual(sprite.atlasHeight, 16);
});
