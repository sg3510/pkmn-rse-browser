import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { gameFlags } from '../../game/GameFlags.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';
import {
  resetTrainerHillRuntimeState,
  trainerHillGetSavedGame,
  trainerHillIsTrainerDefeated,
} from '../../game/trainerHillRuntime.ts';
import { BATTLE_OUTCOME, type ScriptTrainerBattleRequest } from '../battleTypes.ts';
import { getFrontierData, resetFrontierRuntimeState, setFrontierBattleOutcome } from '../runtime/frontierState.ts';
import { data as commonScriptData } from '../../data/scripts/common.gen.ts';
import { data as trainerHillEntranceScriptData } from '../../data/scripts/TrainerHill_Entrance.gen.ts';
import { menuStateManager } from '../../menu/MenuStateManager.ts';

function createData(commands: ScriptCommand[]): { mapData: MapScriptData; commonData: MapScriptData } {
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

function createContext(
  overrides: Partial<StoryScriptContext> = {},
): StoryScriptContext {
  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => 0,
    getPlayerName: () => 'PLAYER',
    hasPartyPokemon: () => true,
    setParty: () => {},
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
    ...overrides,
  };
}

function resetTrainerHillAndFrontierState(): void {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();
  gameFlags.reset();
  resetTrainerHillRuntimeState();
  resetFrontierRuntimeState();
}

