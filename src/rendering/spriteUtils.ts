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
import type { NPCObject, ItemBallObject, ScriptObject, LargeObject } from '../types/objectEvents';
import type { DoorAnimDrawable } from '../field/types';
import {
  BRIDGE_OFFSETS,
  REFLECTION_VERTICAL_OFFSET,
  getReflectionAlpha,
  getGlobalShimmer,
  ReflectionShimmer,
} from '../field/ReflectionRenderer';
import { isPondBridge, isTallGrassBehavior, isLongGrassBehavior } from '../utils/metatileBehaviors';
import { getNPCFrameInfo, getNPCFrameRect } from '../game/npc/NPCSpriteLoader';
import { METATILE_SIZE } from '../utils/mapLoader';
import { calculateSortKey } from '../game/playerCoords';
import {
  computeFieldEffectLayer,
  getFieldEffectYOffset,
} from './fieldEffectUtils';
import { LARGE_OBJECT_GRAPHICS_INFO } from '../data/largeObjectGraphics.gen';
import { FIELD_EFFECT_REGISTRY } from '../data/fieldEffects.gen';
import type { ObjectEventAffineTransform } from '../game/npc/ObjectEventAffineManager';

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
 * @param sortKey - Y-sort key for depth ordering
 * @param clipToHalf - If true, only show top half of sprite (for long grass)
 * @returns SpriteInstance ready for rendering
 */
