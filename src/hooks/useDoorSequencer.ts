/**
 * useDoorSequencer Hook
 *
 * React hook wrapper for DoorSequencer class.
 * Provides door entry/exit sequence management with action-based results.
 *
 * This hook is designed for incremental migration from inline door logic
 * in MapRenderer.tsx to the modular DoorSequencer class.
 *
 * Usage:
 * ```typescript
 * const doorSequencer = useDoorSequencer();
 *
 * // Start entry sequence when player enters a door
 * const result = doorSequencer.startEntry({
 *   targetX: doorTileX,
 *   targetY: doorTileY,
 *   metatileId: doorMetatileId,
 *   isAnimatedDoor: true,
 *   entryDirection: 'up',
 *   warpTrigger: trigger,
 * });
 *
 * // In game loop, update and respond to actions
 * const update = doorSequencer.updateEntry(now, player.isMoving, isAnimDone, fadeDone);
 * if (update.action === 'startPlayerStep') {
 *   player.forceMove(update.direction);
 * }
 * ```
 */

import { useRef, useCallback } from 'react';
import {
  DoorSequencer,
  type DoorEntryConfig,
  type DoorExitConfig,
  type DoorEntryUpdateResult,
  type DoorExitUpdateResult,
} from '../field/DoorSequencer';
import type { WarpHandler } from '../field/WarpHandler';

export interface UseDoorSequencerOptions {
  /** WarpHandler instance for coordinating warp state */
  warpHandler?: WarpHandler;
  /** Callback when entry sequence starts */
  onEntryStart?: () => void;
  /** Callback when entry sequence completes */
  onEntryComplete?: () => void;
  /** Callback when exit sequence starts */
  onExitStart?: () => void;
  /** Callback when exit sequence completes */
  onExitComplete?: () => void;
}

export interface UseDoorSequencerReturn {
  /** Start a door entry sequence */
  startEntry: (config: DoorEntryConfig, currentTime: number) => DoorEntryUpdateResult;
  /** Start an auto-warp entry sequence (skips to fade phase) */
  startAutoWarp: (config: DoorEntryConfig, currentTime: number, skipWait?: boolean) => DoorEntryUpdateResult;
  /** Update the door entry sequence */
  updateEntry: (
    currentTime: number,
    playerIsMoving: boolean,
    isAnimationDone: (animId: number | undefined) => boolean,
    isFadeDone: boolean
  ) => DoorEntryUpdateResult;
  /** Start a door exit sequence */
  startExit: (config: DoorExitConfig, currentTime: number) => DoorExitUpdateResult;
  /** Update the door exit sequence */
  updateExit: (
    currentTime: number,
    playerIsMoving: boolean,
    isAnimationDone: (animId: number | undefined) => boolean,
    isFadeInDone?: boolean
  ) => DoorExitUpdateResult;
  /** Set the open animation ID after spawning */
  setEntryOpenAnimId: (animId: number) => void;
  /** Set the close animation ID after spawning */
  setEntryCloseAnimId: (animId: number) => void;
  /** Set the exit open animation ID after spawning */
  setExitOpenAnimId: (animId: number) => void;
  /** Set the exit close animation ID after spawning */
  setExitCloseAnimId: (animId: number) => void;
  /** Check if any sequence is active */
  isActive: () => boolean;
  /** Check if entry sequence is active */
  isEntryActive: () => boolean;
  /** Check if exit sequence is active */
  isExitActive: () => boolean;
  /** Check if player should be hidden */
  isPlayerHidden: () => boolean;
  /** Reset all sequences */
  reset: () => void;
  /** Get door position for entry sequence */
  getEntryDoorPosition: () => { x: number; y: number } | null;
  /** Get door position for exit sequence */
  getExitDoorPosition: () => { x: number; y: number } | null;
  /** Access the underlying sequencer for advanced use */
  sequencer: DoorSequencer;
}

/**
 * Hook for managing door entry/exit sequences
 *
 * @param options - Configuration options
 * @returns Door sequencer controls and state
 */
