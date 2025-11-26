# Reading and Importing Pokemon Emerald Save Files

## Overview

This document provides a technical guide for reading a Pokemon Emerald `.sav` file (128KB binary) and converting it to our React-based JSON save format.

## Prerequisites

Understanding required:
- Little-endian byte ordering
- XOR encryption/decryption
- Sector-based save structure
- Pokemon substructure shuffling

---

## Step 1: Load the Binary File

```typescript
async function loadEmeraldSave(file: File): Promise<ArrayBuffer> {
  const buffer = await file.arrayBuffer();

  // Validate file size (should be 128KB or 64KB)
  if (buffer.byteLength !== 131072 && buffer.byteLength !== 65536) {
    throw new Error(`Invalid save file size: ${buffer.byteLength} bytes`);
  }

  return buffer;
}
```

---

## Step 2: Identify the Active Save Slot

Emerald uses two save slots (A and B) and alternates between them. The slot with the higher save counter is the most recent.

```typescript
const SECTOR_SIZE = 4096; // 0x1000
const SECTORS_PER_SLOT = 14;
const SLOT_A_OFFSET = 0x000000;
const SLOT_B_OFFSET = 0x00E000;

interface SectorHeader {
  sectionId: number;
  checksum: number;
  signature: number;
  saveCounter: number;
}

function readSectorHeader(data: DataView, sectorOffset: number): SectorHeader {
  return {
    sectionId: data.getUint16(sectorOffset + 0x0FF4, true),
    checksum: data.getUint16(sectorOffset + 0x0FF6, true),
    signature: data.getUint32(sectorOffset + 0x0FF8, true),
    saveCounter: data.getUint32(sectorOffset + 0x0FFC, true),
  };
}

function findActiveSaveSlot(data: DataView): { offset: number; counter: number } {
  // Read first sector of each slot to get save counter
  const slotAHeader = readSectorHeader(data, SLOT_A_OFFSET);
  const slotBHeader = readSectorHeader(data, SLOT_B_OFFSET);

  // Validate signatures
  const VALID_SIGNATURE = 0x08012025;
  const slotAValid = slotAHeader.signature === VALID_SIGNATURE;
  const slotBValid = slotBHeader.signature === VALID_SIGNATURE;

  if (!slotAValid && !slotBValid) {
    throw new Error('No valid save data found');
  }

  if (!slotBValid || (slotAValid && slotAHeader.saveCounter >= slotBHeader.saveCounter)) {
    return { offset: SLOT_A_OFFSET, counter: slotAHeader.saveCounter };
  }

  return { offset: SLOT_B_OFFSET, counter: slotBHeader.saveCounter };
}
```

---

## Step 3: Build Sector Map

Due to sector rotation, we need to map section IDs to actual sector offsets.

```typescript
interface SectorMap {
  [sectionId: number]: number; // sectionId -> byte offset
}

function buildSectorMap(data: DataView, slotOffset: number): SectorMap {
  const map: SectorMap = {};

  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    const sectorOffset = slotOffset + (i * SECTOR_SIZE);
    const header = readSectorHeader(data, sectorOffset);

    if (header.sectionId >= 0 && header.sectionId <= 13) {
      map[header.sectionId] = sectorOffset;
    }
  }

  // Verify all sections present
  for (let id = 0; id < 14; id++) {
    if (map[id] === undefined) {
      throw new Error(`Missing section ${id} in save data`);
    }
  }

  return map;
}
```

---

## Step 4: Validate Sector Checksums

```typescript
function validateSectorChecksum(data: DataView, sectorOffset: number): boolean {
  const SECTOR_DATA_SIZE = 3968;
  let sum = 0;

  // Sum all 32-bit words in data section
  for (let i = 0; i < SECTOR_DATA_SIZE; i += 4) {
    sum += data.getUint32(sectorOffset + i, true);
    sum = sum >>> 0; // Keep as unsigned 32-bit
  }

  // Fold to 16 bits
  const calculated = ((sum & 0xFFFF) + (sum >>> 16)) & 0xFFFF;
  const stored = data.getUint16(sectorOffset + 0x0FF6, true);

  return calculated === stored;
}
```

---

## Step 5: Extract SaveBlock2 (Section 0)

