/**
 * WebGL Debug Utilities
 *
 * Debug helper functions for WebGLMapPage that work with WorldSnapshot.
 * These are WebGL-specific because they operate on snapshot-based world data.
 *
 * For Canvas2D equivalents, see the RenderContext-based debug utilities.
 */

import type { WorldSnapshot } from '../../game/WorldManager';
import type { TilesetRuntime } from '../../utils/tilesetUtils';
import type { ReflectionState } from '../map/types';
import type { ReflectionTileDebugInfo, ReflectionTileGridDebugInfo } from './types';

const SECONDARY_TILE_OFFSET = 512;

/**
 * Human-readable names for common metatile behaviors.
 * Shared between debug utilities - could be moved to metatileBehaviors.ts if needed elsewhere.
 */
export const BEHAVIOR_NAMES: Record<number, string> = {
  0: 'NORMAL',
  1: 'SECRET_BASE_WALL',
  2: 'TALL_GRASS',
  3: 'LONG_GRASS',
  6: 'DEEP_SAND',
  7: 'SHORT_GRASS',
  8: 'CAVE',
  16: 'POND_WATER',
  17: 'INTERIOR_DEEP_WATER',
  18: 'DEEP_WATER',
  19: 'WATERFALL',
  20: 'SOOTOPOLIS_DEEP_WATER',
  21: 'OCEAN_WATER',
  22: 'PUDDLE',
  23: 'SHALLOW_WATER',
  32: 'ICE',
  33: 'SAND',
  38: 'THIN_ICE',
  39: 'CRACKED_ICE',
  40: 'HOT_SPRINGS',
  43: 'REFLECTION_UNDER_BRIDGE',
  56: 'JUMP_EAST',
  57: 'JUMP_WEST',
  58: 'JUMP_NORTH',
  59: 'JUMP_SOUTH',
};

/**
 * Get behavior name from behavior ID
 */
export function getBehaviorName(behavior: number): string {
  return BEHAVIOR_NAMES[behavior] || `UNK_${behavior}`;
}

/**
 * Get comprehensive debug info for a single tile from a WorldSnapshot.
 *
 * @param snapshot - The current world snapshot
 * @param tilesetRuntimes - Map of tileset runtimes for reflection metadata
 * @param worldX - World tile X coordinate
 * @param worldY - World tile Y coordinate
 * @param relX - X position relative to player (-2 to +2)
 * @param relY - Y position relative to player (-2 to +2)
 */
