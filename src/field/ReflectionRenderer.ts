/**
 * ReflectionRenderer - Water and ice reflection effects
 *
 * This module provides utilities for rendering object reflections on
 * water and ice surfaces. Reflections are a key visual effect in the
 * GBA Pokemon games, where players and NPCs cast reflections on nearby
 * water tiles.
 *
 * Based on pokeemerald's reflection system:
 * - src/field_effect_helpers.c: UpdateObjectReflectionSprite
 * - src/event_object_movement.c: Reflection sprite management
 *
 * Reflection behavior:
 * - Water: Blue-tinted, semi-transparent reflection
 * - Ice: Clear/white-tinted mirror reflection
 * - Bridge: Darker tint when on bridge over water
 *
 * Position calculation:
 * - Reflection appears at sprite.y + height - 2 + bridgeOffset
 * - This places the reflection just below the sprite's feet
 *
 * Masking:
 * - Reflections are masked to only show on reflective tile pixels
 * - The pixel mask comes from BG1 transparency data
 * - This ensures reflections only appear on water portions, not land
 *
 * Note: The actual rendering implementation is in ObjectRenderer.
 * This module provides the type definitions, constants, and detection
 * utilities for reflection effects.
 *
 * Usage:
 * ```typescript
 * import { computeReflectionState } from '../components/map/utils';
 * import { REFLECTION_TINTS, BRIDGE_OFFSETS } from './ReflectionRenderer';
 *
 * // Compute reflection state for an object
 * const reflectionState = computeReflectionState(ctx, player);
 *
 * // Use in rendering
 * if (reflectionState.hasReflection) {
 *   const tint = REFLECTION_TINTS[reflectionState.reflectionType ?? 'water'];
 *   const offset = BRIDGE_OFFSETS[reflectionState.bridgeType];
 *   // ... render reflection with tint and offset
 * }
 * ```
 */

import type { BridgeType } from '../utils/metatileBehaviors';
import { isPondBridge, getBridgeTypeFromBehavior } from '../utils/metatileBehaviors';
import type { ReflectionMeta } from '../utils/tilesetUtils';
import { METATILE_SIZE } from '../utils/mapLoader';
import {
  ReflectionShimmer,
  getGlobalShimmer,
  applyGbaAffineShimmer,
  isShimmerEnabled,
  setShimmerEnabled,
} from './ReflectionShimmer';

// Re-export shimmer utilities for convenient imports
export {
  ReflectionShimmer,
  getGlobalShimmer,
  isShimmerEnabled,
  setShimmerEnabled,
  applyGbaAffineShimmer,
};

/**
 * Reflection type for surface effects
 */
export type ReflectionType = 'water' | 'ice';

/**
 * Reflection state for an object
 *
 * Computed from tile data at the object's position.
 */
export interface ReflectionState {
  /** Whether a reflection should be rendered */
  hasReflection: boolean;
  /** Type of reflection effect (water = blue tint, ice = clear) */
  reflectionType: ReflectionType | null;
  /** Bridge type affects reflection offset and tint */
  bridgeType: BridgeType;
}

/**
 * Bridge offsets for reflection Y position (GBA-accurate)
 *
 * When standing on bridges over water, the reflection needs to be
 * offset down to account for the bridge height.
 *
 * From GBA's bridgeReflectionVerticalOffsets[] (field_effect_helpers.c:78-82):
 * - none: 0 (not on bridge)
 * - ocean: 0 (Routes 110/119 log bridges - no extra offset)
 * - pondLow: 12 (unused in game)
 * - pondMed: 28 (Route 120 south bridge)
 * - pondHigh: 44 (Route 120 north bridge)
 */
export const BRIDGE_OFFSETS: Record<BridgeType, number> = {
  none: 0,
  ocean: 0,
  pondLow: 12,
  pondMed: 28,
  pondHigh: 44,
};

/**
 * Reflection tint colors by type
 *
 * Applied as overlay on the flipped sprite to create the reflection effect.
 */
export const REFLECTION_TINTS: Record<ReflectionType, string> = {
  /** Water: Blue tint for underwater appearance */
  water: 'rgba(70, 120, 200, 0.35)',
  /** Ice: Light blue/white tint for frozen surface */
  ice: 'rgba(180, 220, 255, 0.35)',
};

