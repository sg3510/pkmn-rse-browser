# Save System Proposal: Browser Cache + Native .sav Import

**Date:** 2025-12-04
**Status:** Proposal

## Overview

This document proposes a save system that:
1. Detects existing saves in browser localStorage and shows "Continue" on the main menu
2. Allows importing native Pokemon Emerald `.sav` files (128KB GBA saves)
3. Provides accurate TypeScript interfaces matching the real game's memory layout
4. Enables seamless round-trip: import → play → export

## Current State

### Existing Infrastructure
- `src/save/SaveManager.ts` - Basic localStorage save/load with JSON format
- `src/save/types.ts` - TypeScript interfaces (partially complete)
- `save_editors/PokeTunes-main/` - Reference implementation for parsing Gen3 saves
- `doc/save/*.md` - Comprehensive documentation on the native format

### Sample Save Analysis
The sample save `public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav`:
- Size: 131,088 bytes (0x20010) - standard 128KB + 16 byte header
- Player name: "Seb" (decoded from Gen3 charset: 0xCD 0xD9 0xD6)
- Gender: Male (0x00)
- Save counter: 2 (slot A active, sectors rotated by 2)
- Section 0 (SaveBlock2) located at sector 2 (offset 0x2000)

## Architecture

### Three-Layer Save System

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  MainMenuState checks hasAnySave() → shows CONTINUE     │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                    SaveManager Layer                     │
│  - save()/load() for browser saves                      │
│  - importNativeSav() for .sav files                     │
│  - exportNativeSav() for .sav export                    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                   Native Parser Layer                    │
│  - Gen3SaveParser: reads/writes 128KB .sav files        │
│  - Sector rotation, checksum, encryption handling       │
│  - Pokemon data encryption/decryption                   │
└─────────────────────────────────────────────────────────┘
```

## TypeScript Interfaces

### Core Save Data (matches GBA memory layout)

```typescript
// ============================================================================
// Native Gen3 Save Format Types
// ============================================================================

/**
 * Physical sector footer (last 12 bytes of each 4KB sector)
 */
export interface SectorFooter {
  sectionId: number;      // u16 at 0xFF4 - which section (0-13)
  checksum: number;       // u16 at 0xFF6 - data checksum
  signature: number;      // u32 at 0xFF8 - always 0x08012025
  saveCounter: number;    // u32 at 0xFFC - monotonic counter
}

/**
 * SaveBlock2 - Player identity and options (Section 0)
 * Emerald uses 0xF2C bytes; RS uses 0x890 bytes
 */
export interface NativeSaveBlock2 {
  // Identity (0x00-0x0D)
  playerName: Uint8Array;    // 8 bytes, Gen3 charset, 0xFF terminated
  playerGender: 0 | 1;       // 0 = male, 1 = female
  specialSaveWarpFlags: number;
  trainerId: number;         // u16 TID
  secretId: number;          // u16 SID

  // Play time (0x0E-0x12)
  playTimeHours: number;     // u16
  playTimeMinutes: number;   // u8
  playTimeSeconds: number;   // u8
  playTimeFrames: number;    // u8

  // Options (0x13-0x18)
  optionsButtonMode: number;
  optionsTextSpeed: number;
  optionsWindowFrame: number;
  optionsSound: number;
  optionsBattleStyle: number;
  optionsBattleScene: number;

  // Encryption (Emerald only, 0xAC)
  encryptionKey: number;     // u32 - XOR key for money/items/stats

  // Pokedex flags are also in SaveBlock2
  pokedexOwned: Uint8Array;  // 52 bytes bitfield
  pokedexSeen: Uint8Array;   // 52 bytes bitfield
}

/**
 * Warp data structure (5 bytes in GBA)
 */
export interface NativeWarpData {
  mapGroup: number;    // s8
  mapNum: number;      // s8
  warpId: number;      // s8
  x: number;           // s16
  y: number;           // s16
}

/**
 * SaveBlock1 - Game state (Sections 1-4, ~0x3D88 bytes in Emerald)
 */
export interface NativeSaveBlock1 {
  // Position (0x00-0x2B)
  pos: { x: number; y: number };           // s16, s16
  location: NativeWarpData;
  continueGameWarp: NativeWarpData;
  dynamicWarp: NativeWarpData;
  lastHealLocation: NativeWarpData;
  escapeWarp: NativeWarpData;

  // Map state (0x2C-0x3F)
  savedMusic: number;
  weatherType: number;
  flashLevel: number;
  mapLayoutId: number;
  mapType: number;

  // Party (0x234)
  playerPartyCount: number;
  playerParty: NativePokemon[];            // Up to 6 Pokemon, 100 bytes each

  // Money/Coins (0x490-0x497) - XOR encrypted in Emerald
  money: number;                           // u32
  coins: number;                           // u16

