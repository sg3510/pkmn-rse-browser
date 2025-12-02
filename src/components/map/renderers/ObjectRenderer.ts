import type { PlayerController } from '../../../game/PlayerController';
import type { FieldEffectForRendering } from '../../../game/FieldEffectManager';
import type { ItemBallObject } from '../../../types/objectEvents';
import { METATILE_SIZE } from '../../../utils/mapLoader';
import { getMetatileBehavior } from '../utils';
import type { RenderContext, ReflectionState } from '../types';
import {
  BRIDGE_OFFSETS,
  buildReflectionMask,
  renderSpriteReflection,
  type ReflectionMetaProvider,
} from '../../../field/ReflectionRenderer';
import {
  shouldRenderInLayer,
  getFieldEffectDimensions,
  getFieldEffectYOffset,
} from '../../../rendering/fieldEffectUtils';
import {
  ARROW_FRAME_SIZE,
  getArrowAnimationFrame,
  getArrowAtlasCoords,
} from '../../../field/ArrowAnimationConstants';


export interface WorldCameraView {
  cameraWorldX: number;
  cameraWorldY: number;
  pixelWidth: number;
  pixelHeight: number;
}

interface SpriteCache {
  grass: HTMLCanvasElement | null;
  longGrass: HTMLCanvasElement | null;
  sand: HTMLCanvasElement | null;
  splash: HTMLCanvasElement | null;
  ripple: HTMLCanvasElement | null;
  arrow: HTMLImageElement | HTMLCanvasElement | null;
  itemBall: HTMLImageElement | HTMLCanvasElement | null;
}

export interface ArrowOverlay {
  visible: boolean;
  worldX: number;
  worldY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  startedAt: number;
}

/**
 * Generic sprite frame info for reflection rendering
 * Used by both player and NPCs
 */
export interface SpriteFrameInfo {
  sprite: HTMLCanvasElement | HTMLImageElement;
  sx: number;  // Source X in sprite sheet
  sy: number;  // Source Y in sprite sheet
  sw: number;  // Source width
  sh: number;  // Source height
  flip: boolean;  // Horizontal flip (for east-facing)
  worldX: number;  // World pixel X (top-left of sprite)
  worldY: number;  // World pixel Y (top-left of sprite)
  tileX: number;   // Tile X position (for reflection detection)
  tileY: number;   // Tile Y position (for reflection detection)
}

/**
 * ObjectRenderer - Centralized rendering for all dynamic game objects
 * 
 * Renders:
 * - Field effects (grass, sand) with Y-sorting
 * - Water/ice reflections
 * - Arrow overlays
 */
