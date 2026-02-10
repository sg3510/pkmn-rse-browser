import type { PlayerController, TileResolver as PlayerTileResolver } from '../../game/PlayerController';
import { executeWarp, type WarpExecutorDeps, type WarpDestination } from '../../game/WarpExecutor';
import { resolveTileAt, type WarpTrigger } from '../../components/map/utils';
import type { WorldManager, WorldSnapshot } from '../../game/WorldManager';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { RenderContext } from '../../rendering/types';
import type { WarpHandler } from '../../field/WarpHandler';
import type { FadeController } from '../../field/FadeController';
import type { UseDoorAnimationsReturn } from '../../hooks/useDoorAnimations';
import type { UseDoorSequencerReturn } from '../../hooks/useDoorSequencer';
import type { WarpDebugInfo } from '../../components/debug';
import { getMapScripts, getCommonScripts } from '../../data/scripts';
import type { MapScriptData } from '../../data/scripts/types';
import { ScriptRunner } from '../../scripting/ScriptRunner';
import type { StoryScriptContext } from '../../game/NewGameFlow';
import { saveManager } from '../../save/SaveManager';
import { gameVariables } from '../../game/GameVariables';

interface MutableRef<T> {
  current: T;
}

interface NpcMovementLike {
  reset: () => void;
}

export interface PerformWarpTransitionParams {
  trigger: WarpTrigger;
  options?: { force?: boolean; fromDoor?: boolean };
  worldManager: WorldManager | null;
  player: PlayerController | null;
  pipeline: WebGLRenderPipeline | null;
  initializeWorldFromSnapshot: (snapshot: WorldSnapshot, pipeline: WebGLRenderPipeline) => Promise<void>;
  createSnapshotPlayerTileResolver: (snapshot: WorldSnapshot) => PlayerTileResolver;
  objectEventManager: ObjectEventManager;
  getRenderContextFromSnapshot: (snapshot: WorldSnapshot) => RenderContext | null;
  doorSequencer: UseDoorSequencerReturn;
  fadeController: FadeController;
  warpHandler: WarpHandler;
  playerHiddenRef: MutableRef<boolean>;
  doorAnimations: UseDoorAnimationsReturn;
  applyStoryTransitionObjectParity: (mapId: string) => void;
  npcMovement: NpcMovementLike;
  setWarpDebugInfo: (info: WarpDebugInfo) => void;
  resolverVersion: number;
  setLastCoordTriggerTile: (tile: { mapId: string; x: number; y: number }) => void;
  warpingRef: MutableRef<boolean>;
  resolveDynamicWarpTarget: () => { mapId: string; x: number; y: number } | null;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number) => boolean;
  /** Pre-populate frame table cache so ON_FRAME scripts fire on the first frame */
  mapScriptCache?: Map<string, MapScriptData | null>;
}

