/**
 * Typed battle-start payloads used when entering BattleState.
 *
 * This keeps battle entry explicit and allows trainer battles to pass
 * generated party data (species/level/moves/items) at scale.
 */

import type { BattleBackgroundProfile, BattleTerrain } from './render/BattleBackground';
import type { PartyPokemon } from '../pokemon/types';
import type { LocationState } from '../save/types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';

export interface BattleEnemyPokemonSpec {
  species: number;
  level: number;
  heldItem?: number;
  moves?: readonly number[];
  iv?: number;
}

export interface BattleTrainerSpec {
  trainerConst: string;
  trainerId: number;
  trainerClass?: string;
  trainerName?: string;
  trainerPic?: string;
  party: readonly BattleEnemyPokemonSpec[];
}

export interface BattleStartBase {
  playerPokemon?: PartyPokemon;
  returnLocation?: LocationState;
  returnObjectEventRuntimeState?: ObjectEventRuntimeState;
  firstBattle?: boolean;
  terrain?: BattleTerrain;
  backgroundProfile?: BattleBackgroundProfile;
}

export interface WildBattleStartRequest extends BattleStartBase {
  battleType: 'wild';
  wildSpecies: number;
  wildLevel: number;
  wildHeldItem?: number;
  wildMoves?: readonly number[];
}

export interface TrainerBattleStartRequest extends BattleStartBase {
  battleType: 'trainer';
  trainer: BattleTrainerSpec;
}

export type BattleStartRequest = WildBattleStartRequest | TrainerBattleStartRequest;

export function toMoveSet(moves: readonly number[] | undefined): [number, number, number, number] {
  const normalized = (moves ?? [])
    .filter((moveId) => Number.isFinite(moveId) && moveId > 0)
    .map((moveId) => Math.trunc(moveId))
    .slice(0, 4);
  while (normalized.length < 4) {
    normalized.push(0);
  }
  return [
    normalized[0] ?? 0,
    normalized[1] ?? 0,
    normalized[2] ?? 0,
    normalized[3] ?? 0,
  ];
}
