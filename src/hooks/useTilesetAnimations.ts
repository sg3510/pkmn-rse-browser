/**
 * useTilesetAnimations Hook
 *
 * Manages tileset animation loading and animated tile ID computation.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */

import { useCallback, useMemo } from 'react';
import type { LoadedAnimation } from '../components/map/types';
import { loadTilesetAnimations } from '../game/loadTilesetAnimations';
import { isDebugMode } from '../utils/debug';

const PROJECT_ROOT = '/pokeemerald';

export interface AnimatedTileIds {
  primary: Set<number>;
  secondary: Set<number>;
}

export interface UseTilesetAnimationsReturn {
  /** Load all animations for given tilesets */
  loadAnimations: (primaryId: string, secondaryId: string) => Promise<LoadedAnimation[]>;
  /** Compute which tile IDs are animated */
  computeAnimatedTileIds: (animations: LoadedAnimation[]) => AnimatedTileIds;
}

/**
 * Hook for managing tileset animation loading
 */
export function useTilesetAnimations(): UseTilesetAnimationsReturn {
  const loadAnimations = useCallback(
    async (primaryId: string, secondaryId: string): Promise<LoadedAnimation[]> => {
      return loadTilesetAnimations(primaryId, secondaryId, {
        projectRoot: PROJECT_ROOT,
        onError: (animationId, err) => {
          if (isDebugMode()) {
            console.warn(`Animation ${animationId} not loaded:`, err);
          }
        },
      });
    },
    []
  );

  const computeAnimatedTileIds = useCallback((animations: LoadedAnimation[]): AnimatedTileIds => {
    const primary = new Set<number>();
    const secondary = new Set<number>();

    for (const anim of animations) {
      for (const dest of anim.destinations) {
        let destId = dest.destStart;
        for (let ty = 0; ty < anim.tilesHigh; ty++) {
          for (let tx = 0; tx < anim.tilesWide; tx++) {
            if (anim.tileset === 'primary') {
              primary.add(destId);
            } else {
              secondary.add(destId);
            }
            destId++;
          }
        }
      }
    }

    return { primary, secondary };
  }, []);

  return useMemo(() => ({
    loadAnimations,
    computeAnimatedTileIds,
  }), [loadAnimations, computeAnimatedTileIds]);
}
