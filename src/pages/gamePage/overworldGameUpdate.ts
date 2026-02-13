/**
 * Helper functions extracted from the GamePage render loop to reduce its size.
 * These are called from within the render loop closure, not standalone.
 */
import type { PlayerController } from '../../game/PlayerController';
import type { WorldManager } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { FadeController } from '../../field/FadeController';
import type { WarpHandler } from '../../field/WarpHandler';
import type { MapScriptData } from '../../data/scripts/types';
import type { ScriptCoordEvent } from '../../game/mapEventLoader';
import type { RenderContext } from '../../rendering/types';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { WarpTrigger } from '../../components/map/utils';
import type { LavaridgeWarpSequencer } from '../../game/LavaridgeWarpSequencer';
import type { CameraController } from '../../game/CameraController';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { UseDoorSequencerReturn } from '../../hooks/useDoorSequencer';
import type { UseDoorAnimationsReturn } from '../../hooks/useDoorAnimations';
import { runDoorEntryUpdate, runDoorExitUpdate, type DoorSequenceDeps } from '../../game/DoorSequenceRunner';
import { FADE_TIMING, type CardinalDirection } from '../../field/types';
import { isSurfableBehavior } from '../../utils/metatileBehaviors';
import { gameVariables, GAME_VARS } from '../../game/GameVariables';
import { getMapScripts } from '../../data/scripts';
import { shouldRunCoordEvent } from '../../game/NewGameFlow';
import { scheduleInputUnlock, type InputUnlockGuards } from './mapMetatileUtils';
import type { WeatherManager } from '../../weather/WeatherManager';
import { stepCallbackManager } from '../../game/StepCallbackManager';
import { processWarpTrigger, updateWarpHandlerTile } from '../../game/WarpTriggerProcessor';
import { getMetatileIdFromMapTile } from '../../utils/mapLoader';
import { startSpecialWalkOverWarp } from '../../game/SpecialWarpBehaviorRegistry';
import type { DebugOptions, PlayerDebugInfo } from '../../components/debug';

interface MutableRef<T> {
  current: T;
}

// ─── resolveMapScriptCompareValue ────────────────────────────────────────────
// Shared helper used by ON_FRAME evaluation.
export function resolveMapScriptCompareValue(value: number | string): number {
  if (typeof value === 'number') return value;
  if (value.startsWith('VAR_')) return gameVariables.getVar(value);
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// ─── ensureMapScriptsCached ──────────────────────────────────────────────────
// Starts async map script loading if not already cached or in-flight.
export function ensureMapScriptsCached(
  mapId: string,
  mapScriptCache: Map<string, MapScriptData | null>,
  mapScriptLoading: Set<string>
): void {
  if (mapScriptCache.has(mapId) || mapScriptLoading.has(mapId)) return;
  mapScriptLoading.add(mapId);
  void getMapScripts(mapId).then((data) => {
    mapScriptCache.set(mapId, data);
    mapScriptLoading.delete(mapId);
  });
}

// ─── evaluateOnFrameScripts ──────────────────────────────────────────────────
// Checks ON_FRAME entries for a map and fires matching scripts.
// Returns true if a script was triggered. Shared between pre-input and post-move sites.
export function evaluateOnFrameScripts(params: {
  currentMapId: string;
  mapScriptCache: Map<string, MapScriptData | null>;
  mapScriptLoading: Set<string>;
  onFrameSuppressed: Map<string, number>;
  objectEventManager: ObjectEventManager;
  currentMapObjectEventsLength: number;
  runScript: (scriptName: string, mapId: string) => void;
}): boolean {
  const {
    currentMapId,
    mapScriptCache,
    mapScriptLoading,
    onFrameSuppressed,
    objectEventManager,
    currentMapObjectEventsLength,
    runScript,
  } = params;

  const mapObjectsReady =
    currentMapObjectEventsLength === 0
    || objectEventManager.hasMapObjects(currentMapId);

  ensureMapScriptsCached(currentMapId, mapScriptCache, mapScriptLoading);

  const cachedData = mapScriptCache.get(currentMapId);
  if (!mapObjectsReady || !cachedData?.mapScripts.onFrame) return false;

  for (const entry of cachedData.mapScripts.onFrame) {
    const currentVarValue = gameVariables.getVar(entry.var);
    const expectedValue = resolveMapScriptCompareValue(entry.value);
    if (currentVarValue === expectedValue) {
      const suppressedValue = onFrameSuppressed.get(entry.script);
      if (suppressedValue === expectedValue) continue;
      console.log(`[ON_FRAME] Triggered: map=${currentMapId} script=${entry.script} var=${entry.var} value=${expectedValue}`);
      onFrameSuppressed.set(entry.script, expectedValue);
      runScript(entry.script, currentMapId);
      return true;
    } else {
      onFrameSuppressed.delete(entry.script);
    }
  }

  return false;
}

// ─── evaluateOnFrameSafetyNets ───────────────────────────────────────────────
// Safety nets for specific maps where ON_FRAME data may not be cached yet.
export function evaluateOnFrameSafetyNets(
  currentMapId: string,
  mapObjectsReady: boolean,
  runScript: (scriptName: string, mapId: string) => void
): boolean {
  if (!mapObjectsReady) return false;

  if (currentMapId === 'MAP_ROUTE101') {
    const route101State = gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE);
    if (route101State === 0) {
      runScript('Route101_EventScript_HideMapNamePopup', currentMapId);
      return true;
    }
  }

  if (currentMapId === 'MAP_LITTLEROOT_TOWN') {
    const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
    if (introState === 1 || introState === 2) {
      runScript(
        introState === 1
          ? 'LittlerootTown_EventScript_StepOffTruckMale'
          : 'LittlerootTown_EventScript_StepOffTruckFemale',
        currentMapId
      );
      return true;
    }
  }

  return false;
}

