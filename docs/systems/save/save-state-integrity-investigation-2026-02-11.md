---
title: Save State Integrity Investigation (Emerald Legacy Route 114 Import)
status: bug
last_verified: 2026-02-11
---

# Save State Integrity Investigation (Emerald Legacy Route 114 Import)

## Scope

- Investigate save import/state issues reported for:
  - `public/sample_save/Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav`
- Compare behavior against a known-working vanilla sample:
  - `public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav`
- Determine whether failures come from:
  - menu reads
  - flag/var import
  - object/item persistence
  - scattered state ownership
- Define a modular, centralized fix plan.

## Executive Findings

1. Start menu behavior is C-parity correct. The disabled `POKEDEX`/`POKEMON` entries are caused by missing imported system flags, not a menu bug.
2. For the Emerald Legacy Route 114 save, data at vanilla SaveBlock1 flag/var offsets is not valid gameplay state:
   - flags read as all zero
   - vars decode as implausible/random values
3. This indicates layout mismatch versus hardcoded vanilla Emerald offsets. Current native parser is effectively vanilla-profile only.
4. Flag/var mapping is lossy: unknown IDs are dropped during import, so custom hack flags/vars cannot round-trip.
5. Save state responsibility is scattered across multiple managers, making correctness and diagnostics harder.

## Evidence

### 1) Menu gating matches pokeemerald

- `src/menu/components/StartMenu.tsx` gates entries with:
  - `FLAG_SYS_POKEDEX_GET`
  - `FLAG_SYS_POKEMON_GET`
- `public/pokeemerald/src/start_menu.c` `BuildNormalStartMenu()` uses the same flags with `FlagGet(...)`.

Conclusion: menu logic is correct. Input state is wrong.

### 2) Emerald Legacy Route 114 save parse snapshot

Direct binary inspection of active slot/sections:

- active slot: `A`
- save counter: `14`
- checksum failures: `0`
- party count: `6`
- money: `19657` (after XOR decrypt)
- flags set count (IDs `0x1..0x95F` at vanilla offset `0x1270`): `0`
- critical flags all false:
  - `FLAG_SYS_POKEMON_GET`
  - `FLAG_SYS_POKEDEX_GET`
  - `FLAG_ADVENTURE_STARTED`
  - `FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK`
  - `FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK`
- vars at vanilla offset `0x139C` are implausible:
  - `VAR_STARTER_MON = 17607` (expected 0..2)
  - `VAR_LITTLEROOT_TOWN_STATE = 63804` (expected small script-state values)

### 3) Vanilla control save parse snapshot

Using the same inspection logic on `Pokemon - Emerald Version (USA, Europe) 2.sav`:

- active slot valid, checksums clean
- flags set count: `212`
- `FLAG_SYS_POKEMON_GET = true`
- `FLAG_SYS_POKEDEX_GET = true`
- vars are plausible:
  - `VAR_STARTER_MON = 0`
  - `VAR_LITTLEROOT_INTRO_STATE = 7`
  - `VAR_BIRCH_LAB_STATE = 5`

Conclusion: parser logic works for vanilla layout but not this Emerald Legacy save layout.

### 4) World-state symptoms map directly to missing flags

- `src/game/ObjectEventManager.ts` determines object/item visibility from `gameFlags.isSet(obj.flag)`.
- If imported flags are empty, hidden-by-flag NPCs/objects become visible and item balls reappear.
- This matches observed symptoms:
  - trucks visible in Littleroot
  - mom appearing in intro-state contexts
  - already-taken items present again

### 5) Additional correctness bug in section sizing

- `src/save/native/Gen3Constants.ts` currently has `SECTION_SIZES[4] = 0xC40`.
- `public/pokeemerald/include/global.h` documents `sizeof(struct SaveBlock1) = 0x3D88`.
- SaveBlock1 split across sections 1-4 implies section 4 size should be `0xF08` (`0x3D88 - 3 * 0xF80`).

This bug is independent of the Emerald Legacy mismatch, but should be fixed for vanilla correctness.

### 6) Full `public/sample_save/` corpus audit

All files under `public/sample_save/` were audited on 2026-02-11 with a binary-sector script (slot validity, checksums, wrapper detection, vanilla offset decode sanity).

