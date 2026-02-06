---
title: Boot Essentials for Native R/S/E Saves
status: reference
last_verified: 2026-01-13
---

# Boot Essentials for Native R/S/E Saves

The minimum fields that must be coherent for a freshly generated `.sav` to load and place the player in the overworld without crashes. Offsets are Emerald unless stated (RS offsets differ only for bag pockets, daycare, roamer).

## Required Blocks & Footers

- Section map must contain all IDs 0–13 with valid checksums and signature `0x08012025`. Save counter can be 1; rotation offset can be 0.
- Write both slots (or only slot A for 0x10000 saves) so the Continue screen appears.

## Identity & Time (SaveBlock2, section 0)

| Offset | Field | Value Hint |
|--------|-------|------------|
| 0x00 | playerName[8] | Gen3 charset, 0xFF padded |
| 0x08 | playerGender | 0 male / 1 female |
| 0x0A | TID/SID | Any u16/u16 |
| 0x0E | playTimeHours | 0 |
| 0x10 | playTimeMinutes | 0 |
| 0x11 | playTimeSeconds | 0 |
| 0x13 | optionsButtonMode | 0 (Normal) |
| 0x14 | options | Text speed/frame/sound/battle style; match in-game defaults |
| 0xAC | encryptionKey (Emerald) | Random u32 (used to XOR money/items/stats) |

If RS: key effectively 0; money/items/stats should be plaintext.

## Placement & Warps (SaveBlock1, sections 1–4)

| Offset | Field | Value Hint |
|--------|-------|------------|
| 0x00 | pos.x/pos.y | Tile coords (s16) |
| 0x04 | location warp | mapGroup, mapNum, warpId, x, y |
| 0x0C | continueGameWarp | Copy of location for Continue |
| 0x1C | lastHealLocation | PokeCenter warp; set same as location to avoid null heal |
| 0x24 | escapeWarp | Safe default (Petalburg map) |
| 0x2C | savedMusic | 0 |
| 0x30 | flashLevel | 0 |
| 0x32 | mapLayoutId | Match map |

### Safe Starting Point (Littleroot, upstairs)
- mapGroup = 9, mapNum = 1 (Brendan’s Room upstairs) or 0 for player choice. WarpId = 0.
- x/y = 7/6 (center of the room), warp coords = same.
- pos.x/pos.y should match x/y.
- continueGameWarp = same values.
- lastHealLocation = Littleroot Center: mapGroup 0, mapNum 9, warp 0, x/y near door (e.g., 12/7) or copy of start.

### Direction / Surfing
- Facing direction is not stored directly; movement state comes from object events. Default object state from new game is fine if warps are valid.

## Flags, Vars, and Progress

- Flags start at `0x1270` (bitfield). Set essentials:
  - `FLAG_ADVENTURE_STARTED` (index 0x74) = 1 to show Continue.
  - If you want Pokedex: set `FLAG_RECEIVED_POKEDEX` (same index) and `NationalDex` bits (see below).
- Vars at `0x139C`: generally zero. Set var 0x403E (player gender dialogue) if needed; safe to leave zero for a new game state.
- Badges: RS flags 0x807–0x80E, Emerald 0x867–0x86E. Set bits as desired (all 0 for fresh game).
- National Dex unlock (optional):
  - RS: flag 0x836, Pokedex magic byte 0xDA at `SaveBlock2[0x18+2]`, work var 0x46 = 0x0302.
  - Emerald: flag 0x896, same magic byte 0xDA, work var 0x46 = 0x0302.

## Money, Items, Party

- `money` (0x490) and `coins` (0x494): XOR with `encryptionKey` in Emerald; RS plaintext. Start at 0/0.
- Bag pockets (Emerald offsets): items 0x560, key items 0x5D8, balls 0x650, TMHM 0x690, berries 0x790. XOR quantities in Emerald; RS plaintext. Fill itemId=0, qty=0 for empties.
- PC items (0x498): plaintext, same struct as bag slots.
- Party:
  - `playerPartyCount` (0x234) = 0 for empty party; or build full 100-byte party entries (see `gen3-party-pokemon-example.md`).
  - Empty party slots can be zeroed; checksum for empty mons should be 0 so they decode as empty.
- PC storage (sections 5–13): can be all zero; box names at 0x8344 should be filled with 0xFF terminators to avoid garbage strings.

## Pokedex Mirrors

- SaveBlock2 has primary seen/caught flags; SaveBlock1 has mirrors (`seen1` at 0x988, `seen2` at 0x3B24). For a clean new game, zero all three; for a starter set, OR the bits across all three.

## Extra Sectors

- Hall of Fame (0x1C000/0x1D000), e-Reader (0x1E000), battle video (0x1F000): leave all 0/0xFF; checksums can stay 0. PKHeX treats all-FF/0 as uninitialized.

## Minimal Happy Path Checklist

- Section footers valid (IDs, checksums, signature).
- `playerName` non-empty, `playerGender` set.
- `FLAG_ADVENTURE_STARTED` set.
- Warps/location/pos coherent and point to a valid map.
- `encryptionKey` non-zero in Emerald; money/items/stats XORed with it.
- Party count and slots consistent (0 or valid mons).
- Box names null-terminated (0xFF) to avoid stray characters.

Meeting these ensures the Continue option appears and the player spawns in the target map with no softlocks. For more complex states (Pokedex, badges, story progress), set the corresponding flags/vars and matching Pokedex magic bytes as described above. 

## Implementation Tips (from PKHeX & PokeTunes)

- Always validate section IDs (0–13) and signatures before checksums; treat missing/invalid as empty rather than corrupt.
- For 0x10000 saves, skip secondary slot and extra-sector validation; only slot A exists.
- Version detection: `SaveBlock2[0xAC]` (0=RS, 1=FRLG, else Emerald if data past 0x890). Japanese detection via OT terminator at `0x06` (0 instead of 0xFF).
- Emerald XOR scope: money, coins, bag quantities, berry powder, gameStats. PC items stay plaintext. RS behaves as key=0.
- Storage assembly/writes use sector IDs, not physical order. Copy boxes (sections 5–13) by ID; recompute sector checksums after writes.
- Party/PKM: enforce substructure order `personality % 24`, checksum decrypted 48 bytes; set party mail ID to 0xFF when no mail.
- Write both slots on export (mirror active save) unless size is 0x10000; keeps either slot bootable.
- Extra sectors: only checksum if not all 0/0xFF; preserve raw HoF/battle video/e-Reader data when round-tripping.
