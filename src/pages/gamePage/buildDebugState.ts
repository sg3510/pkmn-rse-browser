import type {
  DebugState,
  PlayerDebugInfo,
  ObjectsAtTileInfo,
} from '../../components/debug';
import type { ItemBallObject, NPCObject } from '../../types/objectEvents';

export interface BuildDebugStateParams {
  player: PlayerDebugInfo | null;
  visibleNPCs: NPCObject[];
  allNPCs?: NPCObject[];
  visibleItems: ItemBallObject[];
  totalNPCCount: number;
  totalItemCount: number;
  offscreenDespawnedNpcIds?: string[];
}

function getObjectsAtTile(
  npcs: NPCObject[],
  items: ItemBallObject[],
  tileX: number,
  tileY: number
): ObjectsAtTileInfo {
  const tileNPCs = npcs.filter((npc) => npc.tileX === tileX && npc.tileY === tileY);
  const tileItems = items.filter((item) => item.tileX === tileX && item.tileY === tileY);

  return {
    tileX,
    tileY,
    npcs: tileNPCs,
    items: tileItems,
    hasCollision: tileNPCs.length > 0 || tileItems.length > 0,
  };
}

function getFacingOffset(direction: string): { dx: number; dy: number } {
  switch (direction) {
    case 'up':
      return { dx: 0, dy: -1 };
    case 'down':
      return { dx: 0, dy: 1 };
    case 'left':
      return { dx: -1, dy: 0 };
    case 'right':
      return { dx: 1, dy: 0 };
    default:
      return { dx: 0, dy: 1 };
  }
}

export function buildDebugState(params: BuildDebugStateParams): DebugState {
  const {
    player,
    visibleNPCs,
    allNPCs,
    visibleItems,
    totalNPCCount,
    totalItemCount,
    offscreenDespawnedNpcIds,
  } = params;

  const playerTileX = player?.tileX ?? 0;
  const playerTileY = player?.tileY ?? 0;
  const facing = getFacingOffset(player?.direction ?? 'down');

  return {
    player,
    tile: null,
    objectsAtPlayerTile: getObjectsAtTile(visibleNPCs, visibleItems, playerTileX, playerTileY),
    objectsAtFacingTile: getObjectsAtTile(visibleNPCs, visibleItems, playerTileX + facing.dx, playerTileY + facing.dy),
    adjacentObjects: {
      north: getObjectsAtTile(visibleNPCs, visibleItems, playerTileX, playerTileY - 1),
      south: getObjectsAtTile(visibleNPCs, visibleItems, playerTileX, playerTileY + 1),
      east: getObjectsAtTile(visibleNPCs, visibleItems, playerTileX + 1, playerTileY),
      west: getObjectsAtTile(visibleNPCs, visibleItems, playerTileX - 1, playerTileY),
    },
    allVisibleNPCs: visibleNPCs,
    allVisibleItems: visibleItems,
    totalNPCCount,
    totalItemCount,
    allNPCs: allNPCs ?? visibleNPCs,
    offscreenDespawnedNpcIds: offscreenDespawnedNpcIds ?? [],
  };
}
