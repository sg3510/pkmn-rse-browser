import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVES } from '../../../data/moves.ts';
import { SPECIES } from '../../../data/species.ts';
import { createTestPokemon } from '../../../pokemon/testFactory.ts';
import { STATUS, type PartyPokemon } from '../../../pokemon/types.ts';
import { BattleEngine } from '../BattleEngine.ts';
import { resetBattleRngAdapter, setBattleRngAdapter } from '../BattleRng.ts';

function makePartyMon(options: {
  species: number;
  moves: [number, number, number, number];
  level?: number;
  hp?: number;
  speed?: number;
}): PartyPokemon {
  const mon = createTestPokemon({
    species: options.species,
    level: options.level ?? 50,
    moves: options.moves,
    status: STATUS.NONE,
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

test('yawn causes delayed sleep at end of following turn', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const engine = new BattleEngine({
      config: { type: 'trainer' },
      playerPokemon: makePartyMon({
        species: SPECIES.DROWZEE,
        moves: [MOVES.YAWN, MOVES.SPLASH, 0, 0],
      }),
      enemyPokemon: makePartyMon({
        species: SPECIES.MAGIKARP,
        moves: [MOVES.SPLASH, 0, 0, 0],
      }),
    });

    engine.executeTurn({ type: 'fight', moveId: MOVES.YAWN, moveSlot: 0 });
    assert.equal(engine.getEnemy().volatile.yawn, 1);
    engine.executeTurn({ type: 'fight', moveId: MOVES.SPLASH, moveSlot: 1 });
    assert.equal((engine.getEnemy().pokemon.status & STATUS.SLEEP) !== 0, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('wish heals on the second end-of-turn tick', () => {
  setBattleRngAdapter({ next: () => 0 });
  try {
    const engine = new BattleEngine({
      config: { type: 'trainer' },
      playerPokemon: makePartyMon({
        species: SPECIES.RALTS,
        moves: [MOVES.WISH, MOVES.SPLASH, 0, 0],
        hp: 160,
        speed: 120,
      }),
      enemyPokemon: makePartyMon({
        species: SPECIES.TORCHIC,
        moves: [MOVES.SCRATCH, 0, 0, 0],
        speed: 40,
      }),
    });

    const hpStart = engine.getPlayer().currentHp;
    engine.executeTurn({ type: 'fight', moveId: MOVES.WISH, moveSlot: 0 });
    const afterWishTurn = engine.getPlayer().currentHp;
    assert.equal(afterWishTurn < hpStart, true);

    engine.executeTurn({ type: 'fight', moveId: MOVES.SPLASH, moveSlot: 1 });
    const afterHealTurn = engine.getPlayer().currentHp;
    assert.equal(afterHealTurn > afterWishTurn, true);
  } finally {
    resetBattleRngAdapter();
  }
});

test('perish song countdown knocks out battlers deterministically', () => {
  const engine = new BattleEngine({
    config: { type: 'trainer' },
    playerPokemon: makePartyMon({
      species: SPECIES.LAPRAS,
      moves: [MOVES.PERISH_SONG, MOVES.SPLASH, 0, 0],
      hp: 220,
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.MAGIKARP,
      moves: [MOVES.SPLASH, 0, 0, 0],
      hp: 220,
    }),
  });

  engine.executeTurn({ type: 'fight', moveId: MOVES.PERISH_SONG, moveSlot: 0 });
  engine.executeTurn({ type: 'fight', moveId: MOVES.SPLASH, moveSlot: 1 });
  engine.executeTurn({ type: 'fight', moveId: MOVES.SPLASH, moveSlot: 1 });
  const result = engine.executeTurn({ type: 'fight', moveId: MOVES.SPLASH, moveSlot: 1 });

  assert.equal(result.outcome, 'draw');
  assert.equal(engine.getPlayer().currentHp, 0);
  assert.equal(engine.getEnemy().currentHp, 0);
});

test('encore forces move selection to encored move', () => {
  const engine = new BattleEngine({
    config: { type: 'trainer' },
    playerPokemon: makePartyMon({
      species: SPECIES.MUDKIP,
      moves: [MOVES.TACKLE, MOVES.GROWL, 0, 0],
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.TORCHIC,
      moves: [MOVES.SCRATCH, 0, 0, 0],
    }),
  });

  const player = engine.getPlayer();
  player.volatile.encore = 3;
  player.volatile.encoredMove = MOVES.TACKLE;

  const validated = engine.validatePlayerAction({
    type: 'fight',
    moveId: MOVES.GROWL,
    moveSlot: 1,
  });

  assert.equal(validated.ok, true);
  assert.equal(validated.normalizedAction.type, 'fight');
  if (validated.normalizedAction.type === 'fight') {
    assert.equal(validated.normalizedAction.moveId, MOVES.TACKLE);
    assert.equal(validated.normalizedAction.moveSlot, 0);
  }
});

test('trap source replacement clears trapped state and unblocks run', () => {
  const engine = new BattleEngine({
    config: { type: 'wild' },
    playerPokemon: makePartyMon({
      species: SPECIES.MUDKIP,
      moves: [MOVES.TACKLE, 0, 0, 0],
    }),
    enemyPokemon: makePartyMon({
      species: SPECIES.EKANS,
      moves: [MOVES.WRAP, 0, 0, 0],
    }),
  });

  engine.getPlayer().volatile.trapped = 3;
  engine.getPlayer().volatile.trappedByIsPlayer = false;
  assert.equal(engine.validatePlayerAction({ type: 'run' }).ok, false);

  const replacement = makePartyMon({
    species: SPECIES.MAGIKARP,
    moves: [MOVES.SPLASH, 0, 0, 0],
  });
  engine.replaceEnemyPokemon(replacement, 1);
  assert.equal(engine.getPlayer().volatile.trapped, 0);
  assert.equal(engine.validatePlayerAction({ type: 'run' }).ok, true);
});
