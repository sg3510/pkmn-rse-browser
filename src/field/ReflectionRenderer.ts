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
import { isPondBridge } from '../utils/metatileBehaviors';

// Re-export shimmer utilities for convenient imports
export {
  ReflectionShimmer,
  getGlobalShimmer,
  isShimmerEnabled,
  setShimmerEnabled,
  applyGbaAffineShimmer,
} from './ReflectionShimmer';

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
 * Bridge offsets for reflection Y position (GBA-accurate)
 *
 * When standing on bridges over water, the reflection needs to be
 * offset down to account for the bridge height.
 *
 * From GBA's bridgeReflectionVerticalOffsets[] (field_effect_helpers.c:78-82):
 * - none: 0 (not on bridge)
 * - ocean: 0 (Routes 110/119 log bridges - no extra offset)
 * - pondLow: 12 (unused in game)
 * - pondMed: 28 (Route 120 south bridge)
 * - pondHigh: 44 (Route 120 north bridge)
 */
export const BRIDGE_OFFSETS: Record<BridgeType, number> = {
  none: 0,
  ocean: 0,
  pondLow: 12,
  pondMed: 28,
  pondHigh: 44,
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
 * Bridge reflection color (GBA-accurate)
 *
 * From pokeemerald graphics/object_events/palettes/bridge_reflection.pal:
 * The GBA uses a SOLID palette replacement of RGB(74, 115, 172) for all 16 colors.
 * This makes bridge reflections appear as solid blue silhouettes, not tinted sprites.
 *
 * The color is applied as a solid fill (no alpha in the color itself).
 * Final transparency is controlled by REFLECTION_ALPHA.bridge (0.6).
 */
export const BRIDGE_REFLECTION_TINT = 'rgb(74, 115, 172)';

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
 * From GBA's IsSpecialBridgeReflectionPaletteNeeded (field_effect_helpers.c):
 * - Pond bridges (low/med/high) use dark blue tint to blend with dark water under bridge
 * - Ocean bridges use normal water tint (no special palette)
 *
 * @param reflectionType - Type of reflection (water/ice)
 * @param bridgeType - Type of bridge being stood on
 * @returns CSS color string for the tint
 */
export function getReflectionTint(
  reflectionType: ReflectionType | null,
  bridgeType: BridgeType
): string {
  // Only pond bridges get the dark blue tint, not ocean bridges
  if (isPondBridge(bridgeType)) {
    return BRIDGE_REFLECTION_TINT;
  }
  return REFLECTION_TINTS[reflectionType ?? 'water'];
}

/**
 * Get the appropriate alpha for a reflection
 *
 * Pond bridges have slightly reduced alpha to better blend with dark tint.
 * Ocean bridges use normal alpha.
 *
 * @param bridgeType - Type of bridge being stood on
 * @returns Alpha value (0-1)
 */
export function getReflectionAlpha(bridgeType: BridgeType): number {
  return isPondBridge(bridgeType) ? REFLECTION_ALPHA.bridge : REFLECTION_ALPHA.normal;
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
