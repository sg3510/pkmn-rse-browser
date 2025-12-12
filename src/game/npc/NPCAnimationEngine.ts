/**
 * NPC Animation Engine
 *
 * Replicates the Pokemon Emerald sprite animation system from:
 * - sprite.c: AnimateSprite(), ContinueAnim(), AnimCmd_frame()
 * - event_object_movement.c: animation state management
 *
 * Key concepts from the C code:
 * - animNum: which animation sequence to play (0-19 for standard)
 * - animCmdIndex: current position in the animation command array
 * - animDelayCounter: frames remaining before advancing to next command
 * - animPaused: whether animation is frozen on current frame
 */

import {
  getSpriteAnimationFrames,
  getAnimIndexForDirection,
  isInanimate,
  type AnimFrame,
} from '../../data/spriteMetadata';

/**
 * Animation state for a single NPC sprite
 * Mirrors the relevant fields from C's struct Sprite
 */
export interface NPCAnimationState {
  // Animation sequence state
  animNum: number;           // Current animation number (ANIM_STD_*)
  animCmdIndex: number;      // Current frame index in animation
  animDelayCounter: number;  // Ticks remaining on current frame
  animPaused: boolean;       // Whether animation is paused
  animBeginning: boolean;    // Is this the first frame?

  // Cached animation data
  currentFrames: AnimFrame[];  // Current animation's frame data

  // Timing
  lastUpdateTime: number;    // Last update timestamp (ms)

  // Current state tracking (for detecting changes)
  currentDirection: 'up' | 'down' | 'left' | 'right';
  currentIsMoving: boolean;
  graphicsId: string;
}

/**
 * Create initial animation state for an NPC
 */
export function createAnimationState(
  graphicsId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  isMoving: boolean = false
): NPCAnimationState {
  const animNum = getAnimIndexForDirection(direction, isMoving);
  const frames = getSpriteAnimationFrames(graphicsId, animNum);

  return {
    animNum,
    animCmdIndex: 0,
    animDelayCounter: frames.length > 0 ? frames[0].duration : 16,
    animPaused: !isMoving, // Idle NPCs are paused on first frame
    animBeginning: true,
    currentFrames: frames,
    lastUpdateTime: performance.now(),
    currentDirection: direction,
    currentIsMoving: isMoving,
    graphicsId,
  };
}

/**
 * Set a new animation for the NPC
 * Called when direction changes or movement starts/stops
 */
export function setAnimation(
  state: NPCAnimationState,
  graphicsId: string,
  animNum: number,
  paused: boolean = false,
  direction?: 'up' | 'down' | 'left' | 'right',
  isMoving?: boolean
): void {
  const frames = getSpriteAnimationFrames(graphicsId, animNum);

  state.animNum = animNum;
  state.animCmdIndex = 0;
  state.animDelayCounter = frames.length > 0 ? frames[0].duration : 16;
  state.animPaused = paused;
  state.animBeginning = true;
  state.currentFrames = frames;
  state.graphicsId = graphicsId;
  if (direction !== undefined) state.currentDirection = direction;
  if (isMoving !== undefined) state.currentIsMoving = isMoving;
}

/**
 * Set animation based on direction and movement state
 */
export function setAnimationForMovement(
  state: NPCAnimationState,
  graphicsId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  isMoving: boolean,
  speed: 'normal' | 'fast' | 'faster' | 'fastest' = 'normal'
): void {
  const animNum = getAnimIndexForDirection(direction, isMoving, speed);
  // When standing still, pause on the idle frame
  // When moving, let the animation play
  setAnimation(state, graphicsId, animNum, !isMoving, direction, isMoving);
}

/**
 * Update animation state - call this every frame
 * Replicates AnimateSprite() and ContinueAnim() from sprite.c
 *
 * @param state The animation state to update
 * @param deltaTime Time since last update in milliseconds
 * @returns true if the frame changed
 */
