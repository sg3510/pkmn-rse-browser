# Save System Implementation Checklist

**Goal:** Save/Load buttons top-right in UI. Browser auto-saves as player explores. Continue resumes, New Game resets. Load imports `.sav` or `.json`. Save exports to `.sav` or `.json`.

**Design Principle:** Incremental implementation. Each tier adds more save data fields. The system works at Tier 1; later tiers enrich it.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SaveData Interface                         │
│  (One unified type for ALL save operations)                     │
│                                                                 │
│  - Browser localStorage uses SaveData                           │
│  - .json export/import uses SaveData                            │
│  - .sav import converts TO SaveData                             │
│  - .sav export converts FROM SaveData                           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Browser    │    │  .json File   │    │  .sav File    │
│  localStorage │    │  (portable)   │    │ (GBA native)  │
│               │    │               │    │               │
│  Auto-save    │    │  Human-       │    │  Emulator-    │
│  every 60s    │    │  readable     │    │  compatible   │
└───────────────┘    └───────────────┘    └───────────────┘
```

**Key Insight:** The browser state IS the save. Same interface, same data. No conversion needed between browser ↔ .json. Only .sav needs parsing/serialization.

**Continue Button Logic:**
```typescript
// Simple check - if browser has SaveData, show Continue
const showContinue = localStorage.getItem('pokemon-rse-save-slot-0') !== null;
```

---

## Tier 1: Core Browser Save (MVP)

### 1.1 UI: Save/Load Buttons
- [x] Add "Save" and "Load" buttons to `GamePage.tsx` header (next to "Pkmn RSE Browser" text)
- [x] Style buttons to match existing UI (small, unobtrusive)
- [x] Save button opens dropdown: "Save to Browser", "Export .json", "Export .sav" (disabled until Tier 4)
- [x] Load button opens file picker accepting `.json` and `.sav` files
- [ ] Show toast/notification on save success/failure

### 1.2 Browser Auto-Save (Browser State = Save State)
- [x] Create `useAutoSave` hook that triggers on:
  - [ ] Map change (warp completed) - hook exists, needs wiring
  - [ ] Every 60 seconds while in OVERWORLD state - hook exists, needs wiring
  - [x] Manual save button press
- [x] Save current state to `localStorage` slot 0 (primary slot)
- [x] Debounce rapid saves (min 5 second gap)
- [x] Add `lastAutoSave` timestamp to prevent duplicate saves
- [x] **Key:** Browser state uses same `SaveData` interface as file exports
- [ ] On any state change (position, items, flags), update in-memory SaveData
- [ ] Periodic flush to localStorage (not on every frame)

### 1.3 Unified SaveData Interface
The same interface for browser state, .json files, and converted .sav data:

```typescript
// src/save/types.ts - THE source of truth
interface SaveData {
  version: number;           // Schema version for migrations
  timestamp: number;         // Last save time (Unix ms)

  // Tier 1: Core (MVP)
  profile: PlayerProfile;    // name, gender, TID, SID
  location: LocationState;   // pos, mapId, direction, elevation
  playTime: PlayTime;        // hours, minutes, seconds

  // Tier 2: Extended (optional, added incrementally)
  money?: MoneyState;        // money, coins
  options?: GameOptions;     // text speed, sound, etc.

  // Tier 3: Inventory & Progress
  bag?: BagState;            // all pocket items
  pcItems?: PCItemsState;    // PC storage items
  flags?: string[];          // set flags (sparse array)
  vars?: Record<number, number>;

  // Tier 4: Pokemon
  party?: PartyState;        // up to 6 Pokemon
  pcPokemon?: PCPokemonState;// 14 boxes
  pokedex?: PokedexState;    // seen/caught

