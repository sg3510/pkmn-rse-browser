---
title: Battle Recovery Plan (Doc-First + Generator-First)
status: in_progress
written_on: 2026-02-18
last_verified: 2026-02-18
---

# Battle Recovery Plan (Doc-First + Generator-First)

## Goal

Deliver an end-to-end Emerald-parity battle loop with `public/pokeemerald/` as source of truth while removing current battle bugs and eliminating hand-maintained battle data drift.

## Hard Gates

- [x] `G0` Canonical plan lives in this file.
- [x] `G1` Generator-first policy is defined and enforced for battle data.
- [x] `G2` Work tracking uses checklist IDs in this plan + a dedicated battle progress log at `docs/backlog/battle/2026-02-18-battle-recovery.log`.

## Generator-First Policy

Battle data must be generated from C-source-derived scripts, not manually patched in battle logic.

Required generated sources:

- `scripts/generate-trainer-ids.cjs` -> `src/data/trainerIds.gen.ts`
- `scripts/generate-trainer-parties.cjs` -> `src/data/trainerParties.gen.ts`
- `scripts/generate-learnsets.cjs` -> `src/data/learnsets.gen.ts`
- `scripts/generate-battle-moves.cjs` -> `src/data/battleMoves.gen.ts`

Runtime rule:

- Trainer roster, party mon moves, and move metadata must resolve from generated files.
- Hardcoded trainer fallback data is only allowed for explicit C-parity special cases and must be documented.

CI/verification rule:

- Battle generator outputs must be verifiable as up-to-date via a dedicated verification command.

## Milestones

- [ ] `M0` Docs and tracking baseline
- [ ] `M1` Data ingestion parity (typed battle start + generated roster/moves)
- [ ] `M2` Sprite pipeline fixes (`BTL-014` + corrupted sprite diagnostics)
- [ ] `M3` UI/layout/font parity
- [ ] `M4` Trainer presentation parity
- [ ] `M5` Turn flow + responsiveness parity
- [ ] `M6` Faint/switch/party flow parity
- [ ] `M7` EXP + battle completion loop parity
- [ ] `M8` Regression net (automated + manual)

## Work Items

- [ ] `BTL-001` Dialog position incorrect.
- [ ] `BTL-002` Battle responsiveness issues.
- [ ] `BTL-003` Missing trainer sprite entrance.
- [ ] `BTL-004` Missing trainer battle ball count.
- [ ] `BTL-005` Enemy move pool incorrect/hardcoded.
- [ ] `BTL-006` Non-Emerald font usage in battle.
- [ ] `BTL-007` Trainer run attempt consumes turn.
- [ ] `BTL-008` Fainted replacement picks invalid Pokemon.
- [ ] `BTL-009` Trainer opponent sprite Y-position too low.
- [ ] `BTL-010` Last used move is not preselected.
- [ ] `BTL-011` HP/EXP alignment issues.
- [ ] `BTL-012` EXP bar rendering/rollover issues.
- [ ] `BTL-013` Corrupted sprites at bottom of screen.
- [ ] `BTL-014` Black flashing front sprites from malformed stacked `front.png`.
- [ ] `BTL-DAT-001` Replace lead-only trainer resolver with full generated roster resolver.
- [ ] `BTL-DAT-002` Resolve trainer mon moves from generated custom moves or generated level-up learnsets.
- [ ] `BTL-DAT-003` Enforce battle generator freshness checks.

## Acceptance Scenarios

- [ ] `ACC-001` Wild scripted battle (starter vs Poochyena) passes end-to-end.
- [ ] `ACC-002` Trainer battle passes intro/run-denial/switch/faint/victory-exit flow.
- [ ] `ACC-003` Trainer data and moves resolve correctly from generated data for sampled trainers.
- [ ] `ACC-004` Visual regression checks pass for sprite flicker/corruption/layout.
- [ ] `ACC-005` Generator freshness check fails when generated outputs are stale.

## Implementation Notes

- Keep battle APIs backward compatible while migration is in progress.
- Prefer additive typed payloads first, then remove legacy fallback paths once covered.
- Any C-parity exception should include a short source reference comment in code.
