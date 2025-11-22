import type { PlayerController } from '../../../game/PlayerController';
import type { FieldEffectForRendering } from '../../../game/FieldEffectManager';
import { METATILE_SIZE } from '../../../utils/mapLoader';
import { getMetatileBehavior } from '../utils';
import type { RenderContext, ReflectionState } from '../types';

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
  arrow: HTMLImageElement | HTMLCanvasElement | null;
}

export interface ArrowOverlay {
  visible: boolean;
  worldX: number;
  worldY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  startedAt: number;
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
   * Render field effects (grass, sand footprints) with Y-sorting relative to player
   * 
   * @param layer - 'bottom' renders effects behind player, 'top' renders effects in front of player
   */
  static renderFieldEffects(
    ctx: CanvasRenderingContext2D,
    effects: FieldEffectForRendering[],
    sprites: SpriteCache,
    view: WorldCameraView,
    playerY: number,
    layer: 'bottom' | 'top'
  ): void {
    for (const effect of effects) {
      // Skip if not visible (for flickering effects like sand)
      if (!effect.visible) continue;

      // Select sprite based on effect type
      let sprite: HTMLCanvasElement | null = null;
      if (effect.type === 'tall') sprite = sprites.grass;
      else if (effect.type === 'long') sprite = sprites.longGrass;
      else if (effect.type === 'sand' || effect.type === 'deep_sand') sprite = sprites.sand;
      
      if (!sprite) continue;

      // Y-sorting:
      // Sand always renders behind player (bottom layer)
      // Grass effects use dynamic Y-sorting
      let isInFront = effect.worldY >= playerY;

      if (effect.type === 'sand' || effect.type === 'deep_sand') {
        // Sand footprints always render behind player
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

      // Each frame is 16x16 pixels
      const FRAME_SIZE = 16;
      const sx = effect.frame * FRAME_SIZE; // Frames are horizontal
      const sy = 0;

      // Calculate screen position
      // GBA sprites use center-based coordinates, but Canvas uses top-left corner
      // The FieldEffectManager returns center coordinates (tile*16 + 8)
      // We need to subtract 8 to convert to top-left corner for Canvas drawImage
      const screenX = Math.round(effect.worldX - view.cameraWorldX - 8);
      const screenY = Math.round(effect.worldY - view.cameraWorldY - 8);

      // Render sprite (with optional horizontal flip for East-facing sand)
      ctx.imageSmoothingEnabled = false;
      
      if (effect.flipHorizontal) {
        // Flip horizontally for East-facing sand footprints
        ctx.save();
        ctx.translate(screenX + FRAME_SIZE, screenY);
        ctx.scale(-1, 1);
        ctx.drawImage(
          sprite,
          sx,
          sy,
          FRAME_SIZE,
          FRAME_SIZE,
          0,
          0,
          FRAME_SIZE,
          FRAME_SIZE
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          sprite,
          sx,
          sy,
          FRAME_SIZE,
          FRAME_SIZE,
          screenX,
          screenY,
          FRAME_SIZE,
          FRAME_SIZE
        );
      }
    }
  }

  /**
   * Render water/ice reflection for the player
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
    const reflectionX = frame.renderX;
    const reflectionY = frame.renderY + height - 2 + BRIDGE_OFFSETS[reflectionState.bridgeType];
    const screenX = Math.round(reflectionX - view.cameraWorldX);
    const screenY = Math.round(reflectionY - view.cameraWorldY);

    // Create mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = frame.sw;
    maskCanvas.height = frame.sh;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    const maskImage = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
    const maskData = maskImage.data;

    // Build reflection mask from reflective tiles
    const startTileX = Math.floor(reflectionX / METATILE_SIZE);
    const endTileX = Math.floor((reflectionX + frame.sw - 1) / METATILE_SIZE);
    const startTileY = Math.floor(reflectionY / METATILE_SIZE);
    const endTileY = Math.floor((reflectionY + frame.sh - 1) / METATILE_SIZE);
    
    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const info = getMetatileBehavior(renderContext, tx, ty);
        if (!info?.meta?.isReflective) continue;
        const mask = info.meta.pixelMask;
        const tileLeft = tx * METATILE_SIZE - reflectionX;
        const tileTop = ty * METATILE_SIZE - reflectionY;
        for (let y = 0; y < METATILE_SIZE; y++) {
          const globalY = tileTop + y;
          if (globalY < 0 || globalY >= frame.sh) continue;
          for (let x = 0; x < METATILE_SIZE; x++) {
            const globalX = tileLeft + x;
            if (globalX < 0 || globalX >= frame.sw) continue;
            if (mask[y * METATILE_SIZE + x]) {
              const index = (globalY * frame.sw + globalX) * 4 + 3;
              maskData[index] = 255;
            }
          }
        }
      }
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
   * Render animated arrow overlay for arrow warps
   */
  static renderArrow(
    ctx: CanvasRenderingContext2D,
    overlay: ArrowOverlay,
    sprite: HTMLImageElement | HTMLCanvasElement | null,
    view: WorldCameraView,
    nowMs: number
  ): void {
    if (!overlay.visible || !sprite) return;

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
}
