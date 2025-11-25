// Sprite priority table from pokeemerald's sElevationToPriority (event_object_movement.c)
// Index = elevation (0-15). Lower number = higher priority (drawn above BG).
export const ELEVATION_TO_PRIORITY: number[] = [
  2, // 0
  2, // 1
  2, // 2
  2, // 3
  1, // 4
  2, // 5
  1, // 6
  2, // 7
  1, // 8
  2, // 9
  1, // 10
  2, // 11
  1, // 12
  0, // 13
  0, // 14
  2, // 15
];

/**
 * Return the sprite priority for a given elevation.
 * Matches GBA behavior: lower values render above higher values.
 */
export function getSpritePriorityForElevation(elevation: number): number {
  if (elevation < 0) return 2;
  return ELEVATION_TO_PRIORITY[elevation] ?? 2;
}
