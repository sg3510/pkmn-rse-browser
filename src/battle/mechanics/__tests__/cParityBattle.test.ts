import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS } from '../../../data/items.ts';
import { STATUS } from '../../../pokemon/types.ts';
import {
  calculateCatchOdds,
  calculateFaintExpDistribution,
  calculateFaintExpAward,
  getBallEscapeMessage,
  resolveBallMultiplierTenths,
  resolveCaptureShakes,
  scaleTrainerIvToBattleIv,
} from '../cParityBattle.ts';

test('trainer IV scaling matches C formula (iv * 31 / 255)', () => {
  assert.equal(scaleTrainerIvToBattleIv(0), 0);
  assert.equal(scaleTrainerIvToBattleIv(127), 15);
  assert.equal(scaleTrainerIvToBattleIv(200), 24);
  assert.equal(scaleTrainerIvToBattleIv(255), 31);
});

test('special ball multipliers resolve to expected tenths', () => {
  assert.equal(resolveBallMultiplierTenths({
    itemId: ITEMS.ITEM_ULTRA_BALL,
    targetLevel: 25,
    targetTypes: ['ROCK', 'GROUND'],
    isUnderwater: false,
    speciesCaughtBefore: false,
    battleTurnCounter: 0,
  }), 20);

  assert.equal(resolveBallMultiplierTenths({
    itemId: ITEMS.ITEM_REPEAT_BALL,
    targetLevel: 25,
    targetTypes: ['ROCK', 'GROUND'],
    isUnderwater: false,
    speciesCaughtBefore: true,
    battleTurnCounter: 0,
  }), 30);

  assert.equal(resolveBallMultiplierTenths({
    itemId: ITEMS.ITEM_TIMER_BALL,
    targetLevel: 25,
    targetTypes: ['ROCK', 'GROUND'],
    isUnderwater: false,
    speciesCaughtBefore: false,
    battleTurnCounter: 22,
  }), 32);

  assert.equal(resolveBallMultiplierTenths({
    itemId: ITEMS.ITEM_DIVE_BALL,
    targetLevel: 25,
    targetTypes: ['WATER', 'NONE'],
    isUnderwater: true,
    speciesCaughtBefore: false,
    battleTurnCounter: 0,
  }), 35);
});

test('status conditions boost catch odds like C', () => {
  const base = calculateCatchOdds({
    catchRate: 45,
    ballMultiplierTenths: 10,
    targetHp: 30,
    targetMaxHp: 100,
    targetStatus: STATUS.NONE,
  });
  const sleep = calculateCatchOdds({
    catchRate: 45,
    ballMultiplierTenths: 10,
    targetHp: 30,
    targetMaxHp: 100,
    targetStatus: STATUS.SLEEP,
  });
  const poison = calculateCatchOdds({
    catchRate: 45,
    ballMultiplierTenths: 10,
    targetHp: 30,
    targetMaxHp: 100,
    targetStatus: STATUS.POISON,
  });

  assert.equal(sleep, base * 2);
  assert.equal(poison, Math.floor((base * 15) / 10));
});

test('capture shake result maps to break-free message table', () => {
  const fail = resolveCaptureShakes({
    itemId: ITEMS.ITEM_POKE_BALL,
    odds: 50,
    randomU16: () => 65000,
  });
  assert.equal(fail.caught, false);
  assert.equal(fail.shakes, 0);
  assert.equal(getBallEscapeMessage(fail.shakes), 'Oh no! The POKeMON broke free!');

  const success = resolveCaptureShakes({
    itemId: ITEMS.ITEM_MASTER_BALL,
    odds: 1,
    randomU16: () => 65535,
  });
  assert.equal(success.caught, true);
  assert.equal(success.shakes, 3);
});

test('EXP award applies Lucky Egg and trainer bonuses in C order', () => {
  const baseOnly = calculateFaintExpAward(63, 7, { trainerBattle: false, luckyEgg: false });
  const luckyOnly = calculateFaintExpAward(63, 7, { trainerBattle: false, luckyEgg: true });
  const trainerOnly = calculateFaintExpAward(63, 7, { trainerBattle: true, luckyEgg: false });
  const both = calculateFaintExpAward(63, 7, { trainerBattle: true, luckyEgg: true });

  assert.equal(baseOnly, 63);
  assert.equal(luckyOnly, 94);
  assert.equal(trainerOnly, 94);
  assert.equal(both, 141);
});

test('EXP distribution splits 50/50 between participant and Exp Share holder', () => {
  const gains = calculateFaintExpDistribution({
    baseExpYield: 63,
    faintedLevel: 7,
    trainerBattle: false,
    party: [
      { isPresent: true, level: 10, hp: 30, heldItem: ITEMS.ITEM_NONE, participated: true },
      { isPresent: true, level: 9, hp: 20, heldItem: ITEMS.ITEM_EXP_SHARE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
    ],
  });

  assert.deepEqual(gains, [31, 31, 0, 0, 0, 0]);
});

test('participant holding Exp Share receives both portions', () => {
  const gains = calculateFaintExpDistribution({
    baseExpYield: 63,
    faintedLevel: 7,
    trainerBattle: false,
    party: [
      { isPresent: true, level: 10, hp: 30, heldItem: ITEMS.ITEM_EXP_SHARE, participated: true },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
    ],
  });

  assert.equal(gains[0], 62);
});

test('Lucky Egg and trainer multipliers apply per recipient after base split', () => {
  const gains = calculateFaintExpDistribution({
    baseExpYield: 63,
    faintedLevel: 7,
    trainerBattle: true,
    party: [
      { isPresent: true, level: 10, hp: 30, heldItem: ITEMS.ITEM_NONE, participated: true },
      { isPresent: true, level: 9, hp: 20, heldItem: ITEMS.ITEM_EXP_SHARE, participated: false },
      { isPresent: true, level: 12, hp: 25, heldItem: ITEMS.ITEM_LUCKY_EGG, participated: true },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
    ],
  });

  // baseExp=63 -> split 31/31: sent-in share 31 split by 2 participants => 15 each.
  // Exp Share side has one holder => 31.
  // trainer bonus (x1.5): 31 -> 46, 15 -> 22.
  // Lucky Egg then trainer bonus: 15 -> 22 -> 33.
  assert.deepEqual(gains, [22, 46, 33, 0, 0, 0]);
});

test('level 100 participants still dilute the sent-in share but receive no EXP', () => {
  const gains = calculateFaintExpDistribution({
    baseExpYield: 63,
    faintedLevel: 7,
    trainerBattle: false,
    party: [
      { isPresent: true, level: 100, hp: 100, heldItem: ITEMS.ITEM_NONE, participated: true },
      { isPresent: true, level: 10, hp: 30, heldItem: ITEMS.ITEM_NONE, participated: true },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
      { isPresent: false, level: 0, hp: 0, heldItem: ITEMS.ITEM_NONE, participated: false },
    ],
  });

  assert.deepEqual(gains, [0, 31, 0, 0, 0, 0]);
});
