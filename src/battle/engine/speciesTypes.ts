/**
 * Shared species type lookup helpers used by battle systems.
 *
 * C ref:
 * - public/pokeemerald/src/pokemon.c (GetMonData MON_DATA_TYPE1/TYPE2 usage)
 */

import { getSpeciesInfo } from '../../data/speciesInfo.ts';
import type { BattlePokemon } from './types.ts';

export function getSpeciesTypes(speciesId: number): [string, string] {
  const info = getSpeciesInfo(speciesId);
  const primary = info?.types?.[0] ?? 'NORMAL';
  const secondary = info?.types?.[1] ?? primary;
  return [primary, secondary];
}

export function getBattlePokemonTypes(mon: BattlePokemon): [string, string] {
  return getSpeciesTypes(mon.pokemon.species);
}
