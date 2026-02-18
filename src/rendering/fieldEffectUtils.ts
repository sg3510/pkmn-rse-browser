/**
 * Field Effect Utilities - Shared logic for field effect rendering
 *
 * This module contains GBA-accurate field effect logic used by both
 * Canvas2D (ObjectRenderer) and WebGL (spriteUtils) renderers.
 *
 * Field effects include:
 * - Tall grass (player walking through grass)
 * - Long grass (taller grass that clips player sprite)
 * - Sand footprints (appears behind walking player)
 * - Deep sand footprints
 * - Puddle splashes (water edge effects)
 * - Water ripples (surfing effects)
 */

import type { FieldEffectForRendering } from '../game/FieldEffectManager';

/**
 * Field effect sprite dimensions by type
 * Most effects are 16x16, puddle_splash is 16x8
 */
export const FIELD_EFFECT_DIMENSIONS: Readonly<Record<string, { width: number; height: number }>> = {
  tall: { width: 16, height: 16 },
  long: { width: 16, height: 16 },
  sand: { width: 16, height: 16 },
  deep_sand: { width: 16, height: 16 },
  bike_tire_tracks: { width: 16, height: 16 },
  puddle_splash: { width: 16, height: 8 },
  water_ripple: { width: 16, height: 16 },
  GROUND_IMPACT_DUST: { width: 16, height: 8 },
  ASH: { width: 16, height: 16 },
  ash_launch: { width: 16, height: 16 },
  ash_puff: { width: 16, height: 16 },
};

/**
 * Y offset for water effects based on GBA C code analysis:
 *
 * - Ripple: sprite->y + (height/2) - 2 = positioned 6px down from sprite center
 *   From C: gFieldEffectArguments[1] = sprite->y + (graphicsInfo->height >> 1) - 2
 *
 * - Splash: y2 = (height/2) - 4 = positioned 4px down from sprite center
 *   From C: sprite->y2 = (graphicsInfo->height >> 1) - 4
 *
 * For 16px player sprite centered at tile, effect world position = worldY + offset
 */
export const FIELD_EFFECT_Y_OFFSETS: Readonly<Record<string, number>> = {
  water_ripple: 6,
  puddle_splash: 4,
  // C parity: SetSpritePosToOffsetMapCoords(..., 8, 12) for ground-impact dust.
  // Our field effects are centered at tile center (8,8), so +4px aligns to feet.
  GROUND_IMPACT_DUST: 4,
};

/**
 * Compute whether a field effect should render in front of or behind the player
 *
 * Y-sorting rules (from GBA behavior):
 * 1. Sand, puddle splashes, and water ripples ALWAYS render behind player
 *    (they appear at the player's feet level)
 * 2. Grass effects use dynamic Y-sorting based on worldY comparison
 * 3. subpriorityOffset > 0 means "lower priority", so render behind player
 * 4. renderBehindPlayer flag (from UpdateGrassFieldEffectSubpriority) forces behind
 *
 * @param effect - Field effect to evaluate
 * @param playerWorldY - Player's world Y position
 * @returns 'front' if effect should render in front of player, 'behind' otherwise
 */
export function computeFieldEffectLayer(
  effect: FieldEffectForRendering,
  playerWorldY: number
): 'front' | 'behind' {
  // Sand, puddle splashes, and water ripples always render behind player
  if (
    effect.type === 'sand' ||
    effect.type === 'deep_sand' ||
    effect.type === 'bike_tire_tracks' ||
    effect.registryKey === 'SAND_FOOTPRINTS' ||
    effect.registryKey === 'DEEP_SAND_FOOTPRINTS' ||
    effect.registryKey === 'BIKE_TIRE_TRACKS' ||
    effect.type === 'puddle_splash' ||
    effect.type === 'water_ripple'
  ) {
    return 'behind';
  }

  // GBA behavior: When player moves DOWN from grass, grass renders BEHIND player
  // This implements UpdateGrassFieldEffectSubpriority which adjusts subpriority
  // so grass animation can complete naturally without covering the player
  if (effect.renderBehindPlayer) {
    return 'behind';
  }

  // Dynamic layering from subpriority (for tall grass)
  // If subpriority offset is high (4), it means "lower priority" relative to player
  if (effect.subpriorityOffset > 0) {
    return 'behind';
  }

  // Ash effects also render in front (they pop out of the ground)
  if (effect.type === 'ash_launch' || effect.type === 'ash_puff' || effect.registryKey === 'ASH') {
    return 'front';
  }

  // Standard Y-sorting: effects at or below player Y render in front
  return effect.worldY >= playerWorldY ? 'front' : 'behind';
}

/**
 * Get the Y offset for a field effect type
 *
 * Water effects (ripple, splash) are offset downward to appear at player's feet.
 * Other effects have no Y offset.
 *
 * @param effectType - Type of field effect
 * @returns Y offset in pixels (positive = downward)
 */
export function getFieldEffectYOffset(effectType: string): number {
  return FIELD_EFFECT_Y_OFFSETS[effectType] ?? 0;
}

/**
 * Get dimensions for a field effect sprite
 *
 * @param effectType - Type of field effect
 * @returns { width, height } in pixels, defaults to 16x16 if unknown type
 */
export function getFieldEffectDimensions(effectType: string): { width: number; height: number } {
  return FIELD_EFFECT_DIMENSIONS[effectType] ?? { width: 16, height: 16 };
}

/**
 * Check if a field effect should render in a specific layer
 *
 * Convenience function that combines computeFieldEffectLayer with layer filtering.
 *
 * @param effect - Field effect to check
 * @param playerWorldY - Player's world Y position
 * @param layer - 'bottom' (behind player) or 'top' (in front of player)
 * @returns true if effect should render in the specified layer
 */
export function shouldRenderInLayer(
  effect: FieldEffectForRendering,
  playerWorldY: number,
  layer: 'bottom' | 'top'
): boolean {
  if (!effect.visible) return false;

  const effectLayer = computeFieldEffectLayer(effect, playerWorldY);

  if (layer === 'bottom') {
    return effectLayer === 'behind';
  } else {
    return effectLayer === 'front';
  }
}
