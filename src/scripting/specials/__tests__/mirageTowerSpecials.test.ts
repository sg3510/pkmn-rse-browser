import assert from 'node:assert/strict';
import test from 'node:test';
import { METATILE_LABELS } from '../../../data/metatileLabels.gen.ts';
import {
  executeMirageTowerSpecial,
  type MirageTowerSpecialContext,
} from '../mirageTowerSpecials.ts';
import type { ScriptCameraShakeRequest } from '../legendaryIslandSpecials.ts';

interface MirageTowerTestHarness {
  ctx: MirageTowerSpecialContext;
  vars: Map<string, number>;
  flags: Set<string>;
  metatileCalls: Array<{
    mapId: string;
    x: number;
    y: number;
    metatileId: number;
    collision?: number;
  }>;
  moveNpcCalls: Array<{
    mapId: string;
    localId: string;
    direction: 'up' | 'down' | 'left' | 'right';
    mode?: string;
  }>;
  setNpcPositionCalls: Array<{ mapId: string; localId: string; x: number; y: number }>;
  setNpcVisibleCalls: Array<{ mapId: string; localId: string; visible: boolean; persistent?: boolean }>;
  setSpriteHiddenCalls: Array<{ mapId: string; localId: string; hidden: boolean }>;
  shakeCalls: ScriptCameraShakeRequest[];
  delayFramesCalls: number[];
  mirageTowerCalls: string[];
}

function createHarness(
  options: {
    mapId?: string;
    vars?: Record<string, number>;
    flags?: readonly string[];
    npcLocalIds?: readonly string[];
    npcGraphicsByLocalId?: Record<string, string>;
    enableMirageTowerServices?: boolean;
  } = {}
): MirageTowerTestHarness {
  const vars = new Map<string, number>(Object.entries(options.vars ?? {}));
  const flags = new Set<string>(options.flags ?? []);
  const metatileCalls: MirageTowerTestHarness['metatileCalls'] = [];
  const moveNpcCalls: MirageTowerTestHarness['moveNpcCalls'] = [];
  const setNpcPositionCalls: MirageTowerTestHarness['setNpcPositionCalls'] = [];
  const setNpcVisibleCalls: MirageTowerTestHarness['setNpcVisibleCalls'] = [];
  const setSpriteHiddenCalls: MirageTowerTestHarness['setSpriteHiddenCalls'] = [];
  const shakeCalls: ScriptCameraShakeRequest[] = [];
  const delayFramesCalls: number[] = [];
  const mirageTowerCalls: string[] = [];
  const npcLocalIds = options.npcLocalIds ?? [];
  const npcGraphicsByLocalId = options.npcGraphicsByLocalId ?? {};

  const ctx: MirageTowerSpecialContext = {
    currentMapId: options.mapId ?? 'MAP_ROUTE111',
    getVar: (varName) => vars.get(varName) ?? 0,
    isFlagSet: (flagName) => flags.has(flagName),
    setFlag: (flagName) => {
      flags.add(flagName);
    },
    clearFlag: (flagName) => {
      flags.delete(flagName);
    },
    setMapMetatile: (mapId, x, y, metatileId, collision) => {
      metatileCalls.push({ mapId, x, y, metatileId, collision });
    },
    delayFrames: async (frames) => {
      delayFramesCalls.push(frames);
    },
    moveNpc: async (mapId, localId, direction, mode) => {
      moveNpcCalls.push({ mapId, localId, direction, mode });
    },
    setNpcPosition: (mapId, localId, x, y) => {
      setNpcPositionCalls.push({ mapId, localId, x, y });
    },
    setNpcVisible: (mapId, localId, visible, persistent) => {
      setNpcVisibleCalls.push({ mapId, localId, visible, persistent });
    },
    setSpriteHidden: (mapId, localId, hidden) => {
      setSpriteHiddenCalls.push({ mapId, localId, hidden });
    },
    getAllNpcLocalIds: () => [...npcLocalIds],
    getNpcGraphicsId: (_mapId, localId) => npcGraphicsByLocalId[localId] ?? null,
    camera: {
      shake: async (request) => {
        shakeCalls.push(request);
      },
    },
    mirageTower: options.enableMirageTowerServices
      ? {
          startShake: async () => {
            mirageTowerCalls.push('startShake');
          },
          startPlayerDescend: async () => {
            mirageTowerCalls.push('startPlayerDescend');
          },
          startDisintegration: async () => {
            mirageTowerCalls.push('startDisintegration');
          },
          clear: () => {
            mirageTowerCalls.push('clear');
          },
        }
      : undefined,
  };

  return {
    ctx,
    vars,
    flags,
    metatileCalls,
    moveNpcCalls,
    setNpcPositionCalls,
    setNpcVisibleCalls,
    setSpriteHiddenCalls,
    shakeCalls,
    delayFramesCalls,
    mirageTowerCalls,
  };
}

