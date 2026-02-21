import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVES } from '../../../data/moves.ts';
import { SPECIES } from '../../../data/species.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import { STATUS, type PartyPokemon } from '../../../pokemon/types.ts';
import { getAbility } from '../../../pokemon/stats.ts';
import { executeMove } from '../MoveEffects.ts';
import { resetBattleRngAdapter, setBattleRngAdapter } from '../BattleRng.ts';
import { createDefaultSide, createDefaultStages, createDefaultVolatile, type BattlePokemon, type WeatherState } from '../types.ts';

const NO_WEATHER: WeatherState = {
  type: 'none',
  turnsRemaining: 0,
  permanent: false,
};

function makePartyMon(options: {
  species: number;
  moves: [number, number, number, number];
  level?: number;
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

test('bide stores damage and releases double damage with single PP consumption', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.WOBBUFFET,
        moves: [MOVES.BIDE, 0, 0, 0],
        hp: 220,
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 240,
      }),
      false,
    );

    const initialPp = attacker.pokemon.pp[0];
    executeMove({
      attacker,
      defender,
      moveId: MOVES.BIDE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.bide, 2);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);

    executeMove({
      attacker: defender,
      defender: attacker,
      moveId: MOVES.TACKLE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.bideDamage > 0, true);

    executeMove({
      attacker,
      defender,
      moveId: MOVES.BIDE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const hpBeforeRelease = defender.currentHp;
    executeMove({
      attacker,
      defender,
      moveId: MOVES.BIDE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    assert.equal(defender.currentHp < hpBeforeRelease, true);
    assert.equal(attacker.volatile.bide, 0);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);
  } finally {
    resetBattleRngAdapter();
  }
});

test('razor wind charges first turn then strikes with one PP cost', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.PIDGEOTTO,
        moves: [MOVES.RAZOR_WIND, 0, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MAGIKARP,
        moves: [MOVES.SPLASH, 0, 0, 0],
        hp: 220,
      }),
      false,
    );
    const initialPp = attacker.pokemon.pp[0];

    executeMove({
      attacker,
      defender,
      moveId: MOVES.RAZOR_WIND,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.chargeMove, MOVES.RAZOR_WIND);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);

    const hpBefore = defender.currentHp;
    executeMove({
      attacker,
      defender,
      moveId: MOVES.RAZOR_WIND,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.chargeMove, MOVES.NONE);
    assert.equal(defender.currentHp < hpBefore, true);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);
  } finally {
    resetBattleRngAdapter();
  }
});

