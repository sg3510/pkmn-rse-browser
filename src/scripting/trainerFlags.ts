/**
 * Trainer defeat flag helpers.
 *
 * In the C source, trainer defeat state is stored as raw flags at
 * TRAINER_FLAGS_START + trainerId (see include/constants/flags.h:1343).
 * This module provides the same check/set interface against SaveStateStore's
 * raw flag byte array, which is populated from save data.
 */

import { TRAINER_IDS } from '../data/trainerIds.gen';
import { saveStateStore } from '../save/SaveStateStore';

const TRAINER_FLAGS_START = 0x500;

export function getTrainerFlagId(trainerName: string): number | null {
  const id = TRAINER_IDS[trainerName];
  if (id === undefined) return null;
  return TRAINER_FLAGS_START + id;
}

export function isTrainerDefeated(trainerName: string): boolean {
  const flagId = getTrainerFlagId(trainerName);
  if (flagId === null) return false;
  return saveStateStore.isRawFlagSet(flagId);
}

export function setTrainerDefeated(trainerName: string): void {
  const flagId = getTrainerFlagId(trainerName);
  if (flagId === null) return;
  saveStateStore.setRawFlagById(flagId, true);
}

export function clearTrainerDefeated(trainerName: string): void {
  const flagId = getTrainerFlagId(trainerName);
  if (flagId === null) return;
  saveStateStore.setRawFlagById(flagId, false);
}
