/**
 * GrassEffectManager
 * 
 * Manages grass field effect sprites for tiles with MB_TALL_GRASS behavior.
 * Based on pokeemerald C code:
 * - src/field_effect_helpers.c: FldEff_TallGrass, UpdateTallGrassFieldEffect
 * - src/data/field_effects/field_effect_objects.h: Animation frames and timing
 * - src/event_object_movement.c: Ground effect triggers
 */

export interface GrassEffect {
  id: string;
  tileX: number;
  tileY: number;
  animationFrame: number;  // Current frame index (0-4 for tall, 0-3 for long, 0-1 for sand)
  sequenceIndex: number;   // Index in the animation sequence array
  animationTick: number;   // Tick counter within current frame
  type: 'tall' | 'long' | 'sand' | 'deep_sand';   // Grass/Field type
  skipAnimation: boolean;  // If true, start at frame 0 (spawn case)
  ownerObjectId: string;   // Player/NPC ID that triggered this
  completed: boolean;      // Animation finished
  visible: boolean;        // For flickering effects
  direction?: 'up' | 'down' | 'left' | 'right';  // Direction for sand footprints
}

export interface GrassEffectForRendering {
  id: string;
  worldX: number;          // World pixel X (tileX * 16 + 8)
  worldY: number;          // World pixel Y (tileY * 16 + 8)
  frame: number;           // Current animation frame (0-4 for tall, 0-3 for long, 0-1 for sand)
  type: 'tall' | 'long' | 'sand' | 'deep_sand';   // Grass/Field type
  subpriorityOffset: number; // 0 or 4 based on frame
  visible: boolean;
  direction?: 'up' | 'down' | 'left' | 'right';  // Direction for sand footprints
  flipHorizontal?: boolean;  // For East-facing sand footprints
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

export class GrassEffectManager {
  private effects: Map<string, GrassEffect> = new Map();
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
    type: 'tall' | 'long' | 'sand' | 'deep_sand',
    skipAnimation: boolean,
    ownerObjectId: string,
    direction?: 'up' | 'down' | 'left' | 'right'
  ): string {
    const id = `grass_${this.nextId++}`;
    
    // Select initial frame based on type and direction
    let initialFrame = 0;
    if (!skipAnimation) {
      if (type === 'tall' || type === 'long') {
        initialFrame = 1; // Grass starts at frame 1
      } else if (type === 'sand' || type === 'deep_sand') {
        // Sand: frame 0 for up/down, frame 1 for left/right
        initialFrame = (direction === 'left' || direction === 'right') ? 1 : 0;
      }
    }

    const effect: GrassEffect = {
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
    };

    this.effects.set(id, effect);
    
    // Debug logging
    if (type === 'tall') {
      console.log(`[GRASS] Created tall grass effect ${id} at (${tileX}, ${tileY}), skipAnimation=${skipAnimation}, frame=${initialFrame}, completed=${effect.completed}`);
    }
    
    return id;
  }

  /**
   * Update all grass effects by one tick (called at 60 FPS).
   * Advances animation frames according to pokeemerald timing.
   */
  update(): void {
    for (const effect of this.effects.values()) {
      if (effect.completed || effect.skipAnimation) {
        continue;
      }

      effect.animationTick++;

      if (effect.type === 'tall') {
        // Tall grass: uniform 10 ticks per frame
        if (effect.animationTick >= TALL_GRASS_TICKS_PER_FRAME) {
          effect.animationTick = 0;
          
          if (effect.sequenceIndex < TALL_GRASS_ANIMATION_SEQUENCE.length - 1) {
            effect.sequenceIndex++;
            effect.animationFrame = TALL_GRASS_ANIMATION_SEQUENCE[effect.sequenceIndex];
          } else {
            effect.completed = true;
            console.log(`[GRASS] Tall grass effect ${effect.id} animation completed at frame ${effect.animationFrame}`);
          }
        }
      } else if (effect.type === 'long') {
        // Long grass: variable frame durations
        // Use sequenceIndex to determine duration, not frame
        const frameDuration = LONG_GRASS_FRAME_DURATIONS[effect.sequenceIndex] || 4;
        
        if (effect.animationTick >= frameDuration) {
          effect.animationTick = 0;
          
          if (effect.sequenceIndex < LONG_GRASS_ANIMATION_SEQUENCE.length - 1) {
            effect.sequenceIndex++;
            effect.animationFrame = LONG_GRASS_ANIMATION_SEQUENCE[effect.sequenceIndex];
          } else {
            effect.completed = true;
          }
        }
      } else if (effect.type === 'sand' || effect.type === 'deep_sand') {
        // Sand footprints:
        // 0-40 frames: Static (Step 0)
        // 40-56 frames: Flicker (Step 1)
        // 56+ frames: End
        
        // Note: animationTick here acts as the global timer for this effect
        
        if (effect.animationTick > 56) {
          effect.completed = true;
        } else if (effect.animationTick > 40) {
          // Flicker phase: toggle visibility every frame
          // In C code: sprite->invisible ^= 1
          effect.visible = !effect.visible;
        }
      }
    }
  }

  /**
   * Clean up completed grass effects.
   * 
   * Behavior per pokeemerald:
   * - Effects that end at frame 0: Keep until player moves away from tile
   * - Other completed effects: Remove immediately
   * 
   * Frame 0 is the "resting" frame that shows grass covering player's feet.
   * It persists whether it got there via animation (1→2→3→4→0) or spawn (start at 0).
   * 
   * @param ownerPositions - Map of owner IDs to their current tile positions
   */
  cleanup(ownerPositions: Map<string, { tileX: number; tileY: number }>): void {
    for (const [id, effect] of this.effects.entries()) {
      if (!effect.completed) {
        continue; // Don't clean up until animation finishes
      }

      // For effects at frame 0 (tall/long grass), keep until player moves away
      // Frame 0 is the final "resting" frame that covers the player's feet
      if ((effect.type === 'tall' || effect.type === 'long') && effect.animationFrame === 0) {
        const ownerPos = ownerPositions.get(effect.ownerObjectId);
        if (!ownerPos) {
          // Owner doesn't exist anymore, remove effect
          console.log(`[GRASS] Removing frame 0 effect ${id} - owner doesn't exist`);
          this.effects.delete(id);
          continue;
        }

        // Check if owner moved away from this grass tile
        const ownerMoved = ownerPos.tileX !== effect.tileX || ownerPos.tileY !== effect.tileY;
        
        if (ownerMoved) {
          console.log(`[GRASS] Removing frame 0 effect ${id} at (${effect.tileX}, ${effect.tileY}) - owner moved to (${ownerPos.tileX}, ${ownerPos.tileY})`);
          this.effects.delete(id);
        } else {
          // Keep the frame 0 effect (player still on grass)
          if (Math.random() < 0.01) {
            console.log(`[GRASS] Keeping frame 0 effect ${id} at (${effect.tileX}, ${effect.tileY}) - owner still there`);
          }
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
  getEffectsForRendering(): GrassEffectForRendering[] {
    const results: GrassEffectForRendering[] = [];

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
