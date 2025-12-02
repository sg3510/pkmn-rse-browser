/**
 * useArrowOverlay Hook
 *
 * Manages arrow warp indicator sprite loading and overlay state.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */

import { useRef, useCallback, useMemo } from 'react';
import { ArrowOverlay } from '../field/ArrowOverlay';
import type { ArrowOverlayState, CardinalDirection } from '../field/types';
import { ARROW_SPRITE_PATH } from '../data/doorAssets';
import { getArrowDirectionFromBehavior } from '../utils/metatileBehaviors';

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>).DEBUG_DOOR;
}

/**
 * Arrow sprite data for WebGL upload
 */
export interface ArrowSpriteForUpload {
  /** The loaded sprite as canvas (with transparency applied) */
  canvas: HTMLCanvasElement;
  /** Width of the sprite sheet */
  width: number;
  /** Height of the sprite sheet */
  height: number;
}

export interface UseArrowOverlayReturn {
  /** Get the current arrow overlay state */
  getState: () => ArrowOverlayState | null;
  /** Check if arrow is visible */
  isVisible: () => boolean;
  /** Get the loaded sprite (null if not loaded) */
  getSprite: () => HTMLImageElement | HTMLCanvasElement | null;
  /** Load the sprite if not already loaded */
  ensureSprite: () => Promise<HTMLImageElement | HTMLCanvasElement>;
  /** Update arrow overlay based on player position and tile behavior */
  update: (
    playerDir: CardinalDirection,
    tileX: number,
    tileY: number,
    behavior: number,
    now: number,
    warpInProgress: boolean
  ) => void;
  /** Hide the arrow overlay */
  hide: () => void;
  /** Get sprite data for WebGL upload (returns null if not loaded) */
  getSpriteForUpload: () => ArrowSpriteForUpload | null;
}

/**
 * Hook for managing arrow warp indicator overlay
 */
export function useArrowOverlay(): UseArrowOverlayReturn {
  const overlayRef = useRef<ArrowOverlay>(new ArrowOverlay());
  const spriteRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const spritePromiseRef = useRef<Promise<HTMLImageElement | HTMLCanvasElement> | null>(null);

  const getState = useCallback((): ArrowOverlayState | null => {
    return overlayRef.current.getState();
  }, []);

  const isVisible = useCallback((): boolean => {
    return overlayRef.current.isVisible();
  }, []);

  const getSprite = useCallback((): HTMLImageElement | HTMLCanvasElement | null => {
    return spriteRef.current;
  }, []);

  const ensureSprite = useCallback((): Promise<HTMLImageElement | HTMLCanvasElement> => {
    if (spriteRef.current) {
      return Promise.resolve(spriteRef.current);
    }
    if (!spritePromiseRef.current) {
      spritePromiseRef.current = new Promise<HTMLImageElement | HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        img.src = ARROW_SPRITE_PATH;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to acquire arrow sprite context'));
            return;
          }
          ctx.drawImage(img, 0, 0);

          // Apply transparency - find most common color and make it transparent
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const colorCounts = new Map<number, number>();

          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha === 0) continue;
            const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
          }

          let bgKey = 0;
          let bgCount = -1;
          for (const [key, count] of colorCounts.entries()) {
            if (count > bgCount) {
              bgKey = key;
              bgCount = count;
            }
          }

          const bgR = (bgKey >> 16) & 0xff;
          const bgG = (bgKey >> 8) & 0xff;
          const bgB = bgKey & 0xff;

          for (let i = 0; i < data.length; i += 4) {
            if (data[i] === bgR && data[i + 1] === bgG && data[i + 2] === bgB) {
              data[i + 3] = 0;
            }
          }

          ctx.putImageData(imageData, 0, 0);
          spriteRef.current = canvas;
          resolve(canvas);
        };
        img.onerror = (err) => reject(err);
      }).finally(() => {
        spritePromiseRef.current = null;
      }) as Promise<HTMLImageElement | HTMLCanvasElement>;
    }
    return spritePromiseRef.current!;
  }, []);

  const update = useCallback(
    (
      playerDir: CardinalDirection,
      tileX: number,
      tileY: number,
      behavior: number,
      now: number,
      warpInProgress: boolean
    ): void => {
      if (warpInProgress) {
        overlayRef.current.hide();
        return;
      }

      const arrowDir = getArrowDirectionFromBehavior(behavior);

      // Ensure sprite is loaded if we need to show an arrow
      if (arrowDir && !spriteRef.current && !spritePromiseRef.current) {
        ensureSprite().catch((err) => {
          if (isDebugMode()) {
            console.warn('Failed to load arrow sprite', err);
          }
        });
      }

      // Update arrow overlay state
      overlayRef.current.update(
        playerDir,
        arrowDir,
        tileX,
        tileY,
        now,
        warpInProgress
      );
    },
    [ensureSprite]
  );

  const hide = useCallback((): void => {
    overlayRef.current.hide();
  }, []);

  const getSpriteForUpload = useCallback((): ArrowSpriteForUpload | null => {
    const sprite = spriteRef.current;
    if (!sprite) {
      return null;
    }
    // The sprite is stored as HTMLCanvasElement after processing
    if (sprite instanceof HTMLCanvasElement) {
      return {
        canvas: sprite,
        width: sprite.width,
        height: sprite.height,
      };
    }
    return null;
  }, []);

  return useMemo(() => ({
    getState,
    isVisible,
    getSprite,
    ensureSprite,
    update,
    hide,
    getSpriteForUpload,
  }), [getState, isVisible, getSprite, ensureSprite, update, hide, getSpriteForUpload]);
}
