/**
 * Sprite Utilities - Helpers for building SpriteInstance from game objects
 *
 * These utilities convert game-specific sprite data (PlayerController, NPCs, etc.)
 * into renderer-agnostic SpriteInstance objects that can be rendered by any
 * ISpriteRenderer implementation (WebGL or Canvas2D).
 *
 * Design principle: Game code stays unaware of rendering implementation.
 */

import type { SpriteInstance } from './types';
import type { FrameInfo } from '../game/PlayerController';
import type { FieldEffectForRendering } from '../game/FieldEffectManager';
import type { ReflectionState } from '../field/ReflectionRenderer';
import type { NPCObject } from '../types/objectEvents';
import {
  BRIDGE_OFFSETS,
  REFLECTION_VERTICAL_OFFSET,
  getReflectionAlpha,
  getGlobalShimmer,
  ReflectionShimmer,
} from '../field/ReflectionRenderer';
import { isPondBridge } from '../utils/metatileBehaviors';
import { getNPCFrameInfo, getNPCFrameRect } from '../game/npc/NPCSpriteLoader';
import { METATILE_SIZE } from '../utils/mapLoader';

/**
 * GBA-accurate reflection tint colors (normalized 0-1)
 *
 * These match the CSS values in ReflectionRenderer.ts but converted for WebGL.
 * On GBA, tints are applied via palette replacement/blending.
 */
const REFLECTION_TINT_COLORS = {
  /** Water: RGB(70, 120, 200) - blue tint for underwater appearance */
  water: { r: 70 / 255, g: 120 / 255, b: 200 / 255 },
  /** Ice: RGB(180, 220, 255) - light blue/white tint for frozen surface */
  ice: { r: 180 / 255, g: 220 / 255, b: 255 / 255 },
  /** Bridge: RGB(74, 115, 172) - dark blue for pond bridge reflections */
  bridge: { r: 74 / 255, g: 115 / 255, b: 172 / 255 },
} as const;

/**
 * Create a SpriteInstance from PlayerController's FrameInfo
 *
 * @param frameInfo - Frame info from player.getFrameInfo()
 * @param atlasName - Name of the sprite sheet (e.g., 'player-walking')
 * @param sortKey - Y-sort key for depth ordering
 * @returns SpriteInstance ready for rendering
 */
export function createSpriteFromFrameInfo(
  frameInfo: FrameInfo,
  atlasName: string,
  sortKey: number
): SpriteInstance {
  return {
    // World position (from FrameInfo.renderX/renderY)
    worldX: frameInfo.renderX,
    worldY: frameInfo.renderY,

    // Dimensions
    width: frameInfo.sw,
    height: frameInfo.sh,

    // Atlas region (source rectangle in sprite sheet)
    atlasName,
    atlasX: frameInfo.sx,
    atlasY: frameInfo.sy,
    atlasWidth: frameInfo.sw,
    atlasHeight: frameInfo.sh,

    // Transform
    flipX: frameInfo.flip,
    flipY: false,

    // Appearance (no tint, full opacity)
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,

    // Sorting
    sortKey,

    // Not a reflection
    isReflection: false,
  };
}

/**
 * Create a reflection SpriteInstance from a normal sprite
 *
 * Reflection sprites are:
 * - Positioned below the character (at feet + offset)
 * - Vertically flipped
 * - Tinted with water/ice color
 * - Lower alpha for transparency
 * - Optionally have shimmer effect (water only)
 *
 * @param baseSprite - The normal sprite to create reflection from
 * @param reflectionOffset - Y offset below the sprite (in pixels)
 * @param tintR - Red tint component (0-1)
 * @param tintG - Green tint component (0-1)
 * @param tintB - Blue tint component (0-1)
 * @param alpha - Reflection opacity (0-1)
 * @param shimmerScale - Optional shimmer X-scale for water reflections
 * @returns SpriteInstance for the reflection
 */
export function createReflectionSprite(
  baseSprite: SpriteInstance,
  reflectionOffset: number,
  tintR: number,
  tintG: number,
  tintB: number,
  alpha: number,
  shimmerScale?: number
): SpriteInstance {
  return {
    ...baseSprite,

    // Position below the character
    // GBA: reflection Y = sprite bottom + offset
    worldY: baseSprite.worldY + baseSprite.height + reflectionOffset,

    // Flip vertically for reflection
    flipY: true,

    // Apply tint and alpha
    tintR,
    tintG,
    tintB,
    alpha,

    // Lower sort key so reflection renders before character
    sortKey: baseSprite.sortKey - 1,

    // Mark as reflection for water mask processing
    isReflection: true,
    shimmerScale,
  };
}

