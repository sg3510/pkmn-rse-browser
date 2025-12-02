/**
 * useRunUpdate Hook
 *
 * Provides the main game update loop logic.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 *
 * HIGH RISK: This function has many dependencies and closure variables.
 * Changes should be tested thoroughly.
 */

import { useCallback, useRef, type RefObject } from 'react';
import { METATILE_SIZE } from '../utils/mapLoader';
import { computeCameraView } from '../utils/camera';
import { buildWorldCameraView } from '../game/buildWorldCameraView';
import {
  resolveTileAt,
  computeReflectionState,
} from '../components/map/utils';
import { processWarpTrigger, updateWarpHandlerTile } from '../game/WarpTriggerProcessor';
import type { RenderContext, ReflectionState, TilesetRuntime, ResolvedTile } from '../components/map/types';
import type { CardinalDirection } from '../utils/metatileBehaviors';
import type { WorldCameraView } from '../components/MapRendererTypes';
import type { ViewportConfig } from '../config/viewport';
import type { PlayerController } from '../game/PlayerController';
import type { WarpHandler } from '../field/WarpHandler';
import type { FadeController } from '../field/FadeController';
import type { TilesetCanvasCache } from '../rendering/TilesetCanvasCache';
import type { IRenderPipeline } from '../rendering/IRenderPipeline';
import type { AnimationTimer } from '../engine/AnimationTimer';
import type { MapManager, WorldState } from '../services/MapManager';
import type { UseDoorAnimationsReturn } from './useDoorAnimations';
import type { UseArrowOverlayReturn } from './useArrowOverlay';
import type { WarpTrigger } from '../components/map/utils';
import type { DebugOptions } from '../components/debug';

// Helper to check if debug mode is enabled
const DEBUG_MODE_FLAG = 'DEBUG_DOOR';
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

/** Animation state for tileset animations */
interface AnimationState {
  [animId: string]: number;
}

/** Result returned by runUpdate */
export interface UpdateResult {
  needsRender: boolean;
  viewChanged: boolean;
  animationFrameChanged: boolean;
  playerDirty: boolean;
}

/** Frame result stored for rendering */
export interface EngineFrameResult {
  view: WorldCameraView | null;
  viewChanged: boolean;
  animationFrameChanged: boolean;
  shouldRender: boolean;
  timestamp: number;
}

/** All the refs needed by runUpdate */
export interface RunUpdateRefs {
  renderGenerationRef: RefObject<number>;
  lastFrameResultRef: RefObject<EngineFrameResult | null>;
  renderContextRef: RefObject<RenderContext | null>;
  currentTimestampRef: RefObject<number>;
  playerControllerRef: RefObject<PlayerController | null>;
  cameraViewRef: RefObject<WorldCameraView | null>;
  lastViewKeyRef: RefObject<string>;
  animationTimerRef: RefObject<AnimationTimer | null>;
  tilesetCacheRef: RefObject<TilesetCanvasCache | null>;
  hasRenderedRef: RefObject<boolean>;
  fadeRef: RefObject<FadeController>;
  debugOptionsRef: RefObject<DebugOptions>;
  reflectionStateRef: RefObject<ReflectionState | null>;
  mapManagerRef: RefObject<MapManager>;
  renderPipelineRef: RefObject<IRenderPipeline | null>;
}

/** Callbacks needed by runUpdate - passed at creation time since they're defined in useEffect */
export interface RunUpdateCallbacks {
  advanceDoorEntry: (timestamp: number) => void;
  advanceDoorExit: (timestamp: number) => void;
  startAutoDoorWarp: (
    trigger: WarpTrigger,
    resolved: ResolvedTile,
    player: PlayerController,
    entryDirection?: CardinalDirection,
    options?: { isAnimatedDoor?: boolean }
  ) => boolean;
  performWarp: (trigger: WarpTrigger) => Promise<void>;
  rebuildContextForWorld: (world: WorldState, anchorId: string) => Promise<void>;
  applyTileResolver: () => void;
  applyPipelineResolvers: () => void;
  buildPatchedTilesForRuntime: (runtime: TilesetRuntime, animationState: AnimationState) => void;
  shiftWorld: (world: WorldState, offsetX: number, offsetY: number) => WorldState;
}

/** Hook configuration - stable dependencies only */
export interface UseRunUpdateOptions {
  refs: RunUpdateRefs;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
  warpHandler: WarpHandler;
  viewportConfig: ViewportConfig;
  connectionDepth: number;
}

export interface UseRunUpdateReturn {
  /** Create a runUpdate function bound to a specific generation and callbacks */
  createRunUpdate: (generation: number, callbacks: RunUpdateCallbacks) => (deltaMs: number, timestamp: number) => UpdateResult;
}

/**
 * Hook providing the main game update loop logic
 */
