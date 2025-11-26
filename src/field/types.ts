/**
 * Field Effects Types - Shared types for field effect modules
 *
 * This module provides types used across field effect systems:
 * - DoorSequencer
 * - WarpHandler
 * - FadeController
 * - ArrowOverlay
 * - ReflectionRenderer
 *
 * Design: These types are React-free and can be used in any context.
 *
 * Reference: Based on pokeemerald's field effect system
 * - src/field_door.c: Door animations
 * - src/field_screen_effect.c: Screen transitions
 * - src/overworld.c: Warp handling
 */

import type { CardinalDirection } from '../utils/metatileBehaviors';

// Re-export for convenience
export type { CardinalDirection };

/**
 * Direction type for fade transitions
 */
export type FadeDirection = 'in' | 'out';

/**
 * Current state of a fade transition
 *
 * Used by FadeController to track ongoing fade animations.
 */
export interface FadeState {
  /** Direction of fade ('in' = from black, 'out' = to black) */
  mode: FadeDirection | null;
  /** Timestamp when fade started (ms) */
  startedAt: number;
  /** Duration of fade animation (ms) */
  duration: number;
}

/**
 * Size of a door in metatiles
 *
 * Most doors are 1x2 (1 metatile wide, 2 high).
 * Large doors like Battle Frontier corridors are 2x2.
 */
export type DoorSize = 1 | 2;

/**
 * Door animation drawable for rendering
 *
 * Contains all information needed to draw a door animation frame.
 */
export interface DoorAnimDrawable {
  /** Unique identifier for this animation instance */
  id: number;
  /** Door animation spritesheet image */
  image: HTMLImageElement;
  /** Animation direction ('open' or 'close') */
  direction: 'open' | 'close';
  /** Number of animation frames */
  frameCount: number;
  /** Height of each frame in pixels */
  frameHeight: number;
  /** Duration of each frame in milliseconds */
  frameDuration: number;
  /** World X position in metatile coordinates */
  worldX: number;
  /** World Y position in metatile coordinates */
  worldY: number;
  /** Door size (1 = normal, 2 = large) */
  size: DoorSize;
  /** Timestamp when animation started */
  startedAt: number;
  /** Whether to hold on the last frame when complete */
  holdOnComplete?: boolean;
  /** Metatile ID of the door for asset lookup */
  metatileId: number;
}

/**
 * Stage of door entry sequence
 *
 * Entry sequence: opening -> stepping -> closing -> waitingBeforeFade -> fadingOut -> warping
 */
export type DoorEntryStage =
  | 'idle'
  | 'opening'
  | 'stepping'
  | 'closing'
  | 'waitingBeforeFade'
  | 'fadingOut'
  | 'warping';

/**
 * Stage of door exit sequence
 *
 * Exit sequence: opening -> stepping -> closing -> done
 */
export type DoorExitStage = 'idle' | 'opening' | 'stepping' | 'closing' | 'done';

/**
 * Warp kind classification
 *
 * - door: Requires door animation sequence
 * - teleport: Instant transition (caves, teleport pads)
 * - arrow: Forced movement in direction (stairs, carpet tiles)
 */
export type WarpKind = 'door' | 'teleport' | 'arrow';

/**
 * State for arrow overlay indicator
 *
 * Arrow overlays appear when player faces arrow warp tiles
 * to indicate forced movement direction.
 */
export interface ArrowOverlayState {
  /** Whether the arrow is currently visible */
  visible: boolean;
  /** World X position in metatile coordinates */
  worldX: number;
  /** World Y position in metatile coordinates */
  worldY: number;
  /** Direction the arrow points */
  direction: CardinalDirection;
  /** Timestamp when arrow became visible (for animation) */
  startedAt: number;
}

/**
 * Direction vectors for cardinal directions
 *
 * Used for calculating adjacent tile positions.
 */
export const DIRECTION_VECTORS: Record<CardinalDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * Timing constants for door animations
 *
 * Based on pokeemerald's door timing in field_door.c
 */
export const DOOR_TIMING = {
  /** Duration of each door animation frame (ms) */
  FRAME_DURATION_MS: 90,
  /** Number of frames in door animation */
  FRAME_COUNT: 3,
  /** Height of each door frame in pixels */
  FRAME_HEIGHT: 32,
  /** Delay after door closes before fade starts (ms) */
  WAIT_BEFORE_FADE_MS: 200,
  /** Duration of fade transition (ms) */
  FADE_DURATION_MS: 500,
} as const;

/**
 * Timing constants for fade transitions
 */
export const FADE_TIMING = {
  /** Default fade duration (ms) */
  DEFAULT_DURATION_MS: 500,
  /** Quick fade for instant transitions (ms) */
  QUICK_DURATION_MS: 250,
} as const;