/**
 * Bridge reflection color (GBA-accurate)
 *
 * From pokeemerald graphics/object_events/palettes/bridge_reflection.pal:
 * The GBA uses a SOLID palette replacement of RGB(74, 115, 172) for all 16 colors.
 * This makes bridge reflections appear as solid blue silhouettes, not tinted sprites.
 *
 * The color is applied as a solid fill (no alpha in the color itself).
 * Final transparency is controlled by REFLECTION_ALPHA.bridge (0.6).
 */
export const BRIDGE_REFLECTION_TINT = 'rgb(74, 115, 172)';

/**
 * Reflection alpha by bridge state
 */
export const REFLECTION_ALPHA = {
  /** Normal reflection alpha */
  normal: 0.65,
  /** Reduced alpha when on bridge */
  bridge: 0.6,
};

/**
 * Vertical offset from sprite bottom to reflection start
 *
 * The reflection starts 2 pixels above the sprite's bottom edge.
 * This matches GBA's GetReflectionVerticalOffset() which returns height - 2.
 */
export const REFLECTION_VERTICAL_OFFSET = -2;

/**
 * Sprite frame information for reflection rendering
 *
 * Contains all data needed to render a sprite's reflection.
 */
export interface SpriteFrameInfo {
  /** Sprite image source */
  sprite: HTMLCanvasElement | HTMLImageElement;
  /** Source X in sprite sheet */
  sx: number;
  /** Source Y in sprite sheet */
  sy: number;
  /** Source width */
  sw: number;
  /** Source height */
  sh: number;
  /** Horizontal flip flag (for east-facing) */
  flip: boolean;
  /** World pixel X (top-left of sprite) */
  worldX: number;
  /** World pixel Y (top-left of sprite) */
  worldY: number;
  /** Tile X position (for reflection detection) */
  tileX: number;
  /** Tile Y position (for reflection detection) */
  tileY: number;
}

/**
 * Calculate reflection Y position for a sprite
 *
 * @param spriteWorldY - Sprite's world Y position (top-left)
 * @param spriteHeight - Sprite height in pixels
 * @param bridgeType - Type of bridge (affects offset)
 * @returns World Y position for reflection
 */
export function calculateReflectionY(
  spriteWorldY: number,
  spriteHeight: number,
  bridgeType: BridgeType
): number {
  return spriteWorldY + spriteHeight + REFLECTION_VERTICAL_OFFSET + BRIDGE_OFFSETS[bridgeType];
}

/**
 * Get the appropriate tint color for a reflection
 *
 * From GBA's IsSpecialBridgeReflectionPaletteNeeded (field_effect_helpers.c):
 * - Pond bridges (low/med/high) use dark blue tint to blend with dark water under bridge
 * - Ocean bridges use normal water tint (no special palette)
 *
 * @param reflectionType - Type of reflection (water/ice)
 * @param bridgeType - Type of bridge being stood on
 * @returns CSS color string for the tint
 */
export function getReflectionTint(
  reflectionType: ReflectionType | null,
  bridgeType: BridgeType
): string {
  // Only pond bridges get the dark blue tint, not ocean bridges
  if (isPondBridge(bridgeType)) {
    return BRIDGE_REFLECTION_TINT;
  }
  return REFLECTION_TINTS[reflectionType ?? 'water'];
}

/**
 * Get the appropriate alpha for a reflection
 *
 * Pond bridges have slightly reduced alpha to better blend with dark tint.
 * Ocean bridges use normal alpha.
 *
 * @param bridgeType - Type of bridge being stood on
 * @returns Alpha value (0-1)
 */
export function getReflectionAlpha(bridgeType: BridgeType): number {
  return isPondBridge(bridgeType) ? REFLECTION_ALPHA.bridge : REFLECTION_ALPHA.normal;
}

/**
 * Check if a position should have a reflection rendered
 *
 * This is a quick check based on the reflection state.
 * The actual reflection state should be computed using
 * computeReflectionState from components/map/utils.
 *
 * @param reflectionState - Pre-computed reflection state
 * @returns true if reflection should be rendered
 */
export function shouldRenderReflection(reflectionState: ReflectionState | null): boolean {
  return reflectionState !== null && reflectionState.hasReflection;
}

/**
 * Create an initial/empty reflection state
 *
 * Use this when no reflection data is available.
 */
export function createEmptyReflectionState(): ReflectionState {
  return {
    hasReflection: false,
    reflectionType: null,
    bridgeType: 'none',
  };
}

// =============================================================================
// Generic Reflection Computation and Rendering
// =============================================================================

