import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseGen3Save } from '../Gen3SaveParser.ts';
import { BUILTIN_SAVE_LAYOUT_PROFILES, buildSaveLayoutProfiles } from '../Gen3LayoutProfiles.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../');

function loadSampleSave(relativePath: string): ArrayBuffer {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const data = readFileSync(fullPath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

test('buildSaveLayoutProfiles applies base-profile overrides', () => {
  const profiles = buildSaveLayoutProfiles([
    {
      id: 'emerald_custom_test',
      baseProfileId: 'emerald_vanilla',
      displayName: 'Emerald custom test profile',
      saveBlock1: {
        FLAGS: 0x2222,
      },
    },
  ]);

  const custom = profiles.find((profile) => profile.id === 'emerald_custom_test');
  assert.ok(custom);
  assert.equal(custom.saveBlock1.FLAGS, 0x2222);
  assert.equal(custom.saveBlock1.MONEY, 0x490);
  assert.equal(custom.supportLevel, 'experimental');
});

test('parseGen3Save accepts explicit layout profile list', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav', {
    layoutProfiles: BUILTIN_SAVE_LAYOUT_PROFILES,
  });

  assert.equal(result.success, true);
  assert.ok(result.nativeMetadata);
  assert.equal(result.nativeMetadata.layoutProfileId, 'emerald_vanilla');
});

test('parseGen3Save returns explicit error when no profiles are provided', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav', {
    layoutProfiles: [],
  });

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /No layout profiles/i);
});
