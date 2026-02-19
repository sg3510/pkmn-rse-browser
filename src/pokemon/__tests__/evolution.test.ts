import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestPokemon } from '../testFactory.ts';
import { ITEMS } from '../../data/items.ts';
import { SPECIES } from '../../data/species.ts';
import { EVOLUTION_MODES } from '../../data/evolutions.gen.ts';
import {
  getEvolutionTargetSpecies,
  getShedinjaEvolutionTarget,
  isShedinjaEligible,
} from '../evolution.ts';
import type { PartyPokemon } from '../types.ts';

function withMon(
  mon: PartyPokemon,
  patch: Partial<PartyPokemon>,
): PartyPokemon {
  return {
    ...mon,
    ...patch,
    stats: {
      ...mon.stats,
      ...(patch.stats ?? {}),
    },
    contest: {
      ...mon.contest,
      ...(patch.contest ?? {}),
    },
  };
}

test('resolves level evolution in normal mode', () => {
  const mon = createTestPokemon({ species: SPECIES.BULBASAUR, level: 16 });
  const target = getEvolutionTargetSpecies(mon, EVOLUTION_MODES.EVO_MODE_NORMAL);
  assert.equal(target, SPECIES.IVYSAUR);
});

test('resolves friendship day/night branches with local-time options', () => {
  const base = withMon(
    createTestPokemon({ species: SPECIES.EEVEE, level: 25 }),
    { friendship: 220 },
  );

  const dayTarget = getEvolutionTargetSpecies(base, EVOLUTION_MODES.EVO_MODE_NORMAL, {
    now: new Date(2026, 1, 19, 13, 0, 0),
  });
  const nightTarget = getEvolutionTargetSpecies(base, EVOLUTION_MODES.EVO_MODE_NORMAL, {
    now: new Date(2026, 1, 19, 2, 0, 0),
  });

  assert.equal(dayTarget, SPECIES.ESPEON);
  assert.equal(nightTarget, SPECIES.UMBREON);
});

test('resolves Tyrogue atk/def evolution branches', () => {
  const base = createTestPokemon({ species: SPECIES.TYROGUE, level: 20 });

  const atkGt = withMon(base, {
    stats: { ...base.stats, attack: 40, defense: 20 },
  });
  const atkEq = withMon(base, {
    stats: { ...base.stats, attack: 30, defense: 30 },
  });
  const atkLt = withMon(base, {
    stats: { ...base.stats, attack: 20, defense: 40 },
  });

  assert.equal(
    getEvolutionTargetSpecies(atkGt, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.HITMONLEE,
  );
  assert.equal(
    getEvolutionTargetSpecies(atkEq, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.HITMONTOP,
  );
  assert.equal(
    getEvolutionTargetSpecies(atkLt, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.HITMONCHAN,
  );
});

test('resolves Silcoon/Cascoon split by upper personality modulo', () => {
  const silcoon = createTestPokemon({
    species: SPECIES.WURMPLE,
    level: 7,
    personality: 0x00040000,
  });
  const cascoon = createTestPokemon({
    species: SPECIES.WURMPLE,
    level: 7,
    personality: 0x00050000,
  });

  assert.equal(
    getEvolutionTargetSpecies(silcoon, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.SILCOON,
  );
  assert.equal(
    getEvolutionTargetSpecies(cascoon, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.CASCOON,
  );
});

test('resolves beauty evolution', () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.FEEBAS, level: 25 }),
    {
      contest: {
        cool: 0,
        beauty: 170,
        cute: 0,
        smart: 0,
        tough: 0,
        sheen: 0,
      },
    },
  );
  const target = getEvolutionTargetSpecies(mon, EVOLUTION_MODES.EVO_MODE_NORMAL);
  assert.equal(target, SPECIES.MILOTIC);
});

test('Everstone blocks normal evolution but not item-check mode', () => {
  const blocked = withMon(
    createTestPokemon({ species: SPECIES.BULBASAUR, level: 16 }),
    { heldItem: ITEMS.ITEM_EVERSTONE },
  );
  assert.equal(
    getEvolutionTargetSpecies(blocked, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.NONE,
  );

  const itemCheck = withMon(
    createTestPokemon({ species: SPECIES.PIKACHU, level: 30 }),
    { heldItem: ITEMS.ITEM_EVERSTONE },
  );
  assert.equal(
    getEvolutionTargetSpecies(itemCheck, EVOLUTION_MODES.EVO_MODE_ITEM_CHECK, {
      evolutionItem: ITEMS.ITEM_THUNDER_STONE,
    }),
    SPECIES.RAICHU,
  );
});

test('Nincada provides Ninjask target and Shedinja helper eligibility', () => {
  const mon = createTestPokemon({ species: SPECIES.NINCADA, level: 20 });
  assert.equal(
    getEvolutionTargetSpecies(mon, EVOLUTION_MODES.EVO_MODE_NORMAL),
    SPECIES.NINJASK,
  );

  assert.equal(getShedinjaEvolutionTarget(SPECIES.NINCADA), SPECIES.SHEDINJA);
  assert.equal(
    isShedinjaEligible(SPECIES.NINCADA, [mon, null, null, null, null, null]),
    true,
  );
});
