/**
 * ArrowAnimationConstants
 *
 * Shared constants and utilities for arrow warp indicator animations.
 * Used by both WebGLMapPage and ObjectRenderer to ensure consistent timing.
 *
 * The arrow overlay appears on tiles with arrow warp behaviors, indicating
 * the player can walk in that direction to trigger a warp.
 */

import type { CardinalDirection } from './types';

/**
 * Duration of each animation frame in milliseconds.
 * The arrow alternates between two frames at this interval.
 */
export const ARROW_FRAME_DURATION_MS = 533;

/**
 * Size of each arrow frame in pixels (16x16).
 */
export const ARROW_FRAME_SIZE = 16;

/**
 * Frame sequences for each direction.
 * Each direction has a 2-frame animation that alternates.
 * Frame indices correspond to positions in the arrow sprite sheet.
 */
export const ARROW_FRAME_SEQUENCES: Record<CardinalDirection, number[]> = {
  down: [3, 7],
  up: [0, 4],
  left: [1, 5],
  right: [2, 6],
};

/**
 * Calculate the current animation frame index for an arrow overlay.
 *
 * @param direction - The arrow direction (up, down, left, right)
 * @param elapsedMs - Time elapsed since animation started (in milliseconds)
 * @returns The frame index to render from the sprite sheet
 */
export function getArrowAnimationFrame(
  direction: CardinalDirection,
  elapsedMs: number
): number {
  const frameSequence = ARROW_FRAME_SEQUENCES[direction];
  const seqIndex = Math.floor(elapsedMs / ARROW_FRAME_DURATION_MS) % frameSequence.length;
  return frameSequence[seqIndex];
}

/**
 * Calculate atlas coordinates for an arrow frame.
 *
 * @param frameIndex - The frame index from getArrowAnimationFrame()
 * @param framesPerRow - Number of frames per row in the sprite sheet
 * @returns Object with atlasX and atlasY pixel coordinates
 */
export function getArrowAtlasCoords(
  frameIndex: number,
  framesPerRow: number
): { atlasX: number; atlasY: number } {
  return {
    atlasX: (frameIndex % framesPerRow) * ARROW_FRAME_SIZE,
    atlasY: Math.floor(frameIndex / framesPerRow) * ARROW_FRAME_SIZE,
  };
}
