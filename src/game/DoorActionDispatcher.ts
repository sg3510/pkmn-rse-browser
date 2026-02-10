/**
 * Door Action Dispatcher
 *
 * Shared action handlers for door entry/exit sequences.
 * Called by both Canvas2D (useWarpExecution) and WebGL (WebGLMapPage)
 * after doorSequencer.updateEntry/Exit().
 *
 * This module handles the ACTION DISPATCH only - the state machine logic
 * lives in DoorSequencer, and renderer-specific code (world init, tileset
 * uploads) stays in each renderer's performWarp.
 *
 * Reference: docs/features/warp/warp-behavior.md
 * GBA Source: public/pokeemerald/src/field_screen_effect.c
 */

import type {
  DoorEntryUpdateResult,
  DoorExitUpdateResult,
} from '../field/DoorSequencer';
import type { UseDoorSequencerReturn } from '../hooks/useDoorSequencer';
import type { UseDoorAnimationsReturn } from '../hooks/useDoorAnimations';
import type { UseArrowOverlayReturn } from '../hooks/useArrowOverlay';
import type { FadeController } from '../field/FadeController';
import type { PlayerController } from './PlayerController';
import type { WarpHandler } from '../field/WarpHandler';
import type { WarpEvent } from '../types/maps';
import type { WarpTrigger } from '../components/map/utils';
import type { CardinalDirection } from '../field/types';
import {
  isDoorBehavior,
  isArrowWarpBehavior,
  isNonAnimatedDoorBehavior,
  getArrowDirectionFromBehavior,
} from '../utils/metatileBehaviors';

// =============================================================================
// Types
// =============================================================================

/**
 * Dependencies for door action handlers
 */
export interface DoorActionDeps {
  player: PlayerController;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  fadeController: FadeController;
  playerHiddenRef: { current: boolean };
  /** Called when warp should be executed (after fade out complete) */
  onExecuteWarp: (trigger: WarpTrigger) => void;
}

/**
 * Entry state passed to action handler (from doorSequencer.sequencer.getEntryState())
 */
export interface DoorEntryState {
  isAnimatedDoor: boolean;
  metatileId: number;
  openAnimId?: number;
}

/**
 * Exit state passed to action handler (from doorSequencer.sequencer.getExitState())
 */
export interface DoorExitState {
  metatileId: number;
  openAnimId?: number;
}

/**
 * Dependencies for starting a door warp sequence
 */
export interface DoorWarpStartDeps {
  player: PlayerController;
  doorSequencer: UseDoorSequencerReturn;
  doorAnimations: UseDoorAnimationsReturn;
  arrowOverlay: UseArrowOverlayReturn;
  warpHandler: WarpHandler;
}

/**
 * Minimal map instance for warp trigger creation
 */
export interface WarpSourceMap {
  entry: { id: string };
  warpEvents: WarpEvent[];
  offsetX: number;
  offsetY: number;
}

/**
 * Context for starting a door warp
 */
export interface DoorWarpContext {
  targetX: number;
  targetY: number;
  behavior: number;
  metatileId: number;
  warpEvent: WarpEvent;
  sourceMap: WarpSourceMap;
}

// =============================================================================
// Door Entry Action Handler
// =============================================================================

/**
 * Process door entry action result from doorSequencer.updateEntry()
 *
 * This handles the ACTION DISPATCH for the door entry state machine.
 * The state machine itself lives in DoorSequencer.
 *
 * Actions handled:
 * - startPlayerStep: Force player to walk into door
 * - hidePlayer: Hide player and spawn close animation
 * - removeCloseAnimation: Clear close animation when done
 * - startFadeOut: Begin fade out effect
 * - executeWarp: Trigger the actual warp
 *
 * @param result - Result from doorSequencer.updateEntry()
 * @param entryState - Current entry state from doorSequencer
 * @param deps - Dependencies (player, animations, fade, etc.)
 * @param now - Current timestamp
 */
