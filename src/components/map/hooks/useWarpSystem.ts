import { useCallback, useRef } from 'react';
import { PlayerController } from '../../../game/PlayerController';
import { MapManager, type WorldState } from '../../../services/MapManager';
import {
  type WarpTrigger,
  type WarpRuntimeState,
  type DoorExitSequence,
  type FadeState,
  type DoorAnimDrawable,
  type RenderContext,
} from '../types';
import {
  isDoorBehavior,
  isNonAnimatedDoorBehavior,
  requiresDoorExitSequence,
  isArrowWarpBehavior,
} from '../../../utils/metatileBehaviors';
import { getMetatileIdFromMapTile } from '../../../utils/mapLoader';
import { logDoor, DOOR_FADE_DURATION } from '../logic/DoorManager';
import { resolveTileAt, classifyWarpKind } from '../utils';

const DEBUG_MODE_FLAG = 'DEBUG_MODE';
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

const CONNECTION_DEPTH = 3; // anchor + 3 levels of neighbors (needed for proper coverage when walking between maps)

export const useWarpSystem = (
  mapManagerRef: React.MutableRefObject<MapManager>,
  playerControllerRef: React.MutableRefObject<PlayerController | null>,
  renderContextRef: React.MutableRefObject<RenderContext | null>,
  renderGenerationRef: React.MutableRefObject<number>,
  rebuildContextForWorld: (world: WorldState, mapId: string, options?: { preserveChunks?: boolean }) => Promise<void>,
  applyTileResolver: () => void,
  doorExitRef: React.MutableRefObject<DoorExitSequence>,
  fadeRef: React.MutableRefObject<FadeState>,
  doorAnimsRef: React.MutableRefObject<DoorAnimDrawable[]>,
  playerHiddenRef: React.MutableRefObject<boolean>,
  backgroundImageDataRef: React.MutableRefObject<ImageData | null>,
  topImageDataRef: React.MutableRefObject<ImageData | null>,
  hasRenderedRef: React.MutableRefObject<boolean>,
  currentTimestampRef: React.MutableRefObject<number>
) => {
  const warpStateRef = useRef<WarpRuntimeState>({
    inProgress: false,
    lastCheckedTile: undefined,
    cooldownMs: 0,
  });
  
  // Used to pause camera updates during warp
  const reanchorInFlightRef = useRef<boolean>(false);

  const performWarp = useCallback(
    async (
      trigger: WarpTrigger,
      options?: { force?: boolean; fromDoor?: boolean }
    ) => {
      const warpState = warpStateRef.current;
      if (warpState.inProgress && !options?.force) return;
      
      warpState.inProgress = true;
      reanchorInFlightRef.current = true;
      const shouldUnlockInput = !options?.fromDoor;
      playerControllerRef.current?.lockInput();
      
      try {
        const targetMapId = trigger.warpEvent.destMap;
        const targetWarpId = trigger.warpEvent.destWarpId;
        const newWorld = await mapManagerRef.current.buildWorld(targetMapId, CONNECTION_DEPTH);
        
        if (renderGenerationRef.current !== renderGenerationRef.current) return; // This check seems redundant if I use current value, but logic is: capture value before await?
        // MapRenderer logic: if (generation !== renderGenerationRef.current) return;
        // But generation was captured from closure.
        // Here I don't have the closure variable.
        // But I can check if component is still mounted or valid?
        // Actually, if renderGenerationRef changes, it means a new map load started?
        // But we ARE the map load.
        // The check in MapRenderer was to abort if ANOTHER load started.
        // I'll skip it for now or implement a cancellation token mechanism if needed.
        
        await rebuildContextForWorld(newWorld, targetMapId);
        
        const ctxAfter = renderContextRef.current;
        const anchorAfter = ctxAfter?.anchor ?? newWorld.maps[0];
        const destMap =
          ctxAfter?.world.maps.find((m) => m.entry.id === targetMapId) ?? anchorAfter;
        const warpEvents = destMap?.warpEvents ?? [];
        const destWarp = warpEvents[targetWarpId] ?? warpEvents[0];
        
        if (!destMap || !destWarp) {
          if (isDebugMode()) {
            console.warn(`Warp target missing for ${targetMapId} warp ${targetWarpId}`);
          }
          return;
        }
        
        const destWorldX = destMap.offsetX + destWarp.x;
        const destWorldY = destMap.offsetY + destWarp.y;
        
        // Determine facing direction based on context
        let facing: PlayerController['dir'] = trigger.facing;
        if (trigger.kind === 'door' && options?.fromDoor && ctxAfter) {
          const destResolved = resolveTileAt(ctxAfter, destWorldX, destWorldY);
          const destBehavior = destResolved?.attributes?.behavior ?? -1;
          const destIsArrow = isArrowWarpBehavior(destBehavior);
          
          if (isDoorBehavior(destBehavior)) {
            facing = 'down'; // Exiting through a door
          } else if (destIsArrow) {
            // Arriving at an arrow warp: preserve movement direction
            facing = trigger.facing;
          } else {
            facing = 'up'; // Arrived at non-door, non-arrow destination (stairs, etc.)
          }
        } else if (trigger.kind === 'door') {
          facing = 'down'; // Default for door warps when not using door entry sequence
        } else if (trigger.kind === 'arrow') {
          // Arrow warps: always preserve the movement direction
          facing = trigger.facing;
        }

        if (isDebugMode()) {
          console.log('[WARP_FACING]', {
            triggerKind: trigger.kind,
            triggerFacing: trigger.facing,
            finalFacing: facing,
            fromDoor: options?.fromDoor,
          });
        }

        playerControllerRef.current?.setPositionAndDirection(destWorldX, destWorldY, facing);
        
        // Check if destination tile actually has a door before playing door exit animation
        if (options?.fromDoor && ctxAfter) {
          const destResolved = resolveTileAt(ctxAfter, destWorldX, destWorldY);
          const destBehavior = destResolved?.attributes?.behavior ?? -1;
          const destMetatileId = destResolved ? getMetatileIdFromMapTile(destResolved.mapTile) : 0;
          
          const isAnimatedDoor = isDoorBehavior(destBehavior);
          const isNonAnimatedDoor = isNonAnimatedDoorBehavior(destBehavior);
          const requiresExitSequence = requiresDoorExitSequence(destBehavior);
          
          if (isDebugMode()) {
            console.log('[WARP_DEST_CHECK]', {
              fromDoor: options?.fromDoor,
              triggerKind: trigger.kind,
              destWorldX,
              destWorldY,
              destMetatileId: `0x${destMetatileId.toString(16)} (${destMetatileId})`,
              destBehavior,
              isAnimatedDoor,
              isNonAnimatedDoor,
              requiresExitSequence,
            });
          }
          
          // Check if destination requires exit sequence (animated or non-animated)
          if (requiresExitSequence) {
            // Determine exit direction: for arrow warps, continue in same direction; for doors, exit down
            const exitDirection = trigger.kind === 'arrow' ? trigger.facing : 'down';
            
            logDoor('performWarp: destination requires exit sequence', {
              destWorldX,
              destWorldY,
              destMetatileId,
              destBehavior,
              isAnimatedDoor,
              isNonAnimatedDoor,
              exitDirection,
              triggerKind: trigger.kind,
            });
            playerHiddenRef.current = true;
            doorExitRef.current = {
              stage: 'opening',
              doorWorldX: destWorldX,
              doorWorldY: destWorldY,
              metatileId: destMetatileId,
              isAnimatedDoor, // Store whether to play door animation
              exitDirection, // Store which direction to walk when exiting
            };
            fadeRef.current = {
              mode: 'in',
              startedAt: currentTimestampRef.current,
              duration: DOOR_FADE_DURATION,
            };
          } else {
            // No door on destination side
            logDoor('performWarp: destination has no door, simple fade in', {
              destWorldX,
              destWorldY,
              destMetatileId,
              destBehavior,
              behaviorLabel: classifyWarpKind(destBehavior) ?? 'unknown',
            });
            playerHiddenRef.current = false;
            fadeRef.current = {
              mode: 'in',
              startedAt: currentTimestampRef.current,
              duration: DOOR_FADE_DURATION,
            };
            doorExitRef.current = {
              stage: 'idle',
              doorWorldX: 0,
              doorWorldY: 0,
              metatileId: 0,
            };
            playerControllerRef.current?.unlockInput();
            warpState.inProgress = false;
          }
        } else if (options?.fromDoor) {
          fadeRef.current = {
            mode: 'in',
            startedAt: currentTimestampRef.current,
            duration: DOOR_FADE_DURATION,
          };
          playerHiddenRef.current = false;
          doorExitRef.current = {
            stage: 'idle',
            doorWorldX: 0,
            doorWorldY: 0,
            metatileId: 0,
          };
          playerControllerRef.current?.unlockInput();
          warpState.inProgress = false;
        }
        
        applyTileResolver();
        warpState.lastCheckedTile = { mapId: destMap.entry.id, x: destWorldX, y: destWorldY };
        warpState.cooldownMs = 350;
        backgroundImageDataRef.current = null;
        topImageDataRef.current = null;
        hasRenderedRef.current = false;
        // Clear any remaining door animations from the previous map
        doorAnimsRef.current = [];
        
      } catch (err) {
        console.error('Warp failed', err);
      } finally {
        if (shouldUnlockInput) {
          playerControllerRef.current?.unlockInput();
          warpState.inProgress = false;
        }
        reanchorInFlightRef.current = false;
      }
    },
    [
      mapManagerRef,
      playerControllerRef,
      renderContextRef,
      renderGenerationRef,
      rebuildContextForWorld,
      applyTileResolver,
      doorExitRef,
      fadeRef,
      doorAnimsRef,
      playerHiddenRef,
      backgroundImageDataRef,
      topImageDataRef,
      hasRenderedRef,
      currentTimestampRef,
    ]
  );

  return {
    warpStateRef,
    performWarp,
    reanchorInFlightRef,
  };
};
