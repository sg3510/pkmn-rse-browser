---
title: Battle Recovery Plan (Doc-First + Generator-First)
status: in_progress
written_on: 2026-02-18
last_verified: 2026-02-19
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
- [x] `BTL-026` Overworld trainer "meet-eyes" LOS trigger runs before free movement input (C call-order parity).
- [x] `BTL-027` Trainer LOS trigger uses C-style active object-event scope (spawned trainer objects around camera), avoiding far offscreen pull-in without truncating valid trainer sight range.
- [ ] `BTL-028` Full C trainer approach task/script parity (`EventScript_StartTrainerApproach` + `DoTrainerApproach` task chain, including double-approach edge cases).
- [x] `BTL-029` Trainer LOS must trigger only after player completes a step into sight line, then run `!` + trainer walk-up before battle script start.
- [x] `BTL-030` Trainer pre-battle speech reliability: ensure trainerbattle intro path always attempts intro text and falls back to deterministic generic trainer line if intro label is missing.
- [x] `BTL-031` Trainer LOS step probing uses destination tile while moving (C `PlayerGetDestCoords` parity) so fast running cannot skip sight trigger checks.
- [x] `BTL-032` Turn-script timing parity: defer HP/EXP UI updates to battle event/message timing slots instead of applying full turn-state immediately.
- [x] `BTL-DAT-001` Replace lead-only trainer resolver with full generated roster resolver.
- [x] `BTL-DAT-002` Resolve trainer mon moves from generated custom moves or generated level-up learnsets.
- [x] `BTL-DAT-003` Enforce battle generator freshness checks.
- [x] `BTL-DAT-004` Run battle data structure imports from a single manifest-driven mass-generator command.

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

## Move Scripting Track (2026-02-18)

- [x] `MOV-001` Protect gating parity in move resolution.
- [x] `MOV-002` Shared Protect/Endure success-chain implementation.
- [x] `MOV-003` Endure lethal-hit survival parity.
- [x] `MOV-004` Mist/Safeguard/Spikes move handlers.
- [x] `MOV-005` Mist/Safeguard guard enforcement for stat/status moves.
- [x] `MOV-006` Side-condition timer tick/wear-off messaging (Mist/Safeguard).
- [x] `MOV-007` Runtime move-effect coverage report export.
- [x] `MOV-008` CLI coverage tooling (`npm run report:battle:move-effects`).
- [x] `MOV-009` Regression tests for protect-family and side-condition behavior.
- [x] `MOV-010` Dedicated move-scripting plan doc: `docs/features/battle/move-scripting-plan.md`.
- [x] `MOV-011` Node ESM stability for battle engine tests/report tooling (`.ts` import normalization + deterministic flaky test fix).
- [x] `MOV-012` Generated move-effect index import path (`scripts/generate-battle-move-effects.cjs` -> `src/data/battleMoveEffects.gen.ts`).
- [x] `MOV-013` Battle generator verification includes move scripting artifacts (`battleScripts.gen.ts`, `battleMoveEffects.gen.ts`).

## Wild Encounter + Capture Scale Track (2026-02-18)