export function handleDoorEntryAction(
  result: DoorEntryUpdateResult,
  entryState: DoorEntryState,
  deps: DoorActionDeps,
  now: number
): void {
  const {
    player,
    doorSequencer,
    doorAnimations,
    fadeController,
    playerHiddenRef,
    onExecuteWarp,
  } = deps;

  if (result.action === 'startPlayerStep' && result.direction) {
    // Door fully open, force player to walk into door tile
    player.forceMove(result.direction, true);
  } else if (result.action === 'hidePlayer') {
    // Player has entered door, hide them
    playerHiddenRef.current = true;

    // Spawn close animation if this is an animated door
    if (entryState.isAnimatedDoor) {
      const pos = doorSequencer.getEntryDoorPosition();
      // Set to -1 as sentinel for "loading in progress"
      doorSequencer.setEntryCloseAnimId(-1);
      // IMPORTANT: Clear open animation in callback to prevent one-frame gap.
      // See exit sequence comment for detailed explanation.
      const openAnimIdToRemove = entryState.openAnimId;
      doorAnimations
        .spawn('close', pos?.x ?? 0, pos?.y ?? 0, entryState.metatileId, now)
        .then((closeAnimId) => {
          // Clear open animation AFTER close animation is ready
          if (openAnimIdToRemove !== undefined) {
            doorAnimations.clearById(openAnimIdToRemove);
          }
          if (closeAnimId !== null) {
            doorSequencer.setEntryCloseAnimId(closeAnimId);
          }
        });
    }
  } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
    // Door close animation complete, show base tile
    doorAnimations.clearById(result.animId);
  } else if (result.action === 'startFadeOut' && result.duration) {
    // Begin fade out before warp
    fadeController.startFadeOut(result.duration, now);
  } else if (result.action === 'executeWarp' && result.trigger) {
    // Fade complete, execute the warp
    onExecuteWarp(result.trigger as WarpTrigger);
  }
}

// =============================================================================
// Door Exit Action Handler
// =============================================================================

/**
 * Process door exit action result from doorSequencer.updateExit()
 *
 * This handles the ACTION DISPATCH for the door exit state machine.
 * Per GBA behavior (pokeemerald field_screen_effect.c):
 * - Task_ExitDoor: Animated door exit (open door, walk out, close)
 * - Task_ExitNonAnimDoor: Non-animated exit (walk in facing direction)
 * - Task_ExitNonDoor: No exit sequence (just fade in)
 *
 * Actions handled:
 * - spawnOpenAnimation: Set door to open state before fade completes
 * - startPlayerStep: Force player to walk out of door
 * - spawnCloseAnimation: Begin door close after player exits
 * - removeCloseAnimation: Clear close animation when done
 *
 * @param result - Result from doorSequencer.updateExit()
 * @param exitState - Current exit state from doorSequencer
 * @param deps - Dependencies (player, animations, etc.)
 * @param now - Current timestamp
 * @returns true if sequence completed (result.done)
 */
export function handleDoorExitAction(
  result: DoorExitUpdateResult,
  exitState: DoorExitState,
  deps: DoorActionDeps,
  now: number
): boolean {
  const { player, doorSequencer, doorAnimations, playerHiddenRef } = deps;

  if (result.action === 'spawnOpenAnimation') {
    // Per pokeemerald: FieldSetDoorOpened() sets door to fully-open state BEFORE fade completes
    const pos = doorSequencer.getExitDoorPosition();
    doorSequencer.setExitOpenAnimId(-1);
    // Set door to already-open state (animation started in the past)
    const alreadyOpenStartedAt = now - 500;
    doorAnimations
      .spawn('open', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, alreadyOpenStartedAt, true)
      .then((openAnimId) => {
        if (openAnimId !== null) {
          doorSequencer.setExitOpenAnimId(openAnimId);
        }
      });
  } else if (result.action === 'startPlayerStep' && result.direction) {
    // Player steps out of door
    player.forceMove(result.direction, true);
    playerHiddenRef.current = false;
  } else if (result.action === 'spawnCloseAnimation') {
    // Player has exited, begin door close
    const pos = doorSequencer.getExitDoorPosition();

    // IMPORTANT: Spawn close animation FIRST, then clear open animation in callback.
    // This prevents a one-frame gap where no animation exists (which would show base metatile).
    // Even with cached sprites, `await` yields to microtask queue causing the gap.
    // GBA doesn't have this issue because door tiles are compiled into ROM (synchronous).
    doorSequencer.setExitCloseAnimId(-1);
    const openAnimIdToRemove = exitState.openAnimId;
    doorAnimations
      .spawn('close', pos?.x ?? 0, pos?.y ?? 0, exitState.metatileId, now)
      .then((closeAnimId) => {
        // Clear the open animation AFTER close animation is ready
        if (openAnimIdToRemove !== undefined && openAnimIdToRemove !== -1) {
          doorAnimations.clearById(openAnimIdToRemove);
        }
        if (closeAnimId !== null) {
          doorSequencer.setExitCloseAnimId(closeAnimId);
        }
      });
  } else if (result.action === 'removeCloseAnimation' && result.animId !== undefined) {
    // Door close complete
    doorAnimations.clearById(result.animId);
  }

  // Handle sequence completion
  if (result.done) {
    player.unlockInput();
    playerHiddenRef.current = false;
    return true;
  }

  return false;
}

