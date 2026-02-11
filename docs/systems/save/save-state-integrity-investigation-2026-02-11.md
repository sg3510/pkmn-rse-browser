---
title: Save State Integrity Investigation (Emerald Legacy Route 114 Import)
status: in_progress
last_verified: 2026-02-11
implementation_updated: 2026-02-11
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
3. This indicates layout mismatch versus vanilla Emerald offsets. A dedicated `emerald_legacy_604` profile is now implemented (based on PKHeX Emerald Legacy offsets), with profile-specific system-flag aliases for menu gating.
4. Flag/var mapping was lossy at investigation start; Phase 2 now preserves unknown IDs via raw event-state payloads.
5. Save state responsibility is scattered across multiple managers, making correctness and diagnostics harder.

## Implementation Status (2026-02-11)

- [x] Phase 0: Guardrails and observability
- [x] Phase 0.1: section size fix (`SECTION_SIZES[4] = 0xF08`)
- [x] Phase 0.2: input preflight/normalization (raw vs wrapped vs PNG reject)
- [x] Phase 0.3: parse sanity diagnostics and low-confidence import rejection
- [x] Phase 1: central runtime `SaveStateStore` introduced
- [x] Phase 1.1: `GameFlags`, `GameVariables`, `BagManager`, and party access in `SaveManager` routed through store
- [x] Phase 1.2: replaced ad-hoc `_fullParty` import payload with typed `partyFull` (legacy `_fullParty` still accepted on load)
- [x] Phase 2: raw + named event-state model implemented
- [x] Phase 2.1: parser reads/stores `rawFlags` (300-byte bitfield) + `rawVars` (256-entry u16 array)
- [x] Phase 2.2: named `flags`/`vars` are explicit projections from raw data
- [x] Phase 2.3: save/load JSON round-trip preserves unknown/unmapped flag/var IDs through raw arrays
- [x] Phase 3: layout profile system (vanilla profiles + detector)
- [x] Phase 3.1: `SaveLayoutProfile` registry added (`emerald_vanilla`, `ruby_sapphire_vanilla`)
- [x] Phase 3.2: parser now scores candidates and selects best profile with confidence metadata
- [x] Phase 4: unsupported profile UX path
- [x] Phase 4.1: parser marks unsupported/low-confidence layout explicitly (`layoutSupported=false`)
- [x] Phase 4.2: import now aborts with explicit profile/confidence/candidate score context
- [x] Phase 5: automated fixture/regression matrix (full)
- [x] Phase 5.1: native parser fixture tests added for vanilla, wrapped, legacy-unsupported, and PNG-reject paths
- [x] Phase 5.2: menu/object/item runtime regression tests from loaded saves
- [x] Phase 6: profile override + corpus audit tooling
- [x] Phase 6.1: parser now accepts injected profile sets + configurable support threshold/sanity gate
- [x] Phase 6.2: centralized profile builders added (`buildSaveLayoutProfile`, `buildSaveLayoutProfiles`, `mergeSaveLayoutProfiles`)
- [x] Phase 6.3: sample-save audit script added (`scripts/audit-save-layouts.ts`) with optional markdown output
- [x] Phase 6.4: override workflow docs/templates added in `docs/systems/save/layout-profiles*`
- [x] Phase 7: Emerald Legacy profile onboarding (initial implementation)
- [x] Phase 7.1: extracted Legacy layout offsets from PKHeX Emerald Legacy (`SAV3E.cs`)
- [x] Phase 7.2: promoted `emerald_legacy_604` profile into built-ins + parser/runtime fixtures
- [x] Phase 7.3: Legacy imports now parse as supported with profile-specific system-flag aliases
- [ ] Phase 7.4: verify/replace alias IDs against authoritative romhack `flags.h` from the exact 6.0.4 source used to generate these saves

Test command for implemented fixture coverage:
- `node --test --experimental-strip-types src/save/native/__tests__/*.test.ts`
- `npm run save:audit-layouts` (profile corpus audit)
- Latest audit artifact: `docs/systems/save/layout-profiles/sample-save-audit-2026-02-11.md`
- Runtime regression additions are in `src/save/native/__tests__/SaveRuntimeRegression.test.ts` and assert:
  - start-menu `FLAG_SYS_POKEMON_GET`/`FLAG_SYS_POKEDEX_GET` gating from imported vanilla saves
  - Littleroot truck/mom visibility from imported flags
  - Route 102 item-ball collected-state persistence from imported item flags
  - Emerald Legacy Route 114 import enables start-menu system flags and hides Littleroot trucks

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

1. Hardcoded single-layout assumptions in parser `[resolved in Phase 3]`
- Parser now selects from explicit layout profiles (`emerald_vanilla`, `ruby_sapphire_vanilla`) using candidate scoring and confidence.

2. No parse-confidence/sanity checks before applying state `[resolved in Phase 0/4]`
- Parser now computes sanity + confidence; import rejects unsupported/low-confidence layouts instead of silently applying bad state.

3. Lossy flag/var representation `[resolved in Phase 2]`
- Raw event-state arrays are now preserved (`rawFlags`, `rawVars`) and named views are projections.

4. Scattered state ownership `[partially resolved in Phase 1]`
- Flags: `GameFlags`
- Vars: `GameVariables`
- Inventory: `BagManager`
- Party: now centralized via `SaveStateStore` (legacy `_fullParty` still read on load for compatibility)
- Runtime objects: `ObjectEventManager`
- This fragmentation makes import validation and atomic apply harder.

5. No file-format preflight classification `[resolved in Phase 0]`
- `.sav` extension is no longer trusted alone:
  - wrapped formats (e.g. SharkPort) are unwrapped before parsing
  - non-save artifacts (e.g. `.sav.ss0` PNG screenshot) are rejected deterministically

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
- Emerald Legacy Route 114 sample (expected supported via `emerald_legacy_604`)
- regression checks:
  - start menu system flag gating
  - object visibility from flags
  - item persistence after load

### Phase 6: Profile override + audit tooling

- Add parser option to evaluate an injected profile list (without modifying built-ins).
- Add a deterministic script to audit all files in `public/sample_save/` and compare selected profile/confidence/sanity.
- Add JSON override template + docs so romhack layout offsets can be validated before promotion to built-in support.

### Phase 7: Emerald Legacy support

- Pull authoritative SaveBlock/section offsets from Emerald Legacy source. `[done via PKHeX Emerald Legacy offsets]`
- Encode those constants in a dedicated built-in profile (`emerald_legacy_604`). `[done]`
- Promote Legacy fixtures from unsupported to supported and verify: `[done]`
  - menu flags
  - object visibility
  - collected item persistence

## Non-goals (for now)

- Do not “paper over” bad import by enabling `POKEMON` menu from party count fallback. That masks parse failures and breaks C parity expectations.
- Do not hardcode one-off flag toggles for this save file.

## Recommended Next Action

Next action:

1. Cross-check Legacy alias IDs (`FLAG_SYS_POKEMON_GET`, `FLAG_SYS_POKEDEX_GET`, `FLAG_SYS_POKENAV_GET`) against the exact Emerald Legacy 6.0.4 `flags.h`/`start_menu.c` used by these saves.
2. Re-run `npm run save:audit-layouts` and verify no regression for vanilla Emerald/RS profiles.
3. Keep unsupported-profile guardrails enabled for unknown romhacks/layouts.
