import type { WorldCameraView } from '../../../rendering/types';

export interface TiledLayerRenderOptions {
  alpha?: number;
  scrollX?: number;
  scrollY?: number;
}

export class TiledLayerRenderer {
  render(
    ctx2d: CanvasRenderingContext2D,
    tile: HTMLCanvasElement,
    view: WorldCameraView,
    options?: TiledLayerRenderOptions
  ): void {
    const tileW = tile.width;
    const tileH = tile.height;
    if (tileW <= 0 || tileH <= 0) return;

    const scrollX = Math.floor(options?.scrollX ?? 0);
    const scrollY = Math.floor(options?.scrollY ?? 0);
    const alpha = options?.alpha ?? 1;

    const wrappedScrollX = ((scrollX % tileW) + tileW) % tileW;
    const wrappedScrollY = ((scrollY % tileH) + tileH) % tileH;

    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    const prevSmoothing = ctx2d.imageSmoothingEnabled;
    ctx2d.imageSmoothingEnabled = false;

    for (let drawY = -wrappedScrollY - tileH; drawY < view.pixelHeight + tileH; drawY += tileH) {
      for (let drawX = -wrappedScrollX - tileW; drawX < view.pixelWidth + tileW; drawX += tileW) {
        ctx2d.drawImage(tile, drawX, drawY);
      }
    }

    ctx2d.imageSmoothingEnabled = prevSmoothing;
    ctx2d.restore();
  }
}