/**
 * Create a player reflection SpriteInstance with GBA-accurate tints
 *
 * This is the main helper for adding reflection sprites to WebGL batch.
 * It handles all GBA-accurate reflection rendering:
 * - Correct tint colors based on reflection type and bridge type
 * - Proper alpha blending
 * - Shimmer scale for water reflections (ice doesn't shimmer)
 * - Correct Y positioning with bridge offsets
 *
 * @param playerSprite - The normal player sprite instance
 * @param reflectionState - Computed reflection state from ReflectionRenderer
 * @param direction - Player facing direction (for shimmer matrix selection)
 * @returns SpriteInstance for the reflection, or null if no reflection needed
 */
export function createPlayerReflectionSprite(
  playerSprite: SpriteInstance,
  reflectionState: ReflectionState,
  direction: 'up' | 'down' | 'left' | 'right'
): SpriteInstance | null {
  if (!reflectionState.hasReflection) return null;

  // Get GBA-accurate tint color
  // Pond bridges use dark blue tint, otherwise use reflection type color
  const tint = isPondBridge(reflectionState.bridgeType)
    ? REFLECTION_TINT_COLORS.bridge
    : REFLECTION_TINT_COLORS[reflectionState.reflectionType ?? 'water'];

  // Get alpha based on bridge type
  const alpha = getReflectionAlpha(reflectionState.bridgeType);

  // Calculate reflection Y offset
  // GBA: reflection Y = sprite bottom + REFLECTION_VERTICAL_OFFSET + bridge offset
  const bridgeOffset = BRIDGE_OFFSETS[reflectionState.bridgeType];
  const reflectionYOffset = REFLECTION_VERTICAL_OFFSET + bridgeOffset;

  // Get shimmer scale - only for water reflections (ice doesn't shimmer)
  let shimmerScale: number | undefined;
  if (reflectionState.reflectionType === 'water') {
    const shimmer = getGlobalShimmer();
    const matrixNum = ReflectionShimmer.getMatrixForDirection(direction, playerSprite.flipX);
    shimmerScale = shimmer.getScaleX(matrixNum);
  }

  return createReflectionSprite(
    playerSprite,
    reflectionYOffset,
    tint.r,
    tint.g,
    tint.b,
    alpha,
    shimmerScale
  );
}

/** Field effect sprite dimensions by type */
const FIELD_EFFECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  tall: { width: 16, height: 16 },
  long: { width: 16, height: 16 },
  sand: { width: 16, height: 16 },
  deep_sand: { width: 16, height: 16 },
  puddle_splash: { width: 16, height: 8 },
  water_ripple: { width: 16, height: 16 },
};

/** Map field effect type to atlas name */
const FIELD_EFFECT_ATLAS_NAMES: Record<string, string> = {
  tall: 'field-grass',
  long: 'field-longGrass',
  sand: 'field-sand',
  deep_sand: 'field-sand',
  puddle_splash: 'field-splash',
  water_ripple: 'field-ripple',
};

/**
 * Create a SpriteInstance from a FieldEffectForRendering
 *
 * @param effect - Field effect data from FieldEffectManager
 * @param playerWorldY - Player's Y position for sorting
 * @param layer - 'bottom' or 'top' layer
 * @returns SpriteInstance or null if effect should not render in this layer
 */
export function createFieldEffectSprite(
  effect: FieldEffectForRendering,
  playerWorldY: number,
  layer: 'bottom' | 'top'
): SpriteInstance | null {
  if (!effect.visible) return null;

  const dims = FIELD_EFFECT_DIMENSIONS[effect.type] || { width: 16, height: 16 };
  const atlasName = FIELD_EFFECT_ATLAS_NAMES[effect.type];
  if (!atlasName) return null;

  // Y-sorting logic (matches ObjectRenderer.renderFieldEffects)
  let isInFront = effect.worldY >= playerWorldY;

  if (effect.type === 'sand' || effect.type === 'deep_sand' ||
      effect.type === 'puddle_splash' || effect.type === 'water_ripple') {
    // These always render behind player
    isInFront = false;
  } else {
    // Dynamic layering from subpriority (for tall grass)
    if (effect.subpriorityOffset > 0) {
      isInFront = false;
    }
  }

  // Filter by layer
  if (layer === 'bottom' && isInFront) return null;
  if (layer === 'top' && !isInFront) return null;

  // Calculate world position (convert from center to top-left)
  // FieldEffectManager returns center coordinates (tile*16 + 8)
  let worldX = effect.worldX - dims.width / 2;
  let worldY: number;

  // Y offset based on effect type (matches ObjectRenderer)
  if (effect.type === 'water_ripple') {
    worldY = effect.worldY + 6 - dims.height / 2;
  } else if (effect.type === 'puddle_splash') {
    worldY = effect.worldY + 4 - dims.height / 2;
  } else {
    worldY = effect.worldY - dims.height / 2;
  }

  // Calculate atlas coordinates
  const atlasX = effect.frame * dims.width;
  const atlasY = 0;

  // Sort key: lower values render first (behind)
  // Effects behind player get lower subpriority
  const subpriority = isInFront ? 64 : 0;
  const sortKey = calculateSortKey(effect.worldY, subpriority);

  return {
    worldX,
    worldY,
    width: dims.width,
    height: dims.height,
    atlasName,
    atlasX,
    atlasY,
    atlasWidth: dims.width,
    atlasHeight: dims.height,
    flipX: effect.flipHorizontal ?? false,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey,
    isReflection: false,
  };
}

