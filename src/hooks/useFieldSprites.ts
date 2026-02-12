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
 * - bikeTracks: Bike tire tracks
 * - splash: Water splash effect
 * - ripple: Water ripple effect
 * - itemBall: Item ball sprite
 */

import { useRef, useCallback, useMemo } from 'react';
import { loadImageCanvasAsset } from '../utils/assetLoader';
import { FIELD_EFFECT_REGISTRY } from '../data/fieldEffects.gen';

const PROJECT_ROOT = '/pokeemerald';

/** Static assets that aren't in the registry yet */
const EXTRA_SPRITE_PATHS = {
  itemBall: `${PROJECT_ROOT}/graphics/object_events/pics/misc/item_ball.png`,
} as const;

// Keep legacy aliases so existing render paths continue to work unchanged.
const LEGACY_FIELD_ALIASES = {
  grass: 'TALL_GRASS',
  longGrass: 'LONG_GRASS',
  sand: 'SAND_FOOTPRINTS',
  bikeTracks: 'BIKE_TIRE_TRACKS',
  splash: 'SPLASH',
  ripple: 'RIPPLE',
} as const;

export type FieldSpriteKey = keyof typeof FIELD_EFFECT_REGISTRY | keyof typeof EXTRA_SPRITE_PATHS;

export type FieldSprites = {
  [K in FieldSpriteKey]?: HTMLCanvasElement | null;
};

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
  const spritesRef = useRef<FieldSprites>({});

  const getSprite = useCallback((key: FieldSpriteKey): HTMLCanvasElement | null => {
    return spritesRef.current[key] ?? null;
  }, []);

  const ensureSprite = useCallback(async (key: FieldSpriteKey): Promise<HTMLCanvasElement> => {
    const keyString = key as unknown as string;
    const canonicalKey = (LEGACY_FIELD_ALIASES as Record<string, string>)[keyString] ?? keyString;
    const canonicalFieldKey = canonicalKey as FieldSpriteKey;

    if (spritesRef.current[canonicalFieldKey]) {
      const canvas = spritesRef.current[canonicalFieldKey]!;
      spritesRef.current[key] = canvas;
      return canvas;
    }

    if (spritesRef.current[key]) {
      return spritesRef.current[key]!;
    }

    const path =
      FIELD_EFFECT_REGISTRY[canonicalKey]?.imagePath
      || EXTRA_SPRITE_PATHS[key as keyof typeof EXTRA_SPRITE_PATHS];
    if (!path) {
      throw new Error(`No path found for field sprite: ${key}`);
    }

    const canvas = await loadSpriteWithTransparency(path);
    spritesRef.current[canonicalFieldKey] = canvas;
    spritesRef.current[key] = canvas;
    return canvas;
  }, []);

  const loadAll = useCallback(async (): Promise<FieldSprites> => {
    const registryKeys = Object.keys(FIELD_EFFECT_REGISTRY) as Array<keyof typeof FIELD_EFFECT_REGISTRY>;
    const extraKeys = Object.keys(EXTRA_SPRITE_PATHS) as Array<keyof typeof EXTRA_SPRITE_PATHS>;
    const allKeys: FieldSpriteKey[] = [...registryKeys, ...extraKeys];
    await Promise.all(allKeys.map((key) => ensureSprite(key)));

    // Populate legacy aliases after registry sprites are loaded.
    for (const [alias, canonical] of Object.entries(LEGACY_FIELD_ALIASES)) {
      const canvas = spritesRef.current[canonical as FieldSpriteKey];
      if (canvas) {
        spritesRef.current[alias as unknown as FieldSpriteKey] = canvas;
      }
    }

    return spritesRef.current;
  }, [ensureSprite]);

  return useMemo(() => ({
    getSprite,
    ensureSprite,
    loadAll,
    sprites: spritesRef.current,
  }), [getSprite, ensureSprite, loadAll]);
}
