---
title: Emerald to React Save Data Mapping Reference
status: reference
last_verified: 2026-01-13
---

# Emerald to React Save Data Mapping Reference

## Quick Reference Tables

This document provides direct mappings between Pokemon Emerald binary save data and our React JSON format.

---

## SaveBlock2 → PlayerProfile

| Emerald Field | Offset | Size | React Field | Notes |
|--------------|--------|------|-------------|-------|
| `playerName` | 0x00 | 8 bytes | `profile.name` | Needs text decoding |
| `playerGender` | 0x08 | 1 byte | `profile.gender` | 0=Male, 1=Female |
| `playerTrainerId[0-1]` | 0x0A | 2 bytes | `profile.trainerId` | Public ID |
| `playerTrainerId[2-3]` | 0x0C | 2 bytes | `profile.secretId` | Secret ID |

## SaveBlock2 → PlayTime

| Emerald Field | Offset | Size | React Field | Notes |
|--------------|--------|------|-------------|-------|
| `playTimeHours` | 0x0E | 2 bytes | `playTime.hours` | u16 |
| `playTimeMinutes` | 0x10 | 1 byte | `playTime.minutes` | u8 |
| `playTimeSeconds` | 0x11 | 1 byte | `playTime.seconds` | u8 |

## SaveBlock2 → GameOptions

| Emerald Field | Offset | Bits | React Field | Values |
|--------------|--------|------|-------------|--------|
| `optionsTextSpeed` | 0x14 | 0-2 | `options.textSpeed` | 0=slow, 1=mid, 2=fast |
| `optionsWindowFrameType` | 0x14 | 3-7 | `options.windowFrame` | 0-19 |
| `optionsSound` | 0x14 | 8 | `options.sound` | 0=mono, 1=stereo |
| `optionsBattleStyle` | 0x14 | 9 | `options.battleStyle` | 0=shift, 1=set |
| `optionsBattleSceneOff` | 0x14 | 10 | `options.battleScene` | Inverted! |
| `optionsButtonMode` | 0x13 | all | `options.buttonMode` | 0=normal, 1=lr, 2=l=a |

---

## SaveBlock1 → LocationState

| Emerald Field | Offset | Size | React Field | Notes |
|--------------|--------|------|-------------|-------|
| `pos.x` | 0x00 | 2 bytes | `location.pos.x` | s16 |
| `pos.y` | 0x02 | 2 bytes | `location.pos.y` | s16 |
| `location.mapGroup` | 0x04 | 1 byte | `location.location.mapId` | Needs mapping |
| `location.mapNum` | 0x05 | 1 byte | (combined with above) | |
| `location.warpId` | 0x06 | 1 byte | `location.location.warpId` | |
| `location.x` | 0x08 | 2 bytes | `location.location.x` | |
| `location.y` | 0x0A | 2 bytes | `location.location.y` | |

### Warp Structures (8 bytes each)

| Emerald Warp | Offset | React Field |
|-------------|--------|-------------|
| `location` | 0x04 | `location.location` |
| `continueGameWarp` | 0x0C | `location.continueGameWarp` |
| `dynamicWarp` | 0x14 | (not used) |
| `lastHealLocation` | 0x1C | `location.lastHealLocation` |
| `escapeWarp` | 0x24 | `location.escapeWarp` |

---

## SaveBlock1 → MoneyState

| Emerald Field | Offset | Size | React Field | Notes |
|--------------|--------|------|-------------|-------|
| `money` | 0x490 | 4 bytes | `money.money` | **XOR encrypted** |
| `coins` | 0x494 | 2 bytes | `money.coins` | **XOR encrypted** |

**Decryption:**
```typescript
const money = encryptedMoney ^ encryptionKey;
const coins = encryptedCoins ^ (encryptionKey & 0xFFFF);
```

---

## SaveBlock1 → BagState

| Emerald Pocket | Offset | Slots | React Field |
|---------------|--------|-------|-------------|
| `bagPocket_Items` | 0x560 | 30 | `bag.items` |
| `bagPocket_KeyItems` | 0x5D8 | 30 | `bag.keyItems` |
| `bagPocket_PokeBalls` | 0x650 | 16 | `bag.pokeBalls` |
| `bagPocket_TMHM` | 0x690 | 64 | `bag.tmHm` |
| `bagPocket_Berries` | 0x790 | 46 | `bag.berries` |
| `pcItems` | 0x498 | 50 | `pcItems.items` |

**ItemSlot Structure (4 bytes):**
| Offset | Size | Field |
|--------|------|-------|
| 0x00 | 2 bytes | `itemId` |
| 0x02 | 2 bytes | `quantity` |

**Note:** Bag item quantities are XOR encrypted, PC items are NOT.

---

## SaveBlock1 → GameFlags

| Emerald | React |
|---------|-------|
| Bit array at offset 0x1270 | `flags: string[]` |
| 300 bytes = 2400 flags | Array of set flag names |
| Flag N = byte[N/8] & (1 << (N%8)) | Flag name from constants/flags.h |

### Common Flags Mapping