test('fury cutter scales on consecutive hits and resets on miss', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.SCYTHER,
        moves: [MOVES.FURY_CUTTER, 0, 0, 0],
      }),
      true,
    );
    const targetA = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 180,
      }),
      false,
    );
    const targetB = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 180,
      }),
      false,
    );

    executeMove({
      attacker,
      defender: targetA,
      moveId: MOVES.FURY_CUTTER,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const firstDamage = 180 - targetA.currentHp;
    executeMove({
      attacker,
      defender: targetB,
      moveId: MOVES.FURY_CUTTER,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const secondDamage = 180 - targetB.currentHp;
    assert.equal(secondDamage > firstDamage, true);
    assert.equal(attacker.volatile.furyCutter >= 2, true);

    setBattleRngAdapter({ next: () => 0.9999 });
    executeMove({
      attacker,
      defender: targetB,
      moveId: MOVES.FURY_CUTTER,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.furyCutter, 0);
  } finally {
    resetBattleRngAdapter();
  }
});

test('stockpile, spit up, and swallow share stockpile counter correctly', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.SWALOT,
        moves: [MOVES.STOCKPILE, MOVES.SPIT_UP, MOVES.SWALLOW, 0],
        hp: 240,
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 260,
      }),
      false,
    );

    executeMove({
      attacker,
      defender,
      moveId: MOVES.STOCKPILE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    executeMove({
      attacker,
      defender,
      moveId: MOVES.STOCKPILE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.stockpile, 2);

    const hpBeforeSpit = defender.currentHp;
    executeMove({
      attacker,
      defender,
      moveId: MOVES.SPIT_UP,
      moveSlot: 1,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(defender.currentHp < hpBeforeSpit, true);
    assert.equal(attacker.volatile.stockpile, 0);

    attacker.currentHp = 80;
    executeMove({
      attacker,
      defender,
      moveId: MOVES.STOCKPILE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    executeMove({
      attacker,
      defender,
      moveId: MOVES.SWALLOW,
      moveSlot: 2,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.currentHp > 80, true);
    assert.equal(attacker.volatile.stockpile, 0);
  } finally {
    resetBattleRngAdapter();
  }
});

test('disable and encore use target last move state', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.KADABRA,
        moves: [MOVES.DISABLE, MOVES.ENCORE, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, MOVES.GROWL, 0, 0],
      }),
      false,
    );
    defender.volatile.lastMoveUsed = MOVES.TACKLE;

    executeMove({
      attacker,
      defender,
      moveId: MOVES.DISABLE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(defender.volatile.disabledMove, MOVES.TACKLE);
    assert.equal(defender.volatile.disabled > 0, true);

    defender.volatile.disabled = 0;
    defender.volatile.disabledMove = MOVES.NONE;
    executeMove({
      attacker,
      defender,
      moveId: MOVES.ENCORE,
      moveSlot: 1,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(defender.volatile.encoredMove, MOVES.TACKLE);
    assert.equal(defender.volatile.encore > 0, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('focus punch fails when user took damage and revenge doubles after taking a hit', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.FOCUS_PUNCH, MOVES.REVENGE, 0, 0],
        hp: 220,
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MACHOP,
        moves: [MOVES.KARATE_CHOP, 0, 0, 0],
        hp: 220,
      }),
      false,
    );

    executeMove({
      attacker: defender,
      defender: attacker,
      moveId: MOVES.KARATE_CHOP,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const focusPunch = executeMove({
      attacker,
      defender,
      moveId: MOVES.FOCUS_PUNCH,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(focusPunch.success, false);
    assert.equal(focusPunch.events.some((event) => (event.message ?? '').includes('lost its focus')), true);

    const healthyTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 220,
      }),
      false,
    );
    const hitTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 220,
      }),
      false,
    );

    const cleanAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.MACHOP,
        moves: [MOVES.REVENGE, 0, 0, 0],
        hp: 220,
      }),
      true,
    );
    const revengeAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.MACHOP,
        moves: [MOVES.REVENGE, 0, 0, 0],
        hp: 220,
      }),
      true,
    );

    executeMove({
      attacker: cleanAttacker,
      defender: healthyTarget,
      moveId: MOVES.REVENGE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    executeMove({
      attacker: hitTarget,
      defender: revengeAttacker,
      moveId: MOVES.TACKLE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    executeMove({
      attacker: revengeAttacker,
      defender: hitTarget,
      moveId: MOVES.REVENGE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    const cleanDamage = 220 - healthyTarget.currentHp;
    const boostedDamage = 220 - hitTarget.currentHp;
    assert.equal(boostedDamage > cleanDamage, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('charge boosts next electric move damage', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const baselineAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.PIKACHU,
        moves: [MOVES.THUNDER_SHOCK, 0, 0, 0],
      }),
      true,
    );
    const chargedAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.PIKACHU,
        moves: [MOVES.CHARGE, MOVES.THUNDER_SHOCK, 0, 0],
      }),
      true,
    );
    const baselineTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 200,
      }),
      false,
    );
    const chargedTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 200,
      }),
      false,
    );

    executeMove({
      attacker: baselineAttacker,
      defender: baselineTarget,
      moveId: MOVES.THUNDER_SHOCK,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const baselineDamage = 200 - baselineTarget.currentHp;

    executeMove({
      attacker: chargedAttacker,
      defender: chargedTarget,
      moveId: MOVES.CHARGE,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    executeMove({
      attacker: chargedAttacker,
      defender: chargedTarget,
      moveId: MOVES.THUNDER_SHOCK,
      moveSlot: 1,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const chargedDamage = 200 - chargedTarget.currentHp;
    assert.equal(chargedDamage > baselineDamage, true);
  } finally {
    resetBattleRngAdapter();
  }
});
