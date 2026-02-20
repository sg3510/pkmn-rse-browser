---
title: Prompt and Menu Unification
status: in-progress
last_verified: 2026-02-20
---

# Prompt and Menu Unification

## Goal

Reduce duplicated prompt/menu/move-selection code paths while preserving gameplay behavior and context-specific rendering differences (battle/evolution/overworld placement and frame chrome).

## Implemented

- Shared prompt core primitives in `src/core/prompt/`:
  - `PromptService.ts`
  - `PromptHost.ts`
  - `textLayout.ts`
- Shared typed menu await flow in `src/menu/MenuStateManager.ts`:
  - `openAsync()`
  - `resolveAsync()`
  - typed `MenuDataMap`
  - `getMenuDataFor()` selector helper
- Shared move-learning adapter in `src/pokemon/moveLearningPromptAdapter.ts` used by:
  - `src/states/BattleState.ts`
  - `src/states/EvolutionState.ts`
  - `src/scripting/ScriptRunner.ts`
- Shared move list model/navigation primitives:
  - `src/menu/moves/MoveListModel.ts`
  - `src/menu/moves/useMoveListNavigation.ts`
- Cross-cutting helper consolidation:
  - `src/world/locationStateFactory.ts`
  - `src/pokemon/displayName.ts`
- Legacy duplicate menu components removed:
  - `src/menu/components/PartyMenu.tsx`
  - `src/menu/components/PokemonSummary.tsx`

## Parity Notes

- Move learning, relearner, and deleter flows now use the same prompt/menu adapter pathway for yes/no + move replacement selection.
- Battle and evolution keep their own visual textbox placement, but prompt yes/no behavior is shared through prompt core APIs.
- Script callback-special fade/wait semantics for berry bag select remain parity-safe after async menu migration.

## Remaining Gap

- Overworld prompt printing/waiting timing + confirm/cancel flow now runs through `src/core/prompt/PromptController.ts`.
- Choice-menu and text-entry submodes in `src/components/dialog/DialogContext.tsx` still keep local UI state handling (by design) while sharing modal key routing.
