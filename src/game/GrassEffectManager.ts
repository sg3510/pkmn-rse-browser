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
  animationFrame: number;  // Current frame index (0-4 for tall, 0-3 for long)
  sequenceIndex: number;   // Index in the animation sequence array
  animationTick: number;   // Tick counter within current frame
  type: 'tall' | 'long';   // Grass type
  skipAnimation: boolean;  // If true, start at frame 0 (spawn case)
  ownerObjectId: string;   // Player/NPC ID that triggered this
  completed: boolean;      // Animation finished
}

export interface GrassEffectForRendering {
  id: string;
  worldX: number;          // World pixel X (tileX * 16 + 8)
  worldY: number;          // World pixel Y (tileY * 16 + 8)
  frame: number;           // Current animation frame (0-4 for tall, 0-3 for long)
  type: 'tall' | 'long';   // Grass type
  subpriorityOffset: number; // 0 or 4 based on frame
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
   * Create a new grass effect at the specified tile position.
   * 
   * @param tileX - Map tile X coordinate
   * @param tileY - Map tile Y coordinate
   * @param type - Grass type ('tall' or 'long')
   * @param skipAnimation - If true, skip animation and show frame 0 (for spawn-on-tile)
   * @param ownerObjectId - ID of the player/NPC that triggered this
   * @returns The created effect ID
   */
  create(tileX: number, tileY: number, type: 'tall' | 'long', skipAnimation: boolean, ownerObjectId: string): string {
    const id = `grass_${this.nextId++}`;
    
    const effect: GrassEffect = {
      id,
      tileX,
      tileY,
      type,
      animationFrame: skipAnimation ? 0 : (type === 'tall' ? 1 : 1), // Both start at frame 1 for animation
      sequenceIndex: 0,
      animationTick: 0,
      skipAnimation,
      ownerObjectId,
      completed: skipAnimation, // If skipping, mark as completed immediately
    };

    this.effects.set(id, effect);
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
          }
        }
      } else {
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
      }
    }
  }

  /**
   * Clean up completed grass effects.
   * 
   * Updated behavior: Remove effects immediately upon completion.
   * The static map tile (Layer 1) handles the "covering" of the player,
   * so the sprite is only needed for the animation duration.
   * This prevents the sprite from persisting ("staying forever") and looking like a static overlay.
   * 
   * @param _ownerPositions - Unused (kept for API compatibility)
   */
  cleanup(_ownerPositions: Map<string, { tileX: number; tileY: number }>): void {
    for (const [id, effect] of this.effects.entries()) {
      if (effect.completed) {
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

      results.push({
        id: effect.id,
        worldX,
        worldY,
        frame: effect.animationFrame,
        type: effect.type,
        subpriorityOffset,
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
