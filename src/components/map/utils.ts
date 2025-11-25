import {
  type RenderContext,
  type ResolvedTile,
  type ReflectionMeta,
  type DebugTileInfo,
  type WarpKind,
  type ReflectionState,
  type ReflectionType,
} from './types';
import {
  type MapTileData,
  NUM_PRIMARY_METATILES,
  METATILE_LAYER_TYPE_NORMAL,
  METATILE_LAYER_TYPE_COVERED,
  METATILE_LAYER_TYPE_SPLIT,
  isCollisionPassable,
} from '../../utils/mapLoader';
import { type WorldMapInstance, type WarpEvent } from '../../services/MapManager';
import { PlayerController } from '../../game/PlayerController';
import {
  getBridgeTypeFromBehavior,
  isDoorBehavior,
  isArrowWarpBehavior,
  isTeleportWarpBehavior,
  requiresDoorExitSequence,
  isReflectiveBehavior,
  isIceBehavior,
  type BridgeType,
} from '../../utils/metatileBehaviors';

const DEBUG_MODE_FLAG = 'PKMN_DEBUG_MODE';

function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

export function resolveTileAt(ctx: RenderContext, worldTileX: number, worldTileY: number): ResolvedTile | null {
  const map = ctx.world.maps.find(
    (m) =>
      worldTileX >= m.offsetX &&
      worldTileX < m.offsetX + m.mapData.width &&
      worldTileY >= m.offsetY &&
      worldTileY < m.offsetY + m.mapData.height
  );

  if (map) {
    const localX = worldTileX - map.offsetX;
    const localY = worldTileY - map.offsetY;
    const idx = localY * map.mapData.width + localX;
    const mapTileData = map.mapData.layout[idx];
    const metatileId = mapTileData.metatileId;
    const isSecondary = metatileId >= NUM_PRIMARY_METATILES;
    const metatile = isSecondary
      ? map.tilesets.secondaryMetatiles[metatileId - NUM_PRIMARY_METATILES] ?? null
      : map.tilesets.primaryMetatiles[metatileId] ?? null;
    const attributes = isSecondary
      ? map.tilesets.secondaryAttributes[metatileId - NUM_PRIMARY_METATILES]
      : map.tilesets.primaryAttributes[metatileId];
    return {
      map,
      tileset: map.tilesets,
      metatile,
      attributes,
      mapTile: mapTileData,
      isSecondary,
      isBorder: false,
    };
  }

  const anchor = ctx.anchor;
  const borderTiles = anchor.borderMetatiles;
  if (!borderTiles || borderTiles.length === 0) return null;
  const anchorLocalX = worldTileX - anchor.offsetX;
  const anchorLocalY = worldTileY - anchor.offsetY;
  // Shift pattern one tile up/left so the repeating border visually aligns with GBA behavior.
  const borderIndex = (anchorLocalX & 1) + ((anchorLocalY & 1) * 2);
  const borderMetatileId = borderTiles[borderIndex % borderTiles.length];
  const isSecondary = borderMetatileId >= NUM_PRIMARY_METATILES;
  const metatile = isSecondary
    ? anchor.tilesets.secondaryMetatiles[borderMetatileId - NUM_PRIMARY_METATILES] ?? null
    : anchor.tilesets.primaryMetatiles[borderMetatileId] ?? null;
  const attributes = isSecondary
    ? anchor.tilesets.secondaryAttributes[borderMetatileId - NUM_PRIMARY_METATILES]
    : anchor.tilesets.primaryAttributes[borderMetatileId];
  // Border tiles: create MapTileData with impassable collision, elevation 0
  const mapTile: MapTileData = {
    metatileId: borderMetatileId,
    collision: 1, // Impassable like pokeemerald border
    elevation: 0, // Border tiles are always ground level
  };
  return {
    map: anchor,
    tileset: anchor.tilesets,
    metatile,
    attributes,
    mapTile,
    isSecondary,
    isBorder: true,
  };
}

export function findWarpEventAt(map: WorldMapInstance, worldTileX: number, worldTileY: number): WarpEvent | null {
  if (!map.warpEvents || map.warpEvents.length === 0) return null;
  const localX = worldTileX - map.offsetX;
  const localY = worldTileY - map.offsetY;
  return map.warpEvents.find((warp) => warp.x === localX && warp.y === localY) ?? null;
}

