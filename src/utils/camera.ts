import { DEFAULT_VIEWPORT_CONFIG, type ViewportConfig } from '../config/viewport';
import { METATILE_SIZE } from './mapLoader';

export interface CameraView {
  cameraX: number;
  cameraY: number;
  startTileX: number;
  startTileY: number;
  subTileOffsetX: number;
  subTileOffsetY: number;
  tilesWide: number;
  tilesHigh: number;
  pixelWidth: number;
  pixelHeight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function computeCameraView(
  mapWidth: number,
  mapHeight: number,
  focusX: number,
  focusY: number,
  config: ViewportConfig = DEFAULT_VIEWPORT_CONFIG
): CameraView {
  const viewportWidthPx = config.tilesWide * METATILE_SIZE;
  const viewportHeightPx = config.tilesHigh * METATILE_SIZE;
  const mapWidthPx = mapWidth * METATILE_SIZE;
  const mapHeightPx = mapHeight * METATILE_SIZE;

  const idealCameraX = focusX - viewportWidthPx / 2;
  const idealCameraY = focusY - viewportHeightPx / 2;

  const cameraX = clamp(idealCameraX, 0, Math.max(0, mapWidthPx - viewportWidthPx));
  const cameraY = clamp(idealCameraY, 0, Math.max(0, mapHeightPx - viewportHeightPx));

  const startTileX = Math.max(0, Math.floor(cameraX / METATILE_SIZE));
  const startTileY = Math.max(0, Math.floor(cameraY / METATILE_SIZE));
  const subTileOffsetX = cameraX - startTileX * METATILE_SIZE;
  const subTileOffsetY = cameraY - startTileY * METATILE_SIZE;

  const tilesWide = Math.max(1, Math.min(mapWidth - startTileX, config.tilesWide + 1));
  const tilesHigh = Math.max(1, Math.min(mapHeight - startTileY, config.tilesHigh + 1));

  return {
    cameraX,
    cameraY,
    startTileX,
    startTileY,
    subTileOffsetX,
    subTileOffsetY,
    tilesWide,
    tilesHigh,
    pixelWidth: viewportWidthPx,
    pixelHeight: viewportHeightPx,
  };
}
