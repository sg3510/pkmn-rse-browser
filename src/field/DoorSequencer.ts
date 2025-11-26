/**
 * DoorSequencer - Manages door entry/exit animation sequences
 *
 * This module handles the state machine for door animations, coordinating:
 * - Door open/close animations
 * - Player stepping into/out of doors
 * - Timing between animation phases
 * - Integration with fade controller for map transitions
 *
 * Based on pokeemerald's door system:
 * - src/field_door.c: Door animation timing and graphics
 * - sDoorAnimGraphicsTable: Door graphics mapping
 *
 * Door Entry Sequence (entering a building):
 * 1. 'opening' - Door opens (3 frames @ 90ms each)
 * 2. 'stepping' - Player walks into doorway
 * 3. 'closing' - Door closes behind player
 * 4. 'waitingBeforeFade' - Brief pause to show closed door
 * 5. 'fadingOut' - Screen fades to black
 * 6. 'warping' - Execute warp to destination
 *
 * Door Exit Sequence (exiting a building):
 * 1. 'opening' - Door opens from inside
 * 2. 'stepping' - Player walks out
 * 3. 'closing' - Door closes behind player
 * 4. 'done' - Sequence complete
 *
 * Usage:
 * ```typescript
 * const sequencer = new DoorSequencer();
 *
 * // Start entry sequence when player enters a door
 * sequencer.startEntry({
 *   targetX: doorTileX,
 *   targetY: doorTileY,
 *   metatileId: doorMetatileId,
 *   isAnimatedDoor: true,
 *   entryDirection: 'up',
 *   warpTrigger: warpTrigger,
 * }, performance.now());
 *
 * // In game loop, update and respond to results
 * const result = sequencer.updateEntry(now, playerIsMoving);
 * if (result.action === 'startPlayerStep') {
 *   player.forceMove(result.direction);
 * }
 * ```
 */

import {
  type DoorEntryStage,
  type DoorExitStage,
  type DoorAnimDrawable,
  type CardinalDirection,
  DOOR_TIMING,
} from './types';

/**
 * Configuration for starting a door entry sequence
 */
export interface DoorEntryConfig {
  /** Target tile X (the door tile) */
  targetX: number;
  /** Target tile Y (the door tile) */
  targetY: number;
  /** Metatile ID of the door for animation lookup */
  metatileId: number;
  /** Whether this door has animation (false for stairs, etc.) */
  isAnimatedDoor: boolean;
  /** Direction player is facing when entering */
  entryDirection: CardinalDirection;
  /** Warp trigger data for the transition */
  warpTrigger: unknown; // WarpTrigger from map/utils
  /** Optional: ID of the opening animation */
  openAnimId?: number;
}

/**
 * Configuration for starting a door exit sequence
 */
export interface DoorExitConfig {
  /** World X of the door in metatile coordinates */
  doorWorldX: number;
  /** World Y of the door in metatile coordinates */
  doorWorldY: number;
  /** Metatile ID of the door for animation lookup */
  metatileId: number;
  /** Whether this door has animation */
  isAnimatedDoor: boolean;
  /** Direction player should walk when exiting */
  exitDirection: CardinalDirection;
  /** Optional: ID of the opening animation */
  openAnimId?: number;
}

/**
 * Current state of door entry sequence
 */
export interface DoorEntryState {
  stage: DoorEntryStage;
  trigger: unknown | null; // WarpTrigger
  targetX: number;
  targetY: number;
  metatileId: number;
  isAnimatedDoor: boolean;
  entryDirection: CardinalDirection;
  openAnimId?: number;
  closeAnimId?: number;
  playerHidden: boolean;
  waitStartedAt: number;
}

/**
 * Current state of door exit sequence
 */
export interface DoorExitState {
  stage: DoorExitStage;
  doorWorldX: number;
  doorWorldY: number;
  metatileId: number;
  isAnimatedDoor: boolean;
  exitDirection: CardinalDirection;
  openAnimId?: number;
  closeAnimId?: number;
}

/**
 * Result from updating the entry sequence
 */
