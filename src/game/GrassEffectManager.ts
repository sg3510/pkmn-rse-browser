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
  animationFrame: number;  // Current frame index (0-4)
  animationTick: number;   // Tick counter within current frame
  skipAnimation: boolean;  // If true, start at frame 0 (spawn case)
  ownerObjectId: string;   // Player/NPC ID that triggered this
  completed: boolean;      // Animation finished
}

export interface GrassEffectForRendering {
  id: string;
  worldX: number;          // World pixel X (tileX * 16 + 8)
  worldY: number;          // World pixel Y (tileY * 16 + 8)
  frame: number;           // Current animation frame (0-4)
  subpriorityOffset: number; // 0 or 4 based on frame
}

/**
 * Animation sequence from pokeemerald C code:
 * Frame 1: 10 ticks
 * Frame 2: 10 ticks
 * Frame 3: 10 ticks
 * Frame 4: 10 ticks
 * Frame 0: 10 ticks
 * END
 */
const ANIMATION_SEQUENCE = [1, 2, 3, 4, 0];
const TICKS_PER_FRAME = 10;
const TOTAL_ANIMATION_TICKS = ANIMATION_SEQUENCE.length * TICKS_PER_FRAME; // 50

export class GrassEffectManager {
  private effects: Map<string, GrassEffect> = new Map();
  private nextId = 0;

  /**
   * Create a new grass effect at the specified tile position.
   * 
   * @param tileX - Map tile X coordinate
   * @param tileY - Map tile Y coordinate
   * @param skipAnimation - If true, skip animation and show frame 0 (for spawn-on-tile)
   * @param ownerObjectId - ID of the player/NPC that triggered this
   * @returns The created effect ID
   */
  create(tileX: number, tileY: number, skipAnimation: boolean, ownerObjectId: string): string {
    const id = `grass_${this.nextId++}`;
    
    const effect: GrassEffect = {
      id,
      tileX,
      tileY,
      animationFrame: skipAnimation ? 0 : 1, // Start at frame 1 for animation, 0 for skip
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

      // Check if we should advance to the next frame
      if (effect.animationTick >= TICKS_PER_FRAME) {
        effect.animationTick = 0;

        // Get current index in animation sequence
        const currentIndex = ANIMATION_SEQUENCE.indexOf(effect.animationFrame);
        
        if (currentIndex !== -1 && currentIndex < ANIMATION_SEQUENCE.length - 1) {
          // Move to next frame in sequence
          effect.animationFrame = ANIMATION_SEQUENCE[currentIndex + 1];
        } else {
          // Animation complete
          effect.completed = true;
        }
      }
    }
  }

  /**
   * Clean up completed grass effects where the owner has moved away.
   * 
   * Based on pokeemerald logic: effect stays alive until animation completes
   * AND the owner (player/NPC) is no longer on that tile.
   * 
   * @param ownerPositions - Map of owner IDs to their current tile positions
   */
  cleanup(ownerPositions: Map<string, { tileX: number; tileY: number }>): void {
    for (const [id, effect] of this.effects.entries()) {
      if (!effect.completed) {
        continue; // Don't clean up until animation finishes
      }

      const ownerPos = ownerPositions.get(effect.ownerObjectId);
      if (!ownerPos) {
        // Owner doesn't exist anymore, remove effect
        this.effects.delete(id);
        continue;
      }

      // Check if owner moved away from this grass tile
      const ownerMoved = ownerPos.tileX !== effect.tileX || ownerPos.tileY !== effect.tileY;
      
      if (ownerMoved) {
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

      // Subpriority offset: +4 when at frame 0, otherwise 0
      // From C code (field_effect_helpers.c:351-352):
      // metatileBehavior = 0;
      // if (sprite->animCmdIndex == 0) metatileBehavior = 4;
      const subpriorityOffset = effect.animationFrame === 0 ? 4 : 0;

      results.push({
        id: effect.id,
        worldX,
        worldY,
        frame: effect.animationFrame,
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