| Emerald Flag | Index | React Name |
|-------------|-------|------------|
| `FLAG_RESCUED_BIRCH` | 0x52 | `"FLAG_RESCUED_BIRCH"` |
| `FLAG_ADVENTURE_STARTED` | 0x74 | `"FLAG_ADVENTURE_STARTED"` |
| `FLAG_RECEIVED_BIKE` | 0x5A | `"FLAG_RECEIVED_BIKE"` |
| `FLAG_RECEIVED_POKEDEX` | 0x74 | `"FLAG_ADVENTURE_STARTED"` |
| `FLAG_RECEIVED_HM_CUT` | 0x89 | `"FLAG_RECEIVED_HM_CUT"` |
| `FLAG_RECEIVED_HM_FLY` | 0x6E | `"FLAG_RECEIVED_HM_FLY"` |
| `FLAG_RECEIVED_HM_SURF` | 0x7A | `"FLAG_RECEIVED_HM_SURF"` |
| `FLAG_BADGE0*_GET` | 0x807-0x80E | `"FLAG_BADGE01_GET"` etc. |

---

## SaveBlock1 → GameVars

| Emerald | React |
|---------|-------|
| `u16 vars[256]` at offset 0x139C | `vars: Record<number, number>` |
| Index 0x4000-0x40FF | Key = var number |

---

## SaveBlock1 → GameStats

| Emerald | Offset | React |
|---------|--------|-------|
| `gameStats[64]` | 0x159C | `stats.*` |

### Key Statistics

| Index | Emerald Name | React Field |
|-------|-------------|-------------|
| 0 | GAME_STAT_SAVED_GAME | - |
| 5 | GAME_STAT_STEPS | `stats.stepCount` |
| 7 | GAME_STAT_TOTAL_BATTLES | `stats.pokemonBattles` |
| 8 | GAME_STAT_WILD_BATTLES | `stats.wildBattles` |
| 9 | GAME_STAT_TRAINER_BATTLES | `stats.trainersDefeated` |
| 11 | GAME_STAT_POKEMON_CAPTURES | `stats.pokemonCaught` |

---

## Pokemon Data Mapping

### Party Pokemon (100 bytes each)

| Emerald Field | Offset | Size | React Pokemon Field |
|--------------|--------|------|---------------------|
| `personality` | 0x00 | 4 | Not stored (used for encryption) |
| `otId` | 0x04 | 4 | `pokemon.otId` |
| `nickname` | 0x08 | 10 | `pokemon.nickname` |
| `otName` | 0x14 | 7 | `pokemon.otName` |
| Encrypted data | 0x20 | 48 | (substructures) |
| `status` | 0x50 | 4 | (battle state) |
| `level` | 0x54 | 1 | `pokemon.level` |
| `hp` | 0x56 | 2 | (current HP) |
| `maxHP` | 0x58 | 2 | (calculated) |
| `attack`-`spDefense` | 0x5A+ | 2 each | (calculated) |

### Substructure Mapping

**Growth (12 bytes):**
| Offset | Field | React |
|--------|-------|-------|
| 0 | `species` | `pokemon.species` |
| 2 | `heldItem` | - |
| 4 | `experience` | `pokemon.experience` |
| 9 | `friendship` | - |

**Attacks (12 bytes):**
| Offset | Field | React |
|--------|-------|-------|
| 0-7 | `moves[4]` | - |
| 8-11 | `pp[4]` | - |

**EVs & Condition (12 bytes):**
| Offset | Field | React |
|--------|-------|-------|
| 0-5 | EVs (6 stats) | - |
| 6-10 | Contest stats | - |

**Miscellaneous (12 bytes):**
| Offset | Field | React |
|--------|-------|-------|
| 0 | `pokerus` | - |
| 1 | `metLocation` | - |
| 4 | IVs (packed) | - |
| 8 | Ribbons | - |

---

## Text Encoding Table (Partial)

| Byte | Character | Byte | Character |
|------|-----------|------|-----------|
| 0xBB | A | 0xD5 | a |
| 0xBC | B | 0xD6 | b |
| 0xBD | C | 0xD7 | c |
| ... | ... | ... | ... |
| 0xD4 | Z | 0xEE | z |
| 0xA1 | 0 | 0xAA | 9 |
| 0x00 | (space) | 0xFF | (terminator) |

---

## Map Group/Number to String Mapping (Partial)

| Group | Num | React Map ID |
|-------|-----|--------------|
| 0 | 0 | MAP_PETALBURG_CITY |
| 0 | 1 | MAP_SLATEPORT_CITY |
| 0 | 9 | MAP_LITTLEROOT_TOWN |
| 1 | 0 | MAP_ROUTE101 |
| 1 | 1 | MAP_ROUTE102 |
| 9 | 0 | MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F |
| 9 | 1 | MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F |

*Full mapping available in `public/pokeemerald/include/constants/maps.h`*

---

## Direction Mapping

| Emerald Value | React Value |
|--------------|-------------|
| 1 (DIR_SOUTH) | 'down' |
| 2 (DIR_NORTH) | 'up' |
| 3 (DIR_WEST) | 'left' |
| 4 (DIR_EAST) | 'right' |

---

## Implementation Status

| Mapping | Status | Priority |
|---------|--------|----------|
| PlayerProfile | ✅ Ready | - |
| PlayTime | ✅ Ready | - |
| LocationState | ✅ Ready | - |
| GameFlags | ✅ Ready | - |
| WarpData | ✅ Ready | - |
| MoneyState | 🔧 Code ready, not integrated | Medium |
| BagState | 🔧 Code ready, not integrated | Medium |
| GameOptions | 📝 Mapping documented | Low |
| GameVars | 📝 Mapping documented | Low |
| GameStats | 📝 Mapping documented | Low |
| Pokemon | ⚠️ Complex, needs full impl | High |
| PC Storage | ⚠️ Complex, needs full impl | High |
