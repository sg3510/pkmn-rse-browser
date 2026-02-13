import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameFlags } from '../../../game/GameFlags.ts';
import { ObjectEventManager } from '../../../game/ObjectEventManager.ts';
import type { ObjectEventData } from '../../../types/objectEvents.ts';
import { saveStateStore } from '../../SaveStateStore.ts';
import { parseGen3Save } from '../Gen3SaveParser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../');

function loadSampleSave(relativePath: string): ArrayBuffer {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const data = readFileSync(fullPath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function loadMapJson(relativePath: string): {
  id: string;
  object_events: ObjectEventData[];
} {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const raw = JSON.parse(readFileSync(fullPath, 'utf8')) as {
    id: string;
    object_events?: ObjectEventData[];
  };
  return {
    id: raw.id,
    object_events: raw.object_events ?? [],
  };
}

function applyImportedEventState(raw: { rawFlags?: number[]; rawVars?: number[]; flags: string[] }): void {
  if (Array.isArray(raw.rawFlags) && Array.isArray(raw.rawVars)) {
    saveStateStore.replaceRawEventState(raw.rawFlags, raw.rawVars);
    saveStateStore.mergeNamedFlags(raw.flags);
    return;
  }
  gameFlags.loadFromArray(raw.flags);
}

function resetRuntimeState(): void {
  saveStateStore.resetRuntimeState();
}

test('start-menu flag gating stays enabled for imported vanilla saves', () => {
  resetRuntimeState();
  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav');

  assert.equal(result.success, true);
  assert.ok(result.saveData);
  applyImportedEventState(result.saveData);

  // Mirrors StartMenu.tsx gating logic.
  const hasPokedex = gameFlags.isSet('FLAG_SYS_POKEDEX_GET');
  const hasPokemon = gameFlags.isSet('FLAG_SYS_POKEMON_GET');

  assert.equal(hasPokedex, true);
  assert.equal(hasPokemon, true);
});

test('Littleroot truck and mom visibility follow imported flag state', () => {
  resetRuntimeState();

  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav');

  assert.equal(result.success, true);
  assert.ok(result.saveData);
  applyImportedEventState(result.saveData);

  const littlerootMap = loadMapJson('public/pokeemerald/data/maps/LittlerootTown/map.json');

  const manager = new ObjectEventManager();
  manager.parseMapObjects(littlerootMap.id, littlerootMap.object_events, 0, 0);

  const visibleTrucks = manager
    .getVisibleLargeObjects()
    .filter((obj) => obj.graphicsId === 'OBJ_EVENT_GFX_TRUCK');
  assert.equal(visibleTrucks.length, 0);

  const momOutside = manager
    .getAllNPCs()
    .find((npc) => npc.localId === 'LOCALID_LITTLEROOT_MOM');
  assert.ok(momOutside);
  assert.equal(momOutside.visible, false);
});

test('Route 102 item-ball flags keep already-collected items hidden', () => {
  resetRuntimeState();

  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav');

  assert.equal(result.success, true);
  assert.ok(result.saveData);
  applyImportedEventState(result.saveData);

  const route102Map = loadMapJson('public/pokeemerald/data/maps/Route102/map.json');

  const manager = new ObjectEventManager();
  manager.parseMapObjects(route102Map.id, route102Map.object_events, 0, 0);

  const potionBall = manager
    .getAllItemBalls()
    .find((ball) => ball.flag === 'FLAG_ITEM_ROUTE_102_POTION');

  assert.ok(potionBall);
  assert.equal(potionBall.collected, true);
  assert.equal(manager.getVisibleItemBalls().some((ball) => ball.id === potionBall.id), false);
});

test('native object event runtime restores Petalburg bug catcher at map-local coords', () => {
  resetRuntimeState();

  const buffer = loadSampleSave('public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav');
  const result = parseGen3Save(buffer, 'Pokemon - Emerald Version (USA, Europe) 2.sav');

  assert.equal(result.success, true);
  assert.ok(result.saveData);
  assert.ok(result.saveData.objectEventRuntimeState);

  const petalburgMap = loadMapJson('public/pokeemerald/data/maps/PetalburgWoods/map.json');
  const manager = new ObjectEventManager();
  manager.parseMapObjects(petalburgMap.id, petalburgMap.object_events, 0, 0);
  manager.applyRuntimeState(result.saveData.objectEventRuntimeState);

  const bugCatcher = manager.getNPCByLocalId(petalburgMap.id, '9');
  assert.ok(bugCatcher);
  assert.equal(bugCatcher.tileX, 7);
  assert.equal(bugCatcher.tileY, 32);
});

test('Emerald Legacy profile enables menu system flags and hides Littleroot trucks', () => {
  resetRuntimeState();

  const buffer = loadSampleSave(
    'public/sample_save/Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav'
  );
  const result = parseGen3Save(
    buffer,
    'Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav'
  );

  assert.equal(result.success, true);
  assert.ok(result.nativeMetadata);
  assert.equal(result.nativeMetadata.layoutProfileId, 'emerald_legacy_604');
  assert.equal(result.nativeMetadata.layoutSupported, true);
  assert.ok(result.saveData);
  applyImportedEventState(result.saveData);

  // Start-menu parity checks.
  assert.equal(gameFlags.isSet('FLAG_SYS_POKEMON_GET'), true);
  assert.equal(gameFlags.isSet('FLAG_SYS_POKEDEX_GET'), true);

  const littlerootMap = loadMapJson('public/pokeemerald/data/maps/LittlerootTown/map.json');
  const manager = new ObjectEventManager();
  manager.parseMapObjects(littlerootMap.id, littlerootMap.object_events, 0, 0);

  const visibleTrucks = manager
    .getVisibleLargeObjects()
    .filter((obj) => obj.graphicsId === 'OBJ_EVENT_GFX_TRUCK');
  assert.equal(visibleTrucks.length, 0);
});

test('object runtime snapshots stay aligned across map re-anchors and numeric local-id restore', () => {
  resetRuntimeState();

  const route101Map = loadMapJson('public/pokeemerald/data/maps/Route101/map.json');

  // Initial stitched world where Route 101 is at y = -20 (e.g. anchored from Littleroot).
  const initial = new ObjectEventManager();
  initial.parseMapObjects(route101Map.id, route101Map.object_events, 0, -20);
  const snapshot = initial.getRuntimeState();

  assert.equal(snapshot.coordSpace, 'mapLocal');
  const birchKey = 'MAP_ROUTE101_npc_LOCALID_ROUTE101_BIRCH';
  const birchSnapshot = snapshot.npcs[birchKey];
  assert.ok(birchSnapshot);
  assert.equal(birchSnapshot.tileY, 13); // local y, not world y (-7)

  // Simulate a fresh world where Route 101 is re-anchored to y = 0.
  const reanchored = new ObjectEventManager();
  reanchored.parseMapObjects(route101Map.id, route101Map.object_events, 0, 0);

  // Simulate native save payload style keyed by numeric local IDs.
  const nativeLike = {
    ...snapshot,
    npcs: {
      ...snapshot.npcs,
      MAP_ROUTE101_npc_2: birchSnapshot,
    },
  };
  delete nativeLike.npcs[birchKey];

  reanchored.applyRuntimeState(nativeLike);
  const birch = reanchored.getNPCByLocalId(route101Map.id, 'LOCALID_ROUTE101_BIRCH');

  assert.ok(birch);
  assert.equal(birch.tileX, 9);
  assert.equal(birch.tileY, 13);
});
