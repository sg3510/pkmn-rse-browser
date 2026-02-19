import { GameState, type GameStateManager } from '../../core';
import type { WildBattleStartRequest } from '../../battle/BattleStartRequest';
import { resolveBattleBackgroundProfile } from '../../battle/render/battleEnvironmentResolver';
import { GAME_VARS, gameVariables } from '../../game/GameVariables';
import type { PlayerController } from '../../game/PlayerController';
import type { WorldManager, WorldSnapshot } from '../../game/WorldManager';
import type { PartyPokemon } from '../../pokemon/types';
import type { LocationState } from '../../save/types';
import { saveManager } from '../../save/SaveManager';
import type { ObjectEventRuntimeState } from '../../types/objectEvents';
import type { WeatherStateSnapshot } from '../../weather/types';
import { tryGenerateStepEncounter } from './wildEncounterService';

interface MutableRef<T> {
  current: T;
}

export type WildEncounterStepState = {
  mapId: string;
  tileX: number;
  tileY: number;
  behavior: number | undefined;
};

export interface TryStartOverworldWildEncounterParams {
  worldManager: WorldManager | null;
  player: PlayerController;
  menuOpen: boolean;
  dialogOpen: boolean;
  warping: boolean;
  storyScriptRunning: boolean;
  seamTransitionScriptsRunning: boolean;
  doorSequenceActive: boolean;
  hasPendingScriptedWarp: boolean;
  stateManager: GameStateManager | null;
  lastStepRef: MutableRef<WildEncounterStepState | null>;
  transitionInFlightRef: MutableRef<boolean>;
  worldSnapshot: WorldSnapshot | null;
  buildLocationStateFromPlayer: (player: PlayerController, mapId: string) => LocationState;
  getWeatherSnapshot: () => WeatherStateSnapshot;
  getObjectEventRuntimeState: () => ObjectEventRuntimeState;
}

export interface WildEncounterTrackingRefs {
  lastStepRef: MutableRef<WildEncounterStepState | null>;
  transitionInFlightRef: MutableRef<boolean>;
}

function didStepToNewTile(
  previous: WildEncounterStepState | null,
  current: WildEncounterStepState | null
): boolean {
  if (!previous || !current) return false;
  return (
    previous.mapId !== current.mapId
    || previous.tileX !== current.tileX
    || previous.tileY !== current.tileY
  );
}

function resolveStepState(
  worldManager: WorldManager,
  player: PlayerController
): WildEncounterStepState | null {
  const encounterMap = worldManager.findMapAtPosition(player.tileX, player.tileY);
  const encounterMapId = encounterMap?.entry.id ?? null;
  if (!encounterMapId) {
    return null;
  }

  const resolver = player.getTileResolver();
  return {
    mapId: encounterMapId,
    tileX: player.tileX,
    tileY: player.tileY,
    behavior: resolver?.(player.tileX, player.tileY)?.attributes?.behavior,
  };
}

function getLeadPokemon(): PartyPokemon | null {
  return (
    saveManager
      .getParty()
      .find((mon): mon is PartyPokemon => mon !== null && mon.stats.hp > 0)
    ?? null
  );
}

export function resetOverworldWildEncounterTracking(refs: WildEncounterTrackingRefs): void {
  refs.lastStepRef.current = null;
  refs.transitionInFlightRef.current = false;
}

export function tryStartOverworldWildEncounter(params: TryStartOverworldWildEncounterParams): boolean {
  const {
    worldManager,
    player,
    menuOpen,
    dialogOpen,
    warping,
    storyScriptRunning,
    seamTransitionScriptsRunning,
    doorSequenceActive,
    hasPendingScriptedWarp,
    stateManager,
    lastStepRef,
    transitionInFlightRef,
    worldSnapshot,
    buildLocationStateFromPlayer,
    getWeatherSnapshot,
    getObjectEventRuntimeState,
  } = params;

  if (!worldManager) {
    return false;
  }

  let wildEncounterStartedThisFrame = false;
  const currentStepState = resolveStepState(worldManager, player);
  const previousStepState = lastStepRef.current;
  const steppedToNewTile = didStepToNewTile(previousStepState, currentStepState);

  const canAttemptWildEncounter = Boolean(
    steppedToNewTile
    && currentStepState
    && !menuOpen
    && !dialogOpen
    && !warping
    && !storyScriptRunning
    && !seamTransitionScriptsRunning
    && !doorSequenceActive
    && !hasPendingScriptedWarp
    && !transitionInFlightRef.current
    && stateManager
  );

  const manager = stateManager;
  if (canAttemptWildEncounter && currentStepState && manager) {
    const leadPokemon = getLeadPokemon();
    if (leadPokemon) {
      const weatherState = getWeatherSnapshot();
      const encounter = tryGenerateStepEncounter({
        mapId: currentStepState.mapId,
        currentTileBehavior: currentStepState.behavior,
        previousTileBehavior: previousStepState?.behavior,
        playerIsSurfing: player.isSurfing(),
        leadPokemon,
        isBikeRiding: player.isBikeRiding(),
        weatherName: weatherState.activeWeather,
        repelStepsRemaining: gameVariables.getVar('VAR_REPEL_STEP_COUNT'),
        whiteFluteActive: false,
        blackFluteActive: false,
      });

      if (encounter) {
        const battleRequest: WildBattleStartRequest = {
          battleType: 'wild',
          playerPokemon: leadPokemon,
          wildSpecies: encounter.species,
          wildLevel: encounter.level,
          backgroundProfile: resolveBattleBackgroundProfile({
            snapshot: worldSnapshot,
            playerTileX: player.tileX,
            playerTileY: player.tileY,
            mapIdHint: currentStepState.mapId,
            playerIsSurfing: player.isSurfing(),
            savedWeather: weatherState.savedWeather,
          }),
          returnLocation: buildLocationStateFromPlayer(player, currentStepState.mapId),
          returnObjectEventRuntimeState: getObjectEventRuntimeState(),
        };

        gameVariables.setVar(GAME_VARS.VAR_RESULT, 0);
        transitionInFlightRef.current = true;
        player.lockInput();
        void manager.transitionTo(
          GameState.BATTLE,
          battleRequest as unknown as Record<string, unknown>,
        ).finally(() => {
          transitionInFlightRef.current = false;
        });
        wildEncounterStartedThisFrame = true;
      }
    }
  }

  lastStepRef.current = currentStepState;
  return wildEncounterStartedThisFrame;
}
