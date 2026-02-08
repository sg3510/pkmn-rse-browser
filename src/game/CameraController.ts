/**
 * CameraController - Manages camera position and viewport calculations
 *
 * Designed to be scalable for different rendering backends:
 * - WebGL: Supports negative world coords, border overscan, infinite worlds
 * - Canvas2D: Simpler bounds starting at (0,0)
 *
 * The controller is stateful and tracks the current camera position.
 */

import { METATILE_SIZE } from '../utils/mapLoader';

/**
 * Camera view information for rendering
 */
export interface CameraView {
  /** Camera position in pixels */
  x: number;
  y: number;
  /** Starting tile coordinates for rendering */
  startTileX: number;
  startTileY: number;
  /** Sub-tile offset for smooth scrolling (0 to METATILE_SIZE-1) */
  subTileOffsetX: number;
  subTileOffsetY: number;
  /** Viewport dimensions in tiles */
  tilesWide: number;
  tilesHigh: number;
  /** Viewport dimensions in pixels */
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * World bounds configuration
 * Supports negative coordinates for stitched worlds
 */
export interface WorldBounds {
  minX: number;  // Can be negative for maps connected left of anchor
  minY: number;  // Can be negative for maps connected above anchor
  width: number;
  height: number;
}

/**
 * Camera configuration options
 */
export interface CameraConfig {
  /** Viewport size in tiles */
  viewportTilesWide: number;
  viewportTilesHigh: number;
  /**
   * Border overscan in tiles - how many tiles beyond world edge camera can show
   * WebGL uses 3 (to show border tiles), Canvas2D typically uses 0
   */
  borderOverscanTiles: number;
}

/**
 * Player-like interface for camera following
 */
export interface CameraTarget {
  getCameraFocus(): { x: number; y: number };
}

export class CameraController {
  private x: number = 0;
  private y: number = 0;
  private config: CameraConfig;
  private bounds: WorldBounds | null = null;

  constructor(config: CameraConfig) {
    this.config = config;
  }

  /**
   * Get current camera position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Set camera position directly (used for initialization)
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Update world bounds (call when world changes, e.g., after warp or map load)
   */
  setBounds(bounds: WorldBounds): void {
    this.bounds = bounds;
  }

  /**
   * Get current bounds
   */
  getBounds(): WorldBounds | null {
    return this.bounds;
  }

  /**
   * Update configuration (e.g., if viewport size changes)
   */
  updateConfig(config: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Follow a target (typically the player), centering them in the viewport
   * and clamping to world bounds with optional overscan
   */
  followTarget(target: CameraTarget): void {
    const focus = target.getCameraFocus();
    const viewportWidth = this.config.viewportTilesWide * METATILE_SIZE;
    const viewportHeight = this.config.viewportTilesHigh * METATILE_SIZE;

    // Center target in viewport
    this.x = focus.x - viewportWidth / 2;
    this.y = focus.y - viewportHeight / 2;

    // Clamp to bounds if set
    if (this.bounds) {
      this.clampToBounds();
    }
  }

  /**
   * Clamp camera position to world bounds with overscan
   */
  private clampToBounds(): void {
    if (!this.bounds) return;

    const viewportWidth = this.config.viewportTilesWide * METATILE_SIZE;
    const viewportHeight = this.config.viewportTilesHigh * METATILE_SIZE;
    const overscan = this.config.borderOverscanTiles * METATILE_SIZE;

    // Note: all bounds values (minX, minY, width, height) are in pixels
    const { minX, minY, width, height } = this.bounds;

    // Center camera when the world is smaller than the viewport
    if (width <= viewportWidth) {
      this.x = minX + (width - viewportWidth) / 2;
    } else {
      const camMinX = minX - overscan;
      const camMaxX = minX + width - viewportWidth + overscan;
      this.x = Math.max(camMinX, Math.min(this.x, camMaxX));
    }

    if (height <= viewportHeight) {
      this.y = minY + (height - viewportHeight) / 2;
    } else {
      const camMinY = minY - overscan;
      const camMaxY = minY + height - viewportHeight + overscan;
      this.y = Math.max(camMinY, Math.min(this.y, camMaxY));
    }
  }

  /**
   * Adjust camera position by an offset (used for world re-anchoring)
   * When the world re-anchors, coordinates shift and camera needs to compensate
   */
  adjustOffset(dx: number, dy: number): void {
    this.x -= dx * METATILE_SIZE;
    this.y -= dy * METATILE_SIZE;
  }

  /**
   * Get the camera view for rendering
   * Returns tile coordinates and sub-tile offsets needed for rendering
   *
   * @param extraTiles - Additional tiles to render beyond viewport (for sub-tile scrolling)
   */
  getView(extraTiles: number = 1): CameraView {
    const viewportWidth = this.config.viewportTilesWide * METATILE_SIZE;
    const viewportHeight = this.config.viewportTilesHigh * METATILE_SIZE;

    // Calculate starting tile and sub-tile offset
    const startTileX = Math.floor(this.x / METATILE_SIZE);
    const startTileY = Math.floor(this.y / METATILE_SIZE);
    const subTileOffsetX = this.x - startTileX * METATILE_SIZE;
    const subTileOffsetY = this.y - startTileY * METATILE_SIZE;

    return {
      x: this.x,
      y: this.y,
      startTileX,
      startTileY,
      subTileOffsetX,
      subTileOffsetY,
      tilesWide: this.config.viewportTilesWide + extraTiles,
      tilesHigh: this.config.viewportTilesHigh + extraTiles,
      pixelWidth: viewportWidth,
      pixelHeight: viewportHeight,
    };
  }

  /**
   * Reset camera to origin
   */
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.bounds = null;
  }
}

/**
 * Create a CameraController configured for WebGL rendering
 * - 3 tiles of border overscan (to show border tiles)
 * - Supports negative world coordinates
 */
export function createWebGLCameraController(
  viewportTilesWide: number,
  viewportTilesHigh: number
): CameraController {
  return new CameraController({
    viewportTilesWide,
    viewportTilesHigh,
    borderOverscanTiles: 3,  // WebGL shows up to 3 tiles of border
  });
}

/**
 * Create a CameraController configured for Canvas2D rendering
 * - No border overscan
 * - Assumes world starts at (0,0)
 */
export function createCanvas2DCameraController(
  viewportTilesWide: number,
  viewportTilesHigh: number
): CameraController {
  return new CameraController({
    viewportTilesWide,
    viewportTilesHigh,
    borderOverscanTiles: 0,
  });
}
