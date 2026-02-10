/**
 * Player Coordinate Utilities
 *
 * Canonical functions for calculating player positions used in sprite sorting.
 * Both WebGL and Canvas2D renderers MUST use these to ensure identical behavior.
 *
 * Player sprite layout (32px tall):
 * ```
 * player.y      → Top of sprite (render position)
 * player.y + 16 → Sprite center (used for field effect Y-comparison)
 * player.y + 32 → Feet position (used for sortKey calculation)
 * ```
 *
 * On GBA, sprites are sorted by their "feet" Y position (bottom of sprite).
 * This determines which sprites appear in front of others.
 */

import type { PlayerController } from './PlayerController';
import { METATILE_SIZE as MAP_METATILE_SIZE } from '../utils/mapLoader';

/** Size of a metatile in pixels */
export const METATILE_SIZE = MAP_METATILE_SIZE;

/** Player sprite height in pixels */
export const PLAYER_SPRITE_HEIGHT = 32;

/** Offset from player.y to sprite center */
export const PLAYER_CENTER_OFFSET = 16;

/** Offset from player.y to feet (bottom of sprite) */
export const PLAYER_FEET_OFFSET = 32;

/** Default subpriority for player and NPCs (mid-range) */
export const DEFAULT_SPRITE_SUBPRIORITY = 128;

/** Subpriority for field effects rendering behind player */
export const FIELD_EFFECT_BEHIND_SUBPRIORITY = 0;

/** Subpriority for field effects rendering in front of player */
export const FIELD_EFFECT_FRONT_SUBPRIORITY = 192;

/**
 * Get the player's feet Y position (used for sortKey calculation)
 *
 * This is the canonical Y position for Y-sorting the player sprite.
 * All other sprites should be sorted relative to this value.
 */
export function getPlayerFeetY(player: PlayerController): number {
  return player.y + PLAYER_FEET_OFFSET;
}

/**
 * Get the player's sprite center Y position
 *
 * Used for field effect layer determination (computeFieldEffectLayer).
 * Field effects compare their worldY against this value.
 */
export function getPlayerCenterY(player: PlayerController): number {
  return player.y + PLAYER_CENTER_OFFSET;
}

/**
 * Get NPC feet Y position from tile coordinates
 *
 * NPCs are positioned by tile, so their feet are at the bottom of the tile.
 */
export function getNPCFeetY(tileY: number): number {
  return tileY * METATILE_SIZE + METATILE_SIZE; // tileY * 16 + 16
}

/**
 * Get field effect world Y position (center of tile)
 *
 * Field effects are rendered at the center of their tile.
 */
export function getFieldEffectWorldY(tileY: number): number {
  return tileY * METATILE_SIZE + (METATILE_SIZE / 2); // tileY * 16 + 8
}

/**
 * Calculate sort key for Y-ordering sprites
 *
 * Higher sortKey = renders later = appears in front.
 * Formula: (worldY << 8) | (subpriority & 0xFF)
 *
 * The Y component is shifted left 8 bits, giving 256 subpriority levels
 * per pixel of Y difference. This means sprites at the same Y are
 * ordered by subpriority.
 *
 * @param worldY - The Y position (typically feet Y for sprites)
 * @param subpriority - Fine-grained ordering within same Y (0-255)
 */
export function calculateSortKey(worldY: number, subpriority: number = 0): number {
  return (Math.floor(worldY) << 8) | (subpriority & 0xff);
}

/**
 * Extract Y component from a sort key
 */
export function getSortKeyY(sortKey: number): number {
  return sortKey >> 8;
}

/**
 * Extract subpriority component from a sort key
 */
export function getSortKeySubpriority(sortKey: number): number {
  return sortKey & 0xff;
}

/**
 * Get player's sort key
 *
 * Canonical sort key calculation for the player sprite.
 */
export function getPlayerSortKey(player: PlayerController): number {
  return calculateSortKey(getPlayerFeetY(player), DEFAULT_SPRITE_SUBPRIORITY);
}

/**
 * Get NPC's sort key from tile position
 *
 * Canonical sort key calculation for NPC sprites.
 */
export function getNPCSortKey(tileY: number): number {
  return calculateSortKey(getNPCFeetY(tileY), DEFAULT_SPRITE_SUBPRIORITY);
}
