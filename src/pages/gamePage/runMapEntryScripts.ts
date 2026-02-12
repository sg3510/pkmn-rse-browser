/**
 * Shared utility that executes map-entry script hooks for both
 * warp transitions and camera seam transitions.
 *
 * Extracted from performWarpTransition.ts so both warp code paths
 * (door warps and scripted warps) can run map entry scripts.
 */

import { getMapScripts, getCommonScripts } from '../../data/scripts';
import type { MapScriptData } from '../../data/scripts/types';
import { ScriptRunner, type ScriptRuntimeServices } from '../../scripting/ScriptRunner';
import { gameVariables } from '../../game/GameVariables';
import { gameFlags } from '../../game/GameFlags';
import { stepCallbackManager } from '../../game/StepCallbackManager';
import { clearFixedHoleWarpTarget } from '../../game/FixedHoleWarp';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { PlayerController } from '../../game/PlayerController';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import { createMapScriptRunnerContext } from './createMapScriptRunnerContext';

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
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => void;
  scriptRuntimeServices?: ScriptRuntimeServices;
  mode?: 'warp' | 'camera-transition';
}

const TEMP_VAR_NAMES = [
  'VAR_TEMP_0',
  'VAR_TEMP_1',
  'VAR_TEMP_2',
  'VAR_TEMP_3',
  'VAR_TEMP_4',
  'VAR_TEMP_5',
  'VAR_TEMP_6',
  'VAR_TEMP_7',
  'VAR_TEMP_8',
  'VAR_TEMP_9',
  'VAR_TEMP_A',
  'VAR_TEMP_B',
  'VAR_TEMP_C',
  'VAR_TEMP_D',
  'VAR_TEMP_E',
  'VAR_TEMP_F',
] as const;

function resolveMapScriptCompareValue(value: number | string): number {
  if (typeof value === 'number') return value;
  if (value.startsWith('VAR_')) return gameVariables.getVar(value);

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function clearTempFieldEventDataLikeC(): void {
  // C parity: ClearTempFieldEventData() runs on map load/warp.
  for (const name of TEMP_VAR_NAMES) {
    gameVariables.setVar(name, 0);
  }

  gameFlags.clear('FLAG_SYS_ENC_UP_ITEM');
  gameFlags.clear('FLAG_SYS_ENC_DOWN_ITEM');
  gameFlags.clear('FLAG_SYS_USE_STRENGTH');
  gameFlags.clear('FLAG_SYS_CTRL_OBJ_DELETE');
  gameFlags.clear('FLAG_NURSE_UNION_ROOM_REMINDER');
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
    scriptRuntimeServices,
    mode = 'warp',
  } = params;
  const logPrefix = mode === 'warp' ? '[WARP]' : '[SEAM]';

  try {
    clearTempFieldEventDataLikeC();
    stepCallbackManager.reset();
    clearFixedHoleWarpTarget();

    const [mapData, commonData] = await Promise.all([
      getMapScripts(currentMapId),
      getCommonScripts(),
    ]);

    // Pre-populate the frame table cache so ON_FRAME scripts fire on the first render frame
    if (mapScriptCache) {
      mapScriptCache.set(currentMapId, mapData);
    }

    if (!mapData) return;

    const scriptCtx = createMapScriptRunnerContext({
      currentMapId,
      snapshot,
      objectEventManager,
      player,
      playerHiddenRef,
      setMapMetatile,
    });

    const runner = new ScriptRunner(
      { mapData, commonData },
      scriptCtx,
      currentMapId,
      scriptRuntimeServices,
    );

    let ranPreSpawnMapScript = false;

    // ON_TRANSITION: NPC repositioning
    if (mapData.mapScripts.onTransition) {
      await runner.execute(mapData.mapScripts.onTransition);
      ranPreSpawnMapScript = true;
      console.log(`${logPrefix} ON_TRANSITION script executed for ${currentMapId}`);
    }

    // ON_LOAD: map-layout initialization hooks (metatile swaps, etc.)
    // C parity: this runs on full map loads/warps, not camera seam transitions.
    if (mode === 'warp' && mapData.mapScripts.onLoad) {
      await runner.execute(mapData.mapScripts.onLoad);
      ranPreSpawnMapScript = true;
      pipeline.invalidate();
      console.log(`${logPrefix} ON_LOAD script executed for ${currentMapId}`);
    }

    // C parity: ON_TRANSITION and ON_LOAD run before object spawning on map entry.
    // Our object events are already parsed, so reconcile this map from flags
    // at this boundary to mirror spawn-time flag checks.
    if (ranPreSpawnMapScript) {
      objectEventManager.refreshMapLoadState(currentMapId);
    }

    // ON_WARP_INTO: one-shot setup scripts (check var == value)
    if (mode === 'warp' && mapData.mapScripts.onWarpInto?.length) {
      for (const entry of mapData.mapScripts.onWarpInto) {
        const expected = resolveMapScriptCompareValue(entry.value);
        if (gameVariables.getVar(entry.var) === expected) {
          await runner.execute(entry.script);
          console.log(`${logPrefix} ON_WARP_INTO script executed: ${entry.script}`);
        }
      }
    }

    // ON_RESUME: persistent setup scripts (step callbacks, etc.)
    // In the GBA, ON_RESUME fires at end of initial map load AND on return to field.
    // This re-activates per-step callbacks (e.g. Sootopolis ice).
    if (mapData.mapScripts.onResume) {
      await runner.execute(mapData.mapScripts.onResume);
      console.log(`${logPrefix} ON_RESUME script executed for ${currentMapId}`);
    }
  } catch (err) {
    console.warn(`${logPrefix} Map entry script failed:`, err);
  }
}