export function getMetatileBehavior(
  ctx: RenderContext,
  tileX: number,
  tileY: number
): { behavior: number; meta: ReflectionMeta | null } | null {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved) return null;
  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  if (!runtime) return null;
  const metatileId = resolved.mapTile.metatileId;
  const meta = resolved.isSecondary
    ? runtime.secondaryReflectionMeta[metatileId - NUM_PRIMARY_METATILES]
    : runtime.primaryReflectionMeta[metatileId];
  const behavior = resolved.attributes?.behavior ?? -1;
  return {
    behavior,
    meta: meta ?? null,
  };
}

export function classifyWarpKind(behavior: number): WarpKind | null {
  // Check arrow warps first, before door behaviors
  // (some behaviors like MB_DEEP_SOUTH_WARP can match multiple categories)
  if (isArrowWarpBehavior(behavior)) return 'arrow';
  if (requiresDoorExitSequence(behavior)) return 'door';
  if (isTeleportWarpBehavior(behavior)) return 'teleport';
  return null;
}

export interface WarpTrigger {
  kind: WarpKind;
  sourceMap: WorldMapInstance;
  warpEvent: WarpEvent;
  behavior: number;
  facing: PlayerController['dir'];
}

export function detectWarpTrigger(ctx: RenderContext, player: PlayerController): WarpTrigger | null {
  const resolved = resolveTileAt(ctx, player.tileX, player.tileY);
  if (!resolved || resolved.isBorder) return null;
  const warpEvent = findWarpEventAt(resolved.map, player.tileX, player.tileY);
  if (!warpEvent) return null;
  const behavior = resolved.attributes?.behavior ?? -1;
  const metatileId = resolved.mapTile.metatileId;
  const kind = classifyWarpKind(behavior) ?? 'teleport';
  
  if (isDebugMode()) {
    console.log('[DETECT_WARP_TRIGGER]', {
      tileX: player.tileX,
      tileY: player.tileY,
      metatileId: `0x${metatileId.toString(16)} (${metatileId})`,
      behavior,
      classifiedKind: kind,
      isDoor: isDoorBehavior(behavior),
      isArrow: isArrowWarpBehavior(behavior),
      isTeleport: isTeleportWarpBehavior(behavior),
      destMap: warpEvent.destMap,
    });
  }
  
  // Skip arrow warps until forced-movement handling is implemented.
  if (kind === 'arrow') return null;
  return {
    kind,
    sourceMap: resolved.map,
    warpEvent,
    behavior,
    facing: player.dir,
  };
}

export function layerTypeToLabel(layerType: number): string {
  switch (layerType) {
    case METATILE_LAYER_TYPE_NORMAL:
      return 'NORMAL';
    case METATILE_LAYER_TYPE_COVERED:
      return 'COVERED';
    case METATILE_LAYER_TYPE_SPLIT:
      return 'SPLIT';
    default:
      return `UNKNOWN_${layerType}`;
  }
}

export function resolveBridgeType(ctx: RenderContext, tileX: number, tileY: number): BridgeType {
  const info = getMetatileBehavior(ctx, tileX, tileY);
  if (!info) return 'none';
  return getBridgeTypeFromBehavior(info.behavior);
}

export function isVerticalObject(ctx: RenderContext, tileX: number, tileY: number): boolean {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved || !resolved.metatile || !resolved.attributes) return false;
  
  const layerType = resolved.attributes.layerType;
  
  // Only NORMAL layer types can be vertical objects
  // COVERED and SPLIT have different behavior
  if (layerType !== METATILE_LAYER_TYPE_NORMAL) return false;
  
  // Check if this is a bridge tile - bridges are HORIZONTAL platforms
  // that should respect elevation, NOT vertical objects
  const behaviorInfo = getMetatileBehavior(ctx, tileX, tileY);
  if (behaviorInfo) {
    const behavior = behaviorInfo.behavior;
    // Bridge behaviors: 112-115 (BRIDGE_OVER_OCEAN/POND), 120 (FORTREE_BRIDGE), 
    // 122-125 (BRIDGE edges), 127 (BIKE_BRIDGE)
    const isBridge = (behavior >= 112 && behavior <= 115) || 
                     behavior === 120 || 
                     (behavior >= 122 && behavior <= 125) || 
                     behavior === 127;
    if (isBridge) return false; // Bridges use elevation-based rendering
  }
  
  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  if (!runtime) return false;
  
  const metatile = resolved.metatile;
  const tileMasks = resolved.isSecondary ? runtime.secondaryTileMasks : runtime.primaryTileMasks;
  
  // Calculate top layer transparency
  let topLayerTransparency = 0;
  for (let i = 4; i < 8; i++) {
    const tile = metatile.tiles[i];
    const mask = tileMasks[tile.tileId];
    if (mask) {
      topLayerTransparency += mask.reduce((sum, val) => sum + val, 0);
    }
  }
  
  // If top layer has more than 50% opaque pixels (< 128/256 transparent), 
  // it's a vertical object (tree, pole, etc.) that should cover the player
  // Trees typically have ~56/256 transparent (200 opaque)
  // Ground/empty tiles have 256/256 transparent (0 opaque)
  // Bridges have 0/256 transparent but are excluded above
  const VERTICAL_OBJECT_THRESHOLD = 128;
  return topLayerTransparency < VERTICAL_OBJECT_THRESHOLD;
}

