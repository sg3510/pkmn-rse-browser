---
title: Gen3 Save Layout Profiles
status: in_progress
last_verified: 2026-02-11
---

# Gen3 Save Layout Profiles

This document defines how we manage parser layouts (vanilla + romhack variants) in a centralized, scalable way.

## Current Profile Model

- Built-in profiles live in `src/save/native/Gen3LayoutProfiles.ts`.
- Parser profile selection is done in `src/save/native/Gen3SaveParser.ts` by scoring each candidate.
- Supported status is derived from confidence + sanity checks, not by filename heuristics.

## Built-in Profiles

- `emerald_vanilla`
- `ruby_sapphire_vanilla`
- `emerald_legacy_604` (experimental; mapped from PKHeX Emerald Legacy offsets + flag aliases)

### Emerald Legacy Notes

- Source for offset mapping: `PKHeX-EmeraldLegacy/PKHeX.Core/Saves/SAV3E.cs`
  - `EventFlag = 0x13D8`
  - `EventWork = 0x1504`
  - key bag pocket offsets: `0x740`, `0x7B8`, `0x7F8`, `0x8F8`
- The profile currently applies system-flag aliases so runtime menu gating resolves for imported Legacy saves.

## Override Workflow (Romhacks / Variants)

1. Create a JSON override file using:
   - `docs/systems/save/layout-profiles/emerald-legacy-604.overrides.example.json`
2. Fill `saveBlock1` / `saveBlock2` / `sectionSizes` values from authoritative sources (romhack C source or validated struct docs).
3. Run parser audit against all sample saves:
   - `node --experimental-strip-types scripts/audit-save-layouts.ts --profiles <override-json>`
4. Generate a markdown report if needed:
   - `node --experimental-strip-types scripts/audit-save-layouts.ts --profiles <override-json> --markdown-out docs/systems/save/layout-profiles/sample-save-audit.md`
5. Promote override into built-in profile only after validation passes on full fixture matrix.

## Guardrails

- Do not enable `layoutSupported=true` for a romhack profile until:
  - key menu flags decode correctly (`FLAG_SYS_POKEMON_GET`, `FLAG_SYS_POKEDEX_GET`)
  - object visibility flags decode correctly (truck/mom/item regressions)
  - vars sanity is stable across multiple save files
- Keep experimental profiles marked with:
  - `"source": "custom"`
  - `"supportLevel": "experimental"`