export function getTileDebugInfo(
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntime>,
  worldX: number,
  worldY: number,
  relX: number,
  relY: number
): ReflectionTileDebugInfo {
  const { maps, tilesetPairs, mapTilesetPairIndex, anchorBorderMetatiles, anchorMapId } = snapshot;

  // Default empty info
  const defaultInfo: ReflectionTileDebugInfo = {
    worldX,
    worldY,
    relativeX: relX,
    relativeY: relY,
    mapId: null,
    isBorder: false,
    metatileId: null,
    isSecondary: false,
    behavior: null,
    behaviorName: 'UNKNOWN',
    elevation: null,
    collision: null,
    isReflective: false,
    reflectionType: null,
    hasPixelMask: false,
    maskPixelCount: 0,
    isAnimated: false,
    animationId: null,
    runtimeFound: false,
    runtimeId: null,
  };

  // Find which map contains this tile
  for (const map of maps) {
    const localX = worldX - map.offsetX;
    const localY = worldY - map.offsetY;

    if (
      localX >= 0 &&
      localX < map.entry.width &&
      localY >= 0 &&
      localY < map.entry.height
    ) {
      const pairIndex = mapTilesetPairIndex.get(map.entry.id) ?? 0;
      const pair = tilesetPairs[pairIndex];

      const idx = localY * map.entry.width + localX;
      const mapTile = map.mapData.layout[idx];
      const metatileId = mapTile.metatileId;

      const isSecondary = metatileId >= SECONDARY_TILE_OFFSET;
      const attrIndex = isSecondary ? metatileId - SECONDARY_TILE_OFFSET : metatileId;
      const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
      const behavior = attrArray[attrIndex]?.behavior ?? 0;

      // Get runtime for reflection info
      let runtime = tilesetRuntimes.get(pair.id);
      if (!runtime && tilesetRuntimes.size > 0) {
        runtime = tilesetRuntimes.values().next().value;
      }

      const meta = runtime
        ? isSecondary
          ? runtime.secondaryReflectionMeta[attrIndex]
          : runtime.primaryReflectionMeta[attrIndex]
        : null;

      // Count mask pixels if available
      let maskPixelCount = 0;
      if (meta?.pixelMask) {
        for (let i = 0; i < meta.pixelMask.length; i++) {
          if (meta.pixelMask[i]) maskPixelCount++;
        }
      }

      // Check if animated (using destinations array)
      const animations = pair.animations || [];
      const animInfo = animations.find((anim) =>
        anim.destinations?.some((dest) => {
          const targetId = isSecondary ? dest.destStart - SECONDARY_TILE_OFFSET : dest.destStart;
          return targetId === attrIndex;
        })
      );

      return {
        worldX,
        worldY,
        relativeX: relX,
        relativeY: relY,
        mapId: map.entry.id,
        isBorder: false,
        metatileId,
        isSecondary,
        behavior,
        behaviorName: getBehaviorName(behavior),
        elevation: mapTile.elevation,
        collision: mapTile.collision,
        isReflective: meta?.isReflective ?? false,
        reflectionType: meta?.reflectionType ?? null,
        hasPixelMask: !!meta?.pixelMask,
        maskPixelCount,
        isAnimated: !!animInfo,
        animationId: animInfo?.id ?? null,
        runtimeFound: !!runtime,
        runtimeId: pair.id,
      };
    }
  }

  // Border fallback
  if (anchorBorderMetatiles && anchorBorderMetatiles.length > 0) {
    const anchorMap = maps.find((m) => m.entry.id === anchorMapId);
    if (anchorMap) {
      const anchorPairIndex = mapTilesetPairIndex.get(anchorMapId) ?? 0;
      const pair = tilesetPairs[anchorPairIndex];

      const anchorLocalX = worldX - anchorMap.offsetX;
      const anchorLocalY = worldY - anchorMap.offsetY;
      const borderIndex = (anchorLocalX & 1) + ((anchorLocalY & 1) * 2);
      const borderMetatileId = anchorBorderMetatiles[borderIndex % anchorBorderMetatiles.length];

      const isSecondary = borderMetatileId >= SECONDARY_TILE_OFFSET;
      const attrIndex = isSecondary ? borderMetatileId - SECONDARY_TILE_OFFSET : borderMetatileId;
      const attrArray = isSecondary ? pair.secondaryAttributes : pair.primaryAttributes;
      const behavior = attrArray[attrIndex]?.behavior ?? 0;

      let runtime = tilesetRuntimes.get(pair.id);
      if (!runtime && tilesetRuntimes.size > 0) {
        runtime = tilesetRuntimes.values().next().value;
      }

      const meta = runtime
        ? isSecondary
          ? runtime.secondaryReflectionMeta[attrIndex]
          : runtime.primaryReflectionMeta[attrIndex]
        : null;

      let maskPixelCount = 0;
      if (meta?.pixelMask) {
        for (let i = 0; i < meta.pixelMask.length; i++) {
          if (meta.pixelMask[i]) maskPixelCount++;
        }
      }

      return {
        worldX,
        worldY,
        relativeX: relX,
        relativeY: relY,
        mapId: anchorMapId,
        isBorder: true,
        metatileId: borderMetatileId,
        isSecondary,
        behavior,
        behaviorName: getBehaviorName(behavior),
        elevation: 0,
        collision: 1,
        isReflective: meta?.isReflective ?? false,
        reflectionType: meta?.reflectionType ?? null,
        hasPixelMask: !!meta?.pixelMask,
        maskPixelCount,
        isAnimated: false,
        animationId: null,
        runtimeFound: !!runtime,
        runtimeId: pair.id,
      };
    }
  }

  return defaultInfo;
}

/**
 * Get debug info for a 5x5 grid of tiles around the player.
 * Used for the reflection tile grid debug panel.
 *
 * @param snapshot - The current world snapshot
 * @param tilesetRuntimes - Map of tileset runtimes for reflection metadata
 * @param playerTileX - Player's current tile X
 * @param playerTileY - Player's current tile Y
 * @param destTileX - Player's destination tile X (if moving)
 * @param destTileY - Player's destination tile Y (if moving)
 * @param isMoving - Whether player is currently moving
 * @param moveDirection - Direction of movement
 * @param reflectionState - Current reflection state
 */
export function getReflectionTileGridDebug(
  snapshot: WorldSnapshot,
  tilesetRuntimes: Map<string, TilesetRuntime>,
  playerTileX: number,
  playerTileY: number,
  destTileX: number,
  destTileY: number,
  isMoving: boolean,
  moveDirection: string,
  reflectionState: ReflectionState
): ReflectionTileGridDebugInfo {
  const tiles: ReflectionTileDebugInfo[][] = [];

  // Build 5x5 grid (relY from -2 to +2, relX from -2 to +2)
  for (let relY = -2; relY <= 2; relY++) {
    const row: ReflectionTileDebugInfo[] = [];
    for (let relX = -2; relX <= 2; relX++) {
      const worldX = playerTileX + relX;
      const worldY = playerTileY + relY;
      row.push(getTileDebugInfo(snapshot, tilesetRuntimes, worldX, worldY, relX, relY));
    }
    tiles.push(row);
  }

  return {
    playerTileX,
    playerTileY,
    destTileX,
    destTileY,
    isMoving,
    moveDirection,
    tiles,
    currentReflectionState: {
      hasReflection: reflectionState.hasReflection,
      reflectionType: reflectionState.reflectionType,
      bridgeType: reflectionState.bridgeType,
    },
  };
}
