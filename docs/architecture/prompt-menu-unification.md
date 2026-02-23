---
title: Prompt and Menu Unification
status: in-progress
last_verified: 2026-02-22
---

# Prompt and Menu Unification

## Goal

Reduce duplicated prompt/menu/move-selection code paths while preserving gameplay behavior and context-specific rendering differences (battle/evolution/overworld placement and frame chrome).

## Implemented

- Shared prompt core primitives in `src/core/prompt/`:
  - `PromptService.ts`
  - `PromptController.ts` (adapter over `PromptPrinterEngine.ts`)
  - `PromptPrinterEngine.ts`
  - `PromptCanvasRenderer.ts`
  - `PromptWindowProfile.ts`
  - `PromptWindowProfiles.ts`
  - `PromptWindowSkin.ts`
  - `skins/FieldTextWindowSkin.ts`
  - `skins/BattleTextboxSkin.ts`
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
- Battle and evolution now share the same prompt printer and prompt canvas renderer, while keeping battle-specific textbox skin/template placement.
- Overworld printing/waiting/scrolling message display now uses the same shared prompt canvas renderer with field-specific skin/profile.
- A/B speed-up and A/B wait/advance behavior is now centralized in the prompt printer engine for battle/evolution/overworld prompt flows.
- Script callback-special fade/wait semantics for berry bag select remain parity-safe after async menu migration.

## Remaining Gap

- Choice-menu and text-entry submodes in `src/components/dialog/DialogContext.tsx` still keep local UI state handling (by design) while sharing modal key routing.
