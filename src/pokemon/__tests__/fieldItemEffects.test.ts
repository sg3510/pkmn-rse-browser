import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS } from '../../data/items.ts';
import { MOVES } from '../../data/moves.ts';
import { SPECIES } from '../../data/species.ts';
import { createTestPokemon } from '../testFactory.ts';
import {
  EV_ITEM_RAISE_LIMIT,
  MAX_TOTAL_EVS,
  tryApplyPpMax,
  tryApplyPpUp,
  tryApplyVitaminByItem,
} from '../fieldItemEffects.ts';
import { calculateMoveMaxPp } from '../pp.ts';

test('vitamins enforce per-stat and total EV limits', () => {
  const mon = createTestPokemon({
    species: SPECIES.TREECKO,
    level: 20,
    moves: [MOVES.POUND, 0, 0, 0],
  });
  mon.evs.attack = EV_ITEM_RAISE_LIMIT;

  const blockedByStat = tryApplyVitaminByItem(mon, ITEMS.ITEM_PROTEIN);
  assert.equal(blockedByStat.used, false);

  const nearTotalCap = {
    ...mon,
    evs: {
      ...mon.evs,
      hp: 100,
      defense: 100,
      speed: 100,
      spAttack: 100,
      spDefense: 100,
      attack: 9,
    },
  };
  const totalBefore = nearTotalCap.evs.hp
    + nearTotalCap.evs.attack
    + nearTotalCap.evs.defense
    + nearTotalCap.evs.speed
    + nearTotalCap.evs.spAttack
    + nearTotalCap.evs.spDefense;
  assert.equal(totalBefore, MAX_TOTAL_EVS - 1);

  const raised = tryApplyVitaminByItem(nearTotalCap, ITEMS.ITEM_PROTEIN);
  assert.equal(raised.used, true);
  assert.equal(raised.pokemon.evs.attack, 10);
  const totalAfter = raised.pokemon.evs.hp
    + raised.pokemon.evs.attack
    + raised.pokemon.evs.defense
    + raised.pokemon.evs.speed
    + raised.pokemon.evs.spAttack
    + raised.pokemon.evs.spDefense;
  assert.equal(totalAfter, MAX_TOTAL_EVS);
});

test('PP Up and PP Max follow Gen 3 bonus and cap rules', () => {
  const mon = createTestPokemon({
    species: SPECIES.TREECKO,
    level: 30,
    moves: [MOVES.TACKLE, MOVES.SKETCH, 0, 0],
  });

  const tackleBaseMax = calculateMoveMaxPp(MOVES.TACKLE, mon.ppBonuses, 0);
  const ppUp = tryApplyPpUp(mon, 0);
  assert.equal(ppUp.used, true);
  assert.equal(ppUp.maxPpIncrease > 0, true);
  assert.equal(calculateMoveMaxPp(MOVES.TACKLE, ppUp.pokemon.ppBonuses, 0) > tackleBaseMax, true);

  const ppMax = tryApplyPpMax(ppUp.pokemon, 0);
  assert.equal(ppMax.used, true);
  const blockedAtCap = tryApplyPpUp(ppMax.pokemon, 0);
  assert.equal(blockedAtCap.used, false);

  const sketchBlocked = tryApplyPpUp(mon, 1);
  assert.equal(sketchBlocked.used, false);
});