export interface DoorEntryUpdateResult {
  /** Whether the sequence is complete */
  done?: boolean;
  /** Action to take */
  action?:
    | 'spawnOpenAnimation'
    | 'startPlayerStep'
    | 'hidePlayer'
    | 'spawnCloseAnimation'
    | 'removeOpenAnimation'
    | 'removeCloseAnimation'
    | 'startFadeOut'
    | 'executeWarp';
  /** Direction for player movement */
  direction?: CardinalDirection;
  /** Duration for fade */
  duration?: number;
  /** Animation ID to remove */
  animId?: number;
  /** Warp trigger for executing warp */
  trigger?: unknown;
}

/**
 * Result from updating the exit sequence
 */
export interface DoorExitUpdateResult {
  /** Whether the sequence is complete */
  done?: boolean;
  /** Action to take */
  action?:
    | 'spawnOpenAnimation'
    | 'startPlayerStep'
    | 'spawnCloseAnimation'
    | 'removeOpenAnimation'
    | 'removeCloseAnimation';
  /** Direction for player movement */
  direction?: CardinalDirection;
  /** Animation ID to remove */
  animId?: number;
}

/**
 * DoorSequencer manages door animation state machines
 *
 * Provides separate entry and exit sequence handling with
 * clear action-based results for game loop integration.
 */
export class DoorSequencer {
  private entryState: DoorEntryState = this.createIdleEntryState();
  private exitState: DoorExitState = this.createIdleExitState();

  private createIdleEntryState(): DoorEntryState {
    return {
      stage: 'idle',
      trigger: null,
      targetX: 0,
      targetY: 0,
      metatileId: 0,
      isAnimatedDoor: true,
      entryDirection: 'up',
      playerHidden: false,
      waitStartedAt: 0,
    };
  }

  private createIdleExitState(): DoorExitState {
    return {
      stage: 'idle',
      doorWorldX: 0,
      doorWorldY: 0,
      metatileId: 0,
      isAnimatedDoor: true,
      exitDirection: 'down',
    };
  }

  /**
   * Start door entry sequence
   *
   * @param config - Entry configuration
   * @param currentTime - Current timestamp
   * @returns Initial action to take (usually 'spawnOpenAnimation')
   */
  startEntry(config: DoorEntryConfig, currentTime: number): DoorEntryUpdateResult {
    this.entryState = {
      stage: 'opening',
      trigger: config.warpTrigger,
      targetX: config.targetX,
      targetY: config.targetY,
      metatileId: config.metatileId,
      isAnimatedDoor: config.isAnimatedDoor,
      entryDirection: config.entryDirection,
      openAnimId: config.openAnimId,
      playerHidden: false,
      waitStartedAt: currentTime,
    };

    if (config.isAnimatedDoor && !config.openAnimId) {
      return { action: 'spawnOpenAnimation' };
    }

    return { done: false };
  }

