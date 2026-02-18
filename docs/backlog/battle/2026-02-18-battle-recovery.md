# Battle Recovery Progress Log
# Date: 2026-02-18
# Tracker: docs/features/battle/plan.md

## Session Start

- Established canonical tracker: `docs/features/battle/plan.md`.
- Confirmed generator-first policy and required generator inputs/outputs.
- Repointed `G2` logging to this battle-specific log (not `021726_devon.log`).

## In Progress Checklist

- `M0`: complete
- `M1`: complete
- `M2`: started (front-sprite black flash fixed; corrupted-bottom-sprites still open)

## Daily Checklist Snapshot (G2)

- [x] `M0`
- [x] `M1`
- [ ] `M2`
- [ ] `M3`
- [ ] `M4`
- [ ] `M5`
- [ ] `M6`
- [ ] `M7`
- [ ] `M8`
- [x] `BTL-004`
- [x] `BTL-007`
- [x] `BTL-010`
- [x] `BTL-014`
- [x] `BTL-DAT-001`
- [x] `BTL-DAT-002`
- [x] `BTL-DAT-003`

## Task Notes

- `BTL-DAT-001`: replacing lead-only trainer fallback with generated full roster payload.
- `BTL-DAT-002`: wiring trainer move resolution to generated trainer custom moves + learnset fallback.
- `BTL-DAT-003`: adding battle generator orchestration + generated-output freshness verification.
- `BTL-014`: patching battle front sprite loading to avoid malformed stacked `front.png` animation frames.
- `BTL-007`: adjusting trainer run behavior so denial does not consume turn.
- `BTL-010`: preserving last selected move slot in move menu.
- `BTL-004`: rendering trainer party ball indicators.

## Validation Plan

- Run targeted unit tests around trainer resolver and battle engine behavior.
- Run sprite validation and generated-data verification commands.
- Smoke test first battle + at least one trainer battle in runtime.

## Validation Results

- `node --test src/pages/gamePage/__tests__/trainerFallback.test.ts`: PASS
- `npm run verify:generated:battle`: PASS
- `npm run validate:battle-sprites`: PASS
- `npm run build`: PASS (existing Vite warning about mixed JSON import attributes; non-blocking for this change)
- `node --test src/battle/engine/__tests__/BattleParity.test.ts`: BLOCKED by existing ESM import-resolution issue in test environment (`src/pokemon/testFactory.ts` importing `src/data/species` without extension for this invocation mode)

## Next Slice

- Continue `M2` with `BTL-013` corrupted sprite diagnostics at battle bottom edge.
- Move to `M3`/`M4` parity items (dialog placement, trainer intro sprite sequence, Emerald font fine-tuning, trainer sprite Y).

## 2026-02-18 Update (G2 Enforcement)

- Confirmed `G2` tracking is maintained in this battle log and `docs/features/battle/plan.md`.
- Explicitly not using `docs/backlog/021726_devon.log` for battle plan tracking.

## 2026-02-18 Nightly Completion Update

### Completed IDs in this slice

- `BTL-001`, `BTL-002`: battle messages rendered in battle textbox path (no shared dialog bridge), improving placement and responsiveness.
- `BTL-003`, `BTL-009`: opponent trainer intro sprite flow added and opponent sprite vertical placement corrected.
- `BTL-005`: enemy move selection now sourced from generated trainer party custom moves or generated learnset-at-level fallback.
- `BTL-006`: explicit battle font preload added for `"Pokemon Emerald"` before battle UI draw.
- `BTL-008`: forced replacement flow implemented; no invalid/fainted replacement selection.
- `BTL-011`, `BTL-012`: HP/EXP bar dimensions aligned to C constants (`48` HP / `64` EXP) and EXP rollover display behavior fixed.
- `BTL-013`, `BTL-014`: malformed front-sheet black flicker guarded; lower-screen artifact mitigation added via battle-scene overlay clipping.

### Validation (latest)

- `node --test src/pages/gamePage/__tests__/trainerFallback.test.ts`: PASS
- `npm run verify:generated:battle`: PASS
- `npm run validate:battle-sprites`: PASS
- `npm run build`: PASS

### Open validation gaps (`M8`)

- `ACC-001`, `ACC-002`, `ACC-004` still need runtime/manual smoke passes.
- `node --test src/battle/engine/__tests__/BattleParity.test.ts` remains blocked in direct Node test mode by extensionless ESM import resolution in shared runtime modules.

### Post-plan scope to queue after `M8`

