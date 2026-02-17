/**
 * Mirage Tower collapse runtime.
 *
 * C references:
 * - public/pokeemerald/src/mirage_tower.c (InitMirageTowerShake, DoMirageTowerDisintegration)
 * - public/pokeemerald/graphics/misc/mirage_tower.png
 * - public/pokeemerald/graphics/misc/mirage_tower.bin
 */

import type { WorldCameraView } from '../../rendering/types';
import { decodeGbaBgTilemap, drawGbaBgTilemap } from '../../rendering/gbaTilemap';
import { loadBinaryAsset, loadImageCanvasAsset } from '../../utils/assetLoader';

const TILE_PIXELS = 16;
const TILEMAP_TILE_PIXELS = 8;
const TOWER_TILEMAP_WIDTH_TILES = 6;
const TOWER_TILEMAP_HEIGHT_TILES = 12;
const TOWER_WIDTH_PX = TOWER_TILEMAP_WIDTH_TILES * TILEMAP_TILE_PIXELS;
const TOWER_HEIGHT_PX = TOWER_TILEMAP_HEIGHT_TILES * TILEMAP_TILE_PIXELS;

const OUTER_BUFFER_LENGTH = 0x60; // 96 rows
const INNER_BUFFER_LENGTH = 0x30; // 48 columns

const BG_SHAKE_INITIAL_OFFSET = 2;
const BG_SHAKE_DELAY_FRAMES = 2;

type MirageTowerPhase = 'idle' | 'shake' | 'disintegrating';

interface DisintegrationRowState {
  order: Uint8Array;
  idx: number;
}

export interface MirageTowerCollapseRenderState {
  active: boolean;
  canvas: HTMLCanvasElement;
  worldX: number;
  worldY: number;
  shakeX: number;
  dropOffsetY: number;
}

export class MirageTowerCollapseRuntime {
  private phase: MirageTowerPhase = 'idle';
  private assetsLoadPromise: Promise<void> | null = null;

  private towerCanvas: HTMLCanvasElement | null = null;
  private towerCtx: CanvasRenderingContext2D | null = null;
  private baseImageData: ImageData | null = null;
  private workingImageData: ImageData | null = null;

  private anchorWorldX = 0;
  private anchorWorldY = 0;
  private bgShakeX = 0;
  private bgShakeDelay = 0;
  private bgDropOffsetY = 0;

  private spawnCounter = 0;
  private rowsStarted = 0;
  private rowsCompleted = 0;
  private disintegrationRows: Array<DisintegrationRowState | null> = new Array(OUTER_BUFFER_LENGTH).fill(null);

  private disintegrationWaiters = new Set<() => void>();

  async startShake(anchorWorldX: number, anchorWorldY: number): Promise<void> {
    await this.ensureAssetsLoaded();
    if (!this.towerCanvas || !this.towerCtx || !this.baseImageData) {
      return;
    }

    this.anchorWorldX = anchorWorldX;
    this.anchorWorldY = anchorWorldY;
    this.bgShakeX = BG_SHAKE_INITIAL_OFFSET;
    this.bgShakeDelay = 0;
    this.bgDropOffsetY = 0;
    this.phase = 'shake';
    this.resetDisintegrationState();
    this.resetWorkingImage();
  }

  async startDisintegration(): Promise<void> {
    await this.ensureAssetsLoaded();
    if (!this.towerCanvas || !this.towerCtx || !this.baseImageData) {
      return;
    }

    if (this.phase === 'idle') {
      this.bgShakeX = BG_SHAKE_INITIAL_OFFSET;
      this.bgShakeDelay = 0;
      this.bgDropOffsetY = 0;
      this.resetWorkingImage();
    }

    this.phase = 'disintegrating';
    this.resetDisintegrationState();

    return new Promise<void>((resolve) => {
      this.disintegrationWaiters.add(resolve);
    });
  }

  update(frames: number): void {
    if (frames <= 0 || this.phase === 'idle') {
      return;
    }
    if (!this.towerCtx || !this.workingImageData) {
      return;
    }

    for (let i = 0; i < frames; i++) {
      this.updateBgShakeOffsets();
      if (this.phase === 'disintegrating') {
        this.updateDisintegrationFrame();
      }
    }
  }

  render(
    ctx2d: CanvasRenderingContext2D,
    view: WorldCameraView,
    targetWidth: number,
    targetHeight: number,
  ): void {
    const state = this.getRenderState();
    if (!state) {
      return;
    }

    const safeViewWidth = Math.max(1, view.pixelWidth);
    const safeViewHeight = Math.max(1, view.pixelHeight);
    const scaleX = targetWidth / safeViewWidth;
    const scaleY = targetHeight / safeViewHeight;

    const screenX = state.worldX - view.cameraWorldX + state.shakeX;
    const screenY = state.worldY - view.cameraWorldY + state.dropOffsetY;
    const destX = Math.round(screenX * scaleX);
    const destY = Math.round(screenY * scaleY);
    const destW = Math.max(1, Math.round(TOWER_WIDTH_PX * scaleX));
    const destH = Math.max(1, Math.round(TOWER_HEIGHT_PX * scaleY));

    ctx2d.save();
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(state.canvas, destX, destY, destW, destH);
    ctx2d.restore();
  }

  clear(): void {
    this.phase = 'idle';
    this.bgShakeX = 0;
    this.bgDropOffsetY = 0;
    this.resetDisintegrationState();
    this.resolveDisintegrationWaiters();
  }

