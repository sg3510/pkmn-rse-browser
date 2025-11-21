// Behavior constants derived from public/pokeemerald/include/constants/metatile_behaviors.h
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
export const MB_NO_SURFACING = 24;
export const MB_SEAWEED = 33;
export const MB_SEAWEED_NO_SURFACING = 41;
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
export const MB_NON_ANIMATED_DOOR = 96;
export const MB_EAST_ARROW_WARP = 98;
export const MB_WEST_ARROW_WARP = 99;
export const MB_NORTH_ARROW_WARP = 100;
export const MB_SOUTH_ARROW_WARP = 101;
export const MB_AQUA_HIDEOUT_WARP = 103;
export const MB_LAVARIDGE_GYM_1F_WARP = 104;
export const MB_ANIMATED_DOOR = 105;
export const MB_WATER_DOOR = 108;
export const MB_WATER_SOUTH_ARROW_WARP = 109;
export const MB_DEEP_SOUTH_WARP = 110;

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

export type BridgeType = 'none' | 'pondLow' | 'pondMed' | 'pondHigh';

export function getBridgeTypeFromBehavior(behavior: number): BridgeType {
  if (behavior === MB_BRIDGE_OVER_POND_MED_EDGE_1 || behavior === MB_BRIDGE_OVER_POND_MED_EDGE_2) {
    return 'pondMed';
  }
  if (behavior === MB_BRIDGE_OVER_POND_HIGH_EDGE_1 || behavior === MB_BRIDGE_OVER_POND_HIGH_EDGE_2) {
    return 'pondHigh';
  }
  switch (behavior) {
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
 * Door behaviors that trigger door ANIMATIONS
 * 
 * IMPORTANT: MB_NON_ANIMATED_DOOR is NOT included here!
 * In the GBA code, MetatileBehavior_IsDoor (used for door animations) only checks:
 * - MB_ANIMATED_DOOR
 * - MB_PETALBURG_GYM_DOOR (same as MB_ANIMATED_DOOR)
 * 
 * MB_NON_ANIMATED_DOOR is used for stairs and other warps that should NOT animate.
 * See public/pokeemerald/src/metatile_behavior.c lines 228-234
 * and public/pokeemerald/src/field_door.c line 535
 */
const DOOR_BEHAVIORS = new Set<number>([
  MB_ANIMATED_DOOR, // 105 - Standard animated doors
  MB_WATER_DOOR,    // 108 - Water-based doors (also animated)
  // NOTE: MB_NON_ANIMATED_DOOR (96) is deliberately NOT included
  // It represents stairs and other non-animated warps
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
]);

export type CardinalDirection = 'up' | 'down' | 'left' | 'right';

export function isDoorBehavior(behavior: number): boolean {
  return DOOR_BEHAVIORS.has(behavior);
}

/**
 * Check if behavior is a non-animated door (stairs, etc.)
 * These should have exit movement but NO door animation
 */
export function isNonAnimatedDoorBehavior(behavior: number): boolean {
  return behavior === MB_NON_ANIMATED_DOOR || behavior === MB_DEEP_SOUTH_WARP;
}

/**
 * Check if behavior requires door exit sequence (with or without animation)
 * This includes both animated doors AND non-animated doors (stairs)
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

export function getArrowDirectionFromBehavior(behavior: number): CardinalDirection | null {
  switch (behavior) {
    case MB_SOUTH_ARROW_WARP:
    case MB_WATER_SOUTH_ARROW_WARP:
      return 'down';
    case MB_NORTH_ARROW_WARP:
      return 'up';
    case MB_WEST_ARROW_WARP:
      return 'left';
    case MB_EAST_ARROW_WARP:
      return 'right';
    default:
      return null;
  }
}

export function isWarpBehavior(behavior: number): boolean {
  return isDoorBehavior(behavior) || isTeleportWarpBehavior(behavior) || isArrowWarpBehavior(behavior);
}
