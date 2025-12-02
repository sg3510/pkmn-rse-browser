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

/**
 * Priority layer classification for GBA-accurate rendering.
 *
 * Sprites are rendered at different layers based on their priority:
 * - 'low' (P2/P3): Render BEFORE TopBelow (behind all top layer tiles like bridges)
 * - 'normal' (P1): Render with player, between TopBelow and TopAbove
 * - 'high' (P0): Render AFTER TopAbove (above all BG layers)
 */
export type PriorityLayer = 'low' | 'normal' | 'high';

/**
 * Get the render layer for a given elevation.
 * Used by both Canvas2D and WebGL renderers for consistent layer ordering.
 *
 * @param elevation Object elevation (0-15)
 * @returns Which layer the object should render in
 */
export function getPriorityLayer(elevation: number): PriorityLayer {
  const priority = getSpritePriorityForElevation(elevation);
  if (priority === 0) return 'high';
  if (priority === 1) return 'normal';
  return 'low';
}

/**
 * Check if an object should render in the low priority layer (behind bridges).
 * Convenience function for filtering objects.
 */
export function isLowPriority(elevation: number): boolean {
  return getSpritePriorityForElevation(elevation) >= 2;
}

/**
 * Check if an object should render in the high priority layer (above all BG).
 * Convenience function for filtering objects.
 */
export function isHighPriority(elevation: number): boolean {
  return getSpritePriorityForElevation(elevation) === 0;
}
