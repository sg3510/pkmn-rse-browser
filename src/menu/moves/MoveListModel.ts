import { getMoveDescription, getMoveInfo, getMoveName, MOVES } from '../../data/moves';
import { calculateMoveMaxPp } from '../../pokemon/pp';
import type { PartyPokemon } from '../../pokemon/types';

export interface MoveListEntry {
  slot: number;
  moveId: number;
  name: string;
  pp: number;
  maxPp: number;
  type: string;
  description: string;
  isEmpty: boolean;
}

export function createMoveListModel(
  pokemon: Pick<PartyPokemon, 'moves' | 'pp'> & {
    ppBonuses?: number;
  },
): MoveListEntry[] {
  return pokemon.moves.map((moveId, slot) => {
    const info = getMoveInfo(moveId);
    const isEmpty = moveId === MOVES.NONE;
    return {
      slot,
      moveId,
      name: getMoveName(moveId),
      pp: pokemon.pp[slot] ?? 0,
      maxPp: calculateMoveMaxPp(moveId, pokemon.ppBonuses ?? 0, slot),
      type: info?.type ?? 'NORMAL',
      description: getMoveDescription(moveId) || 'No description available.',
      isEmpty,
    };
  });
}
