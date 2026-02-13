import type { PlayerController } from '../../game/PlayerController';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { NPCObject } from '../../types/objectEvents';
import { isCollisionPassable } from '../../utils/mapLoader';
import {
  MB_DEEP_SAND,
  MB_SAND,
  MB_SECRET_BASE_WALL,
  MB_IMPASSABLE_EAST,
  MB_IMPASSABLE_SOUTH_AND_NORTH,
  MB_IMPASSABLE_WEST_AND_EAST,
  MB_JUMP_SOUTHWEST,
  isDoorBehavior,
  isSurfableBehavior,
} from '../../utils/metatileBehaviors';
import type { MutableRef } from './types';


/**
 * Creates NPC movement provider callbacks that close over player/OEM refs.
 * These provide collision, elevation, and position data to the NPC movement system.
 */
export function createNPCMovementProviders(
  playerRef: MutableRef<PlayerController | null>,
  objectEventManagerRef: MutableRef<ObjectEventManager>
) {
  return {
    isTileWalkable: (x: number, y: number): boolean => {
      const player = playerRef.current;
      const resolver = player?.getTileResolver();
      const resolved = resolver?.(x, y);
      if (!resolved) return false;

      const { attributes, mapTile } = resolved;
      if (!attributes) return true;

      const behavior = attributes.behavior;
      const collision = mapTile.collision;

      // Sand tiles are always walkable (if no object collision, which NPCs handle separately).
      if (behavior === MB_SAND || behavior === MB_DEEP_SAND) return true;

      // Block tiles with impassable collision bits (doors are handled separately for player, but still walkable).
      if (!isCollisionPassable(collision) && !isDoorBehavior(behavior)) return false;

      // Hard-blocked behaviors.
      if (behavior === MB_SECRET_BASE_WALL) return false;

      // NPCs can't surf, so block surfable water tiles.
      if (isSurfableBehavior(behavior)) return false;

      // Directionally impassable + ledge/jump tiles are blocked for NPCs.
      if (behavior >= MB_IMPASSABLE_EAST && behavior <= MB_JUMP_SOUTHWEST) return false;
      if (behavior === MB_IMPASSABLE_SOUTH_AND_NORTH || behavior === MB_IMPASSABLE_WEST_AND_EAST) return false;

      return true;
    },
    getTileElevation: (x: number, y: number): number => {
      const player = playerRef.current;
      const resolver = player?.getTileResolver();
      const resolved = resolver?.(x, y);
      return resolved?.mapTile?.elevation ?? 0;
    },
    getAllNPCs: (): NPCObject[] => {
      return objectEventManagerRef.current.getVisibleNPCs();
    },
    hasPlayerAt: (x: number, y: number): boolean => {
      const player = playerRef.current;
      if (!player) return false;
      return player.tileX === x && player.tileY === y;
    },
    getTileBehavior: (x: number, y: number): number | undefined => {
      const player = playerRef.current;
      const resolver = player?.getTileResolver();
      const resolved = resolver?.(x, y);
      return resolved?.attributes?.behavior;
    },
    getPlayerState: () => {
      const player = playerRef.current;
      if (!player) return null;
      const destination = player.getDestinationTile();
      return {
        tileX: player.tileX,
        tileY: player.tileY,
        destTileX: destination.x,
        destTileY: destination.y,
        direction: player.getFacingDirection(),
        isMoving: player.isMoving,
      };
    },
    get fieldEffectManager() {
      return playerRef.current?.getGrassEffectManager();
    },
  };
}
