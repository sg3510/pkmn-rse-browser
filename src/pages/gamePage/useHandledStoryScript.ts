import { useCallback } from 'react';
import { GameState, type GameStateManager } from '../../core';
import { DOOR_TIMING } from '../../field/types';
import type { PlayerController } from '../../game/PlayerController';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { WorldManager } from '../../game/WorldManager';
import { executeStoryScript, isHandledStoryScript, type StoryScriptContext } from '../../game/NewGameFlow';
import { getJumpConfig, getJumpYOffset } from '../../game/jumpArc';
import type { UseDoorAnimationsReturn } from '../../hooks/useDoorAnimations';
import type { UseNPCMovementReturn } from '../../hooks/useNPCMovement';
import { npcMovementEngine, directionToGBA } from '../../game/npc/NPCMovementEngine';
import type { LocationState } from '../../save/types';
import { saveManager } from '../../save/SaveManager';
import type { PartyPokemon } from '../../pokemon/types';
import { SPECIES } from '../../data/species';
import { gameVariables } from '../../game/GameVariables';
import { ScriptRunner, type ScriptRuntimeServices } from '../../scripting/ScriptRunner';
import {
  BATTLE_OUTCOME,
  normalizeBattleOutcome,
  type ScriptBattleResult,
  type ScriptWildBattleRequest,
} from '../../scripting/battleTypes';
import type {
  TrainerBattleStartRequest,
  WildBattleStartRequest,
} from '../../battle/BattleStartRequest';
import { getMapScripts, getCommonScripts } from '../../data/scripts';
import { resolveBattleBackgroundProfile } from '../../battle/render/battleEnvironmentResolver';
import { menuStateManager } from '../../menu/MenuStateManager';
import { stepCallbackManager } from '../../game/StepCallbackManager';
import { recordStoryScriptTimelineEvent } from '../../game/debug/storyScriptTimeline';
import { shouldAutoRecoverStoryScriptFade } from './storyScriptFadeRecovery';
import { resolveTrainerBattle, resolveTrainerBattleById } from './trainerBattleFallback';
import type { MutableRef } from './types';


interface PendingScriptedWarpLike {
  mapId: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  phase: 'pending' | 'fading' | 'loading';
  style?: 'default' | 'fall';
  traversal?: {
    surfing: boolean;
    underwater: boolean;
  };
}

export interface UseHandledStoryScriptParams {
  showMessage: StoryScriptContext['showMessage'];
  showChoice: StoryScriptContext['showChoice'];
  showYesNo: (text: string) => Promise<boolean>;
  stateManager: GameStateManager | null;
  selectedMapId: string;
  buildLocationStateFromPlayer: (player: PlayerController, mapId: string) => LocationState;
  playerRef: MutableRef<PlayerController | null>;
  worldManagerRef: MutableRef<WorldManager | null>;
  pendingSavedLocationRef: MutableRef<LocationState | null>;
  overworldLoadingRef: MutableRef<boolean>;
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarpLike | null>;
  warpingRef: MutableRef<boolean>;
  playerHiddenRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  npcMovement: UseNPCMovementReturn;
  doorAnimations: UseDoorAnimationsReturn;
  gbaFrameRef: MutableRef<number>;
  gbaFrameMs: number;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number, collision?: number) => boolean;
  setCurrentMapLayoutById?: (layoutId: string) => Promise<boolean>;
  scriptRuntimeServices?: ScriptRuntimeServices;
  getSavedWeather?: () => string | number | null;
}