export function useRunUpdate(options: UseRunUpdateOptions): UseRunUpdateReturn {
  const {
    refs,
    doorAnimations,
    arrowOverlay,
    warpHandler,
    viewportConfig,
    connectionDepth,
  } = options;

  // Track re-anchor state (mutable ref to avoid closure issues)
  const reanchorInFlightRef = useRef(false);

  const createRunUpdate = useCallback(
    (generation: number, callbacks: RunUpdateCallbacks) => {
      return (deltaMs: number, timestamp: number): UpdateResult => {
        // Check if this update is stale (component re-rendered)
        if (generation !== refs.renderGenerationRef.current) {
          if (refs.lastFrameResultRef.current !== undefined) {
            (refs.lastFrameResultRef as { current: EngineFrameResult | null }).current = {
              view: null,
              viewChanged: false,
              animationFrameChanged: false,
              shouldRender: false,
              timestamp,
            };
          }
          return { needsRender: false, viewChanged: false, animationFrameChanged: false, playerDirty: false };
        }

        const ctx = refs.renderContextRef.current;
        if (!ctx) {
          if (refs.lastFrameResultRef.current !== undefined) {
            (refs.lastFrameResultRef as { current: EngineFrameResult | null }).current = {
              view: null,
              viewChanged: false,
              animationFrameChanged: false,
              shouldRender: false,
              timestamp,
            };
          }
          return { needsRender: false, viewChanged: false, animationFrameChanged: false, playerDirty: false };
        }

        const safeDelta = Math.min(deltaMs, 50);
        (refs.currentTimestampRef as { current: number }).current = timestamp;

        // DEBUG: Track player position at start of each update
        {
          const p = refs.playerControllerRef.current;
          if (p) {
            const posKey = `${p.tileX},${p.tileY},${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            if ((window as unknown as Record<string, unknown>).__lastPosKey !== posKey) {
              console.log(`[FRAME_POS] tile:(${p.tileX},${p.tileY}) pixel:(${p.x.toFixed(1)},${p.y.toFixed(1)}) moving:${p.isMoving} dir:${p.dir}`);
              (window as unknown as Record<string, unknown>).__lastPosKey = posKey;
            }
          }
        }

        doorAnimations.prune(timestamp);
        callbacks.advanceDoorEntry(timestamp);
        callbacks.advanceDoorExit(timestamp);
        warpHandler.update(safeDelta);
        const playerDirty = refs.playerControllerRef.current?.update(safeDelta) ?? false;
        const player = refs.playerControllerRef.current;

        if (player && ctx) {
          // Use shared WarpTriggerProcessor for unified warp detection
          const warpResult = processWarpTrigger({
            player,
            renderContext: ctx,
            warpHandler,
          });

          // Update warp handler's last checked tile if tile changed
          if (warpResult.tileChanged) {
            updateWarpHandlerTile(warpHandler, warpResult);

            // Debug logging for stair/ladder behaviors
            const behavior = warpResult.behavior ?? -1;
            if (isDebugMode() && (behavior === 96 || behavior === 97)) {
              console.log('[TILE_CHANGED_STAIR_LADDER]', {
                playerTile: { x: player.tileX, y: player.tileY },
                behavior: `0x${behavior.toString(16)} (${behavior})`,
                mapId: warpResult.currentTile?.mapId,
                warpInProgress: warpHandler.isInProgress(),
                warpOnCooldown: warpHandler.isOnCooldown(),
              });
            }
          }

          // Handle warp actions
          const action = warpResult.action;
          if (action.type === 'arrow') {
            if (isDebugMode()) {
              console.log('[DETECT_WARP] Arrow warp detected, waiting for player input');
            }
          } else if (action.type === 'autoDoorWarp') {
            callbacks.startAutoDoorWarp(action.trigger, action.resolvedTile, player, 'up', { isAnimatedDoor: false });
          } else if (action.type === 'walkOverWarp') {
            void callbacks.performWarp(action.trigger);
          }

          // Update arrow overlay
          const behavior = warpResult.behavior ?? -1;
          arrowOverlay.update(player.dir, player.tileX, player.tileY, behavior, timestamp, warpHandler.isInProgress());
        } else {
          arrowOverlay.hide();
        }

        // Calculate camera view
        let view: WorldCameraView | null = null;
        if (player) {
          const focus = player.getCameraFocus();
          if (focus) {
            const bounds = ctx.world.bounds;
            const padX = viewportConfig.tilesWide;
            const padY = viewportConfig.tilesHigh;
            const paddedMinX = bounds.minX - padX;
            const paddedMinY = bounds.minY - padY;
            const paddedMaxX = bounds.maxX + padX;
            const paddedMaxY = bounds.maxY + padY;
            const worldWidth = paddedMaxX - paddedMinX;
            const worldHeight = paddedMaxY - paddedMinY;
            const baseView = computeCameraView(
              worldWidth,
              worldHeight,
              focus.x - paddedMinX * METATILE_SIZE,
              focus.y - paddedMinY * METATILE_SIZE,
              viewportConfig
            );
            view = buildWorldCameraView(baseView, paddedMinX, paddedMinY);
          }
        }
        (refs.cameraViewRef as { current: WorldCameraView | null }).current = view;

        // DEBUG: Track camera position changes
        if (view) {
          const camKey = `${view.cameraWorldX.toFixed(1)},${view.cameraWorldY.toFixed(1)}`;
          if ((window as unknown as Record<string, unknown>).__lastCamKey !== camKey) {
            const prevCam = (window as unknown as Record<string, unknown>).__lastCamKey as string | undefined;
            if (prevCam) {
              const [prevX, prevY] = prevCam.split(',').map(Number);
              const deltaX = view.cameraWorldX - prevX;
              const deltaY = view.cameraWorldY - prevY;
              if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                console.log(`[CAMERA_JUMP] cam:(${prevX.toFixed(1)},${prevY.toFixed(1)}) -> (${view.cameraWorldX.toFixed(1)},${view.cameraWorldY.toFixed(1)}) delta:(${deltaX.toFixed(1)},${deltaY.toFixed(1)})`);
              }
            }
            (window as unknown as Record<string, unknown>).__lastCamKey = camKey;
          }
        }

        const viewKey = view
          ? `${view.worldStartTileX},${view.worldStartTileY},${view.tilesWide},${view.tilesHigh}`
          : '';
        const viewChanged = viewKey !== refs.lastViewKeyRef.current;
        if (viewChanged) {
          (refs.lastViewKeyRef as { current: string }).current = viewKey;
        }

        // Detect if player entered a different map; re-anchor world if needed
        if (!reanchorInFlightRef.current && player) {
          const resolved = resolveTileAt(ctx, player.tileX, player.tileY);
          if (resolved && resolved.map.entry.id !== ctx.anchor.entry.id) {
            reanchorInFlightRef.current = true;
            const targetId = resolved.map.entry.id;
            const targetOffsetX = resolved.map.offsetX;
            const targetOffsetY = resolved.map.offsetY;
            console.log(`[REANCHOR] Starting: player at tile(${player.tileX},${player.tileY}) pixel(${player.x.toFixed(1)},${player.y.toFixed(1)}) moving:${player.isMoving}`);

            (async () => {
              const newWorldRaw = await refs.mapManagerRef.current.buildWorld(targetId, connectionDepth);
              const newWorld = callbacks.shiftWorld(newWorldRaw, targetOffsetX, targetOffsetY);
              await callbacks.rebuildContextForWorld(newWorld, targetId);
              callbacks.applyTileResolver();
              callbacks.applyPipelineResolvers();
              refs.renderPipelineRef.current?.invalidate();

              const currentPlayer = refs.playerControllerRef.current;
              if (currentPlayer) {
                console.log(`[REANCHOR] Complete: player at tile(${currentPlayer.tileX},${currentPlayer.tileY}) pixel(${currentPlayer.x.toFixed(1)},${currentPlayer.y.toFixed(1)}) moving:${currentPlayer.isMoving}`);
                warpHandler.updateLastCheckedTile(currentPlayer.tileX, currentPlayer.tileY, targetId);
              }
              warpHandler.setCooldown(Math.max(warpHandler.getCooldownRemaining(), 50));
            })().finally(() => {
              reanchorInFlightRef.current = false;
            });
          }
        }

        // Animation state update
        const frameTick = refs.animationTimerRef.current?.getTickCount() ?? 0;
        let animationFrameChanged = false;
        for (const runtime of ctx.tilesetRuntimes.values()) {
          const animationState: AnimationState = {};
          for (const anim of runtime.animations) {
            const seqIndex = Math.floor(frameTick / anim.interval);
            animationState[anim.id] = seqIndex;
          }
          const prevKey = runtime.lastPatchedKey;
          callbacks.buildPatchedTilesForRuntime(runtime, animationState);
          if (runtime.lastPatchedKey !== prevKey) {
            animationFrameChanged = true;
          }
        }

        // Clear tileset cache when animation frames change
        if (animationFrameChanged && refs.tilesetCacheRef.current) {
          refs.tilesetCacheRef.current.clear();
        }

        const shouldRender =
          animationFrameChanged ||
          playerDirty ||
          !refs.hasRenderedRef.current ||
          viewChanged ||
          doorAnimations.getAnimations().length > 0 ||
          refs.fadeRef.current.isActive() ||
          arrowOverlay.isVisible() ||
          refs.debugOptionsRef.current.showCollisionOverlay ||
          refs.debugOptionsRef.current.showElevationOverlay;

        if (!shouldRender && player?.isMoving) {
          console.warn(`[RENDER_SKIP] Player moving but shouldRender=false! animChanged=${animationFrameChanged} playerDirty=${playerDirty} viewChanged=${viewChanged}`);
        }

        const reflectionState = computeReflectionState(ctx, refs.playerControllerRef.current);
        (refs.reflectionStateRef as { current: ReflectionState | null }).current = reflectionState;

        (refs.lastFrameResultRef as { current: EngineFrameResult | null }).current = {
          view,
          viewChanged,
          animationFrameChanged,
          shouldRender,
          timestamp,
        };

        return {
          needsRender: shouldRender,
          viewChanged,
          animationFrameChanged,
          playerDirty,
        };
      };
    },
    [refs, doorAnimations, arrowOverlay, warpHandler, viewportConfig, connectionDepth]
  );

  return { createRunUpdate };
}
