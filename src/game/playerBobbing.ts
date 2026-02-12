/**
 * C parity references:
 * - public/pokeemerald/src/field_effect_helpers.c
 *   (StartUnderwaterSurfBlobBobbing, SpriteCB_UnderwaterSurfBlob)
 */

import { TICK_60FPS_MS } from '../config/timing';

const UNDERWATER_BOB_CYCLE_FRAMES = 32;

/**
 * Underwater bob offset for a given frame count.
 *
 * C behavior:
 * - y2 updates every 4 frames
 * - bob direction reverses every 16 frames
 * - full cycle is 32 frames
 */
export function getUnderwaterBobOffsetForFrame(frame: number): number {
  const normalizedFrame = Math.max(0, Math.floor(frame));
  const phase = normalizedFrame % UNDERWATER_BOB_CYCLE_FRAMES;

  if (phase < 16) {
    return Math.floor(phase / 4) + 1;
  }

  return 3 - Math.floor((phase - 16) / 4);
}

export function getUnderwaterBobOffset(elapsedMs: number): number {
  const frame = Math.floor(Math.max(0, elapsedMs) / TICK_60FPS_MS);
  return getUnderwaterBobOffsetForFrame(frame);
}
