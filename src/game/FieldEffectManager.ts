/**
 * FieldEffectManager
 * 
 * Manages field effect sprites for tiles with MB_TALL_GRASS behavior and others.
 * Based on pokeemerald C code:
 * - src/field_effect_helpers.c: FldEff_TallGrass, UpdateTallGrassFieldEffect
 * - src/data/field_effects/field_effect_objects.h: Animation frames and timing
 * - src/event_object_movement.c: Ground effect triggers
 */

// Helper to check if debug mode is enabled
const DEBUG_MODE_FLAG = 'DEBUG_MODE';
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

// GBA frame timing - 1 tick = 1 frame at 60fps = ~16.67ms
const MS_PER_TICK = 1000 / 60;

export interface FieldEffect {
  id: string;
  tileX: number;
  tileY: number;
  animationFrame: number;  // Current frame index (0-4 for tall/ripple, 0-3 for long, 0-1 for sand/splash)
  sequenceIndex: number;   // Index in the animation sequence array
  animationTick: number;   // Tick counter within current frame (fractional for accurate timing)
  type: 'tall' | 'long' | 'sand' | 'deep_sand' | 'puddle_splash' | 'water_ripple';
  skipAnimation: boolean;  // If true, start at frame 0 (spawn case)
  ownerObjectId: string;   // Player/NPC ID that triggered this
  completed: boolean;      // Animation finished
  visible: boolean;        // For flickering effects
  direction?: 'up' | 'down' | 'left' | 'right';  // Direction for sand footprints
  renderBehindPlayer: boolean;  // When player moves DOWN from grass, render grass behind player
}

export interface FieldEffectForRendering {
  id: string;
  worldX: number;          // World pixel X (tileX * 16 + 8)
  worldY: number;          // World pixel Y (tileY * 16 + 8)
  frame: number;           // Current animation frame (0-4 for tall/ripple, 0-3 for long, 0-1 for sand/splash)
  type: 'tall' | 'long' | 'sand' | 'deep_sand' | 'puddle_splash' | 'water_ripple';
  subpriorityOffset: number; // 0 or 4 based on frame
  visible: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';  // Direction for sand footprints
  flipHorizontal?: boolean;  // For East-facing sand footprints
  renderBehindPlayer?: boolean;  // True when player is moving DOWN from this grass tile
  ownerObjectId: string;   // ID of the player/NPC that triggered this effect
}

/**
 * Tall grass animation sequence (from pokeemerald C code):
 * Frame 1: 10 ticks
 * Frame 2: 10 ticks
 * Frame 3: 10 ticks
 * Frame 4: 10 ticks
 * Frame 0: 10 ticks
 * END (50 total frames)
 */
const TALL_GRASS_ANIMATION_SEQUENCE = [1, 2, 3, 4, 0];
const TALL_GRASS_TICKS_PER_FRAME = 10;

/**
 * Long grass animation sequence (from pokeemerald C code):
 * Frame 1: 3 ticks
 * Frame 2: 3 ticks
 * Frame 0: 4 ticks
 * Frame 3: 4 ticks
 * Frame 0: 4 ticks
 * Frame 3: 4 ticks
 * Frame 0: 4 ticks
 * END (26 total frames)
 */
const LONG_GRASS_ANIMATION_SEQUENCE = [1, 2, 0, 3, 0, 3, 0];
const LONG_GRASS_FRAME_DURATIONS = [3, 3, 4, 4, 4, 4, 4];

/**
 * Puddle splash animation sequence (from pokeemerald C code):
 * sAnim_Splash_0 in field_effect_objects.h (lines 543-548)
 *
 * Frame 0: 4 ticks (66.67ms)
 * Frame 1: 4 ticks (66.67ms)
 * END (8 total ticks = ~133ms)
 *
 * The splash follows the player sprite (UpdateSplashFieldEffect) and
 * disappears when animation completes.
 */
const PUDDLE_SPLASH_ANIMATION_SEQUENCE = [0, 1];
const PUDDLE_SPLASH_TICKS_PER_FRAME = 4;