  // PC Items (0x498) - NOT encrypted
  pcItems: NativeItemSlot[];               // 50 slots

  // Bag pockets - XOR encrypted quantities in Emerald
  bagItems: NativeItemSlot[];              // 30 slots at 0x560
  bagKeyItems: NativeItemSlot[];           // 30 slots at 0x5D8
  bagPokeBalls: NativeItemSlot[];          // 16 slots at 0x650
  bagTMHM: NativeItemSlot[];               // 64 slots at 0x690
  bagBerries: NativeItemSlot[];            // 46 slots at 0x790

  // Flags and Vars
  flags: Uint8Array;                       // 0x12C bytes at 0x1270
  vars: Uint16Array;                       // 256 vars at 0x139C

  // Game stats - XOR encrypted in Emerald
  gameStats: Uint32Array;                  // 64 stats at 0x????
}

/**
 * Item slot (4 bytes)
 */
export interface NativeItemSlot {
  itemId: number;      // u16
  quantity: number;    // u16 (XOR encrypted in Emerald bag, not PC)
}

/**
 * Pokemon data structure (100 bytes party, 80 bytes box)
 */
export interface NativePokemon {
  // Unencrypted header (32 bytes)
  personality: number;           // u32 - determines nature, gender, ability, shiny
  otId: number;                  // u32 - trainer ID (TID | SID << 16)
  nickname: Uint8Array;          // 10 bytes Gen3 charset
  language: number;              // u16
  otName: Uint8Array;            // 7 bytes Gen3 charset
  markings: number;              // u8
  checksum: number;              // u16
  unknown: number;               // u16

  // Encrypted data (48 bytes, order determined by personality % 24)
  // Substructure G: Growth
  species: number;               // u16
  heldItem: number;              // u16
  experience: number;            // u32
  ppBonuses: number;             // u8
  friendship: number;            // u8
  unknown2: number;              // u16

  // Substructure A: Attacks
  moves: [number, number, number, number];     // 4x u16
  pp: [number, number, number, number];        // 4x u8

  // Substructure E: EVs & Condition
  hpEv: number;
  attackEv: number;
  defenseEv: number;
  speedEv: number;
  spAttackEv: number;
  spDefenseEv: number;
  coolness: number;
  beauty: number;
  cuteness: number;
  smartness: number;
  toughness: number;
  feel: number;

  // Substructure M: Misc
  pokerus: number;
  metLocation: number;
  originsInfo: number;           // level met, game of origin, ball
  ivEggAbility: number;          // packed IVs, egg flag, ability flag
  ribbonsObedience: number;

  // Party-only data (20 bytes, not in box Pokemon)
  status: number;
  level: number;
  pokerusRemaining: number;
  currentHp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  spAttack: number;
  spDefense: number;
}

/**
 * PC Pokemon Storage (Sections 5-13, ~0x83D0 bytes)
 */
export interface NativePokemonStorage {
  currentBox: number;
  boxes: NativeBox[];              // 14 boxes
  boxNames: string[];              // 14 names, 9 chars each
  boxWallpapers: number[];         // 14 wallpaper IDs
}

export interface NativeBox {
  pokemon: (NativePokemon | null)[];  // 30 slots, 80 bytes each
}
```

### Gen3 Character Set

```typescript
/**
 * Gen3 character encoding table (English)
 * 0xFF = terminator, 0x00 = space
 */
export const GEN3_CHARSET_EN: Record<number, string> = {
  0x00: ' ',
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
  0xED: 'y', 0xEE: 'z',
  0xA1: '0', 0xA2: '1', 0xA3: '2', 0xA4: '3', 0xA5: '4',
  0xA6: '5', 0xA7: '6', 0xA8: '7', 0xA9: '8', 0xAA: '9',
  0xAB: '!', 0xAC: '?', 0xAD: '.', 0xAE: '-',
  0xB5: '♂', 0xB6: '♀',
  0xFF: '', // terminator
};

export function decodeGen3String(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    if (byte === 0xFF) break;
    result += GEN3_CHARSET_EN[byte] ?? '?';
  }
  return result;
}

