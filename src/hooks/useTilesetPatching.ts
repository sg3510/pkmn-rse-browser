import { useCallback, useRef, useMemo } from 'react';
import type { TilesetResources } from '../services/MapManager';
import type { TilesetRuntime, TilesetBuffers } from '../components/map/types';
import { buildTilesetRuntime } from '../utils/tilesetUtils';
import { useTilesetAnimations } from './useTilesetAnimations';
import { PrerenderedAnimations } from '../rendering/PrerenderedAnimations';
import {
  TILE_SIZE,
  TILES_PER_ROW_IN_IMAGE,
  SECONDARY_TILE_OFFSET,
} from '../utils/mapLoader';

type AnimationState = Record<string, number>;

/**
 * Copy an 8x8 tile from source buffer to destination buffer
 */
function copyTile(
  src: Uint8Array,
  srcX: number,
  srcY: number,
  srcStride: number,
  dest: Uint8Array,
  destX: number,
  destY: number,
  destStride: number
) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const val = src[(srcY + y) * srcStride + (srcX + x)];
      dest[(destY + y) * destStride + (destX + x)] = val;
    }
  }
}

/**
 * Hook to manage tileset runtime caching and animation patching.
 *
 * Extracted from MapRenderer.tsx to reduce component complexity.
 */
export function useTilesetPatching() {
  const tilesetRuntimeCacheRef = useRef<Map<string, TilesetRuntime>>(new Map());
  const tilesetAnimations = useTilesetAnimations();

  /**
   * Build patched tile buffers with current animation frame data applied.
   * Uses memoization based on animation state key.
   */
  const buildPatchedTilesForRuntime = useCallback(
    (runtime: TilesetRuntime, animationState: AnimationState): TilesetBuffers => {
      const animKey = runtime.animations
        .map((anim) => `${anim.id}:${animationState[anim.id] ?? 0}`)
        .join('|');

      if (animKey === runtime.lastPatchedKey && runtime.patchedTiles) {
        return runtime.patchedTiles;
      }

      let patchedPrimary = runtime.resources.primaryTilesImage;
      let patchedSecondary = runtime.resources.secondaryTilesImage;
      let primaryPatched = false;
      let secondaryPatched = false;

      for (const anim of runtime.animations) {
        const rawCycle = animationState[anim.id] ?? 0;
        const tilesetTarget = anim.tileset;
        if (tilesetTarget === 'primary' && !primaryPatched) {
          patchedPrimary = new Uint8Array(runtime.resources.primaryTilesImage);
          primaryPatched = true;
        }
        if (tilesetTarget === 'secondary' && !secondaryPatched) {
          patchedSecondary = new Uint8Array(runtime.resources.secondaryTilesImage);
          secondaryPatched = true;
        }

        for (const destination of anim.destinations) {
          const effectiveCycle = rawCycle + (destination.phase ?? 0);
          const useAlt =
            anim.altSequence !== undefined &&
            anim.altSequenceThreshold !== undefined &&
            effectiveCycle >= anim.altSequenceThreshold;
          const seq = useAlt && anim.altSequence ? anim.altSequence : anim.sequence;
          const seqIndexRaw = effectiveCycle % seq.length;
          const seqIndex = seqIndexRaw < 0 ? seqIndexRaw + seq.length : seqIndexRaw;
          const frameIndex = seq[seqIndex] ?? 0;
          const frameData = anim.frames[frameIndex];
          if (!frameData) continue;

          let destId = destination.destStart;
          for (let ty = 0; ty < anim.tilesHigh; ty++) {
            for (let tx = 0; tx < anim.tilesWide; tx++) {
              const sx = tx * TILE_SIZE;
              const sy = ty * TILE_SIZE;
              const targetBuffer = tilesetTarget === 'primary' ? patchedPrimary : patchedSecondary;
              const adjustedDestId =
                tilesetTarget === 'secondary' ? destId - SECONDARY_TILE_OFFSET : destId;
              copyTile(
                frameData,
                sx,
                sy,
                anim.width,
                targetBuffer,
                (adjustedDestId % TILES_PER_ROW_IN_IMAGE) * TILE_SIZE,
                Math.floor(adjustedDestId / TILES_PER_ROW_IN_IMAGE) * TILE_SIZE,
                128
              );
              destId++;
            }
          }
        }
      }

      const patched: TilesetBuffers = {
        primary: patchedPrimary,
        secondary: patchedSecondary,
      };

      runtime.lastPatchedKey = animKey;
      runtime.patchedTiles = patched;
      return patched;
    },
    []
  );

  /**
   * Get or create a TilesetRuntime for the given tileset resources.
   * Caches runtimes by tileset key and loads animations.
   */
  const ensureTilesetRuntime = useCallback(
    async (tilesets: TilesetResources): Promise<TilesetRuntime> => {
      const cached = tilesetRuntimeCacheRef.current.get(tilesets.key);
      if (cached) return cached;
      const runtime = buildTilesetRuntime(tilesets);
      const animations = await tilesetAnimations.loadAnimations(tilesets.primaryTilesetId, tilesets.secondaryTilesetId);
      runtime.animations = animations;
      runtime.animatedTileIds = tilesetAnimations.computeAnimatedTileIds(animations);

      // Pre-render animation frames with palettes applied
      if (animations.length > 0) {
        const prerendered = new PrerenderedAnimations();
        await prerendered.prerenderAll(
          animations,
          tilesets.primaryPalettes,
          tilesets.secondaryPalettes
        );
        runtime.prerenderedAnimations = prerendered;
      }

      tilesetRuntimeCacheRef.current.set(tilesets.key, runtime);
      return runtime;
    },
    [tilesetAnimations]
  );

  /**
   * Clear the tileset runtime cache
   */
  const clearCache = useCallback(() => {
    tilesetRuntimeCacheRef.current.clear();
  }, []);

  return useMemo(() => ({
    buildPatchedTilesForRuntime,
    ensureTilesetRuntime,
    clearCache,
    tilesetRuntimeCacheRef,
  }), [buildPatchedTilesForRuntime, ensureTilesetRuntime, clearCache]);
}