export function createSpriteFromFrameInfo(
  frameInfo: FrameInfo,
  sortKey: number,
  clipToHalf: boolean = false
): SpriteInstance {
  const atlasName = getPlayerAtlasName(frameInfo.spriteKey);

  // For long grass clipping, only show top half of sprite
  const displayHeight = clipToHalf ? Math.floor(frameInfo.sh / 2) : frameInfo.sh;
  const srcHeight = clipToHalf ? Math.floor(frameInfo.sh / 2) : frameInfo.sh;

  return {
    // World position (from FrameInfo.renderX/renderY)
    worldX: frameInfo.renderX,
    worldY: frameInfo.renderY,

    // Dimensions (may be clipped for long grass)
    width: frameInfo.sw,
    height: displayHeight,

    // Atlas region (source rectangle in sprite sheet)
    atlasName,
    atlasX: frameInfo.sx,
    atlasY: frameInfo.sy,
    atlasWidth: frameInfo.sw,
    atlasHeight: srcHeight,

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
  shimmerScale?: number,
  inheritBaseTransform: boolean = true
): SpriteInstance {
  const reflectionSprite: SpriteInstance = {
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

  if (!inheritBaseTransform) {
    reflectionSprite.rotationDeg = undefined;
    reflectionSprite.scaleX = undefined;
    reflectionSprite.scaleY = undefined;
  }

  return reflectionSprite;
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

/**
 * Get atlas name for a field effect sprite sheet
 */
export function getFieldEffectAtlasName(spriteKey: string): string {
  return `field-${spriteKey}`;
}

export function getRotatingGateAtlasName(shapeKey: string): string {
  return `rotating-gate-${shapeKey}`;
}

export function createFieldEffectSprite(
  effect: FieldEffectForRendering,
  playerWorldY: number,
  layer: 'bottom' | 'top',
  preComputedLayer?: 'front' | 'behind'
): SpriteInstance | null {
  if (!effect.visible) return null;

  const metadata = FIELD_EFFECT_REGISTRY[effect.registryKey];
  if (!metadata) return null;

  const atlasName = getFieldEffectAtlasName(effect.registryKey);

  // Use pre-computed layer from SpriteBatcher if provided (handles NPC effects correctly)
  // Otherwise compute based on player position (legacy behavior)
  const effectLayer = preComputedLayer ?? computeFieldEffectLayer(effect, playerWorldY);
  const isInFront = effectLayer === 'front';

  // Only filter by layer if preComputedLayer not provided (legacy mode)
  // When preComputedLayer is provided, SpriteBatcher already handled layer assignment
  if (!preComputedLayer) {
    if (layer === 'bottom' && isInFront) return null;
    if (layer === 'top' && !isInFront) return null;
  }

  // Calculate world position (convert from center to top-left)
  // FieldEffectManager returns center coordinates (tile*16 + 8)
  const worldX = effect.worldX - metadata.width / 2;

  // Y offset from shared utility (water effects are offset downward to appear at feet)
  const yOffset = getFieldEffectYOffset(effect.type);
  const worldY = effect.worldY + yOffset - metadata.height / 2;

  // Calculate atlas coordinates
  const atlasX = effect.frame * metadata.width;
  const atlasY = 0;

  // Sort key: lower values render first (behind)
  // NOTE: When preComputedLayer is provided, the sort key will be overwritten
  // by SpriteBatcher's pre-computed sortKey. This calculation is just a fallback.
  const sortKeyY = isInFront ? (playerWorldY + 16) : effect.worldY;
  const subpriority = isInFront ? 192 : 0;
  const sortKey = calculateSortKey(sortKeyY, subpriority);

  // Water surface effects (puddle_splash, water_ripple) render in the reflection layer
  // between BG0 and BG1, just like reflections. They use water mask clipping but
  // NO shimmer effect. On GBA these render at OAM priority 3.
  const isWaterEffect = effect.registryKey === 'SPLASH' || effect.registryKey === 'RIPPLE';

  return {
    worldX,
    worldY,
    width: metadata.width,
    height: metadata.height,
    atlasName,
    atlasX,
    atlasY,
    atlasWidth: metadata.width,
    atlasHeight: metadata.height,
    flipX: effect.flipHorizontal ?? false,
    flipY: effect.flipVertical ?? false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey,
    isReflection: false,
    isReflectionLayer: isWaterEffect,
  };
}

// Re-export calculateSortKey from playerCoords for backwards compatibility
// The canonical implementation is now in playerCoords.ts
export { calculateSortKey } from '../game/playerCoords';

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
      // CRITICAL: Use Math.floor to get integer screen positions!
      // During smooth camera scrolling, cameraWorldX/Y are floats.
      // Without flooring, we get float screen coords that cause:
      // 1. Wrong array indices (JS truncates toward zero, not floor)
      // 2. Y-flip errors (319.5 truncates to 318, off by 1)
      // 3. Edge bugs (negative floats like -0.1 wrap to huge indices)
      const tileScreenX = Math.floor(tileX * METATILE_SIZE - cameraWorldX);
      const tileScreenY = Math.floor(tileY * METATILE_SIZE - cameraWorldY);

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
    worldOffsetX: Math.floor(cameraWorldX),
    worldOffsetY: Math.floor(cameraWorldY),
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
 * @param clipToHalf - If true, only show top half of sprite (for long grass)
 * @returns SpriteInstance ready for rendering, or null if sprite not loaded
 */
export function createNPCSpriteInstance(
  npc: NPCObject,
  sortKey: number,
  clipToHalf: boolean = false,
  frameOverride?: { frameIndex: number; flipHorizontal: boolean },
  affineTransform?: ObjectEventAffineTransform | null
): SpriteInstance | null {
  // Get frame info based on direction and walking state unless an explicit frame is provided.
  const isWalking = npc.isWalking ?? false;
  const defaultFrameInfo = getNPCFrameInfo(npc.direction, isWalking, 0, npc.graphicsId);
  const frameIndex = frameOverride?.frameIndex ?? defaultFrameInfo.frameIndex;
  const flipHorizontal = frameOverride?.flipHorizontal ?? defaultFrameInfo.flipHorizontal;
  const { sx, sy, sw, sh } = getNPCFrameRect(frameIndex, npc.graphicsId);

  // Calculate world position with sub-tile offset for smooth movement
  // NPCs are positioned at tile center, sprite is drawn from top-left
  // Center sprite horizontally on tile, feet at bottom of tile
  // subTileX/subTileY provide pixel-perfect movement during walks
  //
  // pokeemerald uses centerToCornerVec to center sprites:
  //   centerToCornerVecX = -(width >> 1)  → shifts left by half width
  //   centerToCornerVecY = -(height >> 1) → shifts up by half height
  //
  // For horizontal centering: tileX*16 + 8 (tile center) - sw/2 (sprite center)
  //   = tileX*16 + (16 - sw)/2
  // For vertical: feet at tile bottom, so top = tileY*16 + 16 - height
  //   = tileY*16 - (height - 16)
  const subTileX = npc.subTileX ?? 0;
  const subTileY = npc.subTileY ?? 0;
  const spriteYOffset = npc.spriteYOffset ?? 0;
  const worldX = npc.tileX * METATILE_SIZE + subTileX + Math.floor((METATILE_SIZE - sw) / 2);
  const worldY = npc.tileY * METATILE_SIZE + subTileY - (sh - METATILE_SIZE) + spriteYOffset;

  // For long grass clipping, only show top half of sprite (matches player behavior)
  const displayHeight = clipToHalf ? Math.floor(sh / 2) : sh;
  const srcHeight = clipToHalf ? Math.floor(sh / 2) : sh;

  return {
    worldX,
    worldY,
    width: sw,
    height: displayHeight,
    atlasName: getNPCAtlasName(npc.graphicsId),
    atlasX: sx,
    atlasY: sy,
    atlasWidth: sw,
    atlasHeight: srcHeight,
    flipX: flipHorizontal,
    flipY: false,
    rotationDeg: affineTransform?.rotationDeg,
    scaleX: affineTransform?.scaleX,
    scaleY: affineTransform?.scaleY,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey,
    isReflection: false,
  };
}

/** Atlas name for item ball sprites */
export const ITEM_BALL_ATLAS_NAME = 'item-ball';

/** Item ball sprite dimensions (16x16 single frame) */
export const ITEM_BALL_SIZE = 16;

/**
 * Create a SpriteInstance from an ItemBallObject
 *
 * Item balls are 16x16 single-frame sprites positioned at their tile.
 *
 * @param item - Item ball object from ObjectEventManager
 * @param sortKey - Y-sort key for depth ordering
 * @returns SpriteInstance ready for rendering
 */
export function createItemBallSpriteInstance(
  item: ItemBallObject,
  sortKey: number
): SpriteInstance {
  // Item balls are positioned at tile top-left
  const worldX = item.tileX * METATILE_SIZE;
  const worldY = item.tileY * METATILE_SIZE;

  return {
    worldX,
    worldY,
    width: ITEM_BALL_SIZE,
    height: ITEM_BALL_SIZE,
    atlasName: ITEM_BALL_ATLAS_NAME,
    atlasX: 0,
    atlasY: 0,
    atlasWidth: ITEM_BALL_SIZE,
    atlasHeight: ITEM_BALL_SIZE,
    flipX: false,
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
 * Create a SpriteInstance from a scripted static object (e.g. Birch's bag).
 *
 * Uses the same frame atlas layout as NPC object-event graphics, but does not
 * apply movement offsets or animation.
 */
export function createScriptObjectSpriteInstance(
  scriptObject: ScriptObject,
  sortKey: number
): SpriteInstance | null {
  const frameInfo = getNPCFrameInfo('down', false, 0, scriptObject.graphicsId);
  const { sx, sy, sw, sh } = getNPCFrameRect(frameInfo.frameIndex, scriptObject.graphicsId);

  const worldX = scriptObject.tileX * METATILE_SIZE + Math.floor((METATILE_SIZE - sw) / 2);
  const worldY = scriptObject.tileY * METATILE_SIZE - (sh - METATILE_SIZE);

  return {
    worldX,
    worldY,
    width: sw,
    height: sh,
    atlasName: getNPCAtlasName(scriptObject.graphicsId),
    atlasX: sx,
    atlasY: sy,
    atlasWidth: sw,
    atlasHeight: sh,
    flipX: frameInfo.flipHorizontal,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey,
    isReflection: false,
  };
}

// === Large Object Sprites ===

/** Atlas name prefix for large objects */
export function getLargeObjectAtlasName(graphicsId: string): string {
  return `large-${graphicsId}`;
}

/**
 * Create a SpriteInstance for a large object (e.g. truck, boat)
 *
 * C parity: object-event coordinates are anchored to the object's "feet tile"
 * center, then converted to top-left via center-to-corner vectors.
 *
 * References:
 * - public/pokeemerald/src/event_object_movement.c
 *   - sprite->x += 8 + centerToCornerVecX
 *   - sprite->y += 16 + centerToCornerVecY
 */
export function createLargeObjectSpriteInstance(
  obj: LargeObject,
  sortKey: number
): SpriteInstance {
  const info = LARGE_OBJECT_GRAPHICS_INFO[obj.graphicsId];
  const worldX = obj.tileX * METATILE_SIZE + Math.floor(METATILE_SIZE / 2) - Math.floor(info.width / 2);
  const worldY = obj.tileY * METATILE_SIZE + METATILE_SIZE - info.height;

  return {
    worldX,
    worldY,
    width: info.width,
    height: info.height,
    atlasName: getLargeObjectAtlasName(obj.graphicsId),
    atlasX: 0,
    atlasY: 0,
    atlasWidth: info.width,
    atlasHeight: info.height,
    flipX: false,
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

  const inheritAffineTransform = reflectionState.reflectionType !== 'water';

  return createReflectionSprite(
    baseSprite,
    reflectionYOffset,
    tint.r,
    tint.g,
    tint.b,
    alpha,
    shimmerScale,
    inheritAffineTransform
  );
}

/**
 * Grass sprite constants
 */
const GRASS_FRAME_SIZE = 16;
const GRASS_RESTING_FRAME = 0; // Frame 0 = grass at full coverage (resting state)

/**
 * Create a grass effect sprite for an NPC standing on grass
 *
 * In the GBA game, NPCs standing on tall/long grass have the grass sprite
 * rendered OVER them, showing only their upper body (head and shoulders).
 * The grass uses frame 0 (the "resting" state) at full coverage.
 *
 * @param npc - The NPC object
 * @param behavior - Metatile behavior at NPC's position
 * @param npcSortKey - The NPC's sort key (grass renders slightly after)
 * @returns SpriteInstance for the grass, or null if not on grass
 */
export function createNPCGrassEffectSprite(
  npc: NPCObject,
  behavior: number,
  npcSortKey: number,
  visualTileX?: number,
  visualTileY?: number
): SpriteInstance | null {
  // Determine grass type from behavior
  let atlasName: string;
  if (isTallGrassBehavior(behavior)) {
    atlasName = 'field-grass';
  } else if (isLongGrassBehavior(behavior)) {
    atlasName = 'field-longGrass';
  } else {
    return null; // NPC not on grass
  }

  // Use visual tile position if provided, otherwise calculate from NPC state
  // During walking: tileX/tileY is DESTINATION, but grass should stay at SOURCE
  let grassTileX = visualTileX ?? npc.tileX;
  let grassTileY = visualTileY ?? npc.tileY;

  // If visual tile not provided and NPC is walking, calculate it from subTile offset
  if (visualTileX === undefined && visualTileY === undefined && npc.isWalking) {
    const subTileX = npc.subTileX ?? 0;
    const subTileY = npc.subTileY ?? 0;

    // subTile is negative during walk (e.g., -16 to 0)
    // Determine source tile based on sub-tile offset direction
    if (subTileX < -8) grassTileX = npc.tileX - 1;
    else if (subTileX > 8) grassTileX = npc.tileX + 1;

    if (subTileY < -8) grassTileY = npc.tileY - 1;
    else if (subTileY > 8) grassTileY = npc.tileY + 1;
  }

  // Grass effect is positioned at tile center (FIXED position, doesn't move with NPC)
  // WebGL renderer expects top-left coordinates, so subtract half the sprite size
  const worldX = grassTileX * METATILE_SIZE + METATILE_SIZE / 2 - GRASS_FRAME_SIZE / 2;
  const worldY = grassTileY * METATILE_SIZE + METATILE_SIZE / 2 - GRASS_FRAME_SIZE / 2;

  // Grass renders ON TOP of NPC, so add small offset to sortKey
  // This ensures grass is drawn after the NPC sprite
  const grassSortKey = npcSortKey + 1;

  return {
    atlasName,
    worldX,
    worldY,
    width: GRASS_FRAME_SIZE,
    height: GRASS_FRAME_SIZE,
    atlasX: GRASS_RESTING_FRAME * GRASS_FRAME_SIZE,
    atlasY: 0,
    atlasWidth: GRASS_FRAME_SIZE,
    atlasHeight: GRASS_FRAME_SIZE,
    flipX: false,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey: grassSortKey,
    isReflection: false,
  };
}

/**
 * Shadow sprite constants (GBA-accurate)
 *
 * GBA calculation for shadow Y offset:
 * sYOffset = (spriteHeight/2) - shadowVerticalOffset = 16 - 4 = 12
 * shadow.y = player.y + 12 (in GBA coords)
 *
 * Our coordinate system has player.y 16 pixels above GBA's sprite.y,
 * so: shadow.y = player.y + 16 + 12 = player.y + 28
 */
export const SHADOW_WIDTH = 16;
export const SHADOW_HEIGHT = 8;
export const SHADOW_Y_OFFSET = 28; // Offset from player.y to shadow top

/**
 * Shadow position info - renderer-agnostic data for shadow rendering
 */
export interface ShadowPosition {
  worldX: number;
  worldY: number;
  width: number;
  height: number;
}

/**
 * Get shadow position for a player during jumps
 *
 * Shadow stays on ground (doesn't follow spriteYOffset) while player
 * sprite moves up/down during the jump arc.
 *
 * @param playerX - Player world X position
 * @param playerY - Player world Y position (ground level, no spriteYOffset)
 * @returns Shadow position data
 */
export function getShadowPosition(playerX: number, playerY: number): ShadowPosition {
  return {
    worldX: playerX,
    worldY: playerY + SHADOW_Y_OFFSET,
    width: SHADOW_WIDTH,
    height: SHADOW_HEIGHT,
  };
}

/**
 * Create a shadow SpriteInstance for WebGL rendering
 *
 * Used when player is jumping (showShadow = true). Shadow renders
 * at ground level behind the player sprite.
 *
 * @param playerX - Player world X position
 * @param playerY - Player world Y position (ground level)
 * @param playerSortKey - Player's sort key (shadow uses lower priority)
 * @returns SpriteInstance for the shadow
 */
export function createPlayerShadowSprite(
  playerX: number,
  playerY: number,
  playerSortKey: number
): SpriteInstance {
  const pos = getShadowPosition(playerX, playerY);

  return {
    worldX: pos.worldX,
    worldY: pos.worldY,
    width: pos.width,
    height: pos.height,
    atlasName: getPlayerAtlasName('shadow'),
    atlasX: 0,
    atlasY: 0,
    atlasWidth: SHADOW_WIDTH,
    atlasHeight: SHADOW_HEIGHT,
    flipX: false,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    // Shadow renders behind player (lower subpriority)
    sortKey: playerSortKey - 64,
    isReflection: false,
  };
}

/**
 * Create a shadow SpriteInstance for an NPC during jumps
 *
 * Shadow stays at ground level (no spriteYOffset applied).
 * Reuses the player shadow atlas since the shadow sprite is identical.
 *
 * @param npc - NPC object (position used for shadow placement)
 * @param npcSortKey - NPC's sort key (shadow uses lower priority)
 * @returns SpriteInstance for the shadow
 */
export function createNPCShadowSprite(
  npc: NPCObject,
  npcSortKey: number
): SpriteInstance {
  const subTileX = npc.subTileX ?? 0;
  const subTileY = npc.subTileY ?? 0;
  // Ground-level NPC position (no spriteYOffset)
  const groundX = npc.tileX * METATILE_SIZE + subTileX;
  const groundY = npc.tileY * METATILE_SIZE + subTileY - (32 - METATILE_SIZE);
  const pos = getShadowPosition(groundX, groundY);

  return {
    worldX: pos.worldX,
    worldY: pos.worldY,
    width: pos.width,
    height: pos.height,
    atlasName: getPlayerAtlasName('shadow'),
    atlasX: 0,
    atlasY: 0,
    atlasWidth: SHADOW_WIDTH,
    atlasHeight: SHADOW_HEIGHT,
    flipX: false,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey: npcSortKey - 64,
    isReflection: false,
  };
}

// =============================================================================
// Door Animation Sprites
// =============================================================================

/** Door animation atlas name prefix */
const DOOR_ATLAS_PREFIX = 'door-';

/**
 * Get the atlas name for a door animation sprite
 *
 * @param metatileId - The metatile ID of the door
 * @returns Atlas name for WebGLSpriteRenderer
 */
export function getDoorAtlasName(metatileId: number): string {
  return `${DOOR_ATLAS_PREFIX}${metatileId.toString(16)}`;
}

/**
 * Create a SpriteInstance from a DoorAnimDrawable
 *
 * Door animations are rendered at their world position with frame-based animation.
 * The frame is calculated based on elapsed time and direction (open/close).
 *
 * Per CompositeOrder.ts: Door animations render AFTER topBelow but BEFORE sprites,
 * so player walks IN FRONT of open doors.
 *
 * @param anim - Door animation drawable from useDoorAnimations
 * @param now - Current timestamp for frame calculation
 * @param atlasWidth - Width of the door sprite atlas (pixels)
 * @param atlasHeight - Height of the door sprite atlas (pixels)
 * @returns SpriteInstance or null if animation is done and not held
 */
export function createDoorAnimationSprite(
  anim: DoorAnimDrawable,
  now: number,
  atlasWidth: number,
  _atlasHeight: number
): SpriteInstance | null {
  const totalDuration = anim.frameCount * anim.frameDuration;
  const elapsed = now - anim.startedAt;

  // Skip if animation is done AND not held
  if (elapsed >= totalDuration && !anim.holdOnComplete) {
    return null;
  }

  // Clamp elapsed time when holding on complete
  const clampedElapsed = anim.holdOnComplete
    ? Math.min(elapsed, totalDuration - 1)
    : elapsed;
  const frameIndexRaw = Math.floor(clampedElapsed / anim.frameDuration);

  // For close animations, play frames in reverse
  const frameIndex =
    anim.direction === 'open'
      ? frameIndexRaw
      : Math.max(0, anim.frameCount - 1 - frameIndexRaw);

  // Door sprite dimensions
  const frameWidth = atlasWidth; // Full width of sprite sheet
  const frameHeight = anim.frameHeight; // 32px per frame

  // World position: doors are positioned at (worldX, worldY-1) in metatile coords
  // because the door graphic is 2 tiles tall and positioned above the door tile
  const worldX = anim.worldX * METATILE_SIZE;
  const worldY = (anim.worldY - 1) * METATILE_SIZE;

  // Display dimensions based on door size
  const displayWidth = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE;
  const displayHeight = METATILE_SIZE * 2; // Doors are always 2 tiles tall

  // Door animations render behind player but above topBelow layer
  // Use a very low sortKey to ensure they render before sprites
  const sortKey = calculateSortKey(worldY, 0);

  return {
    worldX,
    worldY,
    width: displayWidth,
    height: displayHeight,
    atlasName: getDoorAtlasName(anim.metatileId),
    atlasX: 0,
    atlasY: frameIndex * frameHeight,
    atlasWidth: frameWidth,
    atlasHeight: frameHeight,
    flipX: false,
    flipY: false,
    alpha: 1.0,
    tintR: 1.0,
    tintG: 1.0,
    tintB: 1.0,
    sortKey,
    isReflection: false,
  };
}

// =============================================================================
// Arrow Overlay Sprites
// =============================================================================

/** Arrow overlay atlas name */
export const ARROW_ATLAS_NAME = 'arrow-overlay';

// Arrow animation logic moved to src/field/ArrowAnimationConstants.ts
