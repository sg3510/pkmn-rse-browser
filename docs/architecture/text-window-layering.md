---
title: Text Window Layering (C-Authentic)
status: in-progress
last_verified: 2026-02-22
---

# Text Window Layering (C-Authentic)

## Goal

Match pokeemerald layering where field/battle/evolution share a text printer core, while each context keeps its own window template/skin, geometry, and palette assumptions.

## C Layering Reference

### Shared text printer core

- `public/pokeemerald/src/text.c`
  - wait and down-arrow wait behavior (`TextPrinterWaitWithDownArrow`, `TextPrinterWait`)
  - input-driven print speed-up (`A`/`B`)
  - per-character printer state machine and page/wait transitions

### Field message path

- `public/pokeemerald/src/field_message_box.c` (`ShowFieldMessage`)
- `public/pokeemerald/src/menu.c` (`AddTextPrinterForMessage`)
- `public/pokeemerald/src/text_window.c` (window frame/chrome primitives)

### Battle message path

- `public/pokeemerald/src/battle_message.c` (`BattlePutTextOnWindow`)
- `public/pokeemerald/src/battle_bg.c` (battle window template setup)

## TypeScript Mapping

### Shared printer + renderer core

- `src/core/prompt/PromptPrinterEngine.ts`
  - single printer state machine for field/battle/evolution message + yes/no
  - shared A/B speed-up and A/B wait/advance
  - shared pagination and scroll transition handling
- `src/core/prompt/PromptCanvasRenderer.ts`
  - profile-driven prompt drawing (window skin + text + optional arrow + yes/no box)
- `src/core/prompt/PromptController.ts`
  - stable public API; thin adapter over `PromptPrinterEngine`
- `src/core/prompt/PromptWindowProfile.ts`
- `src/core/prompt/PromptWindowProfiles.ts`
- `src/core/prompt/PromptWindowSkin.ts`

### Concrete skins

- `src/core/prompt/skins/FieldTextWindowSkin.ts`
  - text-window frame skin (`/pokeemerald/graphics/text_window/*`)
- `src/core/prompt/skins/BattleTextboxSkin.ts`
  - battle textbox map pages via battle interface extraction path

### State integrations

- `src/states/BattleState.ts`
  - battle message progression now uses shared prompt engine
  - battle/evolution prompt text windows now render via shared canvas renderer + battle skin
- `src/states/EvolutionState.ts`
  - evolution prompt rendering now uses shared canvas renderer + battle skin
- `src/components/dialog/DialogBox.tsx`
  - printing/waiting/scrolling message display now uses shared canvas renderer + field skin
  - choice menus and text-entry mode remain in existing DialogContext/React menu path

## Non-Negotiable Parity Rules

- A/B must both speed text while printing and advance/confirm when waiting (context permitting).
- Window geometry, palette/text colors, and font sizing stay profile-specific by context.
- Field and battle do not force a single visual skin.
- Battle placement/layout remains battle-owned; field assumptions must not overwrite battle UI.
- Overworld initiation remains A-driven for normal interaction; B is not a general interact initiator.

## Input Exception Parity

Underwater DIVE emerge stays bound to `B`, matching C field control behavior.

- C reference: `public/pokeemerald/src/field_control_avatar.c`
- TS implementation: `src/hooks/useActionInput.ts`
