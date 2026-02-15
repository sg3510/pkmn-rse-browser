/**
 * Berry constants and lookup tables.
 *
 * C references:
 * - public/pokeemerald/include/constants/berry.h
 * - public/pokeemerald/src/berry.c
 * - public/pokeemerald/include/constants/items.h
 */

export const BERRY_STAGE = {
  NO_BERRY: 0,
  PLANTED: 1,
  SPROUTED: 2,
  TALLER: 3,
  FLOWERING: 4,
  BERRIES: 5,
  SPARKLING: 255,
} as const;

export const NUM_WATER_STAGES = 4;
export const BERRY_TREES_COUNT = 128;
export const FIRST_BERRY_ITEM_ID = 133;
export const LAST_BERRY_ITEM_ID = 175;
export const ENIGMA_BERRY_ITEM_ID = 175;

export interface BerryGrowthConfig {
  minYield: number;
  maxYield: number;
  stageDurationHours: number;
}

// Keys are berryType values (ITEM_TO_BERRY(itemId) = itemId - FIRST_BERRY_ITEM_ID + 1)
// Index 0 is intentionally omitted.
export const BERRY_GROWTH_BY_TYPE: Record<number, BerryGrowthConfig> = {
  1: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // CHERI
  2: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // CHESTO
  3: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // PECHA
  4: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // RAWST
  5: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // ASPEAR
  6: { minYield: 2, maxYield: 3, stageDurationHours: 4 }, // LEPPA
  7: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // ORAN
  8: { minYield: 2, maxYield: 3, stageDurationHours: 3 }, // PERSIM
  9: { minYield: 1, maxYield: 2, stageDurationHours: 12 }, // LUM
  10: { minYield: 2, maxYield: 3, stageDurationHours: 6 }, // SITRUS
  11: { minYield: 2, maxYield: 3, stageDurationHours: 6 }, // FIGY
  12: { minYield: 2, maxYield: 3, stageDurationHours: 6 }, // WIKI
  13: { minYield: 2, maxYield: 3, stageDurationHours: 6 }, // MAGO
  14: { minYield: 2, maxYield: 3, stageDurationHours: 6 }, // AGUAV
  15: { minYield: 2, maxYield: 3, stageDurationHours: 6 }, // IAPAPA
  16: { minYield: 3, maxYield: 6, stageDurationHours: 1 }, // RAZZ
  17: { minYield: 3, maxYield: 6, stageDurationHours: 1 }, // BLUK
  18: { minYield: 3, maxYield: 6, stageDurationHours: 1 }, // NANAB
  19: { minYield: 3, maxYield: 6, stageDurationHours: 1 }, // WEPEAR
  20: { minYield: 3, maxYield: 6, stageDurationHours: 1 }, // PINAP
  21: { minYield: 2, maxYield: 6, stageDurationHours: 3 }, // POMEG
  22: { minYield: 2, maxYield: 6, stageDurationHours: 3 }, // KELPSY
  23: { minYield: 2, maxYield: 6, stageDurationHours: 3 }, // QUALOT
  24: { minYield: 2, maxYield: 6, stageDurationHours: 3 }, // HONDEW
  25: { minYield: 2, maxYield: 6, stageDurationHours: 3 }, // GREPA
  26: { minYield: 2, maxYield: 4, stageDurationHours: 6 }, // TAMATO
  27: { minYield: 2, maxYield: 4, stageDurationHours: 6 }, // CORNN
  28: { minYield: 2, maxYield: 4, stageDurationHours: 6 }, // MAGOST
  29: { minYield: 2, maxYield: 4, stageDurationHours: 6 }, // RABUTA
  30: { minYield: 2, maxYield: 4, stageDurationHours: 6 }, // NOMEL
  31: { minYield: 1, maxYield: 2, stageDurationHours: 18 }, // SPELON
  32: { minYield: 1, maxYield: 2, stageDurationHours: 18 }, // PAMTRE
  33: { minYield: 1, maxYield: 2, stageDurationHours: 18 }, // WATMEL
  34: { minYield: 1, maxYield: 2, stageDurationHours: 18 }, // DURIN
  35: { minYield: 1, maxYield: 2, stageDurationHours: 18 }, // BELUE
  36: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // LIECHI
  37: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // GANLON
  38: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // SALAC
  39: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // PETAYA
  40: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // APICOT
  41: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // LANSAT
  42: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // STARF
  43: { minYield: 1, maxYield: 2, stageDurationHours: 24 }, // ENIGMA
};

