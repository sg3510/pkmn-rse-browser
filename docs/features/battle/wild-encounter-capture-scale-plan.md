---
title: Wild Encounter + Capture Scale Plan
status: in_progress
written_on: 2026-02-18
last_verified: 2026-02-18
---

# Wild Encounter + Capture Scale Plan

## Goal

Deliver C-parity wild roaming encounters (land + surfing water) with authentic map rates/slot weighting from generated source data at scale, and ensure Poké Ball usage + catch calculation works end-to-end in roaming wild battles.

## Scope

- Overworld movement-triggered wild encounters on C encounter tiles:
  - land encounter tiles (grass/cave/indoor encounter tiles),
  - surfing water encounter tiles,
  - bridge-over-water surfing parity branch.
- Generator-first encounter data import from `public/pokeemerald/src/data/wild_encounters.json`.
- Runtime encounter probability and slot/level roll behavior aligned to `public/pokeemerald/src/wild_encounter.c`.
- Poké Ball throw/catch math parity checks aligned to `public/pokeemerald/src/battle_script_commands.c`.

## Checklist

- [x] `ENC-DOC-001` Add canonical plan and checklist IDs in this doc and cross-link in master battle plan.
- [x] `ENC-DAT-001` Add generator `scripts/generate-wild-encounters.cjs`.
- [x] `ENC-DAT-002` Generate and commit `src/data/wildEncounters.gen.ts` with typed helpers and encounter slot-rate tables.
- [x] `ENC-DAT-003` Add npm script wiring for wild encounter generator and freshness verification.
- [x] `ENC-RUN-001` Implement wild encounter service for C encounter-rate math.
- [x] `ENC-RUN-002` Implement weighted slot selection and level roll from generated data.
- [x] `ENC-RUN-003` Apply lead modifiers (Keen Eye/Intimidate, Magnet Pull/Static, Hustle/Vital Spirit/Pressure).
- [x] `ENC-RUN-004` Integrate encounter trigger into overworld step flow with proper transition guards.
- [x] `ENC-RUN-005` Start `WildBattleStartRequest` with return location/runtime state so battle exits cleanly back to overworld.
- [x] `ENC-RUN-006` Implement water/bridge/cave tile routing parity (`MetatileBehavior_IsLandWildEncounter` / `IsWaterWildEncounter`).
- [ ] `CAP-001` Verify and harden Poké Ball item usage path in roaming wild battles.
- [ ] `CAP-002` Verify and harden catch odds/shake/messaging parity for roaming wild battles.
- [x] `ENC-TST-001` Add deterministic tests for encounter slot/rate selection behavior.
- [ ] `ENC-TST-002` Add deterministic tests for catch flow invariants in wild battle state path.
- [ ] `ENC-ACC-001` Route 101/102 grass + water encounters produce correct species distribution bias over sample runs.
- [ ] `ENC-ACC-002` Wild roaming battle allows Poké Ball usage and correctly resolves caught/fail outcomes.
- [ ] `ENC-ACC-003` Generator freshness verification fails when generated encounter data is stale.

## Acceptance Runbook

- `node scripts/generate-wild-encounters.cjs`
- `npm run verify:generated:battle`
- `node --test src/game/encounters/__tests__/wildEncounterService.test.ts`
- `node --test src/states/__tests__/BattleState.wildCapture.test.ts` (if present; otherwise equivalent capture test target)
- `npm run build`
