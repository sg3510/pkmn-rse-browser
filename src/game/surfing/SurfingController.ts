/**
 * SurfingController - Core controller for surfing state and animations
 * Manages mount/dismount sequences and surfing collision behavior
 *
 * Jump animation reference: pokeemerald/src/field_effect.c (SurfFieldEffect_*)
 * and pokeemerald/src/field_player_avatar.c (Task_StopSurfing*)
 */

import type { TileResolver } from '../PlayerController';
import type {
  SurfingState,
  SurfBlobDirection,
  BlobBobState,
} from './types';
import {
  createInitialSurfingState,
  JUMP_Y_HIGH,
  JUMP_DURATION_FRAMES,
  JUMP_DISTANCE_PIXELS,
} from './types';
import { InteractionHandler } from './InteractionHandler';
import { SurfBlobRenderer } from './SurfBlobRenderer';

export class SurfingController {
  private state: SurfingState;
  private interactionHandler: InteractionHandler;
  private blobRenderer: SurfBlobRenderer;

  // Animation lock to prevent input during animations
  private isAnimating: boolean = false;

  constructor() {
    this.state = createInitialSurfingState();
    this.interactionHandler = new InteractionHandler();
    this.blobRenderer = new SurfBlobRenderer();
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
   * Get the blob renderer for rendering operations
   */
  public getBlobRenderer(): SurfBlobRenderer {
    return this.blobRenderer;
  }

  /**
   * Check if player can initiate surf
   */
  public canInitiateSurf(
    playerTileX: number,
    playerTileY: number,
    facingDirection: 'up' | 'down' | 'left' | 'right',
    playerElevation: number,
    tileResolver?: TileResolver
  ): { canSurf: boolean; reason?: string; targetX?: number; targetY?: number } {
    const result = this.interactionHandler.checkCanSurf(
      playerTileX,
      playerTileY,
      facingDirection,
      playerElevation,
      tileResolver
    );

    return {
      canSurf: result.canSurf,
      reason: result.reason,
      targetX: result.targetX,
      targetY: result.targetY,
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
    this.blobRenderer.resetBob();
    this.blobRenderer.setBobState('BOB_NONE');

    this.state = {
      ...this.state,
      animationPhase: 'JUMPING_ON',
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
    this.blobRenderer.setBobState('BOB_JUST_MON');

    this.state = {
      ...this.state,
      animationPhase: 'JUMPING_OFF',
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
    newTileX?: number;
    newTileY?: number;
  } {
    let stateChanged = false;
    let jumpComplete = false;
    let jumpYOffset = 0;
    let jumpXProgress = 0;
    let newTileX: number | undefined;
    let newTileY: number | undefined;

    // Always update blob bobbing during surfing or any jump animation
    if (this.state.isSurfing || this.state.animationPhase === 'JUMPING_ON' || this.state.animationPhase === 'JUMPING_OFF') {
      this.blobRenderer.update();
    }

    switch (this.state.animationPhase) {
      case 'IDLE':
        // Not surfing, nothing to update
        break;

      case 'JUMPING_ON':
        // Player jumping onto blob (mount sequence)
        if (this.state.jumpTimer !== undefined) {
          // Calculate jump Y offset using GBA physics table
          // Index is timer >> 1 (every 2 frames use same Y offset)
          const yIndex = Math.min(15, this.state.jumpTimer >> 1);
          jumpYOffset = JUMP_Y_HIGH[yIndex];

          // Calculate horizontal progress (0 to 16 pixels over 32 frames)
          jumpXProgress = Math.min(
            JUMP_DISTANCE_PIXELS,
            Math.floor((this.state.jumpTimer / JUMP_DURATION_FRAMES) * JUMP_DISTANCE_PIXELS)
          );

          this.state.jumpTimer++;

          // Jump complete at frame 32
          if (this.state.jumpTimer >= JUMP_DURATION_FRAMES) {
            // Transition to active surfing
            this.state = {
              ...this.state,
              animationPhase: 'SURFING',
              isSurfing: true,
              blobBobState: 'BOB_PLAYER_AND_MON',
              jumpTimer: undefined,
            };
            this.blobRenderer.setBobState('BOB_PLAYER_AND_MON');
            this.isAnimating = false;
            stateChanged = true;
            jumpComplete = true;
            newTileX = this.state.targetX;
            newTileY = this.state.targetY;
          }
        }
        break;

      case 'JUMPING_OFF':
        // Player jumping off blob (dismount sequence)
        if (this.state.jumpTimer !== undefined) {
          // Same jump physics as mount
          const yIndex = Math.min(15, this.state.jumpTimer >> 1);
          jumpYOffset = JUMP_Y_HIGH[yIndex];
          jumpXProgress = Math.min(
            JUMP_DISTANCE_PIXELS,
            Math.floor((this.state.jumpTimer / JUMP_DURATION_FRAMES) * JUMP_DISTANCE_PIXELS)
          );

          this.state.jumpTimer++;

          // Jump complete at frame 32
          if (this.state.jumpTimer >= JUMP_DURATION_FRAMES) {
            // Calculate landing tile
            const dir = this.state.jumpDirection;
            if (dir && this.state.blobFixedTileX !== undefined && this.state.blobFixedTileY !== undefined) {
              const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
              const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
              newTileX = this.state.blobFixedTileX + dx;
              newTileY = this.state.blobFixedTileY + dy;
            }

            // Return to idle state (not surfing anymore)
            this.state = createInitialSurfingState();
            this.blobRenderer.setBobState('BOB_NONE');
            this.isAnimating = false;
            stateChanged = true;
            jumpComplete = true;
          }
        }
        break;

      case 'SURFING':
        // Active surfing - blob bobbing is already updated above
        break;
    }

    return { stateChanged, jumpComplete, jumpYOffset, jumpXProgress, newTileX, newTileY };
  }

  /**
   * Update surf blob direction based on player facing direction
   */
  public updateBlobDirection(direction: 'up' | 'down' | 'left' | 'right'): void {
    if (this.state.blobDirection !== direction) {
      this.state = {
        ...this.state,
        blobDirection: direction,
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
   * Check if a tile is surfable water (for movement while surfing)
   */
  public isTileSurfable(
    tileX: number,
    tileY: number,
    tileResolver?: TileResolver
  ): boolean {
    return this.interactionHandler.isTileSurfable(tileX, tileY, tileResolver);
  }

  /**
   * Force stop surfing (emergency reset)
   */
  public reset(): void {
    this.state = createInitialSurfingState();
    this.blobRenderer.setBobState('BOB_NONE');
    this.isAnimating = false;
  }

  /**
   * Get the current bob state for the blob
   */
  public getBlobBobState(): BlobBobState {
    return this.state.blobBobState;
  }

  /**
   * Get player bob offset (for syncing player sprite with blob)
   */
  public getPlayerBobOffset(): number {
    return this.blobRenderer.getPlayerBobOffset();
  }

  /**
   * Get blob bob offset
   */
  public getBlobBobOffset(): number {
    return this.blobRenderer.getBobOffset();
  }

  /**
   * Check if currently in a jump animation (mount or dismount)
   */
  public isJumping(): boolean {
    return this.state.animationPhase === 'JUMPING_ON' ||
           this.state.animationPhase === 'JUMPING_OFF';
  }

  /**
   * Check if currently jumping ON (mounting)
   */
  public isJumpingOn(): boolean {
    return this.state.animationPhase === 'JUMPING_ON';
  }

  /**
   * Check if currently jumping OFF (dismounting)
   */
  public isJumpingOff(): boolean {
    return this.state.animationPhase === 'JUMPING_OFF';
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

  /**
   * Get blob direction for rendering
   */
  public getBlobDirection(): SurfBlobDirection {
    return this.state.blobDirection;
  }
}