/**
 * Get atlas name for a field effect sprite sheet
 */
export function getFieldEffectAtlasName(spriteKey: string): string {
  return `field-${spriteKey}`;
}

/**
 * Calculate sort key for a sprite based on Y position
 *
 * Higher Y = rendered later (on top)
 * Subpriority allows fine control within same Y
 *
 * @param worldY - World Y position in pixels
 * @param subpriority - Additional priority (0-255)
 * @returns Sort key for ordering
 */
export function calculateSortKey(worldY: number, subpriority: number = 0): number {
  // Use bottom of sprite for Y-sorting (where feet are)
  // Shift Y by 8 bits and add subpriority
  return (Math.floor(worldY) << 8) | (subpriority & 0xff);
}

/**
 * Get the appropriate atlas name for a player sprite sheet
 *
 * Prefixes sprite keys with 'player-' to avoid name collisions
 * with other sprite sheets (NPCs, effects, etc.)
 *
 * @param spriteKey - Key from PlayerController (e.g., 'walking', 'running')
 * @returns Atlas name for WebGLSpriteRenderer (e.g., 'player-walking')
 */
export function getPlayerAtlasName(spriteKey: string): string {
  return `player-${spriteKey}`;
}

/**
 * Provider function type for getting reflection meta at a world pixel position
 */
export type ReflectionMetaAtPixel = (worldX: number, worldY: number) => {
  isReflective: boolean;
  pixelMask?: boolean[];
} | null;

/**
 * Build water mask texture data for reflection clipping
 *
 * Creates a bitmap where 255 = water (show reflection), 0 = ground (hide).
 * This replicates GBA's BG1 overlay transparency mechanism.
 *
 * @param viewportWidth - Viewport width in pixels
 * @param viewportHeight - Viewport height in pixels
 * @param cameraWorldX - Camera world X position (top-left)
 * @param cameraWorldY - Camera world Y position (top-left)
 * @param getReflectionMeta - Callback to get reflection meta at a tile
 * @returns WaterMaskData ready for upload to WebGLSpriteRenderer
 */
export function buildWaterMaskFromView(
  viewportWidth: number,
  viewportHeight: number,
  cameraWorldX: number,
  cameraWorldY: number,
  getReflectionMeta: (tileX: number, tileY: number) => { pixelMask?: Uint8Array | boolean[]; isReflective?: boolean } | null
): { data: Uint8Array; width: number; height: number; worldOffsetX: number; worldOffsetY: number } {
  const METATILE_SIZE = 16;
  const data = new Uint8Array(viewportWidth * viewportHeight);

  // Calculate tile range covered by viewport
  const startTileX = Math.floor(cameraWorldX / METATILE_SIZE);
  const startTileY = Math.floor(cameraWorldY / METATILE_SIZE);
  const endTileX = Math.ceil((cameraWorldX + viewportWidth) / METATILE_SIZE);
  const endTileY = Math.ceil((cameraWorldY + viewportHeight) / METATILE_SIZE);

  // For each tile, copy its pixel mask to the water mask texture
  for (let tileY = startTileY; tileY <= endTileY; tileY++) {
    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      const meta = getReflectionMeta(tileX, tileY);
      if (!meta?.isReflective || !meta.pixelMask) continue;

      // Calculate tile position in screen coordinates
      const tileScreenX = tileX * METATILE_SIZE - cameraWorldX;
      const tileScreenY = tileY * METATILE_SIZE - cameraWorldY;

      // Copy pixel mask to water mask
      for (let py = 0; py < METATILE_SIZE; py++) {
        const screenY = tileScreenY + py;
        if (screenY < 0 || screenY >= viewportHeight) continue;

        for (let px = 0; px < METATILE_SIZE; px++) {
          const screenX = tileScreenX + px;
          if (screenX < 0 || screenX >= viewportWidth) continue;

          // Check if this pixel is water (reflective)
          const maskIndex = py * METATILE_SIZE + px;
          if (meta.pixelMask[maskIndex]) {
            // Screen coordinates need Y-flip for WebGL (origin is bottom-left)
            const flippedY = viewportHeight - 1 - screenY;
            data[flippedY * viewportWidth + screenX] = 255;
          }
        }
      }
    }
  }

  return {
    data,
    width: viewportWidth,
    height: viewportHeight,
    worldOffsetX: 0, // Mask is screen-aligned
    worldOffsetY: 0,
  };
}

