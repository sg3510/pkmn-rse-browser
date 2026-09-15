---
title: "Mobile Touch Controls"
status: implemented
last_verified: 2026-09-14
---

# Mobile Touch Controls

Mobile devices render a virtual control deck that feeds the shared `InputController` using `setButtonActive`. It resolves button bindings through `InputMap`; it does not dispatch browser keyboard events.

Keyboard and touch share the same modal input paths. Native text fields retain normal keyboard editing.

## Scope

- Touch controls are shown when `(hover: none) and (pointer: coarse)` matches.
- `?controls=touch` or `?controls=keyboard` overrides detection for hybrid devices and responsive testing (before the hash route).
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

## Mobile compatibility pass (2026-09-14)

- Shared `src/core/input/subscribeModalInput.ts` routes controller press edges to dialogs and every menu using `useMenuInput` (Start, Bag, Party, summary, move forgetting and script choices). Placeholder menus also support B to return.
- Modal presses are consumed until release so a quick A/B tap cannot leak into the next gameplay frame after closing a menu.
- Text entry renders a native input and OK button; tapping the field opens the device keyboard. Game bindings ignore editable targets. Birch names filter pasted/typed values to seven uppercase letters. Native Enter and virtual A share validation; composing text does not submit prematurely.
- The D-pad requires an active pointer press before movement can change direction. Returning to its center releases movement. Visual and logical touch state use the same blur, hidden-page, rotation and unmount reset lifecycle.
- Start/Select targets are at least 44 CSS pixels tall. Narrow portrait reserves a larger D-pad; landscape control columns match the game viewport rather than overlapping it.
- Mobile Files exposes the existing save/export/load tools, with a bounded scrolling dropdown. No save-format changes.
- The debug drawer fits narrow screens, has an explicit close button and sits above the Files control.

### Verification and remaining device checks

Fourteen input/dialog tests pass, covering quick taps, remapping, duplicate keyboard prevention, modal press consumption, rotation/background reset notifications and subscription cleanup. TypeScript/Vite build and targeted lint pass.

Browser pointer checks used production components in an isolated fixture: virtual D-pad navigation into Bag, A confirmation, B back through nested menus, native typing of game-bound letters (AXZW), name filtering and virtual A submission. Frame inspection after modal closure showed no queued pressed/held input. The actual game shell was inspected at 320×568, 390×844, 568×320 and 844×390; compact landscape overlap was reproduced and corrected. Files and debug drawer access were checked at narrow sizes.

These are desktop browser viewport/pointer checks, not physical mobile-device certification. Still validate iOS Safari and Android Chrome keyboard presentation, safe-area insets, multi-finger movement+A/B, OS interruptions while holding controls, file picker/download behavior, and sustained battle/3D performance on hardware. Browser save data remains origin-local; clearing browser storage removes it. Broad audio support remains deferred.

## Screenshot follow-up: clipped sides and dialog seams

The mobile viewport minimum was 14 metatiles (224 pixels), narrower than the fixed 240-pixel battle scene and field message window. At that minimum, centering clipped eight native pixels from each side. The minimum is now 15 metatiles; CSS zoom still fits the complete viewport into the phone shell.

Field messages now compose at their native 240×44 resolution and scale the completed canvas in CSS. This avoids independently rasterizing adjacent frame tiles at fractional coordinates, which could expose thin transparent seams. A browser fixture at 321/240 zoom verified an unbroken window over contrasting stripes; production build and targeted lint passed. Physical Safari verification remains outstanding.

The shared state-screen render loop also rounds its backing scale up to an integer (retaining device-density detail) and uses CSS for the final fractional display size. This covers battle, title and state-menu draw calls. React choice-window frames compose at native tile resolution too. Browser verification at a 393px phone viewport confirmed a 480×384 backing canvas displayed at 321×256.8; the production build and targeted lint passed. Fractional display sizing can still distribute pixel widths unevenly, but should not create transparent gaps between separately drawn tiles.