/**
 * Water ripple animation sequence (from pokeemerald C code):
 * sAnim_Ripple in field_effect_objects.h (lines 112-123)
 *
 * Triggered by MetatileBehavior_HasRipples which checks:
 * - MB_POND_WATER (16)
 * - MB_PUDDLE (22)
 * - MB_SOOTOPOLIS_DEEP_WATER (20)
 *
 * Animation:
 * Frame 0: 12 ticks
 * Frame 1: 9 ticks
 * Frame 2: 9 ticks
 * Frame 3: 9 ticks
 * Frame 0: 9 ticks
 * Frame 1: 9 ticks
 * Frame 2: 11 ticks
 * Frame 4: 11 ticks
 * END (79 total ticks = ~1.32 seconds)
 *
 * The ripple stays in place (WaitFieldEffectSpriteAnim callback).
 * Sprite is 16x16 pixels with 5 frames.
 */
const WATER_RIPPLE_ANIMATION_SEQUENCE = [0, 1, 2, 3, 0, 1, 2, 4];
const WATER_RIPPLE_FRAME_DURATIONS = [12, 9, 9, 9, 9, 9, 11, 11];

export class FieldEffectManager {
  private effects: Map<string, FieldEffect> = new Map();
  private nextId = 0;

  /**
   * Create a new grass/field effect at the specified tile position.
   * 
   * @param tileX - Map tile X coordinate
   * @param tileY - Map tile Y coordinate
   * @param type - Effect type
   * @param skipAnimation - If true, skip animation and show final frame (for spawn-on-tile)
   * @param ownerObjectId - ID of the player/NPC that triggered this
   * @param direction - Direction for sand footprints (unused for grass)
   * @returns The created effect ID
   */
  create(
    tileX: number,
    tileY: number,
    type: 'tall' | 'long' | 'sand' | 'deep_sand' | 'puddle_splash' | 'water_ripple',
    skipAnimation: boolean,
    ownerObjectId: string,
    direction?: 'up' | 'down' | 'left' | 'right'
  ): string {
    const id = `effect_${this.nextId++}`;

    // Select initial frame based on type and direction
    let initialFrame = 0;
    if (!skipAnimation) {
      if (type === 'tall' || type === 'long') {
        initialFrame = 1; // Grass starts at frame 1
      } else if (type === 'sand' || type === 'deep_sand') {
        // Sand: frame 0 for up/down, frame 1 for left/right
        initialFrame = (direction === 'left' || direction === 'right') ? 1 : 0;
      } else if (type === 'puddle_splash' || type === 'water_ripple') {
        // Water effects start at frame 0
        initialFrame = 0;
      }
    }

    const effect: FieldEffect = {
      id,
      tileX,
      tileY,
      type,
      animationFrame: initialFrame,
      sequenceIndex: 0,
      animationTick: 0,
      skipAnimation,
      ownerObjectId,
      completed: skipAnimation, // If skipping, mark as completed immediately
      visible: true,
      direction,
      renderBehindPlayer: false,
    };

    this.effects.set(id, effect);
    
    // Debug logging
    if (isDebugMode() && type === 'tall') {
      console.log(`[GRASS] Created tall grass effect ${id} at (${tileX}, ${tileY}), skipAnimation=${skipAnimation}, frame=${initialFrame}, completed=${effect.completed}`);
    }
    
    return id;
  }