// ─── processCoordEventsForTile ───────────────────────────────────────────────
// Handles coord event matching and firing at the player's current tile.
// Returns { consumed: boolean } indicating whether the tile was consumed.
export function processCoordEventsForTile(params: {
  currentMap: {
    entry: { id: string };
    offsetX: number;
    offsetY: number;
    coordEvents: Array<{
      x: number;
      y: number;
      elevation: number;
      type?: string;
      weather?: string;
      script?: string;
      var?: string;
      varValue?: number;
    }>;
  };
  playerTileX: number;
  playerTileY: number;
  playerElevation: number;
  weatherManager: WeatherManager;
  runScript: (scriptName: string, mapId: string) => void;
}): { consumed: boolean } {
  const { currentMap, playerTileX, playerTileY, playerElevation, weatherManager, runScript } = params;

  const coordEventsAtTile = currentMap.coordEvents.filter((coordEvent) => {
    const eventWorldX = currentMap.offsetX + coordEvent.x;
    const eventWorldY = currentMap.offsetY + coordEvent.y;
    if (eventWorldX !== playerTileX || eventWorldY !== playerTileY) return false;

    const eventElevation = coordEvent.elevation;
    return (
      playerElevation === 0
      || playerElevation === 15
      || eventElevation === 0
      || eventElevation === 15
      || eventElevation === playerElevation
    );
  });

  const scriptCoordEventsAtTile: ScriptCoordEvent[] = [];
  let sawWeatherCoordEvent = false;
  for (const coordEvent of coordEventsAtTile) {
    if (coordEvent.type === 'weather') {
      weatherManager.applyCoordWeather((coordEvent as any).weather);
      sawWeatherCoordEvent = true;
      continue;
    }
    scriptCoordEventsAtTile.push(coordEvent as ScriptCoordEvent);
  }

  let firedCoordEvent = false;
  for (const coordEvent of scriptCoordEventsAtTile) {
    if (!shouldRunCoordEvent(coordEvent.var, coordEvent.varValue)) continue;

    console.log(`[CoordEvent] Firing: ${coordEvent.script} at (${coordEvent.x},${coordEvent.y}) var=${coordEvent.var}=${coordEvent.varValue}`);
    runScript(coordEvent.script, currentMap.entry.id);
    firedCoordEvent = true;
    break;
  }

  const pendingRescueEvents = scriptCoordEventsAtTile.filter(
    (coordEvent) => coordEvent.script === 'Route101_EventScript_StartBirchRescue'
  );
  if (!firedCoordEvent && pendingRescueEvents.length > 0) {
    const pendingStates = pendingRescueEvents
      .map((coordEvent) => `${coordEvent.var} current=${gameVariables.getVar(coordEvent.var)} required=${coordEvent.varValue}`)
      .join(' | ');
    console.log(`[CoordEvent] Pending Route101 rescue at (${playerTileX},${playerTileY}): ${pendingStates}`);
  }

  const hasPendingScriptEvents = scriptCoordEventsAtTile.length > 0 && !firedCoordEvent;
  const consumed = firedCoordEvent || coordEventsAtTile.length === 0 || (sawWeatherCoordEvent && !hasPendingScriptEvents);
  return { consumed };
}

// ─── Scripted Warp Types ─────────────────────────────────────────────────────

type ScriptedWarpDirection = 'up' | 'down' | 'left' | 'right';
type ScriptedWarpPhase = 'pending' | 'fading' | 'loading';

export type PendingScriptedWarp = {
  mapId: string;
  x: number;
  y: number;
  direction: ScriptedWarpDirection;
  phase: ScriptedWarpPhase;
  traversal?: {
    surfing: boolean;
    underwater: boolean;
  };
};

const SCRIPTED_WARP_LOAD_RETRY_INTERVAL_MS = 1500;
const SCRIPTED_WARP_MAX_LOAD_RETRIES = 3;

export type ScriptedWarpLoadMonitor = {
  mapId: string;
  startedAt: number;
  retries: number;
  fallbackDeferredLogged: boolean;
};

