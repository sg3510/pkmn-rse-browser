/**
 * useUnifiedGameLoop Hook
 *
 * Provides a shared game loop structure for both WebGL and Canvas2D renderers.
 * Extracts common patterns while allowing renderer-specific behavior via callbacks.
 *
 * Key features:
 * - GBA-accurate frame timing (~59.73 Hz)
 * - Shared player update logic
 * - Shared warp detection and door sequence handling
 * - Shared camera following logic
 * - Renderer-specific callbacks for world updates and rendering
 *
 * This hook is designed to be used by both WebGLMapPage and MapRenderer,
 * reducing code duplication while respecting architectural differences.
 */

import { useRef, useCallback, useEffect } from 'react';
import { METATILE_SIZE } from '../utils/mapLoader';
import { isNonAnimatedDoorBehavior, type CardinalDirection } from '../utils/metatileBehaviors';
import { getGlobalShimmer } from '../field/ReflectionRenderer';
import type { PlayerController } from '../game/PlayerController';
import type { CameraController } from '../game/CameraController';
import type { WarpHandler } from '../field/WarpHandler';
import type { FadeController } from '../field/FadeController';
import type { UseDoorSequencerReturn } from './useDoorSequencer';
import type { UseDoorAnimationsReturn } from './useDoorAnimations';
import type { UseArrowOverlayReturn } from './useArrowOverlay';
import type { WarpTrigger, ResolvedTile } from '../components/map/utils';
import { GBA_FRAME_MS } from '../config/timing';
import { guardFixedStep } from '../utils/fixedStepGuard';

/**
 * World bounds for camera clamping
 */
export interface WorldBounds {
  width: number;
  height: number;
  minX: number;
  minY: number;
}

/**
 * Tile resolution result for warp detection
 */
export interface TileResolutionResult {
  mapId: string;
  behavior: number;
  metatileId: number;
  resolved: ResolvedTile | null;
}

/**
 * Callbacks for renderer-specific operations
 */
export interface GameLoopCallbacks {
  /** Resolve tile at player position (renderer-specific tile lookup) */
  resolveTileAt: (tileX: number, tileY: number) => TileResolutionResult | null;

  /** Detect warp trigger at player position */
  detectWarpTrigger: (player: PlayerController) => WarpTrigger | null;

  /** Update world state (WebGL: worldManager.update, Canvas2D: different) */
  onWorldUpdate?: (player: PlayerController, direction: CardinalDirection) => void;

  /** Execute a warp to destination */
  performWarp: (trigger: WarpTrigger, options?: { force?: boolean; fromDoor?: boolean }) => Promise<void>;

  /** Get current world bounds */
  getWorldBounds: () => WorldBounds;

  /** Called every frame before rendering - return false to skip render */
  onPreRender?: (gbaFrame: number, deltaMs: number, timestamp: number) => boolean;

  /** Main render callback */
  onRender: (gbaFrame: number, deltaMs: number, timestamp: number) => void;

  /** Called when debug info should be updated (every ~500ms) */
  onDebugUpdate?: (player: PlayerController, gbaFrame: number) => void;

  /** Called every frame to update NPC movement (deltaMs in milliseconds) */
  onNPCUpdate?: (deltaMs: number) => void;
}

/**
 * Dependencies for the game loop
 */
export interface GameLoopDeps {
  player: PlayerController | null;
  camera: CameraController | null;
  warpHandler: WarpHandler;
  fadeController: FadeController;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
}

/**
 * Configuration for the game loop
 */
export interface GameLoopConfig {
  /** Viewport dimensions in pixels */
  viewportWidth: number;
  viewportHeight: number;
  /** Whether player is currently loaded */
  playerLoaded: boolean;
  /** Whether the loop is enabled */
  enabled: boolean;
}

/**
 * State returned by the game loop
 */
export interface GameLoopState {
  /** Current GBA frame number */
  gbaFrame: number;
  /** Whether the loop is running */
  isRunning: boolean;
  /** Whether player is hidden (during door sequences) */
  playerHidden: boolean;
  /** Whether a warp is in progress */
  warping: boolean;
}

