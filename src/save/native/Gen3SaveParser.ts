/**
 * Gen3SaveParser - Parse Pokemon Emerald/Ruby/Sapphire .sav files
 *
 * Parses native GBA save files and converts them to our SaveData format.
 * Supports both Emerald (encrypted) and Ruby/Sapphire (unencrypted) saves.
 *
 * Save Structure:
 * - 128KB file with two 64KB slots (A and B)
 * - Each slot has 14 sectors (4KB each)
 * - Sectors rotate, so sectionId in footer maps to actual data
 * - Active slot determined by highest saveCounter
 */

import {
  SAVE_SIZE_FULL,
  SAVE_SLOT_SIZE,
  SECTOR_SIZE,
  SECTORS_PER_SLOT,
  SECTOR_DATA_SIZE,
  SECTOR_FOOTER,
  SAVE_SIGNATURE,
  SECTION_SIZES,
  SAVEBLOCK2,
  SAVEBLOCK1,
  ITEM_SLOT_SIZE,
} from './Gen3Constants';
import { decodeGen3String } from './Gen3Charset';
import { mapGroupNumToMapId } from './mapResolver';
import { parseParty } from './Gen3Pokemon';
import { FLAG_ID_TO_NAME, VAR_ID_TO_NAME } from '../../data/flagVarMaps.gen';
import type {
  SaveData,
  PlayerProfile,
  PlayTime,
  LocationState,
  WarpData,
  MoneyState,
  BagState,
  PCItemsState,
  ItemSlot,
} from '../types';
import type { PartyPokemon } from '../../pokemon/types';

/**
 * Native save metadata (preserved for round-trip export)
 */
export interface NativeMetadata {
  game: 'E' | 'RS';
  activeSlot: 'A' | 'B';
  saveCounter: number;
  encryptionKey: number;
  sectorOrder: number[];
  checksumFailures: number[];
  rawLength: number;
  sourceFilename?: string;
}

/**
 * Parsed sector information
 */
interface SectorInfo {
  offset: number;
  sectionId: number;
  checksum: number;
  signature: number;
  saveCounter: number;
  checksumValid: boolean;
}

/**
 * Section map: sectionId → sector offset
 */
type SectionMap = Map<number, number>;

/**
 * Parse result from the parser
 */
export interface Gen3ParseResult {
  success: boolean;
  error?: string;
  saveData?: SaveData;
  nativeMetadata?: NativeMetadata;
}

/**
 * Calculate checksum for a sector
 * Sum of all u32 values in first 0xF80 bytes, truncated to u16
 */
function calculateChecksum(data: DataView, sectorOffset: number): number {
  let sum = 0;
  for (let i = 0; i < SECTOR_DATA_SIZE; i += 4) {
    sum += data.getUint32(sectorOffset + i, true);
  }
  return ((sum & 0xFFFF) + (sum >>> 16)) & 0xFFFF;
}

/**
 * Read sector footer information
 */
function readSectorInfo(data: DataView, sectorOffset: number): SectorInfo {
  const sectionId = data.getUint16(sectorOffset + SECTOR_FOOTER.SECTION_ID, true);
  const checksum = data.getUint16(sectorOffset + SECTOR_FOOTER.CHECKSUM, true);
  const signature = data.getUint32(sectorOffset + SECTOR_FOOTER.SIGNATURE, true);
  const saveCounter = data.getUint32(sectorOffset + SECTOR_FOOTER.SAVE_COUNTER, true);

  const calculatedChecksum = calculateChecksum(data, sectorOffset);
  const checksumValid = checksum === calculatedChecksum;

  return {
    offset: sectorOffset,
    sectionId,
    checksum,
    signature,
    saveCounter,
    checksumValid,
  };
}

/**
 * Build section map for a slot
 * Returns map of sectionId → sector offset
 */