- `NS-001`: deterministic simulation protocol + golden turn logs (pkmn-engine style).
- `NS-002`: cross-engine differential checks against external sim behavior.
- `NS-003`: deeper mechanics parity expansion (status/weather/item/ability/AI edge cases).
- `NS-004`: replay + seed-based repro tooling for bug reports.
- `NS-005`: CI hard gate for generated battle data freshness.

## 2026-02-18 Late-Night C Parity Pass 2 (Top-10 Implemented)

### Checklist IDs completed

- `CP2-001`, `CP2-002`, `CP2-003`, `CP2-004`, `CP2-005`, `CP2-006`, `CP2-007`, `CP2-008`, `CP2-009`, `CP2-010`.

### What shipped

- Replaced battle Poké Ball placeholder with full C-parity capture flow:
  - ball multipliers (Ultra/Great/Poké/Net/Dive/Nest/Repeat/Timer/Master),
  - status catch bonuses,
  - shake resolution and break-free message mapping.
- Added battle bag no-item guard + proper Poké Ball consumption path.
- Implemented successful catch outcome path:
  - sets `B_OUTCOME_CAUGHT`,
  - persists caught mon to party when space exists,
  - updates Pokédex seen/caught via `SaveManager` helpers.
- Moved EXP grant timing to enemy-faint events (instead of final victory only) and added:
  - trainer-battle EXP bonus,
  - Lucky Egg EXP bonus.
- Applied trainer IV scalar parity (`iv * 31 / 255`) when materializing trainer mons.
- Added testable C-parity helper module + dedicated tests.

### Validation

- `node --test src/battle/mechanics/__tests__/cParityBattle.test.ts`: PASS
- `node --test src/pages/gamePage/__tests__/trainerFallback.test.ts`: PASS
- `npm run verify:generated:battle`: PASS
- `npm run validate:battle-sprites`: PASS
- `npm run build`: PASS (existing Vite mixed JSON-attribute warning remains non-blocking)

### Additional Scope queued after this pass

- `CP2-NEXT-001` EXP Share split/distribution parity.
- `CP2-NEXT-002` traded-mon EXP boost + message parity.
- `CP2-NEXT-003` Safari/Wally ball-throw branch parity.
- `CP2-NEXT-004` party-full caught-mon PC routing/message parity.
- `CP2-NEXT-005` nickname + Dex-page catch UX parity.
- `CP2-NEXT-006` Repeat Ball national/local dex semantics when national split lands.
- `CP2-NEXT-007` Timer Ball turn-counter timing audit.

## 2026-02-18 Night Pass 3 Start (UI/Flow Fidelity)

### Planned IDs for this pass

- `BTL-015`, `BTL-016`, `BTL-017`, `BTL-018`, `BTL-019`,
  `BTL-020`, `BTL-021`, `BTL-022`, `BTL-023`, `BTL-024`.

### Planned acceptance checks

- `ACC-006`, `ACC-007`, `ACC-008`.

### Notes

- This pass focuses on C-style battle textbox/window page rendering, intro/switch pacing, and message ordering parity.
- Implementation follows the canonical tracker in `docs/features/battle/plan.md`.

## 2026-02-18 Night Pass 3 Completion

### Completed IDs

- `M9`
- `BTL-015`, `BTL-016`, `BTL-017`, `BTL-018`, `BTL-019`
- `BTL-020`, `BTL-021`, `BTL-022`, `BTL-023`, `BTL-024`

### Shipped changes

- Replaced stretched textbox rendering with tilemap-page rendering using:
  `graphics/battle_interface/textbox.png` + `textbox_map.bin` + `textbox_0.pal` + `textbox_1.pal`.
- Added shared UI page/window anchors in `BattleLayout` and moved battle UI rendering onto those constants.
- Reworked action/move menu rendering to use C-style BG0 pages instead of ad-hoc flat rectangles.
- Added save-option-driven battle message print pacing (`slow/mid/fast` -> C delay frame mapping).
- Delayed trainer replacement send-out until after existing faint/EXP messages complete.
- Added send-out transition visuals for player/enemy switch and constrained sprite frame animation to intro/switch windows.
- Added deterministic species-swap sprite reload guard in battle state sync path.
- Nudged healthbox name placement to match C spacing better.

### Validation

- `npm run verify:generated:battle`: PASS
- `node --test src/battle/mechanics/__tests__/cParityBattle.test.ts`: PASS
- `npm run build`: PASS (existing Vite JSON import-attributes warning remains non-blocking)

### Remaining manual/runtime checks

- `ACC-006`, `ACC-007`, `ACC-008` still require in-game visual smoke validation against live battle flows.

## 2026-02-18 Elite Four Auto-Win Fix

### Completed IDs

- `BTL-025`

### Shipped changes

