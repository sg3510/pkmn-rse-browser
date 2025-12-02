/**
 * useDoorAnimations Hook
 *
 * Manages door sprite loading, animation spawning, and rendering.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */

import { useRef, useCallback, useMemo } from 'react';
import { type DoorSize, type DoorAnimDrawable, DOOR_TIMING } from '../field/types';
import { isDoorAnimationDone } from '../field/DoorSequencer';
import { getDoorAssetForMetatile } from '../data/doorAssets';
import { METATILE_SIZE } from '../utils/mapLoader';
import type { WorldCameraView } from '../components/MapRendererTypes';

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>).DEBUG_DOOR;
}

// Debug logging for door operations
function logDoor(event: string, data: Record<string, unknown>): void {
  if (isDebugMode()) {
    console.log(`[DOOR:${event}]`, data);
  }
}

export interface UseDoorAnimationsReturn {
  /** Load door sprite if not cached */
  ensureSprite: (metatileId: number) => Promise<{ image: HTMLImageElement; size: DoorSize }>;
  /** Spawn a door animation */
  spawn: (
    direction: 'open' | 'close',
    worldX: number,
    worldY: number,
    metatileId: number,
    startedAt: number,
    holdOnComplete?: boolean
  ) => Promise<number | null>;
  /** Check if a door animation is complete */
  isAnimDone: (anim: DoorAnimDrawable | undefined, now: number) => boolean;
  /** Remove completed animations */
  prune: (now: number) => void;
  /** Render all active door animations */
  render: (ctx: CanvasRenderingContext2D, view: WorldCameraView, now: number) => void;
  /** Get current animations (for checking completion) */
  getAnimations: () => DoorAnimDrawable[];
  /** Find animation by ID */
  findById: (id: number) => DoorAnimDrawable | undefined;
  /** Clear an animation by ID */
  clearById: (id: number) => void;
  /** Clear all animations */
  clearAll: () => void;
}

/**
 * Hook for managing door animations
 */
