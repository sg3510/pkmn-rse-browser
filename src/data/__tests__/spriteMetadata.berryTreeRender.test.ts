import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { getBerryTreeRenderConfig } from '../spriteMetadata.ts';

const FIRST_BERRY_ITEM_ID = 133;
const LAST_BERRY_ITEM_ID = 175;

test('berryTreeRender metadata covers berry items 133..175 with valid frame sources', () => {
  const config = getBerryTreeRenderConfig();

  for (let itemId = FIRST_BERRY_ITEM_ID; itemId <= LAST_BERRY_ITEM_ID; itemId++) {
    const picTable = config.berryItemToPicTable[String(itemId)];
    assert.ok(picTable, `missing pic table mapping for berry item ${itemId}`);

    const frameSources = config.picTableFrameSources[picTable];
    assert.ok(frameSources, `missing frame sources for pic table ${picTable}`);
    assert.ok(frameSources.length >= 9, `expected at least 9 frame sources for ${picTable}`);

    for (let frameIndex = 0; frameIndex <= 8; frameIndex++) {
      const frame = frameSources[frameIndex];
      assert.ok(frame, `missing frame ${frameIndex} for ${picTable}`);
      assert.ok(frame.spritePath.startsWith('/berry_trees/'), `unexpected sprite path ${frame.spritePath}`);
      assert.ok(frame.frameWidth > 0, `invalid frame width for ${picTable}[${frameIndex}]`);
      assert.ok(frame.frameHeight > 0, `invalid frame height for ${picTable}[${frameIndex}]`);

      const filePath = path.join(
        process.cwd(),
        'public/pokeemerald/graphics/object_events/pics',
        frame.spritePath.replace(/^\//, '')
      );
      assert.ok(fs.existsSync(filePath), `missing berry sprite asset ${filePath}`);
    }
  }
});
