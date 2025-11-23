/**
 * Type definitions for the surfing system
 */

export type SurfBlobDirection = 'down' | 'up' | 'left' | 'right';

export type SurfAnimationPhase =
  | 'IDLE'
  | 'INIT'
  | 'FIELD_MOVE_POSE'
  | 'SHOW_MON'
  | 'JUMP_ON_BLOB'
  | 'END'
  | 'SURFING'
  | 'DISMOUNTING';

export interface SurfingState {
  /** Whether the player is currently surfing */
  isSurfing: boolean;
  
  /** Current animation phase */
  animationPhase: SurfAnimationPhase;
  
  /** Frame counter for animations */
  frameCounter: number;
  
  /** Bob animation offset (for surf blob) */
  bobOffset: number;
  
  /** Direction of surf blob sprite */
  blobDirection: SurfBlobDirection;
  
  /** Target tile coordinates for mounting */
  targetX?: number;
  targetY?: number;
  
  /** Timestamp when surfing started */
  startTime?: number;
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

export interface MountAnimationConfig {
  /** Duration of field move pose in frames */
  fieldMoveDuration: number;
  
  /** Duration of show mon animation in frames */
  showMonDuration: number;
  
  /** Duration of jump on blob animation in frames */
  jumpDuration: number;
}

export interface DismountAnimationConfig {
  /** Duration of dismount sequence in frames */
  dismountDuration: number;
}

// Default animation configurations
export const DEFAULT_MOUNT_CONFIG: MountAnimationConfig = {
  fieldMoveDuration: 30,
  showMonDuration: 60,
  jumpDuration: 20,
};

export const DEFAULT_DISMOUNT_CONFIG: DismountAnimationConfig = {
  dismountDuration: 20,
};