export function useHandledStoryScript(params: UseHandledStoryScriptParams): (scriptName: string, currentMapId?: string) => Promise<boolean> {
  const {
    showMessage,
    showChoice,
    showYesNo,
    stateManager,
    selectedMapId,
    buildLocationStateFromPlayer,
    playerRef,
    worldManagerRef,
    pendingSavedLocationRef,
    overworldLoadingRef,
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    objectEventManagerRef,
    npcMovement,
    doorAnimations,
    gbaFrameRef,
    gbaFrameMs,
    setMapMetatile,
    setCurrentMapLayoutById,
    scriptRuntimeServices,
    getSavedWeather,
  } = params;

  const SCRIPT_CALLBACK_RECOVERY_FADE_FRAMES = 16;

  return useCallback(async (scriptName: string, currentMapId?: string): Promise<boolean> => {
    // Use the actual current map ID (from render loop) when available,
    // falling back to React state selectedMapId. This prevents stale map IDs
    // after non-scripted warps where selectedMapId doesn't update.
    const effectiveMapId = currentMapId ?? selectedMapId;

    if (storyScriptRunningRef.current) {
      return true;
    }

    const player = playerRef.current;
    if (!player) {
      return true;
    }

    // Lock input IMMEDIATELY (synchronously) before any async work.
    // This prevents the player from moving during the gap between detecting
    // a script trigger (ON_FRAME, coord event) and starting execution.
    console.log(`[StoryScript] ▶ Starting: ${scriptName}`);
    console.trace(`[StoryScript] lockInput caller for: ${scriptName}`);
    storyScriptRunningRef.current = true;
    player.lockInputPreserveMovement();
    npcMovement.setEnabled(false);
    recordStoryScriptTimelineEvent({
      kind: 'story_script_start',
      frame: gbaFrameRef.current,
      mapId: effectiveMapId,
      scriptName,
      callback: stepCallbackManager.getDebugState(),
      details: {
        playerMoving: player.isMoving,
      },
    });

    const isHandCoded = isHandledStoryScript(scriptName);

    // If not hand-coded, check if we have generated script data for it
    if (!isHandCoded) {
      const [mapData, commonData] = await Promise.all([
        getMapScripts(effectiveMapId),
        getCommonScripts(),
      ]);
      // Script not in hand-coded set AND not in generated data → not handled
      const inMapData = mapData && scriptName in mapData.scripts;
      const inCommonData = scriptName in commonData.scripts;
      if (!inMapData && !inCommonData) {
        // Script doesn't exist — unlock immediately
        player.unlockInput();
        npcMovement.setEnabled(true);
        storyScriptRunningRef.current = false;
        recordStoryScriptTimelineEvent({
          kind: 'story_script_end',
          frame: gbaFrameRef.current,
          mapId: effectiveMapId,
          scriptName,
          callback: stepCallbackManager.getDebugState(),
          details: {
            handled: false,
            reason: 'missing-script',
          },
        });
        return false;
      }
    }
    const heldDoorAnimIds = new Map<string, number>();
    let handled = false;

    try {
      const waitFrames = async (frames: number): Promise<void> => {
        if (frames <= 0) return;
        const ms = Math.max(1, Math.round(frames * gbaFrameMs));
        await new Promise<void>((resolve) => setTimeout(resolve, ms));
      };

      const playScriptDoorAnimation = async (
        mapId: string,
        tileX: number,
        tileY: number,
        direction: 'open' | 'close'
      ): Promise<void> => {
        const snapshot = worldManagerRef.current?.getSnapshot();
        if (!snapshot) {
          await waitFrames(1);
          return;
        }

        const map = snapshot.maps.find((m) => m.entry.id === mapId);
        if (!map) {
          await waitFrames(1);
          return;
        }

        if (tileX < 0 || tileY < 0 || tileX >= map.mapData.width || tileY >= map.mapData.height) {
          await waitFrames(1);
          return;
        }

        const tileIndex = tileY * map.mapData.width + tileX;
        const mapTile = map.mapData.layout[tileIndex];
        if (!mapTile) {
          await waitFrames(1);
          return;
        }

        const metatileId = mapTile.metatileId;
        const worldX = map.offsetX + tileX;
        const worldY = map.offsetY + tileY;
        const doorKey = `${mapId}:${tileX}:${tileY}`;

        if (direction === 'close') {
          const heldAnimId = heldDoorAnimIds.get(doorKey);
          if (heldAnimId !== undefined) {
            doorAnimations.clearById(heldAnimId);
            heldDoorAnimIds.delete(doorKey);
          }
        }

        const holdOnComplete = direction === 'open';
        const animId = await doorAnimations.spawn(
          direction,
          worldX,
          worldY,
          metatileId,
          performance.now(),
          holdOnComplete
        );
        if (holdOnComplete && animId !== null) {
          heldDoorAnimIds.set(doorKey, animId);
        }

        const doorAnimFrames = Math.max(
          1,
          Math.round((DOOR_TIMING.FRAME_DURATION_MS * DOOR_TIMING.FRAME_COUNT) / gbaFrameMs)
        );
        await waitFrames(doorAnimFrames);
      };

      const getDirectionDelta = (direction: 'up' | 'down' | 'left' | 'right'): { dx: number; dy: number } => {
        if (direction === 'up') return { dx: 0, dy: -1 };
        if (direction === 'down') return { dx: 0, dy: 1 };
        if (direction === 'left') return { dx: -1, dy: 0 };
        return { dx: 1, dy: 0 };
      };

      // C reference:
      // public/pokeemerald/src/event_object_movement.c
      // MOVE_SPEED_* and MovementAction_Walk* / WalkInPlace* implementations
      type ScriptMoveMode = NonNullable<Parameters<StoryScriptContext['movePlayer']>[1]>;
      const TILE_PIXELS = 16;

      const getWalkFramesForMode = (mode: ScriptMoveMode): number => {
        switch (mode) {
          case 'walk_slow':
            return 32;
          case 'walk':
            return 16;
          case 'walk_fast':
          case 'run':
            return 8;
          case 'ride_water_current':
            return 6;
          case 'walk_faster':
            return 4;
          case 'walk_fastest':
            return 2;
          default:
            return 16;
        }
      };

      const getWalkInPlaceFramesForMode = (mode: ScriptMoveMode): number | null => {
        switch (mode) {
          case 'walk_in_place_slow':
            return 32;
          case 'walk_in_place':
            return 16;
          case 'walk_in_place_fast':
            return 8;
          case 'walk_in_place_faster':
            return 4;
          default:
            return null;
        }
      };

      const movePlayerStep = async (
        direction: 'up' | 'down' | 'left' | 'right',
        mode: ScriptMoveMode = 'walk'
      ): Promise<void> => {
        player.dir = direction;
        if (mode === 'face') {
          await waitFrames(1);
          return;
        }

        const walkInPlaceFrames = getWalkInPlaceFramesForMode(mode);
        if (walkInPlaceFrames !== null) {
          await waitFrames(walkInPlaceFrames);
          return;
        }

        if (mode === 'jump_in_place') {
          // Jump in place: face direction + brief delay (no tile movement)
          await waitFrames(16);
          return;
        }

        if (mode === 'jump') {
          player.forceJump(direction, 'normal');
          let guard = 0;
          while (player.isMoving && guard < 120) {
            await waitFrames(1);
            guard++;
          }
          return;
        }

        const walkFrames = getWalkFramesForMode(mode);
        const speedPxPerMs = TILE_PIXELS / (walkFrames * gbaFrameMs);
        player.forceMove(direction, true, speedPxPerMs);
        let guard = 0;
        while (player.isMoving && guard < 120) {
          await waitFrames(1);
          guard++;
        }
      };

      const moveNpcStep = async (
        mapId: string,
        localId: string,
        direction: 'up' | 'down' | 'left' | 'right',
        mode: ScriptMoveMode = 'walk'
      ): Promise<void> => {
        const objectManager = objectEventManagerRef.current;
        const npc = objectManager.getNPCByLocalId(mapId, localId);
        if (!npc) {
          console.warn(`[moveNpcStep] NPC not found: ${mapId}/${localId}`);
          await waitFrames(1);
          return;
        }

        npc.direction = direction;
        if (mode === 'face') {
          npc.isWalking = false;
          npc.subTileX = 0;
          npc.subTileY = 0;
          // Sync movement engine state so it doesn't overwrite the direction
          // when it resumes after the script ends.
          const engineState = npcMovementEngine.getState(npc.id);
          if (engineState) {
            engineState.facingDirection = directionToGBA(direction);
          }
          await waitFrames(1);
          return;
        }

        const walkInPlaceFrames = getWalkInPlaceFramesForMode(mode);
        if (walkInPlaceFrames !== null) {
          npc.isWalking = true;
          npc.subTileX = 0;
          npc.subTileY = 0;
          for (let frame = 0; frame < walkInPlaceFrames; frame++) {
            await waitFrames(1);
          }
          npc.isWalking = false;
          npc.subTileX = 0;
          npc.subTileY = 0;
          return;
        }

        // Jump modes (in_place or normal 1-tile jump)
        if (mode === 'jump' || mode === 'jump_in_place') {
          const config = getJumpConfig(mode === 'jump' ? 'normal' : 'in_place');
          const { dx, dy } = getDirectionDelta(direction);

          if (config.tileDistance > 0) {
            npc.tileX += dx;
            npc.tileY += dy;
          }

          npc.isWalking = true;
          npc.showShadow = true;

          for (let frame = 0; frame < config.totalFrames; frame++) {
            npc.spriteYOffset = getJumpYOffset(config, frame);
            if (config.tileDistance > 0) {
              const remaining = config.totalFrames - (frame + 1);
              npc.subTileX = -dx * TILE_PIXELS * (remaining / config.totalFrames);
              npc.subTileY = -dy * TILE_PIXELS * (remaining / config.totalFrames);
            }
            await waitFrames(1);
          }

          npc.spriteYOffset = 0;
          npc.showShadow = false;
          npc.isWalking = false;
          npc.subTileX = 0;
          npc.subTileY = 0;
          return;
        }

        // Walk mode
        const walkFrames = getWalkFramesForMode(mode);
        const { dx, dy } = getDirectionDelta(direction);
        const walkDurationMs = walkFrames * gbaFrameMs;
        const walkSpeedPxPerMs = TILE_PIXELS / walkDurationMs;
        npc.isWalking = true;
        npc.tileX += dx;
        npc.tileY += dy;
        npc.subTileX = -dx * TILE_PIXELS;
        npc.subTileY = -dy * TILE_PIXELS;

        const startMs = performance.now();
        while (true) {
          const elapsedMs = Math.min(walkDurationMs, performance.now() - startMs);
          const movedPx = Math.min(TILE_PIXELS, elapsedMs * walkSpeedPxPerMs);
          const remainingPx = TILE_PIXELS - movedPx;
          npc.subTileX = -dx * remainingPx;
          npc.subTileY = -dy * remainingPx;
          if (elapsedMs >= walkDurationMs) break;
          await waitFrames(1);
        }

        npc.isWalking = false;
        npc.subTileX = 0;
        npc.subTileY = 0;
      };

      // C parity: script commands like setobjectxy use map-local coordinates.
      // Convert to world coordinates using the current map instance offset.
      const mapLocalToWorld = (mapId: string, tileX: number, tileY: number): { x: number; y: number } => {
        const map = worldManagerRef.current?.getSnapshot().maps.find((m) => m.entry.id === mapId);
        if (!map) {
          // During async map stitching/re-anchor boundaries, the snapshot can momentarily
          // miss a map that still has parsed object events. Fall back to object manager
          // offsets before giving up to avoid setobjectxy placing NPCs at raw coords.
          const fallbackOffset = objectEventManagerRef.current.getMapOffset(mapId);
          if (fallbackOffset) {
            return {
              x: fallbackOffset.x + tileX,
              y: fallbackOffset.y + tileY,
            };
          }
          console.warn(`[StoryScript] mapLocalToWorld: map ${mapId} not in snapshot, using raw coords`);
          return { x: tileX, y: tileY };
        }
        return {
          x: map.offsetX + tileX,
          y: map.offsetY + tileY,
        };
      };

      const isPlayerLocalId = (localId: string): boolean =>
        localId === 'LOCALID_PLAYER' || localId === '255';

      const buildReturnLocation = (): LocationState => {
        const worldManager = worldManagerRef.current;
        const currentMap = worldManager?.findMapAtPosition(player.tileX, player.tileY);
        const returnMapId = currentMap?.entry.id ?? selectedMapId;
        return buildLocationStateFromPlayer(player, returnMapId);
      };

      const waitForBattleToEnd = async (): Promise<void> => {
        if (!stateManager) return;
        let guard = 0;
        while (
          (stateManager.getCurrentState() === GameState.BATTLE
            || stateManager.getCurrentState() === GameState.EVOLUTION)
          && guard < 72000
        ) {
          await waitFrames(1);
          guard++;
        }
        if (guard >= 72000) {
          console.warn('[StoryScript] Timed out waiting for battle to end.');
        }

        let loadGuard = 0;
        while (overworldLoadingRef.current && loadGuard < 72000) {
          await waitFrames(1);
          loadGuard++;
        }
        if (loadGuard >= 72000) {
          console.warn('[StoryScript] Timed out waiting for overworld map load after battle.');
        }
      };

      const readBattleResult = (): ScriptBattleResult => {
        const outcome = normalizeBattleOutcome(
          gameVariables.getVar('VAR_RESULT'),
          BATTLE_OUTCOME.WON
        );
        return { outcome };
      };

      const resolveBackgroundProfile = (
        wildBattle?: Pick<ScriptWildBattleRequest, 'source' | 'speciesId'>,
      ) => {
        const snapshot = worldManagerRef.current?.getSnapshot() ?? null;
        return resolveBattleBackgroundProfile({
          snapshot,
          playerTileX: player.tileX,
          playerTileY: player.tileY,
          mapIdHint: effectiveMapId,
          playerIsSurfing: player.isSurfing(),
          savedWeather: getSavedWeather?.() ?? null,
          wildBattle: wildBattle ?? null,
        });
      };

      const scriptCtx: StoryScriptContext = {
        showMessage,
        showChoice,
        getPlayerGender: () => saveManager.getProfile().gender,
        getPlayerName: () => saveManager.getPlayerName(),
        hasPartyPokemon: () => saveManager.hasParty(),
        setParty: (party) => {
          saveManager.setParty(party);
        },
        startFirstBattle: async (starter: PartyPokemon) => {
          if (!stateManager) return;

          const battleRequest: WildBattleStartRequest = {
            battleType: 'wild',
            playerPokemon: starter,
            wildSpecies: SPECIES.POOCHYENA,
            wildLevel: 2,
            firstBattle: true,
            backgroundProfile: resolveBackgroundProfile(),
            returnLocation: buildReturnLocation(),
            returnObjectEventRuntimeState: objectEventManagerRef.current.getRuntimeState(),
          };
          await stateManager.transitionTo(GameState.BATTLE, battleRequest as unknown as Record<string, unknown>);
          await waitForBattleToEnd();
        },
        startTrainerBattle: async (request) => {
          if (!stateManager) return { outcome: BATTLE_OUTCOME.WON };
          if (request.trainer) {
            const lead = saveManager.getParty().find((mon): mon is PartyPokemon => mon !== null);
            if (!lead) {
              console.warn('[StoryScript] Cannot start trainer battle without a party Pokemon.');
              return { outcome: BATTLE_OUTCOME.WON };
            }

            gameVariables.setVar('VAR_RESULT', 0);
            const battleRequest: TrainerBattleStartRequest = {
              battleType: 'trainer',
              playerPokemon: lead,
              trainer: request.trainer,
              backgroundProfile: resolveBackgroundProfile(),
              returnLocation: buildReturnLocation(),
              returnObjectEventRuntimeState: objectEventManagerRef.current.getRuntimeState(),
            };
            await stateManager.transitionTo(
              GameState.BATTLE,
              battleRequest as unknown as Record<string, unknown>,
            );
            await waitForBattleToEnd();
            return readBattleResult();
          }

          const trainerId = String(request.trainerId);
          const battle = resolveTrainerBattle(trainerId);
          const numericFallback = battle.kind === 'unknown_trainer' && /^\d+$/.test(trainerId)
            ? resolveTrainerBattleById(Number(trainerId))
            : battle;
          if (numericFallback.kind === 'unknown_trainer') {
            console.warn(`[StoryScript] Unknown trainer constant: ${trainerId}`);
            return { outcome: BATTLE_OUTCOME.WON };
          }
          if (numericFallback.kind === 'empty_party') {
            console.warn(`[StoryScript] Trainer has empty party: ${trainerId}`);
            return { outcome: BATTLE_OUTCOME.WON };
          }

          const lead = saveManager.getParty().find((mon): mon is PartyPokemon => mon !== null);
          if (!lead) {
            console.warn('[StoryScript] Cannot start trainer battle without a party Pokemon.');
            return { outcome: BATTLE_OUTCOME.WON };
          }

          gameVariables.setVar('VAR_RESULT', 0);
          const battleRequest: TrainerBattleStartRequest = {
            battleType: 'trainer',
            playerPokemon: lead,
            trainer: numericFallback.trainer,
            backgroundProfile: resolveBackgroundProfile(),
            returnLocation: buildReturnLocation(),
            returnObjectEventRuntimeState: objectEventManagerRef.current.getRuntimeState(),
          };
          await stateManager.transitionTo(
            GameState.BATTLE,
            battleRequest as unknown as Record<string, unknown>,
          );
          await waitForBattleToEnd();
          return readBattleResult();
        },
        startWildBattle: async (request) => {
          if (!stateManager) return { outcome: BATTLE_OUTCOME.WON };
          const speciesId = Number(request.speciesId);
          const level = Number(request.level);
          if (!Number.isFinite(speciesId) || speciesId <= 0 || !Number.isFinite(level) || level <= 0) {
            console.warn('[StoryScript] Invalid wild battle request payload:', request);
            return { outcome: BATTLE_OUTCOME.WON };
          }

          const lead = saveManager.getParty().find((mon): mon is PartyPokemon => mon !== null);
          if (!lead) {
            console.warn('[StoryScript] Cannot start wild battle without a party Pokemon.');
            return { outcome: BATTLE_OUTCOME.WON };
          }

          gameVariables.setVar('VAR_RESULT', 0);
          const battleRequest: WildBattleStartRequest = {
            battleType: 'wild',
            playerPokemon: lead,
            wildSpecies: Math.trunc(speciesId),
            wildLevel: Math.trunc(level),
            wildHeldItem: Math.trunc(Number(request.heldItemId) || 0),
            backgroundProfile: resolveBackgroundProfile({
              source: request.source,
              speciesId: Math.trunc(speciesId),
            }),
            returnLocation: buildReturnLocation(),
            returnObjectEventRuntimeState: objectEventManagerRef.current.getRuntimeState(),
          };
          await stateManager.transitionTo(GameState.BATTLE, battleRequest as unknown as Record<string, unknown>);
          await waitForBattleToEnd();
          return readBattleResult();
        },
        queueWarp: (mapId, x, y, direction, options) => {
          pendingSavedLocationRef.current = {
            pos: { x, y },
            location: { mapId, warpId: 0, x, y },
            continueGameWarp: { mapId, warpId: 0, x, y },
            lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
            escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
            direction,
            elevation: player.getElevation(),
            isSurfing: player.isSurfing(),
            isUnderwater: player.isUnderwater(),
            bikeMode: player.getBikeMode(),
            isRidingBike: player.isBikeRiding(),
          };

          pendingScriptedWarpRef.current = {
            mapId,
            x,
            y,
            direction,
            phase: 'pending',
            style: options?.style ?? 'default',
          };
          warpingRef.current = true;
        },
        forcePlayerStep: (direction) => {
          let deltaX = 0;
          let deltaY = 0;
          if (direction === 'up') deltaY = -1;
          else if (direction === 'down') deltaY = 1;
          else if (direction === 'left') deltaX = -1;
          else if (direction === 'right') deltaX = 1;

          player.setPosition(player.tileX + deltaX, player.tileY + deltaY);
          player.dir = direction;
        },
        delayFrames: waitFrames,
        movePlayer: movePlayerStep,
        moveNpc: moveNpcStep,
        faceNpcToPlayer: (mapId, localId) => {
          const objectManager = objectEventManagerRef.current;
          const npc = objectManager.getNPCByLocalId(mapId, localId);
          if (!npc) return;

          const dx = player.tileX - npc.tileX;
          const dy = player.tileY - npc.tileY;
          if (Math.abs(dx) > Math.abs(dy)) {
            npc.direction = dx < 0 ? 'left' : 'right';
          } else if (dy !== 0) {
            npc.direction = dy < 0 ? 'up' : 'down';
          }
        },
        setNpcPosition: (mapId, localId, tileX, tileY) => {
          const worldPos = mapLocalToWorld(mapId, tileX, tileY);
          if (
            mapId === 'MAP_ROUTE101'
            && (
              localId === 'LOCALID_ROUTE101_BIRCH'
              || localId === 'LOCALID_ROUTE101_ZIGZAGOON'
              || isPlayerLocalId(localId)
            )
          ) {
            console.log(
              `[ROUTE101] setobjectxy ${localId} local=(${tileX},${tileY}) `
              + `-> world=(${worldPos.x},${worldPos.y})`
            );
          }
          if (isPlayerLocalId(localId)) {
            // C parity: setobjectxy LOCALID_PLAYER uses map-local coordinates too.
            player.setPosition(worldPos.x, worldPos.y);
            return;
          }

          objectEventManagerRef.current.setNPCPositionByLocalId(mapId, localId, worldPos.x, worldPos.y);
        },
        setNpcTemplatePosition: (mapId, localId, tileX, tileY) => {
          const worldPos = mapLocalToWorld(mapId, tileX, tileY);
          objectEventManagerRef.current.setNPCTemplatePositionByLocalId(mapId, localId, worldPos.x, worldPos.y);
        },
        setNpcVisible: (mapId, localId, visible, persistent) => {
          objectEventManagerRef.current.setNPCVisibilityByLocalId(mapId, localId, visible, persistent);
        },
        playDoorAnimation: playScriptDoorAnimation,
        setPlayerVisible: (visible) => {
          playerHiddenRef.current = !visible;
        },
        setMapMetatile: setMapMetatile
          ? (mapId, tileX, tileY, metatileId, collision?) => {
              setMapMetatile(mapId, tileX, tileY, metatileId, collision);
            }
          : undefined,
        setNpcMovementType: (mapId, localId, movementTypeRaw) => {
          objectEventManagerRef.current.setNPCMovementTypeByLocalId(mapId, localId, movementTypeRaw);
        },
        setSpriteHidden: (mapId, localId, hidden) => {
          objectEventManagerRef.current.setNPCSpriteHiddenByLocalId(mapId, localId, hidden);
        },
        startNpcDisguiseReveal: (mapId, localId) => {
          return objectEventManagerRef.current.startNPCDisguiseRevealByLocalId(mapId, localId);
        },
        finishNpcDisguiseReveal: (mapId, localId) => {
          return objectEventManagerRef.current.completeNPCDisguiseRevealByLocalId(mapId, localId);
        },
        showYesNo,
        getParty: () => saveManager.getParty(),
        hasNpc: (mapId, localId) => {
          return objectEventManagerRef.current.getNPCByLocalId(mapId, localId) != null;
        },
        findNpcMapId: (localId) => {
          const allNpcs = objectEventManagerRef.current.getAllNPCs();
          const hit = allNpcs.find((npc) => {
            if (npc.localId === localId) return true;
            if (/^\d+$/.test(localId)) {
              return npc.localIdNumber === Number.parseInt(localId, 10);
            }
            return false;
          });
          if (!hit) return null;
          const marker = '_npc_';
          const idx = hit.id.indexOf(marker);
          return idx > 0 ? hit.id.slice(0, idx) : null;
        },
        getNpcPosition: (mapId, localId) => {
          const npc = objectEventManagerRef.current.getNPCByLocalId(mapId, localId);
          if (!npc) return null;
          return { tileX: npc.tileX, tileY: npc.tileY };
        },
        getNpcGraphicsId: (mapId, localId) => {
          const npc = objectEventManagerRef.current.getNPCByLocalId(mapId, localId);
          return npc?.graphicsId ?? null;
        },
        getMapOffset: (mapId) => {
          const map = worldManagerRef.current?.getSnapshot().maps.find((m) => m.entry.id === mapId);
          if (!map) return null;
          return { offsetX: map.offsetX, offsetY: map.offsetY };
        },
        setPlayerDirection: (dir) => {
          player.dir = dir;
        },
        setPlayerSpriteOverride: (spriteKey) => {
          player.setScriptSpriteOverride(spriteKey);
        },
        getPlayerLocalPosition: () => {
          const destination = player.getDestinationTile();
          const map = worldManagerRef.current?.findMapAtPosition(destination.x, destination.y)
            ?? worldManagerRef.current?.getSnapshot().maps.find((m) => m.entry.id === effectiveMapId);
          if (!map) return null;
          return { x: player.tileX - map.offsetX, y: player.tileY - map.offsetY };
        },
        getPlayerDestLocalPosition: () => {
          const destination = player.getDestinationTile();
          const map = worldManagerRef.current?.findMapAtPosition(destination.x, destination.y)
            ?? worldManagerRef.current?.getSnapshot().maps.find((m) => m.entry.id === effectiveMapId);
          if (!map) return null;
          return { x: destination.x - map.offsetX, y: destination.y - map.offsetY };
        },
        waitForPlayerIdle: async () => {
          let guard = 0;
          while (player.isMoving && guard < 120) {
            await waitFrames(1);
            guard++;
          }
          if (player.isMoving) {
            console.warn('[StoryScript] waitForPlayerIdle timed out while player was still moving.', {
              scriptName,
              mapId: effectiveMapId,
              frame: gbaFrameRef.current,
            });
          }
        },
        getCurrentGbaFrame: () => gbaFrameRef.current,
        getPlayerAvatarBike: () => player.getBikeSpecialValue(),
        getLastUsedWarpMapId: () => null,
        showEmote: async (mapId, localId, emote, waitFramesOverride = 48) => {
          const effectName = emote === 'exclamation'
            ? 'FLDEFF_EXCLAMATION_MARK_ICON'
            : emote === 'question'
              ? 'FLDEFF_QUESTION_MARK_ICON'
              : 'FLDEFF_HEART_ICON';

          const effectArgs = new Map<number, string | number>();
          effectArgs.set(0, localId);
          if (localId !== 'LOCALID_PLAYER' && localId !== '255') {
            effectArgs.set(1, mapId);
          }

          await scriptRuntimeServices?.fieldEffects?.run?.(effectName, effectArgs, { mapId });
          await waitFrames(Math.max(0, Math.trunc(waitFramesOverride)));
        },
        setCyclingRoadChallengeActive: (active) => {
          player.setCyclingRoadChallengeActive(active);
        },
        getCyclingRoadChallengeCollisions: () => player.getCyclingRoadChallengeCollisions(),
        getMapMetatile: (mapId, tileX, tileY) => {
          const snapshot = worldManagerRef.current?.getSnapshot();
          if (!snapshot) return 0;
          const map = snapshot.maps.find((m) => m.entry.id === mapId);
          if (!map) return 0;
          if (tileX < 0 || tileY < 0 || tileX >= map.mapData.width || tileY >= map.mapData.height) return 0;
          const index = tileY * map.mapData.width + tileX;
          const tile = map.mapData.layout[index];
          return tile?.metatileId ?? 0;
        },
        getAllNpcLocalIds: (mapId) => {
          const allNpcs = objectEventManagerRef.current.getAllNPCs();
          return allNpcs
            .filter((npc) => npc.id.startsWith(`${mapId}_npc_`) && npc.localId != null)
            .map((npc) => npc.localId!);
        },
        setCurrentMapLayoutById,
      };

      // Priority 1: hand-coded scripts (overrides)
      if (isHandCoded) {
        handled = await executeStoryScript(scriptName, scriptCtx);
      }

      // Priority 2: generated script data via ScriptRunner
      if (!handled) {
        const [mapData, commonData] = await Promise.all([
          getMapScripts(effectiveMapId),
          getCommonScripts(),
        ]);
        const runner = new ScriptRunner(
          { mapData, commonData },
          scriptCtx,
          effectiveMapId,
          scriptRuntimeServices,
        );
        handled = await runner.execute(scriptName);
      }

      objectEventManagerRef.current.refreshPostScriptState();
      console.log(`[StoryScript] ✓ Script handled=${handled}`);
      return handled;
    } finally {
      for (const animId of heldDoorAnimIds.values()) {
        doorAnimations.clearById(animId);
      }
      npcMovement.setEnabled(true);
      console.log(`[StoryScript] ■ Finally: warpingRef=${warpingRef.current} pendingScriptedWarp=${!!pendingScriptedWarpRef.current} inputLocked=${player.inputLocked}`);
      recordStoryScriptTimelineEvent({
        kind: 'story_script_end',
        frame: gbaFrameRef.current,
        mapId: effectiveMapId,
        scriptName,
        callback: stepCallbackManager.getDebugState(),
        details: {
          handled,
          warping: warpingRef.current,
          hasPendingScriptedWarp: pendingScriptedWarpRef.current !== null,
        },
      });
      const hasPendingScriptedWarp = pendingScriptedWarpRef.current !== null;
      const hasOpenMenu = menuStateManager.isMenuOpen();
      const fadeServices = scriptRuntimeServices?.fade;
      const fadeDirection = fadeServices?.getDirection?.() ?? null;
      const fadeIsActive = fadeServices?.isActive?.() ?? false;
      const fadeIsComplete = fadeServices?.isComplete?.() ?? false;

      if (
        shouldAutoRecoverStoryScriptFade({
          fadeDirection,
          fadeIsComplete,
          fadeIsActive,
          hasActiveWarp: warpingRef.current,
          hasPendingScriptedWarp,
          hasOpenMenu,
        })
        && fadeServices
      ) {
        const durationMs = fadeServices.framesToMs?.(SCRIPT_CALLBACK_RECOVERY_FADE_FRAMES)
          ?? Math.max(1, Math.round(SCRIPT_CALLBACK_RECOVERY_FADE_FRAMES * gbaFrameMs));
        console.warn('[StoryScript] Auto-recovering stale fade-out after script completion', {
          scriptName,
          mapId: effectiveMapId,
          fade: {
            direction: fadeDirection,
            active: fadeIsActive,
            complete: fadeIsComplete,
          },
        });
        fadeServices.start('in', durationMs);
        if (fadeServices.wait) {
          await fadeServices.wait(durationMs, 'in');
        } else {
          await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
        }
      }

      if (!warpingRef.current && !hasPendingScriptedWarp) {
        console.log('[StoryScript] ■ Unlocking input (no active/pending warp)');
        player.unlockInput();
      }
      storyScriptRunningRef.current = false;
    }
  }, [
    showMessage,
    showChoice,
    showYesNo,
    stateManager,
    selectedMapId,
    buildLocationStateFromPlayer,
    playerRef,
    worldManagerRef,
    pendingSavedLocationRef,
    overworldLoadingRef,
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    objectEventManagerRef,
    npcMovement,
    doorAnimations,
    gbaFrameRef,
    gbaFrameMs,
    setMapMetatile,
    setCurrentMapLayoutById,
    scriptRuntimeServices,
  ]);
}
