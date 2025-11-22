import { METATILE_SIZE } from '../../../utils/mapLoader';
import { type WorldCameraView } from '../MapRenderer';

export interface DoorAnimationInstance {
  id: number;
  direction: 'open' | 'close';
  worldX: number;
  worldY: number;
  metatileId: number;
  startedAt: number;
  image: HTMLImageElement | HTMLCanvasElement;
  frameHeight: number;
  frameCount: number;
  frameDuration: number;
  holdOnComplete: boolean;
  size: number; // 1 for 1x2, 2 for 2x2
}

export class DoorRenderer {
  static renderAnimations(
    ctx: CanvasRenderingContext2D,
    view: WorldCameraView,
    animations: DoorAnimationInstance[],
    now: number
  ) {
    if (animations.length === 0) return;

    for (const anim of animations) {
      const totalDuration = anim.frameCount * anim.frameDuration;
      const elapsed = now - anim.startedAt;
      
      // Skip rendering if animation is done AND not held
      if (elapsed >= totalDuration && !anim.holdOnComplete) continue;
      
      // Clamp elapsed time to totalDuration when holding on complete
      const clampedElapsed = anim.holdOnComplete ? Math.min(elapsed, totalDuration - 1) : elapsed;
      const frameIndexRaw = Math.floor(clampedElapsed / anim.frameDuration);
      const frameIndex =
        anim.direction === 'open' ? frameIndexRaw : Math.max(0, anim.frameCount - 1 - frameIndexRaw);
      
      const sy = frameIndex * anim.frameHeight;
      const sw = anim.image.width;
      const sh = anim.frameHeight;
      const dx = Math.round(anim.worldX * METATILE_SIZE - view.cameraWorldX);
      const dy = Math.round((anim.worldY - 1) * METATILE_SIZE - view.cameraWorldY);
      const dw = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE;
      const dh = anim.size === 2 ? METATILE_SIZE * 2 : METATILE_SIZE * 2;
      
      ctx.drawImage(anim.image, 0, sy, sw, sh, dx, dy, dw, dh);
    }
  }
}
