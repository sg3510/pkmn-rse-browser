// Behavior constants derived from public/pokeemerald/include/constants/metatile_behaviors.h
import {
  MB_TALL_GRASS,
  MB_LONG_GRASS,
  MB_SECRET_BASE_WALL,
  MB_IMPASSABLE_EAST,
  MB_IMPASSABLE_SOUTH_AND_NORTH,
  MB_IMPASSABLE_WEST_AND_EAST,
  MB_JUMP_SOUTHWEST,
} from './metatileBehaviors.generated';

export {
  MB_TALL_GRASS,
  MB_LONG_GRASS,
  MB_SECRET_BASE_WALL,
  MB_IMPASSABLE_EAST,
  MB_IMPASSABLE_SOUTH_AND_NORTH,
  MB_IMPASSABLE_WEST_AND_EAST,
  MB_JUMP_SOUTHWEST,
};

export const MB_DEEP_SAND = 6;
export const MB_SAND = 33;  // 0x21 - Regular sand (footprints behavior)

export const MB_POND_WATER = 16;
export const MB_INTERIOR_DEEP_WATER = 17;
export const MB_DEEP_WATER = 18;
export const MB_WATERFALL = 19;
export const MB_PUDDLE = 22;
export const MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2 = 26;
export const MB_ICE = 32;
export const MB_SOOTOPOLIS_DEEP_WATER = 20;
export const MB_REFLECTION_UNDER_BRIDGE = 43;
export const MB_SHALLOW_WATER = 23;
export const MB_OCEAN_WATER = 21;
export const MB_NO_SURFACING = 25;  // 0x19 - Underwater areas where you can't surface
export const MB_SEAWEED = 34;  // 0x22 - Underwater seaweed (surfable)
export const MB_SEAWEED_NO_SURFACING = 42;  // 0x2A - Seaweed where you can't surface
export const MB_JUMP_EAST = 56;

export const MB_JUMP_WEST = 57;
export const MB_JUMP_NORTH = 58;
export const MB_JUMP_SOUTH = 59;

export const MB_BRIDGE_OVER_OCEAN = 112;
export const MB_BRIDGE_OVER_POND_LOW = 113;
export const MB_BRIDGE_OVER_POND_MED = 114;
export const MB_BRIDGE_OVER_POND_HIGH = 115;
export const MB_BRIDGE_OVER_POND_MED_EDGE_1 = 122;
export const MB_BRIDGE_OVER_POND_MED_EDGE_2 = 123;
export const MB_BRIDGE_OVER_POND_HIGH_EDGE_1 = 124;
export const MB_BRIDGE_OVER_POND_HIGH_EDGE_2 = 125;
export const MB_BIKE_BRIDGE_OVER_BARRIER = 127;
export const MB_BATTLE_PYRAMID_WARP = 13;
export const MB_MOSSDEEP_GYM_WARP = 14;
export const MB_MT_PYRE_HOLE = 15;
export const MB_LAVARIDGE_GYM_B1F_WARP = 41;
export const MB_NON_ANIMATED_DOOR = 96;  // 0x60 - stairs
export const MB_LADDER = 97;              // 0x61 - ladders
export const MB_EAST_ARROW_WARP = 98;
export const MB_WEST_ARROW_WARP = 99;
export const MB_NORTH_ARROW_WARP = 100;
export const MB_SOUTH_ARROW_WARP = 101;
export const MB_AQUA_HIDEOUT_WARP = 103;
export const MB_LAVARIDGE_GYM_1F_WARP = 104;
export const MB_ANIMATED_DOOR = 105;
export const MB_PETALBURG_GYM_DOOR = 141;  // 0x8D - Same behavior as animated door
export const MB_WATER_DOOR = 108;
export const MB_WATER_SOUTH_ARROW_WARP = 109;
export const MB_DEEP_SOUTH_WARP = 110;
export const MB_SHOAL_CAVE_ENTRANCE = 102;  // 0x66 - Treated as south arrow warp
export const MB_STAIRS_OUTSIDE_ABANDONED_SHIP = 107;  // 0x6B - Treated as north arrow warp

const REFLECTIVE_BEHAVIORS = new Set([
  MB_POND_WATER,
  MB_PUDDLE,
  MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2,
  MB_ICE,
  MB_SOOTOPOLIS_DEEP_WATER,
  MB_REFLECTION_UNDER_BRIDGE,
]);

export function isReflectiveBehavior(behavior: number): boolean {
  return REFLECTIVE_BEHAVIORS.has(behavior);
}

export function isIceBehavior(behavior: number): boolean {
  return behavior === MB_ICE;
}

