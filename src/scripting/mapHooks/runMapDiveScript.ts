import { getCommonScripts, getMapScripts } from '../../data/scripts';
import type { MapScriptData } from '../../data/scripts/types';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { PlayerController } from '../../game/PlayerController';
import type { WorldSnapshot } from '../../game/WorldManager';
import { ScriptRunner, type ScriptRuntimeServices } from '../../scripting/ScriptRunner';
import { createMapScriptRunnerContext } from './createMapScriptRunnerContext';

type MutableRef<T> = {
  current: T;
};

export interface RunMapDiveScriptParams {
  mapId: string;
  snapshot: WorldSnapshot;
  objectEventManager: ObjectEventManager;
  player: PlayerController;
  playerHiddenRef: MutableRef<boolean>;
  mapScriptCache?: Map<string, MapScriptData | null>;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => void;
  scriptRuntimeServices?: ScriptRuntimeServices;
  setFlashLevel?: (level: number) => void;
  animateFlashLevel?: (level: number) => Promise<void>;
}

export async function runMapDiveScript(params: RunMapDiveScriptParams): Promise<boolean> {
  const {
    mapId,
    snapshot,
    objectEventManager,
    player,
    playerHiddenRef,
    mapScriptCache,
    setMapMetatile,
    scriptRuntimeServices,
    setFlashLevel,
    animateFlashLevel,
  } = params;

  const [mapData, commonData] = await Promise.all([
    getMapScripts(mapId),
    getCommonScripts(),
  ]);

  if (mapScriptCache) {
    mapScriptCache.set(mapId, mapData);
  }

  const onDiveScript = mapData?.mapScripts.onDive;
  if (!mapData || !onDiveScript) return false;

  const scriptCtx = createMapScriptRunnerContext({
    currentMapId: mapId,
    snapshot,
    objectEventManager,
    player,
    playerHiddenRef,
    setMapMetatile,
    setFlashLevel,
    animateFlashLevel,
  });

  const runner = new ScriptRunner(
    { mapData, commonData },
    scriptCtx,
    mapId,
    scriptRuntimeServices
  );
  return runner.execute(onDiveScript);
}
