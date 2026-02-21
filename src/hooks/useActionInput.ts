import { useCallback, useRef } from 'react';
import { useInput } from './useInput';
import { inputMap, GameButton } from '../core/InputMap';
import type { PlayerController } from '../game/PlayerController';
import type { ObjectEventManager } from '../game/ObjectEventManager';
import type { WorldManager } from '../game/WorldManager';
import type { ScriptObject, NPCObject } from '../types/objectEvents';
import { saveManager } from '../save/SaveManager';
import { bagManager } from '../game/BagManager';
import { MB_COUNTER } from '../utils/metatileBehaviors.generated';
import {
  DEFAULT_FIELD_ACTION_POLICY,
  type DiveActionResolution,
  type FieldActionResolverPolicy,
  resolveFieldActions,
} from '../game/fieldActions/FieldActionResolver';
import { formatFoundItemMessage } from '../game/messages/itemMessages';

export interface ActionInputDeps {
  playerControllerRef: React.RefObject<PlayerController | null>;
  objectEventManagerRef: React.RefObject<ObjectEventManager>;
  worldManagerRef?: React.RefObject<WorldManager | null>;
  enabled?: boolean;
  dialogIsOpen: boolean;
  showMessage: (text: string) => Promise<void>;
  showYesNo: (text: string) => Promise<boolean>;
  onDiveFieldAction?: (request: DiveActionResolution) => Promise<boolean>;
  fieldActionPolicy?: FieldActionResolverPolicy;
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
  worldManagerRef,
  enabled = true,
  dialogIsOpen,
  showMessage,
  showYesNo,
  onDiveFieldAction,
  fieldActionPolicy = DEFAULT_FIELD_ACTION_POLICY,
  onScriptInteract,
  onNpcInteract,
  onTileInteract,
}: ActionInputDeps) {
  const surfPromptInProgressRef = useRef<boolean>(false);
  const divePromptInProgressRef = useRef<boolean>(false);
  const itemPickupInProgressRef = useRef<boolean>(false);

  const handleActionKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (!enabled) return;
    const isA = inputMap.matchesCode(e.code, GameButton.A);
    const isB = inputMap.matchesCode(e.code, GameButton.B);
    if (!isA && !isB) return;

    const player = playerControllerRef.current;
    if (!player) return;

    // Avoid conflicts with dialog or concurrent prompts
    if (dialogIsOpen) return;
    // Respect script/warp locks owned outside this hook.
    if (player.inputLocked) return;

    const actions = resolveFieldActions({
      player,
      worldManager: worldManagerRef?.current ?? null,
      policy: fieldActionPolicy,
    });

    // B button: underwater surface prompt when valid
    if (isB) {
      if (
        onDiveFieldAction
        && actions.diveEmerge
        && !divePromptInProgressRef.current
        && !itemPickupInProgressRef.current
        && !player.isMoving
      ) {
        divePromptInProgressRef.current = true;
        player.lockInput();
        try {
          const wantsToSurface = await showYesNo(
            'Light is filtering from above.\nWould you like to use DIVE?'
          );
          if (wantsToSurface) {
            await showMessage('You used DIVE!');
            await onDiveFieldAction(actions.diveEmerge);
          }
        } finally {
          divePromptInProgressRef.current = false;
          player.unlockInput();
        }
      }
      return;
    }

    // A button: Surf prompt takes priority when available
    if (!surfPromptInProgressRef.current && !player.isMoving && actions.surf) {
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

    // A button: Dive-down prompt when surfing on diveable tile
    if (
      onDiveFieldAction
      && actions.diveDown
      && !divePromptInProgressRef.current
      && !itemPickupInProgressRef.current
      && !player.isMoving
    ) {
      divePromptInProgressRef.current = true;
      player.lockInput();
      try {
        const wantsToDive = await showYesNo(
          'The sea is deep here...\nWould you like to use DIVE?'
        );
        if (wantsToDive) {
          await showMessage('You used DIVE!');
          await onDiveFieldAction(actions.diveDown);
        }
      } finally {
        divePromptInProgressRef.current = false;
        player.unlockInput();
      }
      return;
    }

    // Item pickup flow
    if (
      surfPromptInProgressRef.current
      || divePromptInProgressRef.current
      || itemPickupInProgressRef.current
      || player.isMoving
    ) return;

    // Calculate the tile the player is facing
    let facingTileX = player.tileX;
    let facingTileY = player.tileY;
    if (player.dir === 'up') facingTileY -= 1;
    else if (player.dir === 'down') facingTileY += 1;
    else if (player.dir === 'left') facingTileX -= 1;
    else if (player.dir === 'right') facingTileX += 1;

    const objectEventManager = objectEventManagerRef.current;

    // Helper: handle an interactable (item/npc/script)
    const handleInteraction = async (found: NonNullable<ReturnType<typeof objectEventManager.getInteractableAt>>) => {
      if (found.type === 'item') {
        const itemBall = found.data;
        itemPickupInProgressRef.current = true;
        player.lockInput();
        try {
          objectEventManager.collectItem(itemBall.id);
          bagManager.addItem(itemBall.itemId, 1);
          const itemName = itemBall.itemName;
          const playerName = saveManager.getPlayerName();
          await showMessage(formatFoundItemMessage(playerName, itemName));
        } finally {
          itemPickupInProgressRef.current = false;
          player.unlockInput();
        }
      } else if (found.type === 'npc' && found.data.script && found.data.script !== '0x0' && onNpcInteract) {
        itemPickupInProgressRef.current = true;
        try {
          await onNpcInteract(found.data);
        } finally {
          itemPickupInProgressRef.current = false;
        }
      } else if (found.type === 'script' && onScriptInteract) {
        itemPickupInProgressRef.current = true;
        try {
          await onScriptInteract(found.data);
        } finally {
          itemPickupInProgressRef.current = false;
        }
      }
    };

    let interactable = objectEventManager.getInteractableAtWithElevation(
      facingTileX,
      facingTileY,
      player.getElevation()
    );

    // C parity: MB_COUNTER extends interaction 1 tile further (field_control_avatar.c:286-314)
    if (!interactable) {
      const tileResolver = player.getTileResolver();
      const facingTileInfo = tileResolver?.(facingTileX, facingTileY);
      if (facingTileInfo?.attributes?.behavior === MB_COUNTER) {
        let counterTileX = facingTileX;
        let counterTileY = facingTileY;
        if (player.dir === 'up') counterTileY -= 1;
        else if (player.dir === 'down') counterTileY += 1;
        else if (player.dir === 'left') counterTileX -= 1;
        else if (player.dir === 'right') counterTileX += 1;
        interactable = objectEventManager.getInteractableAtWithElevation(
          counterTileX,
          counterTileY,
          player.getElevation()
        );
      }
    }

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

    await handleInteraction(interactable);
  }, [
    enabled,
    dialogIsOpen,
    showMessage,
    showYesNo,
    playerControllerRef,
    objectEventManagerRef,
    worldManagerRef,
    onDiveFieldAction,
    fieldActionPolicy,
    onScriptInteract,
    onNpcInteract,
    onTileInteract,
  ]);

  useInput({ onKeyDown: handleActionKeyDown });

  return {
    surfPromptInProgressRef,
    divePromptInProgressRef,
    itemPickupInProgressRef,
  };
}