/**
 * Bridge type enum matching GBA's BRIDGE_TYPE_* constants
 *
 * From include/metatile_behavior.h:
 * - BRIDGE_TYPE_OCEAN (0): Routes 110/119 log bridges - NO extra offset, normal tint
 * - BRIDGE_TYPE_POND_LOW (1): Unused in game - 12px offset, dark blue tint
 * - BRIDGE_TYPE_POND_MED (2): Route 120 south bridge - 28px offset, dark blue tint
 * - BRIDGE_TYPE_POND_HIGH (3): Route 120 north bridge - 44px offset, dark blue tint
 */
export type BridgeType = 'none' | 'ocean' | 'pondLow' | 'pondMed' | 'pondHigh';

/**
 * Get bridge type from metatile behavior
 *
 * Matches GBA's MetatileBehavior_GetBridgeType (metatile_behavior.c:788-810)
 */
export function getBridgeTypeFromBehavior(behavior: number): BridgeType {
  // Check edge tiles first (these are specific to med/high bridges)
  if (behavior === MB_BRIDGE_OVER_POND_MED_EDGE_1 || behavior === MB_BRIDGE_OVER_POND_MED_EDGE_2) {
    return 'pondMed';
  }
  if (behavior === MB_BRIDGE_OVER_POND_HIGH_EDGE_1 || behavior === MB_BRIDGE_OVER_POND_HIGH_EDGE_2) {
    return 'pondHigh';
  }
  switch (behavior) {
    case MB_BRIDGE_OVER_OCEAN:
      return 'ocean';
    case MB_BRIDGE_OVER_POND_LOW:
      return 'pondLow';
    case MB_BRIDGE_OVER_POND_MED:
      return 'pondMed';
    case MB_BRIDGE_OVER_POND_HIGH:
      return 'pondHigh';
    default:
      return 'none';
  }
}

/**
 * Check if bridge type is a pond bridge (requires special dark reflection palette)
 *
 * From GBA's IsSpecialBridgeReflectionPaletteNeeded (field_effect_helpers.c):
 * - BRIDGE_TYPE_POND_LOW, BRIDGE_TYPE_POND_MED, BRIDGE_TYPE_POND_HIGH need dark blue tint
 * - BRIDGE_TYPE_OCEAN does NOT need special palette (uses normal water tint)
 */
export function isPondBridge(bridgeType: BridgeType): boolean {
  return bridgeType === 'pondLow' || bridgeType === 'pondMed' || bridgeType === 'pondHigh';
}

/**
 * Door behaviors that trigger door ANIMATIONS (MetatileBehavior_IsDoor)
 *
 * From GBA code (metatile_behavior.c lines 228-234):
 * - MB_ANIMATED_DOOR
 * - MB_PETALBURG_GYM_DOOR
 *
 * IMPORTANT: MB_WATER_DOOR is NOT animated! It uses non-animated door exit.
 * See public/pokeemerald/src/field_screen_effect.c SetUpWarpExitTask
 */
const DOOR_BEHAVIORS = new Set<number>([
  MB_ANIMATED_DOOR,      // 105 - Standard animated doors
  MB_PETALBURG_GYM_DOOR, // 141 - Petalburg gym door (same behavior)
]);

const TELEPORT_PAD_BEHAVIORS = new Set<number>([
  MB_AQUA_HIDEOUT_WARP,
  MB_LAVARIDGE_GYM_1F_WARP,
  MB_LAVARIDGE_GYM_B1F_WARP,
  MB_BATTLE_PYRAMID_WARP,
  MB_MOSSDEEP_GYM_WARP,
  MB_DEEP_SOUTH_WARP,
  MB_MT_PYRE_HOLE,
]);

const ARROW_WARP_BEHAVIORS = new Set<number>([
  MB_EAST_ARROW_WARP,
  MB_WEST_ARROW_WARP,
  MB_NORTH_ARROW_WARP,
  MB_SOUTH_ARROW_WARP,
  MB_WATER_SOUTH_ARROW_WARP,
  MB_SHOAL_CAVE_ENTRANCE,            // Treated as south arrow
  MB_STAIRS_OUTSIDE_ABANDONED_SHIP,  // Treated as north arrow
]);

export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export function isDoorBehavior(behavior: number): boolean {
  return DOOR_BEHAVIORS.has(behavior);
}

/**
 * Check if behavior is a non-animated door (MetatileBehavior_IsNonAnimDoor)
 *
 * From GBA code (metatile_behavior.c lines 262-270):
 * - MB_NON_ANIMATED_DOOR (stairs)
 * - MB_WATER_DOOR (underwater doors)
 * - MB_DEEP_SOUTH_WARP (deep south exits)
 *
 * These tiles have exit movement (walk one tile in facing direction) but NO door animation.
 * IMPORTANT: MB_LADDER is NOT included - ladders preserve facing and have NO exit sequence!
 */
export function isNonAnimatedDoorBehavior(behavior: number): boolean {
  return behavior === MB_NON_ANIMATED_DOOR ||
         behavior === MB_WATER_DOOR ||
         behavior === MB_DEEP_SOUTH_WARP;
}