  /**
   * Update all grass effects based on elapsed time.
   * Converts delta time (ms) to GBA ticks for accurate animation timing.
   *
   * @param deltaMs - Time elapsed since last update in milliseconds
   */
  update(deltaMs: number): void {
    // Convert milliseconds to GBA ticks (fractional)
    const ticksElapsed = deltaMs / MS_PER_TICK;

    for (const effect of this.effects.values()) {
      if (effect.completed || effect.skipAnimation) {
        continue;
      }

      // Accumulate fractional ticks
      effect.animationTick += ticksElapsed;

      if (effect.type === 'tall') {
        // Tall grass: uniform 10 ticks per frame
        while (effect.animationTick >= TALL_GRASS_TICKS_PER_FRAME && !effect.completed) {
          effect.animationTick -= TALL_GRASS_TICKS_PER_FRAME;

          if (effect.sequenceIndex < TALL_GRASS_ANIMATION_SEQUENCE.length - 1) {
            effect.sequenceIndex++;
            effect.animationFrame = TALL_GRASS_ANIMATION_SEQUENCE[effect.sequenceIndex];
          } else {
            effect.completed = true;
            if (isDebugMode()) {
              console.log(`[GRASS] Tall grass effect ${effect.id} animation completed at frame ${effect.animationFrame}`);
            }
          }
        }
      } else if (effect.type === 'long') {
        // Long grass: variable frame durations
        // Use sequenceIndex to determine duration, not frame
        while (!effect.completed) {
          const frameDuration = LONG_GRASS_FRAME_DURATIONS[effect.sequenceIndex] || 4;
          if (effect.animationTick < frameDuration) break;

          effect.animationTick -= frameDuration;

          if (effect.sequenceIndex < LONG_GRASS_ANIMATION_SEQUENCE.length - 1) {
            effect.sequenceIndex++;
            effect.animationFrame = LONG_GRASS_ANIMATION_SEQUENCE[effect.sequenceIndex];
          } else {
            effect.completed = true;
          }
        }
      } else if (effect.type === 'sand' || effect.type === 'deep_sand') {
        // Sand footprints:
        // 0-40 ticks: Static (Step 0)
        // 40-56 ticks: Flicker (Step 1)
        // 56+ ticks: End

        // animationTick is a cumulative timer for this effect
        if (effect.animationTick > 56) {
          effect.completed = true;
        } else if (effect.animationTick > 40) {
          // Flicker phase: toggle visibility based on tick count
          // In C code: sprite->invisible ^= 1 per frame
          // We toggle based on which "tick" we're on
          effect.visible = Math.floor(effect.animationTick) % 2 === 0;
        }
      } else if (effect.type === 'puddle_splash') {
        // Puddle splash: uniform 4 ticks per frame, 2 frames total
        // From sAnim_Splash_0 in field_effect_objects.h
        while (effect.animationTick >= PUDDLE_SPLASH_TICKS_PER_FRAME && !effect.completed) {
          effect.animationTick -= PUDDLE_SPLASH_TICKS_PER_FRAME;

          if (effect.sequenceIndex < PUDDLE_SPLASH_ANIMATION_SEQUENCE.length - 1) {
            effect.sequenceIndex++;
            effect.animationFrame = PUDDLE_SPLASH_ANIMATION_SEQUENCE[effect.sequenceIndex];
          } else {
            effect.completed = true;
          }
        }
      } else if (effect.type === 'water_ripple') {
        // Water ripple: variable frame durations, 8 steps total (79 ticks = ~1.32s)
        // From sAnim_Ripple in field_effect_objects.h
        while (!effect.completed) {
          const frameDuration = WATER_RIPPLE_FRAME_DURATIONS[effect.sequenceIndex] || 9;
          if (effect.animationTick < frameDuration) break;

          effect.animationTick -= frameDuration;

          if (effect.sequenceIndex < WATER_RIPPLE_ANIMATION_SEQUENCE.length - 1) {
            effect.sequenceIndex++;
            effect.animationFrame = WATER_RIPPLE_ANIMATION_SEQUENCE[effect.sequenceIndex];
          } else {
            effect.completed = true;
          }
        }
      }
    }
  }

