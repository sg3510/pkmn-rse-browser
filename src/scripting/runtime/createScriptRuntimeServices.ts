import type { ScriptRuntimeServices } from '../ScriptRunner';
import type { WorldSnapshot } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { WebGLSpriteRenderer } from '../../rendering/webgl/WebGLSpriteRenderer';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { FadeController } from '../../field/FadeController';
import type { PlayerController } from '../../game/PlayerController';
import type { CameraController } from '../../game/CameraController';
import type { WeatherManager } from '../../weather/WeatherManager';
import { setFixedDiveWarpTarget } from '../../game/FixedDiveWarp';
import { GBA_FRAME_MS } from '../../config/timing';
import { createLegendaryScriptServices } from '../../game/legendary/createLegendaryScriptServices';
import type { ScriptFieldEffectAnimationManager } from '../../game/ScriptFieldEffectAnimationManager';
import type { OrbEffectRuntime } from '../../game/scriptEffects/orbEffectRuntime';
import {
  MIRAGE_TOWER_COLLAPSE_ANCHOR,
  type MirageTowerCollapseRuntime,
} from '../../game/scriptEffects/mirageTowerCollapseRuntime';
import { berryManager } from '../../game/berry/BerryManager.ts';
import { saveManager } from '../../save/SaveManager';
import type { LocationState } from '../../save/types';

interface MutableRef<T> {
  current: T;
}

const TILE_PIXELS = 16;

export interface ScriptRuntimeServicesDeps {
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  spriteRendererRef: MutableRef<WebGLSpriteRenderer | null>;
  pipelineRef: MutableRef<WebGLRenderPipeline | null>;
  fadeControllerRef: MutableRef<FadeController>;
  playerRef: MutableRef<PlayerController | null>;
  cameraRef: MutableRef<CameraController | null>;
  weatherManagerRef: MutableRef<WeatherManager>;
  scriptedCameraStateRef: MutableRef<{ active: boolean; focusX: number; focusY: number }>;
  scriptedCameraMoveTokenRef: MutableRef<number>;
  scriptedCameraShakeTokenRef: MutableRef<number>;
  activeScriptFieldEffectsRef: MutableRef<Map<string, Set<Promise<void>>>>;
  scriptFieldEffectAnimationManagerRef: MutableRef<ScriptFieldEffectAnimationManager>;
  orbEffectRuntimeRef: MutableRef<OrbEffectRuntime>;
  mirageTowerCollapseRuntimeRef: MutableRef<MirageTowerCollapseRuntime>;
  mewEmergingGrassEffectIdRef: MutableRef<string | null>;
  deoxysRockRenderDebugRef: MutableRef<{ active: boolean; startMs: number; lastLogMs: number }>;
  waitScriptFrames: (frames: number) => Promise<void>;
}

