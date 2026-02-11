---
title: Sample Save Layout Audit (2026-02-11)
status: in_progress
last_verified: 2026-02-11
---

# Sample Save Layout Audit

- Date: 2026-02-11
- Profile set: Built-in profiles only
- Active candidates: `emerald_vanilla`, `ruby_sapphire_vanilla`, `emerald_legacy_604`

| File | Result | Selected Profile | Confidence | Sanity | Issues | Flags Set | Non-zero Vars | Party Count | Source Format | Error |
|------|--------|------------------|------------|--------|--------|-----------|---------------|-------------|---------------|-------|
| `Edited Pokemon 604 - Emerald Legacy Version (USA, Europe) (patched).sav` | supported | `emerald_legacy_604` | 100 | high | 0 | 472 | 47 | 6 | raw |  |
| `Pokemon - Emerald Version (USA, Europe) 1.sav` | supported | `emerald_vanilla` | 100 | high | 0 | 235 | 26 | 2 | sharkport |  |
| `Pokemon - Emerald Version (USA, Europe) 1.sav.ss0` | parse_error | `-` | 0 | - | 0 | 0 | 0 | 0 | - | This file appears to be a PNG image (likely a save-state screenshot), not a Gen3 .sav file. |
| `Pokemon - Emerald Version (USA, Europe) 2.sav` | supported | `emerald_vanilla` | 100 | high | 0 | 212 | 25 | 2 | raw |  |
| `Pokemon 604 - Emerald Legacy Version (USA, Europe) (Route 114).sav` | supported | `emerald_legacy_604` | 100 | high | 0 | 472 | 47 | 6 | raw |  |
| `Save Pokemon - Emerald Legacy Version (USA, Europe) (patched).sav` | supported | `emerald_legacy_604` | 100 | high | 0 | 357 | 39 | 3 | raw |  |