  /**
   * Clean up completed grass effects and update render priority.
   *
   * Behavior per pokeemerald (UpdateTallGrassFieldEffect + UpdateGrassFieldEffectSubpriority):
   * - Effects that end at frame 0: Keep until player moves away from tile
   * - Other completed effects: Remove immediately
   * - When player moves DOWN from grass: DON'T remove! Instead, render grass BEHIND player
   *   (GBA does this via subpriority adjustment in UpdateGrassFieldEffectSubpriority)
   *
   * Frame 0 is the "resting" frame that shows grass covering player's feet.
   * It persists whether it got there via animation (1→2→3→4→0) or spawn (start at 0).
   *
   * Direction-aware behavior (per pokeemerald logic):
   * - When moving DOWN from grass: Set renderBehindPlayer=true (grass continues animating behind player)
   * - When moving UP/LEFT/RIGHT: Keep grass in front until player fully leaves
   * - When JUMPING (ledge): Remove immediately regardless of direction
   *
   * @param ownerPositions - Map of owner IDs to position info including destination and direction
   */
  cleanup(ownerPositions: Map<string, {
    tileX: number;
    tileY: number;
    destTileX: number;
    destTileY: number;
    prevTileX: number;
    prevTileY: number;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    isJumping: boolean;
  }>): void {
    for (const [id, effect] of this.effects.entries()) {
      const ownerPos = ownerPositions.get(effect.ownerObjectId);

      // Update renderBehindPlayer flag for grass effects based on player direction
      // This implements GBA's UpdateGrassFieldEffectSubpriority behavior
      if ((effect.type === 'tall' || effect.type === 'long') && ownerPos) {
        const currentOnGrass = ownerPos.tileX === effect.tileX && ownerPos.tileY === effect.tileY;
        const movingAwayDown = ownerPos.isMoving &&
          ownerPos.direction === 'down' &&
          (ownerPos.destTileX !== effect.tileX || ownerPos.destTileY !== effect.tileY);

        // When player is on grass and moving DOWN away, render grass behind player
        // This lets the animation complete naturally while staying visually correct
        if (currentOnGrass && movingAwayDown) {
          effect.renderBehindPlayer = true;
        } else if (!currentOnGrass && !ownerPos.isMoving) {
          // Reset when player has fully left and stopped moving
          effect.renderBehindPlayer = false;
        }
      }

      if (!effect.completed) {
        continue; // Don't clean up until animation finishes
      }

      // For effects at frame 0 (tall/long grass), keep until player moves away
      // Frame 0 is the final "resting" frame that covers the player's feet
      if ((effect.type === 'tall' || effect.type === 'long') && effect.animationFrame === 0) {
        if (!ownerPos) {
          // Owner doesn't exist anymore, remove effect
          if (isDebugMode()) {
            console.log(`[GRASS] Removing frame 0 effect ${id} - owner doesn't exist`);
          }
          this.effects.delete(id);
          continue;
        }

        // Check if owner's current logical tile matches grass tile
        const currentOnGrass = ownerPos.tileX === effect.tileX && ownerPos.tileY === effect.tileY;
        // Check if owner's previous position matches grass tile
        const previousOnGrass = ownerPos.prevTileX === effect.tileX && ownerPos.prevTileY === effect.tileY;

        // Special case: JUMPING over a ledge - remove grass immediately
        // When jumping, the player sprite quickly moves away and the grass should disappear
        if (ownerPos.isJumping && previousOnGrass && !currentOnGrass) {
          if (isDebugMode()) {
            console.log(`[GRASS] Removing frame 0 effect ${id} - owner JUMPING away from grass`);
          }
          this.effects.delete(id);
          continue;
        }

        if (currentOnGrass) {
          // Player still on this grass tile - keep effect
          // (renderBehindPlayer handles the visual priority when moving down)
          continue;
        }

        // Player has moved off the grass tile
        // Keep until both current AND previous positions are off grass
        // This matches pokeemerald: (currentCoords != sprite) AND (previousCoords != sprite)
        if (!currentOnGrass && !previousOnGrass) {
          // Both current and previous positions are off the grass - remove
          if (isDebugMode()) {
            console.log(`[GRASS] Removing frame 0 effect ${id} at (${effect.tileX}, ${effect.tileY}) - owner fully left`);
          }
          this.effects.delete(id);
        }
      } else {
        // For animated effects, remove immediately after completion
        // The static map tile (Layer 1) handles the covering after animation
        this.effects.delete(id);
      }
    }
  }

  /**
   * Get all grass effects formatted for rendering.
   * 
   * @returns Array of grass effects with world coordinates and render info
   */
  getEffectsForRendering(): FieldEffectForRendering[] {
    const results: FieldEffectForRendering[] = [];

    for (const effect of this.effects.values()) {
      // Convert tile coordinates to world pixel coordinates
      // Add 8 pixel offset to center sprite on tile (from C code: SetSpritePosToOffsetMapCoords(&x, &y, 8, 8))
      const worldX = effect.tileX * 16 + 8;
      const worldY = effect.tileY * 16 + 8;

      // Subpriority offset: +4 when at frame 1 (start of animation), otherwise 0
      // From C code (field_effect_helpers.c:351-352):
      // metatileBehavior = 0;
      // if (sprite->animCmdIndex == 0) metatileBehavior = 4;
      // In sAnim_TallGrass, index 0 is Frame 1.
      let subpriorityOffset = 0;
      if (effect.type === 'tall' && effect.animationFrame === 1) {
        subpriorityOffset = 4;
      }

      // For sand footprints, determine if horizontal flip is needed (East direction)
      const flipHorizontal = (effect.type === 'sand' || effect.type === 'deep_sand') &&
                            effect.direction === 'right';

      results.push({
        id: effect.id,
        worldX,
        worldY,
        frame: effect.animationFrame,
        type: effect.type,
        subpriorityOffset,
        visible: effect.visible,
        direction: effect.direction,
        flipHorizontal,
        renderBehindPlayer: effect.renderBehindPlayer,
        ownerObjectId: effect.ownerObjectId,
      });
    }

    return results;
  }

  /**
   * Get the number of active grass effects (for debugging).
   */
  getEffectCount(): number {
    return this.effects.size;
  }

  /**
   * Clear all grass effects (useful for map transitions).
   */
  clear(): void {
    this.effects.clear();
  }
}
