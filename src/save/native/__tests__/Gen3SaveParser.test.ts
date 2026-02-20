import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseGen3Save } from '../Gen3SaveParser.ts';
import {
  SAVEBLOCK1,
  SAVE_SIGNATURE,
  SAVE_SLOT_SIZE,
  SECTOR_FOOTER,
  SECTOR_SIZE,
  SECTORS_PER_SLOT,
} from '../Gen3Constants.ts';
import { clampFlashLevel } from '../../../game/flash/FlashController.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../');

function loadSampleSave(relativePath: string): ArrayBuffer {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const data = readFileSync(fullPath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function buildSectionMap(view: DataView, slotOffset: number): { sections: Map<number, number>; saveCounter: number } {
  const sections = new Map<number, number>();
  let saveCounter = 0;
  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    const sectorOffset = slotOffset + i * SECTOR_SIZE;
    const signature = view.getUint32(sectorOffset + SECTOR_FOOTER.SIGNATURE, true);
    if (signature !== SAVE_SIGNATURE) continue;
    const sectionId = view.getUint16(sectorOffset + SECTOR_FOOTER.SECTION_ID, true);
    if (sectionId >= SECTORS_PER_SLOT) continue;
    sections.set(sectionId, sectorOffset);
    if (sectionId === 0) {
      saveCounter = view.getUint32(sectorOffset + SECTOR_FOOTER.SAVE_COUNTER, true);
    }
  }
  return { sections, saveCounter };
}

function hasAllSections(sections: Map<number, number>): boolean {
  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    if (!sections.has(i)) return false;
  }
  return true;
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
  assert.ok(result.saveData.berry);
  assert.equal(result.saveData.berry?.trees.length, 128);
  assert.ok(result.saveData.berry?.lastUpdateRtc);
  assert.ok((result.saveData.berry?.lastUpdateRtc?.days ?? 0) >= 0);

  assert.equal(result.saveData.flags.includes('FLAG_SYS_POKEMON_GET'), true);
  assert.equal(result.saveData.flags.includes('FLAG_SYS_POKEDEX_GET'), true);
  assert.ok(result.saveData.objectEventRuntimeState);
  assert.equal(result.saveData.objectEventRuntimeState.coordSpace, 'mapLocal');
  const petalburgBugCatcher = result.saveData.objectEventRuntimeState.npcs.MAP_PETALBURG_WOODS_npc_9;
  assert.ok(petalburgBugCatcher);
  assert.equal(petalburgBugCatcher.tileX, 7);
  assert.equal(petalburgBugCatcher.tileY, 32);
  assert.equal(petalburgBugCatcher.initialTileX, 7);
  assert.equal(petalburgBugCatcher.initialTileY, 32);
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
  assert.ok(result.saveData.objectEventRuntimeState);
  assert.equal(result.saveData.objectEventRuntimeState.coordSpace, 'mapLocal');
});

test('rejects mislabeled PNG save artifact', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 1.sav.ss0');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 1.sav.ss0');

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /PNG/i);
});

test('parses SaveBlock1 flashLevel into location.flashLevel', () => {
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav');
  assert.equal(result.success, true);
  assert.ok(result.saveData);

  const view = new DataView(buffer);
  const slotA = buildSectionMap(view, 0);
  const slotB = buildSectionMap(view, SAVE_SLOT_SIZE);
  const validA = hasAllSections(slotA.sections);
  const validB = hasAllSections(slotB.sections);
  assert.equal(validA || validB, true);

  const active = validB && (!validA || slotB.saveCounter >= slotA.saveCounter) ? slotB : slotA;
  const section1Offset = active.sections.get(1);
  assert.notEqual(section1Offset, undefined);

  const rawFlashLevel = view.getUint8((section1Offset as number) + SAVEBLOCK1.FLASH_LEVEL);
  assert.equal(result.saveData.location.flashLevel, clampFlashLevel(rawFlashLevel));
});
