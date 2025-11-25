/**
 * Type definitions for the surfing system
 * Based on pokeemerald field_effect.c and field_player_avatar.c
 */

export type SurfBlobDirection = 'down' | 'up' | 'left' | 'right';

export type SurfAnimationPhase =
  | 'IDLE'           // Not surfing
  | 'SURFING'        // Active surfing state
  | 'JUMPING_ON'     // Player jumping onto blob (mount)
  | 'JUMPING_OFF';   // Player jumping off blob (dismount)

/**
 * Blob bobbing state - matches pokeemerald BOB_* constants
 * Reference: field_effect_helpers.c:1113-1134
 */
export type BlobBobState =
  | 'BOB_NONE'           // No bobbing
  | 'BOB_PLAYER_AND_MON' // Both player and blob bob together (normal surfing)
  | 'BOB_JUST_MON';      // Only blob bobs, player doesn't (during dismount jump)

/**
 * Jump physics constants from pokeemerald
 * Reference: event_object_movement.c - sJumpY_High
 */
export const JUMP_Y_HIGH: readonly number[] = [
  -4,  -6,  -8, -10, -11, -12, -12, -12,
  -11, -10,  -9,  -8,  -6,  -4,   0,   0
];

/** Jump duration in frames (32 frames @ 60fps) */
export const JUMP_DURATION_FRAMES = 32;

/** Distance of normal jump in pixels (1 tile = 16 pixels) */
export const JUMP_DISTANCE_PIXELS = 16;

export interface SurfingState {
  /** Whether the player is currently surfing */
  isSurfing: boolean;

  /** Current animation phase */
  animationPhase: SurfAnimationPhase;

  /** Frame counter for animations */
  frameCounter: number;

  /** Direction of surf blob sprite */
  blobDirection: SurfBlobDirection;

  /** Target tile coordinates for mounting */
  targetX?: number;
  targetY?: number;

  /** Timestamp when surfing started */
  startTime?: number;

  // Jump animation state
  /** Current jump progress in frames (0-31) */
  jumpTimer?: number;

  /** Jump start position (pixels) */
  jumpStartX?: number;
  jumpStartY?: number;

  /** Jump direction */
  jumpDirection?: SurfBlobDirection;

  /** Blob bob state for mount/dismount */
  blobBobState: BlobBobState;

  /** Blob's fixed position during dismount (stays on water) */
  blobFixedTileX?: number;
  blobFixedTileY?: number;
}

export interface SurfableCheckResult {
  /** Can initiate surf at this location */
  canSurf: boolean;

  /** Reason why surfing cannot be initiated (if canSurf is false) */
  reason?: string;

  /** Target tile coordinates */
  targetX: number;
  targetY: number;

  /** Target tile behavior */
  targetBehavior: number;
}

/**
 * Create initial surfing state
 */
export function createInitialSurfingState(): SurfingState {
  return {
    isSurfing: false,
    animationPhase: 'IDLE',
    frameCounter: 0,
    blobDirection: 'down',
    blobBobState: 'BOB_NONE',
  };
}