- [x] `ENC-DOC-001` Canonical plan/checklist for this slice: `docs/features/battle/wild-encounter-capture-scale-plan.md`.
- [x] `ENC-DAT-001` Generator: `scripts/generate-wild-encounters.cjs`.
- [x] `ENC-DAT-002` Generated map encounter dataset: `src/data/wildEncounters.gen.ts`.
- [x] `ENC-DAT-003` Script/verification wiring for encounter generated freshness.
- [x] `ENC-RUN-001` C-rate wild encounter checks in overworld traversal.
- [x] `ENC-RUN-002` Generated weighted slot + level roll resolution.
- [x] `ENC-RUN-003` Lead-modifier support (Keen Eye/Intimidate, Magnet Pull/Static, Hustle/Vital Spirit/Pressure).
- [x] `ENC-RUN-004` Overworld step integration and guarded `GameState.BATTLE` transition.
- [x] `ENC-RUN-005` Return-location/runtime-state safe wild battle start payload.
- [x] `ENC-RUN-006` C tile routing parity for land/water/bridge encounter checks.
- [ ] `CAP-001` Poké Ball usage path validated for roaming wild battles.
- [ ] `CAP-002` Catch odds/shake/message parity validated for roaming wild battles.
- [x] `ENC-TST-001` Encounter service deterministic tests.
- [ ] `ENC-TST-002` Capture path deterministic tests.
- [ ] `ENC-ACC-001` Grass encounter species distribution aligns with generated slot weights over sample runs.
- [ ] `ENC-ACC-002` Roaming wild battle supports Poké Ball capture outcome end-to-end.
- [ ] `ENC-ACC-003` Generated encounter freshness check enforced.

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
- Added modular trainer LOS detection (`src/game/trainers/trainerSightEncounter.ts`) and integrated pre-input "meet-eyes" trigger ordering before ON_FRAME script evaluation.
- Aligned trainer LOS candidate scope to C active object-event behavior (spawn/despawn window around camera) instead of strict on-screen-only filtering, preventing shortened sight-range regressions.
- Added modular trainer sight intro runner (`src/game/trainers/playTrainerSightIntro.ts`) for deterministic `!` icon wait + approach walk + facing before trainer script launch.
- Changed trainer LOS activation timing to settled-tile step transitions only (no immediate stationary trigger on map load / pre-step trigger), and guarded cutscene sequencing with an in-flight lock.
- Updated trainer LOS probe coordinates to movement destination tiles while running, matching C destination-coordinate checks and preventing missed meet-eyes triggers at high movement speed.
- Hardened trainerbattle intro messaging: all trainerbattle intro variants now route through a shared intro presenter with missing-label diagnostics and deterministic fallback text.
- Normalized battle-engine import specifiers for direct Node ESM test/report execution and hardened flaky run-attempt parity test RNG sequencing.
- Added generated move-effect index artifact and switched move-coverage reporting to consume generated index data.
- Extended `verify:generated:battle` to enforce battle script + move-effect generated freshness.
- Added canonical battle generator manifest + mass-import runner:
  `scripts/battle-data-manifest.cjs` + `scripts/generate-battle-data.cjs`,
  and rewired `verify:generated:battle` to consume that same manifest (no script/output drift).
- Implemented C-parity wild capture flow (ball multipliers, status bonuses, shake outcomes, bag consumption, caught outcome).
- Added catch persistence hooks (party insert when space exists + Pokédex seen/caught updates).
- Expanded roaming wild encounter parity from grass-only to C tile-based land/water routing:
  cave/indoor encounter tiles, surfing water encounter tiles, and bridge-over-water surfing checks.
- Moved EXP awarding to enemy-faint timing and added trainer/Lucky Egg multipliers per C ordering.
- Added C-parity Exp Share distribution for enemy-faint EXP (50/50 split between sent-in and Exp Share sides, per-recipient stacking for sent-in + Exp Share holders, and level-100 recipient skip semantics).
- Applied trainer IV scalar parity (`iv * 31 / 255`) for trainer mon materialization.
- Added battle turn timeline staging so HP deltas, faint HP-zero targets, move/stat UI markers, and EXP grants are applied when their event/message step becomes active (closer to C script command timing like `healthbar_update` / `getexp` sequencing).

## Validation Runbook (Current)

- `node --test src/pages/gamePage/__tests__/trainerFallback.test.ts` -> pass
- `npm run verify:generated:battle` -> pass
- `npm run validate:battle-sprites` -> pass
- `node --test src/battle/engine/__tests__/MoveEffects.scalable.test.ts` -> pass
- `node --test src/battle/engine/__tests__/BattleParity.test.ts` -> pass
- `npm run report:battle:move-effects` -> pass
- `npm run generate:battle-move-effects` -> pass
- `npm run build` -> pass

## Remaining Validation Gaps (M8)

- Runtime/manual scripted checks for `ACC-001`, `ACC-002`, `ACC-004` are still required.

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
