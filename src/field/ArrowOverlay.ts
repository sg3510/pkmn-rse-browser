/**
 * ArrowOverlay - Arrow indicator for directional warp tiles
 *
 * This module manages the animated arrow overlay that appears when
 * the player faces an arrow warp tile (stairs, carpet tiles, etc.).
 * The arrow indicates the direction of forced movement.
 *
 * Based on pokeemerald's arrow warp system:
 * - Arrow warps force the player to walk in a specific direction
 * - The arrow indicator shows the forced movement direction
 * - Animation bobs/pulses to draw attention
 *
 * Usage:
 * ```typescript
 * const arrowOverlay = new ArrowOverlay();
 *
 * // In game loop, update overlay state
 * arrowOverlay.update(
 *   playerDirection,
 *   tileBehavior,
 *   playerTileX,
 *   playerTileY,
 *   currentTime,
 *   warpInProgress
 * );
 *
 * // In render, check if visible and render
 * if (arrowOverlay.isVisible()) {
 *   const state = arrowOverlay.getState();
 *   renderArrow(ctx, state, arrowSprite, view, currentTime);
 * }
 * ```
 */

import {
  type ArrowOverlayState,
  type CardinalDirection,
  DIRECTION_VECTORS,
} from './types';

import {
  MB_EAST_ARROW_WARP,
  MB_WEST_ARROW_WARP,
  MB_NORTH_ARROW_WARP,
  MB_SOUTH_ARROW_WARP,
  MB_WATER_SOUTH_ARROW_WARP,
  MB_DEEP_SOUTH_WARP,
} from '../utils/metatileBehaviors';

/**
 * Arrow animation constants
 */
export const ARROW_ANIMATION = {
  /** Duration of one full animation cycle (ms) */
  CYCLE_DURATION_MS: 600,
  /** Maximum vertical bob offset in pixels */
  BOB_AMPLITUDE: 2,
  /** Frames in the arrow sprite sheet (for directional variants) */
  FRAME_COUNT: 4,
} as const;

/**
 * ArrowOverlay manages the arrow warp indicator
 *
 * Shows an animated arrow when player faces an arrow warp tile,
 * indicating the direction of forced movement.
 */
export class ArrowOverlay {
  private state: ArrowOverlayState | null = null;

  /**
   * Update arrow overlay state
   *
   * Determines whether to show the arrow based on player direction
   * and current tile behavior.
   *
   * @param playerDirection - Direction player is facing
   * @param arrowDirection - Direction of arrow warp (null if not on arrow tile)
   * @param playerTileX - Player's tile X position
   * @param playerTileY - Player's tile Y position
   * @param currentTime - Current timestamp
   * @param warpInProgress - Whether a warp is currently happening
   */
  update(
    playerDirection: CardinalDirection | null,
    arrowDirection: CardinalDirection | null,
    playerTileX: number,
    playerTileY: number,
    currentTime: number,
    warpInProgress: boolean
  ): void {
    // Hide arrow if warp in progress or no valid directions
    if (warpInProgress || !playerDirection || !arrowDirection) {
      this.state = null;
      return;
    }

    // Arrow only shows when player faces the arrow direction
    if (playerDirection !== arrowDirection) {
      this.state = null;
      return;
    }

    // Calculate overlay position (one tile ahead in arrow direction)
    const vector = DIRECTION_VECTORS[arrowDirection];
    const overlayWorldX = playerTileX + vector.dx;
    const overlayWorldY = playerTileY + vector.dy;

    // Check if this is a new overlay or continuation of existing
    const isNew = !this.state ||
                  !this.state.visible ||
                  this.state.direction !== arrowDirection;

    this.state = {
      visible: true,
      worldX: overlayWorldX,
      worldY: overlayWorldY,
      direction: arrowDirection,
      startedAt: isNew ? currentTime : this.state!.startedAt,
    };
  }

  /**
   * Hide the arrow overlay
   */
  hide(): void {
    this.state = null;
  }

  /**
   * Check if arrow is currently visible
   */
  isVisible(): boolean {
    return this.state !== null && this.state.visible;
  }

