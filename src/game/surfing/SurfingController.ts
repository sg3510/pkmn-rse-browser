/**
 * SurfingController - Core controller for surfing state and animations
 * Manages mount/dismount sequences and surfing collision behavior
 */

import type {
  SurfingState,
  MountAnimationConfig,
  DismountAnimationConfig,
  SurfBlobDirection,
} from './types';
import { DEFAULT_MOUNT_CONFIG, DEFAULT_DISMOUNT_CONFIG } from './types';

// Animation phase constants
const Phase = {
  IDLE: 'IDLE' as const,
  INIT: 'INIT' as const,
  FIELD_MOVE_POSE: 'FIELD_MOVE_POSE' as const,
  SHOW_MON: 'SHOW_MON' as const,
  JUMP_ON_BLOB: 'JUMP_ON_BLOB' as const,
  END: 'END' as const,
  SURFING: 'SURFING' as const,
  DISMOUNTING: 'DISMOUNTING' as const,
};
import type { TileResolver } from '../PlayerController';
import { InteractionHandler } from './InteractionHandler';

export class SurfingController {
  private state: SurfingState;
  private interactionHandler: InteractionHandler;
  private mountConfig: MountAnimationConfig;
  private dismountConfig: DismountAnimationConfig;
  
  // Animation lock to prevent input during animations
  private isAnimating: boolean = false;
  
  constructor(
    mountConfig: MountAnimationConfig = DEFAULT_MOUNT_CONFIG,
    dismountConfig: DismountAnimationConfig = DEFAULT_DISMOUNT_CONFIG
  ) {
    this.state = this.createInitialState();
    this.interactionHandler = new InteractionHandler();
    this.mountConfig = mountConfig;
    this.dismountConfig = dismountConfig;
  }
  
  /**
   * Create initial surfing state
   */
  private createInitialState(): SurfingState {
    return {
      isSurfing: false,
      animationPhase: Phase.IDLE,
      frameCounter: 0,
      bobOffset: 0,
      blobDirection: 'down',
    };
  }
  
  /**
   * Get current surfing state
   */
  public getState(): Readonly<SurfingState> {
    return this.state;
  }
  
  /**
   * Check if currently surfing
   */
  public isSurfing(): boolean {
    return this.state.isSurfing;
  }
  
  /**
   * Check if animation is in progress (input should be locked)
   */
  public isLocked(): boolean {
    return this.isAnimating;
  }
  
  /**
   * Check if player can initiate surf
   */
  public canInitiateSurf(
    playerTileX: number,
    playerTileY: number,
    facingDirection: 'up' | 'down' | 'left' | 'right',
    tileResolver?: TileResolver
  ): { canSurf: boolean; reason?: string } {
    const result = this.interactionHandler.checkCanSurf(
      playerTileX,
      playerTileY,
      facingDirection,
      tileResolver
    );
    
    return {
      canSurf: result.canSurf,
      reason: result.reason,
    };
  }
  
  /**
   * Start the surf mount sequence
   */
  public startSurfSequence(targetX: number, targetY: number): void {
    this.isAnimating = true;
    this.state = {
      ...this.state,
      animationPhase: Phase.INIT,
      frameCounter: 0,
      targetX,
      targetY,
      startTime: Date.now(),
    };
  }
  
  /**
   * Start the surf dismount sequence
   */
  public startDismountSequence(): void {
    this.isAnimating = true;
    this.state = {
      ...this.state,
      animationPhase: Phase.DISMOUNTING,
      frameCounter: 0,
    };
  }
  
  /**
   * Update surfing animation state machine
   * Call this every frame
   * @returns True if state changed (sprite update needed)
   */
  public update(): boolean {
    let stateChanged = false;
    
    switch (this.state.animationPhase) {
      case Phase.IDLE:
        // Not surfing, nothing to update
        break;
        
      case Phase.INIT:
        // Immediate transition to field move pose
        this.state.animationPhase = Phase.FIELD_MOVE_POSE;
        this.state.frameCounter = 0;
        stateChanged = true;
        break;
        
      case Phase.FIELD_MOVE_POSE:
        this.state.frameCounter++;
        if (this.state.frameCounter >= this.mountConfig.fieldMoveDuration) {
          this.state.animationPhase = Phase.SHOW_MON;
          this.state.frameCounter = 0;
          stateChanged = true;
        }
        break;
        
      case Phase.SHOW_MON:
        this.state.frameCounter++;
        if (this.state.frameCounter >= this.mountConfig.showMonDuration) {
          this.state.animationPhase = Phase.JUMP_ON_BLOB;
          this.state.frameCounter = 0;
          stateChanged = true;
        }
        break;
        
      case Phase.JUMP_ON_BLOB:
        this.state.frameCounter++;
        if (this.state.frameCounter >= this.mountConfig.jumpDuration) {
          this.state.animationPhase = Phase.END;
          this.state.frameCounter = 0;
          stateChanged = true;
        }
        break;
        
      case Phase.END:
        // Transition to active surfing
        this.state.animationPhase = Phase.SURFING;
        this.state.isSurfing = true;
        this.isAnimating = false;
        stateChanged = true;
        break;
        
      case Phase.SURFING:
        // Active surfing (blob bobbing handled by SurfBlobRenderer)
        break;
        
      case Phase.DISMOUNTING:
        this.state.frameCounter++;
        if (this.state.frameCounter >= this.dismountConfig.dismountDuration) {
          // Return to idle state
          this.state = this.createInitialState();
          this.isAnimating = false;
          stateChanged = true;
        }
        break;
    }
    
    return stateChanged;
  }
  
  /**
   * Update surf blob direction based on player facing direction
   */
  public updateBlobDirection(direction: 'up' | 'down' | 'left' | 'right'): void {
    const newDirection: SurfBlobDirection = direction;
    if (this.state.blobDirection !== newDirection) {
      this.state = {
        ...this.state,
        blobDirection: newDirection,
      };
    }
  }
  
  /**
   * Check if player can dismount to target tile
   */
  public canDismount(
    targetX: number,
    targetY: number,
    tileResolver?: TileResolver
  ): boolean {
    if (!this.state.isSurfing) {
      return false;
    }
    
    return this.interactionHandler.checkCanDismount(targetX, targetY, tileResolver);
  }
  
  /**
   * Force stop surfing (emergency reset)
   */
  public reset(): void {
    this.state = this.createInitialState();
    this.isAnimating = false;
  }
}
