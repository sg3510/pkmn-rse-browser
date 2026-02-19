/**
 * Move-learning helpers with Gen 3 style replacement flow semantics.
 *
 * C refs:
 * - public/pokeemerald/src/pokemon.c (MonTryLearningNewMove, SetMonMoveSlot, RemoveMonPPBonus)
 * - public/pokeemerald/src/battle_script_commands.c (Cmd_handlelearnnewmove / yes-no loops)
 * - public/pokeemerald/src/evolution_scene.c (MVSTATE_* replacement flow)
 */

import { getLearnset } from '../data/learnsets.gen.ts';
import { getMoveInfo, getMoveName, MOVES } from '../data/moves.ts';
import { getSpeciesName } from '../data/species.ts';
import type { PartyPokemon } from './types.ts';

export const HM_MOVES = new Set<number>([
  MOVES.CUT,
  MOVES.FLY,
  MOVES.SURF,
  MOVES.STRENGTH,
  MOVES.FLASH,
  MOVES.ROCK_SMASH,
  MOVES.WATERFALL,
  MOVES.DIVE,
]);

export interface MoveLearnPromptContext {
  pokemon: PartyPokemon;
  pokemonName: string;
  moveId: number;
}

export interface MoveLearningPrompts {
  showMessage: (text: string) => Promise<void>;
  askYesNo: (
    text: string,
    options?: {
      defaultYes?: boolean;
    },
  ) => Promise<boolean>;
  chooseMoveToReplace: (
    context: MoveLearnPromptContext,
  ) => Promise<number | null>;
}

export interface MoveLearningResult {
  pokemon: PartyPokemon;
  learnedMoveIds: number[];
}

export interface MoveLearnAttemptResult {
  kind: 'already_knows' | 'learned' | 'needs_replacement';
  pokemon: PartyPokemon;
}

function getDisplayName(mon: PartyPokemon): string {
  const nickname = mon.nickname?.trim();
  return nickname && nickname.length > 0 ? nickname : getSpeciesName(mon.species);
}

function withMoveSlot(mon: PartyPokemon, slot: number, moveId: number): PartyPokemon {
  const info = getMoveInfo(moveId);
  const pp = info?.pp ?? 0;
  const moves = [...mon.moves] as [number, number, number, number];
  const pps = [...mon.pp] as [number, number, number, number];

  moves[slot] = moveId;
  pps[slot] = pp;

  const bitShift = slot * 2;
  const ppBonuses = mon.ppBonuses & ~(0x3 << bitShift);

  return {
    ...mon,
    moves,
    pp: pps,
    ppBonuses,
  };
}

export function getLevelUpMovesBetween(
  speciesId: number,
  prevLevelExclusive: number,
  nextLevelInclusive: number,
): number[] {
  if (nextLevelInclusive <= prevLevelExclusive) {
    return [];
  }

  const learnset = getLearnset(speciesId);
  return learnset
    .filter((entry) => entry.level > prevLevelExclusive && entry.level <= nextLevelInclusive)
    .map((entry) => entry.moveId);
}

export function getMovesAtExactLevel(
  speciesId: number,
  level: number,
): number[] {
  const learnset = getLearnset(speciesId);
  return learnset
    .filter((entry) => entry.level === level)
    .map((entry) => entry.moveId);
}

export function isHmMove(moveId: number): boolean {
  return HM_MOVES.has(moveId);
}

export function tryLearnMove(
  mon: PartyPokemon,
  moveId: number,
): MoveLearnAttemptResult {
  if (mon.moves.includes(moveId)) {
    return {
      kind: 'already_knows',
      pokemon: mon,
    };
  }

  const emptySlot = mon.moves.findIndex((move) => move === MOVES.NONE);
  if (emptySlot >= 0) {
    return {
      kind: 'learned',
      pokemon: withMoveSlot(mon, emptySlot, moveId),
    };
  }

  return {
    kind: 'needs_replacement',
    pokemon: mon,
  };
}

export function replaceMove(
  mon: PartyPokemon,
  slot: number,
  moveId: number,
): PartyPokemon {
  return withMoveSlot(mon, slot, moveId);
}

async function runReplaceFlow(
  mon: PartyPokemon,
  moveId: number,
  prompts: MoveLearningPrompts,
): Promise<{ pokemon: PartyPokemon; learned: boolean }> {
  const pokemonName = getDisplayName(mon);
  const moveName = getMoveName(moveId);

  for (;;) {
    await prompts.showMessage(`${pokemonName} is trying to learn ${moveName}.`);
    await prompts.showMessage(`But ${pokemonName} can't learn more than four moves.`);
    const wantsDelete = await prompts.askYesNo(`Delete a move to make room for ${moveName}?`, {
      defaultYes: true,
    });

    if (!wantsDelete) {
      const stopLearning = await prompts.askYesNo(
        `Stop learning ${moveName}?`,
        { defaultYes: true },
      );
      if (stopLearning) {
        await prompts.showMessage(`${pokemonName} did not learn ${moveName}.`);
        return { pokemon: mon, learned: false };
      }
      continue;
    }

    for (;;) {
      const slot = await prompts.chooseMoveToReplace({
        pokemon: mon,
        pokemonName,
        moveId,
      });
      if (slot === null) {
        break;
      }
      const selectedMove = mon.moves[slot] ?? MOVES.NONE;
      if (selectedMove === MOVES.NONE) {
        break;
      }
      if (isHmMove(selectedMove)) {
        await prompts.showMessage('HM moves can\'t be forgotten now.');
        continue;
      }

      const forgottenName = getMoveName(selectedMove);
      await prompts.showMessage('1, 2, and... Poof!');
      await prompts.showMessage(`${pokemonName} forgot ${forgottenName}.`);
      await prompts.showMessage(`And...`);
      const replaced = replaceMove(mon, slot, moveId);
      await prompts.showMessage(`${pokemonName} learned ${moveName}!`);
      return { pokemon: replaced, learned: true };
    }

    const stopLearning = await prompts.askYesNo(
      `Stop learning ${moveName}?`,
      { defaultYes: true },
    );
    if (stopLearning) {
      await prompts.showMessage(`${pokemonName} did not learn ${moveName}.`);
      return { pokemon: mon, learned: false };
    }
  }
}

export async function runMoveLearningSequence(
  mon: PartyPokemon,
  movesToLearn: readonly number[],
  prompts: MoveLearningPrompts,
): Promise<MoveLearningResult> {
  let nextMon = mon;
  const learnedMoveIds: number[] = [];

  for (const moveId of movesToLearn) {
    const attempt = tryLearnMove(nextMon, moveId);
    if (attempt.kind === 'already_knows') {
      continue;
    }

    if (attempt.kind === 'learned') {
      nextMon = attempt.pokemon;
      learnedMoveIds.push(moveId);
      await prompts.showMessage(`${getDisplayName(nextMon)} learned ${getMoveName(moveId)}!`);
      continue;
    }

    const replaced = await runReplaceFlow(nextMon, moveId, prompts);
    nextMon = replaced.pokemon;
    if (replaced.learned) {
      learnedMoveIds.push(moveId);
    }
  }

  return {
    pokemon: nextMon,
    learnedMoveIds,
  };
}