```typescript
interface EmeraldSaveBlock2 {
  playerName: string;
  playerGender: number;
  trainerId: number;
  secretId: number;
  playTimeHours: number;
  playTimeMinutes: number;
  playTimeSeconds: number;
  encryptionKey: number;
  options: {
    textSpeed: number;
    windowFrame: number;
    sound: number;
    battleStyle: number;
    battleSceneOff: number;
    buttonMode: number;
  };
}

function decodePlayerName(bytes: Uint8Array): string {
  // Pokemon uses proprietary text encoding
  const CHAR_MAP: { [code: number]: string } = {
    0xBB: 'A', 0xBC: 'B', 0xBD: 'C', 0xBE: 'D', 0xBF: 'E',
    0xC0: 'F', 0xC1: 'G', 0xC2: 'H', 0xC3: 'I', 0xC4: 'J',
    0xC5: 'K', 0xC6: 'L', 0xC7: 'M', 0xC8: 'N', 0xC9: 'O',
    0xCA: 'P', 0xCB: 'Q', 0xCC: 'R', 0xCD: 'S', 0xCE: 'T',
    0xCF: 'U', 0xD0: 'V', 0xD1: 'W', 0xD2: 'X', 0xD3: 'Y',
    0xD4: 'Z', 0xD5: 'a', 0xD6: 'b', 0xD7: 'c', 0xD8: 'd',
    0xD9: 'e', 0xDA: 'f', 0xDB: 'g', 0xDC: 'h', 0xDD: 'i',
    0xDE: 'j', 0xDF: 'k', 0xE0: 'l', 0xE1: 'm', 0xE2: 'n',
    0xE3: 'o', 0xE4: 'p', 0xE5: 'q', 0xE6: 'r', 0xE7: 's',
    0xE8: 't', 0xE9: 'u', 0xEA: 'v', 0xEB: 'w', 0xEC: 'x',
    0xED: 'y', 0xEE: 'z', 0xA1: '0', 0xA2: '1', 0xA3: '2',
    0xA4: '3', 0xA5: '4', 0xA6: '5', 0xA7: '6', 0xA8: '7',
    0xA9: '8', 0xAA: '9', 0xFF: '', // Terminator
    // Add more as needed (spaces, punctuation, etc.)
  };

  let result = '';
  for (const byte of bytes) {
    if (byte === 0xFF) break; // String terminator
    result += CHAR_MAP[byte] || '?';
  }
  return result;
}

function extractSaveBlock2(data: DataView, sectorMap: SectorMap): EmeraldSaveBlock2 {
  const offset = sectorMap[0]; // Section 0 is SaveBlock2

  // Read player name (8 bytes at offset 0x00)
  const nameBytes = new Uint8Array(data.buffer, offset, 8);
  const playerName = decodePlayerName(nameBytes);

  // Read other fields
  const playerGender = data.getUint8(offset + 0x08);

  // Trainer ID is split: bytes 0x0A-0x0B = public ID, 0x0C-0x0D = secret ID
  const trainerId = data.getUint16(offset + 0x0A, true);
  const secretId = data.getUint16(offset + 0x0C, true);

  const playTimeHours = data.getUint16(offset + 0x0E, true);
  const playTimeMinutes = data.getUint8(offset + 0x10);
  const playTimeSeconds = data.getUint8(offset + 0x11);

  // Options bitfield at 0x14
  const optionsBits = data.getUint16(offset + 0x14, true);
  const buttonMode = data.getUint8(offset + 0x13);

  // Encryption key at 0xAC (Emerald only)
  const encryptionKey = data.getUint32(offset + 0xAC, true);

  return {
    playerName,
    playerGender,
    trainerId,
    secretId,
    playTimeHours,
    playTimeMinutes,
    playTimeSeconds,
    encryptionKey,
    options: {
      textSpeed: optionsBits & 0x7,
      windowFrame: (optionsBits >> 3) & 0x1F,
      sound: (optionsBits >> 8) & 0x1,
      battleStyle: (optionsBits >> 9) & 0x1,
      battleSceneOff: (optionsBits >> 10) & 0x1,
      buttonMode,
    },
  };
}
```

---

## Step 6: Extract SaveBlock1 (Sections 1-4)

SaveBlock1 spans multiple sectors. We need to reassemble them.

