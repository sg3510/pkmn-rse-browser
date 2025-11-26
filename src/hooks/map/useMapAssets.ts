import { useEffect, useState } from 'react';
import { type WorldState } from '../../services/MapManager';
import { loadBinary } from '../../utils/mapLoader';
import { TILESET_ANIMATION_CONFIGS } from '../../data/tilesetAnimations';
import UPNG from 'upng-js';

// Import shared tileset utilities
import {
  buildTilesetRuntime,
  type TilesetRuntime,
  type TilesetBuffers,
  type ReflectionMeta,
  type LoadedAnimation,
  type AnimationDestination,
} from '../../utils/tilesetUtils';

// Re-export types for consumers
export type { TilesetRuntime, TilesetBuffers, ReflectionMeta, LoadedAnimation, AnimationDestination };

const PROJECT_ROOT = '/pokeemerald';

export function useMapAssets(world: WorldState) {
  const [tilesetRuntimes, setTilesetRuntimes] = useState<Map<string, TilesetRuntime>>(new Map());

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      const neededKeys = new Set<string>();
      // Add anchor
      neededKeys.add(world.maps.find(m => m.entry.id === world.anchorId)?.tilesets.key ?? '');
      // Add neighbors
      for (const map of world.maps) {
        neededKeys.add(map.tilesets.key);
      }
      neededKeys.delete('');

      const newRuntimes = new Map(tilesetRuntimes);
      let changed = false;

      for (const key of neededKeys) {
        if (newRuntimes.has(key)) continue;

        // Find resources for this key
        const map = world.maps.find(m => m.tilesets.key === key);
        if (!map) continue;

        const runtime = buildTilesetRuntime(map.tilesets);
        
        // Load animations
        const animConfig = TILESET_ANIMATION_CONFIGS[map.tilesets.primaryTilesetId];
        if (animConfig) {
          const loadedAnims: LoadedAnimation[] = [];
          for (const def of animConfig) {
            try {
              const frames: Uint8Array[] = [];
              let width = 0;
              let height = 0;

              for (const framePath of def.frames) {
                const path = `${PROJECT_ROOT}/${framePath}`;
                const buffer = await loadBinary(path);
                const img = UPNG.decode(buffer);
                
                if (width === 0) {
                  width = img.width;
                  height = img.height;
                }

                let frameData: Uint8Array;
                if (img.ctype === 3) {
                   frameData = new Uint8Array(img.data);
                } else {
                   // If not indexed, we might need to convert or warn.
                   // For now, let's assume all anims are indexed as they should be.
                   console.warn(`Animation frame ${framePath} is not indexed color`);
                   continue;
                }
                frames.push(frameData);
              }

              if (frames.length === 0) continue;
              
              loadedAnims.push({
                ...def,
                frames,
                width,
                height,
                tilesWide: width / 8,
                tilesHigh: height / 8,
                destinations: def.destinations, 
                sequence: def.sequence ?? [], 
              });
            } catch (e) {
              console.error(`Failed to load animation ${def.id}`, e);
            }
          }
          runtime.animations = loadedAnims;
          
          // Populate destinations (placeholder logic)
          for (const anim of runtime.animations) {
             const firstFrame = anim.frames[0];
             if (!firstFrame) continue;
             // Logic to find destinations would go here
          }
        }

        newRuntimes.set(key, runtime);
        changed = true;
      }

      if (changed && active) {
        setTilesetRuntimes(newRuntimes);
      }
    };

    loadAll();
    return () => { active = false; };
  }, [world, tilesetRuntimes]);

  return tilesetRuntimes;
}
