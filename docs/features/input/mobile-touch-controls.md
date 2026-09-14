---
title: "Mobile Touch Controls"
status: implemented
last_verified: 2026-09-14
---

# Mobile Touch Controls

Mobile devices render a virtual control deck that feeds the shared `InputController` using `setButtonActive`. It resolves button bindings through `InputMap`; it does not dispatch browser keyboard events.

Desktop behavior is unchanged.

## Scope

- Touch controls are shown only when `(hover: none) and (pointer: coarse)` matches.
- Controls are active across all game states:
  - title
  - main menu
  - Birch intro/dialog flows
  - overworld
  - battle
- Buttons:
  - D-pad (`UP`, `DOWN`, `LEFT`, `RIGHT`)
  - `A`
  - `B`
  - `START`
  - `SELECT`

## Input Mapping Source Of Truth

All virtual buttons resolve to key codes via `src/core/InputMap.ts`:

- `inputMap.getPrimaryBinding(button)` selects the code used by the shared controller.
- `SELECT` now defaults to `ShiftRight`.
- No parallel touch-only mapping table is used.

## Dialog input fix (2026-09-14)

Birch's speech and other React dialogs previously listened only for native `window.keydown`, so the control deck's controller events never reached them. `src/components/dialog/dialogInput.ts` now subscribes dialogs to non-keyboard controller press edges while retaining native keyboard capture for modal propagation and text entry. Both paths use the same dialog handler and `InputMap` bindings. Release events and keyboard events reported by the controller do not produce duplicate actions.

Validation: eleven input/dialog tests passed, including quick touch taps, remapped controls, subscription cleanup and keyboard deduplication. An isolated browser fixture using the production `MobileControlDeck`, touch bridge and `DialogProvider` advanced Birch's opening messages with the on-screen A button and confirmed a choice. TypeScript/Vite build and targeted lint passed. This was a pointer-input browser check, not a physical iOS/Android device test.

## Safety Behavior

The virtual keyboard bridge force-releases active touch keys on:

- `window.blur`
- `document.visibilitychange` (hidden)
- orientation changes (`orientationchange` and media query `change`)
- component unmount

This prevents stuck-held movement or buttons after app switches or rotation.

## Layout

Mobile-only shell styles in `src/pages/GamePage.css`:

- Portrait: stylized GBA SP-inspired stacked shell.
- Landscape: stylized classic GBA-inspired side controls.

Controls use `touch-action: none` and `user-select: none` only on control buttons.

## Key Files

- `src/core/InputMap.ts`
- `src/hooks/useIsTouchMobile.ts`
- `src/hooks/useVirtualKeyboardBridge.ts`
- `src/components/controls/MobileControlDeck.tsx`
- `src/pages/GamePage.tsx`
- `src/pages/GamePage.css`
