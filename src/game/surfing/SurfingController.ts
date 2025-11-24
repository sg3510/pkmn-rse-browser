/**
 * SurfingController - Core controller for surfing state and animations
 * Manages mount/dismount sequences and surfing collision behavior
 *
 * Jump animation reference: pokeemerald/src/field_effect.c (SurfFieldEffect_*)
 * and pokeemerald/src/field_player_avatar.c (Task_StopSurfing*)
 */

import type {
  SurfingState,
  MountAnimationConfig,
  DismountAnimationConfig,
  SurfBlobDirection,
  BlobBobState,
} from './types';
import {
  DEFAULT_MOUNT_CONFIG,
  DEFAULT_DISMOUNT_CONFIG,
  JUMP_Y_HIGH,
  JUMP_DURATION_FRAMES,
  JUMP_DISTANCE_PIXELS,
} from './types';

// Animation phase constants
const Phase = {
  IDLE: 'IDLE' as const,
  INIT: 'INIT' as const,
  FIELD_MOVE_POSE: 'FIELD_MOVE_POSE' as const,
  SHOW_MON: 'SHOW_MON' as const,
  JUMP_ON_BLOB: 'JUMP_ON_BLOB' as const,
  END: 'END' as const,
  SURFING: 'SURFING' as const,
  JUMPING_ON: 'JUMPING_ON' as const,     // Player jumping onto blob
  JUMPING_OFF: 'JUMPING_OFF' as const,   // Player jumping off blob
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
      jumpTimer: undefined,
      jumpStartX: undefined,
      jumpStartY: undefined,
      jumpDirection: undefined,
      blobBobState: 'BOB_NONE',
      blobFixedTileX: undefined,
      blobFixedTileY: undefined,
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
   * Start the surf mount sequence (jumping ON the blob)
   *
   * Reference: pokeemerald/src/field_effect.c - SurfFieldEffect_JumpOnSurfBlob
   * - Blob is created at destination water tile BEFORE player jumps
   * - Player jumps FROM land TO blob position
   *
   * @param targetTileX Destination tile X (water tile)
   * @param targetTileY Destination tile Y (water tile)
   * @param startPixelX Player's starting pixel X
   * @param startPixelY Player's starting pixel Y
   * @param direction Direction of jump
   */
  public startSurfSequence(
    targetTileX: number,
    targetTileY: number,
    startPixelX: number,
    startPixelY: number,
    direction: SurfBlobDirection
  ): void {
    this.isAnimating = true;
    this.state = {
      ...this.state,
      animationPhase: Phase.JUMPING_ON,
      frameCounter: 0,
      targetX: targetTileX,
      targetY: targetTileY,
      jumpTimer: 0,
      jumpStartX: startPixelX,
      jumpStartY: startPixelY,
      jumpDirection: direction,
      blobBobState: 'BOB_NONE', // Blob doesn't bob during mount
      blobDirection: direction,
      startTime: Date.now(),
    };
  }

  /**
   * Start the surf dismount sequence (jumping OFF the blob)
   *
   * Reference: pokeemerald/src/field_player_avatar.c - Task_StopSurfingInit
   * - SetSurfBlob_BobState(BOB_JUST_MON) - decouples player from blob
   * - Player jumps off, blob stays on water tile
   * - After landing, blob is destroyed
   *
   * @param currentTileX Player's current water tile X
   * @param currentTileY Player's current water tile Y
   * @param startPixelX Player's starting pixel X
   * @param startPixelY Player's starting pixel Y
   * @param direction Direction of jump (toward land)
   */
  public startDismountSequence(
    currentTileX: number,
    currentTileY: number,
    startPixelX: number,
    startPixelY: number,
    direction: SurfBlobDirection
  ): void {
    this.isAnimating = true;
    this.state = {
      ...this.state,
      animationPhase: Phase.JUMPING_OFF,
      frameCounter: 0,
      jumpTimer: 0,
      jumpStartX: startPixelX,
      jumpStartY: startPixelY,
      jumpDirection: direction,
      blobBobState: 'BOB_JUST_MON', // Blob continues to bob, player doesn't
      blobFixedTileX: currentTileX,  // Blob stays here (water tile)
      blobFixedTileY: currentTileY,
    };
  }
  
  /**
   * Update surfing animation state machine
   * Call this every frame
   * @returns Object with state change info and jump offsets
   */
  public update(): {
    stateChanged: boolean;
    jumpComplete: boolean;
    jumpYOffset: number;
    jumpXProgress: number;
  } {
    let stateChanged = false;
    let jumpComplete = false;
    let jumpYOffset = 0;
    let jumpXProgress = 0;

    switch (this.state.animationPhase) {
      case Phase.IDLE:
        // Not surfing, nothing to update
        break;

      case Phase.JUMPING_ON:
        // Player jumping onto blob (mount sequence)
        if (this.state.jumpTimer !== undefined) {
          // Calculate jump Y offset using GBA physics table
          // Index is timer >> 1 (every 2 frames use same Y offset)
          const yIndex = Math.min(15, this.state.jumpTimer >> 1);
          jumpYOffset = JUMP_Y_HIGH[yIndex];

          // Calculate horizontal progress (0 to 16 pixels over 32 frames)
          // Movement happens every other frame
          if (this.state.jumpTimer & 1) {
            jumpXProgress = Math.floor(this.state.jumpTimer / 2);
          } else {
            jumpXProgress = Math.floor(this.state.jumpTimer / 2);
          }
          jumpXProgress = Math.min(JUMP_DISTANCE_PIXELS, Math.floor((this.state.jumpTimer / JUMP_DURATION_FRAMES) * JUMP_DISTANCE_PIXELS));

          this.state.jumpTimer++;

          // Jump complete at frame 32
          if (this.state.jumpTimer >= JUMP_DURATION_FRAMES) {
            // Transition to active surfing
            this.state.animationPhase = Phase.SURFING;
            this.state.isSurfing = true;
            this.state.blobBobState = 'BOB_PLAYER_AND_MON'; // Start bobbing together
            this.state.jumpTimer = undefined;
            this.isAnimating = false;
            stateChanged = true;
            jumpComplete = true;
          }
        }
        break;

      case Phase.JUMPING_OFF:
        // Player jumping off blob (dismount sequence)
        if (this.state.jumpTimer !== undefined) {
          // Same jump physics as mount
          const yIndex = Math.min(15, this.state.jumpTimer >> 1);
          jumpYOffset = JUMP_Y_HIGH[yIndex];
          jumpXProgress = Math.min(JUMP_DISTANCE_PIXELS, Math.floor((this.state.jumpTimer / JUMP_DURATION_FRAMES) * JUMP_DISTANCE_PIXELS));

          this.state.jumpTimer++;

          // Jump complete at frame 32
          if (this.state.jumpTimer >= JUMP_DURATION_FRAMES) {
            // Return to idle state (not surfing anymore)
            this.state = this.createInitialState();
            this.isAnimating = false;
            stateChanged = true;
            jumpComplete = true;
          }
        }
        break;

      case Phase.SURFING:
        // Active surfing (blob bobbing handled by SurfBlobRenderer)
        break;

      // Legacy phases for backwards compatibility
      case Phase.INIT:
      case Phase.FIELD_MOVE_POSE:
      case Phase.SHOW_MON:
      case Phase.JUMP_ON_BLOB:
      case Phase.END:
        // Fallback - treat as idle
        break;
    }

    return { stateChanged, jumpComplete, jumpYOffset, jumpXProgress };
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

  /**
   * Get the current bob state for the blob
   */
  public getBlobBobState(): BlobBobState {
    return this.state.blobBobState ?? 'BOB_NONE';
  }

  /**
   * Check if currently in a jump animation (mount or dismount)
   */
  public isJumping(): boolean {
    return this.state.animationPhase === Phase.JUMPING_ON ||
           this.state.animationPhase === Phase.JUMPING_OFF;
  }

  /**
   * Check if currently jumping ON (mounting)
   */
  public isJumpingOn(): boolean {
    return this.state.animationPhase === Phase.JUMPING_ON;
  }

  /**
   * Check if currently jumping OFF (dismounting)
   */
  public isJumpingOff(): boolean {
    return this.state.animationPhase === Phase.JUMPING_OFF;
  }

  /**
   * Get the fixed blob tile position during dismount
   * (blob stays on water tile while player jumps off)
   */
  public getBlobFixedPosition(): { tileX: number; tileY: number } | null {
    if (this.state.blobFixedTileX !== undefined &&
        this.state.blobFixedTileY !== undefined) {
      return {
        tileX: this.state.blobFixedTileX,
        tileY: this.state.blobFixedTileY,
      };
    }
    return null;
  }

  /**
   * Get the target tile position for mounting (where blob is)
   */
  public getTargetPosition(): { tileX: number; tileY: number } | null {
    if (this.state.targetX !== undefined &&
        this.state.targetY !== undefined) {
      return {
        tileX: this.state.targetX,
        tileY: this.state.targetY,
      };
    }
    return null;
  }

  /**
   * Get jump direction
   */
  public getJumpDirection(): SurfBlobDirection | undefined {
    return this.state.jumpDirection;
  }

  /**
   * Get jump start position (in pixels)
   */
  public getJumpStartPosition(): { x: number; y: number } | null {
    if (this.state.jumpStartX !== undefined &&
        this.state.jumpStartY !== undefined) {
      return {
        x: this.state.jumpStartX,
        y: this.state.jumpStartY,
      };
    }
    return null;
  }
}
