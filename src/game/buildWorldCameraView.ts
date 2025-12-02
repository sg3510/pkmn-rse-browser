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

/**
 * Build a WorldCameraView from a CameraView.
 *
 * @param camView - Base camera view from CameraController
 * @param worldOffsetX - World X offset in tiles (for map stitching), default 0
 * @param worldOffsetY - World Y offset in tiles (for map stitching), default 0
 * @returns WorldCameraView with world coordinates
 */
export function buildWorldCameraView(
  camView: CameraView,
  worldOffsetX: number = 0,
  worldOffsetY: number = 0
): WorldCameraView {
  return {
    // CameraView base fields
    cameraX: camView.cameraX,
    cameraY: camView.cameraY,
    startTileX: camView.startTileX,
    startTileY: camView.startTileY,
    subTileOffsetX: camView.subTileOffsetX,
    subTileOffsetY: camView.subTileOffsetY,
    tilesWide: camView.tilesWide,
    tilesHigh: camView.tilesHigh,
    pixelWidth: camView.tilesWide * METATILE_SIZE,
    pixelHeight: camView.tilesHigh * METATILE_SIZE,
    // WorldCameraView specific fields (with world offset for map stitching)
    worldStartTileX: camView.startTileX + worldOffsetX,
    worldStartTileY: camView.startTileY + worldOffsetY,
    cameraWorldX: camView.cameraX + worldOffsetX * METATILE_SIZE,
    cameraWorldY: camView.cameraY + worldOffsetY * METATILE_SIZE,
  };
}