/**
 * Hook return type
 */
export interface UseUnifiedGameLoopReturn {
  /** Current loop state */
  state: GameLoopState;
  /** Manually trigger a single frame update (for testing) */
  tick: () => void;
  /** Get current GBA frame number */
  getGbaFrame: () => number;
}

/**
 * Unified game loop hook for both WebGL and Canvas2D renderers.
 *
 * @example
 * ```typescript
 * const gameLoop = useUnifiedGameLoop(
 *   deps,
 *   config,
 *   {
 *     resolveTileAt: (x, y) => tileResolver(x, y),
 *     detectWarpTrigger: (player) => warpDetection(player),
 *     performWarp: (trigger) => handleWarp(trigger),
 *     getWorldBounds: () => worldBounds,
 *     onRender: (frame, dt, ts) => renderFrame(),
 *   }
 * );
 * ```
 */
export function useUnifiedGameLoop(
  deps: GameLoopDeps,
  config: GameLoopConfig,
  callbacks: GameLoopCallbacks
): UseUnifiedGameLoopReturn {
  const { player, camera, warpHandler, fadeController, doorSequencer, doorAnimations, arrowOverlay } = deps;
  const { enabled } = config;

  // Timing refs
  const lastTimeRef = useRef(performance.now());
  const gbaAccumRef = useRef(0);
  const gbaFrameRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // State refs
  const playerHiddenRef = useRef(false);
  const warpingRef = useRef(false);
  const pendingWarpRef = useRef<WarpTrigger | null>(null);
  const isRunningRef = useRef(false);

  // Callbacks ref (to avoid stale closures)
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Config ref
  const configRef = useRef(config);
  configRef.current = config;

  /**
   * Process door entry sequence
   */
  const processDoorEntry = useCallback((nowTime: number) => {
    if (!doorSequencer.isEntryActive() || !player) return;

    const entryState = doorSequencer.sequencer.getEntryState();
    const isAnimationDone = (animId: number | undefined) => {
      if (animId === undefined) return true;
      if (animId === -1) return false; // Loading in progress
      const anim = doorAnimations.findById(animId);
      return !anim || doorAnimations.isAnimDone(anim, nowTime);
    };
    const isFadeDone = !fadeController.isActive() || fadeController.isComplete(nowTime);

    const result = doorSequencer.updateEntry(nowTime, player.isMoving, isAnimationDone, isFadeDone);

    if (result.action === 'startPlayerStep' && result.direction) {
      player.forceMove(result.direction, true);
    } else if (result.action === 'hidePlayer') {
      playerHiddenRef.current = true;
      // Spawn close animation if animated door
      if (entryState.isAnimatedDoor) {
        const pos = doorSequencer.getEntryDoorPosition();
        doorSequencer.setEntryCloseAnimId(-1);
        doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, entryState.metatileId, nowTime)
          .then((closeAnimId) => {
            if (closeAnimId !== null) doorSequencer.setEntryCloseAnimId(closeAnimId);
          });
        if (entryState.openAnimId !== undefined) doorAnimations.clearById(entryState.openAnimId);
      }
    } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
      doorAnimations.clearById(result.animId);
    } else if (result.action === 'startFadeOut' && result.duration) {
      fadeController.startFadeOut(result.duration, nowTime);
    } else if (result.action === 'executeWarp' && result.trigger) {
      warpingRef.current = true;
      void callbacksRef.current.performWarp(result.trigger as WarpTrigger, { force: true, fromDoor: true });
    }
  }, [player, doorSequencer, doorAnimations, fadeController]);

  /**
   * Process door exit sequence
   */
  const processDoorExit = useCallback((nowTime: number) => {
    if (!doorSequencer.isExitActive() || !player) return;

    const exitState = doorSequencer.sequencer.getExitState();
    const isAnimationDone = (animId: number | undefined) => {
      if (animId === undefined) return true;
      if (animId === -1) return false;
      const anim = doorAnimations.findById(animId);
      return !anim || doorAnimations.isAnimDone(anim, nowTime);
    };
    const isFadeInDone = !fadeController.isActive() || fadeController.isComplete(nowTime);

    const result = doorSequencer.updateExit(nowTime, player.isMoving, isAnimationDone, isFadeInDone);

    if (result.action === 'spawnOpenAnimation') {
      const pos = doorSequencer.getExitDoorPosition();
      doorSequencer.setExitOpenAnimId(-1);
      // Set door to fully-open state before fade completes
      const alreadyOpenStartedAt = nowTime - 500;
      doorAnimations.spawn('open', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, alreadyOpenStartedAt, true)
        .then((openAnimId) => {
          if (openAnimId !== null) doorSequencer.setExitOpenAnimId(openAnimId);
        });
    } else if (result.action === 'startPlayerStep' && result.direction) {
      player.forceMove(result.direction, true);
      playerHiddenRef.current = false;
    } else if (result.action === 'spawnCloseAnimation') {
      const pos = doorSequencer.getExitDoorPosition();
      if (exitState.openAnimId !== undefined && exitState.openAnimId !== -1) {
        doorAnimations.clearById(exitState.openAnimId);
      }
      doorSequencer.setExitCloseAnimId(-1);
      doorAnimations.spawn('close', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, nowTime)
        .then((closeAnimId) => {
          if (closeAnimId !== null) doorSequencer.setExitCloseAnimId(closeAnimId);
        });
    } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
      doorAnimations.clearById(result.animId);
    }

    if (result.done) {
      player.unlockInput();
      playerHiddenRef.current = false;
    }
  }, [player, doorSequencer, doorAnimations, fadeController]);

  /**
   * Process pending warp execution
   */
  const processPendingWarp = useCallback((nowTime: number) => {
    if (!warpingRef.current || !pendingWarpRef.current) return;

    const fade = fadeController;
    if (fade.getDirection() === 'out' && fade.isComplete(nowTime)) {
      const trigger = pendingWarpRef.current;
      pendingWarpRef.current = null;
      void callbacksRef.current.performWarp(trigger).then(() => {
        warpingRef.current = false;
        if (player) {
          setTimeout(() => player.unlockInput(), 300);
        }
      });
    }
  }, [player, fadeController]);

  /**
   * Check for warps at player position
   */
  const checkWarps = useCallback((nowTime: number) => {
    if (!player || warpHandler.isInProgress() || doorSequencer.isActive()) return;

    const resolved = callbacksRef.current.resolveTileAt(player.tileX, player.tileY);
    if (!resolved) return;

    const currentMapId = resolved.mapId;
    const lastChecked = warpHandler.getState().lastCheckedTile;
    const tileChanged = !lastChecked ||
      lastChecked.mapId !== currentMapId ||
      lastChecked.x !== player.tileX ||
      lastChecked.y !== player.tileY;

    if (!tileChanged) return;

    warpHandler.updateLastCheckedTile(player.tileX, player.tileY, currentMapId);

    if (warpHandler.isOnCooldown()) return;

    const trigger = callbacksRef.current.detectWarpTrigger(player);
    if (!trigger) return;

    // Arrow warps handled through PlayerController
    if (trigger.kind === 'arrow') return;

    if (isNonAnimatedDoorBehavior(trigger.behavior)) {
      // Non-animated doors (stairs, ladders): auto-warp with fade
      console.log('[WARP] Non-animated door warp:', trigger.kind, 'to', trigger.warpEvent.destMap);
      arrowOverlay.hide();
      doorSequencer.startAutoWarp({
        targetX: player.tileX,
        targetY: player.tileY,
        metatileId: resolved.metatileId,
        isAnimatedDoor: false,
        entryDirection: player.dir as CardinalDirection,
        warpTrigger: trigger,
      }, nowTime, true);
      player.lockInput();
    } else {
      // Other walk-over warps: simple warp
      console.log('[WARP] Walk-over warp:', trigger.kind, 'to', trigger.warpEvent.destMap);
      warpHandler.startWarp(player.tileX, player.tileY, currentMapId);
      pendingWarpRef.current = trigger;
      warpingRef.current = true;
      player.lockInput();
      fadeController.startFadeOut(300, nowTime);
    }
  }, [player, warpHandler, doorSequencer, arrowOverlay, fadeController]);

  /**
   * Update arrow overlay based on tile behavior
   */
  const updateArrowOverlay = useCallback((nowTime: number) => {
    if (!player || warpHandler.isInProgress()) {
      arrowOverlay.hide();
      return;
    }

    const resolved = callbacksRef.current.resolveTileAt(player.tileX, player.tileY);
    const behavior = resolved?.behavior ?? 0;
    arrowOverlay.update(
      player.dir as CardinalDirection,
      player.tileX,
      player.tileY,
      behavior,
      nowTime,
      doorSequencer.isActive()
    );
  }, [player, warpHandler, arrowOverlay, doorSequencer]);

  /**
   * Main frame tick
   */
  const tick = useCallback(() => {
    if (!isRunningRef.current) return;

    const nowTime = performance.now();
    const rawDt = nowTime - lastTimeRef.current;
    lastTimeRef.current = nowTime;
    const stepGuard = guardFixedStep({
      rawDeltaMs: rawDt,
      accumulatorMs: gbaAccumRef.current,
      stepMs: GBA_FRAME_MS,
    });
    gbaAccumRef.current = stepGuard.nextAccumulatorMs;
    const dt = stepGuard.clampedDeltaMs;

    // Advance GBA frame counter
    for (let i = 0; i < stepGuard.stepsToRun; i++) {
      gbaFrameRef.current++;
    }

    // Update shimmer animation
    if (stepGuard.resumeReset) {
      getGlobalShimmer().reset();
    }
    getGlobalShimmer().update(nowTime);

    // Update warp handler cooldown
    warpHandler.update(dt);

    // Update NPC movement
    callbacksRef.current.onNPCUpdate?.(dt);

    // Update player if loaded and not warping
    if (player && configRef.current.playerLoaded && !warpingRef.current) {
      player.update(dt);

      // Call world update callback
      const direction = player.getFacingDirection();
      callbacksRef.current.onWorldUpdate?.(player, direction);

      // Debug info update every ~500ms (30 GBA frames)
      if (gbaFrameRef.current % 30 === 0) {
        callbacksRef.current.onDebugUpdate?.(player, gbaFrameRef.current);
      }

      // Update arrow overlay
      updateArrowOverlay(nowTime);

      // Check for warps
      checkWarps(nowTime);
    }

    // Process door sequences
    processDoorEntry(nowTime);
    processDoorExit(nowTime);
    processPendingWarp(nowTime);

    // Update camera
    if (camera && player && configRef.current.playerLoaded) {
      const bounds = callbacksRef.current.getWorldBounds();
      camera.setBounds({
        minX: bounds.minX * METATILE_SIZE,
        minY: bounds.minY * METATILE_SIZE,
        width: bounds.width,
        height: bounds.height,
      });
      camera.followTarget(player);
    }

    // Pre-render check
    const shouldRender = callbacksRef.current.onPreRender?.(gbaFrameRef.current, dt, nowTime) ?? true;

    // Render
    if (shouldRender) {
      callbacksRef.current.onRender(gbaFrameRef.current, dt, nowTime);
    }

    // Schedule next frame
    rafRef.current = requestAnimationFrame(tick);
  }, [player, camera, warpHandler, processDoorEntry, processDoorExit, processPendingWarp, checkWarps, updateArrowOverlay]);

  // Start/stop loop based on enabled flag
  useEffect(() => {
    if (enabled) {
      isRunningRef.current = true;
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      isRunningRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    return () => {
      isRunningRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, tick]);

  return {
    state: {
      gbaFrame: gbaFrameRef.current,
      isRunning: isRunningRef.current,
      playerHidden: playerHiddenRef.current,
      warping: warpingRef.current,
    },
    tick,
    getGbaFrame: () => gbaFrameRef.current,
  };
}

/**
 * GBA frame timing constant for external use
 */
export { GBA_FRAME_MS };