  /**
   * Get current arrow state
   *
   * @returns Arrow overlay state or null if not visible
   */
  getState(): Readonly<ArrowOverlayState> | null {
    return this.state;
  }

  /**
   * Get animation progress (0-1) for current cycle
   *
   * @param currentTime - Current timestamp
   * @returns Progress through animation cycle (0-1)
   */
  getAnimationProgress(currentTime: number): number {
    if (!this.state) return 0;
    const elapsed = currentTime - this.state.startedAt;
    return (elapsed % ARROW_ANIMATION.CYCLE_DURATION_MS) / ARROW_ANIMATION.CYCLE_DURATION_MS;
  }

  /**
   * Get vertical bob offset for animation
   *
   * Creates a smooth bobbing motion using sine wave.
   *
   * @param currentTime - Current timestamp
   * @returns Vertical offset in pixels
   */
  getBobOffset(currentTime: number): number {
    const progress = this.getAnimationProgress(currentTime);
    return Math.sin(progress * Math.PI * 2) * ARROW_ANIMATION.BOB_AMPLITUDE;
  }

  /**
   * Get frame index for sprite sheet
   *
   * Returns appropriate frame based on arrow direction.
   *
   * @returns Frame index (0-3 for up, down, left, right)
   */
  getFrameIndex(): number {
    if (!this.state) return 0;
    switch (this.state.direction) {
      case 'up': return 0;
      case 'down': return 1;
      case 'left': return 2;
      case 'right': return 3;
      default: return 0;
    }
  }

  /**
   * Get world position for rendering
   *
   * @returns World coordinates in metatile units, or null if not visible
   */
  getWorldPosition(): { x: number; y: number } | null {
    if (!this.state) return null;
    return { x: this.state.worldX, y: this.state.worldY };
  }

  /**
   * Get screen position for rendering
   *
   * Converts world position to screen coordinates based on camera.
   *
   * @param cameraWorldX - Camera X in world pixels
   * @param cameraWorldY - Camera Y in world pixels
   * @param metatileSize - Size of metatile in pixels (default 16)
   * @returns Screen coordinates or null if not visible
   */
  getScreenPosition(
    cameraWorldX: number,
    cameraWorldY: number,
    metatileSize: number = 16
  ): { x: number; y: number } | null {
    if (!this.state) return null;

    const worldPixelX = this.state.worldX * metatileSize;
    const worldPixelY = this.state.worldY * metatileSize;

    return {
      x: Math.round(worldPixelX - cameraWorldX),
      y: Math.round(worldPixelY - cameraWorldY),
    };
  }

  /**
   * Reset overlay state
   */
  reset(): void {
    this.state = null;
  }
}

/**
 * Get arrow direction from metatile behavior
 *
 * Maps behavior values to their corresponding arrow directions.
 * Based on pokeemerald's metatile behavior constants.
 *
 * @param behavior - Metatile behavior value
 * @returns Arrow direction or null if not an arrow warp
 */
export function getArrowDirectionFromBehavior(behavior: number): CardinalDirection | null {
  // Based on pokeemerald/include/metatile_behaviors.h
  // Use imported constants for correct behavior values:
  // MB_EAST_ARROW_WARP = 98 (0x62)
  // MB_WEST_ARROW_WARP = 99 (0x63)
  // MB_NORTH_ARROW_WARP = 100 (0x64)
  // MB_SOUTH_ARROW_WARP = 101 (0x65)
  // MB_WATER_SOUTH_ARROW_WARP = 109 (0x6D)
  // MB_DEEP_SOUTH_WARP = 110 (0x6E) - also acts as south arrow
  switch (behavior) {
    case MB_EAST_ARROW_WARP: // 98 (0x62)
      return 'right';
    case MB_WEST_ARROW_WARP: // 99 (0x63)
      return 'left';
    case MB_NORTH_ARROW_WARP: // 100 (0x64)
      return 'up';
    case MB_SOUTH_ARROW_WARP: // 101 (0x65)
    case MB_WATER_SOUTH_ARROW_WARP: // 109 (0x6D)
    case MB_DEEP_SOUTH_WARP: // 110 (0x6E)
      return 'down';
    default:
      return null;
  }
}