export function describeTile(
  ctx: RenderContext,
  tileX: number,
  tileY: number,
  player?: PlayerController | null
): DebugTileInfo {
  const resolved = resolveTileAt(ctx, tileX, tileY);
  if (!resolved || !resolved.metatile) {
    return { inBounds: false, tileX, tileY };
  }

  const runtime = ctx.tilesetRuntimes.get(resolved.tileset.key);
  const mapTile = resolved.mapTile;
  const metatileId = mapTile.metatileId;
  const isSecondary = resolved.isSecondary;
  const attr = resolved.attributes;
  const meta = resolved.metatile;
  const reflectionMeta = runtime
    ? isSecondary
      ? runtime.secondaryReflectionMeta[metatileId - NUM_PRIMARY_METATILES]
      : runtime.primaryReflectionMeta[metatileId]
    : undefined;
  const behavior = attr?.behavior;
  const layerType = attr?.layerType;
  const reflectionMaskAllow = reflectionMeta?.pixelMask?.reduce((acc, v) => acc + (v ? 1 : 0), 0);
  const reflectionMaskTotal = reflectionMeta?.pixelMask?.length;

  // Additional debug info
  const localX = tileX - resolved.map.offsetX;
  const localY = tileY - resolved.map.offsetY;
  const warpEvent = findWarpEventAt(resolved.map, tileX, tileY);
  const warpKind = behavior !== undefined ? classifyWarpKind(behavior) : null;
  const paletteIndex = (metatileId >> 12) & 0xF; // Extract palette bits
  
  // Elevation and collision info
  const elevation = mapTile.elevation;
  const collision = mapTile.collision;
  const collisionPassable = isCollisionPassable(collision);
  
  // Ledge detection
  // CORRECT values: MB_JUMP_EAST=56(0x38), MB_JUMP_WEST=57(0x39), MB_JUMP_NORTH=58(0x3A), MB_JUMP_SOUTH=59(0x3B)
  const isLedge = behavior === 0x38 || behavior === 0x39 || behavior === 0x3A || behavior === 0x3B;
  let ledgeDirection = undefined;
  if (behavior === 0x38) ledgeDirection = 'EAST';
  else if (behavior === 0x39) ledgeDirection = 'WEST';
  else if (behavior === 0x3A) ledgeDirection = 'NORTH';
  else if (behavior === 0x3B) ledgeDirection = 'SOUTH';
  
  // Transparency calculation for layers
  let bottomLayerTransparency = 0;
  let topLayerTransparency = 0;
  const bottomTileDetails: string[] = [];
  const topTileDetails: string[] = [];
  
  if (runtime && meta) {
    const tileMasks = isSecondary ? runtime.secondaryTileMasks : runtime.primaryTileMasks;
    
    // Bottom layer (tiles 0-3)
    for (let i = 0; i < 4; i++) {
      const tile = meta.tiles[i];
      const mask = tileMasks[tile.tileId];
      if (mask) {
        const transparentPixels = mask.reduce((sum, val) => sum + val, 0);
        bottomLayerTransparency += transparentPixels;
        bottomTileDetails.push(
          `Tile ${i}: ID=${tile.tileId}, Pal=${tile.palette}, Flip=${tile.xflip ? 'X' : ''}${tile.yflip ? 'Y' : ''}, Transparent=${transparentPixels}/64px`
        );
      }
    }
    
    // Top layer (tiles 4-7)
    for (let i = 4; i < 8; i++) {
      const tile = meta.tiles[i];
      const mask = tileMasks[tile.tileId];
      if (mask) {
        const transparentPixels = mask.reduce((sum, val) => sum + val, 0);
        topLayerTransparency += transparentPixels;
        topTileDetails.push(
          `Tile ${i}: ID=${tile.tileId}, Pal=${tile.palette}, Flip=${tile.xflip ? 'X' : ''}${tile.yflip ? 'Y' : ''}, Transparent=${transparentPixels}/64px`
        );
      }
    }
  }
  
  // Get adjacent tile information
  const adjacentTileInfo: {
    north?: { metatileId: number; layerType: number; layerTypeLabel: string };
    south?: { metatileId: number; layerType: number; layerTypeLabel: string };
    east?: { metatileId: number; layerType: number; layerTypeLabel: string };
    west?: { metatileId: number; layerType: number; layerTypeLabel: string };
  } = {};
  
  const northTile = resolveTileAt(ctx, tileX, tileY - 1);
  if (northTile?.metatile && northTile.attributes) {
    adjacentTileInfo.north = {
      metatileId: northTile.mapTile.metatileId,
      layerType: northTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(northTile.attributes.layerType),
    };
  }
  
  const southTile = resolveTileAt(ctx, tileX, tileY + 1);
  if (southTile?.metatile && southTile.attributes) {
    adjacentTileInfo.south = {
      metatileId: southTile.mapTile.metatileId,
      layerType: southTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(southTile.attributes.layerType),
    };
  }
  
  const eastTile = resolveTileAt(ctx, tileX + 1, tileY);
  if (eastTile?.metatile && eastTile.attributes) {
    adjacentTileInfo.east = {
      metatileId: eastTile.mapTile.metatileId,
      layerType: eastTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(eastTile.attributes.layerType),
    };
  }
  
  const westTile = resolveTileAt(ctx, tileX - 1, tileY);
  if (westTile?.metatile && westTile.attributes) {
    adjacentTileInfo.west = {
      metatileId: westTile.mapTile.metatileId,
      layerType: westTile.attributes.layerType,
      layerTypeLabel: layerTypeToLabel(westTile.attributes.layerType),
    };
  }
  
  // Player elevation comparison
  const playerElevation = player?.getElevation();
  
  // Rendering pass calculation (same logic as compositeScene)
  const renderedInBackgroundPass = true; // Bottom layer always rendered
  let renderedInTopBelowPass = false;
  let renderedInTopAbovePass = false;
  let topBelowPassReason = 'Not applicable';
  let topAbovePassReason = 'Not applicable';
  
  // NORMAL tiles render their top layer in the TOP passes (with elevation filtering)
  // COVERED tiles render layer 1 in background (both layers behind player)
  // SPLIT tiles render layer 0 in background, layer 1 in top passes (with elevation filtering)
  
  // Check if this is a vertical object (tree, pole, etc.)
  // This properly excludes bridges which should respect elevation
  const isVertical = isVerticalObject(ctx, tileX, tileY);
  
  if (layerType === METATILE_LAYER_TYPE_COVERED) {
    // COVERED: Both layers in background pass
    topBelowPassReason = 'COVERED: both layers render in background pass (behind player)';
    topAbovePassReason = 'COVERED: both layers render in background pass (behind player)';
  } else if (layerType === METATILE_LAYER_TYPE_SPLIT || layerType === METATILE_LAYER_TYPE_NORMAL) {
    // SPLIT and NORMAL: Layer 1 in top passes with elevation filtering
    if (playerElevation !== undefined) {
      // CRITICAL: Vertical objects (trees) ALWAYS render after player
      if (isVertical) {
        renderedInTopBelowPass = false;
        topBelowPassReason = `🌳 VERTICAL OBJECT (tree/pole): Always renders AFTER player (topAbove)`;
        renderedInTopAbovePass = true;
        topAbovePassReason = `🌳 VERTICAL OBJECT (tree/pole): Always covers player`;
      } else {
        // Based on GBA pokeemerald sElevationToPriority table:
        // Priority 1 (sprite ABOVE top layer): even elevations >= 4 (4, 6, 8, 10, 12)
        // Priority 2 (sprite BELOW top layer): < 4 or odd elevations >= 4 (5, 7, 9, 11)
        const playerHasPriority1 = playerElevation >= 4 && playerElevation % 2 === 0;

        // Top Below Pass filter (rendered BEFORE player = player on top)
        if (!playerHasPriority1) {
          renderedInTopBelowPass = false;
          topBelowPassReason = `Player elev ${playerElevation} has priority 2: top layer renders AFTER player`;
        } else if (elevation === playerElevation && collision === 1) {
          renderedInTopBelowPass = false;
          topBelowPassReason = `Same elev (${elevation}) + blocked: obstacle covers player (topAbove)`;
        } else {
          renderedInTopBelowPass = true;
          topBelowPassReason = `Player elev ${playerElevation} (even, ≥4) has priority 1: top layer renders BEFORE player`;
        }

        // Top Above Pass filter (rendered AFTER player = top layer on top)
        if (!playerHasPriority1) {
          renderedInTopAbovePass = true;
          topAbovePassReason = `Player elev ${playerElevation} has priority 2: top layer covers player`;
        } else if (elevation === playerElevation && collision === 1) {
          renderedInTopAbovePass = true;
          topAbovePassReason = `Same elev (${elevation}) + blocked: obstacle covers player`;
        } else {
          renderedInTopAbovePass = false;
          topAbovePassReason = `Player elev ${playerElevation} (even, ≥4) has priority 1: player covers top layer`;
        }
      }
    } else {
      topBelowPassReason = 'No player to compare';
      topAbovePassReason = 'No player to compare';
    }
  }

  return {
    inBounds: true,
    tileX,
    tileY,
    mapTile,
    metatileId,
    isSecondary,
    behavior,
    layerType,
    layerTypeLabel: layerType !== undefined ? layerTypeToLabel(layerType) : undefined,
    isReflective: reflectionMeta?.isReflective,
    reflectionType: reflectionMeta?.reflectionType,
    reflectionMaskAllow,
    reflectionMaskTotal,
    bottomTiles: meta?.tiles.slice(0, 4),
    topTiles: meta?.tiles.slice(4, 8),
    // Additional debug info
    mapId: resolved.map.entry.id,
    mapName: resolved.map.entry.name,
    localX,
    localY,
    paletteIndex,
    warpEvent,
    warpKind,
    primaryTilesetId: resolved.tileset.primaryTilesetId,
    secondaryTilesetId: resolved.tileset.secondaryTilesetId,
    // Elevation and collision info
    elevation,
    collision,
    collisionPassable,
    // Rendering debug info
    playerElevation,
    isLedge,
    ledgeDirection,
    bottomLayerTransparency,
    topLayerTransparency,
    renderedInBackgroundPass,
    renderedInTopBelowPass,
    renderedInTopAbovePass,
    topBelowPassReason,
    topAbovePassReason,
    // Detailed tile info
    bottomTileDetails,
    topTileDetails,
    adjacentTileInfo,
  };
}