// ─── updateScriptedWarpStateMachine ──────────────────────────────────────────
// Advances the scripted warp (warpsilent-style) state machine each frame.
export function updateScriptedWarpStateMachine(params: {
  nowTime: number;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null>;
  scriptedWarpLoadMonitorRef: MutableRef<ScriptedWarpLoadMonitor | null>;
  warpingRef: MutableRef<boolean>;
  loadingRef: MutableRef<boolean>;
  pendingSavedLocationRef: MutableRef<any>;
  warpHandler: WarpHandler;
  fadeController: FadeController;
  playerRef: MutableRef<PlayerController | null>;
  worldManagerRef: MutableRef<WorldManager | null>;
  inputUnlockGuards: InputUnlockGuards;
  selectMapForLoad: (mapId: string) => void;
}): void {
  const {
    nowTime,
    pendingScriptedWarpRef,
    scriptedWarpLoadMonitorRef,
    warpingRef,
    loadingRef,
    pendingSavedLocationRef,
    warpHandler,
    fadeController: fade,
    playerRef,
    worldManagerRef,
    inputUnlockGuards,
    selectMapForLoad,
  } = params;

  const scriptedWarp = pendingScriptedWarpRef.current;
  if (!scriptedWarp) {
    scriptedWarpLoadMonitorRef.current = null;
    return;
  }
  if (!warpingRef.current) return;

  if (scriptedWarp.phase === 'pending') {
    const fadeComplete = fade.isComplete(nowTime);
    const fadeDirection = fade.getDirection();
    const hasCompletedFadeOut = fadeDirection === 'out' && fadeComplete;
    if (hasCompletedFadeOut) {
      console.log(`[ScriptedWarp] pending → fading (reuse fadeOut to ${scriptedWarp.mapId})`);
      scriptedWarp.phase = 'fading';
      pendingScriptedWarpRef.current = scriptedWarp;
    } else {
      const canStartFadeOut = !fade.isActive() || fadeComplete;
      if (canStartFadeOut) {
        console.log(`[ScriptedWarp] pending → fading (fadeOut to ${scriptedWarp.mapId})`);
        fade.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
        scriptedWarp.phase = 'fading';
        pendingScriptedWarpRef.current = scriptedWarp;
      }
    }
  } else if (
    scriptedWarp.phase === 'fading'
    && fade.getDirection() === 'out'
    && fade.isComplete(nowTime)
  ) {
    const activePlayer = playerRef.current;
    const activeMapId = activePlayer
      ? worldManagerRef.current?.findMapAtPosition(activePlayer.tileX, activePlayer.tileY)?.entry.id ?? null
      : null;

    console.log(`[ScriptedWarp] fade complete. activeMapId=${activeMapId} targetMapId=${scriptedWarp.mapId}`);
    if (activePlayer && activeMapId === scriptedWarp.mapId) {
      const currentMap = worldManagerRef.current?.findMapAtPosition(activePlayer.tileX, activePlayer.tileY);
      const targetWorldX = currentMap ? currentMap.offsetX + scriptedWarp.x : scriptedWarp.x;
      const targetWorldY = currentMap ? currentMap.offsetY + scriptedWarp.y : scriptedWarp.y;
      console.log(`[ScriptedWarp] same map reposition to local=(${scriptedWarp.x},${scriptedWarp.y}) world=(${targetWorldX},${targetWorldY})`);
      activePlayer.setPosition(targetWorldX, targetWorldY);
      activePlayer.dir = scriptedWarp.direction;
      if (scriptedWarp.traversal) {
        const traversal = { ...scriptedWarp.traversal };
        if (!traversal.underwater) {
          const resolved = activePlayer.getTileResolver()?.(targetWorldX, targetWorldY);
          const behavior = resolved?.attributes?.behavior;
          if (behavior !== undefined) {
            traversal.surfing = isSurfableBehavior(behavior);
          }
        }
        activePlayer.setTraversalState(traversal);
      }
      fade.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
      pendingSavedLocationRef.current = null;
      pendingScriptedWarpRef.current = null;
      warpingRef.current = false;
      warpHandler.updateLastCheckedTile(targetWorldX, targetWorldY, scriptedWarp.mapId);
      scheduleInputUnlock(activePlayer, inputUnlockGuards);
    } else {
      console.log(`[ScriptedWarp] different map → loading ${scriptedWarp.mapId}`);
      scriptedWarp.phase = 'loading';
      pendingScriptedWarpRef.current = scriptedWarp;
      scriptedWarpLoadMonitorRef.current = {
        mapId: scriptedWarp.mapId,
        startedAt: nowTime,
        retries: 0,
        fallbackDeferredLogged: false,
      };
      selectMapForLoad(scriptedWarp.mapId);
    }
  } else if (scriptedWarp.phase === 'loading') {
    const activePlayer = playerRef.current;
    const activeMapId = activePlayer
      ? worldManagerRef.current?.findMapAtPosition(activePlayer.tileX, activePlayer.tileY)?.entry.id ?? null
      : null;

    if (activePlayer && activeMapId === scriptedWarp.mapId && !loadingRef.current) {
      console.warn(`[ScriptedWarp] loading fallback completion on ${scriptedWarp.mapId}`);
      pendingScriptedWarpRef.current = null;
      scriptedWarpLoadMonitorRef.current = null;
      warpingRef.current = false;
      warpHandler.updateLastCheckedTile(activePlayer.tileX, activePlayer.tileY, scriptedWarp.mapId);
      if (fade.getDirection() !== 'in' || !fade.isActive()) {
        fade.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
      }
      scheduleInputUnlock(activePlayer, inputUnlockGuards);
    } else if (activePlayer && activeMapId === scriptedWarp.mapId && loadingRef.current) {
      let monitor = scriptedWarpLoadMonitorRef.current;
      if (!monitor || monitor.mapId !== scriptedWarp.mapId) {
        monitor = {
          mapId: scriptedWarp.mapId,
          startedAt: nowTime,
          retries: 0,
          fallbackDeferredLogged: false,
        };
        scriptedWarpLoadMonitorRef.current = monitor;
      }
      if (!monitor.fallbackDeferredLogged) {
        console.log(
          `[ScriptedWarp] fallback deferred: map ${scriptedWarp.mapId} active but loading still in progress`
        );
        monitor.fallbackDeferredLogged = true;
      }
    } else if (!loadingRef.current) {
      let monitor = scriptedWarpLoadMonitorRef.current;
      if (!monitor || monitor.mapId !== scriptedWarp.mapId) {
        monitor = {
          mapId: scriptedWarp.mapId,
          startedAt: nowTime,
          retries: 0,
          fallbackDeferredLogged: false,
        };
        scriptedWarpLoadMonitorRef.current = monitor;
      }

      const elapsed = nowTime - monitor.startedAt;
      if (elapsed >= SCRIPTED_WARP_LOAD_RETRY_INTERVAL_MS) {
        if (monitor.retries < SCRIPTED_WARP_MAX_LOAD_RETRIES) {
          monitor.retries += 1;
          monitor.startedAt = nowTime;
          console.warn(
            `[ScriptedWarp] loading timeout retry ${monitor.retries}/${SCRIPTED_WARP_MAX_LOAD_RETRIES} `
            + `for ${scriptedWarp.mapId}`
          );
          selectMapForLoad(scriptedWarp.mapId);
        } else {
          console.error(`[ScriptedWarp] aborting stuck load for ${scriptedWarp.mapId}`);
          pendingScriptedWarpRef.current = null;
          scriptedWarpLoadMonitorRef.current = null;
          warpingRef.current = false;
          if (fade.getDirection() !== 'in' || !fade.isActive()) {
            fade.startFadeIn(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
          }
          if (activePlayer) {
            scheduleInputUnlock(activePlayer, inputUnlockGuards);
          }
        }
      }
    }
  }
}

// ─── runStepCallbacks ────────────────────────────────────────────────────────
// Runs the per-step callback manager (Sootopolis ice, ash grass, etc.)
// Must run after player.update so position is current, before ON_FRAME so
// variable changes (e.g. VAR_ICE_STEP_COUNT) are visible to frame scripts.
export function runStepCallbacks(params: {
  player: PlayerController;
  worldManager: WorldManager;
  storyScriptRunningRef: MutableRef<boolean>;
  setMapMetatileLocal: (mapId: string, localX: number, localY: number, metatileId: number) => void;
  pipelineRef: MutableRef<WebGLRenderPipeline | null>;
}): void {
  const {
    player,
    worldManager,
    storyScriptRunningRef,
    setMapMetatileLocal,
    pipelineRef,
  } = params;

  if (storyScriptRunningRef.current) return;

  const cbMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
  if (!cbMap) return;

  const offsetX = cbMap.offsetX;
  const offsetY = cbMap.offsetY;
  let playerDestTileX = player.tileX;
  let playerDestTileY = player.tileY;
  if (player.isMoving) {
    if (player.dir === 'up') playerDestTileY--;
    else if (player.dir === 'down') playerDestTileY++;
    else if (player.dir === 'left') playerDestTileX--;
    else if (player.dir === 'right') playerDestTileX++;
  }
  stepCallbackManager.update({
    playerLocalX: player.tileX - offsetX,
    playerLocalY: player.tileY - offsetY,
    playerDestLocalX: playerDestTileX - offsetX,
    playerDestLocalY: playerDestTileY - offsetY,
    currentMapId: cbMap.entry.id,
    getTileBehaviorLocal: (localX, localY) => {
      const resolver = player.getTileResolver();
      if (!resolver) return undefined;
      const resolved = resolver(localX + offsetX, localY + offsetY);
      return resolved?.attributes?.behavior;
    },
    getTileMetatileIdLocal: (localX, localY) => {
      const resolver = player.getTileResolver();
      if (!resolver) return undefined;
      const resolved = resolver(localX + offsetX, localY + offsetY);
      return resolved?.mapTile?.metatileId;
    },
    setMapMetatile: (localX, localY, metatileId) => {
      setMapMetatileLocal(cbMap.entry.id, localX, localY, metatileId);
    },
    startFieldEffectLocal: (localX, localY, effectName, ownerObjectId = 'player') => {
      player.getGrassEffectManager().create(
        localX + offsetX,
        localY + offsetY,
        effectName,
        false,
        ownerObjectId
      );
    },
    invalidateView: () => {
      pipelineRef.current?.invalidate();
    },
  });
}

// ─── checkWarpTriggers ───────────────────────────────────────────────────────
// Checks for warps using the shared WarpTriggerProcessor and handles
// arrow warps, auto-door warps, and walk-over warps.
export function checkWarpTriggers(params: {
  player: PlayerController;
  snapshot: WorldSnapshot | null;
  nowTime: number;
  storyScriptRunningRef: MutableRef<boolean>;
  dialogIsOpenRef: MutableRef<boolean>;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null>;
  warpHandlerRef: MutableRef<WarpHandler>;
  warpingRef: MutableRef<boolean>;
  pendingWarpRef: MutableRef<WarpTrigger | null>;
  fadeControllerRef: MutableRef<FadeController>;
  getRenderContextFromSnapshot: (snapshot: WorldSnapshot) => RenderContext | null;
  doorSequencer: { isActive: () => boolean; startAutoWarp: (...args: any[]) => any };
  arrowOverlay: { hide: () => void };
  lavaridgeWarpSequencer: LavaridgeWarpSequencer;
}): void {
  const {
    player,
    snapshot,
    nowTime,
    storyScriptRunningRef,
    dialogIsOpenRef,
    pendingScriptedWarpRef,
    warpHandlerRef,
    warpingRef,
    pendingWarpRef,
    fadeControllerRef,
    getRenderContextFromSnapshot,
    doorSequencer,
    arrowOverlay,
    lavaridgeWarpSequencer,
  } = params;

  if (!snapshot) return;

  const renderContext = getRenderContextFromSnapshot(snapshot);
  const suppressWarpChecks =
    storyScriptRunningRef.current
    || dialogIsOpenRef.current
    || pendingScriptedWarpRef.current !== null;
  if (!renderContext || suppressWarpChecks) return;

  const warpResult = processWarpTrigger({
    player,
    renderContext,
    warpHandler: warpHandlerRef.current,
    isDoorSequencerActive: doorSequencer.isActive(),
  });

  // Update warp handler's last checked tile if tile changed
  if (warpResult.tileChanged) {
    updateWarpHandlerTile(warpHandlerRef.current, warpResult);
  }

  // Handle warp actions
  const action = warpResult.action;
  if (action.type === 'arrow') {
    // Arrow warps are handled through PlayerController's doorWarpHandler
    // Just update arrow overlay, don't auto-warp
  } else if (action.type === 'autoDoorWarp') {
    console.log(`[WARP] autoDoorWarp at tile(${player.tileX},${player.tileY}) map=${warpResult.currentTile?.mapId} dest=${JSON.stringify(action.trigger)}`);
    // Non-animated doors (stairs, ladders): auto-warp with fade
    arrowOverlay.hide();
    doorSequencer.startAutoWarp({
      targetX: player.tileX,
      targetY: player.tileY,
      metatileId: getMetatileIdFromMapTile(action.resolvedTile.mapTile),
      isAnimatedDoor: false,
      entryDirection: player.dir as CardinalDirection,
      warpTrigger: action.trigger,
    }, nowTime, true);
    player.lockInput();
  } else if (action.type === 'walkOverWarp') {
    console.log(`[WARP] walkOverWarp at tile(${player.tileX},${player.tileY}) map=${warpResult.currentTile?.mapId} dest=${JSON.stringify(action.trigger)}`);

    const currentMapId = warpResult.currentTile?.mapId;
    const handledSpecialWarp = currentMapId
      ? startSpecialWalkOverWarp({
          trigger: action.trigger,
          now: nowTime,
          currentMapId,
          player,
          warpHandler: warpHandlerRef.current,
          setPendingWarp: (triggerForWarp) => {
            pendingWarpRef.current = triggerForWarp;
          },
          lavaridgeWarpSequencer,
        })
      : false;

    if (!handledSpecialWarp) {
      // Other walk-over warps: simple warp
      warpHandlerRef.current.startWarp(player.tileX, player.tileY, warpResult.currentTile!.mapId);
      pendingWarpRef.current = action.trigger;
      warpingRef.current = true;
      player.lockInput();
      fadeControllerRef.current.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
    }
  }
}

// ─── advanceWarpSequences ────────────────────────────────────────────────────
// Combines door entry/exit, Lavaridge warp sequencer, scripted warp state
// machine, and pending warp execution into a single call.
export function advanceWarpSequences(params: {
  nowTime: number;
  player: PlayerController | null;
  cameraRef: MutableRef<CameraController | null>;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  fadeControllerRef: MutableRef<FadeController>;
  playerHiddenRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  warpingRef: MutableRef<boolean>;
  dialogIsOpenRef: MutableRef<boolean>;
  pendingWarpRef: MutableRef<WarpTrigger | null>;
  lavaridgeWarpSequencer: LavaridgeWarpSequencer;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null>;
  scriptedWarpLoadMonitorRef: MutableRef<ScriptedWarpLoadMonitor | null>;
  loadingRef: MutableRef<boolean>;
  pendingSavedLocationRef: MutableRef<any>;
  warpHandlerRef: MutableRef<WarpHandler>;
  playerRef: MutableRef<PlayerController | null>;
  worldManagerRef: MutableRef<WorldManager | null>;
  inputUnlockGuards: InputUnlockGuards;
  selectMapForLoad: (mapId: string) => void;
  performWarp: (trigger: WarpTrigger, options?: { force?: boolean; fromDoor?: boolean }) => Promise<{ managesInputUnlock: boolean }>;
}): void {
  const {
    nowTime,
    player,
    cameraRef,
    doorSequencer,
    doorAnimations,
    fadeControllerRef,
    playerHiddenRef,
    storyScriptRunningRef,
    warpingRef,
    dialogIsOpenRef,
    pendingWarpRef,
    lavaridgeWarpSequencer,
    pendingScriptedWarpRef,
    scriptedWarpLoadMonitorRef,
    loadingRef,
    pendingSavedLocationRef,
    warpHandlerRef,
    playerRef,
    worldManagerRef,
    inputUnlockGuards,
    selectMapForLoad,
    performWarp,
  } = params;

  // Advance door sequences using shared DoorSequenceRunner
  if (player) {
    const doorDeps: DoorSequenceDeps = {
      player,
      doorSequencer,
      doorAnimations,
      fadeController: fadeControllerRef.current,
      playerHiddenRef,
      shouldUnlockInput: () =>
        !storyScriptRunningRef.current
        && !warpingRef.current
        && !dialogIsOpenRef.current,
      onExecuteWarp: (trigger) => {
        // CRITICAL: Set warpingRef to prevent worldManager.update() during warp
        warpingRef.current = true;
        void performWarp(trigger, { force: true, fromDoor: true });
      },
    };

    runDoorEntryUpdate(doorDeps, nowTime);
    runDoorExitUpdate(doorDeps, nowTime);
  }

  // Advance Lavaridge warp sequences
  if (player && cameraRef.current) {
    lavaridgeWarpSequencer.update(
      nowTime,
      player,
      cameraRef.current,
      player.getGrassEffectManager(),
      fadeControllerRef.current,
      () => {
        // Callback when special pre-warp animation completes.
        const trigger = pendingWarpRef.current;
        if (trigger && !warpingRef.current) {
          warpingRef.current = true;
          fadeControllerRef.current.startFadeOut(FADE_TIMING.DEFAULT_DURATION_MS, nowTime);
        }
      },
      () => {
        playerHiddenRef.current = false;
      },
    );
  }

  // Handle scripted (warpsilent-style) warps from story scripts.
  updateScriptedWarpStateMachine({
    nowTime,
    pendingScriptedWarpRef,
    scriptedWarpLoadMonitorRef,
    warpingRef,
    loadingRef,
    pendingSavedLocationRef,
    warpHandler: warpHandlerRef.current,
    fadeController: fadeControllerRef.current,
    playerRef,
    worldManagerRef,
    inputUnlockGuards,
    selectMapForLoad,
  });

  // Handle pending warp when fade out completes
  if (warpingRef.current && pendingWarpRef.current) {
    const fade = fadeControllerRef.current;
    if (fade.getDirection() === 'out' && fade.isComplete(nowTime)) {
      // Fade out complete, execute warp
      const trigger = pendingWarpRef.current;
      pendingWarpRef.current = null;
      void performWarp(trigger).then((result) => {
        warpingRef.current = false;
        if (result.managesInputUnlock) {
          return;
        }
        // Unlock player input after fade in starts
        const activePlayer = playerRef.current;
        if (activePlayer) {
          // Delay unlock until fade in completes
          scheduleInputUnlock(activePlayer, inputUnlockGuards);
        }
      });
    }
  }
}

// ─── handleWorldUpdateAndEvents ──────────────────────────────────────────────
// Combines weather defaults sync, world manager position update, seam
// transition detection/scripts, coord event processing, post-move ON_FRAME
// evaluation, and debug info updates into a single call.
export function handleWorldUpdateAndEvents(params: {
  player: PlayerController;
  worldManager: WorldManager;
  preInputOnFrameTriggered: boolean;
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  weatherDefaultsSnapshotRef: MutableRef<WorldSnapshot | null>;
  weatherManagerRef: MutableRef<WeatherManager>;
  lastWorldUpdateRef: MutableRef<{ tileX: number; tileY: number; direction: 'up' | 'down' | 'left' | 'right' } | null>;
  lastCoordTriggerTileRef: MutableRef<{ mapId: string; x: number; y: number } | null>;
  lastPlayerMapIdRef: MutableRef<string | null>;
  cameraRef: MutableRef<CameraController | null>;
  worldBoundsRef: MutableRef<{ minX: number; minY: number; width: number; height: number }>;
  warpingRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  dialogIsOpenRef: MutableRef<boolean>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  doorSequencerIsActive: boolean;
  seamTransitionScriptsInFlightRef: MutableRef<Set<string>>;
  mapScriptCacheRef: MutableRef<Map<string, MapScriptData | null>>;
  mapScriptLoadingRef: MutableRef<Set<string>>;
  onFrameSuppressedRef: MutableRef<Map<string, number>>;
  runScript: (scriptName: string, mapId: string) => void;
  runSeamTransitionScripts: (mapId: string) => void;
  debugOptionsRef: MutableRef<DebugOptions>;
  gbaFrameRef: MutableRef<number>;
  setMapDebugInfo: (info: any) => void;
  setPlayerDebugInfo: (info: PlayerDebugInfo) => void;
  selectedMapId: string;
}): void {
  const {
    player,
    worldManager,
    preInputOnFrameTriggered,
    worldSnapshotRef,
    weatherDefaultsSnapshotRef,
    weatherManagerRef,
    lastWorldUpdateRef,
    lastCoordTriggerTileRef,
    lastPlayerMapIdRef,
    cameraRef,
    worldBoundsRef,
    warpingRef,
    storyScriptRunningRef,
    dialogIsOpenRef,
    objectEventManagerRef,
    doorSequencerIsActive,
    seamTransitionScriptsInFlightRef,
    mapScriptCacheRef,
    mapScriptLoadingRef,
    onFrameSuppressedRef,
    runScript,
    runSeamTransitionScripts,
    debugOptionsRef,
    gbaFrameRef,
    setMapDebugInfo,
    setPlayerDebugInfo,
    selectedMapId,
  } = params;

  // Weather defaults sync
  const liveSnapshot = worldSnapshotRef.current;
  if (liveSnapshot && weatherDefaultsSnapshotRef.current !== liveSnapshot) {
    weatherManagerRef.current.setMapDefaultsFromSources(
      liveSnapshot.maps.map((map) => ({ mapId: map.entry.id, mapWeather: map.mapWeather }))
    );
    weatherDefaultsSnapshotRef.current = liveSnapshot;
  }

  // World manager position update + dirty check
  const playerDirection = player.getFacingDirection();
  const lastWorldUpdate = lastWorldUpdateRef.current;
  if (
    !lastWorldUpdate
    || lastWorldUpdate.tileX !== player.tileX
    || lastWorldUpdate.tileY !== player.tileY
    || lastWorldUpdate.direction !== playerDirection
  ) {
    void worldManager.update(player.tileX, player.tileY, playerDirection);
    lastWorldUpdateRef.current = {
      tileX: player.tileX,
      tileY: player.tileY,
      direction: playerDirection,
    };
  }

  // Find current map
  const currentMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
  if (currentMap) {
    weatherManagerRef.current.setCurrentMap(currentMap.entry.id);
    const tileChanged =
      !lastCoordTriggerTileRef.current ||
      lastCoordTriggerTileRef.current.mapId !== currentMap.entry.id ||
      lastCoordTriggerTileRef.current.x !== player.tileX ||
      lastCoordTriggerTileRef.current.y !== player.tileY;

    if (tileChanged) {
      // Seam transition detection + logging
      const previousMapId = lastPlayerMapIdRef.current;
      if (previousMapId !== currentMap.entry.id) {
        const seamTransition =
          (previousMapId === 'MAP_LITTLEROOT_TOWN' && currentMap.entry.id === 'MAP_ROUTE101')
          || (previousMapId === 'MAP_ROUTE101' && currentMap.entry.id === 'MAP_LITTLEROOT_TOWN');
        if (seamTransition) {
          const snapshot = worldSnapshotRef.current;
          const localX = player.tileX - currentMap.offsetX;
          const localY = player.tileY - currentMap.offsetY;
          const cameraPos = cameraRef.current?.getPosition();
          const bounds = worldBoundsRef.current;
          const seamMaps = (snapshot?.maps ?? [])
            .filter((m) => m.entry.id === 'MAP_LITTLEROOT_TOWN' || m.entry.id === 'MAP_ROUTE101')
            .map((m) => `${m.entry.id}@(${m.offsetX},${m.offsetY})`)
            .join(' | ');
          console.log(
            `[SEAM] map transition ${previousMapId} -> ${currentMap.entry.id} `
            + `world=(${player.tileX},${player.tileY}) local=(${localX},${localY}) `
            + `camera=(${cameraPos ? `${cameraPos.x.toFixed(1)},${cameraPos.y.toFixed(1)}` : 'n/a'}) `
            + `bounds=(${bounds.minX},${bounds.minY},${bounds.width}x${bounds.height}) `
            + `anchor=${snapshot?.anchorMapId ?? 'unknown'} `
            + `loaded=${snapshot?.maps.map((m) => m.entry.id).join(',') ?? 'none'} `
            + `seamOffsets=${seamMaps || 'missing'}`
          );
        }

        // Run seam transition scripts
        const isSeamMapTransition =
          previousMapId !== null
          && previousMapId !== currentMap.entry.id
          && !warpingRef.current;
        if (isSeamMapTransition && !storyScriptRunningRef.current) {
          runSeamTransitionScripts(currentMap.entry.id);
        }
      }
      lastPlayerMapIdRef.current = currentMap.entry.id;

      // Coord event processing
      const mapObjectsReady =
        currentMap.objectEvents.length === 0
        || objectEventManagerRef.current.hasMapObjects(currentMap.entry.id);
      const canProcessCoordEvents =
        !storyScriptRunningRef.current
        && !dialogIsOpenRef.current
        && !warpingRef.current
        && !doorSequencerIsActive
        && seamTransitionScriptsInFlightRef.current.size === 0
        && mapObjectsReady;

      if (canProcessCoordEvents) {
        const { consumed } = processCoordEventsForTile({
          currentMap,
          playerTileX: player.tileX,
          playerTileY: player.tileY,
          playerElevation: player.getCurrentElevation(),
          weatherManager: weatherManagerRef.current,
          runScript,
        });
        if (consumed) {
          lastCoordTriggerTileRef.current = {
            mapId: currentMap.entry.id,
            x: player.tileX,
            y: player.tileY,
          };
        }
      }
    }

    // Post-move ON_FRAME evaluation
    // Skip if pre-input ON_FRAME already triggered this frame (prevents double-fire for sync scripts)
    if (
      !preInputOnFrameTriggered
      && !storyScriptRunningRef.current
      && !dialogIsOpenRef.current
      && !warpingRef.current
      && !doorSequencerIsActive
      && seamTransitionScriptsInFlightRef.current.size === 0
    ) {
      evaluateOnFrameScripts({
        currentMapId: currentMap.entry.id,
        mapScriptCache: mapScriptCacheRef.current,
        mapScriptLoading: mapScriptLoadingRef.current,
        onFrameSuppressed: onFrameSuppressedRef.current,
        objectEventManager: objectEventManagerRef.current,
        currentMapObjectEventsLength: currentMap.objectEvents.length,
        runScript,
      });
    }
  }

  // Debug info update for the debug panel
  if (debugOptionsRef.current.enabled && gbaFrameRef.current % 30 === 0) {
    const debugInfo = worldManager.getDebugInfo(player.tileX, player.tileY);
    setMapDebugInfo(debugInfo);

    setPlayerDebugInfo({
      tileX: player.tileX,
      tileY: player.tileY,
      pixelX: player.x,
      pixelY: player.y,
      direction: player.getFacingDirection(),
      elevation: player.getElevation(),
      currentElevation: player.getCurrentElevation(),
      previousElevation: player.getPreviousElevation(),
      isMoving: player.isMoving,
      isSurfing: player.isSurfing(),
      isJumping: player.getSurfingController().isJumping(),
      mapId: debugInfo?.currentMap ?? selectedMapId,
      stateName: player.getStateName(),
      hasCollisionChecker: player.hasObjectCollisionChecker(),
    });
  }
}

// ─── FrameCounter ────────────────────────────────────────────────────────────
// Mutable state for FPS tracking, wrapped in an object so the render loop
// closure can update it across frames.
export interface FrameCounter {
  frameCount: number;
  fpsTime: number;
}

// ─── updateRenderStats ───────────────────────────────────────────────────────
// Updates FPS counter and pipeline debug stats every 500ms.
// Returns the (possibly updated) FrameCounter values.
export function updateRenderStats(params: {
  pipeline: WebGLRenderPipeline;
  debugEnabled: boolean;
  cameraRef: MutableRef<CameraController | null>;
  renderStartTime: number;
  setStats: (updater: (prev: any) => any) => void;
  setCameraDisplay: (pos: { x: number; y: number }) => void;
  counter: FrameCounter;
}): void {
  const {
    pipeline,
    debugEnabled,
    cameraRef,
    renderStartTime,
    setStats,
    setCameraDisplay,
    counter,
  } = params;

  const renderTime = performance.now() - renderStartTime;

  // Get tile count from pipeline stats
  const pipelineStats = pipeline.getStats();
  const samples = debugEnabled ? pipeline.getPassSamples() : undefined;
  const tileCount = pipelineStats.passTileCounts.background +
                    pipelineStats.passTileCounts.topBelow +
                    pipelineStats.passTileCounts.topAbove;

  counter.frameCount++;
  const now = performance.now();
  if (now - counter.fpsTime >= 500) {
    const fps = Math.round((counter.frameCount * 1000) / (now - counter.fpsTime));
    setStats((s: any) => ({
      ...s,
      tileCount,
      renderTimeMs: renderTime,
      fps,
      pipelineDebug: {
        tilesetVersion: pipelineStats.tilesetVersion,
        lastRenderedTilesetVersion: pipelineStats.lastRenderedTilesetVersion,
        needsFullRender: pipelineStats.needsFullRender,
        needsWarmupRender: pipelineStats.needsWarmupRender,
        lastViewHash: pipelineStats.lastViewHash,
        hasCachedInstances: pipelineStats.hasCachedInstances,
        tilesetsUploaded: pipelineStats.tilesetsUploaded,
        cachedInstances: pipelineStats.passTileCounts,
        lastRenderInfo: pipelineStats.lastRenderInfo,
        renderHistory: pipelineStats.renderHistory,
        renderMeta: pipelineStats.renderMeta,
        samples,
      },
    }));
    if (cameraRef.current) {
      const pos = cameraRef.current.getPosition();
      setCameraDisplay({ x: pos.x, y: pos.y });
    }

    counter.frameCount = 0;
    counter.fpsTime = now;
  }
}