  // Tier 5: Native round-trip
  _native?: NativeMetadata;  // encryption key, raw buffer, etc.
}
```

- [x] Update `src/save/types.ts` with this tiered structure
- [x] All fields after Tier 1 are optional (backward compatible)
- [x] Browser localStorage stores JSON.stringify(SaveData)
- [x] .json export IS SaveData (no conversion)
- [x] .sav import PRODUCES SaveData

### 1.4 Main Menu: Continue/New Game
- [x] Modify `MainMenuState.ts` to check `saveManager.hasAnySave()`
- [x] If save exists: show "CONTINUE" option with preview (name, map, time)
- [x] If no save: only show "NEW GAME"
- [x] "CONTINUE" loads slot 0 and transitions to OVERWORLD at saved position
- [x] "NEW GAME" calls `saveManager.newGame()` and starts fresh

### 1.5 Load from Browser on Boot
- [x] On app start, `SaveManager` checks for existing slot 0
- [x] If valid, populate in-memory state for Continue preview
- [ ] If corrupted JSON, mark as invalid and log warning

### 1.6 JSON Import/Export
- [x] `saveManager.exportToJson()` - already exists, verify working
- [x] `saveManager.importFromJson()` - already exists, verify working
- [x] Wire to Load button file picker (filter `.json`)
- [x] Wire to Save dropdown "Export .json" option

---

## Tier 2: Native .sav Import (Read-Only)

### 2.1 Parser Infrastructure
- [x] Create `src/save/native/` directory
- [x] Create `Gen3SaveParser.ts` main class
- [x] Create `Gen3Charset.ts` with encode/decode functions
- [x] Create `Gen3Constants.ts` with offsets/sizes (replaces Gen3Crypto.ts)
- [x] Create `index.ts` to export all native utilities

### 2.2 Sector Detection
- [x] Implement `detectActiveSlot(buffer)` - find slot with higher save counter
- [x] Implement `validateSlot(buffer, slot)` - check all 14 sections present
- [x] Implement `buildSectionMap(buffer, slot)` - map sectionId → offset
- [x] Implement `validateChecksum(buffer, sectorOffset)` - verify data integrity
- [x] Handle 64KB saves (slot A only) vs 128KB (both slots)

### 2.3 SaveBlock2 Parsing (Section 0)
- [x] Parse player name (Gen3 charset decode)
- [x] Parse gender (offset 0x08)
- [x] Parse TID/SID (offset 0x0A-0x0D)
- [x] Parse play time (offset 0x0E-0x12)
- [x] Parse encryption key (Emerald offset 0xAC, RS = 0)
- [ ] Parse options (offset 0x13+)

### 2.4 SaveBlock1 Parsing (Sections 1-4)
- [x] Read from sections 1-4 via section map
- [x] Parse position x/y (offset 0x00-0x03)
- [x] Parse current location warp (offset 0x04)
- [x] Parse continue game warp (offset 0x0C)
- [x] Parse last heal location (offset 0x1C)
- [x] Parse escape warp (offset 0x24)
- [x] Parse money with XOR decryption (offset 0x490)
- [x] Parse coins with XOR decryption (offset 0x494)

### 2.5 Map ID Resolution
- [x] Create `mapGroupNumToId(group, num)` function
- [x] Load map_groups.json at build time or runtime
- [x] Cross-reference with existing mapIndex.json
- [x] Return `{ mapId, displayName }` or undefined for unknown

### 2.6 Import Flow Integration
- [x] Detect file type by extension and magic bytes
- [x] If `.sav`: parse with Gen3SaveParser
- [x] Convert native data to SaveData format
- [x] Store in localStorage via SaveManager
- [x] Update Continue preview immediately

### 2.7 Sample Save Validation
- [ ] Write test that loads `public/sample_save/...2.sav`
- [x] Assert: name = "Seb", gender = male (verified manually)
- [x] Assert: TID = 32267, SID = 38794 (verified manually)
- [x] Assert: playtime = 24:36:41 (verified manually)
- [x] Assert: money = 3068 (after XOR) (verified manually)
- [x] Assert: map = MAP_PETALBURG_WOODS (group 24, num 11) (verified manually)

---

## Tier 3: Extended Save Data

### 3.1 Inventory System
- [ ] Parse PC items (offset 0x498, NOT encrypted)
- [ ] Parse bag items with XOR (offset 0x560)
- [ ] Parse key items (offset 0x5D8)
- [ ] Parse Poké Balls (offset 0x650)
- [ ] Parse TM/HMs (offset 0x690)
- [ ] Parse berries (offset 0x790)
- [x] Add `BagState` and `PCItemsState` to browser save
- [x] Auto-save includes current inventory
- [x] Create BagManager for inventory management
- [x] Wire item pickup to add items to bag

### 3.2 Collected Items Tracking
- [x] Track item ball pickups via flags
- [ ] Track hidden items found via flags
- [x] Save which overworld items have been collected (via GameFlags)
- [x] On load, hide collected item sprites from map

### 3.3 Game Flags
- [ ] Parse flags bitfield (offset 0x1270, 0x12C bytes)
- [ ] Map flag indices to meaningful names (from pokeemerald constants)
- [ ] Key flags to track:
  - [ ] `FLAG_SYS_POKEMON_GET` - has starter
  - [ ] `FLAG_BADGE01_GET` through `FLAG_BADGE08_GET`
  - [ ] `FLAG_RECEIVED_POKEDEX`
  - [ ] `FLAG_SYS_GAME_CLEAR` - beat Elite Four
- [ ] Save flags to browser, restore on continue

### 3.4 Game Variables
- [ ] Parse vars array (offset 0x139C, 256 u16 values)
- [ ] Map important vars (story progress, etc.)
- [ ] Save/restore with browser save

### 3.5 Game Stats
- [ ] Parse game stats with XOR decryption
- [ ] Steps taken, Pokemon caught, trainers defeated
- [ ] Include in save preview (optional display)

---

## Tier 4: Pokemon Data

### 4.1 Party Pokemon Parsing
- [ ] Create `Gen3Pokemon.ts` parser
- [ ] Handle substructure shuffle (personality % 24)
- [ ] Decrypt 48-byte data block
- [ ] Validate checksum
- [ ] Parse Growth substructure (species, exp, item)
- [ ] Parse Attacks substructure (moves, PP)
- [ ] Parse EVs/Condition substructure
- [ ] Parse Misc substructure (IVs, met location, ribbons)
- [ ] Parse party-only data (current HP, stats, level)

### 4.2 Party State
- [ ] Read party count (offset 0x234)
- [ ] Parse up to 6 party Pokemon
- [ ] Convert to browser `PartyState` format
- [ ] Display party preview on Continue screen (species icons?)

### 4.3 PC Pokemon Storage (Sections 5-13)
- [ ] Concatenate sections 5-13
- [ ] Parse current box number
- [ ] Parse 14 boxes × 30 Pokemon each
- [ ] Parse box names (offset 0x8344)
- [ ] Parse box wallpapers
- [ ] Store in browser save (optional, large data)

### 4.4 Pokedex
- [ ] Parse owned flags from SaveBlock2
- [ ] Parse seen flags (SaveBlock2 + mirrors in SaveBlock1)
- [ ] Calculate caught/seen counts
- [ ] Display on Continue preview

---

## Tier 5: Native .sav Export

### 5.1 Export Infrastructure
- [ ] Store original raw buffer when importing .sav
- [ ] Create `Gen3SaveWriter.ts`
- [ ] Implement sector assembly with rotation
- [ ] Implement checksum calculation
- [ ] Implement XOR encryption for Emerald

### 5.2 Write Modified Fields
- [ ] Write player position back to SaveBlock1
- [ ] Write money/coins with XOR
- [ ] Write bag contents with XOR
- [ ] Write flags/vars
- [ ] Write party Pokemon (re-encrypt, recalculate checksum)
- [ ] Increment save counter

### 5.3 Export Flow
- [ ] Enable "Export .sav" in Save dropdown
- [ ] Build 128KB buffer from modified data
- [ ] Trigger browser download
- [ ] Validate exported file can be re-imported

### 5.4 Round-Trip Test
- [ ] Import sample save
- [ ] Modify position
- [ ] Export to .sav
- [ ] Re-import exported save
- [ ] Verify position changed, other data intact

---

## Tier 6: Polish & Edge Cases

### 6.1 Error Handling
- [ ] Graceful handling of corrupted saves
- [ ] Clear error messages for invalid .sav files
- [ ] Recovery option to delete corrupted slot
- [ ] Backup slot before overwriting

### 6.2 Multiple Save Slots
- [ ] Support 3 save slots (like Pokemon games)
- [ ] Slot selection UI on Continue screen
- [ ] Copy/delete slot functionality

### 6.3 Save Versioning & Migration
- [ ] Bump SAVE_VERSION on schema changes
- [ ] Write migration functions (v1→v2, v2→v3, etc.)
- [ ] Test migrations with old save fixtures

### 6.4 Ruby/Sapphire Support
- [ ] Detect RS vs Emerald (check encryptionKey location)
- [ ] Adjust offsets for RS differences
- [ ] Skip XOR encryption for RS (key = 0)

### 6.5 Region Support
- [ ] Detect Japanese saves (OT terminator at 0x06)
- [ ] Use Japanese charset for name decoding
- [ ] Handle different map IDs if needed

---

## File Structure

```
src/save/
├── SaveManager.ts          # Main orchestrator (exists)
├── types.ts                # All TypeScript interfaces (exists, expand)
├── useAutoSave.ts          # NEW: React hook for auto-save
├── native/
│   ├── index.ts            # Export all native utilities
│   ├── Gen3SaveParser.ts   # Main parser class
│   ├── Gen3SaveWriter.ts   # Export/write functionality (Tier 5)
│   ├── Gen3Pokemon.ts      # Pokemon data parsing (Tier 4)
│   ├── Gen3Charset.ts      # Character encoding/decoding
│   ├── Gen3Crypto.ts       # XOR encryption helpers
│   ├── Gen3Constants.ts    # Offsets, sizes, magic numbers
│   ├── mapResolver.ts      # mapGroup/mapNum → mapId
│   └── types.ts            # Native-specific interfaces
└── __tests__/
    ├── SaveManager.test.ts
    ├── Gen3SaveParser.test.ts
    └── sampleSave.test.ts  # Tests against real .sav file
