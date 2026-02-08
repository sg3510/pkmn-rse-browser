---
title: Birch Intro Rendering and Layering
status: in-progress
last_verified: 2026-02-06
---

# Birch Intro Rendering and Layering

## Related
- `docs/architecture/intro/birch_intro.png`
- `docs/features/newgame/02_BIRCH_SPEECH_INTRO.md`
- `public/pokeemerald/src/main_menu.c`
- `public/pokeemerald/src/field_effect.c`

## Goal
Match Emerald Birch intro scene composition more closely while staying resolution-agnostic.

## Scene Composition Model
- Virtual scene is fixed at `240x160` (GBA framebuffer).
- Render order:
1. Black backdrop fill.
2. Birch intro background tilemap (`graphics/birch_speech/map.bin`) using `shadow.png` as an 8x8 tile source.
3. Character sprite layer (Birch/Lotad or Brendan/May trainer front sprite).
4. Shared dialog system overlay (`src/components/dialog/*`) for message boxes and choice prompts.

## Tilemap Layer Details
- `map.bin` is interpreted as a `32x20` map of 16-bit tile entries.
- Tile entry bits used:
1. `0..9`: tile index.
2. `10`: horizontal flip.
3. `11`: vertical flip.
- Tile size is `8x8`.
- `shadow.png` is loaded with palette-index-0 black keyed to transparency before tile sampling.
  - This avoids rectangular black artifacts around the yellow spotlight platform.
  - Black scene background still appears correctly because the backdrop is drawn first.

## Sprite Position Notes (from C flow)
- Birch centered around `(136, 60)`.
- Lotad shown around `(100, 75)`.
- Gender/player preview uses trainer front sprites at `(180, 60)` during selection and naming.

## Dialog Integration
- Birch state no longer draws a custom textbox.
- It uses the shared dialog system through an imperative bridge:
  - Register bridge from React layer (`GamePage` + `DialogProvider`).
  - Consume bridge in `BirchSpeechState` for `showMessage` and `showChoice`.
- Name entry also runs through the shared dialog system (`showTextEntry`) instead of a Birch-specific Canvas2D panel, so border/frame/text rendering stays consistent with overworld dialog.

## Scaling and Any-Resolution Support
- Birch scene keeps a fixed 240x160 composition.
- For any configured viewport size:
1. Compute fit scale using `min(viewportW / 240, viewportH / 160)` (fractional scaling allowed for small/odd viewport aspect ratios).
2. Center the 240x160 Birch scene in both axes to keep platform + character composition visually centered.
3. Keep dialog overlay viewport-anchored so the text box remains at the bottom of the active viewport across sizes.

This keeps Birch and the platform centered across viewport shapes while keeping dialog placement consistent and readable.

## Dialog Cadence
- Birch intro uses the shared dialog system with `allowSkip = false` while in `NEW_GAME_BIRCH`.
- This preserves letter-by-letter reveal cadence rather than instant full-line reveal on confirm presses.
