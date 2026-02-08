/**
 * Sprite priority table from pokeemerald's sElevationToPriority
 * Source: public/pokeemerald/src/event_object_movement.c line 7729
 *
 * Index = elevation (0-15). Lower number = higher priority (drawn on top).
 *
 * GBA Priority System:
 * - Priority 0: Above all BG layers (elevation 13-14)
 * - Priority 1: Same as BG1 (elevated objects, bridges) - elevation 4,6,8,10,12
 * - Priority 2: Same as BG2 (ground level) - elevation 0-3,5,7,9,11,15
 *
 * When sprite priority == BG priority, sprite draws ON TOP of that BG layer.
 */
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
 * - 'normal' (P2): Render with player, between TopBelow and TopAbove
 * - 'high' (P0/P1): Render AFTER TopAbove (above BG1, which has priority 1)
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
  if (priority <= 1) return 'high';
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

/**
 * NPC render layer classification.
 * Used by both Canvas2D and WebGL renderers for consistent layer ordering.
 */
export type NPCRenderLayer = 'behindBridge' | 'withPlayer' | 'aboveAll';

/**
 * Determine which render layer an NPC should be in based on player and NPC elevations.
 *
 * This implements the GBA priority comparison:
 * - P0/P1 NPCs (elevation 4,6,8,10,12,13,14) render above topAbove (BG1)
 * - P2/P3 NPCs render behind bridges ONLY when player is at higher priority
 * - Otherwise P2 NPCs render with player (Y-sorted, between TopBelow and TopAbove)
 *
 * @param npcElevation NPC's elevation (0-15)
 * @param playerElevation Player's current elevation (0-15)
 * @returns Which layer the NPC should render in
 */
export function getNPCRenderLayer(
  npcElevation: number,
  playerElevation: number
): NPCRenderLayer {
  const npcPriority = getSpritePriorityForElevation(npcElevation);
  const playerPriority = getSpritePriorityForElevation(playerElevation);

  // P0 and P1 NPCs render above all BG layers (above topAbove/BG1).
  // On GBA, sprites with priority <= BG priority render ON TOP of that BG.
  // BG1 (topAbove) has priority 1, so P0 and P1 sprites are above it.
  if (npcPriority <= 1) return 'aboveAll';

  // Low priority NPCs (P2/P3) render behind bridges only when player is at higher priority
  // This prevents NPCs from incorrectly appearing behind distant bridge tiles
  if (npcPriority >= 2 && playerPriority < npcPriority) return 'behindBridge';

  // Otherwise, render with player (Y-sorted)
  return 'withPlayer';
}
