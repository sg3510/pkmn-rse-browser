/**
 * Shared jump arc tables and utilities for player + NPC jumps.
 *
 * C references:
 * - public/pokeemerald/src/event_object_movement.c
 *   sJumpY_High, sJumpY_Normal, sJumpY_Low (16-entry tables, negative = up)
 *
 * Three arc tables, three distances:
 *   IN_PLACE: 0 tiles, 16 frames, HIGH arc
 *   NORMAL:   1 tile,  16 frames, NORMAL arc
 *   FAR:      2 tiles, 32 frames, HIGH arc (sampled every 2nd frame)
 */

/** GBA sJumpY_High — used for in_place and far jumps */
export const JUMP_ARC_HIGH: readonly number[] = [
  -4, -6, -8, -10, -11, -12, -12, -12,
  -11, -10, -9, -8, -6, -4, 0, 0,
];

/** GBA sJumpY_Normal — used for 1-tile script jumps */
export const JUMP_ARC_NORMAL: readonly number[] = [
  -2, -4, -6, -8, -9, -10, -10, -10,
  -9, -8, -6, -5, -3, -2, 0, 0,
];

/** GBA sJumpY_Low — used for low-arc jumps (not yet needed) */
export const JUMP_ARC_LOW: readonly number[] = [
  0, -2, -3, -4, -5, -6, -6, -6,
  -5, -5, -4, -3, -2, 0, 0, 0,
];

export type JumpDistance = 'in_place' | 'normal' | 'far';

export interface JumpConfig {
  arc: readonly number[];
  totalFrames: number;   // 16 or 32
  tileDistance: number;   // 0, 1, or 2
  arcShift: number;       // bit-shift for arc index (0 for 16-frame, 1 for 32-frame)
}

export function getJumpConfig(distance: JumpDistance): JumpConfig {
  switch (distance) {
    case 'in_place':
      return { arc: JUMP_ARC_HIGH, totalFrames: 16, tileDistance: 0, arcShift: 0 };
    case 'normal':
      return { arc: JUMP_ARC_NORMAL, totalFrames: 16, tileDistance: 1, arcShift: 0 };
    case 'far':
      return { arc: JUMP_ARC_HIGH, totalFrames: 32, tileDistance: 2, arcShift: 1 };
  }
}

/** Get Y pixel offset for a given frame in a jump animation */
export function getJumpYOffset(config: JumpConfig, frame: number): number {
  const index = Math.min(15, frame >> config.arcShift);
  return config.arc[index];
}
