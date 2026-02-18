---
title: Battle C Parity Pass 2 Plan
status: completed
written_on: 2026-02-18
last_verified: 2026-02-18
---

# Battle C Parity Pass 2 Plan

## Scope

Second full pass against `public/pokeemerald/src` battle flow to close high-impact parity gaps that still affect end-to-end gameplay.

Primary C references:

- `public/pokeemerald/src/battle_script_commands.c` (`Cmd_handleballthrow`, `Cmd_getexp`)
- `public/pokeemerald/src/battle_util.c` (`HandleAction_UseItem`)
- `public/pokeemerald/src/battle_main.c` (`CreateNPCTrainerParty` IV scaling)
- `public/pokeemerald/data/battle_scripts_2.s` (ball throw message/outcome scripts)

## Top 10 Issues (This Pass)

- [x] `CP2-001` Implement wild Poké Ball capture attempt flow (replace placeholder).
- [x] `CP2-002` Implement Gen3 ball catch multipliers (Ultra/Great/Poke + Net/Dive/Nest/Repeat/Timer + Master auto-catch).
- [x] `CP2-003` Implement status-based catch modifiers (sleep/freeze and major-status boost).
- [x] `CP2-004` Implement shake-count capture resolution and escape strings by shake result.
- [x] `CP2-005` Consume Poké Ball inventory correctly on throw and handle no-item guard path.
- [x] `CP2-006` On successful catch, set battle result/outcome to caught and end battle cleanly.
- [x] `CP2-007` Persist successful catches to party when room exists and update Pokédex seen/caught.
- [x] `CP2-008` Award EXP on every enemy faint (not only final battle win).
- [x] `CP2-009` Apply trainer-battle EXP bonus and Lucky Egg EXP bonus to faint EXP awards.
- [x] `CP2-010` Apply trainer IV scalar parity (`iv * 31 / 255`) when building enemy battle mons.

## Validation Checklist

- [x] Unit tests cover capture success/failure, shake outcomes, and bag consumption.
- [x] Unit tests cover EXP-on-faint behavior in trainer multi-mon flow.
- [x] Unit tests cover trainer IV scaling from generated trainer data.
- [x] `node --test src/battle/mechanics/__tests__/cParityBattle.test.ts`
- [x] `node --test src/pages/gamePage/__tests__/trainerFallback.test.ts`
- [x] `npm run verify:generated:battle`
- [x] `npm run validate:battle-sprites`
- [x] `npm run build`

## Implementation Summary (2026-02-18)

- Replaced the wild-ball placeholder in `src/states/BattleState.ts` with C-style catch flow (ball multipliers, status bonuses, shake resolution, catch/fail messaging).
- Added ball inventory guard/consumption for both wild and trainer-ball attempts.
- Added capture success outcome handling (`B_OUTCOME_CAUGHT`) plus caught-mon persistence to party when room exists.
- Added Pokédex helper APIs in `src/save/SaveManager.ts` and wired caught/seen updates into catch success.
- Moved EXP awards to enemy-faint timing and applied trainer + Lucky Egg multipliers per C ordering.
- Applied trainer IV scalar parity in enemy trainer mon construction.
- Added parity helper module `src/battle/mechanics/cParityBattle.ts` with focused tests in `src/battle/mechanics/__tests__/cParityBattle.test.ts`.

## Follow-up Scope Discovered (Post-CP2)

- `CP2-NEXT-001` EXP Share distribution parity (split sent-in vs Exp Share recipients, not just active mon).
- `CP2-NEXT-002` Traded-mon EXP boost parity and corresponding battle string variants.
- `CP2-NEXT-003` Safari/Wally-specific ball throw branches (`BATTLE_TYPE_SAFARI`, `BATTLE_TYPE_WALLY_TUTORIAL`).
- `CP2-NEXT-004` Caught-mon routing parity when party is full (PC box target + box-full message variants).
- `CP2-NEXT-005` Full caught-mon UX parity (nickname prompt + Dex page flow).
- `CP2-NEXT-006` Repeat Ball parity against national Pokédex ownership semantics if/when national/local split is implemented.
- `CP2-NEXT-007` Battle-turn counter parity audit for Timer Ball edge timing in mixed action turns.