  /**
   * Update door entry sequence
   *
   * Call this in the game loop to progress the entry sequence.
   * Respond to returned actions appropriately.
   *
   * @param currentTime - Current timestamp
   * @param playerIsMoving - Whether player is currently moving
   * @param isAnimationDone - Function to check if an animation is complete
   * @param isFadeDone - Whether the current fade is complete
   * @returns Action to take or done status
   */
  updateEntry(
    currentTime: number,
    playerIsMoving: boolean,
    isAnimationDone: (animId: number | undefined) => boolean,
    isFadeDone: boolean
  ): DoorEntryUpdateResult {
    const state = this.entryState;
    if (state.stage === 'idle') {
      return { done: true };
    }

    switch (state.stage) {
      case 'opening': {
        if (state.isAnimatedDoor) {
          const openDone = isAnimationDone(state.openAnimId);
          if (openDone) {
            state.stage = 'stepping';
            return { action: 'startPlayerStep', direction: state.entryDirection };
          }
        } else {
          // Non-animated door: immediately step
          state.stage = 'stepping';
          return { action: 'startPlayerStep', direction: state.entryDirection };
        }
        break;
      }

      case 'stepping': {
        if (!playerIsMoving) {
          if (state.isAnimatedDoor) {
            state.stage = 'closing';
            state.playerHidden = true;
            const result: DoorEntryUpdateResult = {
              action: 'spawnCloseAnimation',
            };
            if (state.openAnimId !== undefined) {
              result.animId = state.openAnimId;
            }
            return {
              action: 'hidePlayer',
            };
          } else {
            // Non-animated: skip closing, go to wait
            state.playerHidden = true;
            state.stage = 'waitingBeforeFade';
            state.waitStartedAt = currentTime;
            return { action: 'hidePlayer' };
          }
        }
        break;
      }

      case 'closing': {
        const closeDone = isAnimationDone(state.closeAnimId);
        if (closeDone) {
          state.stage = 'waitingBeforeFade';
          state.waitStartedAt = currentTime;
          if (state.closeAnimId !== undefined) {
            return { action: 'removeCloseAnimation', animId: state.closeAnimId };
          }
        }
        break;
      }

      case 'waitingBeforeFade': {
        const waitElapsed = currentTime - state.waitStartedAt;
        if (waitElapsed >= DOOR_TIMING.WAIT_BEFORE_FADE_MS) {
          state.stage = 'fadingOut';
          return {
            action: 'startFadeOut',
            duration: DOOR_TIMING.FADE_DURATION_MS,
          };
        }
        break;
      }

      case 'fadingOut': {
        if (isFadeDone) {
          state.stage = 'warping';
          return {
            action: 'executeWarp',
            trigger: state.trigger,
          };
        }
        break;
      }

      case 'warping': {
        // Sequence complete, reset state
        this.entryState = this.createIdleEntryState();
        return { done: true };
      }
    }

    return { done: false };
  }

  /**
   * Start door exit sequence
   *
   * @param config - Exit configuration
   * @param currentTime - Current timestamp
   * @returns Initial action to take
   */
  startExit(config: DoorExitConfig, _currentTime: number): DoorExitUpdateResult {
    this.exitState = {
      stage: 'opening',
      doorWorldX: config.doorWorldX,
      doorWorldY: config.doorWorldY,
      metatileId: config.metatileId,
      isAnimatedDoor: config.isAnimatedDoor,
      exitDirection: config.exitDirection,
      openAnimId: config.openAnimId,
    };

    if (config.isAnimatedDoor && !config.openAnimId) {
      return { action: 'spawnOpenAnimation' };
    }

    return { done: false };
  }

  /**
   * Update door exit sequence
   *
   * @param currentTime - Current timestamp
   * @param playerIsMoving - Whether player is currently moving
   * @param isAnimationDone - Function to check if an animation is complete
   * @returns Action to take or done status
   */
  updateExit(
    _currentTime: number,
    playerIsMoving: boolean,
    isAnimationDone: (animId: number | undefined) => boolean
  ): DoorExitUpdateResult {
    const state = this.exitState;
    if (state.stage === 'idle' || state.stage === 'done') {
      return { done: true };
    }

    switch (state.stage) {
      case 'opening': {
        if (state.isAnimatedDoor) {
          const openDone = isAnimationDone(state.openAnimId);
          if (openDone) {
            state.stage = 'stepping';
            return { action: 'startPlayerStep', direction: state.exitDirection };
          }
        } else {
          state.stage = 'stepping';
          return { action: 'startPlayerStep', direction: state.exitDirection };
        }
        break;
      }

      case 'stepping': {
        if (!playerIsMoving) {
          if (state.isAnimatedDoor) {
            state.stage = 'closing';
            const result: DoorExitUpdateResult = { action: 'spawnCloseAnimation' };
            if (state.openAnimId !== undefined) {
              result.animId = state.openAnimId;
            }
            return result;
          } else {
            state.stage = 'done';
            return { done: true };
          }
        }
        break;
      }

      case 'closing': {
        const closeDone = isAnimationDone(state.closeAnimId);
        if (closeDone) {
          state.stage = 'done';
          if (state.closeAnimId !== undefined) {
            return { action: 'removeCloseAnimation', animId: state.closeAnimId, done: true };
          }
          return { done: true };
        }
        break;
      }
    }

    return { done: false };
  }

