import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerController } from '../../PlayerController.ts';
import type { ObjectEventManager } from '../../ObjectEventManager.ts';
import type { ScriptRuntimeServices } from '../../../scripting/ScriptRunner.ts';
import type { NPCObject } from '../../../types/objectEvents.ts';
import type { TrainerSightEncounterTrigger } from '../trainerSightEncounter.ts';
import { runTrainerSightSequence } from '../runTrainerSightSequence.ts';

interface TestPlayer extends PlayerController {
  advanceFrames: (frames: number) => void;
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

function createMovingPlayer(log: string[]): TestPlayer {
  const player = {
    tileX: 10,
    tileY: 10,
    dir: 'right' as const,
    isMoving: true,
    inputLocked: false,
    lockInputPreserveMovement: () => {
      log.push('lock-preserve');
      player.inputLocked = true;
    },
    unlockInput: () => {
      log.push('unlock');
      player.inputLocked = false;
    },
    advanceFrames: (frames: number) => {
      if (frames <= 0) return;
      if (player.inputLocked && player.isMoving) {
        player.tileX = 11;
        player.tileY = 10;
        player.isMoving = false;
        log.push('player-step-complete');
      }
    },
  };

  return player as unknown as TestPlayer;
}

function createObjectEventManagerMock(
  npc: NPCObject,
  log: string[],
): ObjectEventManager {
  return {
    getNPCByLocalId: () => npc,
    faceNpcTowardPlayer: (_mapId: string, _localId: string, playerTileX: number, playerTileY: number) => {
      log.push('face-sync');
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

test('moving player keeps destination tile when trainer sight sequence starts mid-step', async () => {
  const log: string[] = [];
  const npc = createTrainerNpc();
  const trigger = createTrigger();
  const player = createMovingPlayer(log);
  const npcMovementEnabled: boolean[] = [];

  const scriptRuntimeServices: ScriptRuntimeServices = {
    fieldEffects: {
      run: async () => {
        log.push('exclamation-run');
      },
      wait: async () => {
        log.push('exclamation-wait');
      },
    },
  };

  await runTrainerSightSequence({
    trigger,
    player,
    npcMovement: {
      setEnabled: (enabled: boolean) => {
        npcMovementEnabled.push(enabled);
      },
    },
    objectEventManager: createObjectEventManagerMock(npc, log),
    scriptRuntimeServices,
    waitFrames: async (frames: number) => {
      player.advanceFrames(frames);
    },
    runTrainerScript: async () => {
      log.push('run-trainer-script');
    },
    setVarFacing: () => undefined,
    setVarLastTalked: () => undefined,
    isWarping: () => false,
    isStoryScriptRunning: () => false,
  });

  assert.equal(player.tileX, 11);
  assert.equal(player.tileY, 10);
  assert.equal(player.isMoving, false);
  assert.equal(player.inputLocked, false);
  assert.equal(npc.tileX, 4);
  assert.equal(npc.tileY, 5);
  assert.deepEqual(npcMovementEnabled, [false, true]);
  assert.ok(log.includes('lock-preserve'));
  assert.ok(log.includes('player-step-complete'));
});

test('trainer sight sequence ordering is ! then walk-up then face sync then intro text then battle transition', async () => {
  const log: string[] = [];
  const npc = createTrainerNpc();
  const trigger = createTrigger();
  const player = createMovingPlayer(log);
  let facingVar = 0;
  let lastTalkedVar = 0;
  let seenWalkUp = false;
  let previousNpcTileX = npc.tileX;
  let previousNpcTileY = npc.tileY;

  const scriptRuntimeServices: ScriptRuntimeServices = {
    fieldEffects: {
      run: async () => {
        log.push('exclamation-run');
      },
      wait: async () => {
        log.push('exclamation-wait');
      },
    },
  };

  await runTrainerSightSequence({
    trigger,
    player,
    npcMovement: {
      setEnabled: () => undefined,
    },
    objectEventManager: createObjectEventManagerMock(npc, log),
    scriptRuntimeServices,
    waitFrames: async (frames: number) => {
      if (
        !seenWalkUp
        && (npc.tileX !== previousNpcTileX || npc.tileY !== previousNpcTileY)
      ) {
        seenWalkUp = true;
        log.push('walk-up');
      }
      previousNpcTileX = npc.tileX;
      previousNpcTileY = npc.tileY;
      player.advanceFrames(frames);
    },
    runTrainerScript: async () => {
      log.push('intro-text');
      log.push('transition-battle');
    },
    setVarFacing: (value) => {
      facingVar = value;
      log.push(`set-facing:${value}`);
    },
    setVarLastTalked: (value) => {
      lastTalkedVar = value;
      log.push(`set-last-talked:${value}`);
    },
    isWarping: () => false,
    isStoryScriptRunning: () => false,
  });

  const exclamationIndex = log.indexOf('exclamation-run');
  const walkUpIndex = log.indexOf('walk-up');
  const faceSyncIndex = log.indexOf('face-sync');
  const introTextIndex = log.indexOf('intro-text');
  const transitionBattleIndex = log.indexOf('transition-battle');

  assert.ok(exclamationIndex >= 0);
  assert.ok(walkUpIndex >= 0);
  assert.ok(faceSyncIndex >= 0);
  assert.ok(introTextIndex >= 0);
  assert.ok(transitionBattleIndex >= 0);
  assert.ok(exclamationIndex < walkUpIndex);
  assert.ok(walkUpIndex < faceSyncIndex);
  assert.ok(faceSyncIndex < introTextIndex);
  assert.ok(introTextIndex < transitionBattleIndex);

  assert.equal(facingVar, 3);
  assert.equal(lastTalkedVar, 1);
});