  getRenderState(): MirageTowerCollapseRenderState | null {
    if (this.phase === 'idle' || !this.towerCanvas) {
      return null;
    }

    return {
      active: true,
      canvas: this.towerCanvas,
      worldX: this.anchorWorldX,
      worldY: this.anchorWorldY,
      shakeX: this.bgShakeX,
      dropOffsetY: this.bgDropOffsetY,
    };
  }

  private async ensureAssetsLoaded(): Promise<void> {
    if (this.baseImageData && this.towerCanvas && this.towerCtx) {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }

    if (!this.assetsLoadPromise) {
      this.assetsLoadPromise = this.loadAssets();
    }
    await this.assetsLoadPromise;
  }

  private async loadAssets(): Promise<void> {
    const [towerTilesCanvas, tilemapBuffer] = await Promise.all([
      loadImageCanvasAsset('/pokeemerald/graphics/misc/mirage_tower.png', {
        transparency: { type: 'top-left' },
      }),
      loadBinaryAsset('/pokeemerald/graphics/misc/mirage_tower.bin'),
    ]);

    if (typeof document === 'undefined') {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = TOWER_WIDTH_PX;
    canvas.height = TOWER_HEIGHT_PX;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;

    const tilemapEntries = decodeGbaBgTilemap(tilemapBuffer);
    drawGbaBgTilemap(ctx, towerTilesCanvas, tilemapEntries, {
      mapWidthTiles: TOWER_TILEMAP_WIDTH_TILES,
      mapHeightTiles: TOWER_TILEMAP_HEIGHT_TILES,
      tileSize: TILEMAP_TILE_PIXELS,
      visibleWidthPx: TOWER_WIDTH_PX,
      visibleHeightPx: TOWER_HEIGHT_PX,
      transparency: { type: 'top-left' },
    });

    this.towerCanvas = canvas;
    this.towerCtx = ctx;
    this.baseImageData = ctx.getImageData(0, 0, TOWER_WIDTH_PX, TOWER_HEIGHT_PX);
    this.resetWorkingImage();
  }

  private resetWorkingImage(): void {
    if (!this.towerCtx || !this.baseImageData) {
      return;
    }

    this.workingImageData = new ImageData(
      new Uint8ClampedArray(this.baseImageData.data),
      this.baseImageData.width,
      this.baseImageData.height
    );
    this.towerCtx.putImageData(this.workingImageData, 0, 0);
  }

  private resetDisintegrationState(): void {
    this.spawnCounter = 0;
    this.rowsStarted = 0;
    this.rowsCompleted = 0;
    this.disintegrationRows = new Array(OUTER_BUFFER_LENGTH).fill(null);
  }

  private updateBgShakeOffsets(): void {
    if (this.bgShakeDelay <= 0) {
      this.bgShakeX = -this.bgShakeX;
      this.bgShakeDelay = BG_SHAKE_DELAY_FRAMES;
      return;
    }
    this.bgShakeDelay--;
  }

  private updateDisintegrationFrame(): void {
    if (!this.towerCtx || !this.workingImageData) {
      return;
    }

    if (this.rowsStarted <= OUTER_BUFFER_LENGTH - 1) {
      if (this.spawnCounter > 1) {
        const rowIndex = this.rowsStarted;
        this.disintegrationRows[rowIndex] = {
          order: this.createShuffledRowOrder(),
          idx: 0,
        };
        this.rowsStarted++;
        this.spawnCounter = 0;
      }
      this.spawnCounter++;
    }

    let hasPixelChanges = false;
    const startIndex = this.rowsCompleted;
    for (let rowIndex = startIndex; rowIndex < this.rowsStarted; rowIndex++) {
      const rowState = this.disintegrationRows[rowIndex];
      if (!rowState || rowState.idx > INNER_BUFFER_LENGTH - 1) {
        continue;
      }

      const x = rowState.order[rowState.idx++];
      const y = OUTER_BUFFER_LENGTH - 1 - rowIndex;
      const pixelIndex = (y * TOWER_WIDTH_PX + x) * 4;
      this.workingImageData.data[pixelIndex + 3] = 0;
      hasPixelChanges = true;

      if (rowState.idx > INNER_BUFFER_LENGTH - 1) {
        this.disintegrationRows[rowIndex] = null;
        this.rowsCompleted++;
        if ((rowIndex % 2) === 1) {
          this.bgDropOffsetY++;
        }
      }
    }

    if (hasPixelChanges) {
      this.towerCtx.putImageData(this.workingImageData, 0, 0);
    }

    if (this.rowsStarted >= OUTER_BUFFER_LENGTH && this.rowsCompleted >= OUTER_BUFFER_LENGTH) {
      this.phase = 'idle';
      this.bgShakeX = 0;
      this.bgDropOffsetY = 0;
      this.resolveDisintegrationWaiters();
    }
  }

  private createShuffledRowOrder(): Uint8Array {
    const order = new Uint8Array(INNER_BUFFER_LENGTH);
    for (let i = 0; i < INNER_BUFFER_LENGTH; i++) {
      order[i] = i;
    }

    for (let i = INNER_BUFFER_LENGTH - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = order[i];
      order[i] = order[j];
      order[j] = temp;
    }

    return order;
  }

  private resolveDisintegrationWaiters(): void {
    if (this.disintegrationWaiters.size === 0) {
      return;
    }

    for (const resolve of this.disintegrationWaiters) {
      resolve();
    }
    this.disintegrationWaiters.clear();
  }
}

export const MIRAGE_TOWER_COLLAPSE_ANCHOR = {
  mapId: 'MAP_ROUTE111',
  tileX: 18,
  tileY: 53,
  widthTiles: TOWER_WIDTH_PX / TILE_PIXELS,
  heightTiles: TOWER_HEIGHT_PX / TILE_PIXELS,
} as const;
