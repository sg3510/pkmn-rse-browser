/**
 * useWarpExecution Hook
 *
 * Provides door warp and map transition logic.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 *
 * HIGH RISK: This hook manages complex warp state and door animations.
 * Changes should be tested thoroughly.
 */

import { useCallback, type RefObject } from 'react';
import type { RenderContext, ResolvedTile } from '../components/map/types';
import type { CardinalDirection } from '../utils/metatileBehaviors';
import type { PlayerController, DoorWarpRequest } from '../game/PlayerController';
import type { FadeController } from '../field/FadeController';
import type { WarpHandler } from '../field/WarpHandler';
import type { MapManager, WorldState } from '../services/MapManager';
import type { IRenderPipeline } from '../rendering/IRenderPipeline';
import type { UseDoorSequencerReturn } from './useDoorSequencer';
import type { UseDoorAnimationsReturn } from './useDoorAnimations';
import type { UseArrowOverlayReturn } from './useArrowOverlay';
import {
  resolveTileAt,
  findWarpEventAt,
  type WarpTrigger,
} from '../components/map/utils';
import { getMetatileIdFromMapTile } from '../utils/mapLoader';
import {
  isArrowWarpBehavior,
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
  getArrowDirectionFromBehavior,
} from '../utils/metatileBehaviors';
import {
  determineFacing,
  handleDoorExitSequence,
  type WarpExecutorDeps,
  type SpawnPosition,
} from '../game/WarpExecutor';

// Helper to check if debug mode is enabled
const DEBUG_MODE_FLAG = 'DEBUG_MODE';
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

function logDoor(...args: unknown[]) {
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[door]', ...args);
  }
}

/** Refs needed by warp execution */
export interface WarpExecutionRefs {
  renderContextRef: RefObject<RenderContext | null>;
  playerControllerRef: RefObject<PlayerController | null>;
  playerHiddenRef: RefObject<boolean>;
  fadeRef: RefObject<FadeController>;
  currentTimestampRef: RefObject<number>;
  hasRenderedRef: RefObject<boolean>;
  renderGenerationRef: RefObject<number>;
  mapManagerRef: RefObject<MapManager>;
  renderPipelineRef: RefObject<IRenderPipeline | null>;
}

/** Callbacks needed by warp execution - passed at creation time */
export interface WarpExecutionCallbacks {
  rebuildContextForWorld: (world: WorldState, anchorId: string) => Promise<void>;
  applyTileResolver: () => void;
  applyPipelineResolvers: () => void;
}

/** Hook configuration */
export interface UseWarpExecutionOptions {
  refs: WarpExecutionRefs;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
  warpHandler: WarpHandler;
  connectionDepth: number;
}

/** Functions returned by createWarpExecutors */
export interface WarpExecutors {
  performWarp: (trigger: WarpTrigger, options?: { force?: boolean; fromDoor?: boolean }) => Promise<void>;
  startAutoDoorWarp: (
    trigger: WarpTrigger,
    resolved: ResolvedTile,
    player: PlayerController,
    entryDirection?: CardinalDirection,
    options?: { isAnimatedDoor?: boolean }
  ) => boolean;
  advanceDoorEntry: (now: number) => void;
  advanceDoorExit: (now: number) => void;
  handleDoorWarpAttempt: (request: DoorWarpRequest) => Promise<void>;
}

export interface UseWarpExecutionReturn {
  /** Create warp executor functions bound to a specific generation and callbacks */
  createWarpExecutors: (generation: number, callbacks: WarpExecutionCallbacks) => WarpExecutors;
  /** Reset the door sequencer (call when loading new map) */
  resetDoorSequencer: () => void;
}

/**
 * Hook providing warp execution and door animation logic
 */
