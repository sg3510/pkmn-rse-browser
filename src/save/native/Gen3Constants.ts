/**
 * Gen3 Save Format Constants
 *
 * Contains all offsets, sizes, and magic numbers for parsing
 * Pokemon Emerald/Ruby/Sapphire save files.
 *
 * Reference: https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_III)
 */

/** Expected size of a full save file (128KB) */
export const SAVE_SIZE_FULL = 0x20000; // 131072 bytes

/** Size of a single save slot (64KB) */
export const SAVE_SLOT_SIZE = 0x10000; // 65536 bytes

/** Size of a single sector */
export const SECTOR_SIZE = 0x1000; // 4096 bytes

/** Number of sectors per save slot */
export const SECTORS_PER_SLOT = 14;

/** Size of usable data in a sector (excluding footer) */
export const SECTOR_DATA_SIZE = 0xF80; // 3968 bytes

/** Sector footer offsets (relative to sector start) */
export const SECTOR_FOOTER = {
  /** Section ID (which section this sector contains) */
  SECTION_ID: 0xFF4, // u16
  /** Checksum of sector data */
  CHECKSUM: 0xFF6, // u16
  /** Save signature (should be 0x08012025) */
  SIGNATURE: 0xFF8, // u32
  /** Save counter (incremented on each save) */
  SAVE_COUNTER: 0xFFC, // u32
} as const;

/** Expected save signature */
export const SAVE_SIGNATURE = 0x08012025;

/** Section sizes for each section ID */
export const SECTION_SIZES: Record<number, number> = {
  0: 0xF80, // Section 0: SaveBlock2 (partial)
  1: 0xF80, // Section 1: SaveBlock1 part 1
  2: 0xF80, // Section 2: SaveBlock1 part 2
  3: 0xF80, // Section 3: SaveBlock1 part 3
  // Vanilla Emerald SaveBlock1 size is 0x3D88, so chunk 4 is 0xF08.
  4: 0xF08, // Section 4: SaveBlock1 part 4 (smaller)
  5: 0xF80, // Sections 5-13: PC storage
  6: 0xF80,
  7: 0xF80,
  8: 0xF80,
  9: 0xF80,
  10: 0xF80,
  11: 0xF80,
  12: 0xF80,
  13: 0x7D0, // Section 13: PC storage (smaller, last)
};

/**
 * SaveBlock2 offsets (Section 0)
 * Contains player identity, options, and game info
 */
export const SAVEBLOCK2 = {
  /** Player name (7 chars + terminator) */
  PLAYER_NAME: 0x00,
  PLAYER_NAME_LENGTH: 8,

  /** Player gender (0 = male, 1 = female) */
  GENDER: 0x08,

  /** Unused byte */
  UNUSED_09: 0x09,

  /** Trainer ID (public ID, u16) */
  TRAINER_ID: 0x0A,

  /** Secret ID (used for shiny calc, u16) */
  SECRET_ID: 0x0C,

  /** Play time */
  PLAY_TIME_HOURS: 0x0E, // u16
  PLAY_TIME_MINUTES: 0x10, // u8
  PLAY_TIME_SECONDS: 0x11, // u8
  PLAY_TIME_FRAMES: 0x12, // u8 (60fps counter)

  /** Options byte */
  OPTIONS: 0x13,

  /** Options additional fields */
  OPTIONS_BUTTON_MODE: 0x13,
  OPTIONS_TEXT_SPEED: 0x14,
  OPTIONS_BATTLE: 0x15,

  /** Encryption key (Emerald only, at 0xAC) */
  ENCRYPTION_KEY: 0xAC, // u32

  /** Region info */
  REGION_MAP_ZOOM: 0x16,

  /** Pokedex flags */
  POKEDEX_OWNED: 0x28, // bitfield
  POKEDEX_SEEN: 0x44, // bitfield
} as const;

/**
 * SaveBlock1 offsets (Sections 1-4 concatenated)
 * Contains player state, inventory, flags, and party
 */