```typescript
function reassembleSaveBlock1(data: DataView, sectorMap: SectorMap): Uint8Array {
  const SECTOR_DATA_SIZE = 3968;
  const sizes = [3968, 3968, 3968, 3848]; // Sections 1-4 data sizes
  const totalSize = sizes.reduce((a, b) => a + b, 0);
  const result = new Uint8Array(totalSize);

  let destOffset = 0;
  for (let section = 1; section <= 4; section++) {
    const srcOffset = sectorMap[section];
    const size = sizes[section - 1];
    result.set(new Uint8Array(data.buffer, srcOffset, size), destOffset);
    destOffset += size;
  }

  return result;
}

interface LocationData {
  x: number;
  y: number;
  mapGroup: number;
  mapNum: number;
  warpId: number;
}

interface EmeraldSaveBlock1 {
  position: { x: number; y: number };
  location: LocationData;
  continueGameWarp: LocationData;
  lastHealLocation: LocationData;
  escapeWarp: LocationData;
  money: number;
  coins: number;
  partyCount: number;
  // Add more fields as needed
}

function extractWarpData(data: DataView, offset: number): LocationData {
  return {
    mapGroup: data.getInt8(offset),
    mapNum: data.getInt8(offset + 1),
    warpId: data.getInt8(offset + 2),
    x: data.getInt16(offset + 4, true),
    y: data.getInt16(offset + 6, true),
  };
}

function extractSaveBlock1(
  block1Data: Uint8Array,
  encryptionKey: number
): EmeraldSaveBlock1 {
  const data = new DataView(block1Data.buffer);

  // Position at offset 0x00
  const posX = data.getInt16(0x00, true);
  const posY = data.getInt16(0x02, true);

  // Warp data
  const location = extractWarpData(data, 0x04);
  const continueGameWarp = extractWarpData(data, 0x0C);
  const lastHealLocation = extractWarpData(data, 0x1C);
  const escapeWarp = extractWarpData(data, 0x24);

  // Money at 0x490 (encrypted in Emerald)
  const encryptedMoney = data.getUint32(0x490, true);
  const money = encryptedMoney ^ encryptionKey;

  // Coins at 0x494 (encrypted)
  const encryptedCoins = data.getUint16(0x494, true);
  const coins = encryptedCoins ^ (encryptionKey & 0xFFFF);

  // Party count at 0x234
  const partyCount = data.getUint8(0x234);

  return {
    position: { x: posX, y: posY },
    location,
    continueGameWarp,
    lastHealLocation,
    escapeWarp,
    money,
    coins,
    partyCount,
  };
}
```

---

## Step 7: Extract Game Flags

Flags are stored as a bit array in SaveBlock1.

```typescript
function extractGameFlags(block1Data: Uint8Array): string[] {
  const FLAGS_OFFSET = 0x1270;
  const NUM_FLAG_BYTES = 300; // 2400 flags
  const flags: string[] = [];

  // Map of known flag indices to names (partial list)
  const FLAG_NAMES: { [index: number]: string } = {
    0x50: 'FLAG_HIDE_SKY_PILLAR_TOP_RAYQUAZA_STILL',
    0x52: 'FLAG_RESCUED_BIRCH',
    0x5A: 'FLAG_RECEIVED_BIKE',
    0x60: 'FLAG_RECEIVED_SECRET_POWER',
    0x74: 'FLAG_ADVENTURE_STARTED',
    0x89: 'FLAG_RECEIVED_HM_CUT',
    // ... add from constants/flags.h
  };

  for (let byteIdx = 0; byteIdx < NUM_FLAG_BYTES; byteIdx++) {
    const byte = block1Data[FLAGS_OFFSET + byteIdx];
    for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
      if (byte & (1 << bitIdx)) {
        const flagIndex = byteIdx * 8 + bitIdx;
        const flagName = FLAG_NAMES[flagIndex] || `FLAG_${flagIndex.toString(16).toUpperCase()}`;
        flags.push(flagName);
      }
    }
  }

  return flags;
}
```

---

## Step 8: Extract Pokemon Data

Pokemon data is the most complex due to substructure shuffling and encryption.

