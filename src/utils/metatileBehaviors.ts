// Behavior constants derived from public/pokeemerald/include/constants/metatile_behaviors.h
export const MB_POND_WATER = 16;
export const MB_PUDDLE = 22;
export const MB_UNUSED_SOOTOPOLIS_DEEP_WATER_2 = 26;
export const MB_ICE = 32;
export const MB_SOOTOPOLIS_DEEP_WATER = 20;
export const MB_REFLECTION_UNDER_BRIDGE = 43;
export const MB_SHALLOW_WATER = 23;

export const MB_BRIDGE_OVER_OCEAN = 112;
export const MB_BRIDGE_OVER_POND_LOW = 113;
export const MB_BRIDGE_OVER_POND_MED = 114;
export const MB_BRIDGE_OVER_POND_HIGH = 115;
export const MB_BRIDGE_OVER_POND_MED_EDGE_1 = 122;
export const MB_BRIDGE_OVER_POND_MED_EDGE_2 = 123;
export const MB_BRIDGE_OVER_POND_HIGH_EDGE_1 = 124;
export const MB_BRIDGE_OVER_POND_HIGH_EDGE_2 = 125;
export const MB_BIKE_BRIDGE_OVER_BARRIER = 127;

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
