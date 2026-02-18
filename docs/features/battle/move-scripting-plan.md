---
title: Battle Move Scripting Scalability Plan
status: in_progress
written_on: 2026-02-18
last_verified: 2026-02-18
---

# Battle Move Scripting Scalability Plan

## Goal

Make move mechanics scalable and debuggable by:
- fixing the Protect-family gameplay breakages,
- wiring side-condition guards used by many status/stat moves,
- and adding a coverage report so unimplemented move effects are tracked from generated C data.

## Investigation Summary

- Runtime move handlers are manually registered in `src/battle/engine/MoveEffects.ts`.
- Before this pass, Protect state was set but never checked during move execution, so attacks ignored Protect.
- Move-effect implementation coverage was partial:
  - many effect IDs exist in generated data (`src/data/battleMoves.gen.ts`),
  - only a subset had handlers in runtime,
  - there was no built-in report to prioritize missing effects.

## Workstream IDs

- [x] `MOV-001` Protect gating parity: block protect-affected incoming moves when target is protected.
- [x] `MOV-002` Protect-like architecture: shared Protect/Endure success-chain logic.
- [x] `MOV-003` Endure parity: lethal damage leaves user at 1 HP for that turn.
- [x] `MOV-004` Side-condition moves: implement Mist, Safeguard, and Spikes handlers.
- [x] `MOV-005` Side-condition enforcement: Safeguard blocks major status; Mist blocks stat drops.
- [x] `MOV-006` Side timer parity: decrement + fade messages for Safeguard/Mist.
- [x] `MOV-007` Coverage observability: export runtime move-effect coverage report from engine layer.
- [x] `MOV-008` Tooling: add CLI report script (`npm run report:battle:move-effects`).
- [x] `MOV-009` Regression tests for Protect/Endure/Safeguard/Mist/Spikes.
- [x] `MOV-010` Plan/log tracking update with implemented IDs and validations.
- [x] `MOV-011` Node ESM test/report stability: normalize battle-engine import specifiers for direct `node --test` and CLI coverage runs.
- [x] `MOV-012` Add generated move-effect index artifact (`src/data/battleMoveEffects.gen.ts`) sourced from generated move + battle-script data.
- [x] `MOV-013` Enforce move-effect generator freshness in battle data verification (`verify:generated:battle` includes battle scripts + move-effect index).

## Acceptance

- [x] Protect/Detect no longer allow protect-affected moves to deal damage through shield.
- [x] Endure prevents KO on the turn it succeeds.
- [x] Safeguard and Mist affect move outcomes as guards, not cosmetic flags.
- [x] Coverage report exposes implemented vs missing effect IDs using generated data.
- [x] Engine tests cover new behavior and pass.
- [x] Move-effect indexing/report inputs are generator-backed and not ad-hoc runtime-only joins.

## Validation Snapshot (2026-02-18 late)

- `node --test src/battle/engine/__tests__/MoveEffects.scalable.test.ts` -> pass
- `node --test src/battle/engine/__tests__/BattleParity.test.ts` -> pass
- `npm run report:battle:move-effects` -> pass
- `npm run verify:generated:battle` -> pass
- Coverage report summary:
  - implemented effects: `97 / 214`
  - referenced effects covered: `86 / 198`
  - missing referenced effects: `112`

## Follow-up Scope

- `MOV-NEXT-001`: prioritize top missing effects by trainer/wild encounter frequency from coverage report.
- `MOV-NEXT-002`: optional interpreter path for generated battle script opcodes to reduce manual handler drift.
- `MOV-NEXT-003`: CI gate for minimum referenced-effect coverage percentage.
