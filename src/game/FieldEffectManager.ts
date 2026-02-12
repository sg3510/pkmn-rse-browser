/**
 * FieldEffectManager
 * 
 * Manages field effect sprites for tiles with MB_TALL_GRASS behavior and others.
 * Based on pokeemerald C code:
 * - src/field_effect_helpers.c: FldEff_TallGrass, UpdateTallGrassFieldEffect
 * - src/data/field_effects/field_effect_objects.h: Animation frames and timing
 * - src/event_object_movement.c: Ground effect triggers
 */

import { TICK_60FPS_MS } from '../config/timing';
import { FIELD_EFFECT_REGISTRY } from '../data/fieldEffects.gen';

// GBA/NDS-style tick used by field effects (60fps cadence)
const MS_PER_TICK = TICK_60FPS_MS;

export type FieldEffectType =
  | keyof typeof FIELD_EFFECT_REGISTRY
  | 'sand'
  | 'deep_sand'
  | 'bike_tire_tracks'
  | 'puddle_splash'
  | 'water_ripple'
  | 'tall'
  | 'long'
  | 'ash_launch'
  | 'ash_puff';

export type FieldEffectDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'turn_se'
  | 'turn_sw'
  | 'turn_nw'
  | 'turn_ne';

// Map legacy names to registry keys
const LEGACY_MAP: Record<string, string> = {
  tall: 'TALL_GRASS',
  long: 'LONG_GRASS',
  sand: 'SAND_FOOTPRINTS',
  deep_sand: 'DEEP_SAND_FOOTPRINTS',
  bike_tire_tracks: 'BIKE_TIRE_TRACKS',
  puddle_splash: 'SPLASH',
  water_ripple: 'RIPPLE',
  ash_launch: 'ASH_LAUNCH',
  ash_puff: 'ASH_PUFF',
};

const TRACK_EFFECT_KEYS = new Set(['SAND_FOOTPRINTS', 'DEEP_SAND_FOOTPRINTS', 'BIKE_TIRE_TRACKS']);

function isTrackRegistryKey(registryKey: string): boolean {
  return TRACK_EFFECT_KEYS.has(registryKey);
}

export interface FieldEffect {
  id: string;
  tileX: number;
  tileY: number;
  animationFrame: number;  // Current GBA frame index (e.g. 0, 1, 2)
  sequenceIndex: number;   // Index in the animation array
  animationTick: number;   // Tick counter within current frame
  type: FieldEffectType;
  registryKey: string;
  skipAnimation: boolean;  // If true, start at frame 0 (spawn case)
  ownerObjectId: string;   // Player/NPC ID that triggered this
  completed: boolean;      // Animation finished
  visible: boolean;        // For flickering effects
  direction?: FieldEffectDirection;  // Direction/turn for footprints and bike tracks
  flipHorizontal: boolean;
  flipVertical: boolean;
  renderBehindPlayer: boolean;  // When player moves DOWN from grass, render grass behind player
}

export interface FieldEffectForRendering {
  id: string;
  worldX: number;          // World pixel X (tileX * 16 + 8)
  worldY: number;          // World pixel Y (tileY * 16 + 8)
  frame: number;           // Current GBA frame index
  type: FieldEffectType;
  registryKey: string;
  subpriorityOffset: number; // 0 or 4 based on frame
  visible: boolean;
  direction?: FieldEffectDirection;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  renderBehindPlayer?: boolean;  // True when player is moving DOWN from this grass tile
  ownerObjectId: string;   // ID of the player/NPC that triggered this effect
}

function applyTrackOrientation(effect: FieldEffect): void {
  effect.flipHorizontal = false;
  effect.flipVertical = false;

  if (effect.registryKey === 'SAND_FOOTPRINTS' || effect.registryKey === 'DEEP_SAND_FOOTPRINTS') {
    // C parity: N/S use frame 0, W/E use frame 1, SOUTH uses vFlip, EAST uses hFlip.
    switch (effect.direction) {
      case 'left':
        effect.animationFrame = 1;
        break;
      case 'right':
        effect.animationFrame = 1;
        effect.flipHorizontal = true;
        break;
      case 'down':
        effect.animationFrame = 0;
        effect.flipVertical = true;
        break;
      case 'up':
      default:
        effect.animationFrame = 0;
        break;
    }
    return;
  }

  if (effect.registryKey === 'BIKE_TIRE_TRACKS') {
    // C parity from sAnimTable_BikeTireTracks.
    switch (effect.direction) {
      case 'left':
      case 'right':
        effect.animationFrame = 1;
        break;
      case 'turn_se':
        effect.animationFrame = 0;
        break;
      case 'turn_sw':
        effect.animationFrame = 0;
        effect.flipHorizontal = true;
        break;
      case 'turn_nw':
        effect.animationFrame = 3;
        effect.flipHorizontal = true;
        break;
      case 'turn_ne':
        effect.animationFrame = 3;
        break;
      case 'up':
      case 'down':
      default:
        effect.animationFrame = 2;
        break;
    }
  }
}

export class FieldEffectManager {
  private effects: Map<string, FieldEffect> = new Map();
  private nextId = 0;