export function updateAnimation(
  state: NPCAnimationState,
  deltaTime: number
): boolean {
  // Don't update if paused or no frames
  if (state.animPaused || state.currentFrames.length === 0) {
    return false;
  }

  // Convert deltaTime to game ticks (60fps = 16.67ms per tick)
  const deltaTicks = deltaTime / (1000 / 60);

  // Decrement delay counter
  state.animDelayCounter -= deltaTicks;

  // Check if we need to advance to next frame
  if (state.animDelayCounter <= 0) {
    // Advance to next frame (with looping)
    state.animCmdIndex = (state.animCmdIndex + 1) % state.currentFrames.length;
    state.animBeginning = false;

    // Set delay for new frame
    const newFrame = state.currentFrames[state.animCmdIndex];
    state.animDelayCounter = newFrame.duration;

    return true; // Frame changed
  }

  return false;
}

/**
 * Get the current frame to display
 */
export function getCurrentFrame(state: NPCAnimationState): AnimFrame | null {
  if (state.currentFrames.length === 0) {
    return null;
  }
  return state.currentFrames[state.animCmdIndex];
}

/**
 * Get the frame index and flip state for rendering
 */
export function getCurrentFrameInfo(state: NPCAnimationState): {
  frameIndex: number;
  hFlip: boolean;
} {
  const frame = getCurrentFrame(state);
  if (!frame) {
    return { frameIndex: 0, hFlip: false };
  }
  return {
    frameIndex: frame.frameIndex,
    hFlip: frame.hFlip ?? false,
  };
}

/**
 * Pause/unpause animation
 */
export function setAnimationPaused(state: NPCAnimationState, paused: boolean): void {
  state.animPaused = paused;
}

/**
 * Check if a graphics ID should animate
 */
export function shouldAnimate(graphicsId: string): boolean {
  return !isInanimate(graphicsId);
}

/**
 * Animation manager for multiple NPCs
 * Handles batch updates and state management
 */
export class NPCAnimationManager {
  private states: Map<string, NPCAnimationState> = new Map();
  private lastUpdateTime: number = performance.now();

  /**
   * Get or create animation state for an NPC
   * Also updates the animation if direction or movement state has changed
   */
  getState(
    npcId: string,
    graphicsId: string,
    direction: 'up' | 'down' | 'left' | 'right',
    isMoving: boolean = false
  ): NPCAnimationState {
    let state = this.states.get(npcId);

    if (!state) {
      state = createAnimationState(graphicsId, direction, isMoving);
      this.states.set(npcId, state);
    } else {
      // Check if direction or movement state changed - update animation if so
      const directionChanged = state.currentDirection !== direction;
      const movementChanged = state.currentIsMoving !== isMoving;

      if (directionChanged || movementChanged) {
        setAnimationForMovement(state, graphicsId, direction, isMoving);
      }
    }

    return state;
  }

  /**
   * Update an NPC's animation when their movement state changes
   */
  updateNPCMovement(
    npcId: string,
    graphicsId: string,
    direction: 'up' | 'down' | 'left' | 'right',
    isMoving: boolean,
    speed: 'normal' | 'fast' | 'faster' | 'fastest' = 'normal'
  ): void {
    const state = this.getState(npcId, graphicsId, direction, isMoving);
    setAnimationForMovement(state, graphicsId, direction, isMoving, speed);
  }

  /**
   * Update all animations - call this every frame
   */
  update(): void {
    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    for (const state of this.states.values()) {
      updateAnimation(state, deltaTime);
    }
  }

  /**
   * Get current frame info for an NPC
   */
  getFrameInfo(npcId: string): { frameIndex: number; hFlip: boolean } | null {
    const state = this.states.get(npcId);
    if (!state) return null;
    return getCurrentFrameInfo(state);
  }

  /**
   * Remove an NPC's animation state (when NPC despawns)
   */
  removeNPC(npcId: string): void {
    this.states.delete(npcId);
  }

  /**
   * Clear all animation states
   */
  clear(): void {
    this.states.clear();
  }
}

// Global animation manager instance
export const npcAnimationManager = new NPCAnimationManager();
