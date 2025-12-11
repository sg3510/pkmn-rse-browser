# Pokemon Summary Screen Improvement Proposal

## Goal
Achieve a "pixel-perfect" recreation of the Pokémon Emerald Summary screen using React and CSS, while maintaining responsiveness and modern usability (e.g., Back button).

## Analysis of Discrepancies

### 1. Name & Species Display (Left Panel)
*   **Current Code:** Displays `Species Name` (Large) / `Nickname` (Small).
*   **Original Game:** Displays `Nickname` (Large) / `Species Name` (Small) if a nickname exists. If no nickname, it displays `Species Name` (Large).
*   **Correction:** Logic needs to be inverted.
    *   *If Nicknamed:* Large Text = Nickname, Small Text (below) = Species Name.
    *   *If Not Nicknamed:* Large Text = Species Name.

### 2. Header & Tabs
*   **Current:** A "pill" shaped bar (`summary-emerald-header`) with a text title ("POKEMON INFO") and navigation dots.
*   **Original:** Three distinct "Folder Tabs" at the very top: `POKEMON INFO`, `POKEMON SKILLS`, `KNOWN MOVES`. The active tab is highlighted/connected to the content.
*   **Text:** "BATTLE MOVES" (Current) vs "KNOWN MOVES" (Original).
*   **Proposal:** 
    *   Rename "BATTLE MOVES" to "KNOWN MOVES".
    *   Keep the "dots" for mobile/touch responsiveness if distinct tabs are too small, but style them to look more integrated.
    *   *Ideal:* Implement the 3-tab look using CSS `clip-path` or images to match the GBA aesthetic.

### 3. Typography & Fonts
*   **Current:** Uses `var(--font-family)` which falls back to generic fonts if not loaded.
*   **Original:** Uses the specific 6px/12px bitmap font.
*   **Issue:** `public/fonts/pokemon-emerald.otf` exists but is not loaded via `@font-face` in `index.css`.
*   **Proposal:** Add the `@font-face` declaration to ensure the text renders with the correct pixelated look.

### 4. Icons & Assets
*   **Pokéball:** Current is a CSS shape (`summary-pokeball-icon`). Original is a sprite.
*   **Markings:** Current uses text characters (`●`, `■`). Original uses specific bitmap icons.
*   **Proposal:** 
    *   Use sprite extraction or CSS `background-image` with the exact assets found in `public/pokeemerald/graphics/summary_screen` (if convertable) or `public/img`.
    *   For Markings, use a small sprite sheet or base64 images.

### 5. Layout & Spacing
*   **Left Panel:**
    *   "No." label color: Yellowish in code (`#fef08a`), White/Grey in game? (Need to verify markings.pal).
    *   Level "Lv": Code uses `L` + `span` for `v`. The font might handle this better if the glyph exists.
*   **Right Panel:**
    *   **Info Page:** 
        *   "OT/" and "IDNo." alignment seems close.
        *   "TRAINER MEMO" text flow needs to match the game's line wrapping (approx 3 lines).
    *   **Skills Page:**
        *   "EXP. POINTS" vs "EXP. Points". Case sensitivity. Game uses ALL CAPS for labels. Code mostly does this but check consistency.

## Implementation Plan

### Phase 1: Corrections (Immediate)
1.  **Fix Name Logic:** Swap Nickname/Species priority.
2.  **Fix Terminology:** "BATTLE MOVES" -> "KNOWN MOVES".
3.  **Fix Font:** Register `Pokemon Emerald` font in global CSS.

### Phase 2: Visual Refinement (CSS)
1.  **Tabs:** Style the header to look more like the 3-tab system (even if simplified).
2.  **Colors:** Verify colors against `markings.pal` (can convert RGB values).
3.  **Backgrounds:** Refine the striped background `repeating-linear-gradient` to match the exact pixel stride of the original tilemap.

### Phase 3: Assets
1.  Replace CSS Pokeball with sprite.
2.  Replace Text Markings with sprites.

## Response to User Request
This proposal outlines the necessary changes without modifying the code yet. The most critical fix for "pixel perfection" is the **Font** and the **Name Order**.