  /**
   * Set the open animation ID after spawning
   */
  setEntryOpenAnimId(animId: number): void {
    this.entryState.openAnimId = animId;
  }

  /**
   * Set the close animation ID after spawning
   */
  setEntryCloseAnimId(animId: number): void {
    this.entryState.closeAnimId = animId;
  }

  /**
   * Set the exit open animation ID after spawning
   */
  setExitOpenAnimId(animId: number): void {
    this.exitState.openAnimId = animId;
  }

  /**
   * Set the exit close animation ID after spawning
   */
  setExitCloseAnimId(animId: number): void {
    this.exitState.closeAnimId = animId;
  }

  /**
   * Check if entry sequence is active
   */
  isEntryActive(): boolean {
    return this.entryState.stage !== 'idle';
  }

  /**
   * Check if exit sequence is active
   */
  isExitActive(): boolean {
    return this.exitState.stage !== 'idle' && this.exitState.stage !== 'done';
  }

  /**
   * Check if any sequence is active
   */
  isActive(): boolean {
    return this.isEntryActive() || this.isExitActive();
  }

  /**
   * Check if player should be hidden
   */
  isPlayerHidden(): boolean {
    return this.entryState.playerHidden;
  }

  /**
   * Get current entry stage
   */
  getEntryStage(): DoorEntryStage {
    return this.entryState.stage;
  }

  /**
   * Get current exit stage
   */
  getExitStage(): DoorExitStage {
    return this.exitState.stage;
  }

  /**
   * Get entry state (for debugging/serialization)
   */
  getEntryState(): Readonly<DoorEntryState> {
    return this.entryState;
  }

  /**
   * Get exit state (for debugging/serialization)
   */
  getExitState(): Readonly<DoorExitState> {
    return this.exitState;
  }

  /**
   * Reset entry sequence to idle
   */
  resetEntry(): void {
    this.entryState = this.createIdleEntryState();
  }

  /**
   * Reset exit sequence to idle
   */
  resetExit(): void {
    this.exitState = this.createIdleExitState();
  }

  /**
   * Reset all sequences
   */
  reset(): void {
    this.resetEntry();
    this.resetExit();
  }

  /**
   * Get door coordinates for entry sequence
   */
  getEntryDoorPosition(): { x: number; y: number } | null {
    if (this.entryState.stage === 'idle') return null;
    return { x: this.entryState.targetX, y: this.entryState.targetY };
  }

  /**
   * Get door coordinates for exit sequence
   */
  getExitDoorPosition(): { x: number; y: number } | null {
    if (this.exitState.stage === 'idle' || this.exitState.stage === 'done') return null;
    return { x: this.exitState.doorWorldX, y: this.exitState.doorWorldY };
  }
}

/**
 * Check if a door animation is complete
 *
 * Helper function to determine if a door animation has finished
 * based on the animation data and current time.
 *
 * @param anim - Door animation drawable
 * @param currentTime - Current timestamp
 * @returns true if animation is complete
 */
export function isDoorAnimationDone(anim: DoorAnimDrawable | undefined, currentTime: number): boolean {
  if (!anim) return true;

  const elapsed = currentTime - anim.startedAt;
  const totalDuration = anim.frameCount * anim.frameDuration;

  if (anim.holdOnComplete) {
    // Animation holds on last frame - considered "done" for sequencing purposes
    return elapsed >= totalDuration;
  }

  return elapsed >= totalDuration;
}

/**
 * Get current frame index for a door animation
 *
 * @param anim - Door animation drawable
 * @param currentTime - Current timestamp
 * @returns Frame index (0 to frameCount-1)
 */
export function getDoorAnimationFrame(anim: DoorAnimDrawable, currentTime: number): number {
  const elapsed = currentTime - anim.startedAt;
  const frameIndex = Math.floor(elapsed / anim.frameDuration);

  if (anim.direction === 'close') {
    // Closing animation plays in reverse
    const reversedIndex = anim.frameCount - 1 - frameIndex;
    return Math.max(0, Math.min(anim.frameCount - 1, reversedIndex));
  }

  return Math.min(frameIndex, anim.frameCount - 1);
}
