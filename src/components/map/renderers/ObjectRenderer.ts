import type { PlayerController } from '../../../game/PlayerController';
import type { FieldEffectForRendering } from '../../../game/FieldEffectManager';
import type { ItemBallObject } from '../../../types/objectEvents';
import { METATILE_SIZE } from '../../../utils/mapLoader';
import { getMetatileBehavior } from '../utils';
import type { RenderContext, ReflectionState } from '../types';

const DEBUG_REFLECTION_FLAG = 'PKMN_DEBUG_REFLECTION';
function isReflectionDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_REFLECTION_FLAG];
}

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

// Bridge offsets for reflections
const BRIDGE_OFFSETS: Record<'none' | 'pondLow' | 'pondMed' | 'pondHigh', number> = {
  none: 0,
  pondLow: 2,
  pondMed: 4,
  pondHigh: 6,
};

// Arrow animation constants
// GBA uses 32 ticks @ 60fps ≈ 533ms per frame
const ARROW_FRAME_SIZE = 16;
const ARROW_FRAME_DURATION_MS = 533;
const ARROW_FRAME_SEQUENCES: Record<'up' | 'down' | 'left' | 'right', number[]> = {
  down: [3, 7],
  up: [0, 4],
  left: [1, 5],
  right: [2, 6],
};

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
      // Skip if not visible (for flickering effects like sand)
      if (!effect.visible) continue;

      // Select sprite based on effect type
      let sprite: HTMLCanvasElement | null = null;
      if (effect.type === 'tall') sprite = sprites.grass;
      else if (effect.type === 'long') sprite = sprites.longGrass;
      else if (effect.type === 'sand' || effect.type === 'deep_sand') sprite = sprites.sand;
      else if (effect.type === 'puddle_splash') sprite = sprites.splash;
      else if (effect.type === 'water_ripple') sprite = sprites.ripple;

      if (!sprite) continue;

      // Y-sorting:
      // Sand, puddle splashes, and water ripples always render behind player (bottom layer)
      // Grass effects use dynamic Y-sorting
      let isInFront = effect.worldY >= playerY;

      if (effect.type === 'sand' || effect.type === 'deep_sand' ||
          effect.type === 'puddle_splash' || effect.type === 'water_ripple') {
        // Sand footprints, puddle splashes, and ripples always render behind player
        // They appear at the player's feet level
        isInFront = false;
      } else {
        // Dynamic layering from subpriority (for tall grass)
        // If subpriority offset is high (4), it means "lower priority" relative to player, so render BEHIND.
        if (effect.subpriorityOffset > 0) {
          isInFront = false;
        }
      }

      // Filter by layer
      if (layer === 'bottom' && isInFront) continue;
      if (layer === 'top' && !isInFront) continue;

      // Frame dimensions depend on effect type
      // Most effects are 16x16, but splash is 16x8
      let frameWidth = 16;
      let frameHeight = 16;
      if (effect.type === 'puddle_splash') {
        frameWidth = 16;
        frameHeight = 8;
      }
      // water_ripple is 16x16 (default, no change needed)

      const sx = effect.frame * frameWidth; // Frames are horizontal
      const sy = 0;

      // Calculate screen position
      // GBA sprites use center-based coordinates, but Canvas uses top-left corner
      // The FieldEffectManager returns center coordinates (tile*16 + 8)
      // We need to subtract half the frame size to convert to top-left corner
      const screenX = Math.round(effect.worldX - view.cameraWorldX - frameWidth / 2);

      // Y positioning based on C code analysis:
      // - Ripple: sprite->y + (height/2) - 2 = positioned 6px down from sprite center (at feet)
      // - Splash: y2 = (height/2) - 4 = positioned 4px down from sprite center (at feet)
      //
      // For 16px player sprite centered at tile:
      // - worldY is tile center (tile*16 + 8)
      // - Player feet are at worldY + 8 (bottom of tile)
      // - Ripple should appear 2px above feet: worldY + 8 - 2 = worldY + 6
      // - Splash should appear 4px above feet: worldY + 8 - 4 = worldY + 4
      //
      // Since we're drawing from top-left corner and sprite is centered:
      // screenY = worldY + offset - (frameHeight / 2) for center-based
      let screenY: number;
      if (effect.type === 'water_ripple') {
        // Ripple: 6px down from sprite center, then offset by half frame height
        // From C: gFieldEffectArguments[1] = sprite->y + (graphicsInfo->height >> 1) - 2
        // For 16px sprite: height/2 - 2 = 6, so effect is at sprite.y + 6
        // worldY is tile center, so effect world position = worldY + 6
        // Then convert to screen top-left: screenY = (worldY + 6) - cameraY - frameHeight/2
        screenY = Math.round(effect.worldY - view.cameraWorldY + 6 - frameHeight / 2);
      } else if (effect.type === 'puddle_splash') {
        // Splash: 4px down from sprite center, then offset by half frame height
        // From C: sprite->y2 = (graphicsInfo->height >> 1) - 4
        // For 16px sprite: height/2 - 4 = 4, so effect is at sprite.y + 4
        // worldY is tile center, so effect world position = worldY + 4
        // Then convert to screen top-left: screenY = (worldY + 4) - cameraY - frameHeight/2
        screenY = Math.round(effect.worldY - view.cameraWorldY + 4 - frameHeight / 2);
      } else {
        screenY = Math.round(effect.worldY - view.cameraWorldY - frameHeight / 2);
      }

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
   * Render water/ice reflection for the player
   *
   * BUG FIX: During movement, floating-point pixel positions can cause the reflection
   * to flicker when crossing tile boundaries. The tile lookup uses floor(pos / METATILE_SIZE),
   * so sub-pixel positions can cause inconsistent tile selection frame-to-frame.
   *
   * Solution: Floor the pixel positions for tile lookups to ensure stable tile selection.
   * Screen rendering still uses rounded positions for smooth visual placement.
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

    // For TILE LOOKUP: Use floored world positions to prevent flickering at tile boundaries.
    // The tile lookup uses floor(pos / METATILE_SIZE), so float positions can cause
    // the reflection to flicker between tiles when crossing boundaries.
    const tileRefX = Math.floor(frame.renderX);
    const tileRefY = Math.floor(frame.renderY) + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];

    // For SCREEN RENDERING: Use Math.round() to avoid floating-point precision errors.
    // This matches PlayerController.render() which also uses Math.round().
    const reflectionWorldY = frame.renderY + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];
    const screenX = Math.round(frame.renderX - view.cameraWorldX);
    const screenY = Math.round(reflectionWorldY - view.cameraWorldY);

    // Create mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = frame.sw;
    maskCanvas.height = frame.sh;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    const maskImage = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
    const maskData = maskImage.data;

    // Build reflection mask from reflective tiles
    // CRITICAL: The player sprite may be offset from tile alignment (e.g., 32px surfing sprite
    // centered on 16px tile = 8px offset). During movement, this offset causes the pixel-based
    // tile range to differ from what computeReflectionState checked (which uses discrete tileX/Y).
    //
    // To ensure coverage, we expand the tile range to include:
    // 1. All tiles the sprite visually covers at its current pixel position
    // 2. Adjacent tiles that computeReflectionState would have checked
    const pixelStartTileX = Math.floor(tileRefX / METATILE_SIZE);
    const pixelEndTileX = Math.floor((tileRefX + frame.sw - 1) / METATILE_SIZE);
    const pixelStartTileY = Math.floor(tileRefY / METATILE_SIZE);
    const pixelEndTileY = Math.floor((tileRefY + frame.sh - 1) / METATILE_SIZE);

    // Expand range by 1 tile in each direction to catch tiles at boundaries during movement
    // This matches how computeReflectionState searches tiles around player.tileX/tileY
    const startTileX = pixelStartTileX - 1;
    const endTileX = pixelEndTileX + 1;
    const startTileY = pixelStartTileY;
    const endTileY = pixelEndTileY + 1;

    let maskPixelsSet = 0;
    let tilesChecked = 0;
    let reflectiveTiles = 0;

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        tilesChecked++;
        const info = getMetatileBehavior(renderContext, tx, ty);
        if (!info?.meta?.isReflective) {
          if (isReflectionDebugMode()) {
            console.log(`[REFLECTION] Tile (${tx}, ${ty}): NOT reflective - info:`, info ? { behavior: info.behavior, hasMetaA: !!info.meta } : 'null');
          }
          continue;
        }
        reflectiveTiles++;
        const mask = info.meta.pixelMask;
        // Use floored tileRefX/Y for consistent mask coordinate calculation
        const tileLeft = tx * METATILE_SIZE - tileRefX;
        const tileTop = ty * METATILE_SIZE - tileRefY;
        for (let y = 0; y < METATILE_SIZE; y++) {
          const globalY = tileTop + y;
          if (globalY < 0 || globalY >= frame.sh) continue;
          for (let x = 0; x < METATILE_SIZE; x++) {
            const globalX = tileLeft + x;
            if (globalX < 0 || globalX >= frame.sw) continue;
            if (mask[y * METATILE_SIZE + x]) {
              const index = (globalY * frame.sw + globalX) * 4 + 3;
              maskData[index] = 255;
              maskPixelsSet++;
            }
          }
        }
      }
    }

    if (isReflectionDebugMode()) {
      console.log(`[REFLECTION] player.tile=(${player.tileX}, ${player.tileY}), frame.render=(${frame.renderX.toFixed(1)}, ${frame.renderY.toFixed(1)}), tileRef=(${tileRefX}, ${tileRefY}), tileRange=X[${startTileX}-${endTileX}] Y[${startTileY}-${endTileY}], checked=${tilesChecked}, reflective=${reflectiveTiles}, maskPixels=${maskPixelsSet}`);
    }

    maskCtx.putImageData(maskImage, 0, 0);

    // Create reflection canvas (flipped sprite)
    const reflectionCanvas = document.createElement('canvas');
    reflectionCanvas.width = frame.sw;
    reflectionCanvas.height = frame.sh;
    const reflectionCtx = reflectionCanvas.getContext('2d');
    if (!reflectionCtx) return;
    reflectionCtx.clearRect(0, 0, frame.sw, frame.sh);
    reflectionCtx.save();
    reflectionCtx.translate(frame.flip ? frame.sw : 0, frame.sh);
    reflectionCtx.scale(frame.flip ? -1 : 1, -1);
    reflectionCtx.drawImage(
      frame.sprite,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      0,
      0,
      frame.sw,
      frame.sh
    );
    reflectionCtx.restore();

    // Apply tint
    reflectionCtx.globalCompositeOperation = 'source-atop';
    const baseTint =
      reflectionState.reflectionType === 'ice'
        ? 'rgba(180, 220, 255, 0.35)'
        : 'rgba(70, 120, 200, 0.35)';
    const bridgeTint = 'rgba(20, 40, 70, 0.55)';
    reflectionCtx.fillStyle = reflectionState.bridgeType === 'none' ? baseTint : bridgeTint;
    reflectionCtx.fillRect(0, 0, frame.sw, frame.sh);
    reflectionCtx.globalCompositeOperation = 'source-over';

    // Apply mask
    reflectionCtx.globalCompositeOperation = 'destination-in';
    reflectionCtx.drawImage(maskCanvas, 0, 0);
    reflectionCtx.globalCompositeOperation = 'source-over';

    // Draw to main canvas
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = reflectionState.bridgeType === 'none' ? 0.65 : 0.6;
    ctx.drawImage(reflectionCanvas, screenX, screenY);
    ctx.restore();
  }

  /**
   * Generic reflection rendering for any sprite (player, NPC, etc.)
   *
   * This implements the same reflection logic as the GBA:
   * - Vertically flipped sprite
   * - Positioned at sprite.y + height - 2 + bridgeOffset
   * - Blue/ice tint based on reflection type
   * - Masked to only show on reflective tile pixels (BG1 transparency)
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
    // This matches GBA: GetReflectionVerticalOffset() returns height - 2
    const reflectionWorldY = worldY + sh - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];

    // For TILE LOOKUP: Use floored world positions to prevent flickering at tile boundaries
    const tileRefX = Math.floor(worldX);
    const tileRefY = Math.floor(reflectionWorldY);

    // For SCREEN RENDERING: Use Math.round() to avoid floating-point precision errors
    const screenX = Math.round(worldX - view.cameraWorldX);
    const screenY = Math.round(reflectionWorldY - view.cameraWorldY);

    // Create mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = sw;
    maskCanvas.height = sh;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    const maskImage = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
    const maskData = maskImage.data;

    // Build reflection mask from reflective tiles
    const pixelStartTileX = Math.floor(tileRefX / METATILE_SIZE);
    const pixelEndTileX = Math.floor((tileRefX + sw - 1) / METATILE_SIZE);
    const pixelStartTileY = Math.floor(tileRefY / METATILE_SIZE);
    const pixelEndTileY = Math.floor((tileRefY + sh - 1) / METATILE_SIZE);

    // Expand range by 1 tile to catch tiles at boundaries during movement
    const startTileX = pixelStartTileX - 1;
    const endTileX = pixelEndTileX + 1;
    const startTileY = pixelStartTileY;
    const endTileY = pixelEndTileY + 1;

    let maskPixelsSet = 0;

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const info = getMetatileBehavior(renderContext, tx, ty);
        if (!info?.meta?.isReflective) continue;
        const mask = info.meta.pixelMask;
        const tileLeft = tx * METATILE_SIZE - tileRefX;
        const tileTop = ty * METATILE_SIZE - tileRefY;
        for (let y = 0; y < METATILE_SIZE; y++) {
          const globalY = tileTop + y;
          if (globalY < 0 || globalY >= sh) continue;
          for (let x = 0; x < METATILE_SIZE; x++) {
            const globalX = tileLeft + x;
            if (globalX < 0 || globalX >= sw) continue;
            if (mask[y * METATILE_SIZE + x]) {
              const index = (globalY * sw + globalX) * 4 + 3;
              maskData[index] = 255;
              maskPixelsSet++;
            }
          }
        }
      }
    }

    // Skip rendering if no mask pixels (nothing to show)
    if (maskPixelsSet === 0) return;

    maskCtx.putImageData(maskImage, 0, 0);

    // Create reflection canvas (flipped sprite)
    const reflectionCanvas = document.createElement('canvas');
    reflectionCanvas.width = sw;
    reflectionCanvas.height = sh;
    const reflectionCtx = reflectionCanvas.getContext('2d');
    if (!reflectionCtx) return;
    reflectionCtx.clearRect(0, 0, sw, sh);
    reflectionCtx.save();
    reflectionCtx.translate(flip ? sw : 0, sh);
    reflectionCtx.scale(flip ? -1 : 1, -1);
    reflectionCtx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);
    reflectionCtx.restore();

    // Apply tint
    reflectionCtx.globalCompositeOperation = 'source-atop';
    const baseTint =
      reflectionState.reflectionType === 'ice'
        ? 'rgba(180, 220, 255, 0.35)'
        : 'rgba(70, 120, 200, 0.35)';
    const bridgeTint = 'rgba(20, 40, 70, 0.55)';
    reflectionCtx.fillStyle = reflectionState.bridgeType === 'none' ? baseTint : bridgeTint;
    reflectionCtx.fillRect(0, 0, sw, sh);
    reflectionCtx.globalCompositeOperation = 'source-over';

    // Apply mask
    reflectionCtx.globalCompositeOperation = 'destination-in';
    reflectionCtx.drawImage(maskCanvas, 0, 0);
    reflectionCtx.globalCompositeOperation = 'source-over';

    // Draw to main canvas
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = reflectionState.bridgeType === 'none' ? 0.65 : 0.6;
    ctx.drawImage(reflectionCanvas, screenX, screenY);
    ctx.restore();
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

    const framesPerRow = Math.max(1, Math.floor(sprite.width / ARROW_FRAME_SIZE));
    const frameSequence = ARROW_FRAME_SEQUENCES[overlay.direction];
    const elapsed = nowMs - overlay.startedAt;
    const seqIndex = Math.floor(elapsed / ARROW_FRAME_DURATION_MS) % frameSequence.length;
    const frameIndex = frameSequence[seqIndex];
    const sx = (frameIndex % framesPerRow) * ARROW_FRAME_SIZE;
    const sy = Math.floor(frameIndex / framesPerRow) * ARROW_FRAME_SIZE;
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


