import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEMS } from '../../../data/items.ts';
import { MOVES } from '../../../data/moves.ts';
import { SPECIES } from '../../../data/species.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import { STATUS, type PartyPokemon } from '../../../pokemon/types.ts';
import { getAbility } from '../../../pokemon/stats.ts';
import { BattleEngine } from '../BattleEngine.ts';
import { resetBattleRngAdapter, setBattleRngAdapter } from '../BattleRng.ts';
import { executeMove } from '../MoveEffects.ts';
import { applyEndOfTurnStatus, tryApplyStatus } from '../StatusEffects.ts';
import {
  createDefaultSide,
  createDefaultStages,
  createDefaultVolatile,
  getAccuracyMultiplier,
  type BattlePokemon,
  type WeatherState,
} from '../types.ts';

const NO_WEATHER: WeatherState = {
  type: 'none',
  turnsRemaining: 0,
  permanent: false,
};

function makePartyMon(options: {
  species: number;
  moves: [number, number, number, number];
  level?: number;
  status?: number;
  hp?: number;
  speed?: number;
}): PartyPokemon {
  const mon = createTestPokemon({
    species: options.species,
    level: options.level ?? 50,
    moves: options.moves,
    status: options.status ?? STATUS.NONE,
  });

  if (options.hp !== undefined) {
    mon.stats.maxHp = Math.max(options.hp, mon.stats.maxHp);
    mon.stats.hp = options.hp;
  }
  if (options.speed !== undefined) {
    mon.stats.speed = options.speed;
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

test('item action consumes turn and enemy still acts', () => {
  const engine = new BattleEngine({
    config: { type: 'wild' },
    playerPokemon: makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
      hp: 120,
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.SCRATCH, 0, 0, 0],
      speed: 10,
    }),
  });

  const result = engine.executeTurn({ type: 'item', itemId: ITEMS.ITEM_POTION });
  assert.equal(result.events.some((event) => event.message === 'But it failed!'), false);
  assert.equal(result.events.some((event) => event.type === 'damage' && event.battler === 0), true);
});

test('switch action consumes turn and enemy still acts', () => {
  const engine = new BattleEngine({
    config: { type: 'wild' },
    playerPokemon: makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
      hp: 120,
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.SCRATCH, 0, 0, 0],
      speed: 10,
    }),
  });

  const result = engine.executeTurn({ type: 'switch', partyIndex: 1 });
  assert.equal(result.events.some((event) => event.message === 'But it failed!'), false);
  assert.equal(result.events.some((event) => event.type === 'damage' && event.battler === 0), true);
});

test('run in trainer battle does not consume turn', () => {
  const engine = new BattleEngine({
    config: { type: 'trainer' },
    playerPokemon: makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
      hp: 120,
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.SCRATCH, 0, 0, 0],
      speed: 10,
    }),
  });

  const hpBefore = engine.getPlayer().currentHp;
  const result = engine.executeTurn({ type: 'run' });

  assert.equal(result.events.some((event) => event.message?.includes("no running")), true);
  assert.equal(result.events.some((event) => event.type === 'damage' && event.battler === 0), false);
  assert.equal(engine.getPlayer().currentHp, hpBefore);
});

test('run in wild battle still consumes turn when escape fails', () => {
  setBattleRngAdapter({ next: () => 255 });
  try {
    const engine = new BattleEngine({
      config: { type: 'wild' },
      playerPokemon: makePartyMon({
        species: SPECIES.TREECKO,
        level: 5,
        moves: [MOVES.POUND, 0, 0, 0],
        hp: 120,
        speed: 5,
      }),
      enemyPokemon: makePartyMon({
        species: SPECIES.TORCHIC,
        level: 50,
        moves: [MOVES.SCRATCH, 0, 0, 0],
        speed: 200,
      }),
    });

    const result = engine.executeTurn({ type: 'run' });
    assert.equal(result.events.some((event) => event.message === "Can't escape!"), true);
    assert.equal(result.events.some((event) => event.type === 'damage' && event.battler === 0), true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('replacing player battler clears terminal outcome and applies new mon state', () => {
  const engine = new BattleEngine({
    config: { type: 'trainer' },
    playerPokemon: makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
      hp: 1,
      speed: 1,
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.SCRATCH, 0, 0, 0],
      speed: 300,
    }),
  });

  const result = engine.executeTurn({ type: 'fight', moveId: MOVES.POUND, moveSlot: 0 });
  assert.equal(result.outcome, 'lose');

  const replacement = makePartyMon({
    species: SPECIES.MUDKIP,
    moves: [MOVES.TACKLE, 0, 0, 0],
    hp: 60,
  });
  engine.replacePlayerPokemon(replacement, 2);

  assert.equal(engine.getOutcome(), null);
  assert.equal(engine.getPlayer().pokemon.species, SPECIES.MUDKIP);
  assert.equal(engine.getPlayer().currentHp, replacement.stats.hp);
  assert.equal(engine.getPlayer().partyIndex, 2);
});

test('replacing enemy battler clears terminal outcome and applies new mon state', () => {
  const engine = new BattleEngine({
    config: { type: 'trainer' },
    playerPokemon: makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
      speed: 300,
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.SCRATCH, 0, 0, 0],
      hp: 1,
      speed: 1,
    }),
  });

  const result = engine.executeTurn({ type: 'fight', moveId: MOVES.POUND, moveSlot: 0 });
  assert.equal(result.outcome, 'win');

  const replacement = makePartyMon({
    species: SPECIES.POOCHYENA,
    moves: [MOVES.TACKLE, 0, 0, 0],
    hp: 55,
  });
  engine.replaceEnemyPokemon(replacement, 1);

  assert.equal(engine.getOutcome(), null);
  assert.equal(engine.getEnemy().pokemon.species, SPECIES.POOCHYENA);
  assert.equal(engine.getEnemy().currentHp, replacement.stats.hp);
  assert.equal(engine.getEnemy().partyIndex, 1);
});

