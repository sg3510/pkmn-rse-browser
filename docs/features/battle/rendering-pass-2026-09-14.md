---
title: Battle rendering pass
status: implemented
last_verified: 2026-09-14
---

# Battle rendering pass

Battle rendering uses the original 240×160 coordinate system, cached artwork for static frames, and canvas rectangles for the changing HP fill. Bitmap fonts are cached and tinted once, then drawn at native pixel size. No per-frame asset decoding or font rasterization is required.

## Layout and text

- Enemy sprite top-left: `(144, 8)` plus species Y offset and elevation.
- Player sprite top-left: `(40, 48)` plus species Y offset. The extra eight pixels in the C animation coordinate are not part of the resting sprite position. The message window still covers the sprite below Y=112, as on GBA.
- Full healthbox artwork origins: enemy `(12, 14)`, player `(126, 72)`. Text bounds exclude transparent padding and the shadow.
- Headings use the small font, a level ligature, and personality/species gender. Default Nidoran names do not receive a second gender symbol. Level 100 fits beside ten-character names.
- Messages and action labels use the normal font; move names and type labels use the narrow font.
- `scripts/generate-gba-fonts.cjs` extracts glyph IDs and advances from `public/pokeemerald/charmap.txt` and `public/pokeemerald/src/fonts.c`. Re-run it when updating font sources.
- The shared prompt renderer accepts an optional text painter so measurement, wrapping, scaling, and scrolling use the same bitmap advances in battle. Other prompts retain their existing drawing path.

## Bars and composition

HP has six eight-pixel segments, original label/rails/caps, and two color rows. The fill switches at the original pixel thresholds and keeps one pixel visible while HP is positive. EXP uses eight segments and is empty at level 100. Status badges occupy their original separate positions; the enemy badge replaces the HP label.

BG3 is the permanent background. BG1 entrance artwork is uploaded separately, scrolls during the browser entrance, and is omitted after 1.2 seconds. This is a browser-duration animation, not a cycle-exact port of every terrain's original intro task. The original C explicitly clears the entry layer; it must never be baked into BG3.

The bottom window area has an opaque backdrop beneath the indexed menu tiles. Transparent frame corners therefore reveal the window backdrop instead of sprites or terrain.

## Verification

Open `#/battle-render` for an isolated comparison against the supplied GBA reference. It uses the production background, sprite, healthbox, menu, and prompt renderers. Controls cover message/action/move pages, cursor positions, low/zero/full HP, status, genderless headings, long names, level 100, terrain, and entrance time. It does not read or write saves.

Targeted tests:

```sh
node --experimental-strip-types --test src/core/prompt/__tests__/*.test.ts src/battle/render/__tests__/*.test.ts src/rendering/__tests__/gbaFontLayout.test.ts
```

C references: `public/pokeemerald/src/battle_interface.c`, `battle_anim_mons.c`, `battle_controller_player.c`, `battle_bg.c`, `battle_message.c`, `battle_intro.c`, and `text.c`.
