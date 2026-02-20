import assert from 'node:assert/strict';
import test from 'node:test';
import { ScriptRunner, type ScriptRuntimeServices } from '../ScriptRunner.ts';
import type { MapScriptData, ScriptCommand } from '../../data/scripts/types.ts';
import type { StoryScriptContext } from '../../game/NewGameFlow.ts';
import { gameVariables } from '../../game/GameVariables.ts';
import { berryManager } from '../../game/berry/BerryManager.ts';
import { BERRY_STAGE } from '../../game/berry/berryConstants.ts';
import { menuStateManager } from '../../menu/MenuStateManager.ts';
import { ITEMS } from '../../data/items.ts';

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

function createContext(): StoryScriptContext {
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
  };
}

test('setberrytree resolves constants and ITEM_TO_BERRY expressions', async () => {
  gameVariables.reset();
  berryManager.reset();

  const { mapData, commonData } = createData([
    {
      cmd: 'setberrytree',
      args: ['BERRY_TREE_ROUTE_102_ORAN', 'ITEM_TO_BERRY(ITEM_ORAN_BERRY)', 'BERRY_STAGE_BERRIES'],
    },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_ROUTE102');
  await runner.execute('Main');

  const tree = berryManager.getTreeSnapshot(2);
  assert.equal(tree.berry, 7);
  assert.equal(tree.stage, 5);
});

test('Bag_ChooseBerry returns from black fade before waitstate resumes', async () => {
  gameVariables.reset();
  berryManager.reset();

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  const fadeEvents: string[] = [];
  let fadeDirection: 'in' | 'out' | null = null;
  let fadeComplete = false;
  let resolveFadeInWait: (() => void) | null = null;
  const runtimeServices: ScriptRuntimeServices = {
    fade: {
      start: (direction) => {
        fadeDirection = direction;
        fadeComplete = false;
        fadeEvents.push(`start:${direction}`);
      },
      wait: async (_durationMs, direction) => {
        fadeEvents.push(`wait:${direction}`);
        if (direction === 'out') {
          fadeComplete = true;
          return;
        }
        await new Promise<void>((resolve) => {
          resolveFadeInWait = () => {
            fadeComplete = true;
            resolve();
          };
        });
      },
      framesToMs: (frames) => Math.max(1, frames),
      getDirection: () => fadeDirection,
      isActive: () => fadeDirection !== null,
      isComplete: () => fadeComplete,
    },
  };

  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'bag');
    const payload = data as Record<string, unknown>;
    assert.equal(payload.mode, 'berrySelect');
    fadeEvents.push('bag:open');
    return ITEMS.ITEM_ORAN_BERRY;
  }) as typeof menuStateManager.openAsync;

  try {
    const { mapData, commonData } = createData([
      { cmd: 'fadescreen', args: [1] },
      { cmd: 'special', args: ['Bag_ChooseBerry'] },
      { cmd: 'waitstate' },
      { cmd: 'setvar', args: ['VAR_0x8004', 1] },
      { cmd: 'end' },
    ]);

    const runner = new ScriptRunner(
      { mapData, commonData },
      createContext(),
      'MAP_ROUTE102',
      runtimeServices
    );
    const execution = runner.execute('Main');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // waitstate should still be pending while return-to-field fade-in waits.
    assert.equal(gameVariables.getVar('VAR_0x8004'), 0);
    assert.deepEqual(fadeEvents.slice(0, 5), [
      'start:out',
      'wait:out',
      'bag:open',
      'start:in',
      'wait:in',
    ]);

    resolveFadeInWait?.();
    await execution;

    assert.equal(gameVariables.getVar('VAR_0x8004'), 1);
    assert.equal(gameVariables.getVar('VAR_ITEM_ID'), ITEMS.ITEM_ORAN_BERRY);
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }
});

