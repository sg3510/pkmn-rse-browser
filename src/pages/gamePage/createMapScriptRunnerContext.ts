import type { StoryScriptContext } from '../../game/NewGameFlow';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { PlayerController } from '../../game/PlayerController';
import { saveManager } from '../../save/SaveManager';

type MutableRef<T> = {
  current: T;
};

interface CreateMapScriptRunnerContextParams {
  currentMapId: string;
  snapshot: WorldSnapshot;
  objectEventManager: ObjectEventManager;
  player: PlayerController;
  playerHiddenRef: MutableRef<boolean>;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => void;
  lastUsedWarpMapType?: string | null;
}

export function createMapScriptRunnerContext(
  params: CreateMapScriptRunnerContextParams
): StoryScriptContext {
  const {
    currentMapId,
    snapshot,
    objectEventManager,
    player,
    playerHiddenRef,
    setMapMetatile,
    lastUsedWarpMapType = null,
  } = params;

  const mapLocalToWorld = (
    mapId: string,
    tileX: number,
    tileY: number
  ): { x: number; y: number } => {
    const map = snapshot.maps.find((m) => m.entry.id === mapId);
    if (!map) {
      return { x: tileX, y: tileY };
    }
    return {
      x: map.offsetX + tileX,
      y: map.offsetY + tileY,
    };
  };

  const isPlayerLocalId = (localId: string): boolean =>
    localId === 'LOCALID_PLAYER' || localId === '255';

  return {
    showMessage: async () => {},
    showChoice: async () => null,
    getPlayerGender: () => saveManager.getProfile().gender,
    getPlayerName: () => saveManager.getPlayerName(),
    hasPartyPokemon: () => saveManager.hasParty(),
    setParty: () => {},
    startFirstBattle: async () => {},
    queueWarp: () => {},
    forcePlayerStep: () => {},
    delayFrames: async () => {},
    movePlayer: async () => {},
    moveNpc: async (mapId, localId, direction, mode) => {
      if (mode === 'face') {
        objectEventManager.setNPCDirectionByLocalId(mapId, localId, direction);
      }
    },
    faceNpcToPlayer: () => {},
    setNpcPosition: (mapId, localId, tileX, tileY) => {
      const worldPos = mapLocalToWorld(mapId, tileX, tileY);
      if (isPlayerLocalId(localId)) {
        player.setPosition(worldPos.x, worldPos.y);
        return;
      }
      objectEventManager.setNPCPositionByLocalId(mapId, localId, worldPos.x, worldPos.y);
    },
    setNpcVisible: (mapId, localId, visible, persistent) => {
      objectEventManager.setNPCVisibilityByLocalId(mapId, localId, visible, persistent);
    },
    playDoorAnimation: async () => {},
    setPlayerVisible: (visible) => {
      playerHiddenRef.current = !visible;
    },
    setMapMetatile: setMapMetatile
      ? (mapId, tileX, tileY, metatileId, collision?) => {
          setMapMetatile(mapId, tileX, tileY, metatileId, collision);
        }
      : undefined,
    getMapMetatile: (mapId, tileX, tileY) => {
      const map = snapshot.maps.find((m) => m.entry.id === mapId);
      if (!map) return 0;
      if (tileX < 0 || tileY < 0 || tileX >= map.mapData.width || tileY >= map.mapData.height) return 0;
      const index = tileY * map.mapData.width + tileX;
      const tile = map.mapData.layout[index];
      return tile?.metatileId ?? 0;
    },
    setNpcMovementType: (mapId, localId, movementTypeRaw) => {
      objectEventManager.setNPCMovementTypeByLocalId(mapId, localId, movementTypeRaw);
    },
    showYesNo: async () => false,
    getParty: () => saveManager.getParty(),
    setPlayerDirection: (dir) => {
      player.dir = dir;
    },
    getPlayerLocalPosition: () => {
      const map = snapshot.maps.find((m) => m.entry.id === currentMapId);
      if (!map) return null;
      return { x: player.tileX - map.offsetX, y: player.tileY - map.offsetY };
    },
    getLastUsedWarpMapType: () => lastUsedWarpMapType,
  };
}
