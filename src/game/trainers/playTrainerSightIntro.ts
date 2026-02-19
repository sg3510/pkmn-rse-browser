/**
 * Trainer sight intro cutscene.
 *
 * C references:
 * - public/pokeemerald/src/trainer_see.c
 *   - TrainerExclamationMark
 *   - WaitTrainerExclamationMark
 *   - TrainerMoveToPlayer
 *   - PlayerFaceApproachingTrainer
 */

import type { PlayerController } from '../PlayerController.ts';
import type { ObjectEventManager } from '../ObjectEventManager.ts';
import type { ScriptRuntimeServices } from '../../scripting/ScriptRunner.ts';
import type { NPCDirection } from '../../types/objectEvents.ts';
import type { TrainerSightEncounterTrigger } from './trainerSightEncounter.ts';

const TILE_PIXELS = 16;
const TRAINER_WALK_FRAMES = 16;
const EXCLAMATION_FALLBACK_FRAMES = 60;

function getDirectionDelta(direction: NPCDirection): { dx: number; dy: number } {
  if (direction === 'up') return { dx: 0, dy: -1 };
  if (direction === 'down') return { dx: 0, dy: 1 };
  if (direction === 'left') return { dx: -1, dy: 0 };
  return { dx: 1, dy: 0 };
}

function getOppositeDirection(direction: NPCDirection): NPCDirection {
  if (direction === 'up') return 'down';
  if (direction === 'down') return 'up';
  if (direction === 'left') return 'right';
  return 'left';
}

async function moveTrainerOneTile(
  trigger: TrainerSightEncounterTrigger,
  direction: NPCDirection,
  objectEventManager: ObjectEventManager,
  waitFrames: (frames: number) => Promise<void>
): Promise<boolean> {
  const npc = objectEventManager.getNPCByLocalId(trigger.mapId, trigger.localId);
  if (!npc) return false;

  const { dx, dy } = getDirectionDelta(direction);
  npc.direction = direction;
  npc.isWalking = true;
  npc.tileX += dx;
  npc.tileY += dy;
  npc.subTileX = -dx * TILE_PIXELS;
  npc.subTileY = -dy * TILE_PIXELS;

  for (let frame = 1; frame <= TRAINER_WALK_FRAMES; frame++) {
    const progress = frame / TRAINER_WALK_FRAMES;
    const remainingPixels = Math.round(TILE_PIXELS * (1 - progress));
    npc.subTileX = -dx * remainingPixels;
    npc.subTileY = -dy * remainingPixels;
    await waitFrames(1);
  }

  npc.isWalking = false;
  npc.subTileX = 0;
  npc.subTileY = 0;
  return true;
}

export interface PlayTrainerSightIntroParams {
  trigger: TrainerSightEncounterTrigger;
  player: PlayerController;
  objectEventManager: ObjectEventManager;
  scriptRuntimeServices: ScriptRuntimeServices;
  waitFrames: (frames: number) => Promise<void>;
}

export async function playTrainerSightIntro(params: PlayTrainerSightIntroParams): Promise<void> {
  const {
    trigger,
    player,
    objectEventManager,
    scriptRuntimeServices,
    waitFrames,
  } = params;

  if (scriptRuntimeServices.fieldEffects?.run) {
    const effectArgs = new Map<number, string | number>([
      [0, trigger.localId],
      [1, trigger.mapId],
    ]);
    await scriptRuntimeServices.fieldEffects.run('FLDEFF_EXCLAMATION_MARK_ICON', effectArgs, {
      mapId: trigger.mapId,
    });
    if (scriptRuntimeServices.fieldEffects.wait) {
      await scriptRuntimeServices.fieldEffects.wait('FLDEFF_EXCLAMATION_MARK_ICON');
    } else {
      await waitFrames(EXCLAMATION_FALLBACK_FRAMES);
    }
  } else {
    await waitFrames(EXCLAMATION_FALLBACK_FRAMES);
  }

  const walkTiles = Math.max(0, trigger.approachDistance - 1);
  for (let i = 0; i < walkTiles; i++) {
    const moved = await moveTrainerOneTile(
      trigger,
      trigger.approachDirection,
      objectEventManager,
      waitFrames
    );
    if (!moved) break;
  }

  objectEventManager.faceNpcTowardPlayer(trigger.mapId, trigger.localId, player.tileX, player.tileY);
  const trainer = objectEventManager.getNPCByLocalId(trigger.mapId, trigger.localId);
  if (trainer) {
    player.dir = getOppositeDirection(trainer.direction);
  } else {
    player.dir = getOppositeDirection(trigger.approachDirection);
  }
  await waitFrames(1);
}
