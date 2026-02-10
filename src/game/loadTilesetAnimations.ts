import UPNG from 'upng-js';
import { TILESET_ANIMATION_CONFIGS } from '../data/tilesetAnimations';
import { loadBinary, TILE_SIZE } from '../utils/mapLoader';
import type { LoadedAnimation } from '../utils/tilesetUtils';

const DEFAULT_PROJECT_ROOT = '/pokeemerald';

export interface IndexedFrameData {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface LoadTilesetAnimationsOptions {
  projectRoot?: string;
  onError?: (animationId: string, error: unknown) => void;
}

export async function loadIndexedFrame(url: string): Promise<IndexedFrameData> {
  const buffer = await loadBinary(url);
  const image = UPNG.decode(buffer);

  let data: Uint8Array;
  if (image.ctype === 3 && image.depth === 4) {
    const packed = new Uint8Array(image.data);
    const unpacked = new Uint8Array(packed.length * 2);
    for (let i = 0; i < packed.length; i++) {
      const byte = packed[i];
      unpacked[i * 2] = (byte >> 4) & 0xf;
      unpacked[i * 2 + 1] = byte & 0xf;
    }
    data = unpacked;
  } else {
    data = new Uint8Array(image.data);
  }

  return {
    data,
    width: image.width,
    height: image.height,
  };
}

export async function loadTilesetAnimations(
  primaryId: string,
  secondaryId: string,
  options: LoadTilesetAnimationsOptions = {}
): Promise<LoadedAnimation[]> {
  const projectRoot = options.projectRoot ?? DEFAULT_PROJECT_ROOT;
  const requested = [
    ...(TILESET_ANIMATION_CONFIGS[primaryId] ?? []),
    ...(TILESET_ANIMATION_CONFIGS[secondaryId] ?? []),
  ];

  const loaded: LoadedAnimation[] = [];

  for (const definition of requested) {
    try {
      const frames: Uint8Array[] = [];
      let width = 0;
      let height = 0;

      for (const framePath of definition.frames) {
        const frame = await loadIndexedFrame(`${projectRoot}/${framePath}`);
        frames.push(frame.data);
        width = frame.width;
        height = frame.height;
      }

      const tilesWide = Math.max(1, Math.floor(width / TILE_SIZE));
      const tilesHigh = Math.max(1, Math.floor(height / TILE_SIZE));
      const sequence = definition.sequence ?? frames.map((_, index) => index);

      loaded.push({
        id: definition.id,
        tileset: definition.tileset,
        frames,
        width,
        height,
        tilesWide,
        tilesHigh,
        sequence,
        interval: definition.interval,
        destinations: definition.destinations,
        altSequence: definition.altSequence,
        altSequenceThreshold: definition.altSequenceThreshold,
      });
    } catch (error) {
      options.onError?.(definition.id, error);
    }
  }

  return loaded;
}
