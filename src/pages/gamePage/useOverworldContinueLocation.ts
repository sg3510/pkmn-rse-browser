import { useEffect } from 'react';
import { GameState, type GameStateManager } from '../../core';
import type { LocationState } from '../../save/types';
import type { MutableRef } from './types';


interface UseOverworldContinueLocationParams {
  currentState: GameState;
  stateManager: GameStateManager | null;
  selectedMapId: string;
  setSelectedMapId: (mapId: string) => void;
  setOverworldEntryReady: (ready: boolean) => void;
  pendingSavedLocationRef: MutableRef<LocationState | null>;
}

export function useOverworldContinueLocation(params: UseOverworldContinueLocationParams): void {
  const {
    currentState,
    stateManager,
    selectedMapId,
    setSelectedMapId,
    setOverworldEntryReady,
    pendingSavedLocationRef,
  } = params;

  useEffect(() => {
    if (currentState !== GameState.OVERWORLD) {
      setOverworldEntryReady(false);
      pendingSavedLocationRef.current = null;
      return;
    }

    if (!stateManager) {
      return;
    }

    const overworldState = stateManager.getCurrentRenderer();
    if (!overworldState || overworldState.id !== GameState.OVERWORLD) {
      return;
    }

    const state = overworldState as {
      consumeSavedLocation?: () => LocationState | null;
      isContinue?: () => boolean;
      isNewGame?: () => boolean;
    };
    if (typeof state.consumeSavedLocation !== 'function') {
      setOverworldEntryReady(true);
      return;
    }

    const entryReason = state.isContinue?.() === true
      ? 'continue'
      : state.isNewGame?.() === true
        ? 'new-game'
        : 'state-transition';

    const savedLocation = state.consumeSavedLocation();
    if (savedLocation) {
      console.log(`[GamePage] Got saved location for OVERWORLD entry (${entryReason}):`, {
        mapId: savedLocation.location.mapId,
        pos: savedLocation.pos,
      });

      pendingSavedLocationRef.current = savedLocation;

      const savedMapId = savedLocation.location.mapId;
      if (savedMapId && savedMapId !== selectedMapId) {
        console.log('[GamePage] Changing map to saved location:', savedMapId);
        setSelectedMapId(savedMapId);
      }
    }

    setOverworldEntryReady(true);
  }, [
    currentState,
    stateManager,
    selectedMapId,
    setSelectedMapId,
    setOverworldEntryReady,
    pendingSavedLocationRef,
  ]);
}
