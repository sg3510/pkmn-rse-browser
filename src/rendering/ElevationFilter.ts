/**
 * ElevationFilter - Determines which tiles go in topBelow vs topAbove
 *
 * Based on pokeemerald's sElevationToPriority (event_object_movement.c:389):
 * - Elevation 0-3, 5, 7, 9, 11, 15: Priority 2 (below BG1)
 * - Elevation 4, 6, 8, 10, 12: Priority 1 (above BG1)
 * - Elevation 13, 14: Priority 0 (highest, always above)
 *
 * Bridge tiles use special elevations for multi-level rendering:
 * - Walking under a bridge: player at elevation 3 (priority 2)
 * - Walking on a bridge: player at elevation 4 (priority 1)
 *
 * This ensures the player renders correctly relative to bridges and other
 * elevation-based terrain.
 *
 * Reference: pokeemerald/src/event_object_movement.c
 */

import { getSpritePriorityForElevation } from '../utils/elevationPriority';
import type { MapTileData } from '../utils/mapLoader';
import type { ElevationFilterFn, IsVerticalObjectFn } from './types';

/**
 * Filter results with separate functions for below/above passes
 */
export interface ElevationFilterResult {
  /** Filter for topBelow pass (renders behind player) */
  below: ElevationFilterFn;
  /** Filter for topAbove pass (renders in front of player) */
  above: ElevationFilterFn;
}

/**
 * ElevationFilter - Creates filter functions for elevation-based rendering
 *
 * The GBA renders tiles in layers based on sprite priority:
 * - Priority 2 sprites render below BG1 (behind top layer tiles)
 * - Priority 1 sprites render above most BG1 tiles
 * - Priority 0 sprites render above all BG1 tiles
 *
 * This class creates filter functions that split the top layer into
 * "below player" and "above player" passes based on the player's
 * current elevation.
 */
export class ElevationFilter {
  private isVerticalObject: IsVerticalObjectFn;

  /**
   * Create an ElevationFilter
   *
   * @param isVerticalObject - Function to check if a tile is a vertical object
   *                           (trees, poles, etc. that always render above player)
   */
  constructor(isVerticalObject: IsVerticalObjectFn) {
    this.isVerticalObject = isVerticalObject;
  }

  /**
   * Create filter functions for below/above player passes
   *
   * @param playerElevation - The player's current elevation (0-15)
   * @returns Object with `below` and `above` filter functions
   */
  createFilter(playerElevation: number): ElevationFilterResult {
    const playerPriority = getSpritePriorityForElevation(playerElevation);
    const playerAboveTopLayer = playerPriority <= 1; // priority 0/1 draws above BG1

    return {
      below: (mapTile: MapTileData, tileX: number, tileY: number) => {
        // Vertical objects (trees, poles) always go to topAbove
        if (this.isVerticalObject(tileX, tileY)) {
          return false;
        }

        // Player below top layer -> nothing in topBelow
        // (all top tiles render above the player)
        if (!playerAboveTopLayer) {
          return false;
        }

        // Same elevation + blocked -> goes to topAbove
        // (blocked tiles at player's elevation should render in front)
        if (mapTile.elevation === playerElevation && mapTile.collision === 1) {
          return false;
        }

        // All other cases: render in topBelow (behind player)
        return true;
      },

      above: (mapTile: MapTileData, tileX: number, tileY: number) => {
        // Vertical objects always render above player
        if (this.isVerticalObject(tileX, tileY)) {
          return true;
        }

        // Player above top layer
        if (playerAboveTopLayer) {
          // Only blocked tiles at same elevation render above
          if (mapTile.elevation === playerElevation && mapTile.collision === 1) {
            return true;
          }
          return false;
        }

        // Player below top layer -> all top tiles render above
        return true;
      },
    };
  }

  /**
   * Update the vertical object checker function
   *
   * @param fn - New function to check for vertical objects
   */
  setVerticalObjectChecker(fn: IsVerticalObjectFn): void {
    this.isVerticalObject = fn;
  }
}

/**
 * Create a simple elevation filter without vertical object checking
 *
 * Useful for testing or when vertical objects aren't relevant.
 *
 * @param playerElevation - The player's current elevation
 * @returns Filter result with below/above functions
 */
export function createSimpleElevationFilter(playerElevation: number): ElevationFilterResult {
  const playerPriority = getSpritePriorityForElevation(playerElevation);
  const playerAboveTopLayer = playerPriority <= 1;

  return {
    below: (mapTile: MapTileData) => {
      if (!playerAboveTopLayer) return false;
      if (mapTile.elevation === playerElevation && mapTile.collision === 1) return false;
      return true;
    },
    above: (mapTile: MapTileData) => {
      if (playerAboveTopLayer) {
        if (mapTile.elevation === playerElevation && mapTile.collision === 1) return true;
        return false;
      }
      return true;
    },
  };
}
