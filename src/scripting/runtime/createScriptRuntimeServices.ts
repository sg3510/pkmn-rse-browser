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

interface MutableRef<T> {
  current: T;
}

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
  activeScriptFieldEffectsRef: MutableRef<Map<string, Promise<void>>>;
  mewEmergingGrassEffectIdRef: MutableRef<string | null>;
  deoxysRockRenderDebugRef: MutableRef<{ active: boolean; startMs: number; lastLogMs: number }>;
  waitScriptFrames: (frames: number) => Promise<void>;
}

export function createScriptRuntimeServices(deps: ScriptRuntimeServicesDeps): ScriptRuntimeServices {
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
    },
    fieldEffects: {
      setArgument: () => {},
      run: (effectName) => {
        if (effectName !== 'FLDEFF_DESTROY_DEOXYS_ROCK') {
          return;
        }

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

        deps.activeScriptFieldEffectsRef.current.set(effectName, job);
        void job.finally(() => {
          const active = deps.activeScriptFieldEffectsRef.current.get(effectName);
          if (active === job) {
            deps.activeScriptFieldEffectsRef.current.delete(effectName);
          }
        });
      },
      wait: async (effectName) => {
        const active = deps.activeScriptFieldEffectsRef.current.get(effectName);
        if (active) {
          await active;
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
    },
    time: {
      runTimeBasedEvents: () => {
        deps.weatherManagerRef.current.syncWeatherCycleToCurrentDate(Date.now());
      },
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
