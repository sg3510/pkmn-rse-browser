/**
 * useTilesetAnimations Hook
 *
 * Manages tileset animation loading and animated tile ID computation.
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */

import { useCallback, useMemo } from 'react';
import UPNG from 'upng-js';
import { loadBinary, TILE_SIZE } from '../utils/mapLoader';
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import type { LoadedAnimation } from '../components/map/types';

const PROJECT_ROOT = '/pokeemerald';

// Helper to check if debug mode is enabled
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>).DEBUG_MODE;
}

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
 * Load a PNG frame as indexed pixel data
 */
async function loadIndexedFrame(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const buffer = await loadBinary(url);
  const img = UPNG.decode(buffer);

  let data: Uint8Array;
  if (img.ctype === 3 && img.depth === 4) {
    // 4-bit indexed PNG - unpack nibbles
    const packed = new Uint8Array(img.data);
    const unpacked = new Uint8Array(packed.length * 2);
    for (let i = 0; i < packed.length; i++) {
      const byte = packed[i];
      unpacked[i * 2] = (byte >> 4) & 0xf;
      unpacked[i * 2 + 1] = byte & 0xf;
    }
    data = unpacked;
  } else {
    data = new Uint8Array(img.data);
  }

  return { data, width: img.width, height: img.height };
}

/**
 * Hook for managing tileset animation loading
 */
export function useTilesetAnimations(): UseTilesetAnimationsReturn {
  const loadAnimations = useCallback(
    async (primaryId: string, secondaryId: string): Promise<LoadedAnimation[]> => {
      const loaded: LoadedAnimation[] = [];
      const requested = [
        ...(TILESET_ANIMATION_CONFIGS[primaryId] ?? []),
        ...(TILESET_ANIMATION_CONFIGS[secondaryId] ?? []),
      ];

      for (const def of requested) {
        try {
          const frames: Uint8Array[] = [];
          let width = 0;
          let height = 0;

          for (const framePath of def.frames) {
            const frame = await loadIndexedFrame(`${PROJECT_ROOT}/${framePath}`);
            frames.push(frame.data);
            width = frame.width;
            height = frame.height;
          }

          const tilesWide = Math.max(1, Math.floor(width / TILE_SIZE));
          const tilesHigh = Math.max(1, Math.floor(height / TILE_SIZE));
          const sequence = def.sequence ?? frames.map((_, i) => i);

          loaded.push({
            ...def,
            frames,
            width,
            height,
            tilesWide,
            tilesHigh,
            sequence,
            destinations: def.destinations,
          });
        } catch (err) {
          if (isDebugMode()) {
            console.warn(`Animation ${def.id} not loaded:`, err);
          }
        }
      }

      return loaded;
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
