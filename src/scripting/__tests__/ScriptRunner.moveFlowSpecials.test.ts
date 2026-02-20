import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { menuStateManager } from '../../menu/MenuStateManager.ts';
import { MOVES, getMoveName } from '../../data/moves.ts';
import { createTestPokemon } from '../../pokemon/testFactory.ts';
import type { PartyPokemon } from '../../pokemon/types.ts';
import { getRelearnableMoves } from '../../pokemon/moveLearning.ts';
import { SPECIES } from '../../data/species.ts';

function createData(commands: ScriptCommand[], text: Record<string, string> = {}): {
  mapData: MapScriptData;
  commonData: MapScriptData;
} {
  return {
    mapData: {
      mapScripts: {},
      scripts: { Main: commands },
      movements: {},
      text,
    },
    commonData: {
      mapScripts: {},
      scripts: {},
      movements: {},
      text: {},
    },
  };
}

function createContext(
  partyRef: { party: (PartyPokemon | null)[] },
  overrides: Partial<StoryScriptContext> = {},
): StoryScriptContext {
  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => partyRef.party.some((p) => p !== null),
    setParty: (nextParty) => {
      partyRef.party = [...nextParty];
    },
    startFirstBattle: async () => {},
    queueWarp: async () => {},
    forcePlayerStep: () => {},
    delayFrames: async () => {},
    movePlayer: async () => {},
    moveNpc: async () => {},
    faceNpcToPlayer: () => {},
    setNpcPosition: () => {},
    setNpcVisible: () => {},
    playDoorAnimation: async () => {},
    setPlayerVisible: () => {},
    showYesNo: async () => true,
    getParty: () => partyRef.party,
    ...overrides,
  };
}

test('move deleter specials share move-forget flow and apply deletion', async () => {
  gameVariables.reset();

  const partyRef = {
    party: [
      createTestPokemon({
        species: SPECIES.MUDKIP,
        level: 16,
        nickname: 'MUDDY',
        moves: [MOVES.SURF, MOVES.TACKLE, MOVES.GROWL, MOVES.NONE],
      }),
      null,
      null,
      null,
      null,
      null,
    ] as (PartyPokemon | null)[],
  };
  const shownMessages: string[] = [];

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'moveForget');
    const payload = data as Record<string, unknown>;
    assert.equal(payload.mode, 'delete');
    return 1;
  }) as typeof menuStateManager.openAsync;

  try {
    const ctx = createContext(partyRef, {
      showMessage: async (text: string) => {
        shownMessages.push(text);
      },
    });
    const { mapData, commonData } = createData(
      [
        { cmd: 'setvar', args: ['VAR_0x8004', 0] },
        { cmd: 'special', args: ['MoveDeleterChooseMoveToForget'] },
        { cmd: 'waitstate' },
        { cmd: 'special', args: ['BufferMoveDeleterNicknameAndMove'] },
        { cmd: 'msgbox', args: ['Text_Buffered', 'MSGBOX_DEFAULT'] },
        { cmd: 'special', args: ['MoveDeleterForgetMove'] },
        { cmd: 'special', args: ['GetNumMovesSelectedMonHas'] },
        { cmd: 'end' },
      ],
      {
        Text_Buffered: 'Chosen {STR_VAR_1} / {STR_VAR_2}',
      },
    );
    const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_LILYCOVE_CITY_MOVE_DELETERS_HOUSE');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(gameVariables.getVar('VAR_0x8005'), 1);
  assert.equal(gameVariables.getVar('VAR_RESULT'), 2);
  assert.equal(shownMessages.at(-1), `Chosen MUDDY / ${getMoveName(MOVES.TACKLE)}`);

  const mon = partyRef.party[0];
  assert.ok(mon);
  assert.deepEqual(mon.moves, [MOVES.SURF, MOVES.GROWL, MOVES.NONE, MOVES.NONE]);
});