/**
 * Result from looking up reflection meta at a tile position.
 * Both WebGL and Canvas2D use this interface.
 */
export interface ReflectionMetaResult {
  behavior: number;
  meta: ReflectionMeta | null;
}

/**
 * Callback type for looking up reflection metadata at a tile.
 * Implementations differ between WebGL (snapshot-based) and Canvas2D (context-based).
 */
export type ReflectionMetaProvider = (tileX: number, tileY: number) => ReflectionMetaResult | null;

/**
 * Generic reflection state computation for any object.
 *
 * GBA checks BOTH currentCoords AND previousCoords for reflection detection.
 * See: event_object_movement.c ObjectEventGetNearbyReflectionType (lines 7625-7650)
 *
 * @param getReflectionMeta - Callback to get reflection meta at a tile
 * @param tileX - Object's current/destination tile X
 * @param tileY - Object's current/destination tile Y
 * @param prevTileX - Object's previous/origin tile X
 * @param prevTileY - Object's previous/origin tile Y
 * @param spriteWidth - Sprite width in pixels (default 16)
 * @param spriteHeight - Sprite height in pixels (default 32)
 */
export function computeReflectionState(
  getReflectionMeta: ReflectionMetaProvider,
  tileX: number,
  tileY: number,
  prevTileX: number,
  prevTileY: number,
  spriteWidth: number = 16,
  spriteHeight: number = 32
): ReflectionState {
  // Calculate how many tiles the sprite covers (GBA formula)
  const widthTiles = Math.max(1, (spriteWidth + 8) >> 4);
  const heightTiles = Math.max(1, (spriteHeight + 8) >> 4);

  let found: ReflectionType | null = null;

  // GBA scans tiles starting at y+1 (one tile below the object's anchor)
  // and continuing for 'height' tiles. It checks BOTH current AND previous coords.
  for (let i = 0; i < heightTiles && !found; i++) {
    const currentY = tileY + 1 + i;
    const prevY = prevTileY + 1 + i;

    // Check center tile at BOTH current and previous positions
    for (const [checkX, checkY] of [[tileX, currentY], [prevTileX, prevY]] as const) {
      const center = getReflectionMeta(checkX, checkY);
      if (center?.meta?.isReflective) {
        found = center.meta.reflectionType;
        break;
      }
    }
    if (found) break;

    // Check tiles to left and right at BOTH current and previous positions
    for (let j = 1; j < widthTiles && !found; j++) {
      const positions: [number, number][] = [
        [tileX + j, currentY], [tileX - j, currentY],
        [prevTileX + j, prevY], [prevTileX - j, prevY],
      ];
      for (const [x, y] of positions) {
        const info = getReflectionMeta(x, y);
        if (info?.meta?.isReflective) {
          found = info.meta.reflectionType;
          break;
        }
      }
    }
  }

  // Get bridge type - GBA checks previous behavior first, then current
  // See: field_effect_helpers.c LoadObjectReflectionPalette (lines 84-86)
  const prevInfo = getReflectionMeta(prevTileX, prevTileY);
  const currentInfo = getReflectionMeta(tileX, tileY);
  const prevBridgeType = prevInfo ? getBridgeTypeFromBehavior(prevInfo.behavior) : 'none';
  const currentBridgeType = currentInfo ? getBridgeTypeFromBehavior(currentInfo.behavior) : 'none';
  const bridgeType: BridgeType = prevBridgeType !== 'none' ? prevBridgeType : currentBridgeType;

  return {
    hasReflection: !!found,
    reflectionType: found,
    bridgeType,
  };
}

/**
 * Build a mask canvas for reflection rendering.
 * The mask determines which pixels show the reflection based on reflective tile areas.
 *
 * @param getReflectionMeta - Callback to get reflection meta at a tile
 * @param tileRefX - Reference X in world pixels (floored sprite position)
 * @param tileRefY - Reference Y in world pixels (reflection start position)
 * @param width - Sprite width
 * @param height - Sprite height
 * @returns Mask canvas where alpha=255 means show reflection
 */
