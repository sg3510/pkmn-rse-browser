import type { ScriptRuntimeServices } from '../../scripting/ScriptRunner';
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
import { gameVariables } from '../../game/GameVariables';
import { npcSpriteCache } from '../../game/npc/NPCSpriteLoader';
import { getNPCAtlasName } from '../../rendering/spriteUtils';
import { getDeoxysRockPaletteCanvas } from '../../game/legendary/deoxysRockPaletteRuntime';

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
  const getWorldCoordsForLocal = (
    mapId: string,
    localX: number,
    localY: number
  ): { x: number; y: number } | null => {
    const map = deps.worldSnapshotRef.current?.maps.find((entry) => entry.entry.id === mapId);
    if (!map) return null;
    return {
      x: map.offsetX + localX,
      y: map.offsetY + localY,
    };
  };

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

  const waitForRenderFrame = async (): Promise<void> => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  };

  const setRockTintFallbackForLevel = (level: number): void => {
    const normalized = Math.max(0, Math.min(10, Math.round(level)));
    const intensity = normalized / 10;
    const tintG = 1 - intensity * 0.45;
    const tintB = 1 - intensity * 0.45;
    deps.objectEventManagerRef.current.setNPCTintByLocalId(
      'MAP_BIRTH_ISLAND_EXTERIOR',
      'LOCALID_BIRTH_ISLAND_EXTERIOR_ROCK',
      1,
      tintG,
      tintB
    );
  };

  const applyDeoxysRockPaletteLevel = async (level: number): Promise<void> => {
    const variant = await getDeoxysRockPaletteCanvas(level);
    if (!variant) {
      setRockTintFallbackForLevel(level);
      return;
    }

    const graphicsIds = [
      'OBJ_EVENT_GFX_DEOXYS_TRIANGLE',
      'OBJ_EVENT_GFX_BIRTH_ISLAND_STONE',
    ];

    for (const graphicsId of graphicsIds) {
      npcSpriteCache.setRuntimeSpriteVariant(graphicsId, variant);
    }

    // Exact palette replacement should render un-tinted.
    deps.objectEventManagerRef.current.setNPCTintByLocalId(
      'MAP_BIRTH_ISLAND_EXTERIOR',
      'LOCALID_BIRTH_ISLAND_EXTERIOR_ROCK',
      1,
      1,
      1
    );

    const renderer = deps.spriteRendererRef.current;
    if (renderer) {
      for (const graphicsId of graphicsIds) {
        const sprite = npcSpriteCache.get(graphicsId);
        if (!sprite) continue;
        const dims = npcSpriteCache.getDimensions(graphicsId);
        renderer.uploadSpriteSheet(getNPCAtlasName(graphicsId), sprite, {
          frameWidth: dims.frameWidth,
          frameHeight: dims.frameHeight,
        });
      }
    }

    deps.pipelineRef.current?.invalidate();
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
    legendary: {
      setDeoxysRockPalette: async (level) => {
        await applyDeoxysRockPaletteLevel(level);
      },
      setDeoxysRockLevel: async (request) => {
        const mapId = 'MAP_BIRTH_ISLAND_EXTERIOR';
        const localId = 'LOCALID_BIRTH_ISLAND_EXTERIOR_ROCK';
        const objectManager = deps.objectEventManagerRef.current;
        const npc = objectManager.getNPCByLocalId(mapId, localId);
        const targetCoords = getWorldCoordsForLocal(mapId, request.x, request.y);
        if (!npc || !targetCoords) {
          console.warn(
            `[Legendary] Deoxys rock move skipped (npc=${Boolean(npc)} target=${Boolean(targetCoords)})`
          );
          return;
        }

        await applyDeoxysRockPaletteLevel(request.level);

        const originalMovementTypeRaw = npc.movementTypeRaw;
        // Prevent normal NPC movement handlers from racing scripted interpolation.
        objectManager.setNPCMovementTypeByLocalId(mapId, localId, 'MOVEMENT_TYPE_NONE');
        console.log('[Legendary] Deoxys rock movement lock', {
          fromMovementType: originalMovementTypeRaw,
        });
        const controlledNpc = objectManager.getNPCByLocalId(mapId, localId);
        if (!controlledNpc) {
          console.warn('[Legendary] Deoxys rock move aborted (lost NPC after movement lock)');
          return;
        }

        const startTileX = controlledNpc.tileX;
        const startTileY = controlledNpc.tileY;
        const startPixelX = startTileX * 16 + (controlledNpc.subTileX ?? 0);
        const startPixelY = startTileY * 16 + (controlledNpc.subTileY ?? 0);
        const targetPixelX = targetCoords.x * 16;
        const targetPixelY = targetCoords.y * 16;
        const deltaPixelsX = targetPixelX - startPixelX;
        const deltaPixelsY = targetPixelY - startPixelY;
        const requestedSteps = Math.max(1, Math.round(request.stepDelayFrames));
        // Keep successful movement quick, but dense enough that each frame moves only a
        // couple of pixels for visible smoothness in browser rendering.
        const travelPixels = Math.max(Math.abs(deltaPixelsX), Math.abs(deltaPixelsY));
        const minimumVisibleSteps = Math.min(40, Math.max(16, Math.ceil(travelPixels / 2)));
        const interpolatedSteps = request.failedReset
          ? requestedSteps
          : Math.max(requestedSteps, minimumVisibleSteps);

        // C parity with Task_MoveDeoxysRock: fixed-point interpolation over tMoveSteps.
        let curX = startPixelX << 4;
        let curY = startPixelY << 4;
        const targetXFixed = targetPixelX << 4;
        const targetYFixed = targetPixelY << 4;
        const velocityX = Math.trunc((targetXFixed - curX) / interpolatedSteps);
        const velocityY = Math.trunc((targetYFixed - curY) / interpolatedSteps);

        controlledNpc.tileX = startTileX;
        controlledNpc.tileY = startTileY;
        controlledNpc.isWalking = true;
        controlledNpc.renderAboveGrass = true;

        const startedAtMs = performance.now();
        try {
          console.log('[Legendary] Deoxys rock move start', {
            level: request.level,
            failedReset: request.failedReset,
            requestedSteps,
            interpolatedSteps,
            startTileX,
            startTileY,
            targetTileX: targetCoords.x,
            targetTileY: targetCoords.y,
            dxPixels: deltaPixelsX,
            dyPixels: deltaPixelsY,
          });
          deps.deoxysRockRenderDebugRef.current.active = true;
          deps.deoxysRockRenderDebugRef.current.startMs = startedAtMs;
          deps.deoxysRockRenderDebugRef.current.lastLogMs = 0;

          let stepIndex = 0;
          let previousStepMs = startedAtMs;
          let previousRenderMs = startedAtMs;
          let accumulatedMs = 0;
          while (stepIndex < interpolatedSteps) {
            // Present every movement sample on an actual render frame, then advance at
            // GBA cadence (60 Hz) using an accumulator to avoid timer jitter.
            await waitForRenderFrame();
            const nowMs = performance.now();
            accumulatedMs += nowMs - previousRenderMs;
            previousRenderMs = nowMs;

            if (accumulatedMs + 0.001 < GBA_FRAME_MS) {
              continue;
            }

            accumulatedMs -= GBA_FRAME_MS;
            stepIndex++;
            curX += velocityX;
            curY += velocityY;
            const pixelX = curX >> 4;
            const pixelY = curY >> 4;
            controlledNpc.subTileX = pixelX - startTileX * 16;
            controlledNpc.subTileY = pixelY - startTileY * 16;
            deps.pipelineRef.current?.invalidate();

            const stepDeltaMs = Math.round(nowMs - previousStepMs);
            previousStepMs = nowMs;
            if (stepIndex === 1 || stepIndex === interpolatedSteps || stepIndex % 4 === 0) {
              console.log('[Legendary] Deoxys rock move frame', {
                step: stepIndex,
                totalSteps: interpolatedSteps,
                subTileX: controlledNpc.subTileX,
                subTileY: controlledNpc.subTileY,
                stepDeltaMs,
              });
            }
          }

          controlledNpc.tileX = targetCoords.x;
          controlledNpc.tileY = targetCoords.y;
          controlledNpc.initialTileX = targetCoords.x;
          controlledNpc.initialTileY = targetCoords.y;
          controlledNpc.subTileX = 0;
          controlledNpc.subTileY = 0;
          controlledNpc.isWalking = false;
          deps.pipelineRef.current?.invalidate();

          const durationMs = Math.round(performance.now() - startedAtMs);
          console.log('[Legendary] Deoxys rock move end', {
            tileX: controlledNpc.tileX,
            tileY: controlledNpc.tileY,
            durationMs,
          });
          deps.deoxysRockRenderDebugRef.current.active = false;
        } finally {
          objectManager.setNPCMovementTypeByLocalId(mapId, localId, originalMovementTypeRaw);
          console.log('[Legendary] Deoxys rock movement unlock', {
            toMovementType: originalMovementTypeRaw,
          });
        }
      },
      setMewAboveGrass: async (mode) => {
        const mapId = 'MAP_FARAWAY_ISLAND_INTERIOR';
        const localId = 'LOCALID_FARAWAY_ISLAND_MEW';
        const objectManager = deps.objectEventManagerRef.current;
        objectManager.setNPCVisibilityByLocalId(mapId, localId, true);
        objectManager.setNPCSpriteHiddenByLocalId(mapId, localId, false);
        objectManager.setNPCRenderAboveGrassByLocalId(mapId, localId, true);

        if (mode === 1) {
          objectManager.setNPCMovementTypeByLocalId(
            mapId,
            localId,
            'MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE'
          );
          return;
        }

        gameVariables.setVar('VAR_FARAWAY_ISLAND_STEP_COUNTER', 0xffff);
        objectManager.setNPCMovementTypeByLocalId(
          mapId,
          localId,
          'MOVEMENT_TYPE_COPY_PLAYER_OPPOSITE_IN_GRASS'
        );

        const mew = objectManager.getNPCByLocalId(mapId, localId);
        const player = deps.playerRef.current;
        if (mew && player) {
          const fieldEffects = player.getGrassEffectManager();
          const priorEffectId = deps.mewEmergingGrassEffectIdRef.current;
          if (priorEffectId) {
            fieldEffects.removeEffectById(priorEffectId);
          }
          deps.mewEmergingGrassEffectIdRef.current = fieldEffects.create(
            mew.tileX,
            mew.tileY,
            'long',
            false,
            'mew_emerging_grass'
          );
        }
      },
      destroyMewEmergingGrassSprite: async () => {
        const effectId = deps.mewEmergingGrassEffectIdRef.current;
        const player = deps.playerRef.current;
        if (effectId && player) {
          player.getGrassEffectManager().removeEffectById(effectId);
        }
        deps.mewEmergingGrassEffectIdRef.current = null;
      },
    },
  };
}
