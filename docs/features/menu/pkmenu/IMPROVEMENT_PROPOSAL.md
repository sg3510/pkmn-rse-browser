---
title: Pokemon Summary Screen - Detailed Comparison & Improvement Plan
status: planned
last_verified: 2026-01-13
---

# Pokemon Summary Screen - Detailed Comparison & Improvement Plan

This document compares the current React implementation against the authentic Pokémon Emerald summary screen structure, with corrections based on provided screenshots.

## 1. Global Layout & Header

| Feature | Authentic Emerald | Current React Implementation | Action Item | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Page Titles** | `POKéMON INFO`<br>`POKéMON SKILLS`<br>`KNOWN MOVES` | `POKéMON INFO`<br>`POKéMON SKILLS`<br>`KNOWN MOVES` | **Rename** "BATTLE MOVES" to "KNOWN MOVES". | **COMPLETED** |
| **Header Style** | "Folder Tab" style (3 distinct tabs at top). Active tab connects to body. | Single "Pill" bar with text title and navigation dots. | **Redesign** header to use 3 tab images/shapes. Hide dots (or keep for mobile only). | Pending |
| **Background** | 0 degrees (vertical) and static. | Vertical striped overlay. | **OK.** (Current implementation matches authentic Emerald). | **COMPLETED** |

## 2. Left Panel (Persistent)

| Feature | Authentic Emerald | Current React Implementation | Action Item | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Name Display** | `Primary Name`: Nickname (if distinct), else Species Name.<br>`Secondary Name`: /Species Name (if any nickname exists, per RALTS /RALTS). | `Primary Name` (Large)<br>`/Secondary Name` (Small, below) | **Implemented logic:** Primary name is `nickname` (if distinct) else `speciesName`. Secondary name is `/speciesName` (if any `nickname` exists). | **COMPLETED** |
| **Level** | `Lv.` followed by number. | `Lv` (small 'v') followed by number. | **Verify** 'Lv' glyph. "Lv." is standard text, `Lv` might be a special tile. | Pending |
| **Gender** | Color-coded Symbol next to level/name. | Symbol present. | **OK.** | **COMPLETED** |
| **Pokéball** | Sprite of the specific ball used. | CSS-drawn Pokéball. | **Replace** with `ball_graphics` sprite assets (e.g., `public/pokeemerald/graphics/items/icons/poke_ball.png` and variants). | Pending |
| **Markings** | Sprites of markings (● ■ ▲ ♥). | Text characters (● ■ ▲ ♥). | **Replace** with sprite assets (`public/pokeemerald/graphics/interface/mon_markings.png`). | Pending |

## 3. Screen 1: POKéMON INFO (Based on `Pokemon - Emerald Version (USA, Europe) 2-1.png`)

**Current Status:** Content distribution is largely **CORRECT** regarding Ability/Item placement.

| Section | Authentic Emerald (Screenshot) | Current React Implementation | Action Item | Status |
| :--- | :--- | :--- | :--- | :--- |
| **PROFILE Header** | Present. | Present. | **OK.** | **COMPLETED** |
| **OT/ID No.** | OT/Seb<br>IDNo32267 | OT/Seb<br>IDNo.32267 | **OK.** | **COMPLETED** |
| **TYPE** | TYPE/PSYCHC | TYPE/PSYCHC | **OK.** | **COMPLETED** |
| **ABILITY** | ABILITY<br>SYNCHRONIZE<br>Passes on status problems. | ABILITY<br>SYNCHRONIZE<br>Passes on status problems. | **OK.** (My prior analysis on this was corrected, ability is indeed on Info page). | **COMPLETED** |
| **TRAINER MEMO** | RELAXED nature,<br>met at Lv4,<br>ROUTE 102. | Similar text. | **Ensure** line wrapping matches game width (approx 3 lines). | Pending |
| **Item** | **NOT** displayed here. | **NOT** displayed here. | **OK.** (Item correctly placed on Skills page). | **COMPLETED** |

## 4. Screen 2: POKéMON SKILLS

| Section | Authentic Emerald | Current React Implementation | Action Item | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Item** | Displayed here. (Label: `ITEM`) | Displayed here. | **OK.** (Based on Item not being on Info page). | **COMPLETED** |
| **Ability** | **NOT** displayed here. | **NOT** displayed here. | **OK.** (Based on Ability being on Info page). | **COMPLETED** |
| **Ribbons** | Label: `RIBBONS`. | Label: `RIBBON`. | **Change** "RIBBON" to "RIBBONS". | Pending |
| **Stats** | HP, Attack, Defense, Sp. Atk, Sp. Def, Speed. | Same list. | **OK.** | **COMPLETED** |
| **Layout** | **Top:** Item/Ribbons.<br>**Middle:** Stats.<br>**Bottom:** Exp Info. | **Top:** Item/Ribbon.<br>**Middle:** Stats.<br>**Bottom:** Exp Info. | **OK.** (Layout seems consistent for these elements). | **COMPLETED** |

## 5. Screen 3: KNOWN MOVES

| Section | Authentic Emerald | Current React Implementation | Action Item | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Left Panel** | Shows "POWER" and "ACCURACY" box when move selected. | Shows "EFFECT" box. | **Terminology:** Check if header is "EFFECT" or just "POWER/ACCURACY". (Current code says "EFFECT"). | Pending |
| **Move List** | Type Icon, Name, PP/MaxPP. | Same. | **OK.** | **COMPLETED** |
| **Selection** | Red outline/highlight on selected move. | Highlight style present. | **Refine** highlight visual to match "wobbly" red box if possible. | Pending |
| **Cancel** | `CANCEL` option at bottom of list? | Not present (B button usually). | **Check** if "CANCEL" is the 5th slot in list. | Pending |

## Summary of Critical Fixes (Priority Order)

1.  **Terminology:** Rename "BATTLE MOVES" -> "KNOWN MOVES". | **COMPLETED**
2.  **Name Display Clarification:** Ensure `displayName` logic (primary) and secondary species name (if different nickname is present) is handled correctly. If the screenshot `RALTS /RALTS` is the strict rule, then the current code is fine. | **COMPLETED**
3.  **Ribbons Label:** Change "RIBBON" to "RIBBONS". | Pending
4.  **Assets:** Replace CSS placeholders (Pokéball, Markings) with sprites. | Pending
5.  **Font:** Register `Pokemon Emerald` font in global CSS. | Pending

## 6. Asset References

The following assets have been located in the project and should be used to replace CSS approximations:

*   **Pokéball (Item Icon):** `public/pokeemerald/graphics/items/icons/poke_ball.png` (plus variants like `ultra_ball.png`, `master_ball.png` etc. based on `pokemon.ball`).
*   **Markings:** `public/pokeemerald/graphics/interface/mon_markings.png` (Contains the bitmap versions of ● ■ ▲ ♥).
*   **Type Icons:** `public/pokeemerald/graphics/types/*.png` (Already partially integrated, verify usage).
*   **Fonts:** `public/fonts/pokemon-emerald.otf` (Needs `@font-face` registration).