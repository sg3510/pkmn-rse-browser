import {
  type Metatile,
  type MetatileAttributes,
  type MapTileData,
  NUM_PRIMARY_METATILES,
} from '../../utils/mapLoader';
import { type WorldMapInstance, type WorldState, type TilesetResources } from '../../services/MapManager';
import { type TilesetRuntime } from './useMapAssets';

export interface ResolvedTile {
  map: WorldMapInstance;
  tileset: TilesetResources;
  metatile: Metatile | null;
  attributes: MetatileAttributes | undefined;
  mapTile: MapTileData;
  isSecondary: boolean;
  isBorder: boolean;
}

export interface RenderContext {
  world: WorldState;
  tilesetRuntimes: Map<string, TilesetRuntime>;
  anchor: WorldMapInstance;
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

export function useMapLogic() {
  return {
    resolveTileAt,
  };
}
