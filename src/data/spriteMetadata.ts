/**
 * Sprite Metadata - Auto-generated from pokeemerald C source
 *
 * This module provides type-safe access to sprite metadata parsed from:
 * - object_event_graphics_info.h
 * - object_event_pic_tables.h
 * - object_event_anims.h
 *
 * To regenerate: npx tsx scripts/parse-sprite-metadata.ts
 */

import spriteData from './sprite-metadata.json' with { type: 'json' };
import { ticksToMs as ticksToMilliseconds } from '../config/timing.ts';

/**
 * Normalize a graphics ID to match the format in sprite-metadata.json
 * Map data may use formats like "OBJ_EVENT_GFX_BOY_1" but metadata uses "OBJ_EVENT_GFX_BOY1"
 *
 * Common patterns:
 * - BOY_1 -> BOY1, GIRL_1 -> GIRL1, MAN_1 -> MAN1, etc.
 * - WOMAN_1 -> WOMAN1, SCIENTIST_1 -> SCIENTIST1, etc.
 */
export function normalizeGraphicsId(graphicsId: string): string {
  // Pattern: _N at the end (where N is a single digit) should become just N
  // e.g., OBJ_EVENT_GFX_BOY_1 -> OBJ_EVENT_GFX_BOY1
  return graphicsId.replace(/_(\d)$/, '$1');
}

// Types
export interface AnimFrame {
  frameIndex: number;
  duration: number; // Game ticks (16.67ms each)
  hFlip?: boolean;
  vFlip?: boolean;
}

export type AffineAnimCommand =
  | {
      type: 'FRAME';
      xScale: number;
      yScale: number;
      rotation: number;
      duration: number;
    }
  | {
      type: 'LOOP';
      count: number;
    }
  | {
      type: 'JUMP';
      target: number;
    }
  | {
      type: 'END';
    };

export interface SpriteInfo {
  graphicsId: string;
  name: string;
  width: number;
  height: number;
  frameCount: number;
  animationTable: string;
  affineAnimationTable?: string;
  inanimate: boolean;
  shadowSize: string;
  spritePath?: string;
  frameMap?: number[];  // Maps logical frame index to physical frame in sprite sheet
}

// Animation indices for standard animations
export const ANIM_STD = {
  FACE_SOUTH: 0,
  FACE_NORTH: 1,
  FACE_WEST: 2,
  FACE_EAST: 3,
  GO_SOUTH: 4,
  GO_NORTH: 5,
  GO_WEST: 6,
  GO_EAST: 7,
  GO_FAST_SOUTH: 8,
  GO_FAST_NORTH: 9,
  GO_FAST_WEST: 10,
  GO_FAST_EAST: 11,
  GO_FASTER_SOUTH: 12,
  GO_FASTER_NORTH: 13,
  GO_FASTER_WEST: 14,
  GO_FASTER_EAST: 15,
  GO_FASTEST_SOUTH: 16,
  GO_FASTEST_NORTH: 17,
  GO_FASTEST_WEST: 18,
  GO_FASTEST_EAST: 19,
} as const;

// Direction to animation index mapping
export function getAnimIndexForDirection(
  direction: 'up' | 'down' | 'left' | 'right',
  isMoving: boolean,
  speed: 'normal' | 'fast' | 'faster' | 'fastest' = 'normal'
): number {
  const dirMap: Record<string, number> = {
    down: 0,  // SOUTH
    up: 1,    // NORTH
    left: 2,  // WEST
    right: 3, // EAST
  };

  const dirIndex = dirMap[direction] ?? 0;

  if (!isMoving) {
    return dirIndex; // FACE_*
  }

  // Moving animations
  const speedOffset: Record<string, number> = {
    normal: 4,   // GO_*
    fast: 8,     // GO_FAST_*
    faster: 12,  // GO_FASTER_*
    fastest: 16, // GO_FASTEST_*
  };

  return (speedOffset[speed] ?? 4) + dirIndex;
}

// Access to raw data
const metadata = spriteData as {
  animationIndices: Record<string, number>;
  animations: Record<string, AnimFrame[]>;
  animationTables: Record<string, Record<string, string>>;
  affineAnimations: Record<string, AffineAnimCommand[]>;
  affineAnimationTables: Record<string, string[]>;
  sprites: Record<string, SpriteInfo>;
};