test('Bag_ChooseBerry does not force fade-in when not blacked out', async () => {
  gameVariables.reset();
  berryManager.reset();

  const originalOpenAsync = menuStateManager.openAsync.bind(menuStateManager);
  let fadeStartCalls = 0;
  const runtimeServices: ScriptRuntimeServices = {
    fade: {
      start: () => {
        fadeStartCalls++;
      },
      wait: async () => {},
      getDirection: () => null,
      isActive: () => false,
      isComplete: () => false,
    },
  };

  (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = (async (menu, data) => {
    assert.equal(menu, 'bag');
    const payload = data as Record<string, unknown>;
    assert.equal(payload.mode, 'berrySelect');
    return null;
  }) as typeof menuStateManager.openAsync;

  try {
    const { mapData, commonData } = createData([
      { cmd: 'special', args: ['Bag_ChooseBerry'] },
      { cmd: 'waitstate' },
      { cmd: 'end' },
    ]);

    const runner = new ScriptRunner(
      { mapData, commonData },
      createContext(),
      'MAP_ROUTE102',
      runtimeServices
    );
    await runner.execute('Main');

    assert.equal(fadeStartCalls, 0);
    assert.equal(gameVariables.getVar('VAR_ITEM_ID'), ITEMS.ITEM_NONE);
  } finally {
    (menuStateManager as unknown as { openAsync: typeof menuStateManager.openAsync }).openAsync = originalOpenAsync;
  }
});

test('berry watering updates watered stage count', async () => {
  gameVariables.reset();
  berryManager.reset();
  berryManager.setBerryTree(2, 7, 1, true);
  berryManager.setActiveInteraction({ mapId: 'MAP_ROUTE102', localId: 10, treeId: 2 });

  const { mapData, commonData } = createData([
    { cmd: 'special', args: ['ObjectEventInteractionWaterBerryTree'] },
    { cmd: 'special', args: ['ObjectEventInteractionGetBerryTreeData'] },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, createContext(), 'MAP_ROUTE102');
  await runner.execute('Main');

  assert.equal(gameVariables.getVar('VAR_0x8005'), 1);
  berryManager.clearActiveInteraction();
});

test('DoWateringBerryTreeAnim uses watering sprite override during held movement', async () => {
  gameVariables.reset();
  const spriteOverrides: Array<string | null> = [];
  let moveCalls = 0;

  const ctx: StoryScriptContext = {
    ...createContext(),
    movePlayer: async () => {
      moveCalls++;
    },
    setPlayerSpriteOverride: (spriteKey) => {
      spriteOverrides.push(spriteKey);
    },
  };

  const { mapData, commonData } = createData([
    { cmd: 'special', args: ['DoWateringBerryTreeAnim'] },
    { cmd: 'waitstate' },
    { cmd: 'end' },
  ]);

  const runner = new ScriptRunner({ mapData, commonData }, ctx, 'MAP_ROUTE102');
  await runner.execute('Main');

  assert.equal(moveCalls, 11);
  assert.deepEqual(spriteOverrides, ['watering', null]);
});

test('interacting with an adjacent empty berry soil does not mutate another planted tree', async () => {
  gameVariables.reset();
  berryManager.reset(Date.now());

  const treeA = 85;
  const treeB = 86;
  berryManager.setActiveInteraction({ mapId: 'MAP_ROUTE119', localId: 1, treeId: treeA });
  gameVariables.setVar('VAR_ITEM_ID', ITEMS.ITEM_ORAN_BERRY);

  const plantScripts = createData([
    { cmd: 'special', args: ['ObjectEventInteractionPlantBerryTree'] },
    { cmd: 'end' },
  ]);
  const plantRunner = new ScriptRunner(plantScripts, createContext(), 'MAP_ROUTE119');
  await plantRunner.execute('Main');

  const before = berryManager.getTreeSnapshot(treeA);
  assert.equal(before.stage, BERRY_STAGE.PLANTED);

  berryManager.setActiveInteraction({ mapId: 'MAP_ROUTE119', localId: 2, treeId: treeB });
  const inspectScripts = createData([
    { cmd: 'special', args: ['ObjectEventInteractionGetBerryTreeData'] },
    { cmd: 'end' },
  ]);
  const inspectRunner = new ScriptRunner(inspectScripts, createContext(), 'MAP_ROUTE119');
  await inspectRunner.execute('Main');

  const after = berryManager.getTreeSnapshot(treeA);
  const emptyNeighbor = berryManager.getTreeSnapshot(treeB);
  assert.equal(after.stage, BERRY_STAGE.PLANTED);
  assert.equal(after.berry, before.berry);
  assert.equal(emptyNeighbor.stage, BERRY_STAGE.NO_BERRY);

  berryManager.clearActiveInteraction();
});
