import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS } from '../../../data/items.ts';
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

test('recharge moves set recharging volatile on hit', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.HYPER_BEAM, 0, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MAGIKARP,
        moves: [MOVES.SPLASH, 0, 0, 0],
      }),
      false,
    );

    const result = executeMove({
      attacker,
      defender,
      moveId: MOVES.HYPER_BEAM,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    assert.equal(result.success, true);
    assert.equal(attacker.volatile.recharging, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('stomp doubles damage on minimized targets and can flinch', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.STOMP, 0, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MAGIKARP,
        moves: [MOVES.SPLASH, 0, 0, 0],
        hp: 240,
      }),
      false,
    );
    defender.volatile.minimized = true;

    const result = executeMove({
      attacker,
      defender,
      moveId: MOVES.STOMP,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    assert.equal(result.success, true);
    assert.equal(defender.currentHp < 240, true);
    assert.equal(defender.volatile.flinch, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('semi-invulnerable moves charge then strike and only consume PP once', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.SWELLOW,
        moves: [MOVES.FLY, 0, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MAGIKARP,
        moves: [MOVES.SPLASH, 0, 0, 0],
        hp: 200,
      }),
      false,
    );

    const initialPp = attacker.pokemon.pp[0];

    const turn1 = executeMove({
      attacker,
      defender,
      moveId: MOVES.FLY,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(turn1.success, true);
    assert.equal(defender.currentHp, 200);
    assert.equal(attacker.volatile.chargeMove, MOVES.FLY);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);

    const turn2 = executeMove({
      attacker,
      defender,
      moveId: MOVES.FLY,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(turn2.success, true);
    assert.equal(defender.currentHp < 200, true);
    assert.equal(attacker.volatile.chargeMove, MOVES.NONE);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);
  } finally {
    resetBattleRngAdapter();
  }
});

test('rampage locks for multiple turns and confuses when ending', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.THRASH, 0, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.MAGIKARP,
        moves: [MOVES.SPLASH, 0, 0, 0],
        hp: 300,
      }),
      false,
    );

    executeMove({
      attacker,
      defender,
      moveId: MOVES.THRASH,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.rampageMove, MOVES.THRASH);
    assert.equal(attacker.volatile.rampageTurns > 0, true);

    executeMove({
      attacker,
      defender,
      moveId: MOVES.THRASH,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(attacker.volatile.rampageTurns, 0);
    assert.equal(attacker.volatile.rampageMove, MOVES.NONE);
    assert.equal(attacker.volatile.confusion > 0, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('mean look sets escape prevention flag on target', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.GASTLY,
      moves: [MOVES.MEAN_LOOK, 0, 0, 0],
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

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.MEAN_LOOK,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  assert.equal(defender.volatile.meanLookSourceIsPlayer, true);
});

test('roar in wild battle emits flee battle_end event', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.GROWLITHE,
      level: 70,
      moves: [MOVES.ROAR, 0, 0, 0],
    }),
    true,
  );
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.MAGIKARP,
      level: 5,
      moves: [MOVES.SPLASH, 0, 0, 0],
    }),
    false,
  );

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.ROAR,
    moveSlot: 0,
    battleType: 'wild',
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  assert.equal(result.events.some((event) => event.type === 'battle_end' && event.detail === 'flee'), true);
});

test('recoil-if-miss applies crash recoil when attack misses', () => {
  setBattleRngAdapter({ next: () => 0.9999 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.HI_JUMP_KICK, 0, 0, 0],
        hp: 120,
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

    const result = executeMove({
      attacker,
      defender,
      moveId: MOVES.HI_JUMP_KICK,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    assert.equal(result.success, false);
    const expectedCrashHp = Math.max(0, 120 - Math.max(1, Math.floor(attacker.maxHp / 2)));
    assert.equal(attacker.currentHp, expectedCrashHp);
    assert.equal(result.events.some((event) => event.type === 'recoil'), true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('lock on sets sure-hit state', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.MAGNEMITE,
      moves: [MOVES.LOCK_ON, 0, 0, 0],
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

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.LOCK_ON,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  assert.equal(attacker.volatile.lockOnTurns, 2);
  assert.equal(attacker.volatile.lockOnTargetIsPlayer, false);
});

test('flail power scales up as HP gets lower', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const healthyAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.FLAIL, 0, 0, 0],
        hp: 200,
      }),
      true,
    );
    const lowHpAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.BLAZIKEN,
        moves: [MOVES.FLAIL, 0, 0, 0],
        hp: 200,
      }),
      true,
    );
    lowHpAttacker.currentHp = 1;

    const healthyTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 200,
      }),
      false,
    );
    const lowHpTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 200,
      }),
      false,
    );

    executeMove({
      attacker: healthyAttacker,
      defender: healthyTarget,
      moveId: MOVES.FLAIL,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    executeMove({
      attacker: lowHpAttacker,
      defender: lowHpTarget,
      moveId: MOVES.FLAIL,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    const healthyDamage = 200 - healthyTarget.currentHp;
    const lowHpDamage = 200 - lowHpTarget.currentHp;
    assert.equal(lowHpDamage > healthyDamage, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('heal bell cures the user status', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.CHIMECHO,
      moves: [MOVES.HEAL_BELL, 0, 0, 0],
    }),
    true,
  );
  attacker.pokemon.status = STATUS.POISON;
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.MUDKIP,
      moves: [MOVES.TACKLE, 0, 0, 0],
    }),
    false,
  );

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.HEAL_BELL,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  assert.equal(attacker.pokemon.status, STATUS.NONE);
});

