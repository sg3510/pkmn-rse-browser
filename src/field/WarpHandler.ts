/**
 * WarpHandler - Manages warp detection and state
 *
 * This module handles the runtime state for warp detection:
 * - Tracks whether a warp is in progress
 * - Manages cooldown to prevent immediate re-triggering
 * - Tracks last checked tile to avoid duplicate detection
 *
 * Note: The actual warp detection logic (classifyWarpKind, detectWarpTrigger)
 * is in src/components/map/utils.ts. This module manages the state around
 * that detection.
 *
 * Based on pokeemerald's warp system:
 * - src/overworld.c: Warp execution
 * - src/event_data.c: WarpEvent struct
 * - src/field_control_avatar.c: Warp triggers
 *
 * Warp Types:
 * - door: Requires door animation sequence (entry/exit)
 * - teleport: Instant transition (caves, teleport pads)
 * - arrow: Forced movement in direction (stairs, carpet tiles)
 *
 * Usage:
 * ```typescript
 * const warpHandler = new WarpHandler();
 *
 * // In game loop
 * warpHandler.update(deltaMs);
 *
 * // Check for warps when player stops moving
 * if (!playerMoving && !warpHandler.isOnCooldown()) {
 *   const trigger = detectWarpTrigger(ctx, player);
 *   if (trigger && warpHandler.canTriggerWarp(trigger, player.tileX, player.tileY)) {
 *     warpHandler.startWarp(trigger, player.tileX, player.tileY, mapId);
 *     // ... handle warp
 *   }
 * }
 *
 * // After warp completes
 * warpHandler.completeWarp(newMapId, newTileX, newTileY);
 * ```
 */

import { type WarpKind } from './types';

/**
 * State tracking for warp handling
 */
export interface WarpRuntimeState {
  /** Whether a warp is currently in progress */
  inProgress: boolean;
  /** Cooldown timer to prevent immediate re-triggering (ms) */
  cooldownMs: number;
  /** Last tile checked for warp to prevent duplicate detection */
  lastCheckedTile: {
    mapId: string;
    x: number;
    y: number;
  } | null;
}

/**
 * WarpHandler manages warp detection state
 *
 * Provides state management for warp detection and execution,
 * ensuring proper cooldowns and preventing duplicate triggers.
 */
export class WarpHandler {
  private state: WarpRuntimeState = {
    inProgress: false,
    cooldownMs: 0,
    lastCheckedTile: null,
  };

  /** Default cooldown after warp completes (ms) */
  private static readonly DEFAULT_COOLDOWN_MS = 350;

  /** Minimum cooldown for warp checks (ms) */
  private static readonly MIN_CHECK_COOLDOWN_MS = 50;

  /**
   * Update cooldown timer
   *
   * Call this every frame with the delta time.
   *
   * @param deltaMs - Time since last update in milliseconds
   */
  update(deltaMs: number): void {
    if (this.state.cooldownMs > 0) {
      this.state.cooldownMs = Math.max(0, this.state.cooldownMs - deltaMs);
    }
  }

  /**
   * Check if a warp can be triggered
   *
   * Prevents triggering warps when:
   * - Another warp is in progress
   * - Cooldown is active
   * - Same tile was just checked
   *
   * @param warpKind - Type of warp being triggered
   * @param tileX - Player's current tile X
   * @param tileY - Player's current tile Y
   * @param mapId - Current map ID
   * @returns true if warp can be triggered
   */
  canTriggerWarp(warpKind: WarpKind | null, tileX: number, tileY: number, mapId: string): boolean {
    if (this.state.inProgress) return false;
    if (this.state.cooldownMs > 0) return false;

    // Skip arrow warps until forced movement is implemented
    if (warpKind === 'arrow') return false;

    // Check if this is the same tile we just checked
    if (this.state.lastCheckedTile) {
      const { mapId: lastMapId, x: lastX, y: lastY } = this.state.lastCheckedTile;
      if (lastMapId === mapId && lastX === tileX && lastY === tileY) {
        return false;
      }
    }

    return true;
  }

  /**
   * Mark warp as started
   *
   * @param tileX - Tile X where warp started
   * @param tileY - Tile Y where warp started
   * @param mapId - Map where warp started
   */
  startWarp(tileX: number, tileY: number, mapId: string): void {
    this.state.inProgress = true;
    this.state.lastCheckedTile = { mapId, x: tileX, y: tileY };
  }

  /**
   * Mark warp as completed and start cooldown
   *
   * @param destMapId - Destination map ID
   * @param destTileX - Destination tile X
   * @param destTileY - Destination tile Y
   */
  completeWarp(destMapId: string, destTileX: number, destTileY: number): void {
    this.state.inProgress = false;
    this.state.cooldownMs = WarpHandler.DEFAULT_COOLDOWN_MS;
    this.state.lastCheckedTile = { mapId: destMapId, x: destTileX, y: destTileY };
  }

  /**
   * Update last checked tile position
   *
   * Use this when player moves to prevent re-checking the same tile.
   *
   * @param tileX - Current tile X
   * @param tileY - Current tile Y
   * @param mapId - Current map ID
   */
  updateLastCheckedTile(tileX: number, tileY: number, mapId: string): void {
    this.state.lastCheckedTile = { mapId, x: tileX, y: tileY };
    // Add minimum cooldown for warp checks
    this.state.cooldownMs = Math.max(
      this.state.cooldownMs,
      WarpHandler.MIN_CHECK_COOLDOWN_MS
    );
  }

  /**
   * Check if a warp is currently in progress
   */
  isInProgress(): boolean {
    return this.state.inProgress;
  }

  /**
   * Check if cooldown is active
   */
  isOnCooldown(): boolean {
    return this.state.cooldownMs > 0;
  }

  /**
   * Get remaining cooldown time
   */
  getCooldownRemaining(): number {
    return this.state.cooldownMs;
  }

  /**
   * Force set warp in progress state
   *
   * Useful for door sequences that manage their own warp timing.
   */
  setInProgress(inProgress: boolean): void {
    this.state.inProgress = inProgress;
  }

  /**
   * Set custom cooldown
   *
   * @param cooldownMs - Cooldown duration in milliseconds
   */
  setCooldown(cooldownMs: number): void {
    this.state.cooldownMs = cooldownMs;
  }

  /**
   * Clear last checked tile
   *
   * Use when the player has moved away from a warp tile.
   */
  clearLastCheckedTile(): void {
    this.state.lastCheckedTile = null;
  }

  /**
   * Get current state (for debugging/serialization)
   */
  getState(): Readonly<WarpRuntimeState> {
    return this.state;
  }

  /**
   * Reset handler to initial state
   */
  reset(): void {
    this.state = {
      inProgress: false,
      cooldownMs: 0,
      lastCheckedTile: null,
    };
  }

  /**
   * Check if current position matches last checked tile
   *
   * @param tileX - Tile X to check
   * @param tileY - Tile Y to check
   * @param mapId - Map ID to check
   * @returns true if position matches last checked tile
   */
  isSameTileAsLastChecked(tileX: number, tileY: number, mapId: string): boolean {
    if (!this.state.lastCheckedTile) return false;
    const { mapId: lastMapId, x: lastX, y: lastY } = this.state.lastCheckedTile;
    return lastMapId === mapId && lastX === tileX && lastY === tileY;
  }
}