/**
 * Graphics ID aliases where map/object data uses one ID and metadata uses another.
 *
 * C references:
 * - public/pokeemerald/src/data/object_events/object_event_graphics_info_pointers.h
 *   - OBJ_EVENT_GFX_ZIGZAGOON_1 -> gObjectEventGraphicsInfo_EnemyZigzagoon
 *   - OBJ_EVENT_GFX_ZIGZAGOON_2 -> gObjectEventGraphicsInfo_Zigzagoon
 * - public/pokeemerald/src/data/object_events/object_event_graphics.h
 */
const GRAPHICS_ID_ALIASES: Record<string, { metadataId: string; spritePath?: string }> = {
  OBJ_EVENT_GFX_ZIGZAGOON_1: {
    metadataId: 'OBJ_EVENT_GFX_ENEMY_ZIGZAGOON',
    spritePath: '/pokemon/enemy_zigzagoon.png',
  },
  OBJ_EVENT_GFX_ZIGZAGOON_2: {
    metadataId: 'OBJ_EVENT_GFX_ZIGZAGOON',
  },
  // Script/source aliases used by event data that map to canonical metadata IDs.
  OBJ_EVENT_GFX_HOOH: {
    metadataId: 'OBJ_EVENT_GFX_HO_OH',
    spritePath: '/pokemon/ho_oh.png',
  },
  OBJ_EVENT_GFX_DEOXYS_TRIANGLE: {
    metadataId: 'OBJ_EVENT_GFX_BIRTH_ISLAND_STONE',
    spritePath: '/misc/birth_island_stone.png',
  },
};

/**
 * Get sprite info for a graphics ID
 * Normalizes the ID to handle naming variations (e.g., BOY_1 vs BOY1)
 */
export function getSpriteInfo(graphicsId: string): SpriteInfo | null {
  const alias = GRAPHICS_ID_ALIASES[graphicsId];
  if (alias) {
    const aliasedInfo = metadata.sprites[alias.metadataId];
    if (aliasedInfo) {
      return {
        ...aliasedInfo,
        graphicsId,
        spritePath: alias.spritePath ?? aliasedInfo.spritePath,
      };
    }
  }

  // Try original first, then normalized variants.
  // Some pokeemerald IDs use numbered aliases in map JSON (e.g. ZIGZAGOON_1)
  // while metadata may only contain the base ID (e.g. ZIGZAGOON).
  const direct = metadata.sprites[graphicsId];
  if (direct) return direct;

  const normalized = metadata.sprites[normalizeGraphicsId(graphicsId)];
  if (normalized) return normalized;

  const baseWithoutNumericSuffix = graphicsId.replace(/_\d+$/, '');
  if (baseWithoutNumericSuffix !== graphicsId) {
    return metadata.sprites[baseWithoutNumericSuffix] ?? null;
  }

  return null;
}

/**
 * Get all sprite infos
 */
export function getAllSpriteInfos(): Record<string, SpriteInfo> {
  return metadata.sprites;
}

/**
 * Get sprite dimensions for a graphics ID
 * Falls back to 16x32 if not found
 */
export function getSpriteDimensions(graphicsId: string): { width: number; height: number } {
  const info = getSpriteInfo(graphicsId);
  if (info) {
    return { width: info.width, height: info.height };
  }
  return { width: 16, height: 32 }; // Default fallback
}

/**
 * Get sprite path for a graphics ID
 */
export function getSpritePath(graphicsId: string): string | null {
  const info = getSpriteInfo(graphicsId);
  return info?.spritePath ?? null;
}

/**
 * Get frame count for a graphics ID
 */
export function getFrameCount(graphicsId: string): number {
  const info = getSpriteInfo(graphicsId);
  return info?.frameCount ?? 9; // Default to 9 frames
}

/**
 * Get animation frames for a named animation
 */
export function getAnimationFrames(animName: string): AnimFrame[] {
  return metadata.animations[animName] ?? [];
}

/**
 * Get affine animation commands by affine animation name.
 */
export function getAffineAnimationCommands(animName: string): AffineAnimCommand[] {
  return metadata.affineAnimations[animName] ?? [];
}

/**
 * Get affine animation table by name (index-ordered affine animation names).
 */
export function getAffineAnimationTable(tableName: string): string[] {
  return metadata.affineAnimationTables[tableName] ?? [];
}

/**
 * Get the affine animation table name for a sprite graphics ID.
 */
