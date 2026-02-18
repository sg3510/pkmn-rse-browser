import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS } from '../../../data/items.ts';
import { STATUS } from '../../../pokemon/types.ts';
import {
  calculateCatchOdds,
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
