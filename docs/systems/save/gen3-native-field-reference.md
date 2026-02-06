---
title: Gen 3 Native Field Reference (R/S/E)
status: reference
last_verified: 2026-01-13
---

# Gen 3 Native Field Reference (R/S/E)

Expanded mapping of the on-cartridge save structures to ease native import/export. All offsets are hex, little-endian. Sources: `public/pokeemerald/include/global.h`, `include/save.h`, PKHeX `SAV3*`, and PokeTunes `pksav/sav/sav3`.

## Section 0 (SaveBlock2)

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x00 | 8 | `playerName` | 7 chars + 0xFF terminator (Gen 3 charset). |
| 0x08 | 1 | `playerGender` | 0=male, 1=female. |
| 0x09 | 1 | `specialSaveWarpFlags` | Continue/dynamic warp flags. |
| 0x0A | 4 | `playerTrainerId` | Lower 16 = TID, upper 16 = SID. |
| 0x0E | 2 | `playTimeHours` | u16 counter. |
| 0x10 | 1 | `playTimeMinutes` | u8. |
| 0x11 | 1 | `playTimeSeconds` | u8. |
| 0x12 | 1 | `playTimeVBlanks` | Frame counter (0–59). |
| 0x13 | 1 | `optionsButtonMode` | 0=Normal, 1=LR, 2=L=A. |
| 0x14 | 2 | `options` bitfield | Bits: 0–2 text speed, 3–7 frame, 8 sound, 9 battle style, 10 battle scene off, 11 region map zoom (Emerald). |
| 0x18 | 0x78 | `pokedex` core | Seen/caught flags + Unown/Spinda PID storage; mirrors also live in SaveBlock1. |
| 0x90 | 8 | filler | Unused padding. |
| 0x98 | 5 | `localTimeOffset` | RTC offset. |
| 0xA0 | 5 | `lastBerryTreeUpdate` | RTC for berry growth. |
| 0xA8 | 4 | `gcnLinkFlags` | Read by Colosseum/XD. |
| 0xAC | 4 | `encryptionKey` | **Emerald only**; RS stores battle tower data here (effectively key=0). |
| 0xB0.. | ~0x2E0 (RS) / ~0x370 (E) | Frontier / Apprentice / minigame records | Keep raw bytes when round-tripping. |
| End | size differs | Total size: RS ≈ 0x890 used, Emerald 0xF2C used. |

## Sections 1–4 (SaveBlock1)

Offsets below are Emerald; RS matches for most fields except bag pockets (see noted differences).

| Offset | Size | Field | Notes |
|--------|------|-------|-------|
| 0x000 | 4 | `pos` | Current map tile X/Y (s16 each). |
| 0x004 | 8 | `location` warp | Map group/num/warp/x/y. |
| 0x00C | 8 | `continueGameWarp` | Used on load/continue. |
| 0x014 | 8 | `dynamicWarp` | Scripted warps. |
| 0x01C | 8 | `lastHealLocation` | Pokemon Center warp. |
| 0x024 | 8 | `escapeWarp` | Dig/Escape Rope destination. |
| 0x02C | 2 | `savedMusic` | |
| 0x02E | 1 | `weather` | |
| 0x030 | 1 | `flashLevel` | Cave light level. |
| 0x032 | 2 | `mapLayoutId` | |
| 0x234 | 1 | `playerPartyCount` | 0–6. |
| 0x238 | 600 | `playerParty[6]` | 6 × 100-byte Pokemon (status+stats+box data). |
| 0x490 | 4 | `money` | XOR with `encryptionKey` in Emerald; plaintext RS. |
| 0x494 | 2 | `coins` | XOR with key in Emerald; plaintext RS. |
| 0x496 | 2 | `registeredItem` | SELECT shortcut. |
| 0x498 | 200 | `pcItems[50]` | PC item storage; **not XORed**. |
| 0x560 | 120 | `bagPocket_Items[30]` | XORed quantities in Emerald. |
| 0x5D8 | 120 | `bagPocket_KeyItems[30]` | XORed in Emerald. (RS offset 0x5B0) |
| 0x650 | 64 | `bagPocket_PokeBalls[16]` | XORed in Emerald. (RS offset 0x600) |
| 0x690 | 256 | `bagPocket_TMHM[64]` | XORed in Emerald. (RS offset 0x640) |
| 0x790 | 184 | `bagPocket_Berries[46]` | XORed in Emerald. (RS offset 0x740) |
| 0x848 | 320 | `pokeblocks[40]` | RS offset 0x7F8. |
| 0x988 | 52 | `seen1` | Pokedex seen flags mirror. |
| 0x9BC | 6 | `berryBlenderRecords[3]` | |
| 0x9C8 | 2 | `trainerRematchStepCounter` | |
| 0x9CA | 0x64 | `trainerRematches` | |
| 0xA30 | 0xFA0 | `objectEvents`/templates | NPC/object state. |
| 0x1270 | 300 | `flags` | 2400 event flags (bitfield). |
| 0x139C | 512 | `vars[256]` | Script vars; u16 each. |
| 0x159C | 256 | `gameStats[64]` | XORed with key in Emerald; plaintext RS. |
| 0x169C.. | many | Berry trees, secret bases, TV/news, swarm/outbreak, etc. |
| 0x2BE0 | 0x240 | `mail[16]` | |
| 0x2E20 | 5 | `unlockedTrendySayings` | Bitfield (Emerald). |
| 0x2E28 | 0x3C | `OldMan`/Dewford trends | |
| 0x3030 | sizeof `DayCare` | Daycare mons/exp (RS offset 0x2F9C). |
| 0x31A8 | 11 | `giftRibbons` | |
| 0x31B3 | 0x14 | `externalEventData` | (RS offset 0x311B) |
| 0x31C7 | 0x14 | `externalEventFlags` | |
| 0x31DC | sizeof `Roamer` | Offset differs RS: 0x3144. |
| 0x31F8 | `EnigmaBerry` | Emerald only. |
| 0x322C | `MysteryGiftSave` | Wonder News/Card offsets follow; see PKHeX `SAV3E`. |
| 0x3598 | 0x180 | filler | |
| 0x3718 | 12 | `trainerHillTimes[3]` | Emerald only. |
| 0x3728 | `RamScript` | |
| 0x3B14 | `RecordMixingGift` | |
| 0x3B24 | 52 | `seen2` | Second Pokedex mirror. |
| 0x3D64 | `trainerHill` | Emerald only. |
| 0x3D70 | `WaldaPhrase` | Emerald only. |
| Size | ~0x3D88 used | Fits across four 0xF80 sectors. |