test('SetMirageTowerVisibility clears visibility after event completion and applies no-tower tiles', () => {
  const harness = createHarness({
    vars: { VAR_MIRAGE_TOWER_STATE: 2 },
    flags: ['FLAG_MIRAGE_TOWER_VISIBLE'],
  });

  const result = executeMirageTowerSpecial('SetMirageTowerVisibility', harness.ctx);
  assert.deepEqual(result, { handled: true });
  assert.equal(harness.flags.has('FLAG_MIRAGE_TOWER_VISIBLE'), false);
  assert.equal(harness.metatileCalls.length, 18);
  assert.deepEqual(harness.metatileCalls[0], {
    mapId: 'MAP_ROUTE111',
    x: 18,
    y: 53,
    metatileId: METATILE_LABELS.METATILE_Mauville_DeepSand_Center,
    collision: 0,
  });
});

test('SetMirageTowerVisibility forces visible state and applies tower metatiles', () => {
  const harness = createHarness({
    vars: { VAR_MIRAGE_TOWER_STATE: 0 },
    flags: ['FLAG_FORCE_MIRAGE_TOWER_VISIBLE'],
  });

  const result = executeMirageTowerSpecial('SetMirageTowerVisibility', harness.ctx);
  assert.deepEqual(result, { handled: true });
  assert.equal(harness.flags.has('FLAG_MIRAGE_TOWER_VISIBLE'), true);
  assert.ok(
    harness.metatileCalls.some(
      (call) =>
        call.x === 18
        && call.y === 53
        && call.metatileId === METATILE_LABELS.METATILE_Mauville_MirageTower_Tile0
    )
  );
});

test('StartMirageTowerShake starts long shake task and resolves quickly for waitstate', async () => {
  const harness = createHarness();
  const result = executeMirageTowerSpecial('StartMirageTowerShake', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);

  await result.waitState;
  assert.deepEqual(harness.shakeCalls, [
    {
      verticalPan: 0,
      horizontalPan: 2,
      numShakes: 64,
      delayFrames: 2,
    },
  ]);
  assert.deepEqual(harness.delayFramesCalls, [6]);
});

test('StartPlayerDescendMirageTower moves the falling player object down six fast tiles', async () => {
  const harness = createHarness();
  const result = executeMirageTowerSpecial('StartPlayerDescendMirageTower', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);

  await result.waitState;
  assert.deepEqual(harness.setNpcPositionCalls, [
    {
      mapId: 'MAP_ROUTE111',
      localId: 'LOCALID_ROUTE111_PLAYER_FALLING',
      x: 19,
      y: 53,
    },
  ]);
  assert.equal(harness.moveNpcCalls.length, 6);
  for (const call of harness.moveNpcCalls) {
    assert.deepEqual(call, {
      mapId: 'MAP_ROUTE111',
      localId: 'LOCALID_ROUTE111_PLAYER_FALLING',
      direction: 'down',
      mode: 'walk_faster',
    });
  }
});