export function useWarpExecution(options: UseWarpExecutionOptions): UseWarpExecutionReturn {
  const {
    refs,
    doorSequencer,
    doorAnimations,
    arrowOverlay,
    warpHandler,
    connectionDepth,
  } = options;

  const resetDoorSequencer = useCallback(() => {
    doorSequencer.reset();
  }, []); // doorSequencer.reset is stable

  const createWarpExecutors = useCallback(
    (generation: number, callbacks: WarpExecutionCallbacks): WarpExecutors => {
      /**
       * Start Auto Door Warp (Non-Animated)
       *
       * Used for doors that don't have door animations (stairs, ladders, etc.)
       */
      const startAutoDoorWarp = (
        trigger: WarpTrigger,
        resolved: ResolvedTile,
        player: PlayerController,
        entryDirection: CardinalDirection = 'up',
        _options?: { isAnimatedDoor?: boolean }
      ): boolean => {
        if (doorSequencer.isEntryActive()) return false;
        const now = performance.now();
        const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
        logDoor('entry: auto door warp (non-animated)', {
          worldX: player.tileX,
          worldY: player.tileY,
          metatileId,
          behavior: trigger.behavior,
        });
        arrowOverlay.hide();
        // Use the sequencer's startAutoWarp to skip to fade phase
        doorSequencer.startAutoWarp({
          targetX: player.tileX,
          targetY: player.tileY,
          metatileId,
          isAnimatedDoor: false,
          entryDirection,
          warpTrigger: trigger,
        }, now, true);
        player.lockInput();
        return true;
      };

      /**
       * Perform Warp (Map Transition)
       *
       * Handles the actual map change and player positioning after fade out.
       *
       * Critical Logic for Door Exit Animations:
       * - Check if DESTINATION tile has door behavior before playing exit animation
       * - Many indoor exits use arrow warps (behavior 101) or stairs with NO door
       * - Only play door exit animation if destination tile is actually a door
       */
      const performWarp = async (
        trigger: WarpTrigger,
        options?: { force?: boolean; fromDoor?: boolean }
      ): Promise<void> => {
        if (warpHandler.isInProgress() && !options?.force) return;
        warpHandler.setInProgress(true);
        const shouldUnlockInput = !options?.fromDoor;

        // Capture prior facing for ladder/surf transitions (GBA preserves facing)
        const priorFacing = refs.playerControllerRef.current?.getFacingDirection() ?? 'down';
        refs.playerControllerRef.current?.lockInput();

        try {
          const targetMapId = trigger.warpEvent.destMap;
          const targetWarpId = trigger.warpEvent.destWarpId;
          const newWorld = await refs.mapManagerRef.current.buildWorld(targetMapId, connectionDepth);
          if (generation !== refs.renderGenerationRef.current) return;
          await callbacks.rebuildContextForWorld(newWorld, targetMapId);
          if (generation !== refs.renderGenerationRef.current) return;

          const ctxAfter = refs.renderContextRef.current;
          const anchorAfter = ctxAfter?.anchor ?? newWorld.maps[0];
          const destMap =
            ctxAfter?.world.maps.find((m) => m.entry.id === targetMapId) ?? anchorAfter;
          const warpEvents = destMap?.warpEvents ?? [];
          const destWarp = warpEvents[targetWarpId] ?? warpEvents[0];
          if (!destMap || !destWarp) {
            if (isDebugMode()) {
              console.warn(`Warp target missing for ${targetMapId} warp ${targetWarpId}`);
            }
            return;
          }
          const destWorldX = destMap.offsetX + destWarp.x;
          const destWorldY = destMap.offsetY + destWarp.y;

          // Resolve destination tile for facing and exit sequence
          const destResolved = ctxAfter ? resolveTileAt(ctxAfter, destWorldX, destWorldY) : null;
          const destBehavior = destResolved?.attributes?.behavior ?? -1;
          const destMetatileId = destResolved ? getMetatileIdFromMapTile(destResolved.mapTile) : 0;

          // Use shared GBA-accurate facing logic from WarpExecutor
          const facing = determineFacing(destBehavior, { priorFacing });

          if (isDebugMode()) {
            console.log('[WARP_FACING]', {
              triggerKind: trigger.kind,
              triggerFacing: trigger.facing,
              priorFacing,
              destBehavior,
              finalFacing: facing,
              fromDoor: options?.fromDoor,
            });
          }

          refs.playerControllerRef.current?.setPositionAndDirection(destWorldX, destWorldY, facing);

          // Handle door exit sequence using shared WarpExecutor logic
          if (options?.fromDoor) {
            const player = refs.playerControllerRef.current;
            if (player) {
              // Create WarpExecutor deps from Canvas2D refs
              const warpDeps: WarpExecutorDeps = {
                player,
                doorSequencer,
                fadeController: refs.fadeRef.current,
                warpHandler,
                playerHiddenRef: refs.playerHiddenRef as { current: boolean },
                getCurrentTime: () => refs.currentTimestampRef.current,
                onClearDoorAnimations: () => doorAnimations.clearAll(),
              };

              const spawnPos: SpawnPosition = { x: destWorldX, y: destWorldY };

              if (isDebugMode()) {
                console.log('[WARP_EXIT_SEQUENCE]', {
                  triggerKind: trigger.kind,
                  destBehavior,
                  destMetatileId: `0x${destMetatileId.toString(16)} (${destMetatileId})`,
                  requiresExitSequence: requiresDoorExitSequence(destBehavior),
                });
              }

              // Use shared GBA-accurate exit sequence logic from WarpExecutor
              handleDoorExitSequence(warpDeps, spawnPos, destBehavior, destMetatileId, trigger);
            }
          }
          callbacks.applyTileResolver();
          callbacks.applyPipelineResolvers();
          // Invalidate pipeline caches after warp
          refs.renderPipelineRef.current?.invalidate();
          warpHandler.updateLastCheckedTile(destWorldX, destWorldY, destMap.entry.id);
          warpHandler.setCooldown(350);
          (refs.hasRenderedRef as { current: boolean }).current = false;
          // Clear any remaining door animations from the previous map
          doorAnimations.clearAll();
        } catch (err) {
          console.error('Warp failed', err);
        } finally {
          if (shouldUnlockInput) {
            refs.playerControllerRef.current?.unlockInput();
            warpHandler.setInProgress(false);
          }
        }
      };

      /**
       * Advance Door Entry Sequence
       *
       * Called every frame in runUpdate to progress door entry animation.
       */
      const advanceDoorEntry = (now: number): void => {
        if (!doorSequencer.isEntryActive()) return;
        const player = refs.playerControllerRef.current;
        if (!player) return;

        const entryState = doorSequencer.sequencer.getEntryState();
        const isAnimationDone = (animId: number | undefined) => {
          if (animId === undefined) return true;
          // -1 is sentinel for "loading in progress" - not done
          if (animId === -1) return false;
          const anim = doorAnimations.findById(animId);
          return !anim || doorAnimations.isAnimDone(anim, now);
        };
        const isFadeDone = !refs.fadeRef.current.isActive() || refs.fadeRef.current.isComplete(now);

        const result = doorSequencer.updateEntry(
          now,
          player.isMoving,
          isAnimationDone,
          isFadeDone
        );

        // Handle actions returned by the sequencer
        if (result.action === 'startPlayerStep' && result.direction) {
          const pos = doorSequencer.getEntryDoorPosition();
          logDoor('entry: door fully open, force step into tile', pos?.x, pos?.y);
          player.forceMove(result.direction, true);
        } else if (result.action === 'hidePlayer') {
          logDoor('entry: hide player');
          (refs.playerHiddenRef as { current: boolean }).current = true;
          // Also spawn close animation if animated door
          if (entryState.isAnimatedDoor) {
            const pos = doorSequencer.getEntryDoorPosition();
            logDoor('entry: start door close (animated)');
            // Set to -1 as sentinel for "loading in progress" to prevent race condition
            doorSequencer.setEntryCloseAnimId(-1);
            doorAnimations.spawn(
              'close',
              pos?.x ?? 0,
              pos?.y ?? 0,
              entryState.metatileId,
              now
            ).then((closeAnimId) => {
              if (closeAnimId !== null) {
                doorSequencer.setEntryCloseAnimId(closeAnimId);
              }
            });
            // Remove open animation
            if (entryState.openAnimId !== undefined) {
              doorAnimations.clearById(entryState.openAnimId);
            }
          }
        } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
          logDoor('entry: door close complete, showing base tile');
          doorAnimations.clearById(result.animId);
        } else if (result.action === 'startFadeOut' && result.duration) {
          logDoor('entry: start fade out');
          refs.fadeRef.current.startFadeOut(result.duration, now);
        } else if (result.action === 'executeWarp' && result.trigger) {
          logDoor('entry: warp now');
          void performWarp(result.trigger as WarpTrigger, { force: true, fromDoor: true });
        }
      };

      /**
       * Advance Door Exit Sequence
       *
       * Handles the door exit state machine using the door sequencer.
       * Called every frame in runUpdate to progress the exit animation.
       */
      const advanceDoorExit = (now: number): void => {
        if (!doorSequencer.isExitActive()) return;
        const player = refs.playerControllerRef.current;
        if (!player) return;

        const exitState = doorSequencer.sequencer.getExitState();
        const isAnimationDone = (animId: number | undefined) => {
          if (animId === undefined) return true;
          // -1 is sentinel for "loading in progress" - not done
          if (animId === -1) return false;
          const anim = doorAnimations.findById(animId);
          return !anim || doorAnimations.isAnimDone(anim, now);
        };
        // Per pokeemerald: wait for fade-in to complete before showing player
        const isFadeInDone = !refs.fadeRef.current.isActive() || refs.fadeRef.current.isComplete(now);

        const result = doorSequencer.updateExit(
          now,
          player.isMoving,
          isAnimationDone,
          isFadeInDone
        );

        // Handle actions returned by the sequencer
        if (result.action === 'spawnOpenAnimation') {
          const pos = doorSequencer.getExitDoorPosition();
          logDoor('exit: set door to open state (not animating)', {
            worldX: pos?.x,
            worldY: pos?.y,
            metatileId: exitState.metatileId,
          });
          // Set to -1 as sentinel for "loading in progress"
          doorSequencer.setExitOpenAnimId(-1);
          // Per pokeemerald: FieldSetDoorOpened() sets door to fully-open state BEFORE fade completes
          const alreadyOpenStartedAt = now - 500;
          doorAnimations.spawn(
            'open',
            pos?.x ?? 0,
            pos?.y ?? 0,
            exitState.metatileId,
            alreadyOpenStartedAt,
            true // holdOnComplete - stay on last frame
          ).then((openAnimId) => {
            if (openAnimId !== null) {
              doorSequencer.setExitOpenAnimId(openAnimId);
            }
          });
        } else if (result.action === 'startPlayerStep' && result.direction) {
          logDoor('exit: step out of door', { exitDirection: result.direction });
          player.forceMove(result.direction, true);
          (refs.playerHiddenRef as { current: boolean }).current = false;
        } else if (result.action === 'spawnCloseAnimation') {
          const pos = doorSequencer.getExitDoorPosition();
          logDoor('exit: start door close');
          // Remove open animation
          if (exitState.openAnimId !== undefined && exitState.openAnimId !== -1) {
            doorAnimations.clearById(exitState.openAnimId);
          }
          // Set to -1 as sentinel for "loading in progress"
          doorSequencer.setExitCloseAnimId(-1);
          doorAnimations.spawn(
            'close',
            pos?.x ?? 0,
            pos?.y ?? 0,
            exitState.metatileId,
            now
          ).then((closeAnimId) => {
            if (closeAnimId !== null) {
              doorSequencer.setExitCloseAnimId(closeAnimId);
            }
          });
        } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
          logDoor('exit: door close complete');
          doorAnimations.clearById(result.animId);
        }

        // Handle completion
        if (result.done) {
          logDoor('exit: sequence complete');
          refs.playerControllerRef.current?.unlockInput();
          (refs.playerHiddenRef as { current: boolean }).current = false;
        }
      };

      /**
       * Door Entry Handler (handleDoorWarpAttempt)
       *
       * Triggered when player attempts to enter a door (from outdoor → indoor, etc.)
       * Uses the SOURCE tile's metatile ID for door animation.
       */
      const handleDoorWarpAttempt = async (request: DoorWarpRequest): Promise<void> => {
        if (doorSequencer.isEntryActive() || warpHandler.isInProgress()) return;
        const ctx = refs.renderContextRef.current;
        const player = refs.playerControllerRef.current;
        if (!ctx || !player) return;

        const resolved = resolveTileAt(ctx, request.targetX, request.targetY);
        if (!resolved) return;

        const warpEvent = findWarpEventAt(resolved.map, request.targetX, request.targetY);
        if (!warpEvent) return;

        const behavior = resolved.attributes?.behavior ?? -1;

        // Check if this is an arrow warp
        const isArrow = isArrowWarpBehavior(behavior);
        const requiresExitSeq = requiresDoorExitSequence(behavior);
        const isAnimated = isDoorBehavior(behavior);

        if (isDebugMode()) {
          console.log('[DOOR_WARP_ATTEMPT]', {
            targetX: request.targetX,
            targetY: request.targetY,
            behavior,
            metatileId: `0x${getMetatileIdFromMapTile(resolved.mapTile).toString(16)} (${getMetatileIdFromMapTile(resolved.mapTile)})`,
            isDoor: isAnimated,
            isNonAnimatedDoor: isNonAnimatedDoorBehavior(behavior),
            isArrowWarp: isArrow,
            requiresExitSequence: requiresExitSeq,
            playerDir: player.dir,
          });
        }

        // Handle arrow warps
        if (isArrow) {
          const arrowDir = getArrowDirectionFromBehavior(behavior);
          if (isDebugMode()) {
            console.log('[ARROW_WARP_ATTEMPT]', {
              arrowDir,
              playerDir: player.dir,
              match: arrowDir === player.dir,
            });
          }
          if (!arrowDir || player.dir !== arrowDir) {
            if (isDebugMode()) {
              console.warn('[ARROW_WARP_ATTEMPT] Player not facing arrow direction - REJECTING');
            }
            return;
          }
          // Arrow warp: trigger auto door warp with no animation
          const trigger: WarpTrigger = {
            kind: 'arrow',
            sourceMap: resolved.map,
            warpEvent,
            behavior,
            facing: player.dir,
          };
          if (isDebugMode()) {
            console.log('[ARROW_WARP_START]', { trigger });
          }
          startAutoDoorWarp(trigger, resolved, player, arrowDir, { isAnimatedDoor: false });
          return;
        }

        if (!requiresExitSeq) {
          if (isDebugMode()) {
            console.warn('[DOOR_WARP_ATTEMPT] Called for non-door/non-arrow tile - REJECTING', {
              targetX: request.targetX,
              targetY: request.targetY,
              behavior,
              metatileId: getMetatileIdFromMapTile(resolved.mapTile),
            });
          }
          return;
        }

        const trigger: WarpTrigger = {
          kind: 'door',
          sourceMap: resolved.map,
          warpEvent,
          behavior,
          facing: player.dir,
        };

        // Use SOURCE tile's metatile ID for door animation
        const metatileId = getMetatileIdFromMapTile(resolved.mapTile);
        const startedAt = performance.now();

        // Only spawn door animation if this is an animated door
        let openAnimId: number | null | undefined = undefined;
        if (isAnimated) {
          logDoor('entry: start door open (animated)', {
            worldX: request.targetX,
            worldY: request.targetY,
            metatileId,
            map: resolved.map.entry.id,
          });
          openAnimId = await doorAnimations.spawn(
            'open',
            request.targetX,
            request.targetY,
            metatileId,
            startedAt,
            true
          );
        } else {
          logDoor('entry: start (non-animated, no door animation)', {
            worldX: request.targetX,
            worldY: request.targetY,
            metatileId,
            map: resolved.map.entry.id,
          });
        }

        // Start the entry sequence using the door sequencer
        const entryResult = doorSequencer.startEntry({
          targetX: request.targetX,
          targetY: request.targetY,
          metatileId,
          isAnimatedDoor: isAnimated,
          entryDirection: player.dir as CardinalDirection,
          warpTrigger: trigger,
          openAnimId: openAnimId ?? undefined,
        }, startedAt);

        // If the sequencer wants to spawn an open animation and we haven't already
        if (entryResult.action === 'spawnOpenAnimation' && !openAnimId && isAnimated) {
          // Animation was already spawned above
        }

        // Set the open animation ID if it was spawned
        if (openAnimId) {
          doorSequencer.setEntryOpenAnimId(openAnimId);
        }

        (refs.playerHiddenRef as { current: boolean }).current = false;
        player.lockInput();
      };

      return {
        performWarp,
        startAutoDoorWarp,
        advanceDoorEntry,
        advanceDoorExit,
        handleDoorWarpAttempt,
      };
    },
    [] // All dependencies accessed via refs or stable hook functions
  );

  return { createWarpExecutors, resetDoorSequencer };
}