test('thief steals held item when user has none', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.ZIGZAGOON,
        moves: [MOVES.THIEF, 0, 0, 0],
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
    attacker.pokemon.heldItem = ITEMS.ITEM_NONE;
    defender.pokemon.heldItem = ITEMS.ITEM_LEFTOVERS;

    const result = executeMove({
      attacker,
      defender,
      moveId: MOVES.THIEF,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    assert.equal(result.success, true);
    assert.equal(attacker.pokemon.heldItem, ITEMS.ITEM_LEFTOVERS);
    assert.equal(defender.pokemon.heldItem, ITEMS.ITEM_NONE);
  } finally {
    resetBattleRngAdapter();
  }
});

test('foresight allows Normal-type moves to hit Ghost targets', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.ZIGZAGOON,
        moves: [MOVES.FORESIGHT, MOVES.TACKLE, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.GASTLY,
        moves: [MOVES.LICK, 0, 0, 0],
        hp: 160,
      }),
      false,
    );

    const foresightResult = executeMove({
      attacker,
      defender,
      moveId: MOVES.FORESIGHT,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(foresightResult.success, true);

    const tackleResult = executeMove({
      attacker,
      defender,
      moveId: MOVES.TACKLE,
      moveSlot: 1,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    assert.equal(tackleResult.success, true);
    assert.equal(defender.currentHp < 160, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('rollout power escalates and chained turns consume one PP', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.SPHEAL,
        moves: [MOVES.ROLLOUT, 0, 0, 0],
      }),
      true,
    );
    const defenderA = makeBattleMon(
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
      defender: defenderA,
      moveId: MOVES.ROLLOUT,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const firstDamage = 240 - defenderA.currentHp;
    assert.equal(attacker.volatile.rollout, 2);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);
    attacker.volatile.lastMoveUsed = MOVES.ROLLOUT;

    const defenderB = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 240,
      }),
      false,
    );
    executeMove({
      attacker,
      defender: defenderB,
      moveId: MOVES.ROLLOUT,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    const secondDamage = 240 - defenderB.currentHp;

    assert.equal(secondDamage > firstDamage, true);
    assert.equal(attacker.pokemon.pp[0], initialPp - 1);
  } finally {
    resetBattleRngAdapter();
  }
});

test('future sight schedules delayed attack metadata on target', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.ABRA,
      moves: [MOVES.FUTURE_SIGHT, 0, 0, 0],
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

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.FUTURE_SIGHT,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  assert.equal(defender.volatile.futureSightTurns, 3);
  assert.equal(defender.volatile.futureSightMoveId, MOVES.FUTURE_SIGHT);
  assert.equal(defender.volatile.futureSightDamage > 0, true);
});

test('soft-boiled heals half max HP', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.CHANSEY,
      moves: [MOVES.SOFT_BOILED, 0, 0, 0],
      hp: 300,
    }),
    true,
  );
  attacker.currentHp = 120;
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.MUDKIP,
      moves: [MOVES.TACKLE, 0, 0, 0],
    }),
    false,
  );

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.SOFT_BOILED,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  const expectedHp = Math.min(attacker.maxHp, 120 + Math.max(1, Math.floor(attacker.maxHp / 2)));
  assert.equal(attacker.currentHp, expectedHp);
});

test('eruption damage scales with current HP', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const fullHpAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.TORKOAL,
        moves: [MOVES.ERUPTION, 0, 0, 0],
        hp: 200,
      }),
      true,
    );
    const lowHpAttacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.TORKOAL,
        moves: [MOVES.ERUPTION, 0, 0, 0],
        hp: 200,
      }),
      true,
    );
    lowHpAttacker.currentHp = 20;

    const fullHpTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 240,
      }),
      false,
    );
    const lowHpTarget = makeBattleMon(
      makePartyMon({
        species: SPECIES.MUDKIP,
        moves: [MOVES.TACKLE, 0, 0, 0],
        hp: 240,
      }),
      false,
    );

    executeMove({
      attacker: fullHpAttacker,
      defender: fullHpTarget,
      moveId: MOVES.ERUPTION,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });
    executeMove({
      attacker: lowHpAttacker,
      defender: lowHpTarget,
      moveId: MOVES.ERUPTION,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    const fullDamage = 240 - fullHpTarget.currentHp;
    const lowDamage = 240 - lowHpTarget.currentHp;
    assert.equal(fullDamage > lowDamage, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('targeted move-effect IDs are implemented and removed from missing-referenced list', () => {
  const targetedEffectIds = [
    26, 27, 39, 75, 80, 117, 119, 114, 148, 145, 151, 155, 159, 160,
    161, 162, 170, 174, 185, 187, 86, 90, 94, 106, 165, 175, 179, 42,
  ];

  const implemented = new Set(getImplementedMoveEffectIds());
  for (const effectId of targetedEffectIds) {
    assert.equal(implemented.has(effectId), true);
  }

  const report = getMoveEffectCoverageReport();
  const missingTargeted = report.missingReferencedEffects.filter((entry) => targetedEffectIds.includes(entry.effectId));
  assert.equal(missingTargeted.length, 0);
  assert.equal(report.missingReferencedEffects.length < 94, true);
});
