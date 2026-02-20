/**
 * Executes map-entry scripts when the player crosses a seam boundary
 * between connected maps (camera transitions, not warps).
 *
 * Extracted from GamePage.tsx to reduce file size.
 */
import type { WorldSnapshot } from '../../WorldManager';
import type { ObjectEventManager } from '../../ObjectEventManager';
import type { PlayerController } from '../../PlayerController';
import type { WebGLRenderPipeline } from '../../../rendering/webgl/WebGLRenderPipeline';
import type { WebGLSpriteRenderer } from '../../../rendering/webgl/WebGLSpriteRenderer';
import type { MapScriptData } from '../../../data/scripts/types';
import type { ScriptRuntimeServices } from '../../../scripting/ScriptRunner';
import { npcSpriteCache } from '../../npc/NPCSpriteLoader';
import { npcAnimationManager } from '../../npc/NPCAnimationEngine';
import { loadObjectEventsFromSnapshot as loadObjectEventsFromSnapshotUtil } from '../../loadObjectEventsFromSnapshot';
import { runMapEntryScripts } from '../../../scripting/mapHooks/runMapEntryScripts';
import { isDebugMode } from '../../../utils/debug';

interface MutableRef<T> {
  current: T;
}

export interface SeamTransitionScriptsParams {
  mapId: string;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  playerRef: MutableRef<PlayerController | null>;
  pipelineRef: MutableRef<WebGLRenderPipeline | null>;
  spriteRendererRef: MutableRef<WebGLSpriteRenderer | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  npcSpritesLoadedRef: MutableRef<Set<string>>;
  playerHiddenRef: MutableRef<boolean>;
  mapScriptCacheRef: MutableRef<Map<string, MapScriptData | null>>;
  onFrameSuppressedRef: MutableRef<Map<string, number>>;
  seamTransitionScriptsInFlightRef: MutableRef<Set<string>>;
  setMapMetatile: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => boolean;
  scriptRuntimeServices: ScriptRuntimeServices;
  setFlashLevel?: (level: number) => void;
  animateFlashLevel?: (level: number) => Promise<void>;
}

export async function executeSeamTransitionScripts(params: SeamTransitionScriptsParams): Promise<void> {
  const {
    mapId,
    worldSnapshotRef,
    playerRef,
    pipelineRef,
    spriteRendererRef,
    objectEventManagerRef,
    npcSpritesLoadedRef,
    playerHiddenRef,
    mapScriptCacheRef,
    onFrameSuppressedRef,
    seamTransitionScriptsInFlightRef,
    setMapMetatile,
    scriptRuntimeServices,
    setFlashLevel,
    animateFlashLevel,
  } = params;

  if (seamTransitionScriptsInFlightRef.current.has(mapId)) {
    return;
  }

  const snapshot = worldSnapshotRef.current;
  const player = playerRef.current;
  const pipeline = pipelineRef.current;
  if (!snapshot || !player || !pipeline) {
    return;
  }

  if (isDebugMode() || isDebugMode('field')) {
    console.debug('[CYCLING_ROAD] Seam map-entry reset before scripts', {
      mapId,
      previousCollisions: player.getCyclingRoadChallengeCollisions(),
    });
  }
  player.setCyclingRoadChallengeActive(false);

  seamTransitionScriptsInFlightRef.current.add(mapId);
  onFrameSuppressedRef.current.clear();

  try {
    // Ensure newly entered seam maps are parsed before ON_TRANSITION scripts
    // attempt object commands like setobjectxyperm LOCALID_*.
    await loadObjectEventsFromSnapshotUtil({
      snapshot,
      objectEventManager: objectEventManagerRef.current,
      spriteCache: npcSpriteCache,
      spriteRenderer: spriteRendererRef.current,
      uploadedSpriteIds: npcSpritesLoadedRef.current,
      clearAnimations: () => npcAnimationManager.clear(),
      preserveExistingMapRuntimeState: true,
    });
    await runMapEntryScripts({
      currentMapId: mapId,
      snapshot,
      objectEventManager: objectEventManagerRef.current,
      player,
      playerHiddenRef,
      pipeline,
      mapScriptCache: mapScriptCacheRef.current,
      setMapMetatile,
      scriptRuntimeServices,
      mode: 'camera-transition',
      setFlashLevel,
      animateFlashLevel,
    });
  } finally {
    seamTransitionScriptsInFlightRef.current.delete(mapId);
    pipelineRef.current?.invalidate();
  }
}