export function useDoorSequencer(options: UseDoorSequencerOptions = {}): UseDoorSequencerReturn {
  const sequencerRef = useRef<DoorSequencer>(new DoorSequencer());
  const { warpHandler, onEntryStart, onEntryComplete, onExitStart, onExitComplete } = options;

  const startEntry = useCallback(
    (config: DoorEntryConfig, currentTime: number): DoorEntryUpdateResult => {
      const result = sequencerRef.current.startEntry(config, currentTime);
      warpHandler?.setInProgress(true);
      onEntryStart?.();
      return result;
    },
    [warpHandler, onEntryStart]
  );

  const startAutoWarp = useCallback(
    (config: DoorEntryConfig, currentTime: number, skipWait: boolean = true): DoorEntryUpdateResult => {
      const result = sequencerRef.current.startAutoWarp(config, currentTime, skipWait);
      warpHandler?.setInProgress(true);
      onEntryStart?.();
      return result;
    },
    [warpHandler, onEntryStart]
  );

  const updateEntry = useCallback(
    (
      currentTime: number,
      playerIsMoving: boolean,
      isAnimationDone: (animId: number | undefined) => boolean,
      isFadeDone: boolean
    ): DoorEntryUpdateResult => {
      const result = sequencerRef.current.updateEntry(
        currentTime,
        playerIsMoving,
        isAnimationDone,
        isFadeDone
      );
      if (result.done) {
        onEntryComplete?.();
      }
      return result;
    },
    [onEntryComplete]
  );

  const startExit = useCallback(
    (config: DoorExitConfig, currentTime: number): DoorExitUpdateResult => {
      const result = sequencerRef.current.startExit(config, currentTime);
      onExitStart?.();
      return result;
    },
    [onExitStart]
  );

  const updateExit = useCallback(
    (
      currentTime: number,
      playerIsMoving: boolean,
      isAnimationDone: (animId: number | undefined) => boolean,
      isFadeInDone: boolean = true
    ): DoorExitUpdateResult => {
      const result = sequencerRef.current.updateExit(currentTime, playerIsMoving, isAnimationDone, isFadeInDone);
      if (result.done) {
        warpHandler?.setInProgress(false);
        onExitComplete?.();
      }
      return result;
    },
    [warpHandler, onExitComplete]
  );

  const setEntryOpenAnimId = useCallback((animId: number) => {
    sequencerRef.current.setEntryOpenAnimId(animId);
  }, []);

  const setEntryCloseAnimId = useCallback((animId: number) => {
    sequencerRef.current.setEntryCloseAnimId(animId);
  }, []);

  const setExitOpenAnimId = useCallback((animId: number) => {
    sequencerRef.current.setExitOpenAnimId(animId);
  }, []);

  const setExitCloseAnimId = useCallback((animId: number) => {
    sequencerRef.current.setExitCloseAnimId(animId);
  }, []);

  const isActive = useCallback(() => {
    return sequencerRef.current.isActive();
  }, []);

  const isEntryActive = useCallback(() => {
    return sequencerRef.current.isEntryActive();
  }, []);

  const isExitActive = useCallback(() => {
    return sequencerRef.current.isExitActive();
  }, []);

  const isPlayerHidden = useCallback(() => {
    return sequencerRef.current.isPlayerHidden();
  }, []);

  const reset = useCallback(() => {
    sequencerRef.current.reset();
  }, []);

  const getEntryDoorPosition = useCallback(() => {
    return sequencerRef.current.getEntryDoorPosition();
  }, []);

  const getExitDoorPosition = useCallback(() => {
    return sequencerRef.current.getExitDoorPosition();
  }, []);

  return {
    startEntry,
    startAutoWarp,
    updateEntry,
    startExit,
    updateExit,
    setEntryOpenAnimId,
    setEntryCloseAnimId,
    setExitOpenAnimId,
    setExitCloseAnimId,
    isActive,
    isEntryActive,
    isExitActive,
    isPlayerHidden,
    reset,
    getEntryDoorPosition,
    getExitDoorPosition,
    sequencer: sequencerRef.current,
  };
}
