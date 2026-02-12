/**
 * useAutoSave Hook
 *
 * Provides automatic save functionality for the game:
 * - Auto-save every 60 seconds while in overworld
 * - Auto-save on map change (warp completed)
 * - Manual save trigger
 * - Debounce to prevent rapid saves
 */

import { useCallback, useEffect, useRef } from 'react';
import { saveManager } from './SaveManager';
import type { LocationState } from './types';
import type { ObjectEventRuntimeState } from '../types/objectEvents';

/** Auto-save interval in milliseconds (60 seconds) */
const AUTO_SAVE_INTERVAL_MS = 60 * 1000;

/** Minimum time between saves (5 seconds) */
const SAVE_DEBOUNCE_MS = 5 * 1000;

export interface AutoSaveConfig {
  /** Whether auto-save is enabled */
  enabled: boolean;
  /** Current game state for conditional saves */
  isOverworld: boolean;
  /** Whether the game is ready (player loaded, etc.) */
  isReady: boolean;
}

export interface AutoSaveCallbacks {
  /** Get current location state for saving */
  getLocationState: () => LocationState | null;
  /** Get current object-event runtime state for saving */
  getObjectEventRuntimeState?: () => ObjectEventRuntimeState | null;
  /** Called after successful save */
  onSave?: () => void;
  /** Called on save error */
  onError?: (error: string) => void;
}

export interface AutoSaveReturn {
  /** Trigger a manual save */
  save: () => boolean;
  /** Trigger save on map change */
  saveOnMapChange: (newMapId: string) => boolean;
  /** Time since last save in ms */
  timeSinceLastSave: () => number;
  /** Whether auto-save is active */
  isActive: boolean;
}

/**
 * Hook for automatic save management
 *
 * @example
 * ```tsx
 * const { save, saveOnMapChange } = useAutoSave(
 *   { enabled: true, isOverworld: true, isReady: true },
 *   {
 *     getLocationState: () => ({
 *       pos: { x: player.tileX, y: player.tileY },
 *       location: { mapId, warpId: 0, x: player.tileX, y: player.tileY },
 *       // ... other location fields
 *     }),
 *     onSave: () => console.log('Saved!'),
 *   }
 * );
 *
 * // Later, on warp completion:
 * saveOnMapChange(newMapId);
 * ```
 */
export function useAutoSave(
  config: AutoSaveConfig,
  callbacks: AutoSaveCallbacks
): AutoSaveReturn {
  const lastSaveTimeRef = useRef<number>(0);
  const lastMapIdRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { enabled, isOverworld, isReady } = config;
  const { getLocationState, getObjectEventRuntimeState, onSave, onError } = callbacks;

  /**
   * Check if enough time has passed since last save
   */
  const canSave = useCallback((): boolean => {
    const now = Date.now();
    return now - lastSaveTimeRef.current >= SAVE_DEBOUNCE_MS;
  }, []);

  /**
   * Perform the actual save operation
   */
  const doSave = useCallback((): boolean => {
    if (!isReady) {
      console.log('[AutoSave] Not ready, skipping save');
      return false;
    }

    if (!canSave()) {
      console.log('[AutoSave] Debounced, skipping save');
      return false;
    }

    const locationState = getLocationState();
    if (!locationState) {
      console.log('[AutoSave] No location state, skipping save');
      return false;
    }

    const runtimeState = getObjectEventRuntimeState?.() ?? undefined;
    const result = saveManager.save(0, locationState, runtimeState);

    if (result.success) {
      lastSaveTimeRef.current = Date.now();
      lastMapIdRef.current = locationState.location.mapId;
      console.log('[AutoSave] Saved successfully');
      onSave?.();
      return true;
    } else {
      console.error('[AutoSave] Save failed:', result.error);
      onError?.(result.error ?? 'Unknown error');
      return false;
    }
  }, [isReady, canSave, getLocationState, getObjectEventRuntimeState, onSave, onError]);

  /**
   * Manual save trigger
   */
  const save = useCallback((): boolean => {
    return doSave();
  }, [doSave]);

  /**
   * Save on map change (called after warp completes)
   */
  const saveOnMapChange = useCallback((newMapId: string): boolean => {
    // Only save if map actually changed
    if (newMapId === lastMapIdRef.current) {
      console.log('[AutoSave] Same map, skipping save');
      return false;
    }

    console.log(`[AutoSave] Map changed: ${lastMapIdRef.current} -> ${newMapId}`);
    return doSave();
  }, [doSave]);

  /**
   * Get time since last save
   */
  const timeSinceLastSave = useCallback((): number => {
    return Date.now() - lastSaveTimeRef.current;
  }, []);

  /**
   * Set up auto-save interval
   */
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only auto-save when enabled, in overworld, and ready
    if (!enabled || !isOverworld || !isReady) {
      return;
    }

    console.log('[AutoSave] Starting auto-save interval');

    intervalRef.current = setInterval(() => {
      console.log('[AutoSave] Auto-save tick');
      doSave();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isOverworld, isReady, doSave]);

  return {
    save,
    saveOnMapChange,
    timeSinceLastSave,
    isActive: enabled && isOverworld && isReady,
  };
}

/**
 * Get a save preview for display
 */
export function getSavePreview(): {
  exists: boolean;
  playerName?: string;
  mapId?: string;
  playTimeStr?: string;
} {
  const slots = saveManager.getSaveSlots();
  const slot0 = slots[0];

  if (!slot0.exists || !slot0.preview) {
    return { exists: false };
  }

  const { playerName, mapId, playTime } = slot0.preview;
  const playTimeStr = `${playTime.hours}:${String(playTime.minutes).padStart(2, '0')}`;

  return {
    exists: true,
    playerName,
    mapId,
    playTimeStr,
  };
}
