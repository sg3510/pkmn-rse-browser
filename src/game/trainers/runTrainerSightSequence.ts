/**
 * Trainer sight encounter sequencing.
 *
 * C references:
 * - public/pokeemerald/data/scripts/trainer_battle.inc (EventScript_StartTrainerApproach flow)
 * - public/pokeemerald/src/event_object_lock.c (freeze waits for movement completion)
 */

import type { PlayerController } from '../PlayerController.ts';
import type { ObjectEventManager } from '../ObjectEventManager.ts';
import type { ScriptRuntimeServices } from '../../scripting/ScriptRunner.ts';
import type { TrainerSightEncounterTrigger } from './trainerSightEncounter.ts';
import { playTrainerSightIntro } from './playTrainerSightIntro.ts';

type FacingDirectionVar = 0 | 1 | 2 | 3 | 4;

const FACING_DIRECTION_TO_VAR: Record<PlayerController['dir'], FacingDirectionVar> = {
  down: 1,
  up: 2,
  left: 3,
  right: 4,
};

export interface RunTrainerSightSequenceParams {
  trigger: TrainerSightEncounterTrigger;
  player: PlayerController;
  npcMovement: { setEnabled: (enabled: boolean) => void };
  objectEventManager: ObjectEventManager;
  scriptRuntimeServices: ScriptRuntimeServices;
  waitFrames: (frames: number) => Promise<void>;
  runTrainerScript: (scriptName: string, mapId: string) => Promise<void> | Promise<boolean>;
  setVarFacing: (value: FacingDirectionVar) => void;
  setVarLastTalked: (localId: number) => void;
  isWarping: () => boolean;
  isStoryScriptRunning: () => boolean;
}

/**
 * Execute trainer "meet eyes" sequence:
 * 1) preserve in-flight player movement while locking input
 * 2) run ! + trainer approach + facing sync
 * 3) launch trainer script when safe
 * 4) restore movement/input guards
 */
export async function runTrainerSightSequence(params: RunTrainerSightSequenceParams): Promise<void> {
  const {
    trigger,
    player,
    npcMovement,
    objectEventManager,
    scriptRuntimeServices,
    waitFrames,
    runTrainerScript,
    setVarFacing,
    setVarLastTalked,
    isWarping,
    isStoryScriptRunning,
  } = params;

  // C parity: lock waits for current movement to settle instead of snapping.
  player.lockInputPreserveMovement();
  npcMovement.setEnabled(false);
  try {
    await playTrainerSightIntro({
      trigger,
      player,
      objectEventManager,
      scriptRuntimeServices,
      waitFrames,
    });

    setVarFacing(FACING_DIRECTION_TO_VAR[player.dir] ?? 0);
    setVarLastTalked(trigger.localIdNumber);

    if (!isWarping()) {
      await runTrainerScript(trigger.scriptName, trigger.mapId);
    }
  } finally {
    if (!isStoryScriptRunning()) {
      npcMovement.setEnabled(true);
      if (!isWarping()) {
        player.unlockInput();
      }
    }
  }
}
