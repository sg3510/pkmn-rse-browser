/**
 * useFieldSprites Hook
 *
 * Loads and caches field effect sprites used for terrain animations.
 * Handles transparency conversion from GBA cyan background color.
 *
 * Sprites loaded:
 * - grass: Tall grass animation (stepping into grass)
 * - longGrass: Long grass animation
 * - sand: Sand footprints
 * - splash: Water splash effect
 * - ripple: Water ripple effect
 * - itemBall: Item ball sprite
 */

import { useRef, useCallback, useMemo } from 'react';
import { loadImageCanvasAsset } from '../utils/assetLoader';

const PROJECT_ROOT = '/pokeemerald';

/** Sprite paths for field effects */
const SPRITE_PATHS = {
  grass: `${PROJECT_ROOT}/graphics/field_effects/pics/tall_grass.png`,
  longGrass: `${PROJECT_ROOT}/graphics/field_effects/pics/long_grass.png`,
  sand: `${PROJECT_ROOT}/graphics/field_effects/pics/sand_footprints.png`,
  splash: `${PROJECT_ROOT}/graphics/field_effects/pics/splash.png`,
  ripple: `${PROJECT_ROOT}/graphics/field_effects/pics/ripple.png`,
  itemBall: `${PROJECT_ROOT}/graphics/object_events/pics/misc/item_ball.png`,
} as const;

export type FieldSpriteKey = keyof typeof SPRITE_PATHS;

export interface FieldSprites {
  grass: HTMLCanvasElement | null;
  longGrass: HTMLCanvasElement | null;
  sand: HTMLCanvasElement | null;
  splash: HTMLCanvasElement | null;
  ripple: HTMLCanvasElement | null;
  itemBall: HTMLCanvasElement | null;
}

export interface UseFieldSpritesReturn {
  /** Get a loaded sprite (null if not yet loaded) */
  getSprite: (key: FieldSpriteKey) => HTMLCanvasElement | null;
  /** Load a sprite if not already loaded */
  ensureSprite: (key: FieldSpriteKey) => Promise<HTMLCanvasElement>;
  /** Load all sprites */
  loadAll: () => Promise<FieldSprites>;
  /** Current sprite refs (for direct access) */
  sprites: FieldSprites;
}

/**
 * Load an image and convert to a canvas with transparency
 * Uses top-left pixel as the background color to make transparent
 */
async function loadSpriteWithTransparency(path: string): Promise<HTMLCanvasElement> {
  return loadImageCanvasAsset(path, {
    transparency: { type: 'top-left' },
  });
}

/**
 * Hook for loading and caching field effect sprites
 */
export function useFieldSprites(): UseFieldSpritesReturn {
  const spritesRef = useRef<FieldSprites>({
    grass: null,
    longGrass: null,
    sand: null,
    splash: null,
    ripple: null,
    itemBall: null,
  });

  const getSprite = useCallback((key: FieldSpriteKey): HTMLCanvasElement | null => {
    return spritesRef.current[key];
  }, []);

  const ensureSprite = useCallback(async (key: FieldSpriteKey): Promise<HTMLCanvasElement> => {
    if (spritesRef.current[key]) {
      return spritesRef.current[key]!;
    }

    const path = SPRITE_PATHS[key];
    const canvas = await loadSpriteWithTransparency(path);
    spritesRef.current[key] = canvas;
    return canvas;
  }, []);

  const loadAll = useCallback(async (): Promise<FieldSprites> => {
    const keys: FieldSpriteKey[] = ['grass', 'longGrass', 'sand', 'splash', 'ripple', 'itemBall'];
    await Promise.all(keys.map((key) => ensureSprite(key)));
    return spritesRef.current;
  }, [ensureSprite]);

  return useMemo(() => ({
    getSprite,
    ensureSprite,
    loadAll,
    sprites: spritesRef.current,
  }), [getSprite, ensureSprite, loadAll]);
}
