/**
 * Extracted callback factories for the useActionInput hook.
 * Creates onScriptInteract, onNpcInteract, and onTileInteract callbacks.
 */
import type { PlayerController } from '../../game/PlayerController';
import type { WorldManager } from '../../game/WorldManager';
import type { ObjectEventManager } from '../../game/ObjectEventManager';
import type { NPCObject } from '../../types/objectEvents';
import { isNPCGraphicsId } from '../../types/objectEvents';
import { gameVariables, GAME_VARS } from '../../game/GameVariables';
import { getItemId, getItemName } from '../../data/items';
import { bagManager } from '../../game/BagManager';
import { saveManager } from '../../save/SaveManager';

interface MutableRef<T> {
  current: T;
}

export interface ActionCallbackDeps {
  playerRef: MutableRef<PlayerController | null>;
  worldManagerRef: MutableRef<WorldManager | null>;
  objectEventManagerRef: MutableRef<ObjectEventManager>;
  runHandledStoryScript: (script: string, mapId?: string) => Promise<boolean | void>;
  showMessage: (message: string) => Promise<void>;
}

const DIR_MAP: Record<string, number> = { down: 1, up: 2, left: 3, right: 4 };

export function createActionCallbacks(deps: ActionCallbackDeps) {
  const { playerRef, worldManagerRef, objectEventManagerRef, runHandledStoryScript, showMessage } = deps;

  const onScriptInteract = async (scriptObject: { script: string }) => {
    const player = playerRef.current;
    const wm = worldManagerRef.current;
    const mapId = (player && wm)
      ? wm.findMapAtPosition(player.tileX, player.tileY)?.entry.id
      : undefined;
    if (player) {
      gameVariables.setVar('VAR_FACING', DIR_MAP[player.dir] ?? 0);
    }
    await runHandledStoryScript(scriptObject.script, mapId);
  };

  const onNpcInteract = async (npc: NPCObject) => {
    const player = playerRef.current;
    const wm = worldManagerRef.current;
    if (!player || !wm || !npc.script || npc.script === '0x0') return;
    const currentMap = wm.findMapAtPosition(player.tileX, player.tileY);
    if (!currentMap) return;
    const mapId = currentMap.entry.id;

    gameVariables.setVar('VAR_FACING', DIR_MAP[player.dir] ?? 0);

    if (npc.localId) {
      const localIdNum = parseInt(npc.localId, 10);
      if (!isNaN(localIdNum)) {
        gameVariables.setVar('VAR_LAST_TALKED', localIdNum);
      }
    }

    // Only face person NPCs toward the player. Inanimate objects (boxes,
    // boulders, etc.) have a single sprite frame and must not be rotated.
    if (isNPCGraphicsId(npc.graphicsId)) {
      if (npc.localId) {
        objectEventManagerRef.current.faceNpcTowardPlayer(
          mapId, npc.localId, player.tileX, player.tileY
        );
      } else {
        const dx = player.tileX - npc.tileX;
        const dy = player.tileY - npc.tileY;
        if (Math.abs(dx) > Math.abs(dy)) {
          npc.direction = dx < 0 ? 'left' : 'right';
        } else if (dy !== 0) {
          npc.direction = dy < 0 ? 'up' : 'down';
        }
      }
    }
    await runHandledStoryScript(npc.script, mapId);
  };

  const onTileInteract = async (facingTileX: number, facingTileY: number, _playerDir: string) => {
    const player = playerRef.current;
    const wm = worldManagerRef.current;
    if (!player || !wm) return;
    const currentMap = wm.findMapAtPosition(player.tileX, player.tileY);
    if (!currentMap) return;
    const mapId = currentMap.entry.id;

    // Priority: hardcoded wall clock override for intro
    const introState = gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE);
    if (introState === 5) {
      const localX = facingTileX - currentMap.offsetX;
      const localY = facingTileY - currentMap.offsetY;
      if (mapId === 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F' && localX === 5 && localY === 1) {
        await runHandledStoryScript('PlayersHouse_2F_EventScript_SimplifiedClock', mapId);
        return;
      }
      if (mapId === 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_2F' && localX === 3 && localY === 1) {
        await runHandledStoryScript('PlayersHouse_2F_EventScript_SimplifiedClock', mapId);
        return;
      }
    }

    // Generic bg_event lookup (signs, hidden items)
    const bgEvent = objectEventManagerRef.current.getBgEventAt(facingTileX, facingTileY);
    if (bgEvent) {
      if (bgEvent.type === 'sign' && bgEvent.script) {
        await runHandledStoryScript(bgEvent.script, mapId);
        return;
      }
      if (bgEvent.type === 'hidden_item' && bgEvent.item) {
        const itemId = getItemId(bgEvent.item);
        if (itemId && itemId > 0) {
          objectEventManagerRef.current.collectHiddenItem(bgEvent.id);
          bagManager.addItem(itemId, 1);
          const playerName = saveManager.getPlayerName();
          const itemName = getItemName(itemId);
          await showMessage(`${playerName} found one ${itemName}!`);
        }
        return;
      }
    }
  };

  return { onScriptInteract, onNpcInteract, onTileInteract };
}