- Removed TS pre-check skip from `trainerbattle_no_intro` to match C `TRAINER_BATTLE_SINGLE_NO_INTRO_TEXT` behavior.
- This prevents Elite Four scripts from auto-advancing when trainer flags remain set but `FLAG_DEFEATED_ELITE_4_*` was reset.
- Added regression coverage in `src/scripting/__tests__/ScriptRunner.trainerBattle.test.ts`.

### Validation

- `node --test --experimental-strip-types src/scripting/__tests__/ScriptRunner.trainerBattle.test.ts`: PASS
- `node --test --experimental-strip-types src/scripting/__tests__/ScriptRunner.*.test.ts`: PASS

## 2026-02-18 Move Scripting Scalability Pass

### Completed IDs

- `MOV-001`, `MOV-002`, `MOV-003`, `MOV-004`, `MOV-005`
- `MOV-006`, `MOV-007`, `MOV-008`, `MOV-009`, `MOV-010`

### Shipped changes

- Fixed Protect gating so protect-affected moves are blocked when target has active Protect.
- Added shared Protect-like success-chain logic and implemented Endure parity.
- Added Mist/Safeguard/Spikes handlers with side-condition timers and wear-off messages.
- Added Safeguard and Mist enforcement in status/stat-lowering move paths.
- Added move-effect coverage reporting from runtime handler registry + generated move/effect data:
  - engine export: `getMoveEffectCoverageReport()`
  - CLI tool: `npm run report:battle:move-effects`
- Added focused engine tests for Protect, Endure, Safeguard, Mist, Spikes, and coverage-report wiring.
- Added plan doc: `docs/features/battle/move-scripting-plan.md`.

### Validation

- `node --test --experimental-strip-types src/battle/engine/__tests__/MoveEffects.scalable.test.ts`: PASS
- `node --test --experimental-strip-types src/battle/engine/__tests__/BattleParity.test.ts`: PASS
- `npm run report:battle:move-effects`: PASS

## 2026-02-18 Move Scripting Verification Hardening

### Completed IDs

- `MOV-011`

### Shipped changes

- Normalized battle-engine import specifiers to explicit `.ts` in the move/damage/status/weather stack so direct Node ESM test/CLI execution is stable.
- Removed flaky RNG behavior in `BattleParity` run-failure test by using deterministic staged RNG values.
- Verified move coverage reporter now executes directly (no module-resolution failure).

### Validation

- `node --test src/battle/engine/__tests__/MoveEffects.scalable.test.ts`: PASS
- `node --test src/battle/engine/__tests__/BattleParity.test.ts`: PASS
- `npm run report:battle:move-effects -- --top 10`: PASS
- `npm run build`: PASS

## 2026-02-18 Generator-First Move Import Hardening

### Completed IDs

- `MOV-012`
- `MOV-013`

### Shipped changes

- Added generator script: `scripts/generate-battle-move-effects.cjs`.
- Added generated artifact: `src/data/battleMoveEffects.gen.ts` (effect -> moves/script index + move -> effect index).

## 2026-02-18 Wild Encounter + Capture Scale Pass (Started)

### Tracker IDs

- `ENC-DOC-001`
- `ENC-DAT-001`, `ENC-DAT-002`, `ENC-DAT-003`
- `ENC-RUN-001`, `ENC-RUN-002`, `ENC-RUN-003`, `ENC-RUN-004`, `ENC-RUN-005`
- `CAP-001`, `CAP-002`
- `ENC-TST-001`, `ENC-TST-002`
- `ENC-ACC-001`, `ENC-ACC-002`, `ENC-ACC-003`

### Scope note

- Canonical plan added at `docs/features/battle/wild-encounter-capture-scale-plan.md`.
- This slice is generator-first for wild encounter datasets and focuses on roaming grass encounters + Poké Ball capture flow verification.
- Updated move coverage runtime/report path to consume generated move-effect index (generator-first data join).
- Updated `verify:generated:battle` to include:
  - `scripts/generate-battle-scripts.cjs`
  - `scripts/generate-battle-move-effects.cjs`
  and freshness checks for:
  - `src/data/battleScripts.gen.ts`
  - `src/data/battleMoveEffects.gen.ts`
- Updated npm battle orchestration to include `generate:battle-move-effects` within `generate:battle-data`.

### Validation

- `npm run generate:battle-move-effects`: PASS
- `npm run verify:generated:battle`: PASS
- `npm run report:battle:move-effects -- --top 12`: PASS
- `node --test src/battle/engine/__tests__/MoveEffects.scalable.test.ts src/battle/engine/__tests__/BattleParity.test.ts`: PASS
- `npm run build`: PASS