| File | Size | Classification | Parse Result | Key Finding |
|------|------|----------------|--------------|-------------|
| `public/sample_save/Pokemon - Emerald Version (USA, Europe) 2.sav` | 131,088 | Raw Gen3 save (+16 trailing bytes) | Parseable | Vanilla offsets decode correctly (flags/vars sane). |
| `public/sample_save/Pokemon - Emerald Version (USA, Europe) 1.sav` | 131,175 | `SharkPortSave` wrapped Gen3 save | Parseable (after unwrap) | Raw save starts at offset `0x5B`; vanilla offsets decode correctly after unwrapping. |
| `public/sample_save/Pokemon - Emerald Version (USA, Europe) 1.sav.ss0` | 39,188 | PNG screenshot (misleading extension) | Not a save | File header is PNG (`89 50 4E 47 ...`), not a flash save. |
| `public/sample_save/Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav` | 131,072 | Raw Gen3-like save | Partially parseable | Profile/location/party/money plausible, but vanilla flags/vars are invalid. |
| `public/sample_save/Edited Pokemon 604 - Emerald Legacy Version (USA, Europe) (patched).sav` | 131,072 | Raw Gen3-like save | Partially parseable | Same mismatch pattern as Route 114 file. |
| `public/sample_save/Save Pokemon - Emerald Legacy Version (USA, Europe) (patched).sav` | 131,072 | Raw Gen3-like save | Partially parseable | Same mismatch pattern: vanilla flags all clear, vars implausible. |

#### Vanilla Emerald samples (`1.sav`, `2.sav`)

- `1.sav` and `2.sav` both decode cleanly (after wrapper unwrap for `1.sav`):
  - `FLAG_SYS_POKEMON_GET = true`
  - `FLAG_SYS_POKEDEX_GET = true`
  - key story vars are plausible (`VAR_STARTER_MON = 0`, `VAR_LITTLEROOT_INTRO_STATE = 7`, etc.)
- Confirms current parser logic is valid for vanilla Emerald layout.

#### Emerald Legacy samples (all three)

All three Emerald Legacy saves show the same failure mode at vanilla offsets:

- critical system flags false at vanilla flag bitfield
- implausible key vars (e.g. starter var not in `0..2`)
- yet profile/map/party/money parse to believable values

This strongly indicates:

- the file is structurally save-like and checksummed correctly
- early SaveBlock1 offsets still resemble vanilla (position/party/money)
- event state region (flags/vars and potentially nearby structures) diverges from vanilla layout assumptions

#### Edited vs Route 114 sample relationship

- `Edited Pokemon 604 ... (patched).sav` differs from `Route 114` by 64 bytes total.
- All 64 differing bytes are in slot B (inactive backup slot), not slot A.
- Effective parsed active state is therefore unchanged between those two files.

#### Offset-scanning note

A sliding-window search for alternative flag/var offsets finds many high-scoring false positives (especially windows with mostly zero vars), including in vanilla saves. This confirms we should **not** attempt to infer romhack layouts heuristically from one save corpus.

Correct approach: explicit layout profiles + confidence checks + unsupported-profile handling.

## Root Causes

1. Hardcoded single-layout assumptions in parser
- `src/save/native/Gen3Constants.ts` and `src/save/native/Gen3SaveParser.ts` assume one Emerald-like SaveBlock layout.
- No profile/layout selection step exists.

2. No parse-confidence/sanity checks before applying state
- Import currently accepts decode results even when critical state is clearly invalid (e.g., party exists but all flags unset and vars nonsensical).

3. Lossy flag/var representation
- `parseFlags` and `parseVars` only keep IDs present in `FLAG_ID_TO_NAME` / `VAR_ID_TO_NAME`.
- Unknown IDs are discarded, preventing full fidelity for hacks or custom builds.

4. Scattered state ownership
- Flags: `GameFlags`
- Vars: `GameVariables`
- Inventory: `BagManager`
- Party: `SaveManager` private field + `_fullParty` escape hatch
- Runtime objects: `ObjectEventManager`
- This fragmentation makes import validation and atomic apply harder.

