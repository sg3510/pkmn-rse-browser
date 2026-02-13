import type { ObjectEventManager } from '../ObjectEventManager';
import type { PlayerController } from '../PlayerController';
import type { WorldSnapshot } from '../WorldManager';
import type { WebGLRenderPipeline } from '../../rendering/webgl/WebGLRenderPipeline';
import type { WebGLSpriteRenderer } from '../../rendering/webgl/WebGLSpriteRenderer';
import type { ScriptLegendarySpecialServices } from '../../scripting/specials/legendaryIslandSpecials';
import { GBA_FRAME_MS } from '../../config/timing';
import { gameVariables } from '../GameVariables';
import { npcSpriteCache } from '../npc/NPCSpriteLoader';
import { getNPCAtlasName } from '../../rendering/spriteUtils';
import { getDeoxysRockPaletteCanvas } from './deoxysRockPaletteRuntime';

interface MutableRef<T> {
  current: T;
}

export interface LegendaryScriptServicesDeps {
  worldSnapshotRef: MutableRef<WorldSnapshot | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  spriteRendererRef: MutableRef<WebGLSpriteRenderer | null>;
  pipelineRef: MutableRef<WebGLRenderPipeline | null>;
  playerRef: MutableRef<PlayerController | null>;
  mewEmergingGrassEffectIdRef: MutableRef<string | null>;
  deoxysRockRenderDebugRef: MutableRef<{ active: boolean; startMs: number; lastLogMs: number }>;
}

export function createLegendaryScriptServices(
  deps: LegendaryScriptServicesDeps
): ScriptLegendarySpecialServices {
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
      const travelPixels = Math.max(Math.abs(deltaPixelsX), Math.abs(deltaPixelsY));
      const minimumVisibleSteps = Math.min(40, Math.max(16, Math.ceil(travelPixels / 2)));
      const interpolatedSteps = request.failedReset
        ? requestedSteps
        : Math.max(requestedSteps, minimumVisibleSteps);

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
  };
}
