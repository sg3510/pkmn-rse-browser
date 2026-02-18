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
- [x] `G2` Work tracking uses checklist IDs in this plan + a dedicated battle progress log at `docs/backlog/battle/2026-02-18-battle-recovery.md` (not `docs/backlog/021726_devon.log`).

## Progress Tracking Contract

- This file is the canonical checklist for `M*`, `BTL-*`, `BTL-DAT-*`, and `ACC-*`.
- Daily execution notes must be appended to `docs/backlog/battle/2026-02-18-battle-recovery.md`.
- Every log update must reference the exact checklist IDs touched that session.

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

- [x] `M0` Docs and tracking baseline
- [x] `M1` Data ingestion parity (typed battle start + generated roster/moves)
- [x] `M2` Sprite pipeline fixes (`BTL-014` + corrupted sprite diagnostics)
- [x] `M3` UI/layout/font parity
- [x] `M4` Trainer presentation parity
- [x] `M5` Turn flow + responsiveness parity
- [x] `M6` Faint/switch/party flow parity
- [x] `M7` EXP + battle completion loop parity
- [ ] `M8` Regression net (automated + manual)
- [x] `M9` C UI/flow parity pass 3 (battle textbox/window pages, switch/send-out timing, intro pacing)

## Work Items

- [x] `BTL-001` Dialog position incorrect.
- [x] `BTL-002` Battle responsiveness issues.
- [x] `BTL-003` Missing trainer sprite entrance.
- [x] `BTL-004` Missing trainer battle ball count.
- [x] `BTL-005` Enemy move pool incorrect/hardcoded.
- [x] `BTL-006` Non-Emerald font usage in battle.
- [x] `BTL-007` Trainer run attempt consumes turn.
- [x] `BTL-008` Fainted replacement picks invalid Pokemon.
- [x] `BTL-009` Trainer opponent sprite Y-position too low.
- [x] `BTL-010` Last used move is not preselected.
- [x] `BTL-011` HP/EXP alignment issues.
- [x] `BTL-012` EXP bar rendering/rollover issues.
- [x] `BTL-013` Corrupted sprites at bottom of screen.
- [x] `BTL-014` Black flashing front sprites from malformed stacked `front.png`.
- [x] `BTL-025` Elite Four auto-win regression: `trainerbattle_no_intro` must not pre-skip when trainer flag is set.
- [x] `BTL-DAT-001` Replace lead-only trainer resolver with full generated roster resolver.
- [x] `BTL-DAT-002` Resolve trainer mon moves from generated custom moves or generated level-up learnsets.
- [x] `BTL-DAT-003` Enforce battle generator freshness checks.

## Pass 3 Scope (2026-02-18 Night)

- [x] `BTL-015` Battle textbox uses tilemap-driven C textbox layers (no black fill/stretch artifacts).
- [x] `BTL-016` Action/move menu borders use C window page layout and tilemap background pages.
- [x] `BTL-017` Trainer intro pacing aligned closer to C slide timing (no blink-in/blink-out).
- [x] `BTL-018` Battle message print speed follows save text-speed option (`slow`/`mid`/`fast`).
- [x] `BTL-019` Trainer next-Pokemon send-out occurs after prior message/EXP flow, not before.
- [x] `BTL-020` Healthbox name anchors adjusted to C-like placement.
- [x] `BTL-021` Player/enemy switch includes visible send-out transition animation.
- [x] `BTL-022` Front/back sprite animation loops only during send-out windows (no constant flapping).
- [x] `BTL-023` Runtime species/form sprite swaps resolve deterministically (no transform-like accidental swaps).
- [x] `BTL-024` Battle UI window placement constants centralized for page-relative offsets.

## Pass 3 Acceptance

- [ ] `ACC-006` Message textbox and action/move windows render with non-corrupted borders and no black body fill.
- [ ] `ACC-007` Trainer battle sequence: faint -> EXP text -> trainer send-out -> new mon appears in-order.
- [ ] `ACC-008` Switch action visibly animates recall/send-out and settles to stable idle frame.

## Acceptance Scenarios