### Event Flags & Progress

- Flags start at `SaveBlock1 + 0x1270`. Badge bits:
  - RS: badge flags start `0x807` (EventFlag index); Emerald: `0x867`. Bits 0–7 = badges 1–8.
- National Dex unlock:
  - RS: flag `0x836`, work variable `0x46`, magic byte `0xDA` in `pokedex` (SaveBlock2).
  - Emerald: flag `0x896`, work variable `0x46`, magic byte `0xDA`.
- Vars start at index `0x4000` (script engine numbering).

### Money, Coins, Items (Emerald XOR)

- XOR mask is `encryptionKey` (`SaveBlock2[0xAC]`):
  - `money ^= key`
  - `coins ^= key & 0xFFFF`
  - Bag pocket quantities and `gameStats` each word XORed with the key.
  - PC items remain plaintext.
  - RS behaves as if key = 0.

## Sections 5–13 (PokemonStorage)

Layout (total used size ~0x83D0):
- `0x0000`: `currentBox` (1 byte), followed by padding.
- `0x0004`: 14 boxes × 30 slots × 80 bytes `BoxPokemon` (0x83A0 bytes).
- `0x8344`: Box names, 14 × 9 bytes (charset, 8 chars + 0xFF).
- After names: 14 bytes of wallpapers (one per box).
- Remainder padding to 9 × 0xF80 = 0x8D80; rest unused/zero.

## Pokemon Structures (for reference)

- `BoxPokemon` (80 bytes):
  - 0x00 `personality` (u32), 0x04 `otId` (u32), 0x08 `nickname` (10 bytes, charset), 0x12 `language` (u8), 0x13 flags (isBadEgg/hasSpecies/isEgg/blockBoxRS), 0x14 `otName` (7 bytes), 0x1B `markings` (u8), 0x1C `checksum` (u16), 0x1E padding, 0x20 `secure` (48 bytes encrypted substructs).
  - Substructs are shuffled by `personality % 24` and XORed word-wise with key `personality ^ otId`. Checksum covers the 48-byte decrypted substruct region (sum of u16).
  - Substruct contents are detailed in `pokemon-party-storage-system.md`.
- `Pokemon` (100 bytes) = `BoxPokemon` + 20-byte battle data:
  - 0x50 status (u32), 0x54 level (u8), 0x55 mail (u8), 0x56 HP, 0x58 maxHP, 0x5A attack, 0x5C defense, 0x5E speed, 0x60 spAttack, 0x62 spDefense.

## Text Encoding (Trainer/Box/Pokemon Names)

- Gen 3 charset examples: `0xBB`–`0xD4` = `A`–`Z`, `0xD5`–`0xEE` = `a`–`z`, digits `0xA1`–`0xAA`, space `0x00`, terminator `0xFF`.
- Japanese detection: PKHeX infers JP saves if bytes at `playerName[6..7]` are zero (JPN writes 0x00 padding instead of 0xFF).

## Pokedex Mirrors

- SaveBlock2 holds primary seen/caught flags; SaveBlock1 holds mirrors (`seen1` at 0x988 and `seen2` at 0x3B24). PKHeX sets all three locations when marking a species seen/caught to keep mirrors consistent.

## Cross-References

- Import process: `gen3-native-import.md`
- Export process: `gen3-native-export.md`
- Pokemon structure deep dive: `pokemon-party-storage-system.md`
- Sector/rotation/layout overview: `gen3-native-save-format.md`
