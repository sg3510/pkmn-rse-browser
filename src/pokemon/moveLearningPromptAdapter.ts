import type { MoveLearningPrompts } from './moveLearning.ts';
import type { PartyPokemon } from './types.ts';
import { formatPokemonDisplayName } from './displayName.ts';

export interface MoveLearningPromptService {
  showMessage: (text: string) => Promise<void>;
  showYesNo: (text: string, defaultYes: boolean) => Promise<boolean>;
}

export interface MoveLearningMenuGateway {
  openMoveForgetMenu: (pokemon: PartyPokemon, moveToLearnId: number) => Promise<number | null>;
}

export function createMoveLearningPromptAdapter(
  promptService: MoveLearningPromptService,
  menuGateway: MoveLearningMenuGateway,
): MoveLearningPrompts {
  return {
    showMessage: (text) => promptService.showMessage(text),
    askYesNo: (text, options) => promptService.showYesNo(text, options?.defaultYes ?? true),
    chooseMoveToReplace: (context) => menuGateway.openMoveForgetMenu(context.pokemon, context.moveId),
  };
}

export function createMoveForgetMenuData(
  pokemon: PartyPokemon,
  moveToLearnId: number,
): {
  pokemonName: string;
  pokemonMoves: [number, number, number, number];
  pokemonPp: [number, number, number, number];
  pokemonPpBonuses: number;
  moveToLearnId: number;
} {
  return {
    pokemonName: formatPokemonDisplayName(pokemon),
    pokemonMoves: pokemon.moves,
    pokemonPp: pokemon.pp,
    pokemonPpBonuses: pokemon.ppBonuses,
    moveToLearnId,
  };
}