/**
 * Check if behavior is a ladder (MetatileBehavior_IsLadder)
 *
 * Ladders are special: they preserve pre-warp facing and have NO exit sequence.
 * The player simply appears on the ladder facing the same direction they were before.
 */
export function isLadderBehavior(behavior: number): boolean {
  return behavior === MB_LADDER;
}

/**
 * Check if behavior requires door exit sequence (with or without animation)
 *
 * From GBA code (field_screen_effect.c SetUpWarpExitTask):
 * - MetatileBehavior_IsDoor → Task_ExitDoor (animated: open door, walk down, close)
 * - MetatileBehavior_IsNonAnimDoor → Task_ExitNonAnimDoor (walk one tile in facing)
 * - Everything else → Task_ExitNonDoor (just fade in, no movement)
 *
 * IMPORTANT: Ladders, arrow warps, teleporters do NOT have exit sequences!
 */
export function requiresDoorExitSequence(behavior: number): boolean {
  return isDoorBehavior(behavior) || isNonAnimatedDoorBehavior(behavior);
}

export function isTeleportWarpBehavior(behavior: number): boolean {
  return TELEPORT_PAD_BEHAVIORS.has(behavior);
}

export function isArrowWarpBehavior(behavior: number): boolean {
  return ARROW_WARP_BEHAVIORS.has(behavior);
}

/**
 * Directional arrow warp checks - match GBA MetatileBehavior_Is*ArrowWarp functions
 * These are used by GetAdjustedInitialDirection to determine facing after warp.
 */
export function isSouthArrowWarp(behavior: number): boolean {
  return behavior === MB_SOUTH_ARROW_WARP ||
         behavior === MB_WATER_SOUTH_ARROW_WARP ||
         behavior === MB_SHOAL_CAVE_ENTRANCE;
}

export function isNorthArrowWarp(behavior: number): boolean {
  return behavior === MB_NORTH_ARROW_WARP ||
         behavior === MB_STAIRS_OUTSIDE_ABANDONED_SHIP;
}

export function isWestArrowWarp(behavior: number): boolean {
  return behavior === MB_WEST_ARROW_WARP;
}

export function isEastArrowWarp(behavior: number): boolean {
  return behavior === MB_EAST_ARROW_WARP;
}

export function isDeepSouthWarp(behavior: number): boolean {
  return behavior === MB_DEEP_SOUTH_WARP;
}

export function getArrowDirectionFromBehavior(behavior: number): CardinalDirection | null {
  if (isSouthArrowWarp(behavior)) return 'down';
  if (isNorthArrowWarp(behavior)) return 'up';
  if (isWestArrowWarp(behavior)) return 'left';
  if (isEastArrowWarp(behavior)) return 'right';
  return null;
}

export function isWarpBehavior(behavior: number): boolean {
  return isDoorBehavior(behavior) || isTeleportWarpBehavior(behavior) || isArrowWarpBehavior(behavior);
}

export function isTallGrassBehavior(behavior: number): boolean {
  return behavior === MB_TALL_GRASS;
}

export function isLongGrassBehavior(behavior: number): boolean {
  return behavior === MB_LONG_GRASS;
}

/**
 * Surfable water behaviors that allow using Surf
 * Based on pokeemerald MetatileBehavior_IsSurfableWaterOrUnderwater
 */
const SURFABLE_BEHAVIORS = new Set([
  MB_POND_WATER,
  MB_INTERIOR_DEEP_WATER,
  MB_DEEP_WATER,
  MB_WATERFALL,
  MB_OCEAN_WATER,
  MB_SOOTOPOLIS_DEEP_WATER,
  MB_NO_SURFACING,
  MB_SEAWEED,
  MB_SEAWEED_NO_SURFACING,
  MB_WATER_DOOR,
  MB_WATER_SOUTH_ARROW_WARP,
]);

export function isSurfableBehavior(behavior: number): boolean {
  return SURFABLE_BEHAVIORS.has(behavior);
}

/**
 * Water behaviors that block walking but don't allow surfing (shallow water)
 */
export function isShallowWaterBehavior(behavior: number): boolean {
  return behavior === MB_SHALLOW_WATER;
}

/**
 * Puddle behavior - causes splash effect when walking through
 * Based on pokeemerald MetatileBehavior_IsPuddle (metatile_behavior.c)
 */
export function isPuddleBehavior(behavior: number): boolean {
  return behavior === MB_PUDDLE;
}

/**
 * Has ripples behavior - causes water ripple effect when moving on water
 * Based on pokeemerald MetatileBehavior_HasRipples (metatile_behavior.c)
 * Triggers for: MB_POND_WATER, MB_PUDDLE, MB_SOOTOPOLIS_DEEP_WATER
 */
export function hasRipplesBehavior(behavior: number): boolean {
  return behavior === MB_POND_WATER ||
         behavior === MB_PUDDLE ||
         behavior === MB_SOOTOPOLIS_DEEP_WATER;
}
