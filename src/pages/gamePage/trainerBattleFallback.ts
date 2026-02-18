import type { BattleEnemyPokemonSpec, BattleTrainerSpec } from '../../battle/BattleStartRequest';
import { TRAINER_IDS } from '../../data/trainerIds.gen.ts';
import { getTrainerData } from '../../data/trainerParties.gen.ts';
import { getMovesAtLevel } from '../../data/learnsets.gen.ts';
import { SPECIES } from '../../data/species.ts';

const ROUTE_103_TRAINER_BATTLES: Record<string, { species: number; level: number }> = {
  TRAINER_MAY_ROUTE_103_TREECKO: { species: SPECIES.TORCHIC, level: 5 },
  TRAINER_MAY_ROUTE_103_TORCHIC: { species: SPECIES.MUDKIP, level: 5 },
  TRAINER_MAY_ROUTE_103_MUDKIP: { species: SPECIES.TREECKO, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_TREECKO: { species: SPECIES.TORCHIC, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_TORCHIC: { species: SPECIES.MUDKIP, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_MUDKIP: { species: SPECIES.TREECKO, level: 5 },
};

export type TrainerBattleResolution =
  | { kind: 'ok'; trainer: BattleTrainerSpec }
  | { kind: 'unknown_trainer' }
  | { kind: 'empty_party' };

function normalizeMoveList(moves: readonly number[] | undefined): number[] {
  return (moves ?? [])
    .filter((moveId) => Number.isFinite(moveId) && moveId > 0)
    .map((moveId) => Math.trunc(moveId))
    .slice(0, 4);
}

function resolveTrainerMonMoves(species: number, level: number, customMoves?: readonly number[]): number[] {
  const explicit = normalizeMoveList(customMoves);
  if (explicit.length > 0) {
    return explicit;
  }
  return normalizeMoveList(getMovesAtLevel(species, level));
}

function toEnemySpec(mon: {
  species: number;
  level: number;
  heldItem?: number;
  iv?: number;
  moves?: readonly number[];
}): BattleEnemyPokemonSpec {
  return {
    species: Math.trunc(mon.species),
    level: Math.trunc(mon.level),
    heldItem: Math.max(0, Math.trunc(mon.heldItem ?? 0)),
    iv: Math.max(0, Math.trunc(mon.iv ?? 0)),
    moves: resolveTrainerMonMoves(mon.species, mon.level, mon.moves),
  };
}

function buildRoute103Override(species: number, level: number): BattleEnemyPokemonSpec {
  return {
    species,
    level,
    heldItem: 0,
    iv: 0,
    moves: resolveTrainerMonMoves(species, level),
  };
}

export function resolveTrainerBattle(trainerConstName: string): TrainerBattleResolution {
  const trainerId = TRAINER_IDS[trainerConstName];
  if (typeof trainerId !== 'number') {
    return { kind: 'unknown_trainer' };
  }

  const trainer = getTrainerData(trainerId);
  const route103Override = ROUTE_103_TRAINER_BATTLES[trainerConstName];

  const generatedParty = trainer?.party ?? [];
  const party = route103Override
    ? [buildRoute103Override(route103Override.species, route103Override.level)]
    : generatedParty.map((mon) => toEnemySpec(mon));

  if (party.length === 0) {
    return { kind: 'empty_party' };
  }

  return {
    kind: 'ok',
    trainer: {
      trainerConst: trainerConstName,
      trainerId,
      trainerClass: trainer?.trainerClass ?? '',
      trainerName: trainer?.name ?? '',
      trainerPic: trainer?.trainerPic ?? '',
      party,
    },
  };
}

export type TrainerBattleLeadResolution =
  | { kind: 'ok'; species: number; level: number }
  | { kind: 'unknown_trainer' }
  | { kind: 'empty_party' };

/**
 * Backward-compatible lead resolver used by older callers/tests.
 */
export function resolveTrainerBattleLead(trainerConstName: string): TrainerBattleLeadResolution {
  const resolution = resolveTrainerBattle(trainerConstName);
  if (resolution.kind !== 'ok') {
    return resolution;
  }

  const lead = resolution.trainer.party[0];
  if (!lead) {
    return { kind: 'empty_party' };
  }

  return {
    kind: 'ok',
    species: lead.species,
    level: lead.level,
  };
}
