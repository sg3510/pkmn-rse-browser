/**
 * DoorSequenceRunner
 *
 * Unified door entry/exit sequence update logic for both WebGL and Canvas2D renderers.
 * This extracts the common "glue code" that advances door sequences each frame.
 *
 * Both renderers already use:
 * - `doorSequencer` (shared hook)
 * - `DoorActionDispatcher` (shared module)
 * - `createAnimationDoneChecker` (shared)
 *
 * This module provides the update loop logic that was duplicated between:
 * - WebGLMapPage.tsx (inline)
 * - useWarpExecution.ts (advanceDoorEntry/Exit)
 */

import type { PlayerController } from './PlayerController';
import type { FadeController } from '../field/FadeController';
import type { UseDoorSequencerReturn } from '../hooks/useDoorSequencer';
import type { UseDoorAnimationsReturn } from '../hooks/useDoorAnimations';
import type { WarpTrigger } from '../components/map/utils';
import {
  handleDoorEntryAction,
  handleDoorExitAction,
  createAnimationDoneChecker,
  type DoorActionDeps,
} from './DoorActionDispatcher';

// =============================================================================
// Types
// =============================================================================

/**
 * Dependencies needed for door sequence updates.
 * Both renderers provide these through their ref systems.
 */
export interface DoorSequenceDeps {
  /** Player controller */
  player: PlayerController;

  /** Door sequencer from useDoorSequencer hook */
  doorSequencer: UseDoorSequencerReturn;

  /** Door animations from useDoorAnimations hook */
  doorAnimations: UseDoorAnimationsReturn;

  /** Fade controller */
  fadeController: FadeController;

  /** Ref to player hidden state (mutable) */
  playerHiddenRef: { current: boolean };

  /** Return false to preserve an external input lock (e.g. running script) */
  shouldUnlockInput?: () => boolean;

  /**
   * Callback to execute warp when door entry sequence completes.
   * This is renderer-specific (WebGL vs Canvas2D have different warp implementations).
   */
  onExecuteWarp: (trigger: WarpTrigger) => void;
}

// =============================================================================
// Door Entry Update
// =============================================================================

/**
 * Advance the door entry sequence for one frame.
 *
 * Call this each frame when `doorSequencer.isEntryActive()` is true.
 * Uses shared DoorActionDispatcher to handle state transitions.
 *
 * @param deps - Door sequence dependencies
 * @param nowTime - Current timestamp (performance.now())
 * @returns true if entry sequence is still active, false if complete
 */
export function runDoorEntryUpdate(deps: DoorSequenceDeps, nowTime: number): boolean {
  const { player, doorSequencer, doorAnimations, fadeController, playerHiddenRef, onExecuteWarp } = deps;

  if (!doorSequencer.isEntryActive()) {
    return false;
  }

  const entryState = doorSequencer.sequencer.getEntryState();
  const isAnimationDone = createAnimationDoneChecker(doorAnimations, nowTime);
  const isFadeDone = !fadeController.isActive() || fadeController.isComplete(nowTime);

  const result = doorSequencer.updateEntry(nowTime, player.isMoving, isAnimationDone, isFadeDone);

  // Use shared action dispatcher
  const actionDeps: DoorActionDeps = {
    player,
    doorSequencer,
    doorAnimations,
    fadeController,
    playerHiddenRef,
    shouldUnlockInput: deps.shouldUnlockInput,

    onExecuteWarp,
  };

  handleDoorEntryAction(result, entryState, actionDeps, nowTime);

  return doorSequencer.isEntryActive();
}

// =============================================================================
// Door Exit Update
// =============================================================================

/**
 * Advance the door exit sequence for one frame.
 *
 * Call this each frame when `doorSequencer.isExitActive()` is true.
 * Uses shared DoorActionDispatcher to handle state transitions.
 *
 * @param deps - Door sequence dependencies
 * @param nowTime - Current timestamp (performance.now())
 * @returns true if exit sequence completed this frame, false otherwise
 */
export function runDoorExitUpdate(deps: DoorSequenceDeps, nowTime: number): boolean {
  const { player, doorSequencer, doorAnimations, fadeController, playerHiddenRef } = deps;

  if (!doorSequencer.isExitActive()) {
    return false;
  }

  const exitState = doorSequencer.sequencer.getExitState();
  const isAnimationDone = createAnimationDoneChecker(doorAnimations, nowTime);
  const isFadeInDone = !fadeController.isActive() || fadeController.isComplete(nowTime);

  const result = doorSequencer.updateExit(nowTime, player.isMoving, isAnimationDone, isFadeInDone);

  // Use shared action dispatcher (onExecuteWarp not used in exit sequence)
  const actionDeps: DoorActionDeps = {
    player,
    doorSequencer,
    doorAnimations,
    fadeController,
    playerHiddenRef,
    shouldUnlockInput: deps.shouldUnlockInput,

    onExecuteWarp: () => {}, // Not used in exit sequence
  };

  return handleDoorExitAction(result, exitState, actionDeps, nowTime);
}

// =============================================================================
// Combined Update (Optional Convenience)
// =============================================================================

/**
 * Run both door entry and exit updates for one frame.
 *
 * Convenience function that calls both runDoorEntryUpdate and runDoorExitUpdate.
 * Only one sequence can be active at a time, so this is safe to call unconditionally.
 *
 * @param deps - Door sequence dependencies
 * @param nowTime - Current timestamp (performance.now())
 */
export function runDoorSequenceUpdates(deps: DoorSequenceDeps, nowTime: number): void {
  runDoorEntryUpdate(deps, nowTime);
  runDoorExitUpdate(deps, nowTime);
}