export function createScriptRuntimeServices(deps: ScriptRuntimeServicesDeps): ScriptRuntimeServices {
  const FALLING_PLAYER_LOCAL_ID = 'LOCALID_ROUTE111_PLAYER_FALLING';
  const FALL_SPEED_PX_PER_FRAME = 4;

  const getMovementDirection = (step: string): 'up' | 'down' | 'left' | 'right' | null => {
    if (step.endsWith('_up')) return 'up';
    if (step.endsWith('_down')) return 'down';
    if (step.endsWith('_left')) return 'left';
    if (step.endsWith('_right')) return 'right';
    return null;
  };

  const getMovementStepFrames = (step: string): number => {
    if (step.startsWith('walk_slow_')) return 32;
    if (step.startsWith('walk_fast_') || step.startsWith('player_run_')) return 8;
    if (step.startsWith('walk_faster_') || step.startsWith('walk_fastest_') || step.startsWith('slide_')) return 4;
    if (step.startsWith('walk_') || step.startsWith('jump_')) return 16;
    if (step.startsWith('delay_')) {
      const parsed = Number.parseInt(step.replace('delay_', ''), 10);
      return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
    }
    return 1;
  };

  const registerActiveFieldEffectJob = (effectName: string, job: Promise<void>): void => {
    let activeJobs = deps.activeScriptFieldEffectsRef.current.get(effectName);
    if (!activeJobs) {
      activeJobs = new Set<Promise<void>>();
      deps.activeScriptFieldEffectsRef.current.set(effectName, activeJobs);
    }
    activeJobs.add(job);
    void job.finally(() => {
      const active = deps.activeScriptFieldEffectsRef.current.get(effectName);
      if (!active) return;
      active.delete(job);
      if (active.size === 0) {
        deps.activeScriptFieldEffectsRef.current.delete(effectName);
      }
    });
  };

  const resolveMapOffset = (mapId: string): { offsetX: number; offsetY: number } | null => {
    const snapshot = deps.worldSnapshotRef.current;
    const map = snapshot?.maps.find((entry) => entry.entry.id === mapId);
    if (map) {
      return { offsetX: map.offsetX, offsetY: map.offsetY };
    }

    const parsedOffset = deps.objectEventManagerRef.current.getMapOffset(mapId);
    if (!parsedOffset) return null;
    return { offsetX: parsedOffset.x, offsetY: parsedOffset.y };
  };

  const startMirageTowerShake = async (): Promise<void> => {
    const offset = resolveMapOffset(MIRAGE_TOWER_COLLAPSE_ANCHOR.mapId);
    if (!offset) {
      return;
    }

    const worldX = (offset.offsetX + MIRAGE_TOWER_COLLAPSE_ANCHOR.tileX) * TILE_PIXELS;
    const worldY = (offset.offsetY + MIRAGE_TOWER_COLLAPSE_ANCHOR.tileY) * TILE_PIXELS;
    await deps.mirageTowerCollapseRuntimeRef.current.startShake(worldX, worldY);
  };

  const startMirageTowerPlayerDescend = async (): Promise<void> => {
    const mapId = MIRAGE_TOWER_COLLAPSE_ANCHOR.mapId;
    const objectManager = deps.objectEventManagerRef.current;
    const fallingNpc = objectManager.getNPCByLocalId(mapId, FALLING_PLAYER_LOCAL_ID);
    const player = deps.playerRef.current;
    if (!fallingNpc || !player) {
      await deps.waitScriptFrames(24);
      return;
    }

    objectManager.setNPCVisibilityByLocalId(mapId, FALLING_PLAYER_LOCAL_ID, true);
    objectManager.setNPCSpriteHiddenByLocalId(mapId, FALLING_PLAYER_LOCAL_ID, false);
    const mapOffset = resolveMapOffset(mapId);
    const startWorldY = mapOffset
      ? mapOffset.offsetY + MIRAGE_TOWER_COLLAPSE_ANCHOR.tileY
      : fallingNpc.tileY;
    fallingNpc.direction = 'down';
    fallingNpc.tileX = player.tileX;
    fallingNpc.tileY = startWorldY;
    fallingNpc.subTileX = 0;
    fallingNpc.subTileY = 0;
    fallingNpc.isWalking = true;

    let fallPixelY = fallingNpc.tileY * TILE_PIXELS + fallingNpc.subTileY - TILE_PIXELS;
    const targetPixelY = player.y;
    let guard = 0;
    while (fallPixelY < targetPixelY && guard < 240) {
      fallPixelY += FALL_SPEED_PX_PER_FRAME;
      const anchoredY = fallPixelY + TILE_PIXELS;
      const tileY = Math.floor(anchoredY / TILE_PIXELS);
      fallingNpc.tileY = tileY;
      fallingNpc.subTileY = anchoredY - tileY * TILE_PIXELS;
      guard++;
      await deps.waitScriptFrames(1);
    }

    const finalAnchoredY = Math.round(Math.max(fallPixelY, targetPixelY) + TILE_PIXELS);
    const finalTileY = Math.floor(finalAnchoredY / TILE_PIXELS);
    fallingNpc.tileY = finalTileY;
    fallingNpc.subTileY = finalAnchoredY - finalTileY * TILE_PIXELS;
    fallingNpc.isWalking = false;
  };

  const findMapContainingPlayer = (
    snapshot: WorldSnapshot,
    tileX: number,
    tileY: number
  ): WorldSnapshot['maps'][number] | null => {
    for (const map of snapshot.maps) {
      const minX = map.offsetX;
      const minY = map.offsetY;
      const maxX = map.offsetX + map.mapData.width;
      const maxY = map.offsetY + map.mapData.height;
      if (tileX >= minX && tileX < maxX && tileY >= minY && tileY < maxY) {
        return map;
      }
    }

    return snapshot.maps.find((map) => map.entry.id === snapshot.anchorMapId) ?? snapshot.maps[0] ?? null;
  };

  const buildLocationStateForSave = (): LocationState | null => {
    const snapshot = deps.worldSnapshotRef.current;
    const player = deps.playerRef.current;
    if (!snapshot || !player) {
      return null;
    }

    const mapInstance = findMapContainingPlayer(snapshot, player.tileX, player.tileY);
    const mapId = mapInstance?.entry.id ?? snapshot.anchorMapId;
    const localX = mapInstance ? player.tileX - mapInstance.offsetX : player.tileX;
    const localY = mapInstance ? player.tileY - mapInstance.offsetY : player.tileY;

    return {
      pos: { x: localX, y: localY },
      location: { mapId, warpId: 0, x: localX, y: localY },
      continueGameWarp: { mapId, warpId: 0, x: localX, y: localY },
      lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
      direction: player.getFacingDirection(),
      elevation: player.getElevation(),
      isSurfing: player.isSurfing(),
      isUnderwater: player.isUnderwater(),
      bikeMode: player.getBikeMode(),
      isRidingBike: player.isBikeRiding(),
    };
  };

  const runScriptSaveGame = (): boolean => {
    const locationState = buildLocationStateForSave();
    if (!locationState) {
      return false;
    }

    const runtimeState = deps.objectEventManagerRef.current.getRuntimeState();
    const result = saveManager.save(0, locationState, runtimeState);
    return result.success;
  };

  return {
    setDiveWarp: (mapId, x, y, warpId = 0) => {
      setFixedDiveWarpTarget(mapId, x, y, warpId);
    },
    fade: {
      start: (direction, durationMs) => {
        const now = performance.now();
        if (direction === 'out') {
          deps.fadeControllerRef.current.startFadeOut(durationMs, now);
          return;
        }
        deps.fadeControllerRef.current.startFadeIn(durationMs, now);
      },
      wait: async (durationMs) => {
        const delayMs = Math.max(1, Math.round(durationMs));
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      },
      framesToMs: (frames) => {
        const frameCount = Math.max(1, Math.round(frames));
        return Math.max(1, Math.round(frameCount * GBA_FRAME_MS));
      },
      getDirection: () => deps.fadeControllerRef.current.getDirection(),
      isActive: () => deps.fadeControllerRef.current.isActive(),
      isComplete: () => deps.fadeControllerRef.current.isComplete(performance.now()),
    },
    fieldEffects: {
      setArgument: () => {},
      run: (effectName, args, context) => {
        if (effectName === 'FLDEFF_NPCFLY_OUT') {
          const job = deps.scriptFieldEffectAnimationManagerRef.current.start(effectName, args);
          registerActiveFieldEffectJob(effectName, job);
          return;
        }

        if (
          effectName === 'FLDEFF_EXCLAMATION_MARK_ICON'
          || effectName === 'FLDEFF_QUESTION_MARK_ICON'
          || effectName === 'FLDEFF_HEART_ICON'
        ) {
          const localId = args.get(0);
          const mapId = typeof args.get(1) === 'string' && String(args.get(1)).startsWith('MAP_')
            ? String(args.get(1))
            : context?.mapId;

          const normalizedArgs = new Map<number, string | number>(args);
          if (
            localId !== undefined
            && (localId === 'LOCALID_PLAYER' || localId === '255' || typeof localId === 'number')
          ) {
            normalizedArgs.set(0, localId);
          } else if (typeof localId === 'string' && localId.length > 0) {
            normalizedArgs.set(0, localId);
          }

          if (mapId) {
            normalizedArgs.set(1, mapId);
          }

          const job = deps.scriptFieldEffectAnimationManagerRef.current.start(effectName, normalizedArgs);
          registerActiveFieldEffectJob(effectName, job);
          return;
        }

        if (effectName === 'FLDEFF_SPARKLE') {
          const tileX = Number(args.get(0));
          const tileY = Number(args.get(1));
          const priority = Number(args.get(2) ?? 0);
          if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
            return;
          }

          let worldTileX = Math.trunc(tileX);
          let worldTileY = Math.trunc(tileY);
          const mapId = context?.mapId;
          if (mapId) {
            const offset = resolveMapOffset(mapId);
            if (offset) {
              worldTileX = offset.offsetX + Math.trunc(tileX);
              worldTileY = offset.offsetY + Math.trunc(tileY);
            }
          }

          const sparkleArgs = new Map<number, string | number>([
            [0, worldTileX],
            [1, worldTileY],
            [2, Number.isFinite(priority) ? Math.trunc(priority) : 0],
          ]);
          const job = deps.scriptFieldEffectAnimationManagerRef.current.start(effectName, sparkleArgs);
          registerActiveFieldEffectJob(effectName, job);
          return;
        }

        if (effectName === 'FLDEFF_DESTROY_DEOXYS_ROCK') {
          const job = (async () => {
            // C parity approximation for Task_DestroyDeoxysRock timing.
            await deps.waitScriptFrames(120);
            deps.objectEventManagerRef.current.setNPCVisibilityByLocalId(
              'MAP_BIRTH_ISLAND_EXTERIOR',
              'LOCALID_BIRTH_ISLAND_EXTERIOR_ROCK',
              false
            );
            deps.pipelineRef.current?.invalidate();
            await deps.waitScriptFrames(20);
          })();

          registerActiveFieldEffectJob(effectName, job);
          return;
        }
      },
      wait: async (effectName) => {
        const active = deps.activeScriptFieldEffectsRef.current.get(effectName);
        if (active && active.size > 0) {
          await Promise.all([...active]);
          return;
        }

        if (
          effectName === 'FLDEFF_NPCFLY_OUT'
          || effectName === 'FLDEFF_SPARKLE'
          || effectName === 'FLDEFF_EXCLAMATION_MARK_ICON'
          || effectName === 'FLDEFF_QUESTION_MARK_ICON'
          || effectName === 'FLDEFF_HEART_ICON'
        ) {
          await deps.scriptFieldEffectAnimationManagerRef.current.wait(effectName);
        }
      },
    },
    weather: {
      setCurrentMapContext: (mapId) => {
        deps.weatherManagerRef.current.setCurrentMap(mapId);
      },
      setSavedWeather: (weather) => {
        deps.weatherManagerRef.current.setSavedWeather(weather);
      },
      resetSavedWeather: () => {
        deps.weatherManagerRef.current.setSavedWeatherToMapDefault();
      },
      applyCurrentWeather: () => {
        deps.weatherManagerRef.current.doCurrentWeather();
      },
      waitForChangeComplete: async () => {},
    },
    time: {
      runTimeBasedEvents: () => {
        berryManager.runTimeBasedEvents(Date.now());
        deps.weatherManagerRef.current.syncWeatherCycleToCurrentDate(Date.now());
      },
    },
    screenEffects: {
      startOrbEffect: (resultVar) => deps.orbEffectRuntimeRef.current.start(resultVar),
      fadeOutOrbEffect: () => deps.orbEffectRuntimeRef.current.fadeOut(),
    },
    save: {
      saveGame: runScriptSaveGame,
    },
    mirageTower: {
      startShake: startMirageTowerShake,
      startPlayerDescend: startMirageTowerPlayerDescend,
      startDisintegration: () => deps.mirageTowerCollapseRuntimeRef.current.startDisintegration(),
      clear: () => deps.mirageTowerCollapseRuntimeRef.current.clear(),
    },
    camera: {
      spawnObject: () => {
        const player = deps.playerRef.current;
        if (!player) return;
        const focus = player.getCameraFocus();
        deps.scriptedCameraStateRef.current.active = true;
        deps.scriptedCameraStateRef.current.focusX = focus.x;
        deps.scriptedCameraStateRef.current.focusY = focus.y;
      },
      removeObject: () => {
        deps.scriptedCameraStateRef.current.active = false;
        deps.scriptedCameraMoveTokenRef.current++;
        deps.scriptedCameraShakeTokenRef.current++;
        deps.cameraRef.current?.resetPanning();
      },
      applyMovement: async (steps) => {
        const player = deps.playerRef.current;
        if (!player) return;
        if (!deps.scriptedCameraStateRef.current.active) {
          const focus = player.getCameraFocus();
          deps.scriptedCameraStateRef.current.active = true;
          deps.scriptedCameraStateRef.current.focusX = focus.x;
          deps.scriptedCameraStateRef.current.focusY = focus.y;
        }

        const token = ++deps.scriptedCameraMoveTokenRef.current;
        for (const step of steps) {
          if (token !== deps.scriptedCameraMoveTokenRef.current) break;

          const direction = getMovementDirection(step);
          const frames = getMovementStepFrames(step);
          if (!direction) {
            await deps.waitScriptFrames(frames);
            continue;
          }

          const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
          const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;

          const startX = deps.scriptedCameraStateRef.current.focusX;
          const startY = deps.scriptedCameraStateRef.current.focusY;
          const targetX = startX + dx * 16;
          const targetY = startY + dy * 16;

          for (let frame = 1; frame <= frames; frame++) {
            if (token !== deps.scriptedCameraMoveTokenRef.current) break;
            const progress = frame / frames;
            deps.scriptedCameraStateRef.current.focusX = startX + (targetX - startX) * progress;
            deps.scriptedCameraStateRef.current.focusY = startY + (targetY - startY) * progress;
            await deps.waitScriptFrames(1);
          }

          deps.scriptedCameraStateRef.current.focusX = targetX;
          deps.scriptedCameraStateRef.current.focusY = targetY;
        }
      },
      shake: async (request) => {
        const token = ++deps.scriptedCameraShakeTokenRef.current;
        const delay = Math.max(1, request.delayFrames);
        let horizontalPan = request.horizontalPan;
        let verticalPan = request.verticalPan;
        for (let i = 0; i < Math.max(0, request.numShakes); i++) {
          if (token !== deps.scriptedCameraShakeTokenRef.current) break;
          await deps.waitScriptFrames(delay);
          horizontalPan = -horizontalPan;
          verticalPan = -verticalPan;
          deps.cameraRef.current?.setPanning(horizontalPan, verticalPan);
        }
        if (token === deps.scriptedCameraShakeTokenRef.current) {
          deps.cameraRef.current?.resetPanning();
        }
      },
    },
    legendary: createLegendaryScriptServices({
      worldSnapshotRef: deps.worldSnapshotRef,
      objectEventManagerRef: deps.objectEventManagerRef,
      spriteRendererRef: deps.spriteRendererRef,
      pipelineRef: deps.pipelineRef,
      playerRef: deps.playerRef,
      mewEmergingGrassEffectIdRef: deps.mewEmergingGrassEffectIdRef,
      deoxysRockRenderDebugRef: deps.deoxysRockRenderDebugRef,
    }),
  };
}
