import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseGen3Save } from '../Gen3SaveParser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../');

function loadSampleSave(relativePath: string): ArrayBuffer {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const data = readFileSync(fullPath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

test('parses vanilla Emerald sample with supported layout profile', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav');

  assert.equal(result.success, true);
  assert.ok(result.saveData);
  assert.ok(result.nativeMetadata);

  assert.equal(result.nativeMetadata.layoutSupported, true);
  assert.equal(result.nativeMetadata.layoutProfileId, 'emerald_vanilla');
  assert.equal(result.nativeMetadata.sanity.level, 'high');

  assert.equal(result.saveData.flags.includes('FLAG_SYS_POKEMON_GET'), true);
  assert.equal(result.saveData.flags.includes('FLAG_SYS_POKEDEX_GET'), true);
});

test('unwraps wrapped Emerald sample and still parses successfully', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 1.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 1.sav');

  assert.equal(result.success, true);
  assert.ok(result.nativeMetadata);

  assert.equal(result.nativeMetadata.layoutSupported, true);
  assert.ok(
    result.nativeMetadata.sourceFormat === 'sharkport' ||
      result.nativeMetadata.sourceFormat === 'wrapped'
  );
});

test('parses Emerald Legacy sample with dedicated profile', () => {
  const buffer = loadSampleSave(
    'public/sample_save/Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav'
  );
  const result = parseGen3Save(
    buffer,
    'Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav'
  );

  assert.equal(result.success, true);
  assert.ok(result.saveData);
  assert.ok(result.nativeMetadata);

  assert.equal(result.nativeMetadata.layoutProfileId, 'emerald_legacy_604');
  assert.equal(result.nativeMetadata.layoutSupported, true);
  assert.equal(result.nativeMetadata.sanity.level, 'high');
  assert.equal(result.saveData.flags.includes('FLAG_SYS_POKEMON_GET'), true);
  assert.equal(result.saveData.flags.includes('FLAG_SYS_POKEDEX_GET'), true);
});

test('rejects mislabeled PNG save artifact', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 1.sav.ss0');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 1.sav.ss0');

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /PNG/i);
});
