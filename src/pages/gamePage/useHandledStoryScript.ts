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
import { ScriptRunner } from '../../scripting/ScriptRunner';
import { getMapScripts, getCommonScripts } from '../../data/scripts';

interface MutableRef<T> {
  current: T;
}

interface PendingScriptedWarpLike {
  mapId: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  phase: 'pending' | 'fading' | 'loading';
}

const SCRIPTED_TRAINER_BATTLES: Record<string, { species: number; level: number }> = {
  TRAINER_MAY_ROUTE_103_TREECKO: { species: SPECIES.TORCHIC, level: 5 },
  TRAINER_MAY_ROUTE_103_TORCHIC: { species: SPECIES.MUDKIP, level: 5 },
  TRAINER_MAY_ROUTE_103_MUDKIP: { species: SPECIES.TREECKO, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_TREECKO: { species: SPECIES.TORCHIC, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_TORCHIC: { species: SPECIES.MUDKIP, level: 5 },
  TRAINER_BRENDAN_ROUTE_103_MUDKIP: { species: SPECIES.TREECKO, level: 5 },
};

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
  pendingScriptedWarpRef: MutableRef<PendingScriptedWarpLike | null>;
  warpingRef: MutableRef<boolean>;
  playerHiddenRef: MutableRef<boolean>;
  storyScriptRunningRef: MutableRef<boolean>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  npcMovement: UseNPCMovementReturn;
  doorAnimations: UseDoorAnimationsReturn;
  gbaFrameMs: number;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number) => boolean;
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
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    objectEventManagerRef,
    npcMovement,
    doorAnimations,
    gbaFrameMs,
    setMapMetatile,
  } = params;

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
    player.lockInput();
    npcMovement.setEnabled(false);

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
        return false;
      }
    }
    const heldDoorAnimIds = new Map<string, number>();

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

      const movePlayerStep = async (
        direction: 'up' | 'down' | 'left' | 'right',
        mode: 'walk' | 'jump' | 'jump_in_place' | 'face' = 'walk'
      ): Promise<void> => {
        console.log(`[movePlayerStep] dir=${direction} mode=${mode} pos=(${player.tileX},${player.tileY}) isMoving=${player.isMoving} inputLocked=${player.inputLocked}`);
        player.dir = direction;
        if (mode === 'face') {
          await waitFrames(1);
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
          console.log(`[movePlayerStep] jump done guard=${guard}`);
          return;
        }

        const forceMoveResult = player.forceMove(direction, true);
        console.log(`[movePlayerStep] forceMove=${forceMoveResult} isMoving=${player.isMoving}`);
        let guard = 0;
        while (player.isMoving && guard < 120) {
          await waitFrames(1);
          guard++;
        }
        console.log(`[movePlayerStep] done guard=${guard} isMoving=${player.isMoving} pos=(${player.tileX},${player.tileY})`);
      };

      const moveNpcStep = async (
        mapId: string,
        localId: string,
        direction: 'up' | 'down' | 'left' | 'right',
        mode: 'walk' | 'face' | 'jump' | 'jump_in_place' = 'walk'
      ): Promise<void> => {
        const objectManager = objectEventManagerRef.current;
        const npc = objectManager.getNPCByLocalId(mapId, localId);
        if (!npc) {
          console.warn(`[moveNpcStep] NPC not found: ${mapId}/${localId}`);
          await waitFrames(1);
          return;
        }
        console.log(`[moveNpcStep] ${localId} dir=${direction} mode=${mode} pos=(${npc.tileX},${npc.tileY})`);

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
              npc.subTileX = Math.round(-dx * 16 * remaining / config.totalFrames);
              npc.subTileY = Math.round(-dy * 16 * remaining / config.totalFrames);
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
        const { dx, dy } = getDirectionDelta(direction);
        npc.isWalking = true;
        npc.tileX += dx;
        npc.tileY += dy;

        for (let frame = 1; frame <= 16; frame++) {
          const remaining = 16 - frame;
          npc.subTileX = -dx * remaining;
          npc.subTileY = -dy * remaining;
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
        while (stateManager.getCurrentState() === GameState.BATTLE && guard < 72000) {
          await waitFrames(1);
          guard++;
        }
        if (guard >= 72000) {
          console.warn('[StoryScript] Timed out waiting for battle to end.');
        }
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

          await stateManager.transitionTo(GameState.BATTLE, {
            playerPokemon: starter,
            wildSpecies: SPECIES.POOCHYENA,
            wildLevel: 2,
            firstBattle: true,
            returnLocation: buildReturnLocation(),
          });
          await waitForBattleToEnd();
        },
        startTrainerBattle: async (trainerId: string) => {
          if (!stateManager) return;
          const battle = SCRIPTED_TRAINER_BATTLES[trainerId];
          if (!battle) {
            console.warn(`[StoryScript] Unmapped trainer battle: ${trainerId}`);
            return;
          }

          const lead = saveManager.getParty().find((mon): mon is PartyPokemon => mon !== null);
          if (!lead) {
            console.warn('[StoryScript] Cannot start trainer battle without a party Pokemon.');
            return;
          }

          await stateManager.transitionTo(GameState.BATTLE, {
            playerPokemon: lead,
            wildSpecies: battle.species,
            wildLevel: battle.level,
            returnLocation: buildReturnLocation(),
          });
          await waitForBattleToEnd();
        },
        queueWarp: (mapId, x, y, direction) => {
          pendingSavedLocationRef.current = {
            pos: { x, y },
            location: { mapId, warpId: 0, x, y },
            continueGameWarp: { mapId, warpId: 0, x, y },
            lastHealLocation: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
            escapeWarp: { mapId: 'MAP_LITTLEROOT_TOWN', warpId: 0, x: 5, y: 3 },
            direction,
            elevation: player.getElevation(),
            isSurfing: false,
          };

          pendingScriptedWarpRef.current = {
            mapId,
            x,
            y,
            direction,
            phase: 'pending',
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
        setNpcVisible: (mapId, localId, visible, persistent) => {
          objectEventManagerRef.current.setNPCVisibilityByLocalId(mapId, localId, visible, persistent);
        },
        playDoorAnimation: playScriptDoorAnimation,
        setPlayerVisible: (visible) => {
          playerHiddenRef.current = !visible;
        },
        setMapMetatile: setMapMetatile
          ? (mapId, tileX, tileY, metatileId) => {
              setMapMetatile(mapId, tileX, tileY, metatileId);
            }
          : undefined,
        setNpcMovementType: (mapId, localId, movementTypeRaw) => {
          objectEventManagerRef.current.setNPCMovementTypeByLocalId(mapId, localId, movementTypeRaw);
        },
        setSpriteHidden: (mapId, localId, hidden) => {
          objectEventManagerRef.current.setNPCSpriteHiddenByLocalId(mapId, localId, hidden);
        },
        showYesNo,
        getParty: () => saveManager.getParty(),
        hasNpc: (mapId, localId) => {
          return objectEventManagerRef.current.getNPCByLocalId(mapId, localId) != null;
        },
        getNpcPosition: (mapId, localId) => {
          const npc = objectEventManagerRef.current.getNPCByLocalId(mapId, localId);
          if (!npc) return null;
          return { tileX: npc.tileX, tileY: npc.tileY };
        },
        getMapOffset: (mapId) => {
          const map = worldManagerRef.current?.getSnapshot().maps.find((m) => m.entry.id === mapId);
          if (!map) return null;
          return { offsetX: map.offsetX, offsetY: map.offsetY };
        },
        setPlayerDirection: (dir) => {
          player.dir = dir;
        },
        getPlayerLocalPosition: () => {
          const map = worldManagerRef.current?.getSnapshot().maps.find(
            (m) => m.entry.id === effectiveMapId
          );
          if (!map) return null;
          return { x: player.tileX - map.offsetX, y: player.tileY - map.offsetY };
        },
      };

      let handled = false;

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
        );
        handled = await runner.execute(scriptName);
      }

      objectEventManagerRef.current.refreshCollectedState();
      objectEventManagerRef.current.respawnFlagClearedNPCs();
      console.log(`[StoryScript] ✓ Script handled=${handled}`);
      return handled;
    } finally {
      for (const animId of heldDoorAnimIds.values()) {
        doorAnimations.clearById(animId);
      }
      npcMovement.setEnabled(true);
      console.log(`[StoryScript] ■ Finally: warpingRef=${warpingRef.current} pendingScriptedWarp=${!!pendingScriptedWarpRef.current} inputLocked=${player.inputLocked}`);
      const hasPendingScriptedWarp = pendingScriptedWarpRef.current !== null;
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
    pendingScriptedWarpRef,
    warpingRef,
    playerHiddenRef,
    storyScriptRunningRef,
    objectEventManagerRef,
    npcMovement,
    doorAnimations,
    gbaFrameMs,
    setMapMetatile,
  ]);
}