export function encodeGen3String(str: string, maxLen: number): Uint8Array {
  const result = new Uint8Array(maxLen).fill(0xFF);
  const reverseMap = Object.fromEntries(
    Object.entries(GEN3_CHARSET_EN).map(([k, v]) => [v, parseInt(k)])
  );
  for (let i = 0; i < str.length && i < maxLen - 1; i++) {
    result[i] = reverseMap[str[i]] ?? 0xAC; // '?' for unknown
  }
  return result;
}
```

## Implementation Plan

### Phase 1: Browser Save Detection & Continue (MVP)

**Goal:** Show "Continue" button when localStorage has a save

```typescript
// In MainMenuState
async enter(viewport: ViewportConfig): Promise<void> {
  this.hasSaveData = saveManager.hasAnySave();

  this.menuOptions = [];

  if (this.hasSaveData) {
    const slots = saveManager.getSaveSlots();
    const mostRecent = slots.find(s => s.exists);
    this.menuOptions.push({
      label: 'CONTINUE',
      action: GameState.OVERWORLD,
      enabled: true,
      saveSlot: mostRecent?.slot ?? 0,
    });
  }

  this.menuOptions.push({
    label: 'NEW GAME',
    action: GameState.OVERWORLD,
    enabled: true,
  });
  // ...
}
```

**Files to modify:**
- `src/states/MainMenuState.ts` - Check `saveManager.hasAnySave()` and build menu
- `src/save/SaveManager.ts` - Ensure `hasAnySave()` works correctly

### Phase 2: Native .sav Parser

**Goal:** Read authentic Pokemon Emerald save files

```typescript
// src/save/native/Gen3SaveParser.ts

export class Gen3SaveParser {
  private buffer: Uint8Array;
  private activeSlot: 0 | 1 = 0;
  private sectionOffsets: Map<number, number> = new Map();

  constructor(buffer: ArrayBuffer) {
    this.buffer = new Uint8Array(buffer);
    this.detectActiveSlot();
    this.buildSectionMap();
  }

  /**
   * Detect which save slot is active by comparing save counters
   */
  private detectActiveSlot(): void {
    const slot0Valid = this.validateSlot(0);
    const slot1Valid = this.validateSlot(1);

    if (!slot0Valid && slot1Valid) {
      this.activeSlot = 1;
    } else if (slot0Valid && slot1Valid) {
      const counter0 = this.getSaveCounter(0);
      const counter1 = this.getSaveCounter(1);
      this.activeSlot = counter1 > counter0 ? 1 : 0;
    }
  }

  /**
   * Validate a save slot has all 14 sections with valid signatures
   */
  private validateSlot(slot: 0 | 1): boolean {
    const start = slot * 0xE000; // 14 sectors * 0x1000
    let bitTrack = 0;

    for (let i = 0; i < 14; i++) {
      const sectorOffset = start + i * 0x1000;
      const signature = this.readU32(sectorOffset + 0xFF8);

      if (signature !== 0x08012025) continue;

      const sectionId = this.readU16(sectorOffset + 0xFF4);
      if (sectionId < 14) {
        bitTrack |= 1 << sectionId;
      }
    }

    return bitTrack === 0x3FFF; // All 14 sections present
  }

  /**
   * Get the encryption key (Emerald only)
   */
  getEncryptionKey(): number {
    const section0 = this.getSectionBuffer(0);
    return this.readU32FromBuffer(section0, 0xAC);
  }

  /**
   * Parse player profile from SaveBlock2
   */
  getPlayerProfile(): PlayerProfile {
    const section0 = this.getSectionBuffer(0);

    return {
      name: decodeGen3String(section0.slice(0, 8)),
      gender: section0[8] as 0 | 1,
      trainerId: this.readU16FromBuffer(section0, 0x0A),
      secretId: this.readU16FromBuffer(section0, 0x0C),
    };
  }

  /**
   * Parse play time
   */
  getPlayTime(): PlayTime {
    const section0 = this.getSectionBuffer(0);

    return {
      hours: this.readU16FromBuffer(section0, 0x0E),
      minutes: section0[0x10],
      seconds: section0[0x11],
    };
  }

  /**
   * Parse player position from SaveBlock1
   */
  getPosition(): LocationState {
    const section1 = this.getSectionBuffer(1);

    const posX = this.readS16FromBuffer(section1, 0x00);
    const posY = this.readS16FromBuffer(section1, 0x02);

    // Parse warp data at 0x04
    const mapGroup = section1[0x04];
    const mapNum = section1[0x05];
    const warpId = section1[0x06];

    return {
      pos: { x: posX, y: posY },
      location: {
        mapId: this.mapGroupNumToId(mapGroup, mapNum),
        warpId,
        x: posX,
        y: posY,
      },
      // ... other warp data
    };
  }

  /**
   * Parse party Pokemon
   */
  getParty(): PartyState {
    const section1 = this.getSectionBuffer(1);
    const partyCount = this.readU32FromBuffer(section1, 0x234);
    const pokemon: (Pokemon | null)[] = [];

    for (let i = 0; i < 6; i++) {
      if (i >= partyCount) {
        pokemon.push(null);
        continue;
      }

      const offset = 0x238 + i * 100;
      const pkm = this.parsePartyPokemon(section1.slice(offset, offset + 100));
      pokemon.push(pkm);
    }

    return { pokemon, count: partyCount };
  }