```typescript
const SUBSTRUCTURE_ORDER = [
  'GAEM', 'GAME', 'GEAM', 'GEMA', 'GMAE', 'GMEA',
  'AGEM', 'AGME', 'AEGM', 'AEMG', 'AMGE', 'AMEG',
  'EGAM', 'EGMA', 'EAGM', 'EAMG', 'EMGA', 'EMAG',
  'MGAE', 'MGEA', 'MAGE', 'MAEG', 'MEGA', 'MEAG',
];

interface PokemonSubstructs {
  growth: { species: number; item: number; experience: number; friendship: number };
  attacks: { moves: number[]; pp: number[] };
  evs: { hp: number; atk: number; def: number; spd: number; spa: number; spd2: number };
  misc: { pokerus: number; metLocation: number; ivs: number; ribbons: number };
}

interface DecodedPokemon {
  personality: number;
  otId: number;
  nickname: string;
  otName: string;
  species: number;
  level: number;
  heldItem: number;
  moves: number[];
  ivs: { hp: number; atk: number; def: number; spd: number; spa: number; spdef: number };
  evs: { hp: number; atk: number; def: number; spd: number; spa: number; spdef: number };
  // ... more fields
}

function decryptPokemonData(
  encryptedData: Uint8Array,
  personality: number,
  otId: number
): Uint8Array {
  const key = personality ^ otId;
  const decrypted = new Uint8Array(48);
  const view = new DataView(encryptedData.buffer, encryptedData.byteOffset);
  const outView = new DataView(decrypted.buffer);

  for (let i = 0; i < 48; i += 4) {
    const encrypted = view.getUint32(i, true);
    outView.setUint32(i, encrypted ^ key, true);
  }

  return decrypted;
}

function getSubstructureOrder(personality: number): string {
  return SUBSTRUCTURE_ORDER[personality % 24];
}

function parseSubstructures(decryptedData: Uint8Array, order: string): PokemonSubstructs {
  const data = new DataView(decryptedData.buffer);
  const structs: { [key: string]: Uint8Array } = {};

  // Each substructure is 12 bytes
  for (let i = 0; i < 4; i++) {
    const key = order[i];
    structs[key] = decryptedData.slice(i * 12, (i + 1) * 12);
  }

  const gView = new DataView(structs['G'].buffer, structs['G'].byteOffset);
  const aView = new DataView(structs['A'].buffer, structs['A'].byteOffset);
  const eView = new DataView(structs['E'].buffer, structs['E'].byteOffset);
  const mView = new DataView(structs['M'].buffer, structs['M'].byteOffset);

  return {
    growth: {
      species: gView.getUint16(0, true),
      item: gView.getUint16(2, true),
      experience: gView.getUint32(4, true),
      friendship: gView.getUint8(9),
    },
    attacks: {
      moves: [
        aView.getUint16(0, true),
        aView.getUint16(2, true),
        aView.getUint16(4, true),
        aView.getUint16(6, true),
      ],
      pp: [aView.getUint8(8), aView.getUint8(9), aView.getUint8(10), aView.getUint8(11)],
    },
    evs: {
      hp: eView.getUint8(0),
      atk: eView.getUint8(1),
      def: eView.getUint8(2),
      spd: eView.getUint8(3),
      spa: eView.getUint8(4),
      spd2: eView.getUint8(5),
    },
    misc: {
      pokerus: mView.getUint8(0),
      metLocation: mView.getUint8(1),
      ivs: mView.getUint32(4, true),
      ribbons: mView.getUint32(8, true),
    },
  };
}

function extractIVs(ivBits: number): { hp: number; atk: number; def: number; spd: number; spa: number; spdef: number } {
  return {
    hp: ivBits & 0x1F,
    atk: (ivBits >> 5) & 0x1F,
    def: (ivBits >> 10) & 0x1F,
    spd: (ivBits >> 15) & 0x1F,
    spa: (ivBits >> 20) & 0x1F,
    spdef: (ivBits >> 25) & 0x1F,
  };
}

function decodePokemon(rawData: Uint8Array): DecodedPokemon | null {
  if (rawData.length < 80) return null;

  const data = new DataView(rawData.buffer, rawData.byteOffset);

  const personality = data.getUint32(0, true);
  const otId = data.getUint32(4, true);

  // Check for empty slot
  if (personality === 0 && otId === 0) return null;

  // Decode nickname and OT name
  const nicknameBytes = rawData.slice(8, 18);
  const otNameBytes = rawData.slice(20, 27);
  const nickname = decodePlayerName(nicknameBytes);
  const otName = decodePlayerName(otNameBytes);

  // Decrypt and parse substructures
  const encryptedBlock = rawData.slice(32, 80);
  const decrypted = decryptPokemonData(encryptedBlock, personality, otId);
  const order = getSubstructureOrder(personality);
  const structs = parseSubstructures(decrypted, order);

  const ivs = extractIVs(structs.misc.ivs);

  return {
    personality,
    otId,
    nickname,
    otName,
    species: structs.growth.species,
    level: 0, // Calculated from experience
    heldItem: structs.growth.item,
    moves: structs.attacks.moves.filter(m => m !== 0),
    ivs,
    evs: {
      hp: structs.evs.hp,
      atk: structs.evs.atk,
      def: structs.evs.def,
      spd: structs.evs.spd,
      spa: structs.evs.spa,
      spdef: structs.evs.spd2,
    },
  };
}
```

---

## Step 9: Convert to React SaveData Format