/**
 * Generic reflection state computation for any object at a tile position
 * Used by both player and NPCs
 *
 * @param ctx - Render context
 * @param tileX - Object's tile X position
 * @param tileY - Object's tile Y position
 * @param spriteWidth - Sprite width in pixels (default 16)
 * @param spriteHeight - Sprite height in pixels (default 32)
 */
export function computeObjectReflectionState(
  ctx: RenderContext,
  tileX: number,
  tileY: number,
  spriteWidth: number = 16,
  spriteHeight: number = 32
): ReflectionState {
  // Calculate how many tiles the sprite covers
  const widthTiles = Math.max(1, (spriteWidth + 8) >> 4);
  const heightTiles = Math.max(1, (spriteHeight + 8) >> 4);

  let found: ReflectionType | null = null;

  // Search tiles below the object for reflective surfaces
  // Start from the object's tile and go down (where reflection would appear)
  for (let i = 0; i < heightTiles && !found; i++) {
    const y = tileY + i;

    // Check center tile
    const center = getMetatileBehavior(ctx, tileX, y);
    if (center?.meta?.isReflective) {
      found = center.meta.reflectionType;
      break;
    }

    // Check tiles to left and right based on sprite width
    for (let j = 1; j < widthTiles && !found; j++) {
      const infos = [
        getMetatileBehavior(ctx, tileX + j, y),
        getMetatileBehavior(ctx, tileX - j, y),
      ];
      for (const info of infos) {
        if (info?.meta?.isReflective) {
          found = info.meta.reflectionType;
          break;
        }
      }
    }
  }

  const bridgeType = resolveBridgeType(ctx, tileX, tileY);

  return {
    hasReflection: !!found,
    reflectionType: found,
    bridgeType,
  };
}

export function computeReflectionState(
  ctx: RenderContext,
  player: PlayerController | null
): ReflectionState {
  if (!player) {
    return { hasReflection: false, reflectionType: null, bridgeType: 'none' };
  }

  const { width, height } = player.getSpriteSize();
  return computeObjectReflectionState(ctx, player.tileX, player.tileY, width, height);
}