```

---

## Quick Reference: Key Offsets (Emerald)

| Field | Section | Offset | Size | Notes |
|-------|---------|--------|------|-------|
| Player Name | 0 | 0x00 | 8 | Gen3 charset, 0xFF term |
| Gender | 0 | 0x08 | 1 | 0=M, 1=F |
| TID | 0 | 0x0A | 2 | u16 LE |
| SID | 0 | 0x0C | 2 | u16 LE |
| Play Time | 0 | 0x0E | 5 | u16 hrs, u8 min/sec/frame |
| Encryption Key | 0 | 0xAC | 4 | u32 LE (Emerald only) |
| Position X/Y | 1 | 0x00 | 4 | s16, s16 |
| Location Warp | 1 | 0x04 | 8 | group, num, warp, x, y |
| Party Count | 1 | 0x234 | 4 | u32 |
| Party Pokemon | 1 | 0x238 | 600 | 6 × 100 bytes |
| Money | 1 | 0x490 | 4 | u32 XOR encrypted |
| Coins | 1 | 0x494 | 2 | u16 XOR encrypted |
| PC Items | 1 | 0x498 | 200 | 50 × 4 bytes, NOT encrypted |
| Bag Items | 1 | 0x560 | 120 | 30 × 4 bytes, qty XOR |
| Flags | 1 | 0x1270 | 300 | Bitfield |
| Vars | 1 | 0x139C | 512 | 256 × u16 |

---

## Success Criteria

**Tier 1 Complete When:**
- [x] Can walk around, close browser, reopen, press Continue, be at same spot
- [x] New Game starts fresh
- [x] Can export/import .json saves

**Tier 2 Complete When:**
- [x] Can import sample .sav file
- [x] Continue shows "Seb", "Petalburg Woods", "24:36"
- [x] Player spawns at correct map position
- [x] Player name used in dialogs (e.g., "Seb found one Revive!")

**Tier 3 Complete When:**
- [ ] Imported save shows correct money (¥3068)
- [ ] Collected items stay collected after Continue
- [ ] Badges display correctly

**Tier 4 Complete When:**
- [ ] Party Pokemon parsed and displayable
- [ ] Pokedex counts accurate
- [ ] PC boxes accessible (if UI exists)

**Tier 5 Complete When:**
- [ ] Can export modified save back to .sav
- [ ] Exported .sav works in real emulator
- [ ] Round-trip preserves all data

---

## Implementation Order (Recommended)

1. **Week 1:** Tier 1.1-1.4 (UI + basic browser save)
2. **Week 2:** Tier 1.5-1.6 + Tier 2.1-2.3 (load on boot + parser start)
3. **Week 3:** Tier 2.4-2.7 (complete .sav import)
4. **Week 4:** Tier 3.1-3.3 (inventory + flags)
5. **Future:** Tiers 4-6 as needed

Each tier is independently useful. Ship Tier 1 first for immediate value.
