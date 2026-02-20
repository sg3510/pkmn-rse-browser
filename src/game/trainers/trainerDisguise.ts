/**
 * Trainer disguise helper utilities.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c (MovementType_TreeDisguise / MovementType_MountainDisguise)
 * - public/pokeemerald/src/field_effect_helpers.c (StartRevealDisguise / UpdateRevealDisguise)
 */

import { GBA_FRAME_MS } from '../../config/timing.ts';
import type { NPCDisguiseState, NPCDisguiseType } from '../../types/objectEvents.ts';

export const TRAINER_DISGUISE_REVEAL_FRAME_COUNT = 7;
export const TRAINER_DISGUISE_REVEAL_FRAME_TICKS = 4;
export const TRAINER_DISGUISE_REVEAL_TOTAL_FRAMES =
  TRAINER_DISGUISE_REVEAL_FRAME_COUNT * TRAINER_DISGUISE_REVEAL_FRAME_TICKS;

const TRAINER_DISGUISE_REVEAL_FRAME_DURATION_MS = GBA_FRAME_MS * TRAINER_DISGUISE_REVEAL_FRAME_TICKS;

export function resolveTrainerDisguiseType(
  movementTypeRaw: string | undefined | null
): NPCDisguiseType | null {
  if (!movementTypeRaw) return null;
  if (movementTypeRaw.includes('TREE_DISGUISE')) return 'tree';
  if (movementTypeRaw.includes('MOUNTAIN_DISGUISE')) return 'mountain';
  return null;
}

export function isTrainerDisguiseMovementType(movementTypeRaw: string | undefined | null): boolean {
  return resolveTrainerDisguiseType(movementTypeRaw) !== null;
}

export function getTrainerDisguiseRegistryKey(type: NPCDisguiseType): 'TREE_DISGUISE' | 'MOUNTAIN_DISGUISE' {
  return type === 'tree' ? 'TREE_DISGUISE' : 'MOUNTAIN_DISGUISE';
}

export function getTrainerDisguiseAnimationFrame(
  disguiseState: NPCDisguiseState,
  nowMs: number
): number {
  if (!disguiseState.revealing || disguiseState.revealStartedAtMs == null) {
    return 0;
  }
  const elapsed = Math.max(0, nowMs - disguiseState.revealStartedAtMs);
  const frame = Math.floor(elapsed / TRAINER_DISGUISE_REVEAL_FRAME_DURATION_MS);
  return Math.max(0, Math.min(TRAINER_DISGUISE_REVEAL_FRAME_COUNT - 1, frame));
}
