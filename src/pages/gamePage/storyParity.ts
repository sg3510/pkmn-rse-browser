import type { WorldSnapshot } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import { gameVariables, GAME_VARS } from '../../game/GameVariables';
import { saveManager } from '../../save/SaveManager';
import type { SetMapMetatileLocalFn } from './mapMetatileUtils';
import {
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM,
} from '../../game/TruckSequenceRunner';

// C reference: public/pokeemerald/include/constants/metatile_labels.h
const METATILE_HOUSE_MOVING_BOX_CLOSED = 0x268;
const METATILE_HOUSE_MOVING_BOX_OPEN = 0x270;

/**
 * Apply metatile overrides on map load to match C story state.
 * Handles truck door state and moving box positions based on VAR_LITTLEROOT_INTRO_STATE.
 * Returns true if any tiles were changed.
 */
export function applyStoryOnLoadMetatileParity(
  snapshot: WorldSnapshot | null,
  setMapMetatile: SetMapMetatileLocalFn
): boolean {
  if (!snapshot) return false;

  const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
  let changed = false;

  for (const map of snapshot.maps) {
    if (map.entry.id === 'MAP_INSIDE_OF_TRUCK') {
      if (introState >= 0 && introState <= 2) {
        // Effective C behavior at new-game start: ExecuteTruckSequence immediately
        // swaps the truck door to closed state before the intro runs.
        changed = setMapMetatile(map.entry.id, 4, 1, METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP) || changed;
        changed = setMapMetatile(map.entry.id, 4, 2, METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID) || changed;
        changed = setMapMetatile(map.entry.id, 4, 3, METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM) || changed;
      } else {
        changed = setMapMetatile(map.entry.id, 4, 1, METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP) || changed;
        changed = setMapMetatile(map.entry.id, 4, 2, METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID) || changed;
        changed = setMapMetatile(map.entry.id, 4, 3, METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM) || changed;
      }
    }

    if (
      (map.entry.id === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
      || map.entry.id === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F')
      && introState < 6
    ) {
      changed = setMapMetatile(map.entry.id, 5, 4, METATILE_HOUSE_MOVING_BOX_OPEN) || changed;
      changed = setMapMetatile(map.entry.id, 5, 2, METATILE_HOUSE_MOVING_BOX_CLOSED) || changed;
    }
  }

  return changed;
}

/**
 * Apply NPC position/direction overrides when transitioning to a map,
 * to match C story state for the Littleroot intro sequence.
 */
export function applyStoryTransitionObjectParityForMap(
  mapId: string,
  snapshot: WorldSnapshot | null,
  objectManager: ObjectEventManager
): void {
  const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
  const map = snapshot?.maps.find((m) => m.entry.id === mapId);
  const mapOffsetX = map?.offsetX ?? 0;
  const mapOffsetY = map?.offsetY ?? 0;
  const setNpcPositionLocal = (localId: string, localX: number, localY: number) => {
    objectManager.setNPCPositionByLocalId(mapId, localId, mapOffsetX + localX, mapOffsetY + localY);
  };

  if (mapId === 'MAP_LITTLEROOT_TOWN' && introState === 2) {
    setNpcPositionLocal('LOCALID_LITTLEROOT_MOM', 14, 8);
  }

  if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F' && introState === 3) {
    setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 9, 8);
    objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
  }

  if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F' && introState === 3) {
    setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 2, 8);
    objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
  }

  // State 5: Mom near stairs (waiting for player to go upstairs)
  if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F' && introState === 5) {
    setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 8, 4);
    objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
  }
  if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F' && introState === 5) {
    setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 2, 4);
    objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
  }

  // State 6: Mom near TV (watching for broadcast)
  if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F' && introState === 6) {
    setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 4, 5);
    objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
  }
  if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F' && introState === 6) {
    setNpcPositionLocal('LOCALID_PLAYERS_HOUSE_1F_MOM', 6, 5);
    objectManager.setNPCDirectionByLocalId(mapId, 'LOCALID_PLAYERS_HOUSE_1F_MOM', 'up');
  }

  // Rival's 2F: set ready to meet rival when player visits
  if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_2F'
      && gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE) < 2) {
    const isMale = saveManager.getProfile().gender === 0;
    if (isMale) gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE, 2);
  }
  if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F'
      && gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE) < 2) {
    const isMale = saveManager.getProfile().gender === 0;
    if (!isMale) gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE, 2);
  }
}