export function buildReflectionMask(
  getReflectionMeta: ReflectionMetaProvider,
  tileRefX: number,
  tileRefY: number,
  width: number,
  height: number
): HTMLCanvasElement {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return maskCanvas;

  const maskImage = maskCtx.createImageData(width, height);
  const maskData = maskImage.data;

  // Calculate tile range for mask building
  const pixelStartTileX = Math.floor(tileRefX / METATILE_SIZE);
  const pixelEndTileX = Math.floor((tileRefX + width - 1) / METATILE_SIZE);
  const pixelStartTileY = Math.floor(tileRefY / METATILE_SIZE);
  const pixelEndTileY = Math.floor((tileRefY + height - 1) / METATILE_SIZE);

  // Expand range by 1 tile to catch tiles at boundaries during movement
  const startTileX = pixelStartTileX - 1;
  const endTileX = pixelEndTileX + 1;
  const startTileY = pixelStartTileY;
  const endTileY = pixelEndTileY + 1;

  // Build mask from reflective tiles
  for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      const info = getReflectionMeta(tx, ty);
      if (!info?.meta?.isReflective) continue;

      const mask = info.meta.pixelMask;
      const tileLeft = tx * METATILE_SIZE - tileRefX;
      const tileTop = ty * METATILE_SIZE - tileRefY;

      for (let y = 0; y < METATILE_SIZE; y++) {
        const globalY = tileTop + y;
        if (globalY < 0 || globalY >= height) continue;
        for (let x = 0; x < METATILE_SIZE; x++) {
          const globalX = tileLeft + x;
          if (globalX < 0 || globalX >= width) continue;
          if (mask[y * METATILE_SIZE + x]) {
            const index = (globalY * width + globalX) * 4 + 3;
            maskData[index] = 255;
          }
        }
      }
    }
  }

  maskCtx.putImageData(maskImage, 0, 0);
  return maskCanvas;
}

/**
 * Render a sprite reflection with mask, tint, and optional shimmer.
 *
 * This is the core rendering function shared between WebGL and Canvas2D.
 *
 * @param ctx - Canvas 2D rendering context
 * @param sprite - Sprite image
 * @param sx, sy, sw, sh - Source rectangle in sprite sheet
 * @param flip - Horizontal flip flag
 * @param screenX, screenY - Screen position for reflection
 * @param reflectionState - Computed reflection state
 * @param maskCanvas - Pre-built mask canvas
 * @param direction - Player direction (for shimmer)
 */
export function renderSpriteReflection(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement | HTMLImageElement,
  sx: number, sy: number, sw: number, sh: number,
  flip: boolean,
  screenX: number, screenY: number,
  reflectionState: ReflectionState,
  maskCanvas: HTMLCanvasElement,
  direction: 'up' | 'down' | 'left' | 'right' = 'down'
): void {
  // Create reflection canvas (flipped sprite)
  const reflectionCanvas = document.createElement('canvas');
  reflectionCanvas.width = sw;
  reflectionCanvas.height = sh;
  const reflectionCtx = reflectionCanvas.getContext('2d');
  if (!reflectionCtx) return;

  // Flip vertically
  reflectionCtx.translate(0, sh);
  reflectionCtx.scale(flip ? -1 : 1, -1);

  // Draw sprite
  reflectionCtx.drawImage(
    sprite,
    sx, sy, sw, sh,
    flip ? -sw : 0, 0, sw, sh
  );

  // Reset transform
  reflectionCtx.setTransform(1, 0, 0, 1, 0, 0);

  // Apply tint based on reflection type and bridge type
  reflectionCtx.globalCompositeOperation = 'source-atop';
  reflectionCtx.fillStyle = getReflectionTint(reflectionState.reflectionType, reflectionState.bridgeType);
  reflectionCtx.fillRect(0, 0, sw, sh);

  // Apply mask
  reflectionCtx.globalCompositeOperation = 'destination-in';
  reflectionCtx.drawImage(maskCanvas, 0, 0);

  // Draw to main canvas with transparency and shimmer effect
  ctx.save();
  ctx.globalAlpha = getReflectionAlpha(reflectionState.bridgeType);

  // Apply shimmer only for WATER reflections - GBA ice reflections don't shimmer
  if (reflectionState.reflectionType === 'water') {
    const shimmer = getGlobalShimmer();
    const matrixNum = ReflectionShimmer.getMatrixForDirection(direction, flip);
    const scaleX = shimmer.getScaleX(matrixNum);

    // Apply GBA-style affine transformation
    const shimmerCanvas = applyGbaAffineShimmer(reflectionCanvas, scaleX);
    ctx.drawImage(shimmerCanvas, screenX, screenY);
  } else {
    // Ice reflections don't shimmer
    ctx.drawImage(reflectionCanvas, screenX, screenY);
  }
  ctx.restore();
}