export async function performWarpTransition(params: PerformWarpTransitionParams): Promise<void> {
  const {
    trigger,
    options,
    worldManager,
    player,
    pipeline,
    initializeWorldFromSnapshot,
    createSnapshotPlayerTileResolver,
    objectEventManager,
    getRenderContextFromSnapshot,
    doorSequencer,
    fadeController,
    warpHandler,
    playerHiddenRef,
    doorAnimations,
    applyStoryTransitionObjectParity,
    npcMovement,
    setWarpDebugInfo,
    resolverVersion,
    setLastCoordTriggerTile,
    warpingRef,
    resolveDynamicWarpTarget,
    setMapMetatile,
    mapScriptCache,
  } = params;

  if (!worldManager || !player || !pipeline) {
    return;
  }

  let destMapId = trigger.warpEvent.destMap;
  let dynamicWarpOverride: { x: number; y: number } | null = null;

  if (destMapId === 'MAP_DYNAMIC') {
    const dynamicWarp = resolveDynamicWarpTarget();
    if (!dynamicWarp) {
      console.warn('[WARP] MAP_DYNAMIC encountered, but no dynamic warp target is set.');
      warpingRef.current = false;
      return;
    }

    destMapId = dynamicWarp.mapId;
    dynamicWarpOverride = { x: dynamicWarp.x, y: dynamicWarp.y };
  }

  const priorFacing = player.getFacingDirection();

  console.log('[WARP] ========== WARP START ==========');
  console.log('[WARP] Source map:', trigger.sourceMap.entry.id);
  console.log('[WARP] Destination map:', destMapId);
  console.log('[WARP] fromDoor:', options?.fromDoor);
  console.log('[WARP] priorFacing:', priorFacing);

  try {
    const snapshot = await worldManager.initialize(destMapId);

    await initializeWorldFromSnapshot(snapshot, pipeline);

    const playerResolver = createSnapshotPlayerTileResolver(snapshot);
    player.setTileResolver(playerResolver);

    objectEventManager.setTileElevationResolver((tileX, tileY) => {
      const resolved = playerResolver(tileX, tileY);
      return resolved?.mapTile.elevation ?? null;
    });

    const destMap = snapshot.maps.find((map) => map.entry.id === destMapId);
    if (!destMap) {
      console.error('[WARP] Destination map not found in snapshot:', destMapId);
      return;
    }

    const renderContext = getRenderContextFromSnapshot(snapshot);

    const warpDeps: WarpExecutorDeps = {
      player,
      doorSequencer,
      fadeController,
      warpHandler,
      playerHiddenRef,
      getCurrentTime: () => performance.now(),
      onClearDoorAnimations: () => doorAnimations.clearAll(),
    };

    const destination: WarpDestination = {
      map: destMap,
      resolveTileAt: (x, y) => {
        if (!renderContext) {
          return null;
        }

        const resolved = resolveTileAt(renderContext, x, y);
        if (!resolved) {
          return null;
        }

        return {
          attributes: resolved.attributes,
          mapTile: resolved.mapTile,
        };
      },
    };

    executeWarp(warpDeps, trigger, destination, {
      ...options,
      priorFacing,
    });

    if (dynamicWarpOverride) {
      player.setPosition(dynamicWarpOverride.x, dynamicWarpOverride.y);
      // Dynamic warp overrides the warp-event position; cancel any door-exit
      // that executeWarp started for the fallback warp-event tile.
      // The script (e.g. StepOffTruckMale) handles player movement instead.
      if (doorSequencer.isExitActive()) {
        doorSequencer.reset();
        playerHiddenRef.current = false;
        player.unlockInput();
      }
    }

    const currentMapId = worldManager.findMapAtPosition(player.tileX, player.tileY)?.entry.id ?? destMapId;
    setLastCoordTriggerTile({
      mapId: currentMapId,
      x: player.tileX,
      y: player.tileY,
    });

    applyStoryTransitionObjectParity(currentMapId);

    // Run generated ON_LOAD and ON_TRANSITION scripts for the destination map.
    try {
      const [mapData, commonData] = await Promise.all([
        getMapScripts(currentMapId),
        getCommonScripts(),
      ]);
      // Pre-populate the frame table cache so ON_FRAME scripts fire on the first render frame
      if (mapScriptCache) {
        mapScriptCache.set(currentMapId, mapData);
      }
      if (mapData) {
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
            objectEventManager.setNPCPositionByLocalId(mapId, localId, tileX, tileY);
          },
          setNpcVisible: (mapId, localId, visible) => {
            objectEventManager.setNPCVisibilityByLocalId(mapId, localId, visible);
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
          setNpcMovementType: (mapId, localId, movementTypeRaw) => {
            objectEventManager.setNPCMovementTypeByLocalId(mapId, localId, movementTypeRaw);
          },
          showYesNo: async () => false,
          getParty: () => [],
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
      }
    } catch (err) {
      console.warn('[WARP] ON_TRANSITION script failed:', err);
    }

    playerHiddenRef.current = false;

    pipeline.invalidate();
    npcMovement.reset();

    console.log('[WARP] Warp complete');
    console.log('[WARP] World bounds:', snapshot.worldBounds);
    console.log('[WARP] Loaded maps:', snapshot.maps.map((map) => map.entry.id));
    console.log('[WARP] Tileset pairs:', snapshot.tilesetPairs.map((pair) => pair.id));
    console.log('[WARP] GPU slots:', Object.fromEntries(snapshot.pairIdToGpuSlot));

    setWarpDebugInfo({
      lastWarpTo: destMapId,
      currentAnchor: snapshot.anchorMapId,
      snapshotMaps: snapshot.maps.map((map) => map.entry.id),
      snapshotPairs: snapshot.tilesetPairs.map((pair) => pair.id),
      gpuSlots: Object.fromEntries(snapshot.pairIdToGpuSlot),
      resolverVersion,
      worldBounds: snapshot.worldBounds,
    });

    if (options?.fromDoor) {
      warpingRef.current = false;
    }
  } catch (err) {
    console.error('[WARP] Failed to perform warp:', err);
    warpHandler.setInProgress(false);
    warpingRef.current = false;
  }
}
