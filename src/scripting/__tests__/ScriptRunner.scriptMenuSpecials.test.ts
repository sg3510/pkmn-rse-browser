import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { gameFlags } from '../../game/GameFlags.ts';
import { bagManager } from '../../game/BagManager.ts';
import { menuStateManager } from '../../menu/MenuStateManager.ts';
import type { PartyPokemon } from '../../pokemon/types.ts';

function createData(commands: ScriptCommand[]): {
  mapData: MapScriptData;
  commonData: MapScriptData;
} {
  return {
    mapData: {
      mapScripts: {},
      scripts: { Main: commands },
      movements: {},
      text: {},
    },
    commonData: {
      mapScripts: {},
      scripts: {},
      movements: {},
      text: {},
    },
  };
}

function createContext(overrides: Partial<StoryScriptContext> = {}): StoryScriptContext {
  const partyRef: (PartyPokemon | null)[] = [null, null, null, null, null, null];
  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'SEB',
    hasPartyPokemon: () => false,
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: () => {},
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
    getParty: () => partyRef,
    ...overrides,
  };
}

test('multichoicegrid routes through scriptChoice menu and stores index in VAR_RESULT', async () => {
  gameVariables.reset();
  gameFlags.reset();
  bagManager.reset();

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'scriptChoice');
    const payload = data as Record<string, unknown>;
    assert.equal(payload.columns, 3);
    return 2;
  }) as typeof menuStateManager.openAsync;

  try {
    const { mapData, commonData } = createData([
      { cmd: 'multichoicegrid', args: [8, 1, 'MULTI_STATUS_INFO', 3, 'FALSE'] },
      { cmd: 'end' },
    ]);
    const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_RUSTBORO_CITY_POKEMON_SCHOOL');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(gameVariables.getVar('VAR_RESULT'), 2);
});

test('ScriptMenu_CreateStartMenuForPokenavTutorial uses forced start multichoice labels', async () => {
  gameVariables.reset();
  gameFlags.reset();
  bagManager.reset();

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'scriptChoice');
    const payload = data as { choices?: Array<{ label: string }> };
    const labels = payload.choices?.map((choice) => choice.label) ?? [];
    assert.equal(labels[3], 'POKéNAV');
    assert.equal(labels[4], 'SEB');
    return 3;
  }) as typeof menuStateManager.openAsync;

  try {
    const { mapData, commonData } = createData([
      { cmd: 'special', args: ['ScriptMenu_CreateStartMenuForPokenavTutorial'] },
      { cmd: 'end' },
    ]);
    const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_RUSTBORO_CITY');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(gameVariables.getVar('VAR_RESULT'), 3);
});

test('ScriptMenu_CreatePCMultichoice builds dynamic PC options', async () => {
  gameVariables.reset();
  gameFlags.reset();
  bagManager.reset();
  gameFlags.set('FLAG_SYS_PC_LANETTE');
  gameFlags.set('FLAG_SYS_GAME_CLEAR');

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'scriptChoice');
    const payload = data as { choices?: Array<{ label: string }> };
    const labels = payload.choices?.map((choice) => choice.label) ?? [];
    assert.deepEqual(labels, ["LANETTE'S PC", "SEB's PC", 'HALL OF FAME', 'LOG OFF']);
    return 2;
  }) as typeof menuStateManager.openAsync;

  try {
    const { mapData, commonData } = createData([
      { cmd: 'special', args: ['ScriptMenu_CreatePCMultichoice'] },
      { cmd: 'end' },
    ]);
    const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(gameVariables.getVar('VAR_RESULT'), 2);
});

test('Lilycove SS Tidal selection maps local menu index to destination constant', async () => {
  gameVariables.reset();
  gameFlags.reset();
  bagManager.reset();

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu) => {
    assert.equal(menu, 'scriptChoice');
    // With default state (no tickets, no Scott flag), selections are [SLATEPORT, EXIT].
    return 1;
  }) as typeof menuStateManager.openAsync;

  try {
    const { mapData, commonData } = createData([
      { cmd: 'setvar', args: ['VAR_0x8004', 0] },
      { cmd: 'special', args: ['ScriptMenu_CreateLilycoveSSTidalMultichoice'] },
      { cmd: 'special', args: ['GetLilycoveSSTidalSelection'] },
      { cmd: 'end' },
    ]);
    const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_LILYCOVE_CITY_HARBOR');
    await runner.execute('Main');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(gameVariables.getVar('VAR_RESULT'), 6);
});
