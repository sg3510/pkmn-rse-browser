import { useCallback, useRef } from 'react';
import { useInput } from './useInput';
import type { PlayerController } from '../game/PlayerController';
import type { ObjectEventManager } from '../game/ObjectEventManager';

export interface ActionInputDeps {
  playerControllerRef: React.RefObject<PlayerController | null>;
  objectEventManagerRef: React.RefObject<ObjectEventManager>;
  dialogIsOpen: boolean;
  showMessage: (text: string) => Promise<void>;
  showYesNo: (text: string) => Promise<boolean>;
}

/**
 * Hook to handle action key input (X key for surf prompts, item pickup, etc.)
 *
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */
export function useActionInput({
  playerControllerRef,
  objectEventManagerRef,
  dialogIsOpen,
  showMessage,
  showYesNo,
}: ActionInputDeps) {
  const surfPromptInProgressRef = useRef<boolean>(false);
  const itemPickupInProgressRef = useRef<boolean>(false);

  const handleActionKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (e.code !== 'KeyX') return;

    const player = playerControllerRef.current;
    if (!player) return;

    // Avoid conflicts with dialog or concurrent prompts
    if (dialogIsOpen) return;

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
    if (!interactable || interactable.type !== 'item') return;

    const itemBall = interactable.data;
    itemPickupInProgressRef.current = true;
    player.lockInput();

    try {
      objectEventManager.collectItem(itemBall.id);
      const itemName = itemBall.itemName;
      await showMessage(`BRENDAN found one ${itemName}!`);
    } finally {
      itemPickupInProgressRef.current = false;
      player.unlockInput();
    }
  }, [dialogIsOpen, showMessage, showYesNo, playerControllerRef, objectEventManagerRef]);

  useInput({ onKeyDown: handleActionKeyDown });

  return {
    surfPromptInProgressRef,
    itemPickupInProgressRef,
  };
}