function buildSectionMap(data: DataView, slotOffset: number): { map: SectionMap; saveCounter: number; failures: number[] } {
  const map: SectionMap = new Map();
  const failures: number[] = [];
  let saveCounter = 0;

  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    const sectorOffset = slotOffset + i * SECTOR_SIZE;
    const info = readSectorInfo(data, sectorOffset);

    // Validate signature
    if (info.signature !== SAVE_SIGNATURE) {
      continue;
    }

    // Track checksum failures
    if (!info.checksumValid) {
      failures.push(info.sectionId);
    }

    // Map sectionId to offset
    if (info.sectionId < SECTORS_PER_SLOT) {
      map.set(info.sectionId, sectorOffset);
    }

    // Track save counter from section 0
    if (info.sectionId === 0) {
      saveCounter = info.saveCounter;
    }
  }

  return { map, saveCounter, failures };
}

/**
 * Check if all main sections (0-13) are present
 */
function isSlotValid(sectionMap: SectionMap): boolean {
  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    if (!sectionMap.has(i)) {
      return false;
    }
  }
  return true;
}

/**
 * Read a warp data structure from SaveBlock1
 */
function readWarpData(
  data: DataView,
  offset: number,
  sectionMap: SectionMap,
  _saveBlock1Base: number
): WarpData | null {
  // Calculate which section this offset falls into
  // Sections 1-4 make up SaveBlock1
  let remainingOffset = offset;
  let sectionId = 1;

  while (sectionId <= 4) {
    const sectionSize = SECTION_SIZES[sectionId];
    if (remainingOffset < sectionSize) {
      break;
    }
    remainingOffset -= sectionSize;
    sectionId++;
  }

  if (sectionId > 4) return null;

  const sectorOffset = sectionMap.get(sectionId);
  if (sectorOffset === undefined) return null;

  const actualOffset = sectorOffset + remainingOffset;

  const mapGroup = data.getUint8(actualOffset);
  const mapNum = data.getUint8(actualOffset + 1);
  const warpId = data.getInt8(actualOffset + 2);
  const x = data.getInt16(actualOffset + 4, true);
  const y = data.getInt16(actualOffset + 6, true);

  // Resolve mapGroup/mapNum to our mapId
  const resolved = mapGroupNumToMapId(mapGroup, mapNum);
  const mapId = resolved?.mapId ?? 'MAP_LITTLEROOT_TOWN';

  return {
    mapId,
    warpId,
    x,
    y,
  };
}

/**
 * Read a value from SaveBlock1 (spans sections 1-4)
 * Note: data parameter is captured by readFn closure from caller
 */
function readFromSaveBlock1(
  _data: DataView,
  offset: number,
  sectionMap: SectionMap,
  readFn: (offset: number) => number
): number {
  // Calculate which section this offset falls into
  let remainingOffset = offset;
  let sectionId = 1;
  let accumulatedSize = 0;

  while (sectionId <= 4) {
    const sectionSize = SECTION_SIZES[sectionId];
    if (remainingOffset < sectionSize) {
      break;
    }
    remainingOffset -= sectionSize;
    accumulatedSize += sectionSize;
    sectionId++;
  }

  if (sectionId > 4) return 0;

  const sectorOffset = sectionMap.get(sectionId);
  if (sectorOffset === undefined) return 0;

  return readFn(sectorOffset + remainingOffset);
}

/**
 * Read item slots from a bag pocket
 */
function readItemSlots(
  data: DataView,
  offset: number,
  count: number,
  sectionMap: SectionMap,
  encryptionKey: number
): ItemSlot[] {
  const items: ItemSlot[] = [];

  for (let i = 0; i < count; i++) {
    const slotOffset = offset + i * ITEM_SLOT_SIZE;

    // Read item ID and quantity
    const itemId = readFromSaveBlock1(data, slotOffset, sectionMap, (o) => data.getUint16(o, true));
    let quantity = readFromSaveBlock1(data, slotOffset + 2, sectionMap, (o) => data.getUint16(o, true));

    // XOR decrypt quantity (Emerald only)
    if (encryptionKey !== 0) {
      quantity ^= (encryptionKey & 0xFFFF);
    }

    if (itemId !== 0 && quantity > 0) {
      items.push({ itemId, quantity });
    }
  }

  return items;
}

