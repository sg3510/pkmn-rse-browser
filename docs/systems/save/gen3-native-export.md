---
title: Export Pipeline for Native GBA Saves
status: reference
last_verified: 2026-01-13
---

# Export Pipeline for Native GBA Saves

How to emit `.sav` files that real Gen 3 games and emulators accept. Mirrors the behaviors in `public/pokeemerald/src/save.c` and PKHeX `SAV3` while fitting our browser data model.

## Goals

- Produce a full 128 KiB save; optionally support 64 KiB for emulators that only expect one slot.
- Preserve unknown data when exporting an imported save; when exporting from scratch, create sane defaults that pass checksum/signature validation.
- Write both save slots so either slot can boot on hardware.

## Strategy: Two Scenarios

1. **Round-trip from import** (preferred): reuse the original sector order, save counter, signatures, and untouched bytes for fields we don't model (Frontier data, secret bases, extra sectors). Overwrite only the fields we can author.
2. **New save from JSON only:** start from a version-specific blank template (see PKHeX `BlankSaveFile` or build one from decomp structs), choose rotation/counter values, and zero-fill data we can't represent.

## Steps to Build Save Blocks

1. **Pick Version & Key**
   - Use stored version (`'RS' | 'E'`). For Emerald, choose an `encryptionKey`: reuse the imported key if present; otherwise generate a random `u32` and XOR all encrypted fields with it.
   - For RS, key = 0; all encrypted fields are plaintext.

2. **Encode `SaveBlock2` (section 0)**
   - Encode OT name (7 chars + 0xFF terminator) and gender.
   - Trainer IDs, play time, options bitfield at `0x14`, button mode at `0x13`.
   - Pokedex flags and special fields (Unown/Spinda personality). Mirror seen flags will also be written into `SaveBlock1`.
   - Emerald-only: write `encryptionKey` at `0xAC`; RS leave as 0.
   - Leave untouched bytes (Frontier/apprentice records) as-is when round-tripping.

3. **Encode `SaveBlock1` (sections 1–4)**
   - Position/warp offsets match the existing docs; choose map/warp ids based on our state.
   - Party: serialize 6×100-byte `Pokemon` structs (status/stats first, then 80-byte boxed data).
     - Compute boxed checksum at `0x1C`, encrypt substructures with key `personality ^ otId`, shuffle by `personality % 24`.
   - Money, coins, bag quantities, game stats, berry powder: XOR with `encryptionKey` in Emerald; plaintext for RS. PC items stay plaintext.
   - Flags/vars/stats: write the bit arrays directly; fill unmapped bytes with preserved data when available.

4. **Encode `PokemonStorage` (sections 5–13)**
   - Boxed mons are 80-byte `BoxPokemon` structs with the same encryption/shuffle/checksum rules as party mons.
   - Box names (9 bytes each) and wallpapers after the 14×30 mons; set `currentBox` byte 0.

5. **Handle Extra Sectors**
   - If imported bytes exist for HoF / Trainer Hill / battle video / e-Reader, copy them back verbatim; recompute checksum only if sector is not all 0/0xFF.
   - If generating from scratch, leave extra sectors zeroed/0xFF so `SetSectorValidExtra` in PKHeX would skip checksum.

## Assembling Sectors & Footers

1. **Choose rotation + counter**
   - If round-tripping, keep the existing `sectionId` footer values and `saveCounter`; optionally bump counter by 1 and rotate `lastWrittenSector = (prev + 1) % 14` to mimic in-game behavior.
   - From scratch: set `saveCounter` to 1, `lastWrittenSector` to 0 (no rotation) for simplicity, or emulate the full algorithm from `save.c` if desired.
2. **Write section data**
   - For each sector in the chosen slot: copy the correct chunk (small/large/storage) into the 0xF80 data region indicated by the footer’s `sectionId`.
   - Compute checksum and store at `0xFF6`; set `sectionId` at `0xFF4`, `signature` to `0x08012025` at `0xFF8`, `counter` at `0xFFC`.
3. **Mirror slots**
   - Write the assembled 14 sectors into slot A (offset 0) and slot B (offset 0xE000) using the same `sectionId` order. If emitting 64 KiB, only slot A is written.
4. **Append extras**
   - Place HoF/e-Reader/battle video sectors at 0x1C000/0x1D000/0x1E000/0x1F000. Update checksums if data is present.

## Validation Plan

- Run the import pipeline over the freshly written file; the re-decoded state should match the source state byte-for-byte for modeled fields.
- Spot-check in PKHeX: it should load without checksum complaints and show the correct trainer/party/boxes.
- Emulator smoke test: boot the ROM with the exported `.sav` in slot A/B and ensure the Continue screen appears.
- For Emerald, verify money/bag/coins decode correctly after XOR; for RS, ensure the same values read back without XOR.

## Open Items / Decisions

- Whether to always bump `saveCounter` on export (safe) vs reuse existing; bumping avoids two slots appearing equally “new”.
- How aggressive to be when data is missing: for now prefer zero/0xFF padding with clear warnings rather than synthesizing values.
- If we later support FR/LG, add the 0xF20 security key position and FR/LG bag offsets, but keep the R/S/E logic isolated.