// =============================================================================
// Door Warp Sequence Starter
// =============================================================================

/**
 * Start a door warp sequence based on tile behavior
 *
 * This is the shared logic for handling door warp attempts from both renderers.
 * It determines the warp type (arrow, animated door, non-animated door) and
 * starts the appropriate sequence.
 *
 * Per GBA behavior:
 * - Arrow warps: Check player facing matches arrow direction
 * - Animated doors: Spawn open animation, start entry sequence
 * - Non-animated doors (stairs, etc.): Start auto-warp with fade
 *
 * @param ctx - Warp context (position, behavior, metatile, etc.)
 * @param deps - Dependencies (player, sequencer, animations, etc.)
 * @returns true if warp sequence was started, false if rejected
 */
export async function startDoorWarpSequence(
  ctx: DoorWarpContext,
  deps: DoorWarpStartDeps
): Promise<boolean> {
  const { player, doorSequencer, doorAnimations, arrowOverlay, warpHandler } = deps;
  const { targetX, targetY, behavior, metatileId, warpEvent, sourceMap } = ctx;

  // Guard: Already in a door sequence
  if (doorSequencer.isEntryActive()) {
    return false;
  }

  // Guard: Warp already in progress
  if (warpHandler.isInProgress()) {
    return false;
  }

  const isArrow = isArrowWarpBehavior(behavior);
  const isAnimated = isDoorBehavior(behavior);
  const isNonAnimated = isNonAnimatedDoorBehavior(behavior);

  // Build warp trigger
  const trigger: WarpTrigger = {
    kind: isArrow ? 'arrow' : 'door',
    sourceMap: sourceMap as WarpTrigger['sourceMap'],
    warpEvent,
    behavior,
    facing: player.dir,
  };

  // ===== Arrow Warps =====
  if (isArrow) {
    const arrowDir = getArrowDirectionFromBehavior(behavior);

    // Player must be facing arrow direction
    if (!arrowDir || player.dir !== arrowDir) {
      return false;
    }

    // Hide arrow overlay and start auto-warp
    arrowOverlay.hide();
    doorSequencer.startAutoWarp(
      {
        targetX: player.tileX,
        targetY: player.tileY,
        metatileId,
        isAnimatedDoor: false,
        entryDirection: arrowDir as CardinalDirection,
        warpTrigger: trigger,
      },
      performance.now(),
      true
    );
    player.lockInput();
    return true;
  }

  // ===== Animated Doors =====
  if (isAnimated) {
    const startedAt = performance.now();

    // Spawn door open animation
    const openAnimId = await doorAnimations.spawn(
      'open',
      targetX,
      targetY,
      metatileId,
      startedAt,
      true // holdOnComplete - stay on last frame
    );

    // Start entry sequence
    doorSequencer.startEntry(
      {
        targetX,
        targetY,
        metatileId,
        isAnimatedDoor: true,
        entryDirection: player.dir as CardinalDirection,
        warpTrigger: trigger,
        openAnimId: openAnimId ?? undefined,
      },
      startedAt
    );

    if (openAnimId) {
      doorSequencer.setEntryOpenAnimId(openAnimId);
    }

    player.lockInput();
    return true;
  }

  // ===== Non-Animated Doors (stairs, ladders, etc.) =====
  if (isNonAnimated) {
    doorSequencer.startAutoWarp(
      {
        targetX,
        targetY,
        metatileId,
        isAnimatedDoor: false,
        entryDirection: player.dir as CardinalDirection,
        warpTrigger: trigger,
      },
      performance.now(),
      true
    );
    player.lockInput();
    return true;
  }

  // Not a door-type behavior
  return false;
}

// =============================================================================
// Helper: Create Animation Done Checker
// =============================================================================

/**
 * Create an animation done checker function for door sequences
 *
 * Both renderers need the same logic to check if door animations are complete.
 * This helper creates that checker function.
 *
 * @param doorAnimations - Door animations hook
 * @param now - Current timestamp
 * @returns Function that checks if an animation ID is done
 */
export function createAnimationDoneChecker(
  doorAnimations: UseDoorAnimationsReturn,
  now: number
): (animId: number | undefined) => boolean {
  return (animId: number | undefined): boolean => {
    if (animId === undefined) return true;
    if (animId === -1) return false; // -1 is sentinel for "loading in progress"
    const anim = doorAnimations.findById(animId);
    return !anim || doorAnimations.isAnimDone(anim, now);
  };
}
