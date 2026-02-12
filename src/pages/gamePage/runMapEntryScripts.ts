/**
 * Shared utility that executes ON_LOAD, ON_TRANSITION, and ON_WARP_INTO
 * map scripts after a warp (door warp or scripted warp).
 *
 * Extracted from performWarpTransition.ts so both warp code paths
 * (door warps and scripted warps) can run map entry scripts.
 */

import { getMapScripts, getCommonScripts } from '../../data/scripts';
import type { MapScriptData } from '../../data/scripts/types';
import { ScriptRunner } from '../../scripting/ScriptRunner';
import type { StoryScriptContext } from '../../game/NewGameFlow';
import { saveManager } from '../../save/SaveManager';
import { gameVariables } from '../../game/GameVariables';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { PlayerController } from '../../game/PlayerController';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';

interface MutableRef<T> {
  current: T;
}

export interface RunMapEntryScriptsParams {
  currentMapId: string;
  snapshot: WorldSnapshot;
  objectEventManager: ObjectEventManager;
  player: PlayerController;
  playerHiddenRef: MutableRef<boolean>;
  pipeline: WebGLRenderPipeline;
  mapScriptCache?: Map<string, MapScriptData | null>;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number) => void;
}

export async function runMapEntryScripts(params: RunMapEntryScriptsParams): Promise<void> {
  const {
    currentMapId,
    snapshot,
    objectEventManager,
    player,
    playerHiddenRef,
    pipeline,
    mapScriptCache,
    setMapMetatile,
  } = params;

  try {
    const [mapData, commonData] = await Promise.all([
      getMapScripts(currentMapId),
      getCommonScripts(),
    ]);

    // Pre-populate the frame table cache so ON_FRAME scripts fire on the first render frame
    if (mapScriptCache) {
      mapScriptCache.set(currentMapId, mapData);
    }

    if (!mapData) return;

    // C parity: script commands like setobjectxy use map-local coordinates.
    const mapLocalToWorld = (mapId: string, tileX: number, tileY: number): { x: number; y: number } => {
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

    const scriptCtx: StoryScriptContext = {
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
      moveNpc: async (_mapId, localId, direction, mode) => {
        if (mode === 'face') {
          objectEventManager.setNPCDirectionByLocalId(_mapId, localId, direction);
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
        ? (mapId, tileX, tileY, metatileId) => {
            setMapMetatile(mapId, tileX, tileY, metatileId);
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
      getParty: () => [],
      setPlayerDirection: (dir) => {
        player.dir = dir;
      },
    };

    const runner = new ScriptRunner(
      { mapData, commonData },
      scriptCtx,
      currentMapId,
    );

    // ON_LOAD: metatile changes (moving boxes, etc.)
    if (mapData.mapScripts.onLoad) {
      await runner.execute(mapData.mapScripts.onLoad);
      pipeline.invalidate();
      console.log(`[WARP] ON_LOAD script executed for ${currentMapId}`);
    }

    // ON_TRANSITION: NPC repositioning
    if (mapData.mapScripts.onTransition) {
      await runner.execute(mapData.mapScripts.onTransition);
      console.log(`[WARP] ON_TRANSITION script executed for ${currentMapId}`);
    }

    // ON_WARP_INTO: one-shot setup scripts (check var == value)
    if (mapData.mapScripts.onWarpInto?.length) {
      for (const entry of mapData.mapScripts.onWarpInto) {
        if (gameVariables.getVar(entry.var) === entry.value) {
          await runner.execute(entry.script);
          console.log(`[WARP] ON_WARP_INTO script executed: ${entry.script}`);
        }
      }
    }

    // ON_RESUME: persistent setup scripts (step callbacks, etc.)
    // In the GBA, ON_RESUME fires at end of initial map load AND on return to field.
    // This re-activates per-step callbacks (e.g. Sootopolis ice).
    if (mapData.mapScripts.onResume) {
      await runner.execute(mapData.mapScripts.onResume);
      console.log(`[WARP] ON_RESUME script executed for ${currentMapId}`);
    }
  } catch (err) {
    console.warn('[WARP] Map entry script failed:', err);
  }
}
