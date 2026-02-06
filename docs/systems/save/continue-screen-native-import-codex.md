---
title: Continue / New Game Screen & Native `.sav` Import (Codex)
status: reference
last_verified: 2026-01-13
---

# Continue / New Game Screen & Native `.sav` Import (Codex)

## Scope & Goals
- Detect browser-cached saves and surface a **Continue** option that mirrors Emerald’s title screen (slot preview + New Game).
- Import native Emerald `.sav` files (128 KiB/64 KiB variants) into our JSON save model so the Continue button shows correct info immediately after import.
- Keep mappings faithful to Emerald (map IDs, warps, encryption key handling, bag/party structures) while leaving room to add more fields (PC, items, stats) incrementally.

## Existing Infrastructure (what we can reuse today)
- **React save stack:** `src/save/SaveManager.ts` (localStorage JSON slots, previews, auto-load), `src/save/types.ts` (SaveData mirrors SaveBlock1/2 but many fields optional). Saves live under key `pokemon-rse-browser-save-slot-{n}`.
- **Docs:** `docs/systems/save/save-system-analysis.md`, `data-mapping-reference.md`, `emerald-save-import-guide.md` (step-by-step import), `gen3-native-save-format.md`, `pokemon-party-storage-system.md`.
- **Native parsers to copy from:** `save_editors/PokeTunes-main/pksav/sav/sav3/*.ts` (sector detection, checksum, XOR key, bag/party parsing) and PKHeX (reference logic, not runtime).
- **Map mapping data:** `public/pokeemerald/data/maps/map_groups.json` (group → map list) + `src/data/mapIndex.json` (`name` → `id`/assets). Lets us turn `(mapGroup,mapNum)` into `mapId` + display name.
- **Sample save:** `public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav` for validation.

## Findings from the sample save (ground truth for testing)
- File length `0x20010` (16 extra bytes tail, can be ignored; first `0x20000` is canonical).
- Active slot: slot A (offset `0x0`, saveCounter=2, all 14 sections present).
- SaveBlock2 (section 0):
  - Name **“Seb”**, gender male (0), TID `32267`, SID `38794`.
  - Play time **24:36:41**.
  - Encryption key `0xDA140918`.
  - Options: textSpeed=mid(1), windowFrame=0, stereo(0), battleStyle=shift(0), battleScene on.
- SaveBlock1 (sections 1–4 concatenated):
  - Pos `(12,33)`, facing stored elsewhere.
  - Current location warp → mapGroup 24 / mapNum 11 → **PetalburgWoods** (`MAP_PETALBURG_WOODS`), warpId 2, coords (-1,-1) as in native struct.
  - Continue warp → group 0 / num 0 → **PetalburgCity** (`MAP_PETALBURG_CITY`), warpId 0, coords (0,0).
  - Last heal + escape warp → PetalburgCity, warpId -1, coords (20,17).
  - Money **¥3068**, coins 0 (XOR decoded with key).
  - Bag (XOR decoded): Items `[Potion x5 (id13), Antidote x1 (id14)]`; Balls `[Poké Ball x8 (id4)]`; Berries `[Oran? id135 x2, Pecha? id139 x2]`; Key items empty.
  - PC items: slot0 `(id13 x1)`; Party count **2** (species decoding pending).

These values should appear in the Continue preview once import works (player name, map display “Petalburg Woods”, playtime 24:36, money 3068).

## Proposed Continue/New flow (browser saves)
- On boot, TitleScreen state asks `saveManager.getSaveSlots()` for previews; if any `exists`, show **Continue** + **New Game** menu (mirroring Emerald). If none, auto-focus New Game.
- Preview contents per slot: player name, map display name (lookup mapId → `mapIndex.name`), play time, timestamp, badges (once flags mapped), Pokédex caught (when available). Persist this lightweight preview in localStorage alongside save to avoid heavy parse on boot.
- Active slot selection: default to most recent timestamp; allow D-pad/arrow to pick slot (3 slots already defined). Store selection in SaveManager `activeSlot`.
- Corruption handling: if JSON parse fails, mark slot “Corrupted” and disable Continue for it (option to delete).
- Migration: If older saves lack new fields, hydrate defaults (v1→v2 migrations) before Continue.

## Native `.sav` import → Continue
Pipeline (TypeScript module `src/save/nativeImport.ts`):
1) **Load & normalize**
   - Accept File/ArrayBuffer; if length > `0x20000`, drop trailing bytes; accept 64 KiB by duplicating as slot A only.
