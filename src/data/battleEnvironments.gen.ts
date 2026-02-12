// Auto-generated — do not edit
// Source: battle_bg.c + battle_environment.h + constants/battle.h
// Regenerate: node scripts/generate-battle-backgrounds.cjs

export interface BattleEnvironmentMapping {
  environment: string;
  environmentId: number;
  terrain: string;
  tilesDir: string;
  entryDir: string;
  paletteDir: string;
  tilesSymbol: string;
  tilemapSymbol: string;
  entryTilesSymbol: string;
  entryTilemapSymbol: string;
  paletteSymbol: string;
}

export const BATTLE_ENVIRONMENT_BY_TERRAIN = {
  tall_grass: { environment: 'BATTLE_ENVIRONMENT_GRASS', environmentId: 0, terrain: 'tall_grass', tilesDir: 'tall_grass', entryDir: 'tall_grass', paletteDir: 'tall_grass', tilesSymbol: 'gBattleEnvironmentTiles_TallGrass', tilemapSymbol: 'gBattleEnvironmentTilemap_TallGrass', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_TallGrass', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_TallGrass', paletteSymbol: 'gBattleEnvironmentPalette_TallGrass' },
  long_grass: { environment: 'BATTLE_ENVIRONMENT_LONG_GRASS', environmentId: 1, terrain: 'long_grass', tilesDir: 'long_grass', entryDir: 'long_grass', paletteDir: 'long_grass', tilesSymbol: 'gBattleEnvironmentTiles_LongGrass', tilemapSymbol: 'gBattleEnvironmentTilemap_LongGrass', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_LongGrass', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_LongGrass', paletteSymbol: 'gBattleEnvironmentPalette_LongGrass' },
  sand: { environment: 'BATTLE_ENVIRONMENT_SAND', environmentId: 2, terrain: 'sand', tilesDir: 'sand', entryDir: 'sand', paletteDir: 'sand', tilesSymbol: 'gBattleEnvironmentTiles_Sand', tilemapSymbol: 'gBattleEnvironmentTilemap_Sand', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Sand', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Sand', paletteSymbol: 'gBattleEnvironmentPalette_Sand' },
  underwater: { environment: 'BATTLE_ENVIRONMENT_UNDERWATER', environmentId: 3, terrain: 'underwater', tilesDir: 'underwater', entryDir: 'underwater', paletteDir: 'underwater', tilesSymbol: 'gBattleEnvironmentTiles_Underwater', tilemapSymbol: 'gBattleEnvironmentTilemap_Underwater', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Underwater', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Underwater', paletteSymbol: 'gBattleEnvironmentPalette_Underwater' },
  water: { environment: 'BATTLE_ENVIRONMENT_WATER', environmentId: 4, terrain: 'water', tilesDir: 'water', entryDir: 'water', paletteDir: 'water', tilesSymbol: 'gBattleEnvironmentTiles_Water', tilemapSymbol: 'gBattleEnvironmentTilemap_Water', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Water', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Water', paletteSymbol: 'gBattleEnvironmentPalette_Water' },
  pond_water: { environment: 'BATTLE_ENVIRONMENT_POND', environmentId: 5, terrain: 'pond_water', tilesDir: 'pond_water', entryDir: 'pond_water', paletteDir: 'pond_water', tilesSymbol: 'gBattleEnvironmentTiles_PondWater', tilemapSymbol: 'gBattleEnvironmentTilemap_PondWater', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_PondWater', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_PondWater', paletteSymbol: 'gBattleEnvironmentPalette_PondWater' },
  rock: { environment: 'BATTLE_ENVIRONMENT_MOUNTAIN', environmentId: 6, terrain: 'rock', tilesDir: 'rock', entryDir: 'rock', paletteDir: 'rock', tilesSymbol: 'gBattleEnvironmentTiles_Rock', tilemapSymbol: 'gBattleEnvironmentTilemap_Rock', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Rock', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Rock', paletteSymbol: 'gBattleEnvironmentPalette_Rock' },
  cave: { environment: 'BATTLE_ENVIRONMENT_CAVE', environmentId: 7, terrain: 'cave', tilesDir: 'cave', entryDir: 'cave', paletteDir: 'cave', tilesSymbol: 'gBattleEnvironmentTiles_Cave', tilemapSymbol: 'gBattleEnvironmentTilemap_Cave', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Cave', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Cave', paletteSymbol: 'gBattleEnvironmentPalette_Cave' },
  building: { environment: 'BATTLE_ENVIRONMENT_BUILDING', environmentId: 8, terrain: 'building', tilesDir: 'building', entryDir: 'building', paletteDir: 'building', tilesSymbol: 'gBattleEnvironmentTiles_Building', tilemapSymbol: 'gBattleEnvironmentTilemap_Building', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Building', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Building', paletteSymbol: 'gBattleEnvironmentPalette_Building' },
  plain: { environment: 'BATTLE_ENVIRONMENT_PLAIN', environmentId: 9, terrain: 'plain', tilesDir: 'building', entryDir: 'building', paletteDir: 'plain', tilesSymbol: 'gBattleEnvironmentTiles_Building', tilemapSymbol: 'gBattleEnvironmentTilemap_Building', entryTilesSymbol: 'gBattleEnvironmentAnimTiles_Building', entryTilemapSymbol: 'gBattleEnvironmentAnimTilemap_Building', paletteSymbol: 'gBattleEnvironmentPalette_Plain' },
} as const;

export type BattleTerrain = keyof typeof BATTLE_ENVIRONMENT_BY_TERRAIN;

export const BATTLE_ENVIRONMENTS: BattleEnvironmentMapping[] = Object.values(
  BATTLE_ENVIRONMENT_BY_TERRAIN
) as BattleEnvironmentMapping[];

export const BATTLE_ENVIRONMENT_BY_ID: Record<number, BattleEnvironmentMapping> =
  BATTLE_ENVIRONMENTS.reduce((acc, env) => {
    acc[env.environmentId] = env;
    return acc;
  }, {} as Record<number, BattleEnvironmentMapping>);

export function getBattleEnvironmentByTerrain(terrain: BattleTerrain): BattleEnvironmentMapping {
  return BATTLE_ENVIRONMENT_BY_TERRAIN[terrain];
}
