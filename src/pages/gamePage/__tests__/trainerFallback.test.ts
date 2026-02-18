import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTrainerBattle, resolveTrainerBattleById, resolveTrainerBattleLead } from '../trainerBattleFallback.ts';
import { SPECIES } from '../../../data/species.ts';
import { TRAINER_IDS } from '../../../data/trainerIds.gen.ts';
import { getTrainerData } from '../../../data/trainerParties.gen.ts';
import { getMovesAtLevel } from '../../../data/learnsets.gen.ts';

test('route 103 rival override remains explicit', () => {
  const resolution = resolveTrainerBattleLead('TRAINER_MAY_ROUTE_103_TREECKO');
  assert.deepEqual(resolution, {
    kind: 'ok',
    species: SPECIES.TORCHIC,
    level: 5,
  });
});

test('generic trainer fallback resolves lead mon from generated trainer data', () => {
  const trainerId = TRAINER_IDS.TRAINER_ARCHIE;
  const trainer = getTrainerData(trainerId);
  assert.ok(trainer);
  assert.ok(trainer.party.length > 0);
  const lead = trainer.party[0];

  const resolution = resolveTrainerBattleLead('TRAINER_ARCHIE');
  assert.deepEqual(resolution, {
    kind: 'ok',
    species: lead.species,
    level: lead.level,
  });
});

test('trainer fallback reports unknown trainer constants', () => {
  const resolution = resolveTrainerBattleLead('TRAINER_DOES_NOT_EXIST');
  assert.deepEqual(resolution, { kind: 'unknown_trainer' });
});

test('trainer fallback reports empty parties from generated tables', () => {
  const mutableTrainerIds = TRAINER_IDS as Record<string, number>;
  mutableTrainerIds.TRAINER_TEST_EMPTY = 0;
  try {
    const resolution = resolveTrainerBattleLead('TRAINER_TEST_EMPTY');
    assert.deepEqual(resolution, { kind: 'empty_party' });
  } finally {
    delete mutableTrainerIds.TRAINER_TEST_EMPTY;
  }
});

test('trainer battle resolution returns full generated trainer payload', () => {
  const trainerId = TRAINER_IDS.TRAINER_ARCHIE;
  const trainer = getTrainerData(trainerId);
  assert.ok(trainer);
  assert.ok(trainer.party.length > 0);

  const resolution = resolveTrainerBattle('TRAINER_ARCHIE');
  assert.equal(resolution.kind, 'ok');
  if (resolution.kind !== 'ok') return;

  assert.equal(resolution.trainer.trainerId, trainerId);
  assert.equal(resolution.trainer.party.length, trainer.party.length);
  assert.equal(resolution.trainer.party[0]?.species, trainer.party[0]?.species);
  assert.equal(resolution.trainer.party[0]?.level, trainer.party[0]?.level);
});

test('trainer move fallback uses generated learnsets for route 103 overrides', () => {
  const resolution = resolveTrainerBattle('TRAINER_MAY_ROUTE_103_TREECKO');
  assert.equal(resolution.kind, 'ok');
  if (resolution.kind !== 'ok') return;

  const lead = resolution.trainer.party[0];
  assert.ok(lead);
  const expected = getMovesAtLevel(lead.species, lead.level);
  assert.deepEqual(lead.moves, expected.slice(0, 4));
});

test('trainer battle resolution supports numeric trainer IDs', () => {
  const trainerId = TRAINER_IDS.TRAINER_ROXANNE_1;
  const resolution = resolveTrainerBattleById(trainerId);
  assert.equal(resolution.kind, 'ok');
  if (resolution.kind !== 'ok') return;

  assert.equal(resolution.trainer.trainerId, trainerId);
  assert.equal(resolution.trainer.trainerConst, 'TRAINER_ROXANNE_1');
  assert.equal(resolution.trainer.party[0]?.species, SPECIES.GEODUDE);
});