  /**
   * Create a new field effect at the specified tile position.
   */
  create(
    tileX: number,
    tileY: number,
    type: FieldEffectType,
    skipAnimation: boolean,
    ownerObjectId: string,
    direction?: FieldEffectDirection
  ): string {
    const id = `effect_${this.nextId++}`;
    const registryKey = LEGACY_MAP[type] || type;
    const metadata = FIELD_EFFECT_REGISTRY[registryKey];

    if (!metadata) {
      console.warn(`[FieldEffectManager] No metadata for effect: ${type} (key: ${registryKey})`);
      return '';
    }

    // Select initial frame
    let initialFrame = metadata.animation[0]?.frame ?? 0;
    if (skipAnimation) {
      initialFrame = 0; // Resting frame
    }

    const effect: FieldEffect = {
      id,
      tileX,
      tileY,
      type,
      registryKey,
      animationFrame: initialFrame,
      sequenceIndex: 0,
      animationTick: 0,
      skipAnimation,
      ownerObjectId,
      completed: skipAnimation,
      visible: true,
      direction,
      flipHorizontal: false,
      flipVertical: false,
      renderBehindPlayer: false,
    };

    if (isTrackRegistryKey(registryKey)) {
      // Tracks are static sprites with direction-selected frame/flip.
      applyTrackOrientation(effect);
      effect.completed = false;
      effect.skipAnimation = false;
    }

    this.effects.set(id, effect);
    return id;
  }

  /**
   * Update all effects based on elapsed time.
   */
  update(deltaMs: number): void {
    const ticksElapsed = deltaMs / MS_PER_TICK;

    for (const effect of this.effects.values()) {
      // C parity for tracks (sand/deep sand footprints and bike tire tracks):
      // visible for 40 ticks, flicker until tick 56, removed after 56.
      if (isTrackRegistryKey(effect.registryKey)) {
        effect.animationTick += ticksElapsed;
        if (effect.animationTick > 56) {
          effect.completed = true;
        } else if (effect.animationTick > 40) {
          effect.visible = Math.floor(effect.animationTick) % 2 === 0;
        } else {
          effect.visible = true;
        }
        continue;
      }

      if (effect.completed || effect.skipAnimation) {
        continue;
      }

      const metadata = FIELD_EFFECT_REGISTRY[effect.registryKey];
      if (!metadata) continue;

      effect.animationTick += ticksElapsed;

      // Generic animation advancement
      while (!effect.completed) {
        const currentFrame = metadata.animation[effect.sequenceIndex];
        if (!currentFrame) {
          effect.completed = true;
          break;
        }

        if (effect.animationTick < currentFrame.duration) {
          break;
        }

        effect.animationTick -= currentFrame.duration;
        effect.sequenceIndex++;

        if (effect.sequenceIndex < metadata.animation.length) {
          effect.animationFrame = metadata.animation[effect.sequenceIndex].frame;
        } else {
          effect.completed = true;
        }
      }
    }
  }

  /**
   * Clean up completed effects and update render priority.
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

      // Grass-specific layering logic
      if ((effect.registryKey === 'TALL_GRASS' || effect.registryKey === 'LONG_GRASS') && ownerPos) {
        const currentOnGrass = ownerPos.tileX === effect.tileX && ownerPos.tileY === effect.tileY;
        const movingAwayDown = ownerPos.isMoving &&
          ownerPos.direction === 'down' &&
          (ownerPos.destTileX !== effect.tileX || ownerPos.destTileY !== effect.tileY);

        if (currentOnGrass && movingAwayDown) {
          effect.renderBehindPlayer = true;
        } else if (!currentOnGrass && !ownerPos.isMoving) {
          effect.renderBehindPlayer = false;
        }
      }

      if (!effect.completed) {
        continue;
      }

      // Keep resting frame grass until player moves away
      if ((effect.registryKey === 'TALL_GRASS' || effect.registryKey === 'LONG_GRASS') && effect.animationFrame === 0) {
        if (!ownerPos) {
          this.effects.delete(id);
          continue;
        }

        const currentOnGrass = ownerPos.tileX === effect.tileX && ownerPos.tileY === effect.tileY;
        const previousOnGrass = ownerPos.prevTileX === effect.tileX && ownerPos.prevTileY === effect.tileY;

        if (ownerPos.isJumping && previousOnGrass && !currentOnGrass) {
          this.effects.delete(id);
          continue;
        }

        if (!currentOnGrass && !previousOnGrass) {
          this.effects.delete(id);
        }
      } else {
        this.effects.delete(id);
      }
    }
  }

  /**
   * Get all effects formatted for rendering.
   */
  getEffectsForRendering(): FieldEffectForRendering[] {
    const results: FieldEffectForRendering[] = [];

    for (const effect of this.effects.values()) {
      const worldX = effect.tileX * 16 + 8;
      const worldY = effect.tileY * 16 + 8;

      let subpriorityOffset = 0;
      if (effect.registryKey === 'TALL_GRASS' && effect.animationFrame === 1) {
        subpriorityOffset = 4;
      }

      results.push({
        id: effect.id,
        worldX,
        worldY,
        frame: effect.animationFrame,
        type: effect.type,
        registryKey: effect.registryKey,
        subpriorityOffset,
        visible: effect.visible,
        direction: effect.direction,
        flipHorizontal: effect.flipHorizontal,
        flipVertical: effect.flipVertical,
        renderBehindPlayer: effect.renderBehindPlayer,
        ownerObjectId: effect.ownerObjectId,
      });
    }

    return results;
  }

  /**
   * Get the number of active effects (for debugging).
   */
  getEffectCount(): number {
    return this.effects.size;
  }

  /**
   * Clear all effects.
   */
  clear(): void {
    this.effects.clear();
  }
}
