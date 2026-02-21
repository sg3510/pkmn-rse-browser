import assert from 'node:assert/strict';
import test from 'node:test';
import type { SpriteInstance } from '../../types.ts';
import { __testMergeSortedSpritesInPlace } from '../renderOverworldSprites.ts';

function sprite(id: string, sortKey: number): SpriteInstance {
  return {
    worldX: 0,
    worldY: 0,
    width: 16,
    height: 16,
    atlasName: id,
    atlasX: 0,
    atlasY: 0,
    atlasWidth: 16,
    atlasHeight: 16,
    flipX: false,
    flipY: false,
    alpha: 1,
    tintR: 1,
    tintG: 1,
    tintB: 1,
    sortKey,
    isReflection: false,
  };
}

test('merge helper keeps target reference and sort order', () => {
  const target = [
    sprite('base-1', 10),
    sprite('base-2', 20),
    sprite('base-3', 30),
  ];
  const additions = [
    sprite('add-3', 35),
    sprite('add-1', 15),
    sprite('add-2', 25),
  ];
  const scratch: SpriteInstance[] = [];

  const merged = __testMergeSortedSpritesInPlace(target, additions, scratch);
  assert.equal(merged, target);
  assert.deepEqual(
    merged.map((entry) => entry.atlasName),
    ['base-1', 'add-1', 'base-2', 'add-2', 'base-3', 'add-3']
  );
});

test('merge helper preserves stable ordering for equal sort keys', () => {
  const target = [
    sprite('base-a', 10),
    sprite('base-b', 20),
  ];
  const additions = [
    sprite('add-a', 20),
    sprite('add-b', 20),
  ];
  const scratch: SpriteInstance[] = [];

  __testMergeSortedSpritesInPlace(target, additions, scratch);
  assert.deepEqual(
    target.map((entry) => entry.atlasName),
    ['base-a', 'base-b', 'add-a', 'add-b']
  );
});
