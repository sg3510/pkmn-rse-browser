import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestPokemon } from '../testFactory.ts';
import { MOVES } from '../../data/moves.ts';
import {
  getLevelUpMovesBetween,
  isHmMove,
  replaceMove,
  runMoveLearningSequence,
  tryLearnMove,
  type MoveLearningPrompts,
} from '../moveLearning.ts';
import { SPECIES } from '../../data/species.ts';
import type { PartyPokemon } from '../types.ts';

function withMon(mon: PartyPokemon, patch: Partial<PartyPokemon>): PartyPokemon {
  return {
    ...mon,
    ...patch,
    moves: (patch.moves ?? mon.moves) as [number, number, number, number],
    pp: (patch.pp ?? mon.pp) as [number, number, number, number],
  };
}

function createPromptHarness(options: {
  yesNoAnswers?: boolean[];
  moveChoices?: Array<number | null>;
  messages?: string[];
} = {}): MoveLearningPrompts {
  const yesNoAnswers = [...(options.yesNoAnswers ?? [])];
  const moveChoices = [...(options.moveChoices ?? [])];
  const messages = options.messages ?? [];

  return {
    showMessage: async (text: string) => {
      messages.push(text);
    },
    askYesNo: async () => {
      if (yesNoAnswers.length === 0) {
        return true;
      }
      return yesNoAnswers.shift() as boolean;
    },
    chooseMoveToReplace: async () => {
      if (moveChoices.length === 0) {
        return null;
      }
      return moveChoices.shift() as number | null;
    },
  };
}

test('tryLearnMove skips already-known moves and fills free slots', () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.TREECKO, level: 10 }),
    {
      moves: [MOVES.POUND, MOVES.LEER, MOVES.NONE, MOVES.NONE],
      pp: [35, 30, 0, 0],
    },
  );

  const alreadyKnows = tryLearnMove(mon, MOVES.POUND);
  assert.equal(alreadyKnows.kind, 'already_knows');

  const learned = tryLearnMove(mon, MOVES.QUICK_ATTACK);
  assert.equal(learned.kind, 'learned');
  assert.equal(learned.pokemon.moves[2], MOVES.QUICK_ATTACK);
});

test('replaceMove clears PP bonus bits for the replaced slot', () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.TREECKO, level: 10 }),
    {
      moves: [MOVES.POUND, MOVES.LEER, MOVES.QUICK_ATTACK, MOVES.ABSORB],
      ppBonuses: 0b11111111,
    },
  );

  const replaced = replaceMove(mon, 1, MOVES.PURSUIT);
  assert.equal(replaced.moves[1], MOVES.PURSUIT);
  assert.equal((replaced.ppBonuses >> 2) & 0x3, 0);
});

test('runMoveLearningSequence supports replacement after full move set', async () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.TORCHIC, level: 16 }),
    {
      moves: [MOVES.SCRATCH, MOVES.GROWL, MOVES.EMBER, MOVES.PECK],
      pp: [35, 40, 25, 35],
    },
  );

  const prompts = createPromptHarness({
    yesNoAnswers: [true],
    moveChoices: [2],
  });
  const result = await runMoveLearningSequence(mon, [MOVES.DOUBLE_KICK], prompts);

  assert.deepEqual(result.learnedMoveIds, [MOVES.DOUBLE_KICK]);
  assert.equal(result.pokemon.moves[2], MOVES.DOUBLE_KICK);
});

test('HM rejection loops back to move selection and supports retry', async () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.SWELLOW, level: 30 }),
    {
      moves: [MOVES.FLY, MOVES.WING_ATTACK, MOVES.QUICK_ATTACK, MOVES.ENDEAVOR],
      pp: [15, 35, 30, 5],
    },
  );

  const messages: string[] = [];
  const prompts = createPromptHarness({
    yesNoAnswers: [true],
    moveChoices: [0, 3],
    messages,
  });

  const result = await runMoveLearningSequence(mon, [MOVES.AERIAL_ACE], prompts);
  assert.equal(result.pokemon.moves[0], MOVES.FLY);
  assert.equal(result.pokemon.moves[3], MOVES.AERIAL_ACE);
  assert.equal(messages.some((message) => message.includes("can't be forgotten")), true);
});

test('stop-learning prompt with B/NO semantics retries learning loop', async () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.MUDKIP, level: 16 }),
    {
      moves: [MOVES.TACKLE, MOVES.GROWL, MOVES.WATER_GUN, MOVES.MUD_SLAP],
      pp: [35, 40, 25, 10],
    },
  );

  // false = choose NO on "delete move?"
  // false = choose NO / B-equivalent on "stop learning?" -> retry
  // true = choose YES on second "delete move?"
  const prompts = createPromptHarness({
    yesNoAnswers: [false, false, true],
    moveChoices: [1],
  });
  const result = await runMoveLearningSequence(mon, [MOVES.TAKE_DOWN], prompts);

  assert.deepEqual(result.learnedMoveIds, [MOVES.TAKE_DOWN]);
  assert.equal(result.pokemon.moves[1], MOVES.TAKE_DOWN);
});

test('stop-learning YES cancels learning attempt', async () => {
  const mon = withMon(
    createTestPokemon({ species: SPECIES.MUDKIP, level: 16 }),
    {
      moves: [MOVES.TACKLE, MOVES.GROWL, MOVES.WATER_GUN, MOVES.MUD_SLAP],
      pp: [35, 40, 25, 10],
    },
  );
  const prompts = createPromptHarness({
    yesNoAnswers: [false, true],
  });
  const result = await runMoveLearningSequence(mon, [MOVES.TAKE_DOWN], prompts);

  assert.deepEqual(result.learnedMoveIds, []);
  assert.equal(result.pokemon.moves.includes(MOVES.TAKE_DOWN), false);
});

test('getLevelUpMovesBetween returns learnset-ordered range', () => {
  const moves = getLevelUpMovesBetween(SPECIES.BULBASAUR, 3, 10);
  assert.deepEqual(moves, [MOVES.GROWL, MOVES.LEECH_SEED, MOVES.VINE_WHIP]);
});

test('isHmMove recognizes Gen 3 HM list', () => {
  assert.equal(isHmMove(MOVES.CUT), true);
  assert.equal(isHmMove(MOVES.FLY), true);
  assert.equal(isHmMove(MOVES.SURF), true);
  assert.equal(isHmMove(MOVES.TACKLE), false);
});