export function useDoorAnimations(): UseDoorAnimationsReturn {
  const doorSpriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const doorAnimsRef = useRef<DoorAnimDrawable[]>([]);
  const doorAnimIdRef = useRef<number>(1);

  const ensureSprite = useCallback(
    async (metatileId: number): Promise<{ image: HTMLImageElement; size: DoorSize }> => {
      const asset = getDoorAssetForMetatile(metatileId);
      console.log('[DOOR_ANIM] ensureSprite for metatile', `0x${metatileId.toString(16)}`, '-> path:', asset.path);
      const cached = doorSpriteCacheRef.current.get(asset.path);
      if (cached && cached.complete) {
        console.log('[DOOR_ANIM] Using cached sprite');
        return { image: cached, size: asset.size };
      }
      const img = new Image();
      img.src = asset.path;
      console.log('[DOOR_ANIM] Loading sprite from:', asset.path);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          console.log('[DOOR_ANIM] Sprite loaded successfully:', img.width, 'x', img.height);
          resolve();
        };
        img.onerror = (err) => {
          console.error('[DOOR_ANIM] Sprite load FAILED:', err);
          reject(err);
        };
      });
      doorSpriteCacheRef.current.set(asset.path, img);
      return { image: img, size: asset.size };
    },
    []
  );

  const spawn = useCallback(
    async (
      direction: 'open' | 'close',
      worldX: number,
      worldY: number,
      metatileId: number,
      startedAt: number,
      holdOnComplete: boolean = false
    ): Promise<number | null> => {
      // Debug logging
      if (isDebugMode()) {
        const stackTrace = new Error().stack;
        console.log('[DOOR_SPAWN]', {
          direction,
          worldX,
          worldY,
          metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
          holdOnComplete,
          calledFrom: stackTrace?.split('\n')[2]?.trim() || 'unknown',
        });
      }

      try {
        console.log('[DOOR_ANIM] spawn() called:', { direction, worldX, worldY, metatileId: `0x${metatileId.toString(16)}` });
        const { image, size } = await ensureSprite(metatileId);
        console.log('[DOOR_ANIM] sprite loaded:', { width: image.width, height: image.height, size });
        const frameCount = Math.max(1, Math.floor(image.height / DOOR_TIMING.FRAME_HEIGHT));
        const anim: DoorAnimDrawable = {
          id: doorAnimIdRef.current++,
          image,
          direction,
          frameCount,
          frameHeight: DOOR_TIMING.FRAME_HEIGHT,
          frameDuration: DOOR_TIMING.FRAME_DURATION_MS,
          worldX,
          worldY,
          size,
          startedAt,
          holdOnComplete,
          metatileId,
        };
        doorAnimsRef.current = [...doorAnimsRef.current, anim];
        console.log('[DOOR_ANIM] animation created:', { id: anim.id, frameCount, totalAnimations: doorAnimsRef.current.length });
        logDoor('anim-start', { id: anim.id, direction, metatileId, frameCount, worldX, worldY });
        return anim.id;
      } catch (err) {
        console.error('[DOOR_ANIM] Failed to spawn door animation:', err);
        return null;
      }
    },
    [ensureSprite]
  );

  const isAnimDone = useCallback((anim: DoorAnimDrawable | undefined, now: number): boolean => {
    return isDoorAnimationDone(anim, now);
  }, []);

  const prune = useCallback((now: number): void => {
    doorAnimsRef.current = doorAnimsRef.current.filter((anim) => {
      if (anim.holdOnComplete) {
        return true;
      }
      return !isDoorAnimationDone(anim, now);
    });
  }, []);

  const render = useCallback(
    (mainCtx: CanvasRenderingContext2D, view: WorldCameraView, now: number): void => {
      const doorAnims = doorAnimsRef.current;
      // Log every frame when animations exist
      if (doorAnims.length > 0) {
        console.log('[DOOR_ANIM] render() called with', doorAnims.length, 'animations, view:', {
          cameraWorldX: view.cameraWorldX,
          cameraWorldY: view.cameraWorldY,
          pixelWidth: view.pixelWidth,
          pixelHeight: view.pixelHeight,
        });
      }
      if (doorAnims.length === 0) return;

      for (const anim of doorAnims) {
        const totalDuration = anim.frameCount * anim.frameDuration;
        const elapsed = now - anim.startedAt;

        // Skip rendering if animation is done AND not held
        if (elapsed >= totalDuration && !anim.holdOnComplete) continue;

        // Clamp elapsed time to totalDuration when holding on complete
        const clampedElapsed = anim.holdOnComplete ? Math.min(elapsed, totalDuration - 1) : elapsed;
        const frameIndexRaw = Math.floor(clampedElapsed / anim.frameDuration);
        const frameIndex =
          anim.direction === 'open' ? frameIndexRaw : Math.max(0, anim.frameCount - 1 - frameIndexRaw);

        // Debug logging
        const logKey = `${anim.id}:${frameIndex}`;
        if (
          !(anim as unknown as { _lastLog?: string })._lastLog ||
          (anim as unknown as { _lastLog?: string })._lastLog !== logKey
        ) {
          (anim as unknown as { _lastLog?: string })._lastLog = logKey;
          logDoor('anim-frame', {
            id: anim.id,
            dir: anim.direction,
            metatileId: anim.metatileId,
            frame: frameIndex,
            worldX: anim.worldX,
            worldY: anim.worldY,
            elapsed,
          });
        }

        const sy = frameIndex * anim.frameHeight;
        const sw = anim.image.width;
        const sh = anim.frameHeight;
        const dx = Math.round(anim.worldX * METATILE_SIZE - view.cameraWorldX);
        const dy = Math.round((anim.worldY - 1) * METATILE_SIZE - view.cameraWorldY);
        const dw = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE;
        const dh = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE * 2;

        console.log('[DOOR_ANIM] drawing frame:', {
          animId: anim.id,
          frameIndex,
          src: { sy, sw, sh },
          dest: { dx, dy, dw, dh },
          worldPos: { x: anim.worldX, y: anim.worldY },
          imageLoaded: anim.image.complete,
        });

        mainCtx.drawImage(anim.image, 0, sy, sw, sh, dx, dy, dw, dh);
      }
    },
    []
  );

  const getAnimations = useCallback((): DoorAnimDrawable[] => {
    return doorAnimsRef.current;
  }, []);

  const findById = useCallback((id: number): DoorAnimDrawable | undefined => {
    return doorAnimsRef.current.find((a) => a.id === id);
  }, []);

  const clearById = useCallback((id: number): void => {
    doorAnimsRef.current = doorAnimsRef.current.filter((a) => a.id !== id);
  }, []);

  const clearAll = useCallback((): void => {
    doorAnimsRef.current = [];
  }, []);

  return useMemo(() => ({
    ensureSprite,
    spawn,
    isAnimDone,
    prune,
    render,
    getAnimations,
    findById,
    clearById,
    clearAll,
  }), [ensureSprite, spawn, isAnimDone, prune, render, getAnimations, findById, clearById, clearAll]);
}