/**
 * Get the atlas name for an NPC sprite sheet
 *
 * Uses graphics ID directly as atlas name for NPCs.
 *
 * @param graphicsId - NPC graphics ID (e.g., 'OBJ_EVENT_GFX_BOY_1')
 * @returns Atlas name for WebGLSpriteRenderer
 */
export function getNPCAtlasName(graphicsId: string): string {
  return `npc-${graphicsId}`;
}

/**
 * Create a SpriteInstance from an NPCObject
 *
 * Handles direction-based frame selection and horizontal flipping.
 *
 * @param npc - NPC object from ObjectEventManager
 * @param sortKey - Y-sort key for depth ordering
 * @returns SpriteInstance ready for rendering, or null if sprite not loaded
 */
export function createNPCSpriteInstance(
  npc: NPCObject,
  sortKey: number
): SpriteInstance | null {
  // Get frame info based on direction
  const { frameIndex, flipHorizontal } = getNPCFrameInfo(npc.direction, false, 0);
  const { sx, sy, sw, sh } = getNPCFrameRect(frameIndex, npc.graphicsId);

  // Calculate world position
  // NPCs are positioned at tile center, sprite is drawn from top-left
  // Standard 16x32 sprite: center horizontally on tile, feet at bottom of tile
  const worldX = npc.tileX * METATILE_SIZE;
  const worldY = npc.tileY * METATILE_SIZE - (sh - METATILE_SIZE);

  return {
    worldX,
    worldY,
    width: sw,
    height: sh,
    atlasName: getNPCAtlasName(npc.graphicsId),
    atlasX: sx,
    atlasY: sy,
    atlasWidth: sw,
    atlasHeight: sh,
    flipX: flipHorizontal,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey,
    isReflection: false,
  };
}

/**
 * Create a reflection SpriteInstance for an NPC
 *
 * Similar to player reflections - vertically flipped, tinted, with shimmer.
 *
 * @param baseSprite - The NPC's normal sprite instance
 * @param reflectionState - Reflection state from computeReflectionState
 * @param direction - NPC facing direction (for shimmer matrix selection)
 * @returns SpriteInstance for the reflection, or null if no reflection
 */
export function createNPCReflectionSprite(
  baseSprite: SpriteInstance,
  reflectionState: ReflectionState,
  direction: 'up' | 'down' | 'left' | 'right'
): SpriteInstance | null {
  if (!reflectionState.hasReflection) return null;

  // Get GBA-accurate tint color (same as player)
  const tint = isPondBridge(reflectionState.bridgeType)
    ? REFLECTION_TINT_COLORS.bridge
    : REFLECTION_TINT_COLORS[reflectionState.reflectionType ?? 'water'];

  // Get alpha based on bridge type
  const alpha = getReflectionAlpha(reflectionState.bridgeType);

  // Calculate reflection Y offset
  const bridgeOffset = BRIDGE_OFFSETS[reflectionState.bridgeType];
  const reflectionYOffset = REFLECTION_VERTICAL_OFFSET + bridgeOffset;

  // Get shimmer scale - only for water reflections (ice doesn't shimmer)
  let shimmerScale: number | undefined;
  if (reflectionState.reflectionType === 'water') {
    const shimmer = getGlobalShimmer();
    const matrixNum = ReflectionShimmer.getMatrixForDirection(direction, baseSprite.flipX);
    shimmerScale = shimmer.getScaleX(matrixNum);
  }

  return createReflectionSprite(
    baseSprite,
    reflectionYOffset,
    tint.r,
    tint.g,
    tint.b,
    alpha,
    shimmerScale
  );
}
