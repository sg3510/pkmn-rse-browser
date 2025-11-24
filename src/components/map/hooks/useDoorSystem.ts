import { useCallback, useRef } from 'react';
import { PlayerController } from '../../../game/PlayerController';
import type {
  DoorAnimDrawable,
  DoorEntrySequence,
  DoorExitSequence,
  DoorSize,
  FadeState,

  WarpRuntimeState,
  WarpTrigger,
  WorldCameraView,
} from '../types';
import {
  DOOR_FADE_DURATION,
  DOOR_FRAME_DURATION_MS,
  DOOR_FRAME_HEIGHT,
  getDoorAssetForMetatile,
  logDoor,
} from '../logic/DoorManager';
import { type CardinalDirection, isNonAnimatedDoorBehavior } from '../../../utils/metatileBehaviors';

export const useDoorSystem = () => {
  const doorSpriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const doorAnimsRef = useRef<DoorAnimDrawable[]>([]);
  const doorAnimIdRef = useRef<number>(1);
  const doorExitRef = useRef<DoorExitSequence>({
    stage: 'idle',
    doorWorldX: 0,
    doorWorldY: 0,
    metatileId: 0,
  });
  const fadeRef = useRef<FadeState>({
    mode: null,
    startedAt: 0,
    duration: DOOR_FADE_DURATION,
  });
  const playerHiddenRef = useRef<boolean>(false);
  
  // State for door entry sequence (was local variable in loadAndRender)
  const doorEntryRef = useRef<DoorEntrySequence>({
    stage: 'idle',
    trigger: null,
    targetX: 0,
    targetY: 0,
    metatileId: 0,
  });

  const ensureDoorSprite = useCallback(
    async (metatileId: number): Promise<{ image: HTMLImageElement; size: DoorSize }> => {
      const asset = getDoorAssetForMetatile(metatileId);
      const cached = doorSpriteCacheRef.current.get(asset.path);
      if (cached && cached.complete) {
        return { image: cached, size: asset.size };
      }
      const img = new Image();
      img.src = asset.path;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (err) => reject(err);
      });
      doorSpriteCacheRef.current.set(asset.path, img);
      return { image: img, size: asset.size };
    },
    []
  );

  const spawnDoorAnimation = useCallback(
    async (
      metatileId: number,
      worldX: number,
      worldY: number,
      direction: 'open' | 'close',
      holdOnComplete: boolean = false
    ): Promise<number> => {
      try {
        const { image, size } = await ensureDoorSprite(metatileId);
        const id = doorAnimIdRef.current++;
        const frameCount = 3; // Standard door animation frames
        doorAnimsRef.current.push({
          id,
          image,
          direction,
          frameCount,
          frameHeight: DOOR_FRAME_HEIGHT,
          frameDuration: DOOR_FRAME_DURATION_MS,
          worldX,
          worldY,
          size,
          startedAt: performance.now(),
          holdOnComplete,
          metatileId,
        });
        logDoor(`Spawned door anim ${id} at (${worldX}, ${worldY}) dir=${direction}`);
        return id;
      } catch (err) {
        console.error('Failed to spawn door animation', err);
        return -1;
      }
    },
    [ensureDoorSprite]
  );

  const isDoorAnimDone = useCallback((anim: DoorAnimDrawable, now: number): boolean => {
    const elapsed = now - anim.startedAt;
    const totalDuration = anim.frameCount * anim.frameDuration;
    return elapsed >= totalDuration;
  }, []);

  const pruneDoorAnimations = useCallback(
    (now: number) => {
      doorAnimsRef.current = doorAnimsRef.current.filter((anim) => {
        if (anim.holdOnComplete) {
          return true;
        }
        return !isDoorAnimDone(anim, now);
      });
    },
    [isDoorAnimDone]
  );

  const renderDoorAnimations = useCallback(
    (ctx: CanvasRenderingContext2D, view: WorldCameraView, now: number) => {
      for (const anim of doorAnimsRef.current) {
        const elapsed = now - anim.startedAt;
        let frameIndex = Math.floor(elapsed / anim.frameDuration);
        if (frameIndex >= anim.frameCount) {
          frameIndex = anim.frameCount - 1;
        }

        // 0, 1, 2 for open. 2, 1, 0 for close.
        let renderFrame = frameIndex;
        if (anim.direction === 'close') {
          renderFrame = anim.frameCount - 1 - frameIndex;
        }

        // Source Y: frameIndex * 32
        const sy = renderFrame * anim.frameHeight;
        const screenX = Math.round(anim.worldX * 16 - view.cameraWorldX);
        const screenY = Math.round(anim.worldY * 16 - view.cameraWorldY);

        // Door sprites are 16x32 (size 1) or 32x32 (size 2)
        // Adjust draw position if necessary. Standard doors are 16x32.
        // If size is 2, it's 32x32.
        // The worldX/Y is the top-left of the metatile (16x16).
        // For 16x32 door, it covers the tile and the one above it?
        // Actually, in Emerald, door tiles are usually the bottom part.
        // The sprite includes the top part?
        // Let's assume standard rendering:
        // 16x32 sprite drawn at (x, y-16)?
        // Wait, existing code:
        // ctx.drawImage(anim.image, 0, sy, anim.image.width, anim.frameHeight, screenX, screenY - 16, anim.image.width, anim.frameHeight);
        // If size 2 (32x32), width is 32.
        
        // Check existing implementation in MapRenderer.tsx to be sure.
        // It was:
        // const width = anim.image.width;
        // const height = anim.frameHeight;
        // ctx.drawImage(anim.image, 0, sy, width, height, screenX, screenY - (height - 16), width, height);

        const width = anim.image.width;
        const height = anim.frameHeight;
        // Draw so bottom aligns with tile bottom
        // Tile is 16x16 at screenX, screenY.
        // Sprite is height pixels tall.
        // We want bottom of sprite at screenY + 16.
        // So top is at (screenY + 16) - height.
        // = screenY - (height - 16).
        
        ctx.drawImage(
          anim.image,
          0,
          sy,
          width,
          height,
          screenX,
          screenY - (height - 16),
          width,
          height
        );
      }
    },
    []
  );

  const handleDoorWarpAttempt = useCallback(
    (
      trigger: WarpTrigger,
      targetX: number,
      targetY: number,
      metatileId: number,
      warpState: WarpRuntimeState,
      player?: PlayerController | null
    ) => {
      if (warpState.inProgress || doorEntryRef.current.stage !== 'idle') return;

      logDoor('Door warp triggered', trigger);

      // Check if door is animated
      const isAnimated = !isNonAnimatedDoorBehavior(trigger.behavior);

      warpState.inProgress = true;
      playerHiddenRef.current = false;
      player?.lockInput();

      doorEntryRef.current = {
        stage: 'opening',
        trigger,
        targetX,
        targetY,
        metatileId,
        isAnimatedDoor: isAnimated,
        entryDirection: trigger.facing,
      };

      if (isAnimated) {
        // Spawn open animation
        spawnDoorAnimation(metatileId, targetX, targetY, 'open', true).then((id) => {
          if (doorEntryRef.current.stage === 'opening') {
            doorEntryRef.current.openAnimId = id;
          }
        });
      }
    },
    [spawnDoorAnimation]
  );

  const startAutoDoorWarp = useCallback(
    (
      trigger: WarpTrigger,
      warpState: WarpRuntimeState,
      player: PlayerController,
      metatileId: number,
      entryDirection: CardinalDirection = 'up',
      options?: { isAnimatedDoor?: boolean }
    ) => {
      // For auto doors (like Pokemon Center), we just start the sequence
      // The player is already walking into it
      if (warpState.inProgress || doorEntryRef.current.stage !== 'idle') return;

      const now = performance.now();
      logDoor('Auto door warp triggered', trigger);
      
      doorEntryRef.current = {
        stage: 'waitingBeforeFade',
        trigger,
        targetX: player.tileX,
        targetY: player.tileY,
        metatileId,
        isAnimatedDoor: options?.isAnimatedDoor ?? false,
        entryDirection,
        playerHidden: false,
        waitStartedAt: now - 250, // Start fade immediately
      };
      
      warpState.inProgress = true;
      player.lockInput();
    },
    []
  );

  const advanceDoorEntry = useCallback(
    (
      now: number,
      player: PlayerController,
      performWarp: (trigger: WarpTrigger, options?: { force?: boolean; fromDoor?: boolean }) => Promise<void>
    ) => {
      const state = doorEntryRef.current;
      if (state.stage === 'idle') return;

      // 1. Opening
      if (state.stage === 'opening') {
        let openDone = false;
        if (state.isAnimatedDoor) {
          const anim = doorAnimsRef.current.find((a) => a.id === state.openAnimId);
          if (anim && isDoorAnimDone(anim, now)) {
            openDone = true;
          } else if (!anim && state.openAnimId) {
            // Animation lost?
            openDone = true;
          }
        } else {
          openDone = true; // No animation, instant open
        }

        if (openDone) {
          logDoor('Door open complete, stepping in');
          state.stage = 'stepping';
          // Move player into door (1 tile forward)
          // Hide player after movement?
          // In Emerald, player walks UP into door.
          // If auto door (arrow warp?), player walks in direction of arrow.
          // For now assume UP or entryDirection.
          const dir = state.entryDirection || 'up';
          player.forceMove(dir, true);
          
          logDoor('Player stepped in, hiding and closing');
          // We don't hide player yet, we wait for movement to finish in 'stepping' stage?
          // In MapRenderer:
          // player.forceMove(...);
          // doorEntry.stage = 'stepping';
          // Then in 'stepping' stage, it checks !player.isMoving.
          
          doorEntryRef.current.stage = 'stepping';
          
          // We don't spawn close animation here. We do it when stepping is done.
          // MapRenderer logic:
          /*
          } else if (doorEntry.stage === 'stepping') {
            if (!player.isMoving) {
               // Spawn close animation...
               // Set stage to 'closing'
            }
          }
          */
         
         // So I should NOT spawn close animation here.
         // I should just set stage to 'stepping'.
         // And let the next call to advanceDoorEntry handle the rest?
         // But advanceDoorEntry handles 'stepping' stage?
         // Let's check my implementation of advanceDoorEntry.
         
         /*
         // 2. Stepping (handled by promise above, but we wait)
         */
         
         // I need to add 'stepping' logic to advanceDoorEntry.
        }
      }



      // 2. Stepping
      if (state.stage === 'stepping') {
        if (!player.isMoving) {
          // Only spawn close animation if this is an animated door
          if (state.isAnimatedDoor !== false) {
             const startedAt = now;
             logDoor('entry: start door close (animated), hide player');
             spawnDoorAnimation(state.metatileId, state.targetX, state.targetY, 'close', false).then((id) => {
               doorEntryRef.current.closeAnimId = id;
             });
             // Remove open animation
             if (state.openAnimId) {
               doorAnimsRef.current = doorAnimsRef.current.filter(a => a.id !== state.openAnimId);
             }
             doorEntryRef.current.stage = 'closing';
             playerHiddenRef.current = true;
             doorEntryRef.current.playerHidden = true;
          } else {
             // Non-animated door: skip straight to fading
             logDoor('entry: non-animated door, skip to fade');
             playerHiddenRef.current = true;
             doorEntryRef.current.playerHidden = true;
             doorEntryRef.current.stage = 'waitingBeforeFade';
             doorEntryRef.current.waitStartedAt = now;
          }
        }
      }
      
      // 3. Closing
      if (state.stage === 'closing') {
        let closeDone = false;
        if (state.isAnimatedDoor) {
           const anim = doorAnimsRef.current.find((a) => a.id === state.closeAnimId);
           if (anim && isDoorAnimDone(anim, now)) {
             closeDone = true;
           } else if (!anim && state.closeAnimId) {
             closeDone = true;
           }
        } else {
          closeDone = true;
        }

        if (closeDone) {
          logDoor('Door close complete, waiting before fade');
          state.stage = 'waitingBeforeFade';
          state.waitStartedAt = now;
        }
      }

      // 4. Waiting before fade
      if (state.stage === 'waitingBeforeFade') {
        const WAIT_DURATION = 250; // ms to show the closed door base tile before fading
        const waitDone = now - (state.waitStartedAt ?? now) >= WAIT_DURATION;
        if (waitDone) {
           logDoor('Starting fade out');
           state.stage = 'fadingOut';
           fadeRef.current = { mode: 'out', startedAt: now, duration: DOOR_FADE_DURATION };
        }
      }

      // 5. Fading Out
      if (state.stage === 'fadingOut') {
        // Check if fade is complete (either mode cleared by compositeScene or duration elapsed)
        const fadeDone =
          fadeRef.current.mode === null ||
          now - fadeRef.current.startedAt >= fadeRef.current.duration;
        if (fadeDone) {
          logDoor('Fade out complete, warping');
          state.stage = 'warping';
          if (state.trigger) {
            performWarp(state.trigger, { force: true, fromDoor: true }).then(() => {
               // Warp complete
               // Reset state is handled by performWarp or map load?
               // Actually performWarp will trigger map load.
               // After map load, we need to handle door exit.
               // That is handled by doorExitRef.

               // Reset entry state
               doorEntryRef.current = {
                 stage: 'idle',
                 trigger: null,
                 targetX: 0,
                 targetY: 0,
                 metatileId: 0,
               };
            });
          }
        }
      }
    },
    [spawnDoorAnimation, isDoorAnimDone]
  );

  return {
    doorSpriteCacheRef,
    doorAnimsRef,
    doorAnimIdRef,
    doorExitRef,
    fadeRef,
    playerHiddenRef,
    doorEntryRef,
    ensureDoorSprite,
    spawnDoorAnimation,
    isDoorAnimDone,
    pruneDoorAnimations,
    renderDoorAnimations,
    handleDoorWarpAttempt,
    startAutoDoorWarp,
    advanceDoorEntry,
  };
};