- [ ] `ACC-001` Wild scripted battle (starter vs Poochyena) passes end-to-end.
- [ ] `ACC-002` Trainer battle passes intro/run-denial/switch/faint/victory-exit flow.
- [x] `ACC-003` Trainer data and moves resolve correctly from generated data for sampled trainers.
- [ ] `ACC-004` Visual regression checks pass for sprite flicker/corruption/layout.
- [x] `ACC-005` Generator freshness check command exists and passes on clean generated outputs.

## Latest Implementation Snapshot (2026-02-18)

- Replaced lead-only trainer flow with generated full-party resolver in battle entry.
- Added numeric trainer-id resolution path for script-driven battles (fixes constant/id mismatch cases).
- Removed shared dialog-bridge dependence from battle phase rendering; battle text now renders in battle textbox.
- Added trainer intro presentation flow (opponent trainer front sprite load + slide-in/hold/slide-out).
- Added/updated trainer party ball indicators and trainer sprite Y/layout anchors.
- Fixed trainer run denial so it does not consume a turn.
- Implemented last-used move preselection in move menu.
- Implemented forced replacement flow for player and enemy faint cases; never re-send fainted mons.
- Updated HP/EXP bar widths to C constants (`48` HP / `64` EXP), with EXP rollover animation behavior.
- Added front-sprite malformed-sheet guard (black-flicker fix) and battle-scene overlay clipping to prevent lower-screen sprite artifacts.
- Added battle-font preload path to ensure `"Pokemon Emerald"` is active before UI text draw.
- Fixed `trainerbattle_no_intro` parity to always run battle setup (no pre-check on trainer flags), preventing Elite Four auto-skip after challenge-reset flows.
- Implemented C-parity wild capture flow (ball multipliers, status bonuses, shake outcomes, bag consumption, caught outcome).
- Added catch persistence hooks (party insert when space exists + Pokédex seen/caught updates).
- Moved EXP awarding to enemy-faint timing and added trainer/Lucky Egg multipliers per C ordering.
- Applied trainer IV scalar parity (`iv * 31 / 255`) for trainer mon materialization.

## Validation Runbook (Current)

- `node --test src/pages/gamePage/__tests__/trainerFallback.test.ts` -> pass
- `npm run verify:generated:battle` -> pass
- `npm run validate:battle-sprites` -> pass
- `npm run build` -> pass

## Remaining Validation Gaps (M8)

- Runtime/manual scripted checks for `ACC-001`, `ACC-002`, `ACC-004` are still required.
- `node --test src/battle/engine/__tests__/BattleParity.test.ts` is blocked in direct Node ESM mode by extensionless imports in shared runtime modules; this is a test-harness/import-resolution issue, not a battle logic failure in build output.

## Post-M8 Scope (Researched)

- `NS-001` Deterministic simulation protocol logs:
  Add a machine-readable turn protocol and golden replay fixtures (inspired by `pkmn/engine` SIM protocol design) to catch regressions earlier than visual QA.
- `NS-002` External cross-engine differential checks:
  Add sampled battle vectors that run through local engine and a reference simulator path (Showdown-compatible where possible) to detect mechanics drift.
- `NS-003` Comprehensive mechanics expansion:
  Extend coverage from current single-battle slice into status edge-cases, weather/ability/item interactions, and trainer AI script parity.
- `NS-004` Replay + debug tooling:
  Persist battle turn logs with deterministic seeds for one-click repro of user-reported battle bugs.
- `NS-005` Import-at-scale guardrails:
  Promote `verify:generated:battle` into CI-required gate and add stale-generated-file failure checks in PR validation.

### External References

- `smogon/pokemon-showdown`: simulator protocol contract and request/message framing (`sim/SIM-PROTOCOL.md`).
- `pkmn/engine`: update/choices/result protocol model and deterministic log-first debugging (`docs/PROTOCOL.md`).
- `ericmaddox/pokemon-battle`: lightweight feature checklist for UX-oriented mechanics smoke cases (status/weather/priority/animations).

## Implementation Notes

- Keep battle APIs backward compatible while migration is in progress.
- Prefer additive typed payloads first, then remove legacy fallback paths once covered.
- Any C-parity exception should include a short source reference comment in code.
