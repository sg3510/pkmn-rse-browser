/**
 * ReflectionRenderer - Water and ice reflection effects
 *
 * This module provides utilities for rendering object reflections on
 * water and ice surfaces. Reflections are a key visual effect in the
 * GBA Pokemon games, where players and NPCs cast reflections on nearby
 * water tiles.
 *
 * Based on pokeemerald's reflection system:
 * - src/field_effect_helpers.c: UpdateObjectReflectionSprite
 * - src/event_object_movement.c: Reflection sprite management
 *
 * Reflection behavior:
 * - Water: Blue-tinted, semi-transparent reflection
 * - Ice: Clear/white-tinted mirror reflection
 * - Bridge: Darker tint when on bridge over water
 *
 * Position calculation:
 * - Reflection appears at sprite.y + height - 2 + bridgeOffset
 * - This places the reflection just below the sprite's feet
 *
 * Masking:
 * - Reflections are masked to only show on reflective tile pixels
 * - The pixel mask comes from BG1 transparency data
 * - This ensures reflections only appear on water portions, not land
 *
 * Note: The actual rendering implementation is in ObjectRenderer.
 * This module provides the type definitions, constants, and detection
 * utilities for reflection effects.
 *
 * Usage:
 * ```typescript
 * import { computeReflectionState } from '../components/map/utils';
 * import { REFLECTION_TINTS, BRIDGE_OFFSETS } from './ReflectionRenderer';
 *
 * // Compute reflection state for an object
 * const reflectionState = computeReflectionState(ctx, player);
 *
 * // Use in rendering
 * if (reflectionState.hasReflection) {
 *   const tint = REFLECTION_TINTS[reflectionState.reflectionType ?? 'water'];
 *   const offset = BRIDGE_OFFSETS[reflectionState.bridgeType];
 *   // ... render reflection with tint and offset
 * }
 * ```
 */

import type { BridgeType } from '../utils/metatileBehaviors';

/**
 * Reflection type for surface effects
 */
export type ReflectionType = 'water' | 'ice';

/**
 * Reflection state for an object
 *
 * Computed from tile data at the object's position.
 */
export interface ReflectionState {
  /** Whether a reflection should be rendered */
  hasReflection: boolean;
  /** Type of reflection effect (water = blue tint, ice = clear) */
  reflectionType: ReflectionType | null;
  /** Bridge type affects reflection offset and tint */
  bridgeType: BridgeType;
}

/**
 * Bridge offsets for reflection Y position
 *
 * When standing on bridges over water, the reflection needs to be
 * offset down to account for the bridge height.
 *
 * Values in pixels:
 * - none: 0 (not on bridge)
 * - pondLow: 2 (low bridge)
 * - pondMed: 4 (medium bridge)
 * - pondHigh: 6 (high bridge)
 */
export const BRIDGE_OFFSETS: Record<BridgeType, number> = {
  none: 0,
  pondLow: 2,
  pondMed: 4,
  pondHigh: 6,
};

/**
 * Reflection tint colors by type
 *
 * Applied as overlay on the flipped sprite to create the reflection effect.
 */
export const REFLECTION_TINTS: Record<ReflectionType, string> = {
  /** Water: Blue tint for underwater appearance */
  water: 'rgba(70, 120, 200, 0.35)',
  /** Ice: Light blue/white tint for frozen surface */
  ice: 'rgba(180, 220, 255, 0.35)',
};

/**
 * Darker tint when on bridge over water
 */
export const BRIDGE_REFLECTION_TINT = 'rgba(20, 40, 70, 0.55)';

/**
 * Reflection alpha by bridge state
 */
export const REFLECTION_ALPHA = {
  /** Normal reflection alpha */
  normal: 0.65,
  /** Reduced alpha when on bridge */
  bridge: 0.6,
};

/**
 * Vertical offset from sprite bottom to reflection start
 *
 * The reflection starts 2 pixels above the sprite's bottom edge.
 * This matches GBA's GetReflectionVerticalOffset() which returns height - 2.
 */
export const REFLECTION_VERTICAL_OFFSET = -2;

/**
 * Sprite frame information for reflection rendering
 *
 * Contains all data needed to render a sprite's reflection.
 */
export interface SpriteFrameInfo {
  /** Sprite image source */
  sprite: HTMLCanvasElement | HTMLImageElement;
  /** Source X in sprite sheet */
  sx: number;
  /** Source Y in sprite sheet */
  sy: number;
  /** Source width */
  sw: number;
  /** Source height */
  sh: number;
  /** Horizontal flip flag (for east-facing) */
  flip: boolean;
  /** World pixel X (top-left of sprite) */
  worldX: number;
  /** World pixel Y (top-left of sprite) */
  worldY: number;
  /** Tile X position (for reflection detection) */
  tileX: number;
  /** Tile Y position (for reflection detection) */
  tileY: number;
}

/**
 * Calculate reflection Y position for a sprite
 *
 * @param spriteWorldY - Sprite's world Y position (top-left)
 * @param spriteHeight - Sprite height in pixels
 * @param bridgeType - Type of bridge (affects offset)
 * @returns World Y position for reflection
 */
export function calculateReflectionY(
  spriteWorldY: number,
  spriteHeight: number,
  bridgeType: BridgeType
): number {
  return spriteWorldY + spriteHeight + REFLECTION_VERTICAL_OFFSET + BRIDGE_OFFSETS[bridgeType];
}

/**
 * Get the appropriate tint color for a reflection
 *
 * @param reflectionType - Type of reflection (water/ice)
 * @param bridgeType - Type of bridge being stood on
 * @returns CSS color string for the tint
 */
export function getReflectionTint(
  reflectionType: ReflectionType | null,
  bridgeType: BridgeType
): string {
  if (bridgeType !== 'none') {
    return BRIDGE_REFLECTION_TINT;
  }
  return REFLECTION_TINTS[reflectionType ?? 'water'];
}

/**
 * Get the appropriate alpha for a reflection
 *
 * @param bridgeType - Type of bridge being stood on
 * @returns Alpha value (0-1)
 */
export function getReflectionAlpha(bridgeType: BridgeType): number {
  return bridgeType === 'none' ? REFLECTION_ALPHA.normal : REFLECTION_ALPHA.bridge;
}

/**
 * Check if a position should have a reflection rendered
 *
 * This is a quick check based on the reflection state.
 * The actual reflection state should be computed using
 * computeReflectionState from components/map/utils.
 *
 * @param reflectionState - Pre-computed reflection state
 * @returns true if reflection should be rendered
 */
export function shouldRenderReflection(reflectionState: ReflectionState | null): boolean {
  return reflectionState !== null && reflectionState.hasReflection;
}

/**
 * Create an initial/empty reflection state
 *
 * Use this when no reflection data is available.
 */
export function createEmptyReflectionState(): ReflectionState {
  return {
    hasReflection: false,
    reflectionType: null,
    bridgeType: 'none',
  };
}