5. No file-format preflight classification
- `.sav` extension is not sufficient:
  - wrapped formats (e.g. SharkPort) can contain valid saves with header/padding
  - non-save artifacts can be mislabeled (e.g. `.sav.ss0` PNG screenshot)
- Import path currently assumes raw Gen3 flash-like input too early.

## Centralized Architecture Proposal

### A) Add a canonical save runtime store

Create a single `SaveStateStore` as the source of truth for:

- profile/playtime/location
- bag/pc items
- party
- flags + vars (raw and named views)
- import diagnostics and metadata

Existing managers (`GameFlags`, `GameVariables`, `BagManager`) become adapters over this store, not independent stores.

### B) Split raw data from mapped view

Represent event state as:

- raw flags bitset (all IDs)
- raw vars array (all 256 IDs)
- mapped/named convenience view
- unknown ID tracking (for diagnostics only, not data loss)

This preserves full fidelity while keeping existing string-based consumers working.

### C) Introduce layout profiles

Add `SaveLayoutProfile` registry (data-driven), e.g.:

- `emerald_vanilla`
- `ruby_sapphire_vanilla`
- `frlg_vanilla`
- `emerald_legacy_604` (if/when confirmed)

Each profile owns:

- section chunk sizes
- key offsets
- bag capacities/pocket offsets
- encryption key location and decrypt rules
- sanity constraints

### D) Profile detection + confidence scoring

Before applying imported state:

1. parse sectors/slot
2. attempt decode with candidate profiles
3. compute confidence score using sanity checks
4. select best profile above threshold
5. if none pass, import as unsupported profile with explicit warning (do not silently apply broken state)

Sanity checks should include:

- party count range
- starter var in small domain
- key story vars in plausible range
- critical system flag consistency
- money/coins bounds

Also include file envelope checks before profile scoring:

- raw flash save vs wrapped save vs unsupported/non-save
- wrapper unwrapping if recognized (`SharkPortSave` class)
- deterministic rejection for known non-save signatures (PNG, etc.)

### E) Atomic apply pipeline

Use one `applyImportedState()` transaction to update all gameplay systems in order:

1. canonical store
2. adapter managers
3. object visibility recompute
4. map reload/object parse sync

No partial writes to separate localStorage keys.

## Implementation Plan (Phased)

### Phase 0: Guardrails and observability (immediate)

- Fix `SECTION_SIZES[4]` vanilla value.
- Add parser diagnostics output:
  - chosen profile
  - confidence score
  - flag count
  - nonzero var count
  - sanity failures
- Add hard failure / warning on obviously bad decode (example: party > 0 with zero critical system flags and implausible vars).

### Phase 1: Central store extraction

- Introduce `SaveStateStore`.
- Refactor `GameFlags`, `GameVariables`, `BagManager`, party access to read/write through store.
- Remove ad hoc `_fullParty` extension field from imported `SaveData`.

### Phase 2: Raw + named event-state model

- Store raw flag bits/raw var array in save model.
- Keep named projection for current script/object APIs.
- Ensure unknown IDs are preserved across save/load/export.

### Phase 3: Layout profile system

- Implement `SaveLayoutProfile` and profile detector.
- Move offsets out of parser into profile definitions.
- Add at least vanilla Emerald + RS profiles first.

### Phase 4: Unsupported profile UX

- If no profile confidence is acceptable:
  - keep raw data for future support
  - show explicit unsupported/partial import warning
  - avoid applying obviously wrong world state silently

### Phase 5: Test matrix

Add automated fixtures for:

- vanilla Emerald sample (baseline pass)
- Emerald Legacy Route 114 sample (currently expected unsupported or partial-failure warning until profile support exists)
- regression checks:
  - start menu system flag gating
  - object visibility from flags
  - item persistence after load

## Non-goals (for now)

- Do not “paper over” bad import by enabling `POKEMON` menu from party count fallback. That masks parse failures and breaks C parity expectations.
- Do not hardcode one-off flag toggles for this save file.

## Recommended Next Action

Start with Phase 0 in a focused PR:

1. section size correction
2. parse sanity checks + diagnostics
3. import warning path for low-confidence decodes

Then proceed with Phase 1 (central store extraction), which is the key scalability step.
