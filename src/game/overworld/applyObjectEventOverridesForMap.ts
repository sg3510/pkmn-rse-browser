import type { WorldSnapshot } from '../WorldManager';
import type { ObjectEventManager } from '../ObjectEventManager';
import { saveStateStore } from '../../save/SaveStateStore';

export function applyObjectEventOverridesForMap(
  mapId: string,
  snapshot: WorldSnapshot,
  objectEventManager: ObjectEventManager
): number {
  const map = snapshot.maps.find((entry) => entry.entry.id === mapId);
  if (!map) {
    return 0;
  }

  const overrides = saveStateStore.getObjectEventOverridesForMap(mapId);
  let appliedCount = 0;
  for (const override of overrides) {
    const worldX = map.offsetX + override.x;
    const worldY = map.offsetY + override.y;
    const applied = objectEventManager.setNPCPositionByLocalId(
      mapId,
      override.localId,
      worldX,
      worldY,
      { updateInitialPosition: true }
    );
    if (applied) {
      appliedCount++;
    }
  }

  return appliedCount;
}