/**
 * Parse the flag bitfield from SaveBlock1 (300 bytes at FLAGS offset)
 * Each bit represents one flag; look up the name from FLAG_ID_TO_NAME
 */
function parseFlags(data: DataView, sectionMap: SectionMap): string[] {
  const flags: string[] = [];
  const flagsSize = SAVEBLOCK1.FLAGS_SIZE; // 300 bytes = 2400 possible flags

  for (let byteIdx = 0; byteIdx < flagsSize; byteIdx++) {
    const byte = readFromSaveBlock1(
      data,
      SAVEBLOCK1.FLAGS + byteIdx,
      sectionMap,
      (o) => data.getUint8(o)
    );
    if (byte === 0) continue; // Fast-skip zero bytes

    for (let bit = 0; bit < 8; bit++) {
      if (byte & (1 << bit)) {
        const flagId = byteIdx * 8 + bit;
        const name = FLAG_ID_TO_NAME[flagId];
        if (name) {
          flags.push(name);
        }
      }
    }
  }

  return flags;
}

/**
 * Parse game variables from SaveBlock1 (256 u16 values at VARS offset)
 * Var ID = 0x4000 + index; look up name from VAR_ID_TO_NAME
 */
function parseVars(data: DataView, sectionMap: SectionMap): Record<string, number> {
  const vars: Record<string, number> = {};
  const varsCount = SAVEBLOCK1.VARS_COUNT; // 256

  for (let i = 0; i < varsCount; i++) {
    const value = readFromSaveBlock1(
      data,
      SAVEBLOCK1.VARS + i * 2,
      sectionMap,
      (o) => data.getUint16(o, true)
    );
    if (value === 0) continue; // Skip zero-value vars

    const varId = 0x4000 + i;
    const name = VAR_ID_TO_NAME[varId];
    if (name) {
      vars[name] = value;
    }
  }

  return vars;
}

/**
 * Main parser function
 */
