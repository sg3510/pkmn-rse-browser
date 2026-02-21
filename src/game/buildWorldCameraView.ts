/**
 * buildWorldCameraView
 *
 * Shared utility for constructing WorldCameraView from CameraView.
 * Used by both WebGLMapPage and MapRenderer to ensure consistent view building.
 *
 * The WorldCameraView extends CameraView with world-space coordinates that
 * account for map stitching offsets in multi-map scenarios.
 */

import { METATILE_SIZE } from '../utils/mapLoader';
import type { CameraView } from '../utils/camera';
import type { WorldCameraView } from '../rendering/types';

type CameraViewLike = CameraView | {
  x: number;
  y: number;
  startTileX: number;
  startTileY: number;
  subTileOffsetX: number;
  subTileOffsetY: number;
  tilesWide: number;
  tilesHigh: number;
  pixelWidth: number;
  pixelHeight: number;
};

function getCameraX(view: CameraViewLike): number {
  return 'cameraX' in view ? view.cameraX : view.x;
}

function getCameraY(view: CameraViewLike): number {
  return 'cameraY' in view ? view.cameraY : view.y;
}

/**
 * Build a WorldCameraView from a CameraView.
 *
 * @param camView - Base camera view from CameraController
 * @param worldOffsetX - World X offset in tiles (for map stitching), default 0
 * @param worldOffsetY - World Y offset in tiles (for map stitching), default 0
 * @returns WorldCameraView with world coordinates
 */
export function buildWorldCameraView(
  camView: CameraViewLike,
  worldOffsetX: number = 0,
  worldOffsetY: number = 0
): WorldCameraView {
  return buildWorldCameraViewInto({
    // CameraView base fields
    cameraX: 0,
    cameraY: 0,
    startTileX: 0,
    startTileY: 0,
    subTileOffsetX: 0,
    subTileOffsetY: 0,
    tilesWide: 0,
    tilesHigh: 0,
    pixelWidth: 0,
    pixelHeight: 0,
    worldStartTileX: 0,
    worldStartTileY: 0,
    cameraWorldX: 0,
    cameraWorldY: 0,
  }, camView, worldOffsetX, worldOffsetY);
}

/**
 * Mutate an existing WorldCameraView in place.
 *
 * Use this on hot paths to avoid per-frame object allocation.
 */
export function buildWorldCameraViewInto(
  target: WorldCameraView,
  camView: CameraViewLike,
  worldOffsetX: number = 0,
  worldOffsetY: number = 0
): WorldCameraView {
  const cameraX = getCameraX(camView);
  const cameraY = getCameraY(camView);

  target.cameraX = cameraX;
  target.cameraY = cameraY;
  target.startTileX = camView.startTileX;
  target.startTileY = camView.startTileY;
  target.subTileOffsetX = camView.subTileOffsetX;
  target.subTileOffsetY = camView.subTileOffsetY;
  target.tilesWide = camView.tilesWide;
  target.tilesHigh = camView.tilesHigh;
  // Preserve true viewport pixel size from CameraView.
  // tilesWide/tilesHigh may include +1 overscan tiles for sub-tile scrolling.
  target.pixelWidth = camView.pixelWidth;
  target.pixelHeight = camView.pixelHeight;
  // WorldCameraView specific fields (with world offset for map stitching)
  target.worldStartTileX = camView.startTileX + worldOffsetX;
  target.worldStartTileY = camView.startTileY + worldOffsetY;
  target.cameraWorldX = cameraX + worldOffsetX * METATILE_SIZE;
  target.cameraWorldY = cameraY + worldOffsetY * METATILE_SIZE;

  return target;
}