export class ObjectRenderer {
  /**
   * Render field effects (grass, sand footprints, water ripples) with Y-sorting relative to player
   *
   * Water ripples are clipped to only show on water pixels using the same pixel mask
   * system as reflections. This matches GBA behavior where ripples only appear on the
   * blue/water portion of tiles, not on land edges.
   *
   * @param layer - 'bottom' renders effects behind player, 'top' renders effects in front of player
   * @param renderContext - Optional render context for water pixel masking (required for ripples)
   */
  static renderFieldEffects(
    ctx: CanvasRenderingContext2D,
    effects: FieldEffectForRendering[],
    sprites: SpriteCache,
    view: WorldCameraView,
    playerY: number,
    layer: 'bottom' | 'top',
    renderContext?: RenderContext
  ): void {
    for (const effect of effects) {
      // Use shared utility to check if effect should render in this layer
      if (!shouldRenderInLayer(effect, playerY, layer)) continue;

      // Select sprite based on effect type
      let sprite: HTMLCanvasElement | null = null;
      if (effect.type === 'tall') sprite = sprites.grass;
      else if (effect.type === 'long') sprite = sprites.longGrass;
      else if (effect.type === 'sand' || effect.type === 'deep_sand') sprite = sprites.sand;
      else if (effect.type === 'puddle_splash') sprite = sprites.splash;
      else if (effect.type === 'water_ripple') sprite = sprites.ripple;

      if (!sprite) continue;

      // Get dimensions from shared utility
      const { width: frameWidth, height: frameHeight } = getFieldEffectDimensions(effect.type);

      const sx = effect.frame * frameWidth; // Frames are horizontal
      const sy = 0;

      // Calculate screen position
      // GBA sprites use center-based coordinates, but Canvas uses top-left corner
      // The FieldEffectManager returns center coordinates (tile*16 + 8)
      // We need to subtract half the frame size to convert to top-left corner
      const screenX = Math.round(effect.worldX - view.cameraWorldX - frameWidth / 2);

      // Y offset from shared utility (water effects are offset downward to appear at feet)
      const yOffset = getFieldEffectYOffset(effect.type);
      const screenY = Math.round(effect.worldY - view.cameraWorldY + yOffset - frameHeight / 2);

      // Render sprite (with optional horizontal flip for East-facing sand)
      ctx.imageSmoothingEnabled = false;

      // Water ripples and puddle splashes need to be clipped to water pixels only
      // This matches GBA behavior where these effects only show on the blue/water portion of tiles
      // If the effect extends into adjacent tiles that are also water, allow the spillover
      if ((effect.type === 'water_ripple' || effect.type === 'puddle_splash') && renderContext) {
        // Create a temporary canvas for the masked ripple
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frameWidth;
        tempCanvas.height = frameHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          // Draw the ripple frame to temp canvas
          tempCtx.imageSmoothingEnabled = false;
          tempCtx.drawImage(
            sprite,
            sx,
            sy,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          // Get the image data to apply mask
          const imageData = tempCtx.getImageData(0, 0, frameWidth, frameHeight);
          const data = imageData.data;

          // Effect world position (top-left of sprite)
          const effectWorldX = effect.worldX - frameWidth / 2;
          // Y offset: ripple is 6px below sprite center, splash is 4px
          const yOffset = effect.type === 'puddle_splash' ? 4 : 6;
          const effectWorldY = effect.worldY + yOffset - frameHeight / 2;

          // Cache tile info lookups to avoid repeated calls for same tile
          const tileCache = new Map<string, { mask: Uint8Array | null }>();
          const getTileMask = (tx: number, ty: number): Uint8Array | null => {
            const key = `${tx},${ty}`;
            if (tileCache.has(key)) {
              return tileCache.get(key)!.mask;
            }
            const info = getMetatileBehavior(renderContext, tx, ty);
            const mask = info?.meta?.pixelMask ?? null;
            tileCache.set(key, { mask });
            return mask;
          };

          // For each pixel in the sprite, check if it overlaps with a water pixel
          // Check the actual tile that pixel falls on (may be different from center tile)
          for (let py = 0; py < frameHeight; py++) {
            for (let px = 0; px < frameWidth; px++) {
              // World position of this sprite pixel
              const worldPx = effectWorldX + px;
              const worldPy = effectWorldY + py;

              // Which tile does this pixel fall on?
              const pixelTileX = Math.floor(worldPx / METATILE_SIZE);
              const pixelTileY = Math.floor(worldPy / METATILE_SIZE);

              // Get the mask for this tile
              const mask = getTileMask(pixelTileX, pixelTileY);

              // Position within that tile (0-15)
              const tileLocalX = Math.floor(worldPx - pixelTileX * METATILE_SIZE);
              const tileLocalY = Math.floor(worldPy - pixelTileY * METATILE_SIZE);

              // Check if this pixel is a water pixel in its tile
              let isWater = false;
              if (mask &&
                  tileLocalX >= 0 && tileLocalX < METATILE_SIZE &&
                  tileLocalY >= 0 && tileLocalY < METATILE_SIZE) {
                isWater = mask[tileLocalY * METATILE_SIZE + tileLocalX] === 1;
              }

              // If not water, make pixel transparent
              if (!isWater) {
                const idx = (py * frameWidth + px) * 4;
                data[idx + 3] = 0; // Set alpha to 0
              }
            }
          }

          tempCtx.putImageData(imageData, 0, 0);

          // Draw the masked ripple to main canvas
          ctx.drawImage(tempCanvas, screenX, screenY);
        }
      } else if (effect.flipHorizontal) {
        // Flip horizontally for East-facing sand footprints
        ctx.save();
        ctx.translate(screenX + frameWidth, screenY);
        ctx.scale(-1, 1);
        ctx.drawImage(
          sprite,
          sx,
          sy,
          frameWidth,
          frameHeight,
          0,
          0,
          frameWidth,
          frameHeight
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          sprite,
          sx,
          sy,
          frameWidth,
          frameHeight,
          screenX,
          screenY,
          frameWidth,
          frameHeight
        );
      }
    }
  }

