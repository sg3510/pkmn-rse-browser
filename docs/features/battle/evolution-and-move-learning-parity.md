---
title: Evolution and Move-Learning Parity
status: implemented
last_verified: 2026-02-20
---

# Evolution and Move-Learning Parity

## Scope

Implemented battle-integrated Gen 3 evolution and move-learning flow with Emerald-focused behavior:

- Post-battle evolution queue for mons that leveled during battle (party index order).
- Rare Candy field-use level-up path now reuses move-learning + evolution checks.
- `EVO_MODE_NORMAL` resolution parity for level/friendship/day-night/beauty/atk-def/Silcoon-Cascoon/Ninjask branches.
- Everstone blocking in normal mode.
- Evolution cancel support while cycling sprites (`B` hold during cancel window, when `canStop` is true).
- Level-up move learning with replacement loops, HM forget rejection, and retry semantics.
- Post-evolution move learning at exact evolved-species current level.
- Shedinja creation for Nincada -> Ninjask when party has space.

## C References

- `public/pokeemerald/src/pokemon.c`
  - `GetEvolutionTargetSpecies`
  - `MonTryLearningNewMove`
  - `CalculateMonStats`
  - `EvolutionRenameMon`
  - `RemoveMonPPBonus` / `SetMonMoveSlot`
- `public/pokeemerald/src/evolution_scene.c`
  - `Task_EvolutionScene` flow
  - move replace `MVSTATE_*`
  - `CreateShedinja`
- `public/pokeemerald/src/evolution_graphics.c`
  - sparkle motion families and cycle behavior

## Runtime Wiring

- `src/states/BattleState.ts`
  - tracks level-up slots and level-up move-learning before normal battle continuation
  - constructs evolution queue on win
  - uses shared prompt adapter + typed async `moveForget` menu gateway for replacement flow
  - transitions to `GameState.EVOLUTION` when queue is non-empty
- `src/states/EvolutionState.ts`
  - processes queued evolutions
  - applies species/stat/nickname updates
  - applies post-evolution move learning
  - uses the same shared move-learning prompt adapter as battle/overworld flows
  - returns to overworld with preserved return-location and object runtime state
- `src/pages/gamePage/useHandledStoryScript.ts`
  - battle wait now includes both `BATTLE` and `EVOLUTION`
- `src/scripting/ScriptRunner.ts`
  - move relearner + move deleter specials now share central move-learning/move-forget plumbing
  - party/bag/move-forget selections use `MenuStateManager.openAsync()` rather than bespoke callback wrappers

## Input Semantics

- Evolution cancel: hold `B` during sprite-cycle window.
- Move replacement yes/no: `B` maps to `NO`.
- Move-forget chooser: `A` choose slot, `B` cancel slot selection.
- Stop-learning prompt: `B` maps to `NO` (retry), matching Emerald flow.

## UI/Renderer Components

- New modal menu: `moveForget` via `src/menu/components/MoveForgetMenuContent.tsx`.
- Shared move-row/navigation primitives:
  - `src/menu/moves/MoveListModel.ts`
  - `src/menu/moves/useMoveListNavigation.ts`
- Evolution renderer/state:
  - `src/evolution/EvolutionRenderer.ts`
  - `src/evolution/types.ts`
  - `src/states/EvolutionState.ts`

## Notes

- Audio parity is intentionally out of scope for this milestone.
- Day/night checks use local runtime hour.
- Trade/item-use triggers are left for follow-up milestone wiring.