```typescript
import type { SaveData, PlayerProfile, LocationState } from '../save/types';

function mapIdToString(mapGroup: number, mapNum: number): string {
  // Map numeric IDs to string identifiers
  // This requires a mapping table from the decompilation
  const MAP_TABLE: { [key: string]: string } = {
    '0-0': 'MAP_PETALBURG_CITY',
    '0-1': 'MAP_SLATEPORT_CITY',
    // ... extensive mapping from constants/maps.h
  };
  return MAP_TABLE[`${mapGroup}-${mapNum}`] || `MAP_${mapGroup}_${mapNum}`;
}

async function convertEmeraldSave(file: File): Promise<SaveData> {
  const buffer = await loadEmeraldSave(file);
  const data = new DataView(buffer);

  // Find active slot
  const { offset: slotOffset } = findActiveSaveSlot(data);

  // Build sector map
  const sectorMap = buildSectorMap(data, slotOffset);

  // Validate checksums
  for (let section = 0; section < 14; section++) {
    if (!validateSectorChecksum(data, sectorMap[section])) {
      console.warn(`Checksum failed for section ${section}`);
    }
  }

  // Extract data
  const block2 = extractSaveBlock2(data, sectorMap);
  const block1Data = reassembleSaveBlock1(data, sectorMap);
  const block1 = extractSaveBlock1(block1Data, block2.encryptionKey);
  const flags = extractGameFlags(block1Data);

  // Convert to our format
  const profile: PlayerProfile = {
    name: block2.playerName,
    gender: block2.playerGender as 0 | 1,
    trainerId: block2.trainerId,
    secretId: block2.secretId,
  };

  const location: LocationState = {
    pos: block1.position,
    location: {
      mapId: mapIdToString(block1.location.mapGroup, block1.location.mapNum),
      warpId: block1.location.warpId,
      x: block1.location.x,
      y: block1.location.y,
    },
    continueGameWarp: {
      mapId: mapIdToString(block1.continueGameWarp.mapGroup, block1.continueGameWarp.mapNum),
      warpId: block1.continueGameWarp.warpId,
      x: block1.continueGameWarp.x,
      y: block1.continueGameWarp.y,
    },
    lastHealLocation: {
      mapId: mapIdToString(block1.lastHealLocation.mapGroup, block1.lastHealLocation.mapNum),
      warpId: block1.lastHealLocation.warpId,
      x: block1.lastHealLocation.x,
      y: block1.lastHealLocation.y,
    },
    escapeWarp: {
      mapId: mapIdToString(block1.escapeWarp.mapGroup, block1.escapeWarp.mapNum),
      warpId: block1.escapeWarp.warpId,
      x: block1.escapeWarp.x,
      y: block1.escapeWarp.y,
    },
    direction: 'down', // Would need to extract from object events
    elevation: 3,
    isSurfing: false, // Would need to check flags
  };

  return {
    version: 1,
    timestamp: Date.now(),
    profile,
    playTime: {
      hours: block2.playTimeHours,
      minutes: block2.playTimeMinutes,
      seconds: block2.playTimeSeconds,
    },
    location,
    flags,
    money: { money: block1.money, coins: block1.coins },
  };
}
```

---

## Complete Import Function

```typescript
// Add to SaveManager.ts

/**
 * Import a Pokemon Emerald .sav file
 */
async importEmeraldSave(file: File, slot: number = 0): Promise<SaveResult> {
  try {
    const saveData = await convertEmeraldSave(file);

    // Save to localStorage
    const key = getSlotKey(slot);
    localStorage.setItem(key, JSON.stringify(saveData));

    // Load the imported save
    this.load(slot);

    return { success: true };
  } catch (err) {
    console.error('[SaveManager] Failed to import Emerald save:', err);
    return { success: false, error: String(err) };
  }
}
```

---

## Challenges and Limitations

### 1. Map ID Mapping
Emerald uses numeric map group/number pairs. Converting to our string-based map IDs requires a complete mapping table from `constants/maps.h`.

### 2. Character Encoding
Pokemon uses proprietary text encoding, not ASCII/UTF-8. A complete character table is needed for all supported characters.

### 3. Player Direction
Player facing direction is stored in object events, not directly accessible.

### 4. Surfing State
Must be inferred from player movement type flags.

### 5. Item Ball Flags
Collected item flags need to be mapped to our flag naming convention.

---

## References

- [Save data structure (Generation III) - Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_III))
- [Pokémon data structure (Generation III) - Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_structure_(Generation_III))
- [Pokémon data substructures (Generation III) - Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_data_substructures_(Generation_III))
- `public/pokeemerald/include/global.h` - SaveBlock structures
- `public/pokeemerald/include/save.h` - Sector definitions
