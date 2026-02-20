import { getSpeciesName } from '../data/species.ts';
import type { PartyPokemon } from './types.ts';

type PokemonDisplaySource = Pick<PartyPokemon, 'nickname' | 'species'>;

export function formatPokemonDisplayName(mon: PokemonDisplaySource): string {
  const nickname = mon.nickname?.trim();
  return nickname && nickname.length > 0 ? nickname : getSpeciesName(mon.species);
}