export function getAffineAnimationTableNameForSprite(graphicsId: string): string | null {
  const info = getSpriteInfo(graphicsId);
  if (!info?.affineAnimationTable) return null;
  return info.affineAnimationTable;
}

/**
 * Get the affine animation commands for a sprite at a specific affine animation index.
 */
export function getSpriteAffineAnimationCommands(
  graphicsId: string,
  affineAnimIndex: number
): AffineAnimCommand[] {
  const tableName = getAffineAnimationTableNameForSprite(graphicsId);
  if (!tableName) return [];

  const table = getAffineAnimationTable(tableName);
  const animName = table[affineAnimIndex];
  if (!animName) return [];

  return getAffineAnimationCommands(animName);
}

/**
 * Get the animation name for a graphics ID and animation index
 */
export function getAnimationNameForSprite(graphicsId: string, animIndex: number): string | null {
  const info = getSpriteInfo(graphicsId);
  if (!info) return null;

  const table = metadata.animationTables[info.animationTable];
  if (!table) return null;

  // Find the animation name by index
  const indexName = Object.keys(metadata.animationIndices).find(
    key => metadata.animationIndices[key] === animIndex
  );

  if (indexName && table[indexName]) {
    return table[indexName];
  }

  return table[String(animIndex)] ?? null;
}

/**
 * Map a logical frame index to a physical frame index in the sprite sheet.
 *
 * Many sprites have non-standard frame layouts. For example, Wingull's
 * sprite sheet is: down, down_walk, up, up_walk, left, left_walk
 * But the animation system expects: down, up, left, down_walk1, down_walk2, etc.
 *
 * The frameMap (from pic tables) provides this remapping.
 */
export function mapLogicalToPhysicalFrame(graphicsId: string, logicalFrame: number): number {
  const info = getSpriteInfo(graphicsId);
  if (info?.frameMap && logicalFrame < info.frameMap.length) {
    return info.frameMap[logicalFrame];
  }
  // No remapping needed - logical equals physical
  return logicalFrame;
}

/**
 * Get animation frames for a sprite and animation index
 * Applies frame mapping to convert logical frame indices to physical sprite sheet positions
 */
export function getSpriteAnimationFrames(graphicsId: string, animIndex: number): AnimFrame[] {
  const animName = getAnimationNameForSprite(graphicsId, animIndex);
  if (!animName) {
    // Fallback: return simple static frame with mapping applied
    const logicalFrame = animIndex < 4 ? animIndex : 0;
    const physicalFrame = mapLogicalToPhysicalFrame(graphicsId, logicalFrame);
    return [{ frameIndex: physicalFrame, duration: 16, hFlip: animIndex === 3 }];
  }

  // Get the animation frames and apply frame mapping
  const frames = getAnimationFrames(animName);
  return frames.map(frame => ({
    ...frame,
    frameIndex: mapLogicalToPhysicalFrame(graphicsId, frame.frameIndex),
  }));
}

/**
 * Check if sprite is inanimate (no walking animation)
 */
export function isInanimate(graphicsId: string): boolean {
  const info = getSpriteInfo(graphicsId);
  return info?.inanimate ?? false;
}

/**
 * Get the frame index to display for a given direction and walking state
 * This is a simplified version for static display - use animation system for full animations
 */
export function getStaticFrameIndex(
  graphicsId: string,
  direction: 'up' | 'down' | 'left' | 'right'
): { frameIndex: number; hFlip: boolean } {
  const animIndex = getAnimIndexForDirection(direction, false);
  const frames = getSpriteAnimationFrames(graphicsId, animIndex);

  if (frames.length > 0) {
    return { frameIndex: frames[0].frameIndex, hFlip: frames[0].hFlip ?? false };
  }

  // Fallback for standard frame layout
  const dirMap: Record<string, number> = { down: 0, up: 1, left: 2, right: 2 };
  return {
    frameIndex: dirMap[direction] ?? 0,
    hFlip: direction === 'right',
  };
}

/**
 * Convert game ticks to milliseconds
 * GBA runs at 60fps, each tick is ~16.67ms
 */
export function ticksToMs(ticks: number): number {
  return ticksToMilliseconds(ticks);
}

/**
 * Calculate total animation duration in milliseconds
 */
export function getAnimationDuration(frames: AnimFrame[]): number {
  return frames.reduce((total, frame) => total + ticksToMs(frame.duration), 0);
}

// Export raw data for advanced usage
export { metadata as rawSpriteMetadata };
