/** Immutable presentation data for the attackanimation boundary in public/pokeemerald/data/battle_scripts_1.s. */
import type { BattlePokemon, BattlePresentationSnapshot } from './types.ts';
export function battlePokemonIdentity(mon: BattlePokemon): string {
  return `${mon.isPlayer ? 0 : 1}:${mon.partyIndex}:${mon.pokemon.species}:${mon.pokemon.personality}`;
}
export function snapshotBattlePokemon(mon: BattlePokemon): BattlePresentationSnapshot {
  return Object.freeze({ slot: mon.isPlayer ? 0 : 1, identity: battlePokemonIdentity(mon), species: mon.pokemon.species,
    hp: mon.currentHp, maxHp: mon.maxHp, status: mon.pokemon.status });
}
