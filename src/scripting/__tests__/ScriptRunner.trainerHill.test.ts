import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { saveStateStore } from '../../save/SaveStateStore.ts';
import { resetTrainerHillRuntimeState, trainerHillIsTrainerDefeated } from '../../game/trainerHillRuntime.ts';
import { BATTLE_OUTCOME, type ScriptTrainerBattleRequest } from '../battleTypes.ts';
import { resetFrontierRuntimeState, setFrontierBattleOutcome } from '../runtime/frontierState.ts';
import { data as commonScriptData } from '../../data/scripts/common.gen.ts';

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
    ...overrides,
  };
}

function resetTrainerHillAndFrontierState(): void {
  gameVariables.reset();
  saveStateStore.resetRuntimeState();
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
    queueWarp: (mapId, x, y, direction) => {
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
