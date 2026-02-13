import type { WorldSnapshot } from '../../WorldManager';
import type { SetMapMetatileLocalFn } from '../metatile/mapMetatileUtils';
import { gameVariables, GAME_VARS } from '../../GameVariables';
import {
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID,
  METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID,
  METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM,
} from '../../TruckSequenceRunner';

/**
 * Temporary compatibility shim while map-entry ordering is converging to C.
 * Only applies truck bootstrap metatiles for first-frame parity.
 * Returns true if any tiles were changed.
 */
export function applyTruckOnLoadMetatileCompatibility(
  snapshot: WorldSnapshot | null,
  setMapMetatile: SetMapMetatileLocalFn
): boolean {
  if (!snapshot) return false;

  const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
  const truckMapId = 'MAP_INSIDE_OF_TRUCK';
  const truckLoaded = snapshot.maps.some((map) => map.entry.id === truckMapId);
  if (!truckLoaded) return false;

  if (introState >= 0 && introState <= 2) {
    return [
      setMapMetatile(truckMapId, 4, 1, METATILE_INSIDE_TRUCK_DOOR_CLOSED_TOP),
      setMapMetatile(truckMapId, 4, 2, METATILE_INSIDE_TRUCK_DOOR_CLOSED_MID),
      setMapMetatile(truckMapId, 4, 3, METATILE_INSIDE_TRUCK_DOOR_CLOSED_BOTTOM),
    ].some(Boolean);
  }

  return [
    setMapMetatile(truckMapId, 4, 1, METATILE_INSIDE_TRUCK_EXIT_LIGHT_TOP),
    setMapMetatile(truckMapId, 4, 2, METATILE_INSIDE_TRUCK_EXIT_LIGHT_MID),
    setMapMetatile(truckMapId, 4, 3, METATILE_INSIDE_TRUCK_EXIT_LIGHT_BOTTOM),
  ].some(Boolean);
}
