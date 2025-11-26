# Gen 3 Native Save Format (R/S/E)

Deep dive into the on-cartridge save layout for Game Boy Advance Gen 3 (Ruby, Sapphire, Emerald) based on `public/pokeemerald` and the reference implementations in `save_editors/PKHeX-master` and `save_editors/PokeTunes-main`. This is the foundation for both import and export of native `.sav` files.

## Physical Layout

- File size: `0x20000` (128 KiB). Some emulators misconfigure as `0x10000` (64 KiB); that variant only contains one save slot and no extra sectors.
- Two rotating save slots, 14 sectors (0x1000 bytes) per slot. Extra data follows the two slots.
- Sector map (per `include/save.h`):
  - IDs 0–13: main save (0: `SaveBlock2`, 1–4: `SaveBlock1`, 5–13: `PokemonStorage`).
  - ID 28/29: Hall of Fame, 30: Trainer Hill, 31: recorded battle/e-Reader (Emerald uses 31 for battle video sentinel `0x0000B39D`).
  - Extra sectors are fixed; only the 14 main sectors rotate.

## Sector Footer

Offsets relative to the start of a 0x1000 sector (matches PKHeX `SAV3` and PokeTunes `flash3`):
- `0xFF4`: `u16` section ID (0–13).
- `0xFF6`: `u16` checksum = sum of all `u32` words in the 0xF80 data region, folded to 16 bits (`upper16 + lower16`).
- `0xFF8`: `u32` signature `0x08012025` (constant in `include/save.h`).
- `0xFFC`: `u32` save counter (monotonically incremented; highest wins, with wrap handling in `SAV3BlockDetection.CompareFooters`).

PKHeX reuses existing sector IDs and rotation; it overwrites only the data region and checksum. PokeTunes does the same when “flashing” back to disk.

## Rotation & Slot Selection

- `save.c` writes sectors using `sector = sectorId + gLastWrittenSector`, modulo 14, then chooses slot by `gSaveCounter % 2`.
- Before each full save the game increments both `gLastWrittenSector` (rotation offset) and `gSaveCounter` (parity selects slot, value stored in footers).
- Active slot detection (PKHeX `SAV3.GetActiveSlot` / `SAV3BlockDetection` and PokeTunes `parseSlot`):
  1. Ensure all 14 section IDs 0–13 are present (`bitTrack == 0x3FFF`).
  2. Pick slot with valid checksum/signature set.
  3. If both valid, choose the one whose section 0 footer has the newer counter (with wraparound guard).

## SaveBlock Mapping & Sizes

- Section 0 → `SaveBlock2` (profile, options, pokedex, encryption key). Actual size differs by version; buffer is 0xF80:
  - RS: 0x890 used; Emerald: 0xF2C used (per PKHeX comment); FRLG not targeted.
- Sections 1–4 → `SaveBlock1` (position, party, items, flags, vars, stats, event data). 4 × 0xF80 bytes (~0x3D88 used in Emerald).
- Sections 5–13 → `PokemonStorage` (14 boxes × 30 slots = 420 mons; box names at offset 0x8344, wallpapers after names). Total 9 × 0xF80 = 0x83D0 used.

## Version Detection (R/S/E only)

Logic mirrors PKHeX `SaveUtil.GetVersionG3SAV`:
- Read word at `SaveBlock2` offset `0xAC`:
  - `0x00000000` → Ruby/Sapphire (no encryption key, no Battle Tower data).
  - `0x00000001` → FR/LG (ignored for our scope).
  - Otherwise, check bytes `0x890..0xF2C`; if any non-zero, treat as Emerald (RS `SaveBlock2` ends at 0x890).
- Japanese detection: PKHeX infers Japanese if `OT` terminator at `0x06` is zero (vs 0xFF padding).

## Encryption Differences

- Emerald: `SaveBlock2` contains `encryptionKey` at `0xAC`. XOR is applied to money (0x490), coins (0x494), bag quantities (but **not** PC items), berry powder (0x1F4), and game stats (`gameStats` array). See `ApplyNewEncryptionKeyToAllEncryptedData` in `load_save.c`.
- Ruby/Sapphire: `encryptionKey` is 0; the same fields are stored plaintext.

## Extra Sectors

- Hall of Fame: two sectors at 0x1C000/0x1D000; PKHeX exposes them as a merged 0x1F00 blob. Checksums are validated only if the sector is not all 0/0xFF.
- e-Reader (JP Emerald) uses 0x1E000. Emerald battle video uses 0x1F000 with sentinel `0x0000B39D` at the start.
- When rebuilding, zero/0xFF-filled extra sectors are considered “unused”; leave them untouched to avoid false corruption.

## Emulator Quirks & Validation

- Half-size (0x10000) saves: only slot A exists. PKHeX marks `IsMisconfiguredSize`; checksum checks skip extra sectors and slot B writes.
- Ensure signatures are present before checksum validation; `save.c` treats missing signatures as empty slots.
- For robustness, mirror writes to both slots when exporting; PKHeX exposes `WriteBothSaveSlots` for this behavior.

## Cross-References

- `save_editors/PKHeX-master/PKHeX.Core/Saves/SAV3*.cs` — sector parsing, checksum, rotation detection, Emerald security key handling.
 - `save_editors/PokeTunes-main/pksav/sav/sav3/parse.ts` and `flash.ts` — TypeScript implementation of the same logic (sector maps, checksum, PC merge).
- `public/pokeemerald/include/save.h` and `src/save.c` — authoritative constants for sector ids and footer layout.
- `public/pokeemerald/include/global.h` — `SaveBlock1`/`SaveBlock2`/`PokemonStorage` field offsets for RSE.
