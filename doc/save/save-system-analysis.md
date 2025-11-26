# Pokemon RSE Browser Save System Analysis

## Overview

This document provides an in-depth analysis of the save system in the Pokemon RSE Browser project, comparing it to the original Pokemon Emerald save format and identifying what is currently saved vs. not saved.

## Table of Contents

1. [Current React Save System](#current-react-save-system)
2. [Pokemon Emerald Original Save Format](#pokemon-emerald-original-save-format)
3. [What Is Saved vs Not Saved](#what-is-saved-vs-not-saved)
4. [Reading Emerald Save Files](#reading-emerald-save-files)

---

## Current React Save System

### Architecture

The React save system is located in `src/save/` and consists of:

| File | Purpose |
|------|---------|
| `SaveManager.ts` | Main orchestrator - save/load/export/import operations |
| `types.ts` | TypeScript interfaces mirroring Emerald structures |
| `index.ts` | Barrel exports |

### Storage Method

- **Format**: JSON stored in `localStorage`
- **Key Pattern**: `pokemon-rse-browser-save-slot-{n}` (slots 0-2)
- **Serialization**: `JSON.stringify()` / `JSON.parse()`

This differs significantly from Emerald's binary sector-based format but enables:
- Easy debugging (human-readable)
- Simple versioning and migration
- Cross-browser compatibility
- File export/import for sharing

### Data Structure (SaveData Interface)

```typescript
interface SaveData {
  version: number;           // Save format version (currently 1)
  timestamp: number;         // Unix timestamp of save

  // === SaveBlock2 equivalent ===
  profile: PlayerProfile;    // Name, gender, trainer IDs
  playTime: PlayTime;        // Hours, minutes, seconds
  options?: GameOptions;     // Text speed, battle style, etc.
  pokedex?: PokedexState;    // Seen/caught Pokemon

  // === SaveBlock1 equivalent ===
  location: LocationState;   // Position, warps, direction, elevation
  money?: MoneyState;        // Money and coins
  bag?: BagState;            // Item bag pockets
  pcItems?: PCItemsState;    // PC item storage
  party?: PartyState;        // Pokemon party
  pcPokemon?: PCPokemonState;// PC Pokemon storage
  flags: GameFlags;          // Event flags (string array)
  vars?: GameVars;           // Script variables
  stats?: GameStats;         // Game statistics
}
```

### Currently Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Player Profile | ✅ Implemented | Name, gender, trainer ID, secret ID |
| Play Time | ✅ Implemented | Hours, minutes, seconds tracked |
| Location State | ✅ Implemented | Position, map, direction, elevation, surfing |
| Game Flags | ✅ Implemented | String-based flag system |
| Warp Data | ✅ Implemented | Last heal, escape warp, etc. |
| Game Options | ⚠️ Interface Only | Not yet saved/loaded |
| Pokedex | ⚠️ Interface Only | Not yet saved/loaded |
| Money/Coins | ⚠️ Interface Only | Not yet saved/loaded |
| Item Bag | ⚠️ Interface Only | Not yet saved/loaded |
| PC Items | ⚠️ Interface Only | Not yet saved/loaded |
| Pokemon Party | ⚠️ Interface Only | Not yet saved/loaded |
| PC Pokemon | ⚠️ Interface Only | Not yet saved/loaded |
| Script Variables | ⚠️ Interface Only | Not yet saved/loaded |
| Game Statistics | ⚠️ Interface Only | Not yet saved/loaded |

---

## Pokemon Emerald Original Save Format

### Physical Layout (128KB Flash)

| Offset | Size | Contents |
|--------|------|----------|
| 0x000000 | 57,344 bytes | Game Save Slot A (14 sectors) |
| 0x00E000 | 57,344 bytes | Game Save Slot B (14 sectors) |
| 0x01C000 | 8,192 bytes | Hall of Fame (2 sectors) |
| 0x01E000 | 4,096 bytes | Mystery Gift / e-Reader |
| 0x01F000 | 4,096 bytes | Recorded Battle |

### Sector Structure (4KB each)

Each sector contains:
- **Data**: 3,968 bytes of actual save data
- **Footer**: 128 bytes (mostly unused)

Footer structure:
| Offset | Size | Field |
|--------|------|-------|
| 0x0FF4 | 2 bytes | Section ID (0-13) |
| 0x0FF6 | 2 bytes | Checksum |
| 0x0FF8 | 4 bytes | Signature (0x08012025) |
| 0x0FFC | 4 bytes | Save counter |

### Sector ID to Data Mapping

| Sector ID | Size | Contents | Reference |
|-----------|------|----------|-----------|
| 0 | 3,884 bytes | SaveBlock2 (trainer info, options, pokedex) | `global.h:508-542` |
| 1-4 | ~15,752 bytes total | SaveBlock1 (position, party, items, flags) | `global.h:984-1078` |
| 5-13 | 33,744 bytes total | PC Pokemon Storage (14 boxes × 30 Pokemon) | `pokemon_storage_system.h` |

### Checksum Algorithm

```c
// Calculate checksum for sector data
uint32_t sum = 0;
for (int i = 0; i < SECTOR_DATA_SIZE / 4; i++) {
    sum += ((uint32_t*)data)[i];
}
uint16_t checksum = (sum & 0xFFFF) + (sum >> 16);
```

### Sector Rotation

The game rotates sector order on each save:
- First save: 13, 0, 1, 2, ..., 12
- Next save: 12, 13, 0, 1, ..., 11
- And so on...

The most recent save is identified by the higher save counter value.

### Emerald-Specific: Security Key Encryption

Located at SaveBlock2 offset 0x00AC (4 bytes), this XOR key encrypts:
- Money (4 bytes)
- Coins (2 bytes)
- Item quantities in bag (NOT PC items)

```c
// Decrypt money
uint32_t money = encrypted_money ^ security_key;
```

---

## SaveBlock2 Structure (Sector 0)

Reference: `public/pokeemerald/include/global.h:508-542`

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x00 | 8 bytes | playerName | 7 chars + null terminator |
| 0x08 | 1 byte | playerGender | 0=Male, 1=Female |
| 0x09 | 1 byte | specialSaveWarpFlags | |
| 0x0A | 4 bytes | playerTrainerId | Public ID (2 bytes) + Secret ID (2 bytes) |
| 0x0E | 2 bytes | playTimeHours | |
| 0x10 | 1 byte | playTimeMinutes | |
| 0x11 | 1 byte | playTimeSeconds | |
| 0x12 | 1 byte | playTimeVBlanks | Frame counter |
| 0x13 | 1 byte | optionsButtonMode | |
| 0x14 | 2 bytes | options (bitfield) | Text speed, window frame, sound, etc. |
| 0x18 | 120 bytes | pokedex | Seen/owned flags, Unown/Spinda personality |
| 0x90 | 8 bytes | filler | |
| 0x98 | 5 bytes | localTimeOffset | |
| 0xA0 | 5 bytes | lastBerryTreeUpdate | |
| 0xA8 | 4 bytes | gcnLinkFlags | GameCube link data |
| 0xAC | 4 bytes | encryptionKey | **Emerald only** - XOR key |
| 0xB0+ | ~2,940 bytes | Battle Frontier data | Apprentice, records, etc. |

---

## SaveBlock1 Structure (Sectors 1-4)

Reference: `public/pokeemerald/include/global.h:984-1078`

Total size: 0x3D88 bytes (15,752 bytes)

### Key Fields

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x00 | 4 bytes | pos | Current tile coordinates (x, y) |
| 0x04 | 8 bytes | location | Current map warp data |
| 0x0C | 8 bytes | continueGameWarp | Where to respawn on load |
| 0x14 | 8 bytes | dynamicWarp | |
| 0x1C | 8 bytes | lastHealLocation | Pokemon Center warp |
| 0x24 | 8 bytes | escapeWarp | Dig/Escape Rope destination |
| 0x2C | 2 bytes | savedMusic | |
| 0x2E | 1 byte | weather | |
| 0x30 | 1 byte | flashLevel | Cave darkness level |
| 0x32 | 2 bytes | mapLayoutId | |
| 0x234 | 1 byte | playerPartyCount | 0-6 |
| 0x238 | 600 bytes | playerParty | 6 × 100 bytes per Pokemon |
| 0x490 | 4 bytes | money | **Encrypted in Emerald** |
| 0x494 | 2 bytes | coins | **Encrypted in Emerald** |
| 0x496 | 2 bytes | registeredItem | SELECT button item |
| 0x498 | 200 bytes | pcItems | 50 slots × 4 bytes |
| 0x560 | 120 bytes | bagPocket_Items | 30 slots |
| 0x5D8 | 120 bytes | bagPocket_KeyItems | 30 slots |
| 0x650 | 64 bytes | bagPocket_PokeBalls | 16 slots |
| 0x690 | 256 bytes | bagPocket_TMHM | 64 slots |
| 0x790 | 184 bytes | bagPocket_Berries | 46 slots |
| 0x848 | 320 bytes | pokeblocks | 40 × 8 bytes |
| 0x988 | 52 bytes | seen1 | Pokedex seen flags |
| 0xA30 | 576 bytes | objectEvents | 16 object events |
| 0x1270 | 300 bytes | flags | 2400 event flags |
| 0x139C | 512 bytes | vars | 256 script variables |
| 0x159C | 256 bytes | gameStats | 64 statistics |
| 0x169C+ | ~9,700 bytes | Berry trees, Secret bases, TV, etc. |

---

## What Is Saved vs Not Saved

### Currently Saved in React Implementation

| Category | Specific Data | Storage Location |
|----------|---------------|------------------|
| **Identity** | Player name, gender, trainer ID, secret ID | `profile` field |
| **Time** | Hours, minutes, seconds of play time | `playTime` field |
| **Position** | Tile X/Y, map ID, direction, elevation | `location` field |
| **Warps** | Continue warp, heal location, escape warp | `location` field |
| **State** | Surfing status | `location.isSurfing` |
| **Events** | Collected items, NPC visibility flags | `flags` array |

### NOT Currently Saved (Interface Exists, Not Implemented)

| Category | Why Missing | Priority |
|----------|-------------|----------|
| **Pokemon Party** | No battle/party system yet | High |
| **PC Pokemon** | No PC system yet | High |
| **Money/Coins** | No shop/economy system | Medium |
| **Item Bag** | Items collected but not inventoried | Medium |
| **Pokedex** | No wild encounters yet | Medium |
| **Game Options** | Settings not persisted between sessions | Low |
| **Script Variables** | Limited script system | Low |
| **Game Statistics** | Step count, battles, etc. not tracked | Low |

### NOT in Interface (Would Need to Add)

| Feature | Emerald Structure | Notes |
|---------|-------------------|-------|
| Berry Trees | `berryTrees[128]` | If berry system added |
| Secret Bases | `secretBases[20]` | Multiplayer feature |
| Pokeblocks | `pokeblocks[40]` | Contest feature |
| Mail | `mail[16]` | |
| Daycare | `daycare` | Breeding |
| Roamer | `roamer` | Latios/Latias |
| Contest Winners | `contestWinners[13]` | |
| TV Shows | `tvShows[25]` | |
| Battle Frontier | All frontier data | Post-game |

---

## Key Differences: React vs Emerald

| Aspect | Emerald Original | React Implementation |
|--------|------------------|----------------------|
| **Format** | Binary with sectors | JSON |
| **Storage** | Flash memory (128KB) | localStorage |
| **Encryption** | XOR-based for sensitive data | None needed (client-side) |
| **Checksum** | 16-bit per sector | None (JSON validity) |
| **Slots** | 2 (A/B rotation) | 3 independent slots |
| **Pokemon** | Complex encrypted structure | Simple interface (future) |
| **Flags** | Bit array (300 bytes) | String array |
| **Variables** | u16 array (256 entries) | Record<number, number> |

---

## References

- `public/pokeemerald/include/global.h` - SaveBlock1, SaveBlock2 structures
- `public/pokeemerald/include/save.h` - Sector layout and constants
- `public/pokeemerald/include/pokemon.h` - Pokemon data structure
- `public/pokeemerald/include/constants/flags.h` - All 2400 flags
- `public/pokeemerald/include/constants/vars.h` - Script variables
- `public/pokeemerald/include/constants/game_stat.h` - 64 game statistics
- `src/save/types.ts` - React TypeScript interfaces
- `src/save/SaveManager.ts` - Save/load implementation