  // ... more parsing methods
}
```

**Files to create:**
- `src/save/native/Gen3SaveParser.ts` - Main parser class
- `src/save/native/Gen3Crypto.ts` - Encryption/decryption utilities
- `src/save/native/Gen3Charset.ts` - Character encoding/decoding
- `src/save/native/Gen3Pokemon.ts` - Pokemon data parsing
- `src/save/native/types.ts` - Native format interfaces

### Phase 3: Import Flow

**Goal:** Add "Import Save" option that converts native .sav to browser format

```typescript
// In SaveManager
async importNativeSav(file: File): Promise<SaveResult> {
  try {
    const buffer = await file.arrayBuffer();
    const parser = new Gen3SaveParser(buffer);

    // Validate it's a real Emerald save
    if (!parser.isValid()) {
      return { success: false, error: 'Invalid save file' };
    }

    // Convert to our SaveData format
    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      profile: parser.getPlayerProfile(),
      playTime: parser.getPlayTime(),
      location: parser.getPosition(),
      party: parser.getParty(),
      bag: parser.getBag(),
      money: parser.getMoney(),
      flags: parser.getFlags(),
      pokedex: parser.getPokedex(),
      // ... etc
    };

    // Save to localStorage
    const key = getSlotKey(0);
    localStorage.setItem(key, JSON.stringify(saveData));

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
```

### Phase 4: Main Menu UI

**Goal:** Pretty main menu with player preview

```
┌─────────────────────────────────────┐
│     POKÉMON EMERALD                │
├─────────────────────────────────────┤
│                                     │
│  ▶ CONTINUE                        │
│     SEB        ⏱ 12:34             │
│     ROUTE 101  🏅 0                │
│                                     │
│    NEW GAME                        │
│                                     │
│    IMPORT SAVE                     │
│                                     │
└─────────────────────────────────────┘
```

## Key Technical Details

### Sector Rotation
The GBA rotates which physical sector contains which logical section to extend flash memory lifespan. Finding section 0:

```typescript
function findSection0Offset(buffer: Uint8Array, slot: 0 | 1): number {
  const start = slot * 0xE000;
  for (let i = 0; i < 14; i++) {
    const sectorOffset = start + i * 0x1000;
    const sectionId = readU16(buffer, sectorOffset + 0xFF4);
    if (sectionId === 0) return sectorOffset;
  }
  throw new Error('Section 0 not found');
}
```

### Emerald Encryption
Emerald encrypts money, coins, bag quantities, and game stats using an XOR key:

```typescript
function decryptMoney(encrypted: number, key: number): number {
  return (encrypted ^ key) >>> 0; // Keep as u32
}

function decryptBagQuantity(encrypted: number, key: number): number {
  return encrypted ^ (key & 0xFFFF);
}
```

### Pokemon Substructure Order
Pokemon data has 4 substructures (G, A, E, M) in an order determined by personality % 24:

```typescript
const SUBSTRUCTURE_ORDERS = [
  'GAEM', 'GAME', 'GEAM', 'GEMA', 'GMAE', 'GMEA',
  'AGEM', 'AGME', 'AEGM', 'AEMG', 'AMGE', 'AMEG',
  'EGAM', 'EGMA', 'EAGM', 'EAMG', 'EMGA', 'EMAG',
  'MGAE', 'MGEA', 'MAGE', 'MAEG', 'MEGA', 'MEAG',
];

function getSubstructureOrder(personality: number): string {
  return SUBSTRUCTURE_ORDERS[personality % 24];
}
```

### Map Group/Number to Map ID
Need to build a lookup table from pokeemerald's map_groups.h:

```typescript
// Generated from public/pokeemerald/include/constants/map_groups.h
const MAP_LOOKUP: Record<string, string> = {
  '0_0': 'MAP_PETALBURG_CITY',
  '0_1': 'MAP_SLATEPORT_CITY',
  // ...
  '9_0': 'MAP_LITTLEROOT_TOWN',
  '9_1': 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F',
  // etc
};

function mapGroupNumToId(group: number, num: number): string {
  return MAP_LOOKUP[`${group}_${num}`] ?? `MAP_UNKNOWN_${group}_${num}`;
}
```

## Testing Strategy

1. **Unit tests** for parsing individual structures
2. **Integration test** with the sample save file
3. **Round-trip test**: import → modify → export → re-import
4. **Checksum validation** to ensure data integrity

## Open Questions

1. Should we support Ruby/Sapphire or only Emerald?
2. Should import replace existing save or add as new slot?
3. Export to native .sav format - required for MVP?
4. How to handle save files from other regions (Japanese)?

## References

- `doc/save/gen3-native-save-format.md` - Sector layout and checksums
- `doc/save/gen3-boot-essentials.md` - Minimum required fields
- `save_editors/PokeTunes-main/pksav/` - Reference TypeScript implementation
- `public/pokeemerald/include/global.h` - Official struct definitions