export function parseGen3Save(buffer: ArrayBuffer, filename?: string): Gen3ParseResult {
  // Normalize buffer size (drop trailing bytes if present)
  let normalizedBuffer = buffer;
  if (buffer.byteLength > SAVE_SIZE_FULL) {
    normalizedBuffer = buffer.slice(0, SAVE_SIZE_FULL);
  } else if (buffer.byteLength < SAVE_SLOT_SIZE) {
    return { success: false, error: `File too small: ${buffer.byteLength} bytes (expected at least ${SAVE_SLOT_SIZE})` };
  }

  const data = new DataView(normalizedBuffer);

  // Try to find valid slot
  let activeSlot: 'A' | 'B' = 'A';
  let activeSectionMap: SectionMap = new Map();
  let activeSaveCounter = 0;
  let checksumFailures: number[] = [];

  // Check slot A
  const slotA = buildSectionMap(data, 0);
  const slotAValid = isSlotValid(slotA.map);

  // Check slot B (if file is large enough)
  let slotBValid = false;
  let slotB = { map: new Map<number, number>(), saveCounter: 0, failures: [] as number[] };
  if (normalizedBuffer.byteLength >= SAVE_SIZE_FULL) {
    slotB = buildSectionMap(data, SAVE_SLOT_SIZE);
    slotBValid = isSlotValid(slotB.map);
  }

  // Determine active slot
  if (slotAValid && slotBValid) {
    // Both valid, use higher save counter
    if (slotB.saveCounter > slotA.saveCounter) {
      activeSlot = 'B';
      activeSectionMap = slotB.map;
      activeSaveCounter = slotB.saveCounter;
      checksumFailures = slotB.failures;
    } else {
      activeSlot = 'A';
      activeSectionMap = slotA.map;
      activeSaveCounter = slotA.saveCounter;
      checksumFailures = slotA.failures;
    }
  } else if (slotAValid) {
    activeSlot = 'A';
    activeSectionMap = slotA.map;
    activeSaveCounter = slotA.saveCounter;
    checksumFailures = slotA.failures;
  } else if (slotBValid) {
    activeSlot = 'B';
    activeSectionMap = slotB.map;
    activeSaveCounter = slotB.saveCounter;
    checksumFailures = slotB.failures;
  } else {
    return { success: false, error: 'No valid save slot found' };
  }

  // Get section 0 offset for SaveBlock2
  const section0Offset = activeSectionMap.get(0);
  if (section0Offset === undefined) {
    return { success: false, error: 'Section 0 not found' };
  }

  // === Parse SaveBlock2 (Section 0) ===

  // Player name
  const nameBytes = new Uint8Array(normalizedBuffer, section0Offset + SAVEBLOCK2.PLAYER_NAME, SAVEBLOCK2.PLAYER_NAME_LENGTH);
  const playerName = decodeGen3String(nameBytes);

  // Gender
  const gender = data.getUint8(section0Offset + SAVEBLOCK2.GENDER) as 0 | 1;

  // Trainer IDs
  const trainerId = data.getUint16(section0Offset + SAVEBLOCK2.TRAINER_ID, true);
  const secretId = data.getUint16(section0Offset + SAVEBLOCK2.SECRET_ID, true);

  // Play time
  const playTimeHours = data.getUint16(section0Offset + SAVEBLOCK2.PLAY_TIME_HOURS, true);
  const playTimeMinutes = data.getUint8(section0Offset + SAVEBLOCK2.PLAY_TIME_MINUTES);
  const playTimeSeconds = data.getUint8(section0Offset + SAVEBLOCK2.PLAY_TIME_SECONDS);

  // Encryption key (Emerald only)
  const encryptionKey = data.getUint32(section0Offset + SAVEBLOCK2.ENCRYPTION_KEY, true);
  const isEmerald = encryptionKey !== 0;

  // === Parse SaveBlock1 (Sections 1-4) ===

  // Position
  const posX = readFromSaveBlock1(data, SAVEBLOCK1.POS_X, activeSectionMap, (o) => data.getInt16(o, true));
  const posY = readFromSaveBlock1(data, SAVEBLOCK1.POS_Y, activeSectionMap, (o) => data.getInt16(o, true));

  // Location warp
  const locationWarp = readWarpData(data, SAVEBLOCK1.LOCATION_WARP, activeSectionMap, 0);
  const continueGameWarp = readWarpData(data, SAVEBLOCK1.CONTINUE_GAME_WARP, activeSectionMap, 0);
  const lastHealLocation = readWarpData(data, SAVEBLOCK1.LAST_HEAL_LOCATION, activeSectionMap, 0);
  const escapeWarp = readWarpData(data, SAVEBLOCK1.ESCAPE_WARP, activeSectionMap, 0);

  // Money (XOR encrypted)
  let money = readFromSaveBlock1(data, SAVEBLOCK1.MONEY, activeSectionMap, (o) => data.getUint32(o, true));
  if (isEmerald) {
    money ^= encryptionKey;
  }

  // Coins (XOR encrypted, lower 16 bits of key)
  let coins = readFromSaveBlock1(data, SAVEBLOCK1.COINS, activeSectionMap, (o) => data.getUint16(o, true));
  if (isEmerald) {
    coins ^= (encryptionKey & 0xFFFF);
  }

  // PC Items (NOT encrypted)
  const pcItems = readItemSlots(
    data,
    SAVEBLOCK1.PC_ITEMS,
    SAVEBLOCK1.PC_ITEMS_COUNT,
    activeSectionMap,
    0 // PC items are not encrypted
  );

  // Bag pockets (quantity XOR encrypted)
  const bagItems = readItemSlots(data, SAVEBLOCK1.BAG_ITEMS, SAVEBLOCK1.BAG_ITEMS_COUNT, activeSectionMap, encryptionKey);
  const keyItems = readItemSlots(data, SAVEBLOCK1.BAG_KEY_ITEMS, SAVEBLOCK1.BAG_KEY_ITEMS_COUNT, activeSectionMap, encryptionKey);
  const pokeBalls = readItemSlots(data, SAVEBLOCK1.BAG_POKE_BALLS, SAVEBLOCK1.BAG_POKE_BALLS_COUNT, activeSectionMap, encryptionKey);
  const tmHm = readItemSlots(data, SAVEBLOCK1.BAG_TM_HM, SAVEBLOCK1.BAG_TM_HM_COUNT, activeSectionMap, encryptionKey);
  const berries = readItemSlots(data, SAVEBLOCK1.BAG_BERRIES, SAVEBLOCK1.BAG_BERRIES_COUNT, activeSectionMap, encryptionKey);

  // === Parse Pokemon Party ===
  const partyPokemon: PartyPokemon[] = parseParty(data, activeSectionMap);
  console.log(`[Gen3SaveParser] Parsed ${partyPokemon.length} Pokemon in party`);

  // === Parse Flags & Variables ===
  const parsedFlags = parseFlags(data, activeSectionMap);
  const parsedVars = parseVars(data, activeSectionMap);
  console.log(`[Gen3SaveParser] Parsed ${parsedFlags.length} flags, ${Object.keys(parsedVars).length} vars`);

  // === Build SaveData ===

  const profile: PlayerProfile = {
    name: playerName,
    gender,
    trainerId,
    secretId,
  };

  const playTime: PlayTime = {
    hours: playTimeHours,
    minutes: playTimeMinutes,
    seconds: playTimeSeconds,
  };

  // Default warp values
  const defaultWarp: WarpData = {
    mapId: 'MAP_LITTLEROOT_TOWN',
    warpId: 0,
    x: 5,
    y: 3,
  };

  const location: LocationState = {
    pos: { x: posX, y: posY },
    location: locationWarp ?? defaultWarp,
    continueGameWarp: continueGameWarp ?? defaultWarp,
    lastHealLocation: lastHealLocation ?? defaultWarp,
    escapeWarp: escapeWarp ?? defaultWarp,
    direction: 'down', // Default direction (TODO: parse from save)
    elevation: 3, // Default elevation
    isSurfing: false,
  };

  const moneyState: MoneyState = {
    money,
    coins,
  };

  const bag: BagState = {
    items: bagItems,
    keyItems,
    pokeBalls,
    tmHm,
    berries,
  };

  const pcItemsState: PCItemsState = {
    items: pcItems,
  };

  // Build party state for SaveData
  const partyState = {
    pokemon: partyPokemon.map(p => ({
      species: p.species,
      nickname: p.nickname,
      otName: p.otName,
      otId: p.otId,
      level: p.level,
      experience: p.experience,
    })),
    count: partyPokemon.length,
  };

  const saveData: SaveData = {
    version: 1,
    timestamp: Date.now(),
    profile,
    playTime,
    location,
    money: moneyState,
    bag,
    pcItems: pcItemsState,
    party: partyState,
    flags: parsedFlags,
    vars: parsedVars,
    // Store full party data in a custom field for our use
    _fullParty: partyPokemon,
  } as SaveData & { _fullParty: PartyPokemon[] };

  const nativeMetadata: NativeMetadata = {
    game: isEmerald ? 'E' : 'RS',
    activeSlot,
    saveCounter: activeSaveCounter,
    encryptionKey,
    sectorOrder: Array.from(activeSectionMap.values()).map((_, i) => i),
    checksumFailures,
    rawLength: normalizedBuffer.byteLength,
    sourceFilename: filename,
  };

  return {
    success: true,
    saveData,
    nativeMetadata,
  };
}

/**
 * Quick validation check for a potential .sav file
 */
export function isValidGen3Save(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < SAVE_SLOT_SIZE) {
    return false;
  }

  const data = new DataView(buffer);

  // Check for valid signature in at least one sector
  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    const signature = data.getUint32(i * SECTOR_SIZE + SECTOR_FOOTER.SIGNATURE, true);
    if (signature === SAVE_SIGNATURE) {
      return true;
    }
  }

  return false;
}