export const SAVEBLOCK1 = {
  /** Current position */
  POS_X: 0x00, // s16
  POS_Y: 0x02, // s16

  /** Current location warp data (where player is now) */
  LOCATION_WARP: 0x04,
  // WarpData: mapGroup (1), mapNum (1), warpId (1), x (s16), y (s16) = 8 bytes

  /** Continue game warp (where to spawn on load) */
  CONTINUE_GAME_WARP: 0x0C,

  /** Dynamic warps (used by scripts) */
  DYNAMIC_WARP_1: 0x14,
  DYNAMIC_WARP_2: 0x1C,

  /** Last heal location (Pokemon Center) */
  LAST_HEAL_LOCATION: 0x1C,

  /** Escape warp (for Escape Rope / Dig) */
  ESCAPE_WARP: 0x24,

  /** Saved map view position */
  SAVED_MAP_VIEW: 0x2C,

  /** Party Pokemon count */
  PARTY_COUNT: 0x234, // u32

  /** Party Pokemon data (6 * 100 bytes) */
  PARTY_DATA: 0x238,
  PARTY_ENTRY_SIZE: 100,
  PARTY_MAX_SIZE: 6,

  /** Money (XOR encrypted in Emerald) */
  MONEY: 0x490, // u32

  /** Game Corner coins (XOR encrypted in Emerald) */
  COINS: 0x494, // u16

  /** Registered item for SELECT button (u16) */
  REGISTERED_ITEM: 0x496, // u16

  /** PC items (NOT encrypted) */
  PC_ITEMS: 0x498,
  PC_ITEMS_COUNT: 50,
  PC_ITEMS_ENTRY_SIZE: 4, // u16 itemId, u16 quantity

  /** Bag items (quantity XOR encrypted in Emerald) */
  BAG_ITEMS: 0x560,
  BAG_ITEMS_COUNT: 30,

  BAG_KEY_ITEMS: 0x5D8,
  BAG_KEY_ITEMS_COUNT: 30,

  BAG_POKE_BALLS: 0x650,
  BAG_POKE_BALLS_COUNT: 16,

  BAG_TM_HM: 0x690,
  BAG_TM_HM_COUNT: 64,

  BAG_BERRIES: 0x790,
  BAG_BERRIES_COUNT: 46,

  /** Game flags (bitfield) */
  FLAGS: 0x1270,
  FLAGS_SIZE: 0x12C, // 300 bytes = 2400 flags

  /** Game variables (256 u16 values) */
  VARS: 0x139C,
  VARS_COUNT: 256,

  /** Game stats (XOR encrypted) */
  GAME_STATS: 0x159C,
  GAME_STATS_SIZE: 0x64,

  /** Runtime object events (temporary NPC runtime state) */
  OBJECT_EVENTS: 0x0A30,
  OBJECT_EVENTS_COUNT: 16,
  OBJECT_EVENT_SIZE: 0x24,
} as const;

/**
 * WarpData structure size
 */
export const WARP_DATA_SIZE = 8;

/**
 * Item slot structure (u16 itemId, u16 quantity)
 */
export const ITEM_SLOT_SIZE = 4;

/**
 * Pokemon structure sizes
 */
export const POKEMON = {
  /** Box Pokemon size (encrypted data only) */
  BOX_SIZE: 80,
  /** Party Pokemon size (includes battle stats) */
  PARTY_SIZE: 100,
  /** Encrypted data block size */
  ENCRYPTED_DATA_SIZE: 48,
  /** Number of substructures */
  SUBSTRUCTURE_COUNT: 4,
  /** Size of each substructure */
  SUBSTRUCTURE_SIZE: 12,
} as const;

/**
 * Game detection constants
 */
export const GAME_DETECTION = {
  /** Emerald has encryption key at 0xAC in SaveBlock2 */
  EMERALD_KEY_OFFSET: 0xAC,
  /** Ruby/Sapphire use 0 as encryption key (no XOR) */
  RS_ENCRYPTION_KEY: 0,
} as const;
