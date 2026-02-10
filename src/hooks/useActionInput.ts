import { useCallback, useRef } from 'react';
import { useInput } from './useInput';
import type { PlayerController } from '../game/PlayerController';
import type { ObjectEventManager } from '../game/ObjectEventManager';
import type { ScriptObject, NPCObject } from '../types/objectEvents';
import { saveManager } from '../save/SaveManager';
import { bagManager } from '../game/BagManager';

export interface ActionInputDeps {
  playerControllerRef: React.RefObject<PlayerController | null>;
  objectEventManagerRef: React.RefObject<ObjectEventManager>;
  enabled?: boolean;
  dialogIsOpen: boolean;
  showMessage: (text: string) => Promise<void>;
  showYesNo: (text: string) => Promise<boolean>;
  onScriptInteract?: (scriptObject: ScriptObject) => Promise<void>;
  /** Called when the player presses A facing an NPC with a script */
  onNpcInteract?: (npc: NPCObject) => Promise<void>;
  /** Called when the player presses A facing a tile with no NPC/item/script (bg_events, signs, etc.) */
  onTileInteract?: (facingTileX: number, facingTileY: number, playerDir: string) => Promise<void>;
}

/**
 * Hook to handle action key input (X key for surf prompts, item pickup, etc.)
 *
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */
export function useActionInput({
  playerControllerRef,
  objectEventManagerRef,
  enabled = true,
  dialogIsOpen,
  showMessage,
  showYesNo,
  onScriptInteract,
  onNpcInteract,
  onTileInteract,
}: ActionInputDeps) {
  const surfPromptInProgressRef = useRef<boolean>(false);
  const itemPickupInProgressRef = useRef<boolean>(false);

  const handleActionKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.code !== 'KeyX') return;

    const player = playerControllerRef.current;
    if (!player) return;

    // Avoid conflicts with dialog or concurrent prompts
    if (dialogIsOpen) return;
    // Respect script/warp locks owned outside this hook.
    if (player.inputLocked) return;

    // Surf prompt takes priority when available
    if (!surfPromptInProgressRef.current && !player.isMoving && !player.isSurfing()) {
      const surfCheck = player.canInitiateSurf();
      if (surfCheck.canSurf) {
        surfPromptInProgressRef.current = true;
        player.lockInput();

        try {
          const wantsToSurf = await showYesNo(
            "The water is dyed a deep blue...\nWould you like to SURF?"
          );

          if (wantsToSurf) {
            await showMessage("You used SURF!");
            player.startSurfing();
          }
        } finally {
          surfPromptInProgressRef.current = false;
          player.unlockInput();
        }
        return; // Don't process other actions on the same key press
      }
    }

    // Item pickup flow
    if (surfPromptInProgressRef.current || itemPickupInProgressRef.current || player.isMoving || player.isSurfing()) return;

    // Calculate the tile the player is facing
    let facingTileX = player.tileX;
    let facingTileY = player.tileY;
    if (player.dir === 'up') facingTileY -= 1;
    else if (player.dir === 'down') facingTileY += 1;
    else if (player.dir === 'left') facingTileX -= 1;
    else if (player.dir === 'right') facingTileX += 1;

    const objectEventManager = objectEventManagerRef.current;
    const interactable = objectEventManager.getInteractableAt(facingTileX, facingTileY);
    if (!interactable) {
      // No NPC/item/script — check bg_events (signs, clocks, etc.)
      if (onTileInteract) {
        itemPickupInProgressRef.current = true;
        try {
          await onTileInteract(facingTileX, facingTileY, player.dir);
        } finally {
          itemPickupInProgressRef.current = false;
        }
      }
      return;
    }

    if (interactable.type === 'item') {
      const itemBall = interactable.data;
      itemPickupInProgressRef.current = true;
      player.lockInput();

      try {
        objectEventManager.collectItem(itemBall.id);
        // Add item to bag inventory
        bagManager.addItem(itemBall.itemId, 1);
        const itemName = itemBall.itemName;
        const playerName = saveManager.getPlayerName();
        await showMessage(`${playerName} found one ${itemName}!`);
      } finally {
        itemPickupInProgressRef.current = false;
        player.unlockInput();
      }
      return;
    }

    if (interactable.type === 'npc' && interactable.data.script && interactable.data.script !== '0x0' && onNpcInteract) {
      itemPickupInProgressRef.current = true;
      try {
        await onNpcInteract(interactable.data);
      } finally {
        itemPickupInProgressRef.current = false;
      }
      return;
    }

    if (interactable.type === 'script' && onScriptInteract) {
      itemPickupInProgressRef.current = true;
      try {
        await onScriptInteract(interactable.data);
      } finally {
        itemPickupInProgressRef.current = false;
      }
    }
  }, [enabled, dialogIsOpen, showMessage, showYesNo, playerControllerRef, objectEventManagerRef, onScriptInteract, onNpcInteract, onTileInteract]);

  useInput({ onKeyDown: handleActionKeyDown });

  return {
    surfPromptInProgressRef,
    itemPickupInProgressRef,
  };
}
