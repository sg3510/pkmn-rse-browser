import { useEffect, useState } from 'react';
import { type WorldState } from '../../services/MapManager';
import { loadTilesetAnimations } from '../../game/loadTilesetAnimations';

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
        
        runtime.animations = await loadTilesetAnimations(
          map.tilesets.primaryTilesetId,
          map.tilesets.secondaryTilesetId,
          {
            onError: (animationId, error) => {
              console.error(`Failed to load animation ${animationId}`, error);
            },
          }
        );

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