test('ChooseMonForMoveRelearner stores selected mon and relearnable move count', async () => {
  gameVariables.reset();

  const mon = createTestPokemon({
    species: SPECIES.TREECKO,
    level: 15,
    moves: [MOVES.NONE, MOVES.NONE, MOVES.NONE, MOVES.NONE],
  });
  const expectedRelearnable = getRelearnableMoves(mon).length;
  assert.ok(expectedRelearnable > 0);

  const partyRef = {
    party: [mon, null, null, null, null, null] as (PartyPokemon | null)[],
  };

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu) => {
    assert.equal(menu, 'party');
    return 0;
  }) as typeof menuStateManager.openAsync;

  try {
    const ctx = createContext(partyRef);
    const { mapData, commonData } = createData([
      { cmd: 'special', args: ['ChooseMonForMoveRelearner'] },
      { cmd: 'waitstate' },
      { cmd: 'end' },
    ]);
    const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_FALLARBOR_TOWN_MOVE_RELEARNERS_HOUSE');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);
  assert.equal(gameVariables.getVar('VAR_0x8005'), expectedRelearnable);
});

test('TeachMoveRelearnerMove uses shared prompt + move-forget adapter and sets success flag', async () => {
  gameVariables.reset();

  const mon = createTestPokemon({
    species: SPECIES.TREECKO,
    level: 20,
    moves: [MOVES.TACKLE, MOVES.GROWL, MOVES.POUND, MOVES.SCRATCH],
  });
  const partyRef = {
    party: [mon, null, null, null, null, null] as (PartyPokemon | null)[],
  };

  let selectedMoveId = MOVES.NONE;
  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'moveForget');
    const payload = data as Record<string, unknown>;
    assert.equal(payload.mode, 'learn');
    return 2;
  }) as typeof menuStateManager.openAsync;

  try {
    const ctx = createContext(partyRef, {
      showChoice: async <T,>(_text: string, choices: Array<{ label: string; value: T }>) => {
        selectedMoveId = choices[0]?.value as number;
        return choices[0]?.value ?? null;
      },
      showYesNo: async () => true,
    });
    const { mapData, commonData } = createData([
      { cmd: 'setvar', args: ['VAR_0x8004', 0] },
      { cmd: 'special', args: ['TeachMoveRelearnerMove'] },
      { cmd: 'waitstate' },
      { cmd: 'end' },
    ]);
    const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_FALLARBOR_TOWN_MOVE_RELEARNERS_HOUSE');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.notEqual(selectedMoveId, MOVES.NONE);
  assert.equal(gameVariables.getVar('VAR_0x8004'), 1);
  const updatedMon = partyRef.party[0];
  assert.ok(updatedMon);
  assert.equal(updatedMon.moves[2], selectedMoveId);
});

test('IsLastMonThatKnowsSurf matches selected move slot and other-party checks', async () => {
  gameVariables.reset();

  const surfMon = createTestPokemon({
    species: SPECIES.MUDKIP,
    level: 16,
    moves: [MOVES.SURF, MOVES.TACKLE, MOVES.NONE, MOVES.NONE],
  });
  const noSurfMon = createTestPokemon({
    species: SPECIES.TREECKO,
    level: 16,
    moves: [MOVES.POUND, MOVES.GROWL, MOVES.NONE, MOVES.NONE],
  });

  const partyRef = {
    party: [surfMon, noSurfMon, null, null, null, null] as (PartyPokemon | null)[],
  };
  const ctx = createContext(partyRef);
  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_0x8004', 0] },
    { cmd: 'setvar', args: ['VAR_0x8005', 0] },
    { cmd: 'special', args: ['IsLastMonThatKnowsSurf'] },
    { cmd: 'end' },
  ]);
  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_LILYCOVE_CITY_MOVE_DELETERS_HOUSE');
  await runner.execute('Main');
  assert.equal(gameVariables.getVar('VAR_RESULT'), 1);

  partyRef.party[1] = createTestPokemon({
    species: SPECIES.SWAMPERT,
    level: 36,
    moves: [MOVES.SURF, MOVES.TACKLE, MOVES.NONE, MOVES.NONE],
  });
  await runner.execute('Main');
  assert.equal(gameVariables.getVar('VAR_RESULT'), 0);
});
