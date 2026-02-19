/**
 * Evolution scene and queue types.
 *
 * C refs:
 * - public/pokeemerald/src/evolution_scene.c
 * - public/pokeemerald/src/evolution_graphics.c
 */

import type { LocationState } from '../save/types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';

export interface EvolutionQueueEntry {
  partyIndex: number;
  targetSpecies: number;
  canStop?: boolean;
}

export interface EvolutionStateData {
  queue: EvolutionQueueEntry[];
  returnLocation?: LocationState;
  returnObjectEventRuntimeState?: ObjectEventRuntimeState;
}

export type EvolutionAnimationPhase =
  | 'idle'
  | 'spiral'
  | 'arc'
  | 'cycle'
  | 'circle'
  | 'spray'
  | 'reveal'
  | 'cancel'
  | 'done';

export interface EvolutionAnimationStatus {
  phase: EvolutionAnimationPhase;
  canCancel: boolean;
  canceled: boolean;
  complete: boolean;
}
