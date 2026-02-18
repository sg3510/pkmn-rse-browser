interface MapTileLike {
  metatileId: number;
  collision: number;
  elevation: number;
}

interface MapDataLike {
  width: number;
  height: number;
  layout: MapTileLike[];
}

// Keep in sync with src/utils/mapLoader.ts SECONDARY_TILE_OFFSET.
const SECONDARY_TILE_OFFSET = 16 * 32;

export const TRAINER_HILL_FLOOR_WIDTH = 16;
export const TRAINER_HILL_FLOOR_HEIGHT_MAIN = 16;
export const TRAINER_HILL_FLOOR_HEIGHT_MARGIN = 5;
export const TRAINER_HILL_EXPECTED_METATILE_BYTES = TRAINER_HILL_FLOOR_WIDTH * TRAINER_HILL_FLOOR_HEIGHT_MAIN;
export const TRAINER_HILL_EXPECTED_COLLISION_ROWS = TRAINER_HILL_FLOOR_HEIGHT_MAIN;

export function applyTrainerHillLayoutBlock(
  mapData: MapDataLike,
  metatiles: Uint8Array,
  collisionRows: Uint16Array
): boolean {
  if (
    mapData.width < TRAINER_HILL_FLOOR_WIDTH
    || mapData.height < TRAINER_HILL_FLOOR_HEIGHT_MARGIN + TRAINER_HILL_FLOOR_HEIGHT_MAIN
    || metatiles.length !== TRAINER_HILL_EXPECTED_METATILE_BYTES
    || collisionRows.length !== TRAINER_HILL_EXPECTED_COLLISION_ROWS
  ) {
    return false;
  }

  for (let y = 0; y < TRAINER_HILL_FLOOR_HEIGHT_MAIN; y++) {
    const dstY = y + TRAINER_HILL_FLOOR_HEIGHT_MARGIN;
    const rowBits = collisionRows[y];
    for (let x = 0; x < TRAINER_HILL_FLOOR_WIDTH; x++) {
      const dstIndex = dstY * mapData.width + x;
      const metatileId = metatiles[y * TRAINER_HILL_FLOOR_WIDTH + x] + SECONDARY_TILE_OFFSET;
      const collision = (rowBits >> (15 - x)) & 1;
      mapData.layout[dstIndex] = {
        metatileId,
        collision,
        elevation: 3,
      };
    }
  }

  return true;
}
