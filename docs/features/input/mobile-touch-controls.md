---
title: "Mobile Touch Controls"
status: implemented
last_verified: 2026-02-13
---

# Mobile Touch Controls

Mobile devices now render a virtual control deck that feeds the existing keyboard input pipeline by dispatching synthetic `keydown`/`keyup` events using `KeyboardEvent.code`.

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

- `inputMap.getPrimaryBinding(button)` selects the code used for synthetic events.
- `SELECT` now defaults to `ShiftRight`.
- No parallel touch-only mapping table is used.

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

