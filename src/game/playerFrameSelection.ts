/**
 * C parity references:
 * - public/pokeemerald/src/data/object_events/object_event_anims.h
 *   (sAnim_GetOnOffSurfBlobSouth/North/West/East)
 * - public/pokeemerald/src/data/object_events/object_event_pic_tables.h
 *   (sPicTable_BrendanSurfing)
 */

export type PlayerFacingDirection = 'up' | 'down' | 'left' | 'right';

export interface SurfingFrameSelection {
  logicalFrame: number;
  flip: boolean;
}

const SURFING_IDLE_LOGICAL_FRAME: Record<PlayerFacingDirection, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 2,
};

const SURFING_GET_ON_OFF_LOGICAL_FRAME: Record<PlayerFacingDirection, number> = {
  down: 9,
  up: 10,
  left: 11,
  right: 11,
};

/**
 * Select logical surfing frame before sprite-table remapping.
 *
 * Idle/normal surf uses logical 0/1/2.
 * Mount/dismount uses logical 9/10/11 (ANIM_GET_ON_OFF_POKEMON_*).
 */
export function getSurfingFrameSelection(
  direction: PlayerFacingDirection,
  isMountOrDismount: boolean
): SurfingFrameSelection {
  const logicalFrame = isMountOrDismount
    ? SURFING_GET_ON_OFF_LOGICAL_FRAME[direction]
    : SURFING_IDLE_LOGICAL_FRAME[direction];

  return {
    logicalFrame,
    flip: direction === 'right',
  };
}
