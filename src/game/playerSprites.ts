/**
 * Player sprite descriptors and helpers.
 *
 * Centralizes player sprite loading paths, frame sizes, and frame index mapping
 * so additions like Dive/Underwater styles don't require another one-off branch
 * at every call site.
 */

import {
  getSpriteDimensions,
  mapLogicalToPhysicalFrame,
} from '../data/spriteMetadata';

/**
 * Keys used by PlayerController for sprite sheets.
 */
export type PlayerSpriteKey = 'walking' | 'running' | 'surfing' | 'underwater' | 'shadow';

/**
 * Minimal descriptor for a player sprite sheet.
 */
interface PlayerSpriteDescriptor {
  key: PlayerSpriteKey;
  imagePath: string;
  graphicsId?: string;
  /**
   * Optional override for sprite frame size. If missing, defaults to
   * metadata dimensions and falls back to 16x32.
   */
  frameWidth?: number;
  frameHeight?: number;
  /**
   * Optional render offset in pixels (usually only for 32x32 sprites).
   */
  renderXOffset?: number;
  /**
   * Some sprites are loaded for completeness (e.g., to keep the same
   * runtime asset contract across game modes) but don't use metadata frames.
   */
  useMetadataFrameMap?: boolean;
}

const PLAYER_SPRITE_DESCRIPTORS: Readonly<Record<PlayerSpriteKey, PlayerSpriteDescriptor>> = {
  walking: {
    key: 'walking',
    imagePath: '/pokeemerald/graphics/object_events/pics/people/brendan/walking.png',
    graphicsId: 'OBJ_EVENT_GFX_BRENDAN_NORMAL',
    useMetadataFrameMap: false,
  },
  running: {
    key: 'running',
    imagePath: '/pokeemerald/graphics/object_events/pics/people/brendan/running.png',
    frameWidth: 16,
    frameHeight: 32,
  },
  surfing: {
    key: 'surfing',
    imagePath: '/pokeemerald/graphics/object_events/pics/people/brendan/surfing.png',
    graphicsId: 'OBJ_EVENT_GFX_BRENDAN_SURFING',
    frameWidth: 32,
    frameHeight: 32,
    renderXOffset: -8,
    useMetadataFrameMap: true,
  },
  underwater: {
    key: 'underwater',
    imagePath: '/pokeemerald/graphics/object_events/pics/people/brendan/underwater.png',
    graphicsId: 'OBJ_EVENT_GFX_BRENDAN_UNDERWATER',
    frameWidth: 32,
    frameHeight: 32,
    renderXOffset: -8,
    useMetadataFrameMap: true,
  },
  shadow: {
    key: 'shadow',
    imagePath: '/pokeemerald/graphics/field_effects/pics/shadow_medium.png',
    frameWidth: 16,
    frameHeight: 8,
    useMetadataFrameMap: false,
  },
};

const PLAYER_SPRITE_KEYS: PlayerSpriteKey[] = ['walking', 'running', 'surfing', 'underwater', 'shadow'];

export interface PlayerSpriteFrameMetrics {
  frameWidth: number;
  frameHeight: number;
  renderXOffset: number;
}

export function getPlayerSpriteDescriptor(key: string): PlayerSpriteDescriptor | undefined {
  return PLAYER_SPRITE_DESCRIPTORS[key as PlayerSpriteKey];
}

export function getPlayerSpriteLoadOrder(): ReadonlyArray<PlayerSpriteKey> {
  return PLAYER_SPRITE_KEYS;
}

export function getPlayerSpriteFrameMetrics(key: string): PlayerSpriteFrameMetrics {
  const descriptor = getPlayerSpriteDescriptor(key);
  if (!descriptor) {
    return { frameWidth: 16, frameHeight: 32, renderXOffset: 0 };
  }

  const metadataDims = descriptor.graphicsId
    ? getSpriteDimensions(descriptor.graphicsId)
    : null;

  const frameWidth = descriptor.frameWidth ?? metadataDims?.width ?? 16;
  const frameHeight = descriptor.frameHeight ?? metadataDims?.height ?? 32;

  return {
    frameWidth,
    frameHeight,
    renderXOffset: descriptor.renderXOffset ?? 0,
  };
}

/**
 * Convert logical animation frame index to physical sprite-sheet frame index.
 *
 * For some sprites (notably 32x32 special cases), index remapping is required
 * to match pokeemerald sprite-table order.
 */
export function resolvePlayerSpriteFrameIndex(key: string, logicalFrameIndex: number): number {
  const descriptor = getPlayerSpriteDescriptor(key);
  if (!descriptor || !descriptor.graphicsId || !descriptor.useMetadataFrameMap) {
    return logicalFrameIndex;
  }

  return mapLogicalToPhysicalFrame(descriptor.graphicsId, logicalFrameIndex);
}

/**
 * Load all standard player sprites into an object exposing PlayerController-style loadSprite().
 */
export interface PlayerSpriteLoader {
  loadSprite: (key: string, imagePath: string) => Promise<void>;
}

export async function loadPlayerSpriteSheets(loader: PlayerSpriteLoader, keys?: ReadonlyArray<PlayerSpriteKey>): Promise<void> {
  const list = keys ?? getPlayerSpriteLoadOrder();
  for (const key of list) {
    const descriptor = getPlayerSpriteDescriptor(key);
    if (!descriptor) {
      continue;
    }

    await loader.loadSprite(key, descriptor.imagePath);
  }
}