export const BERRY_STAGE_CONSTANTS: Record<string, number> = {
  BERRY_STAGE_NO_BERRY: BERRY_STAGE.NO_BERRY,
  BERRY_STAGE_PLANTED: BERRY_STAGE.PLANTED,
  BERRY_STAGE_SPROUTED: BERRY_STAGE.SPROUTED,
  BERRY_STAGE_TALLER: BERRY_STAGE.TALLER,
  BERRY_STAGE_FLOWERING: BERRY_STAGE.FLOWERING,
  BERRY_STAGE_BERRIES: BERRY_STAGE.BERRIES,
  BERRY_STAGE_SPARKLING: BERRY_STAGE.SPARKLING,
};

export const BERRY_TREE_CONSTANTS: Record<string, number> = {
  BERRY_TREE_ROUTE_102_PECHA: 1,
  BERRY_TREE_ROUTE_102_ORAN: 2,
  BERRY_TREE_ROUTE_104_SOIL_1: 3,
  BERRY_TREE_ROUTE_104_ORAN_1: 4,
  BERRY_TREE_ROUTE_103_CHERI_1: 5,
  BERRY_TREE_ROUTE_103_LEPPA: 6,
  BERRY_TREE_ROUTE_103_CHERI_2: 7,
  BERRY_TREE_ROUTE_104_CHERI_1: 8,
  BERRY_TREE_ROUTE_104_SOIL_2: 9,
  BERRY_TREE_ROUTE_104_LEPPA: 10,
  BERRY_TREE_ROUTE_104_ORAN_2: 11,
  BERRY_TREE_ROUTE_104_SOIL_3: 12,
  BERRY_TREE_ROUTE_104_PECHA: 13,
  BERRY_TREE_ROUTE_123_QUALOT_1: 14,
  BERRY_TREE_ROUTE_123_POMEG_1: 15,
  BERRY_TREE_ROUTE_110_NANAB_1: 16,
  BERRY_TREE_ROUTE_110_NANAB_2: 17,
  BERRY_TREE_ROUTE_110_NANAB_3: 18,
  BERRY_TREE_ROUTE_111_RAZZ_1: 19,
  BERRY_TREE_ROUTE_111_RAZZ_2: 20,
  BERRY_TREE_ROUTE_112_RAWST_1: 21,
  BERRY_TREE_ROUTE_112_PECHA_1: 22,
  BERRY_TREE_ROUTE_112_PECHA_2: 23,
  BERRY_TREE_ROUTE_112_RAWST_2: 24,
  BERRY_TREE_ROUTE_116_PINAP_1: 25,
  BERRY_TREE_ROUTE_116_CHESTO_1: 26,
  BERRY_TREE_ROUTE_117_WEPEAR_1: 27,
  BERRY_TREE_ROUTE_117_WEPEAR_2: 28,
  BERRY_TREE_ROUTE_117_WEPEAR_3: 29,
  BERRY_TREE_ROUTE_123_POMEG_2: 30,
  BERRY_TREE_ROUTE_118_SITRUS_1: 31,
  BERRY_TREE_ROUTE_118_SOIL: 32,
  BERRY_TREE_ROUTE_118_SITRUS_2: 33,
  BERRY_TREE_ROUTE_119_POMEG_1: 34,
  BERRY_TREE_ROUTE_119_POMEG_2: 35,
  BERRY_TREE_ROUTE_119_POMEG_3: 36,
  BERRY_TREE_ROUTE_120_ASPEAR_1: 37,
  BERRY_TREE_ROUTE_120_ASPEAR_2: 38,
  BERRY_TREE_ROUTE_120_ASPEAR_3: 39,
  BERRY_TREE_ROUTE_120_PECHA_1: 40,
  BERRY_TREE_ROUTE_120_PECHA_2: 41,
  BERRY_TREE_ROUTE_120_PECHA_3: 42,
  BERRY_TREE_ROUTE_120_RAZZ: 43,
  BERRY_TREE_ROUTE_120_NANAB: 44,
  BERRY_TREE_ROUTE_120_PINAP: 45,
  BERRY_TREE_ROUTE_120_WEPEAR: 46,
  BERRY_TREE_ROUTE_121_PERSIM: 47,
  BERRY_TREE_ROUTE_121_ASPEAR: 48,
  BERRY_TREE_ROUTE_121_RAWST: 49,
  BERRY_TREE_ROUTE_121_CHESTO: 50,
  BERRY_TREE_ROUTE_121_SOIL_1: 51,
  BERRY_TREE_ROUTE_121_NANAB_1: 52,
  BERRY_TREE_ROUTE_121_NANAB_2: 53,
  BERRY_TREE_ROUTE_121_SOIL_2: 54,
  BERRY_TREE_ROUTE_115_BLUK_1: 55,
  BERRY_TREE_ROUTE_115_BLUK_2: 56,
  BERRY_TREE_UNUSED: 57,
  BERRY_TREE_ROUTE_123_POMEG_3: 58,
  BERRY_TREE_ROUTE_123_POMEG_4: 59,
  BERRY_TREE_ROUTE_123_GREPA_1: 60,
  BERRY_TREE_ROUTE_123_GREPA_2: 61,
  BERRY_TREE_ROUTE_123_LEPPA_1: 62,
  BERRY_TREE_ROUTE_123_SOIL: 63,
  BERRY_TREE_ROUTE_123_LEPPA_2: 64,
  BERRY_TREE_ROUTE_123_GREPA_3: 65,
  BERRY_TREE_ROUTE_116_CHESTO_2: 66,
  BERRY_TREE_ROUTE_116_PINAP_2: 67,
  BERRY_TREE_ROUTE_114_PERSIM_1: 68,
  BERRY_TREE_ROUTE_115_KELPSY_1: 69,
  BERRY_TREE_ROUTE_115_KELPSY_2: 70,
  BERRY_TREE_ROUTE_115_KELPSY_3: 71,
  BERRY_TREE_ROUTE_123_GREPA_4: 72,
  BERRY_TREE_ROUTE_123_QUALOT_2: 73,
  BERRY_TREE_ROUTE_123_QUALOT_3: 74,
  BERRY_TREE_ROUTE_104_SOIL_4: 75,
  BERRY_TREE_ROUTE_104_CHERI_2: 76,
  BERRY_TREE_ROUTE_114_PERSIM_2: 77,
  BERRY_TREE_ROUTE_114_PERSIM_3: 78,
  BERRY_TREE_ROUTE_123_QUALOT_4: 79,
  BERRY_TREE_ROUTE_111_ORAN_1: 80,
  BERRY_TREE_ROUTE_111_ORAN_2: 81,
  BERRY_TREE_ROUTE_130_LIECHI: 82,
  BERRY_TREE_ROUTE_119_HONDEW_1: 83,
  BERRY_TREE_ROUTE_119_HONDEW_2: 84,
  BERRY_TREE_ROUTE_119_SITRUS: 85,
  BERRY_TREE_ROUTE_119_LEPPA: 86,
  BERRY_TREE_ROUTE_123_PECHA: 87,
  BERRY_TREE_ROUTE_123_SITRUS: 88,
  BERRY_TREE_ROUTE_123_RAWST: 89,
};

export function getDefaultBerryGrowth(berryType: number): BerryGrowthConfig {
  return BERRY_GROWTH_BY_TYPE[berryType] ?? BERRY_GROWTH_BY_TYPE[1];
}

export function itemIdToBerryType(itemId: number): number {
  const clamped = Math.max(FIRST_BERRY_ITEM_ID, Math.min(LAST_BERRY_ITEM_ID, itemId));
  return clamped - FIRST_BERRY_ITEM_ID + 1;
}

export function berryTypeToItemId(berryType: number): number {
  const itemId = FIRST_BERRY_ITEM_ID + berryType - 1;
  if (itemId < FIRST_BERRY_ITEM_ID || itemId > LAST_BERRY_ITEM_ID) {
    return FIRST_BERRY_ITEM_ID;
  }
  return itemId;
}

export function resolveBerryTreeId(value: string | number): number {
  if (typeof value === 'number') return value;
  if (value in BERRY_TREE_CONSTANTS) {
    return BERRY_TREE_CONSTANTS[value];
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return 0;
}
