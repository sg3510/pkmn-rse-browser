import { menuStateManager } from '../MenuStateManager.ts';
import { MOVES } from '../../data/moves.ts';
import { createMoveForgetMenuData } from '../../pokemon/moveLearningPromptAdapter.ts';
import type { PartyPokemon } from '../../pokemon/types.ts';

export interface OpenMoveForgetMenuRequest {
  pokemon: PartyPokemon;
  mode?: 'learn' | 'delete';
  moveToLearnId?: number;
  promptText?: string;
}

export function openMoveForgetMenu(request: OpenMoveForgetMenuRequest): Promise<number | null> {
  const mode = request.mode ?? 'learn';
  const moveToLearnId = request.moveToLearnId ?? MOVES.NONE;

  return menuStateManager.openAsync('moveForget', {
    ...createMoveForgetMenuData(request.pokemon, moveToLearnId),
    mode,
    promptText: request.promptText,
  });
}
