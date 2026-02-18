import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVES } from '../../../data/moves.ts';
import { SPECIES } from '../../../data/species.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import { STATUS, type PartyPokemon } from '../../../pokemon/types.ts';
import { getAbility } from '../../../pokemon/stats.ts';
import { executeMove, getImplementedMoveEffectIds, getMoveEffectCoverageReport } from '../MoveEffects.ts';
import { createDefaultSide, createDefaultStages, createDefaultVolatile, type BattlePokemon, type WeatherState } from '../types.ts';
import { resetBattleRngAdapter, setBattleRngAdapter } from '../BattleRng.ts';

const NO_WEATHER: WeatherState = {
  type: 'none',
  turnsRemaining: 0,
  permanent: false,
};

function makePartyMon(options: {
  species: number;
  level?: number;
  moves: [number, number, number, number];
  hp?: number;
}): PartyPokemon {
  const mon = createTestPokemon({
    species: options.species,
    level: options.level ?? 50,
    moves: options.moves,
    status: STATUS.NONE,
  });
  if (options.hp !== undefined) {
    mon.stats.maxHp = Math.max(mon.stats.maxHp, options.hp);
    mon.stats.hp = options.hp;
  }
  return mon;
}

function makeBattleMon(mon: PartyPokemon, isPlayer: boolean): BattlePokemon {
  return {
    pokemon: { ...mon },
    name: mon.nickname?.trim() || `MON_${mon.species}`,
    currentHp: mon.stats.hp,
    maxHp: mon.stats.maxHp,
    stages: createDefaultStages(),
    volatile: createDefaultVolatile(),
    ability: getAbility(mon.species, mon.abilityNum),
    partyIndex: 0,
    isPlayer,
  };
}

test('Protect blocks protect-affected moves before damage', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.TACKLE, 0, 0, 0],
    }),
    false,
  );
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.PROTECT, 0, 0, 0],
    }),
    true,
  );
  defender.volatile.protect = true;
  const hpBefore = defender.currentHp;

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.TACKLE,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, false);
  assert.equal(defender.currentHp, hpBefore);
  assert.equal(result.events.some((event) => (event.message ?? '').includes('protected itself')), true);
});

test('Endure sets endure volatile and prevents lethal fixed damage', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const endurer = makeBattleMon(
      makePartyMon({
        species: SPECIES.TREECKO,
        moves: [MOVES.ENDURE, 0, 0, 0],
        hp: 30,
      }),
      true,
    );
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.TORCHIC,
        moves: [MOVES.DRAGON_RAGE, 0, 0, 0],
      }),
      false,
    );

    const endureResult = executeMove({
      attacker: endurer,
      defender: attacker,
      moveId: MOVES.ENDURE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(endureResult.success, true);
    assert.equal(endurer.volatile.endure, true);

    const hitResult = executeMove({
      attacker,
      defender: endurer,
      moveId: MOVES.DRAGON_RAGE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(endurer.currentHp, 1);
    assert.equal(hitResult.events.some((event) => (event.message ?? '').includes('endured the hit')), true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('Safeguard blocks major status application from status moves', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.ZIGZAGOON,
        moves: [MOVES.TOXIC, 0, 0, 0],
      }),
      false,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.TREECKO,
        moves: [MOVES.POUND, 0, 0, 0],
      }),
      true,
    );
    const defenderSide = createDefaultSide();
    defenderSide.safeguard = 5;

    const result = executeMove({
      attacker,
      defender,
      moveId: MOVES.TOXIC,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide,
    });

    assert.equal(result.success, false);
    assert.equal(defender.pokemon.status, STATUS.NONE);
    assert.equal(result.events.some((event) => (event.message ?? '').includes('protected by Safeguard')), true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('Mist blocks incoming stat stage reductions', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.TAIL_WHIP, 0, 0, 0],
    }),
    false,
  );
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
    }),
    true,
  );
  const defenderSide = createDefaultSide();
  defenderSide.mist = 5;

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.TAIL_WHIP,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide,
  });

  assert.equal(result.success, false);
  assert.equal(defender.stages.defense, 0);
  assert.equal(result.events.some((event) => (event.message ?? '').includes('protected by Mist')), true);
});

test('Spikes layers cap at 3', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.CACNEA,
      moves: [MOVES.SPIKES, 0, 0, 0],
    }),
    true,
  );
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.MUDKIP,
      moves: [MOVES.TACKLE, 0, 0, 0],
    }),
    false,
  );
  const defenderSide = createDefaultSide();

  for (let i = 0; i < 3; i++) {
    const result = executeMove({
      attacker,
      defender,
      moveId: MOVES.SPIKES,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide,
    });
    assert.equal(result.success, true);
    assert.equal(defenderSide.spikes, i + 1);
  }

  const overflow = executeMove({
    attacker,
    defender,
    moveId: MOVES.SPIKES,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide,
  });
  assert.equal(overflow.success, false);
  assert.equal(defenderSide.spikes, 3);
  assert.equal(overflow.events.some((event) => event.message === 'But it failed!'), true);
});

test('move effect coverage report exposes implemented protect-like effects and missing backlog', () => {
  const implemented = new Set(getImplementedMoveEffectIds());
  assert.equal(implemented.has(111), true); // EFFECT_PROTECT
  assert.equal(implemented.has(116), true); // EFFECT_ENDURE

  const report = getMoveEffectCoverageReport();
  assert.equal(report.totalDefinedEffects >= report.implementedEffects, true);
  assert.equal(report.missingReferencedEffects.length > 0, true);
  assert.equal(report.missingReferencedEffects[0]?.moveCount > 0, true);
});
