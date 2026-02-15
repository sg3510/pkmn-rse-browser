import { SPECIES } from '../../data/species.ts';
import { TRAINER_IDS } from '../../data/trainerIds.gen.ts';
import { getTrainerData } from '../../data/trainerParties.gen.ts';

const ROUTE_103_TRAINER_BATTLES: Record<string, { species: number; level: number }> = {
  TRAINER_MAY_ROUTE_103_TREECKO: { species: SPECIES.TORCHIC, level: 5 },
  TRAINER_MAY_ROUTE_103_TORCHIC: { species: SPECIES.MUDKIP, level: 5 },
  TRAINER_MAY_ROUTE_103_MUDKIP: { species: SPECIES.TREECKO, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_TREECKO: { species: SPECIES.TORCHIC, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_TORCHIC: { species: SPECIES.MUDKIP, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_MUDKIP: { species: SPECIES.TREECKO, level: 5 },
};

export type TrainerBattleLeadResolution =
  | { kind: 'ok'; species: number; level: number }
  | { kind: 'unknown_trainer' }
  | { kind: 'empty_party' };

export function resolveTrainerBattleLead(trainerConstName: string): TrainerBattleLeadResolution {
  const route103Override = ROUTE_103_TRAINER_BATTLES[trainerConstName];
  if (route103Override) {
    return { kind: 'ok', species: route103Override.species, level: route103Override.level };
  }

  const trainerId = TRAINER_IDS[trainerConstName];
  if (typeof trainerId !== 'number') {
    return { kind: 'unknown_trainer' };
  }

  const trainer = getTrainerData(trainerId);
  const lead = trainer?.party?.[0];
  if (!lead) {
    return { kind: 'empty_party' };
  }

  return { kind: 'ok', species: lead.species, level: lead.level };
}
