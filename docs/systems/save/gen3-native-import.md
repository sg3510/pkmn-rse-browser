---
title: Import Pipeline for Native GBA Saves
status: reference
last_verified: 2026-01-13
---

# Import Pipeline for Native GBA Saves

How to ingest `.sav` files from emulators or real hardware (Gen 3 R/S/E) and map them into our browser save model. This consolidates the behavior observed in `save_editors/PKHeX-master`, `save_editors/PokeTunes-main`, and `public/pokeemerald`.

## Goals

- Accept 128 KiB saves (preferred) and tolerate 64 KiB “half” saves.
- Detect Ruby/Sapphire vs Emerald and the active save slot reliably.
- Validate checksums, but degrade gracefully when only partial data is usable.
- Preserve unknown bytes/extra sectors so a later export can round-trip without corrupting unrelated data.

## High-Level Steps

1. **Load & Size Check**
   - Accept `0x20000` (normal) or `0x10000` (misconfigured) byte lengths; reject anything else.
   - Track `hasSecondarySlot = (size == 0x20000)`.

2. **Slot Detection**
   - Use PKHeX logic (`SAV3.IsAllMainSectorsPresent`) to require all IDs 0–13 per slot (`bitTrack == 0x3FFF`).
   - If both slots valid, compare save counters from the sector whose ID = 0 in each slot (footer at `offset + 0xFFC`). Use `SAV3BlockDetection.CompareFooters` semantics to handle wraparound.
   - If only one slot valid, pick it; if neither, surface an error but still expose the raw data for debugging.

3. **Sector Map & Checksum Validation**
   - Build a map of `sectionId -> sectorOffset` for the chosen slot (see PokeTunes `buildSectorMap`).
   - For each sector, compute checksum over 0xF80 bytes (`u32` sum, fold to `u16`) and compare to footer at `0xFF6`.
   - Record failures; if many fail, allow a “best effort” parse but mark the import as lossy.

4. **Version Detection (R/S/E)**
   - Read `SaveBlock2[0xAC]` from section 0 (ignoring FR/LG).
   - If zero → Ruby/Sapphire (no XOR key). If non-zero and bytes `0x890..` contain data → Emerald (XOR key present). Otherwise default to RS.
   - Detect Japanese via PKHeX heuristic (OT terminator bytes at `0x06` are zero).

5. **Reassemble Blocks**
   - Section 0 buffer → `SaveBlock2`.
   - Concatenate sections 1–4 (respecting their order in the sector map) into `SaveBlock1`.
   - Concatenate sections 5–13 into `PokemonStorage` (expect 0x83D0 bytes).
   - Keep a copy of untouched extra sectors (HoF, e-Reader/battle video) for later round-tripping.

6. **Decode Core Fields**
   - Strings: use the Gen 3 charset (already implemented for Emerald import) and terminate on `0xFF`.
   - Money/coins/bag quantities/game stats/berry powder: XOR with `encryptionKey` for Emerald; use plaintext for RS.
   - Party: six `Pokemon` structs at `SaveBlock1 + 0x238`, `playerPartyCount` at `0x234`.
   - Warps/position/options/play time: offsets already documented in `data-mapping-reference.md` and `save-system-analysis.md`.
   - Pokedex flags: mirror exists in both `SaveBlock2` and `SaveBlock1` (`seen1`, `seen2`); combine them via OR to tolerate corruption.

7. **Pokemon Decode (shared for party and PC)**
   - 80-byte `BoxPokemon` format, 100-byte party format (adds status/stats).
   - Substructures: determine order via `personality % 24`, decrypt 4×`u32` words with key `personality ^ otId`.
   - Validate checksum at `0x1C` in the boxed structure; if invalid, mark slot as empty or “Bad Egg” depending on consumer needs (PKHeX treats checksum mismatch as corruption).
   - When decoding IVs/ribbons/met data, follow the tables in `pokemon-party-storage-system.md`.

8. **Data We Can’t Yet Model**
   - Large swathes of `SaveBlock1` (secret bases, TV data, etc.), `SaveBlock2` Frontier structures, and extra sectors.
   - Preserve the raw bytes and store them alongside parsed fields so an export can inject them back untouched.
   - Flag missing mappings so UI can show a “partial import” warning instead of silently dropping content.

9. **Reference Implementations We Can Reuse**
   - **TypeScript:** `save_editors/PokeTunes-main/pksav/sav/sav3/parse.ts` (sector detection, map building, bag/party parsing) is close to what we need in-browser.
   - **C# (reference only):** PKHeX `SAV3` handles misconfigured sizes, checksum validation, save counter comparison, and `SecurityKey` handling; use it as a correctness oracle when writing tests.
   - **C source:** `public/pokeemerald/src/save.c` (footer math) and `src/load_save.c` (encryption key application) for ground truth.

## Output Shape (into our app)

- Map into existing `SaveData` interfaces:
  - `profile`, `playTime`, `options` ← `SaveBlock2`.
  - `location`, `party`, `bag`, `pcItems`, `pcPokemon`, `flags`, `vars`, `stats` ← `SaveBlock1`/`PokemonStorage`.
  - Carry through `encryptionKey`, `saveCounter`, `sectorOrder`, and raw extra sectors for faithful re-export.
- Store the detected version (`'RS' | 'E'`) so export can pick the right offsets and encryption behavior.
