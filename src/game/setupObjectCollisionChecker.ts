/**
 * setupObjectCollisionChecker
 *
 * Shared utility to configure object collision checking on a PlayerController.
 * Used by both WebGLMapPage and MapRenderer to avoid code duplication.
 *
 * The collision checker prevents the player from walking into NPCs, item balls,
 * and other object events that block movement.
 */

import type { PlayerController } from './PlayerController';
import type { ObjectEventManager } from './ObjectEventManager';

/**
 * Set up object collision checking for a player.
 *
 * This creates a collision checker function that queries the ObjectEventManager
 * for any blocking objects at the given tile position, respecting elevation.
 *
 * @param player - The PlayerController to configure
 * @param objectManager - The ObjectEventManager to query for collisions
 */
export function setupObjectCollisionChecker(
  player: PlayerController,
  objectManager: ObjectEventManager
): void {
  player.setObjectCollisionChecker((tileX, tileY) => {
    const playerElev = player.getCurrentElevation();
    return objectManager.hasObjectCollisionAt(tileX, tileY, playerElev);
  });
}

/**
 * Clear the object collision checker from a player.
 *
 * Call this when disposing/resetting the player to avoid stale references.
 *
 * @param player - The PlayerController to clear
 */
export function clearObjectCollisionChecker(player: PlayerController): void {
  player.setObjectCollisionChecker(null);
}