2) **Detect active slot**
   - For each 14-sector block, require `bitTrack == 0x3FFF`; choose higher `saveCounter` (sectionId 0 footer at `0xFFC`).
3) **Build sector map + checksum**
   - Map `sectionId → offset`; compute checksum over 0xF80 bytes; collect failures for warnings.
4) **Reassemble blocks**
   - SaveBlock2 = section0 data; SaveBlock1 = concat sections 1–4; PC storage = concat 5–13. Keep untouched extra sectors for future re-export.
5) **Decode core fields**
   - Gen3 charset decode for names (table already in `gen3-native-field-reference.md`; reuse `decodeName3` from PokeTunes).
   - Encryption key at SB2 `0xAC`; apply XOR to money/coins/bag quantities.
   - Warps/location at SB1 offsets (0x04,0x0C,0x1C,0x24) → mapId via `map_groups.json` + `mapIndex.json`.
   - Options bits at SB2 `0x14`, playTime at `0x0E` etc.
   - Flags/vars/stats using offsets in `data-mapping-reference.md`.
6) **Pokemon decode**
   - Reuse `pksav/pkm/PK3` logic from PokeTunes for party + PC (handles substructure shuffle + checksum). Convert to our `Pokemon` type (extend as needed).
7) **Materialize SaveData**
   - Fill `profile`, `playTime`, `options`, `location`, `money`, `bag`, `pcItems`, `party`, `pcPokemon`, `flags`, `vars`, `stats`, `pokedex` (OR of seen/caught mirrors).
   - Attach `nativeMetadata` (see below) + raw buffer for round-trip export.
8) **Persist & preview**
   - Save via `saveManager.importFromJson()` once converted to JSON (slot 0 by default or user-chosen).
   - Produce preview payload so TitleScreen Continue shows: name “Seb”, map “Petalburg Woods”, time 24:36:41, money ¥3068, party size 2.

## Type/interface additions (to keep mappings exact)
- Add to `src/save/types.ts`:
  ```ts
  export interface NativeMetadata {
    game: 'E' | 'RS';
    activeSlot: 'A' | 'B';
    saveCounter: number;
    encryptionKey: number;
    sectorOrder: number[];      // sectionId order as read
    checksumFailures: number[]; // sectionIds with bad checksum
    rawLength: number;          // after normalization
    sourceFilename?: string;
  }

  export interface SaveData {
    // existing fields...
    native?: {
      meta: NativeMetadata;
      raw?: Uint8Array; // preserved for export/round-trip
    };
  }
  ```
- Consider making `money`, `bag`, `pcItems`, `party`, `pcPokemon`, `options`, `pokedex`, `stats` non-optional once import populates them; keep JSON saves backward-compatible via defaults.
- Utility: `mapGroupNumToMapId(group:number, num:number): {mapId?: string; name?: string}` using `map_groups.json` + `mapIndex.json`.

## Implementation steps (suggested order)
1) **Parser skeleton**: copy PokeTunes `sav3/parse.ts` logic into `src/save/nativeImport.ts` (strip external deps, add our type outputs). Add charset decoder helper.
2) **Map resolution**: implement `mapGroupNumToMapId` using bundled data files; write unit test against sample save (expect PetalburgWoods).
3) **Sample-save fixture test**: small Node/VIte test that loads `public/sample_save/...2.sav` and asserts extracted profile/map/playtime/money/bag counts match findings above.
4) **SaveData expansion + migration**: add `native` + defaults; bump `SAVE_VERSION` to 2 with migration in `SaveManager.load/import`.
5) **Continue screen UI**: update TitleScreen to call `getSaveSlots()`, show Continue/New menu with preview; wire Continue to load selected slot via SaveManager; ensure auto-start works after import.
6) **Import hook**: add UI entry “Import GBA Save (.sav)” → run parser → SaveManager.import → re-render preview.
7) **Later**: PC storage + badges display, re-export native `.sav` using preserved raw + mutated fields.

## Notes / edge cases
- Some emulators emit 64 KiB or pad extra bytes (as in sample). Normalize to 0x20000 before parsing; warn if checksum failures.
- Map IDs: negative mapGroup/mapNum should resolve to `undefined` and fall back to default map for JSON saves.
- XOR key is Emerald-specific; RS uses 0. Use detected `game` to skip XOR when not needed.
- Preserve unknown bytes for lossless round-trip even if we don’t map them yet (secret bases, TV data, etc.).
