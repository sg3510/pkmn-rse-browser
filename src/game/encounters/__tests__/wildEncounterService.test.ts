import assert from 'node:assert/strict';
import test from 'node:test';
import { SPECIES } from '../../../data/species.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import {
  MB_BRIDGE_OVER_OCEAN,
  MB_CAVE,
  MB_POND_WATER,
  MB_TALL_GRASS,
} from '../../../utils/metatileBehaviors.ts';
import {
  tryGenerateLandEncounter,
  tryGenerateStepEncounter,
  tryGenerateWaterEncounter,
} from '../wildEncounterService.ts';

function sequenceRandom(sequence: number[]): (maxExclusive: number) => number {
  const values = [...sequence];
  return (maxExclusive: number): number => {
    if (!Number.isFinite(maxExclusive) || maxExclusive <= 1) return 0;
    const next = values.length > 0 ? values.shift() as number : 0;
    const normalized = Math.trunc(next);
    return ((normalized % maxExclusive) + maxExclusive) % maxExclusive;
  };
}

test('does not trigger encounter outside grass behaviors', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 5 });
  const result = tryGenerateLandEncounter({
    mapId: 'MAP_ROUTE101',
    currentTileBehavior: 0,
    previousTileBehavior: 0,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    randomInt: sequenceRandom([0, 0, 0, 0]),
  });
  assert.equal(result, null);
});

test('land slot roll follows generated weighted thresholds', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 5 });
  const result = tryGenerateLandEncounter({
    mapId: 'MAP_ROUTE101',
    currentTileBehavior: MB_TALL_GRASS,
    previousTileBehavior: MB_TALL_GRASS,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    // [encounter check(2880), slot roll(100)]
    randomInt: sequenceRandom([0, 98]),
  });

  assert.ok(result);
  assert.equal(result.slotIndex, 10);
  assert.equal(result.species, SPECIES.ZIGZAGOON);
  assert.equal(result.level, 3);
});

test('new metatile transition can skip wild check (40% skip chance)', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 5 });
  const result = tryGenerateLandEncounter({
    mapId: 'MAP_ROUTE101',
    currentTileBehavior: MB_TALL_GRASS,
    previousTileBehavior: 0,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    // new-metatile allow check (>= 60 means skip)
    randomInt: sequenceRandom([99]),
  });
  assert.equal(result, null);
});

test('encounter gate uses C MAX_ENCOUNTER_RATE threshold math', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 5 });
  const fail = tryGenerateLandEncounter({
    mapId: 'MAP_ROUTE101',
    currentTileBehavior: MB_TALL_GRASS,
    previousTileBehavior: MB_TALL_GRASS,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    // Route101 encounterRate=20 => 320/2880 chance. 400 should fail.
    randomInt: sequenceRandom([400]),
  });
  assert.equal(fail, null);
});

test('static can bias selection toward electric-type slots', () => {
  const lead = createTestPokemon({ species: SPECIES.ELECTRIKE, level: 20 });
  const result = tryGenerateLandEncounter({
    mapId: 'MAP_ROUTE110',
    currentTileBehavior: MB_TALL_GRASS,
    previousTileBehavior: MB_TALL_GRASS,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    // [encounter check, static 50% proc, electric-slot index]
    randomInt: sequenceRandom([0, 0, 0]),
  });

  assert.ok(result);
  assert.equal(result.species, SPECIES.ELECTRIKE);
});

test('keen eye can block low-level encounters', () => {
  const lead = createTestPokemon({ species: SPECIES.WINGULL, level: 12 });
  const result = tryGenerateLandEncounter({
    mapId: 'MAP_ROUTE101',
    currentTileBehavior: MB_TALL_GRASS,
    previousTileBehavior: MB_TALL_GRASS,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    // [encounter check, slot roll, keen-eye coin flip]
    randomInt: sequenceRandom([0, 0, 0]),
  });

  assert.equal(result, null);
});

test('land encounters trigger on cave encounter tiles (not just grass)', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 12 });
  const result = tryGenerateLandEncounter({
    mapId: 'MAP_GRANITE_CAVE_1F',
    currentTileBehavior: MB_CAVE,
    previousTileBehavior: MB_CAVE,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    randomInt: sequenceRandom([0, 0, 0]),
  });

  assert.ok(result);
  assert.equal(result.species, SPECIES.ZUBAT);
  assert.equal(result.level, 7);
});

test('water encounters trigger from generated water tables while surfing', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 25 });
  const result = tryGenerateWaterEncounter({
    mapId: 'MAP_ROUTE102',
    currentTileBehavior: MB_POND_WATER,
    previousTileBehavior: MB_POND_WATER,
    playerIsSurfing: true,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    randomInt: sequenceRandom([0, 0, 0]),
  });

  assert.ok(result);
  assert.equal(result.species, SPECIES.MARILL);
  assert.equal(result.level, 20);
});

test('bridge-over-water tiles use water encounters only while surfing', () => {
  const lead = createTestPokemon({ species: SPECIES.TREECKO, level: 25 });
  const surfing = tryGenerateStepEncounter({
    mapId: 'MAP_ROUTE102',
    currentTileBehavior: MB_BRIDGE_OVER_OCEAN,
    previousTileBehavior: MB_BRIDGE_OVER_OCEAN,
    playerIsSurfing: true,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    randomInt: sequenceRandom([0, 0, 0]),
  });
  assert.ok(surfing);
  assert.equal(surfing.area, 'water');

  const notSurfing = tryGenerateStepEncounter({
    mapId: 'MAP_ROUTE102',
    currentTileBehavior: MB_BRIDGE_OVER_OCEAN,
    previousTileBehavior: MB_BRIDGE_OVER_OCEAN,
    playerIsSurfing: false,
    leadPokemon: lead,
    isBikeRiding: false,
    weatherName: 'WEATHER_NONE',
    repelStepsRemaining: 0,
    whiteFluteActive: false,
    blackFluteActive: false,
    randomInt: sequenceRandom([0, 0, 0]),
  });
  assert.equal(notSurfing, null);
});