  /**
   * Render a single field effect (used when layer filtering is done by caller)
   *
   * This function is used by useCompositeScene when effects are pre-filtered
   * by SpriteBatcher.getEffectsForLayer() to ensure both renderers use
   * identical sorting logic.
   */
  static renderSingleFieldEffect(
    ctx: CanvasRenderingContext2D,
    effect: FieldEffectForRendering,
    sprites: SpriteCache,
    view: WorldCameraView,
    renderContext?: RenderContext
  ): void {
    if (!effect.visible) return;

    // Select sprite based on effect type
    let sprite: HTMLCanvasElement | null = null;
    if (effect.type === 'tall') sprite = sprites.grass;
    else if (effect.type === 'long') sprite = sprites.longGrass;
    else if (effect.type === 'sand' || effect.type === 'deep_sand') sprite = sprites.sand;
    else if (effect.type === 'puddle_splash') sprite = sprites.splash;
    else if (effect.type === 'water_ripple') sprite = sprites.ripple;

    if (!sprite) return;

    // Get dimensions from shared utility
    const { width: frameWidth, height: frameHeight } = getFieldEffectDimensions(effect.type);

    const sx = effect.frame * frameWidth;
    const sy = 0;

    // Calculate screen position
    const screenX = Math.round(effect.worldX - view.cameraWorldX - frameWidth / 2);
    const yOffset = getFieldEffectYOffset(effect.type);
    const screenY = Math.round(effect.worldY - view.cameraWorldY + yOffset - frameHeight / 2);

    ctx.imageSmoothingEnabled = false;

    // Water effects need masking (same logic as renderFieldEffects)
    if ((effect.type === 'water_ripple' || effect.type === 'puddle_splash') && renderContext) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = frameWidth;
      tempCanvas.height = frameHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.drawImage(sprite, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);

        const imageData = tempCtx.getImageData(0, 0, frameWidth, frameHeight);
        const data = imageData.data;

        const effectWorldX = effect.worldX - frameWidth / 2;
        const maskYOffset = effect.type === 'puddle_splash' ? 4 : 6;
        const effectWorldY = effect.worldY + maskYOffset - frameHeight / 2;

        const tileCache = new Map<string, { mask: Uint8Array | null }>();
        const getTileMask = (tx: number, ty: number): Uint8Array | null => {
          const key = `${tx},${ty}`;
          if (tileCache.has(key)) return tileCache.get(key)!.mask;
          const info = getMetatileBehavior(renderContext, tx, ty);
          const mask = info?.meta?.pixelMask ?? null;
          tileCache.set(key, { mask });
          return mask;
        };

        for (let py = 0; py < frameHeight; py++) {
          for (let px = 0; px < frameWidth; px++) {
            const worldPx = effectWorldX + px;
            const worldPy = effectWorldY + py;
            const pixelTileX = Math.floor(worldPx / METATILE_SIZE);
            const pixelTileY = Math.floor(worldPy / METATILE_SIZE);
            const mask = getTileMask(pixelTileX, pixelTileY);
            const tileLocalX = Math.floor(worldPx - pixelTileX * METATILE_SIZE);
            const tileLocalY = Math.floor(worldPy - pixelTileY * METATILE_SIZE);

            let isWater = false;
            if (mask && tileLocalX >= 0 && tileLocalX < METATILE_SIZE &&
                tileLocalY >= 0 && tileLocalY < METATILE_SIZE) {
              isWater = mask[tileLocalY * METATILE_SIZE + tileLocalX] === 1;
            }
            if (!isWater) {
              const idx = (py * frameWidth + px) * 4;
              data[idx + 3] = 0;
            }
          }
        }
        tempCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, screenX, screenY);
      }
    } else if (effect.flipHorizontal) {
      ctx.save();
      ctx.translate(screenX + frameWidth, screenY);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, sx, sy, frameWidth, frameHeight, screenX, screenY, frameWidth, frameHeight);
    }
  }

  /**
   * Render water/ice reflection for the player using shared reflection functions.
   *
   * Uses shared buildReflectionMask and renderSpriteReflection from ReflectionRenderer.
   */
  static renderReflection(
    ctx: CanvasRenderingContext2D,
    player: PlayerController,
    reflectionState: ReflectionState,
    view: WorldCameraView,
    renderContext: RenderContext
  ): void {
    if (!reflectionState.hasReflection) return;

    const frame = player.getFrameInfo();
    if (!frame || !frame.sprite) return;

    const { height } = player.getSpriteSize();

    // For TILE LOOKUP: Use floored world positions to prevent flickering at tile boundaries
    const tileRefX = Math.floor(frame.renderX);
    const tileRefY = Math.floor(frame.renderY) + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];

    // For SCREEN RENDERING: Use Math.round() for consistent pixel alignment
    const reflectionWorldY = frame.renderY + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];
    const screenX = Math.round(frame.renderX - view.cameraWorldX);
    const screenY = Math.round(reflectionWorldY - view.cameraWorldY);

    // Create provider callback for RenderContext-based tile lookup
    const provider: ReflectionMetaProvider = (x, y) => getMetatileBehavior(renderContext, x, y);

    // Build mask using shared function
    const maskCanvas = buildReflectionMask(provider, tileRefX, tileRefY, frame.sw, frame.sh);

    // Render using shared function (uses GBA-accurate tints and shimmer)
    renderSpriteReflection(
      ctx,
      frame.sprite,
      frame.sx, frame.sy, frame.sw, frame.sh,
      frame.flip,
      screenX, screenY,
      reflectionState,
      maskCanvas,
      player.dir
    );
  }

  /**
   * Generic reflection rendering for any sprite (player, NPC, etc.)
   * Uses shared buildReflectionMask and renderSpriteReflection from ReflectionRenderer.
   *
   * @param ctx - Canvas context to draw to
   * @param frameInfo - Sprite frame information
   * @param reflectionState - Reflection state (hasReflection, type, bridge)
   * @param view - Camera/viewport info
   * @param renderContext - Render context for tile masks
   */
  static renderObjectReflection(
    ctx: CanvasRenderingContext2D,
    frameInfo: SpriteFrameInfo,
    reflectionState: ReflectionState,
    view: WorldCameraView,
    renderContext: RenderContext
  ): void {
    if (!reflectionState.hasReflection) return;

    const { sprite, sx, sy, sw, sh, flip, worldX, worldY } = frameInfo;

    // Calculate reflection Y position: sprite bottom - 2 + bridge offset
    const reflectionWorldY = worldY + sh - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];

    // For TILE LOOKUP: Use floored world positions to prevent flickering
    const tileRefX = Math.floor(worldX);
    const tileRefY = Math.floor(reflectionWorldY);

    // For SCREEN RENDERING: Use Math.round() for consistent pixel alignment
    const screenX = Math.round(worldX - view.cameraWorldX);
    const screenY = Math.round(reflectionWorldY - view.cameraWorldY);

    // Create provider callback for RenderContext-based tile lookup
    const provider: ReflectionMetaProvider = (x, y) => getMetatileBehavior(renderContext, x, y);

    // Build mask using shared function
    const maskCanvas = buildReflectionMask(provider, tileRefX, tileRefY, sw, sh);

    // Render using shared function (uses GBA-accurate tints and shimmer)
    // Note: NPCs use 'down' direction for shimmer matrix selection
    renderSpriteReflection(
      ctx,
      sprite,
      sx, sy, sw, sh,
      flip,
      screenX, screenY,
      reflectionState,
      maskCanvas,
      'down'
    );
  }

  /**
   * Render animated arrow overlay for arrow warps
   */
  static renderArrow(
    ctx: CanvasRenderingContext2D,
    overlay: ArrowOverlay,
    sprite: HTMLImageElement | HTMLCanvasElement,
    view: WorldCameraView,
    nowMs: number
  ): void {
    if (!overlay.visible) return;

    // Use shared arrow animation constants
    const framesPerRow = Math.max(1, Math.floor(sprite.width / ARROW_FRAME_SIZE));
    const elapsed = nowMs - overlay.startedAt;
    const frameIndex = getArrowAnimationFrame(overlay.direction, elapsed);
    const { atlasX: sx, atlasY: sy } = getArrowAtlasCoords(frameIndex, framesPerRow);
    const dx = Math.round(overlay.worldX * METATILE_SIZE - view.cameraWorldX);
    const dy = Math.round(overlay.worldY * METATILE_SIZE - view.cameraWorldY);
    ctx.drawImage(sprite, sx, sy, ARROW_FRAME_SIZE, ARROW_FRAME_SIZE, dx, dy, ARROW_FRAME_SIZE, ARROW_FRAME_SIZE);
  }

  /**
   * Render item balls on the map with Y-sorting relative to player
   *
   * Item balls are rendered as 16x16 sprites at their tile positions.
   * They use Y-sorting: items above the player render behind, items at or below render in front.
   *
   * @param layer - 'bottom' renders items behind player, 'top' renders items in front of player
   */
  static renderItemBalls(
    ctx: CanvasRenderingContext2D,
    itemBalls: ItemBallObject[],
    sprite: HTMLImageElement | HTMLCanvasElement | null,
    view: WorldCameraView,
    playerTileY: number,
    layer: 'bottom' | 'top'
  ): void {
    if (!sprite || itemBalls.length === 0) return;

    const frameSize = 16;

    for (const item of itemBalls) {
      // Y-sorting: items at Y < playerY are behind (bottom layer)
      // Items at Y >= playerY are in front (top layer)
      const isInFront = item.tileY >= playerTileY;

      // Filter by layer
      if (layer === 'bottom' && isInFront) continue;
      if (layer === 'top' && !isInFront) continue;

      // Convert tile coordinates to world pixel coordinates
      // Item balls are centered on their tile
      const worldX = item.tileX * METATILE_SIZE;
      const worldY = item.tileY * METATILE_SIZE;

      // Calculate screen position
      const screenX = Math.round(worldX - view.cameraWorldX);
      const screenY = Math.round(worldY - view.cameraWorldY);

      // Skip if off-screen
      if (
        screenX + frameSize < 0 ||
        screenX > view.pixelWidth ||
        screenY + frameSize < 0 ||
        screenY > view.pixelHeight
      ) {
        continue;
      }

      // Draw the item ball sprite (single frame, no animation)
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, 0, 0, frameSize, frameSize, screenX, screenY, frameSize, frameSize);
    }
  }
}