test('trainerhill_getusingereader clears stale VAR_RESULT state', async () => {
  resetTrainerHillAndFrontierState();

  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_RESULT', 'TRUE'] },
    { cmd: 'trainerhill_getusingereader' },
    { cmd: 'setvar', args: ['VAR_0x8004', 'VAR_RESULT'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_TRAINER_HILL_1F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_RESULT'), 0);
  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);
});

test('trainerbattle TRAINER_BATTLE_HILL builds dynamic trainer and marks defeated state', async () => {
  resetTrainerHillAndFrontierState();

  const trainerBattleCalls: ScriptTrainerBattleRequest[] = [];
  const ctx = createContext({
    startTrainerBattle: async (request) => {
      trainerBattleCalls.push(request);
      return { outcome: BATTLE_OUTCOME.WON };
    },
  });

  const { mapData, commonData } = createData([
    { cmd: 'setvar', args: ['VAR_LAST_TALKED', 1] },
    {
      cmd: 'trainerbattle',
      args: ['TRAINER_BATTLE_HILL', 'TRAINER_PHILLIP', 'LOCALID_NONE', 'BattleFacility_TrainerBattle_PlaceholderText', 'BattleFacility_TrainerBattle_PlaceholderText'],
    },
    {
      cmd: 'trainerbattle',
      args: ['TRAINER_BATTLE_HILL', 'TRAINER_PHILLIP', 'LOCALID_NONE', 'BattleFacility_TrainerBattle_PlaceholderText', 'BattleFacility_TrainerBattle_PlaceholderText'],
    },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_TRAINER_HILL_1F');
  await runner.execute('Main');

  assert.equal(trainerBattleCalls.length, 1);
  assert.equal(trainerBattleCalls[0].mode, 'single');
  assert.ok(trainerBattleCalls[0].trainer);
  assert.equal(trainerBattleCalls[0].trainer?.party.length, 3);
  assert.ok((trainerBattleCalls[0].trainer?.party[0]?.species ?? 0) > 0);
  assert.equal(trainerHillIsTrainerDefeated('MAP_TRAINER_HILL_1F', 1), true);
});

test('trainerhill_start clears stale frontier battle outcome', async () => {
  resetTrainerHillAndFrontierState();
  setFrontierBattleOutcome(BATTLE_OUTCOME.LOST);

  const { mapData, commonData } = createData([
    { cmd: 'trainerhill_start' },
    { cmd: 'frontier_get', args: ['FRONTIER_DATA_BATTLE_OUTCOME'] },
    { cmd: 'setvar', args: ['VAR_0x8004', 'VAR_RESULT'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_TRAINER_HILL_1F');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_0x8004'), 0);
});

test('ground-floor entry scripts do not mis-warp from stale state', async () => {
  resetTrainerHillAndFrontierState();

  const queuedWarps: Array<{ mapId: string; x: number; y: number; direction: 'up' | 'down' | 'left' | 'right' }> = [];
  const ctx = createContext({
    queueWarp: async (mapId, x, y, direction) => {
      queuedWarps.push({ mapId, x, y, direction });
    },
  });

  setFrontierBattleOutcome(BATTLE_OUTCOME.LOST);
  gameVariables.setVar('VAR_RESULT', 1); // stale TRUE value that previously caused wrong Trainer Hill branches

  const { mapData } = createData([
    { cmd: 'trainerhill_start' },
    { cmd: 'call', args: ['TrainerHill_OnResume'] },
    { cmd: 'goto_if_eq', args: ['VAR_TEMP_2', 0, 'TrainerHill_1F_EventScript_DummyWarpToEntranceCounter'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner(
    { mapData, commonData: commonScriptData },
    ctx,
    'MAP_TRAINER_HILL_1F',
  );

  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_RESULT'), 0);
  assert.equal(gameVariables.getVar('VAR_TEMP_1'), 0);
  assert.equal(queuedWarps.length, 0);
});

test('trainer hill save gate succeeds when SaveGame special saves successfully', async () => {
  resetTrainerHillAndFrontierState();

  let saveCalls = 0;
  const ctx = createContext({
    showYesNo: async () => true,
  });
  const runner = new ScriptRunner(
    {
      mapData: trainerHillEntranceScriptData,
      commonData: commonScriptData,
    },
    ctx,
    'MAP_TRAINER_HILL_ENTRANCE',
    {
      save: {
        saveGame: () => {
          saveCalls++;
          return true;
        },
      },
    },
  );

  await runner.execute('TrainerHill_Entrance_EventScript_SaveGame');

  assert.equal(saveCalls, 1);
  assert.equal(gameVariables.getVar('VAR_RESULT'), 1);
  assert.equal(gameVariables.getVar('VAR_TEMP_5'), 1);
  assert.equal(trainerHillGetSavedGame(), true);
});

test('trainer hill save gate clears saved flag and cancels entry when save is declined', async () => {
  resetTrainerHillAndFrontierState();

  let saveCalls = 0;
  const ctx = createContext({
    showYesNo: async () => false,
  });
  const runner = new ScriptRunner(
    {
      mapData: trainerHillEntranceScriptData,
      commonData: commonScriptData,
    },
    ctx,
    'MAP_TRAINER_HILL_ENTRANCE',
    {
      save: {
        saveGame: () => {
          saveCalls++;
          return true;
        },
      },
    },
  );

  await runner.execute('TrainerHill_Entrance_EventScript_SaveGame');

  assert.equal(saveCalls, 0);
  assert.equal(gameVariables.getVar('VAR_RESULT'), 0);
  assert.equal(gameVariables.getVar('VAR_TEMP_5'), 0);
  assert.equal(trainerHillGetSavedGame(), false);
});

test('trainer hill entry trigger starts challenge after successful save and choice flow', async () => {
  resetTrainerHillAndFrontierState();
  gameFlags.set('FLAG_SYS_GAME_CLEAR');
  setFrontierBattleOutcome(BATTLE_OUTCOME.LOST);

  let saveCalls = 0;
  let choiceCalls = 0;
  const ctx = createContext({
    showYesNo: async () => true,
  });

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu) => {
    assert.equal(menu, 'scriptChoice');
    choiceCalls++;
    // 1st: MULTI_YESNOINFO -> choose "Yes"
    // 2nd: MULTI_TAG_MATCH_TYPE -> choose mode 0 (Normal)
    return 0;
  }) as typeof menuStateManager.openAsync;

  try {
    const runner = new ScriptRunner(
      {
        mapData: trainerHillEntranceScriptData,
        commonData: commonScriptData,
      },
      ctx,
      'MAP_TRAINER_HILL_ENTRANCE',
      {
        save: {
          saveGame: () => {
            saveCalls++;
            return true;
          },
        },
      },
    );

    await runner.execute('TrainerHill_Entrance_EventScript_EntryTrigger');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(saveCalls, 1);
  assert.equal(choiceCalls, 2);
  assert.equal(gameVariables.getVar('VAR_TRAINER_HILL_IS_ACTIVE'), 1);
  assert.equal(gameVariables.getVar('VAR_TEMP_5'), 0);
  assert.equal(gameVariables.getVar('VAR_TRAINER_HILL_MODE'), 0);
  assert.equal(getFrontierData('FRONTIER_DATA_BATTLE_OUTCOME'), 0);
});

test('trainer hill entry trigger cancels immediately when save prompt is declined', async () => {
  resetTrainerHillAndFrontierState();
  gameFlags.set('FLAG_SYS_GAME_CLEAR');

  let saveCalls = 0;
  let choiceCalls = 0;
  const ctx = createContext({
    showYesNo: async () => false,
  });

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async () => {
    choiceCalls++;
    return 0;
  }) as typeof menuStateManager.openAsync;

  try {
    const runner = new ScriptRunner(
      {
        mapData: trainerHillEntranceScriptData,
        commonData: commonScriptData,
      },
      ctx,
      'MAP_TRAINER_HILL_ENTRANCE',
      {
        save: {
          saveGame: () => {
            saveCalls++;
            return true;
          },
        },
      },
    );

    await runner.execute('TrainerHill_Entrance_EventScript_EntryTrigger');
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }

  assert.equal(saveCalls, 0);
  assert.equal(choiceCalls, 0);
  assert.equal(gameVariables.getVar('VAR_TRAINER_HILL_IS_ACTIVE'), 0);
  assert.equal(gameVariables.getVar('VAR_TEMP_5'), 0);
  assert.equal(trainerHillGetSavedGame(), false);
});