test('StartMirageTowerDisintegration replaces all tower tiles and runs camera shake', async () => {
  const harness = createHarness();
  const result = executeMirageTowerSpecial('StartMirageTowerDisintegration', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);

  await result.waitState;

  assert.deepEqual(harness.shakeCalls, [
    {
      verticalPan: 0,
      horizontalPan: 2,
      numShakes: 24,
      delayFrames: 2,
    },
  ]);
  assert.equal(harness.metatileCalls.length, 18);
  const uniqueCoords = new Set(harness.metatileCalls.map((call) => `${call.x},${call.y}`));
  assert.equal(uniqueCoords.size, 18);
  for (const call of harness.metatileCalls) {
    assert.equal(call.collision, 0);
  }
});

test('StartMirageTowerFossilFallAndSink resolves fossil local ID, animates fall, and hides it persistently', async () => {
  const harness = createHarness({
    npcLocalIds: ['10', '44'],
    npcGraphicsByLocalId: {
      '10': 'OBJ_EVENT_GFX_GIRL_1',
      '44': 'OBJ_EVENT_GFX_FOSSIL',
    },
  });

  const result = executeMirageTowerSpecial('StartMirageTowerFossilFallAndSink', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);
  await result.waitState;

  assert.deepEqual(harness.setNpcPositionCalls, [
    {
      mapId: 'MAP_ROUTE111',
      localId: '44',
      x: 20,
      y: 53,
    },
  ]);

  assert.deepEqual(harness.setNpcVisibleCalls[0], {
    mapId: 'MAP_ROUTE111',
    localId: '44',
    visible: true,
    persistent: false,
  });
  assert.deepEqual(harness.setNpcVisibleCalls[harness.setNpcVisibleCalls.length - 1], {
    mapId: 'MAP_ROUTE111',
    localId: '44',
    visible: false,
    persistent: true,
  });

  assert.equal(harness.moveNpcCalls.length, 6);
  assert.equal(harness.setSpriteHiddenCalls.length, 9);
  assert.deepEqual(harness.setSpriteHiddenCalls[harness.setSpriteHiddenCalls.length - 1], {
    mapId: 'MAP_ROUTE111',
    localId: '44',
    hidden: false,
  });
  assert.equal(harness.flags.has('FLAG_HIDE_ROUTE_111_DESERT_FOSSIL'), true);
});

test('DoMirageTowerCeilingCrumble runs 16-shake sequence and waits for crumble tail frames', async () => {
  const harness = createHarness({ mapId: 'MAP_MIRAGE_TOWER_4F' });
  const result = executeMirageTowerSpecial('DoMirageTowerCeilingCrumble', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);

  await result.waitState;
  assert.deepEqual(harness.shakeCalls, [
    {
      verticalPan: 2,
      horizontalPan: 1,
      numShakes: 16,
      delayFrames: 3,
    },
  ]);
  assert.deepEqual(harness.delayFramesCalls, [24]);
});

test('StartMirageTowerShake uses runtime service when available and applies hidden-tower metatiles', async () => {
  const harness = createHarness({ enableMirageTowerServices: true });
  const result = executeMirageTowerSpecial('StartMirageTowerShake', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);
  await result.waitState;

  assert.deepEqual(harness.mirageTowerCalls, ['startShake']);
  assert.equal(harness.shakeCalls.length, 0);
  assert.equal(harness.metatileCalls.length, 18);
});

test('StartPlayerDescendMirageTower uses runtime service when available', async () => {
  const harness = createHarness({ enableMirageTowerServices: true });
  const result = executeMirageTowerSpecial('StartPlayerDescendMirageTower', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);
  await result.waitState;

  assert.deepEqual(harness.mirageTowerCalls, ['startPlayerDescend']);
  assert.equal(harness.moveNpcCalls.length, 0);
});

test('StartMirageTowerDisintegration uses runtime service when available', async () => {
  const harness = createHarness({ enableMirageTowerServices: true });
  const result = executeMirageTowerSpecial('StartMirageTowerDisintegration', harness.ctx);
  assert.equal(result.handled, true);
  assert.ok(result.waitState);
  await result.waitState;

  assert.deepEqual(harness.mirageTowerCalls, ['startDisintegration']);
  assert.equal(harness.shakeCalls.length, 0);
});
