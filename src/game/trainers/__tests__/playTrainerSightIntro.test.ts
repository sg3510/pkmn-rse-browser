import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NPCObject } from '../../../types/objectEvents.ts';
import type { TrainerSightEncounterTrigger } from '../trainerSightEncounter.ts';
import { playTrainerSightIntro } from '../playTrainerSightIntro.ts';
import type { ObjectEventManager } from '../../ObjectEventManager.ts';
import type { ScriptRuntimeServices } from '../../../scripting/ScriptRunner.ts';
import type { PlayerController } from '../../PlayerController.ts';

function createTrainerNpc(overrides: Partial<NPCObject> = {}): NPCObject {
  return {
    id: 'MAP_TEST_npc_1',
    localId: '1',
    localIdNumber: 1,
    tileX: 2,
    tileY: 5,
    elevation: 0,
    graphicsId: 'OBJ_EVENT_GFX_BUG_CATCHER',
    direction: 'right',
    movementType: 'face_right',
    movementTypeRaw: 'MOVEMENT_TYPE_FACE_RIGHT',
    movementRangeX: 0,
    movementRangeY: 0,
    trainerType: 'normal',
    trainerSightRange: 6,
    script: 'TrainerScript',
    flag: '0',
    visible: true,
    spriteHidden: false,
    scriptRemoved: false,
    renderAboveGrass: false,
    subTileX: 0,
    subTileY: 0,
    isWalking: false,
    initialTileX: 2,
    initialTileY: 5,
    ...overrides,
  };
}

function createTrigger(overrides: Partial<TrainerSightEncounterTrigger> = {}): TrainerSightEncounterTrigger {
  return {
    npcId: 'MAP_TEST_npc_1',
    mapId: 'MAP_TEST',
    localId: '1',
    localIdNumber: 1,
    scriptName: 'TrainerScript',
    approachDistance: 3,
    approachDirection: 'right',
    ...overrides,
  };
}

function createObjectEventManagerMock(npc: NPCObject | null): ObjectEventManager {
  return {
    getNPCByLocalId: () => npc,
    faceNpcTowardPlayer: (_mapId: string, _localId: string, playerTileX: number, playerTileY: number) => {
      if (!npc) return;
      const dx = playerTileX - npc.tileX;
      const dy = playerTileY - npc.tileY;
      if (Math.abs(dx) > Math.abs(dy)) {
        npc.direction = dx < 0 ? 'left' : 'right';
      } else if (dy !== 0) {
        npc.direction = dy < 0 ? 'up' : 'down';
      }
    },
  } as unknown as ObjectEventManager;
}

test('plays exclamation, moves trainer to adjacency, and faces player', async () => {
  const npc = createTrainerNpc();
  const trigger = createTrigger();
  const player = {
    tileX: 5,
    tileY: 5,
    dir: 'up',
  } as unknown as PlayerController;
  const fieldEffectCalls: string[] = [];
  let waitedFrames = 0;

  const scriptRuntimeServices: ScriptRuntimeServices = {
    fieldEffects: {
      run: async (effectName) => {
        fieldEffectCalls.push(`run:${effectName}`);
      },
      wait: async (effectName) => {
        fieldEffectCalls.push(`wait:${effectName}`);
      },
    },
  };

  await playTrainerSightIntro({
    trigger,
    player,
    objectEventManager: createObjectEventManagerMock(npc),
    scriptRuntimeServices,
    waitFrames: async (frames) => {
      waitedFrames += Math.max(0, Math.round(frames));
    },
  });

  assert.deepEqual(fieldEffectCalls, [
    'run:FLDEFF_EXCLAMATION_MARK_ICON',
    'wait:FLDEFF_EXCLAMATION_MARK_ICON',
  ]);
  assert.equal(npc.tileX, 4);
  assert.equal(npc.tileY, 5);
  assert.equal(npc.direction, 'right');
  assert.equal(player.dir, 'left');
  assert.ok(waitedFrames >= 33);
});

test('falls back to fixed exclamation wait and still faces player when trainer object is missing', async () => {
  const trigger = createTrigger({ approachDirection: 'up', approachDistance: 2 });
  const player = {
    tileX: 8,
    tileY: 8,
    dir: 'left',
  } as unknown as PlayerController;
  let waitedFrames = 0;

  await playTrainerSightIntro({
    trigger,
    player,
    objectEventManager: createObjectEventManagerMock(null),
    scriptRuntimeServices: {},
    waitFrames: async (frames) => {
      waitedFrames += Math.max(0, Math.round(frames));
    },
  });

  assert.equal(player.dir, 'down');
  assert.ok(waitedFrames >= 61);
});

test('reveals disguised trainer and persists final facing/position template', async () => {
  const npc = createTrainerNpc({
    tileX: 7,
    tileY: 9,
    direction: 'up',
    movementTypeRaw: 'MOVEMENT_TYPE_TREE_DISGUISE',
    spriteHidden: true,
  });
  const trigger = createTrigger({
    approachDistance: 1,
    movementTypeRaw: 'MOVEMENT_TYPE_TREE_DISGUISE',
  });
  const player = {
    tileX: 7,
    tileY: 11,
    dir: 'left',
  } as unknown as PlayerController;
  let templateUpdate:
    | { mapId: string; localId: string; tileX: number; tileY: number }
    | null = null;
  let movementTypeSet: string | null = null;
  let startRevealCalls = 0;
  let finishRevealCalls = 0;

  const objectEventManager = {
    getNPCByLocalId: () => npc,
    faceNpcTowardPlayer: () => {
      npc.direction = 'down';
    },
    startNPCDisguiseRevealByLocalId: () => {
      startRevealCalls++;
      return true;
    },
    completeNPCDisguiseRevealByLocalId: () => {
      finishRevealCalls++;
      npc.spriteHidden = false;
      return true;
    },
    setNPCMovementTypeByLocalId: (_mapId: string, _localId: string, movementTypeRaw: string) => {
      movementTypeSet = movementTypeRaw;
      return true;
    },
    setNPCTemplatePositionByLocalId: (mapId: string, localId: string, tileX: number, tileY: number) => {
      templateUpdate = { mapId, localId, tileX, tileY };
      return true;
    },
  } as unknown as ObjectEventManager;

  await playTrainerSightIntro({
    trigger,
    player,
    objectEventManager,
    scriptRuntimeServices: {},
    waitFrames: async () => {},
  });

  assert.equal(npc.spriteHidden, false);
  assert.equal(startRevealCalls, 1);
  assert.equal(finishRevealCalls, 1);
  assert.equal(movementTypeSet, 'MOVEMENT_TYPE_FACE_DOWN');
  assert.deepEqual(templateUpdate, {
    mapId: 'MAP_TEST',
    localId: '1',
    tileX: 7,
    tileY: 9,
  });
});
