/**
 * Resolve the tile used for trainer sight checks.
 *
 * C references:
 * - public/pokeemerald/src/field_control_avatar.c (ProcessPlayerFieldInput uses PlayerGetDestCoords)
 * - public/pokeemerald/src/trainer_see.c (CheckForTrainersWantingBattle consumes those coords)
 */

import type { NPCDirection } from '../../types/objectEvents.ts';

type TrainerSightDirection = Extract<NPCDirection, 'up' | 'down' | 'left' | 'right'>;

export interface TrainerSightProbeTileParams {
  playerTileX: number;
  playerTileY: number;
  playerDirection: TrainerSightDirection;
  playerIsMoving: boolean;
}

export interface TrainerSightProbeTile {
  tileX: number;
  tileY: number;
}

const DIRECTION_DELTAS: Record<TrainerSightDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function getTrainerSightProbeTile(
  params: TrainerSightProbeTileParams
): TrainerSightProbeTile {
  if (!params.playerIsMoving) {
    return {
      tileX: params.playerTileX,
      tileY: params.playerTileY,
    };
  }

  const delta = DIRECTION_DELTAS[params.playerDirection];
  return {
    tileX: params.playerTileX + delta.dx,
    tileY: params.playerTileY + delta.dy,
  };
}
