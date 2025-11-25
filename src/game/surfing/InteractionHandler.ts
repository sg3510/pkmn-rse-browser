/**
 * InteractionHandler - Handles surf initiation and dismount validation
 * Detects surfable water tiles and validates player can surf/dismount
 */

import type { TileResolver } from '../PlayerController';
import type { SurfableCheckResult } from './types';
import { isSurfableBehavior } from '../../utils/metatileBehaviors';

export class InteractionHandler {
  /**
   * Check if player can initiate surf at current location
   * @param playerTileX Player's current tile X
   * @param playerTileY Player's current tile Y
   * @param facingDirection Direction player is facing
   * @param playerElevation Player's current elevation
   * @param tileResolver Tile resolution callback
   * @returns Result indicating if surfing can be initiated and why
   */
  public checkCanSurf(
    playerTileX: number,
    playerTileY: number,
    facingDirection: 'up' | 'down' | 'left' | 'right',
    playerElevation: number,
    tileResolver?: TileResolver
  ): SurfableCheckResult {
    if (!tileResolver) {
      return {
        canSurf: false,
        reason: 'No tile resolver available',
        targetX: playerTileX,
        targetY: playerTileY,
        targetBehavior: 0,
      };
    }

    // Get tile player is facing
    let targetX = playerTileX;
    let targetY = playerTileY;

    switch (facingDirection) {
      case 'up':
        targetY -= 1;
        break;
      case 'down':
        targetY += 1;
        break;
      case 'left':
        targetX -= 1;
        break;
      case 'right':
        targetX += 1;
        break;
    }

    const targetTile = tileResolver(targetX, targetY);

    if (!targetTile) {
      return {
        canSurf: false,
        reason: 'Cannot resolve target tile',
        targetX,
        targetY,
        targetBehavior: 0,
      };
    }

    const targetBehavior = targetTile.attributes?.behavior ?? 0;

    // Check 1: Target must be surfable water
    if (!isSurfableBehavior(targetBehavior)) {
      return {
        canSurf: false,
        reason: 'Target tile is not surfable water',
        targetX,
        targetY,
        targetBehavior,
      };
    }

    // Check 2: Player must be at elevation 3 (land level)
    if (playerElevation !== 3) {
      return {
        canSurf: false,
        reason: `Player must be at elevation 3 (current: ${playerElevation})`,
        targetX,
        targetY,
        targetBehavior,
      };
    }

    // Check 3: Target must have different elevation (water is typically 0-2)
    const targetElevation = targetTile.mapTile.elevation;
    if (targetElevation === playerElevation) {
      return {
        canSurf: false,
        reason: `Target must have different elevation (P:${playerElevation}, T:${targetElevation})`,
        targetX,
        targetY,
        targetBehavior,
      };
    }

    // All checks passed!
    return {
      canSurf: true,
      targetX,
      targetY,
      targetBehavior,
    };
  }

  /**
   * Check if player can dismount from surfing to target tile
   * @param targetX Target tile X
   * @param targetY Target tile Y
   * @param tileResolver Tile resolution callback
   * @returns True if dismounting is valid
   */
  public checkCanDismount(
    targetX: number,
    targetY: number,
    tileResolver?: TileResolver
  ): boolean {
    if (!tileResolver) {
      return false;
    }

    const targetTile = tileResolver(targetX, targetY);
    if (!targetTile) {
      return false;
    }

    const targetBehavior = targetTile.attributes?.behavior ?? 0;
    const targetElevation = targetTile.mapTile.elevation;
    const collision = targetTile.mapTile.collision;

    // Can dismount to land (elevation 3) that isn't water and is passable
    if (targetElevation !== 3) {
      return false;
    }

    // Cannot dismount to surfable water
    if (isSurfableBehavior(targetBehavior)) {
      return false;
    }

    // Check if tile is passable (collision 0)
    return collision === 0;
  }

  /**
   * Check if a tile is surfable water (for movement while surfing)
   */
  public isTileSurfable(
    tileX: number,
    tileY: number,
    tileResolver?: TileResolver
  ): boolean {
    if (!tileResolver) {
      return false;
    }

    const tile = tileResolver(tileX, tileY);
    if (!tile) {
      return false;
    }

    const behavior = tile.attributes?.behavior ?? 0;
    return isSurfableBehavior(behavior);
  }
}