test('False Swipe never emits a faint event when target is at 1 HP', () => {
  const attacker = makeBattleMon(
    makePartyMon({
      species: SPECIES.BLAZIKEN,
      level: 70,
      moves: [MOVES.FALSE_SWIPE, 0, 0, 0],
    }),
    true,
  );
  const defender = makeBattleMon(
    makePartyMon({
      species: SPECIES.MAGIKARP,
      level: 5,
      moves: [MOVES.SPLASH, 0, 0, 0],
      hp: 1,
    }),
    false,
  );

  const result = executeMove({
    attacker,
    defender,
    moveId: MOVES.FALSE_SWIPE,
    moveSlot: 0,
    weather: NO_WEATHER,
    attackerSide: createDefaultSide(),
    defenderSide: createDefaultSide(),
  });

  assert.equal(result.success, true);
  assert.equal(defender.currentHp, 1);
  assert.equal(result.events.some((event) => event.type === 'faint' && event.battler === 1), false);
});

test('fixed-damage moves respect immunity', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
  const fixedDamageMoves = [MOVES.SONIC_BOOM, MOVES.SUPER_FANG];

  for (const moveId of fixedDamageMoves) {
    const attacker = makeBattleMon(
      makePartyMon({
        species: SPECIES.ZIGZAGOON,
        level: 30,
        moves: [moveId, 0, 0, 0],
      }),
      true,
    );
    const defender = makeBattleMon(
      makePartyMon({
        species: SPECIES.GASTLY,
        level: 25,
        moves: [MOVES.LICK, 0, 0, 0],
      }),
      false,
    );
    const hpBefore = defender.currentHp;

    const result = executeMove({
      attacker,
      defender,
      moveId,
      moveSlot: 0,
      weather: NO_WEATHER,
      attackerSide: createDefaultSide(),
      defenderSide: createDefaultSide(),
    });

    assert.equal(result.success, false);
    assert.equal(defender.currentHp, hpBefore);
    assert.equal(
      result.events.some((event) => (event.message ?? '').includes("doesn't affect")),
      true,
    );
  }
  } finally {
    resetBattleRngAdapter();
  }
});

test('toxic damage scales 1/16, then 2/16', () => {
  const mon = makeBattleMon(
    makePartyMon({
      species: SPECIES.TREECKO,
      moves: [MOVES.POUND, 0, 0, 0],
      hp: 160,
      status: STATUS.TOXIC,
    }),
    true,
  );
  mon.maxHp = 160;
  mon.currentHp = 160;

  applyEndOfTurnStatus(mon);
  assert.equal(mon.currentHp, 150);

  applyEndOfTurnStatus(mon);
  assert.equal(mon.currentHp, 130);

  mon.pokemon.status = STATUS.NONE;
  applyEndOfTurnStatus(mon);
  assert.equal(mon.volatile.toxicCounter, 0);
});

test('move-induced sleep duration is always 2-5 turns', () => {
  for (let i = 0; i < 64; i++) {
    const target = makeBattleMon(
      makePartyMon({
        species: SPECIES.TORCHIC,
        moves: [MOVES.SCRATCH, 0, 0, 0],
      }),
      false,
    );
    const events = [];
    const success = tryApplyStatus(target, STATUS.SLEEP, events);
    assert.equal(success, true);
    const sleepTurns = target.pokemon.status & STATUS.SLEEP;
    assert.equal(sleepTurns >= 2 && sleepTurns <= 5, true);
  }
});

test('accuracy stage +4 uses Emerald 233/100 multiplier', () => {
  assert.equal(getAccuracyMultiplier(4, 0), 2.33);
});

test('simultaneous faint resolves as draw', () => {
  const player = makePartyMon({
    species: SPECIES.BLAZIKEN,
    level: 70,
    moves: [MOVES.DOUBLE_EDGE, 0, 0, 0],
    hp: 1,
    speed: 200,
  });
  const enemy = makePartyMon({
    species: SPECIES.MAGIKARP,
    level: 5,
    moves: [MOVES.SPLASH, 0, 0, 0],
    hp: 1,
    speed: 1,
  });

  const engine = new BattleEngine({
    config: { type: 'wild' },
    playerPokemon: player,
    enemyPokemon: enemy,
  });

  const result = engine.executeTurn({
    type: 'fight',
    moveId: MOVES.DOUBLE_EDGE,
    moveSlot: 0,
  });

  assert.equal(result.outcome, 'draw');
  assert.equal(engine.getPlayer().currentHp, 0);
  assert.equal(engine.getEnemy().currentHp, 0);
});
