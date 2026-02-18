import type { ResolvedTile } from '../rendering/types';
import type { WorldSnapshot } from './WorldManager';
import { resolveMetatileIndex } from '../utils/mapLoader';

interface PulseEntry {
  mapId: string;
  localX: number;
  localY: number;
  metatileId: number;
  remainingFrames: number;
}

/**
 * Render-only metatile pulse manager.
 *
 * Stores short-lived tile overrides used for draw parity (e.g. Fortree bridge
 * bounce from public/pokeemerald/src/field_tasks.c FortreeBridgePerStepCallback)
 * without mutating collision-authoritative map tile data.
 */
export class TransientMetatilePulseManager {
  private pulses = new Map<string, PulseEntry>();

  queueLocalPulse(
    mapId: string,
    localX: number,
    localY: number,
    metatileId: number,
    frames: number = 1
  ): void {
    if (frames <= 0) return;
    this.pulses.set(
      this.makeKey(mapId, localX, localY),
      { mapId, localX, localY, metatileId, remainingFrames: frames }
    );
  }

  tick(frameCount: number = 1): void {
    if (frameCount <= 0 || this.pulses.size === 0) return;

    for (const [key, pulse] of this.pulses) {
      pulse.remainingFrames -= frameCount;
      if (pulse.remainingFrames <= 0) {
        this.pulses.delete(key);
      }
    }
  }

  clear(): void {
    this.pulses.clear();
  }

  resolveOverride(worldX: number, worldY: number, snapshot: WorldSnapshot): ResolvedTile | null {
    if (this.pulses.size === 0) {
      return null;
    }

    const map = snapshot.maps.find(
      (entry) =>
        worldX >= entry.offsetX
        && worldX < entry.offsetX + entry.entry.width
        && worldY >= entry.offsetY
        && worldY < entry.offsetY + entry.entry.height
    );
    if (!map) return null;

    const localX = worldX - map.offsetX;
    const localY = worldY - map.offsetY;
    const pulse = this.pulses.get(this.makeKey(map.entry.id, localX, localY));
    if (!pulse) return null;

    const pairIndex = snapshot.mapTilesetPairIndex.get(map.entry.id) ?? 0;
    const pair = snapshot.tilesetPairs[pairIndex];
    if (!pair) return null;

    const tileIndex = localY * map.entry.width + localX;
    const mapTile = map.mapData.layout[tileIndex];
    if (!mapTile) return null;

    const { isSecondary, index: attrIndex } = resolveMetatileIndex(pulse.metatileId);
    const metatile = isSecondary
      ? pair.secondaryMetatiles[attrIndex]
      : pair.primaryMetatiles[pulse.metatileId];
    if (!metatile) return null;

    const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
    const attributes = attrArray[attrIndex] ?? { behavior: 0, layerType: 0 };
    const gpuSlot = snapshot.pairIdToGpuSlot.get(pair.id) ?? 0;

    return {
      metatile,
      attributes,
      mapTile: { ...mapTile, metatileId: pulse.metatileId },
      map: null as any,
      tileset: null as any,
      isSecondary,
      isBorder: false,
      tilesetPairIndex: gpuSlot,
    };
  }

  private makeKey(mapId: string, localX: number, localY: number): string {
    return `${mapId}:${localX},${localY}`;
  }
}
