# Menu System Implementation TODO

Progress checklist for the menu system implementation.

---

## Phase 1: Core Infrastructure

### 1.1 Menu State Manager
- [ ] Create `src/menu/MenuStateManager.ts`
- [ ] Define `MenuState` interface (isOpen, currentMenu, cursorIndex, history)
- [ ] Implement `open(menu)`, `close()`, `back()` methods
- [ ] Add menu stack for nested navigation (Start → Bag → Item details)
- [ ] Connect to React context for global access

### 1.2 Menu Input Handler
- [ ] Create `src/menu/MenuInputHandler.ts`
- [ ] Keyboard bindings: Arrow keys, WASD, Enter/X, Escape/Z
- [ ] Mouse handlers: click, hover, right-click (cancel)
- [ ] Grid navigation logic (2D cursor movement)
- [ ] Prevent game input while menu open
- [ ] Sound effect triggers on input

### 1.3 Menu UI Entry Point
- [ ] Add "Menu" button next to Save/Load in `GamePage.tsx` header
- [ ] Press Enter/Start key opens menu (when allowed)
- [ ] Menu button icon (hamburger or Pokemon-style)
- [ ] Button hidden/disabled based on game state

### 1.4 Menu Access Control
- [ ] Only allow menu in `GameState.OVERWORLD`
- [ ] Block menu during:
  - [ ] Title screen / Main menu
  - [ ] Intro sequence
  - [ ] Battle
  - [ ] Dialog box open
  - [ ] Warp/fade transitions
  - [ ] Cutscenes
  - [ ] Player movement animation
- [ ] Check `dialogIsOpen` flag
- [ ] Check `player.isMoving` flag
- [ ] Check `currentState === GameState.OVERWORLD`

### 1.5 Sound Effects
- [ ] Add menu sound files to `/public/sounds/`
  - [ ] `select.mp3` - cursor move / confirm
  - [ ] `cancel.mp3` - back / cancel
  - [ ] `open.mp3` - menu open
  - [ ] `error.mp3` - invalid action
- [ ] Create `playMenuSound(sound)` utility

---

## Phase 2: Start Menu (2x3 Grid)

### 2.1 Component Structure
- [ ] Create `src/menu/components/StartMenu.tsx`
- [ ] Create `src/menu/styles/start-menu.css`
- [ ] Overlay container with backdrop blur
- [ ] 2x3 CSS Grid layout
- [ ] Menu tile component

### 2.2 Menu Tiles
- [ ] POKéDEX tile (disabled until `FLAG_SYS_POKEDEX_GET`)
- [ ] POKéMON tile (disabled until `FLAG_SYS_POKEMON_GET`)
- [ ] BAG tile (always enabled)
- [ ] Player name tile → Trainer Card
- [ ] SAVE tile
- [ ] OPTION tile

### 2.3 Tile States & Styling
- [ ] Default state styling
- [ ] Hover state (mouse)
- [ ] Selected state (keyboard focus)
- [ ] Disabled state (grayed out, no interaction)
- [ ] Pulsing selection animation

### 2.4 Navigation
- [ ] Arrow key grid navigation (wrap at edges)
- [ ] Enter/X to select tile
- [ ] Escape/Z to close menu
- [ ] Click tile to select
- [ ] Hover to preview (optional highlight)

### 2.5 Animations
- [ ] Menu open animation (fade + scale)
- [ ] Menu close animation
- [ ] Cursor move transition
- [ ] Tile hover scale effect

### 2.6 Menu Icons
- [ ] Extract/create 32x32 pixel icons:
  - [ ] Pokedex icon
  - [ ] Poke Ball icon (Pokemon)
  - [ ] Bag/backpack icon
  - [ ] Trainer card icon
  - [ ] Save/floppy icon
  - [ ] Options/gear icon
- [ ] Create sprite sheet or individual PNGs
- [ ] `image-rendering: pixelated` for crisp scaling

---

## Phase 3: Trainer Card

### 3.1 Component Structure
- [ ] Create `src/menu/components/TrainerCard.tsx`
- [ ] Create `src/menu/styles/trainer-card.css`
- [ ] Card container with 3D perspective

### 3.2 Front of Card
- [ ] Player sprite/avatar display
- [ ] Player name
- [ ] Trainer ID (5 digits)
- [ ] Money display (¥ symbol)
- [ ] Pokedex count (if has Pokedex)
- [ ] Play time (HH:MM format)
- [ ] Blinking colon animation
- [ ] Star display (0-4 stars based on achievements)

### 3.3 Back of Card
- [ ] "{Name}'s TRAINER CARD" title
- [ ] Hall of Fame time (if entered)
- [ ] Link battle record (placeholder)
- [ ] Pokemon trades count
- [ ] Adventure started date (optional)

### 3.4 Badge Display
- [ ] 8 badge slots (4x2 grid)
- [ ] Badge icons from `graphics/trainer_card/badges.png`
- [ ] Show/hide based on `FLAG_BADGE01_GET` through `FLAG_BADGE08_GET`
- [ ] Empty slot placeholder

### 3.5 Card Flip Animation
- [ ] CSS 3D flip with `transform: rotateY(180deg)`
- [ ] `backface-visibility: hidden` for both faces
- [ ] A button flips to back
- [ ] B button flips to front or closes
- [ ] 400ms transition duration

### 3.6 Star Color System
- [ ] 0 stars = Green card
- [ ] 1 star = Bronze
- [ ] 2 stars = Copper
- [ ] 3 stars = Silver
- [ ] 4 stars = Gold
- [ ] CSS custom properties for colors

---

## Phase 4: Bag Menu

### 4.1 Component Structure
- [ ] Create `src/menu/components/BagMenu.tsx`
- [ ] Create `src/menu/styles/bag-menu.css`
- [ ] Full-screen overlay layout

### 4.2 Pocket Tabs
- [ ] 5 pocket tabs (Items, Key Items, Balls, TMs, Berries)
- [ ] Tab icons from sprites
- [ ] L/R keyboard shortcuts (Q/E keys)
- [ ] Click to switch pocket
- [ ] Active tab indicator

### 4.3 Item List
- [ ] Scrollable item list per pocket
- [ ] Item icon (32x32) + name + quantity
- [ ] "x99" quantity format
- [ ] Cursor/selection highlight
- [ ] Scroll with arrow keys
- [ ] Empty pocket message

### 4.4 Item Description Panel
- [ ] Show description of highlighted item
- [ ] Item icon large view
- [ ] Auto-update on cursor move

### 4.5 Bag Visual
- [ ] Bag sprite (male/female variant)
- [ ] Money display
- [ ] Pocket name header

### 4.6 Per-Pocket State
- [ ] Remember cursor position per pocket
- [ ] Remember scroll position per pocket
- [ ] Persist during session

### 4.7 Context Menu (Item Actions)
- [ ] USE action
- [ ] GIVE action (to Pokemon)
- [ ] TOSS action (with quantity picker)
- [ ] REGISTER action (Key Items only)
- [ ] CHECK action (Berries only)
- [ ] CANCEL action
- [ ] 2x2 grid layout for actions
- [ ] Different actions per pocket type

### 4.8 Quantity Picker
- [ ] For TOSS action
- [ ] Up/Down to change quantity
- [ ] Left/Right for ±10
- [ ] Confirm/Cancel

---

## Phase 4.5: Pokemon Data Infrastructure

Prerequisites for Party Menu and Pokemon-related features.

### 4.5.1 Data Generation Scripts
- [x] Create `scripts/generate-species-data.cjs`
- [x] Create `scripts/generate-species-info.cjs`
- [x] Create `scripts/generate-moves.cjs`
- [x] Create `scripts/generate-abilities.cjs`
- [x] Add npm scripts (`generate:all`, etc.)

### 4.5.2 Generated Data Files
- [x] `src/data/species.ts` - 387 species constants, names, icon paths
- [x] `src/data/speciesInfo.ts` - Base stats, types, abilities, growth rates
- [x] `src/data/moves.ts` - 356 move constants and names
- [x] `src/data/abilities.ts` - 78 ability constants and names
- [x] `src/data/itemDescriptions.ts` - 318 item descriptions

### 4.5.3 Pokemon Type System
- [x] `src/pokemon/types.ts` - Pokemon, PartyPokemon, BoxPokemon interfaces
- [x] `src/data/natures.ts` - 25 natures with stat modifiers

### 4.5.4 Pokemon Utilities
- [x] `src/pokemon/stats.ts` - Stat calculation formulas
- [x] `src/pokemon/stats.ts` - EXP tables and level calculation
- [x] `src/pokemon/stats.ts` - Gender/shiny determination
- [x] `src/pokemon/icons.ts` - Icon path helpers, type colors

### 4.5.5 Context & State (TODO)
- [ ] Create `src/contexts/PartyContext.tsx`
- [ ] Extend `SaveManager` for party persistence
- [ ] Create test Pokemon for development

---

## Phase 5: Party Menu

### 5.1 Component Structure
- [ ] Create `src/menu/components/PartyMenu.tsx`
- [ ] Create `src/menu/styles/party-menu.css`
- [ ] 2-column, 3-row grid layout

### 5.2 Pokemon Slot Display
- [ ] Pokemon icon sprite (32x32, animated)
- [ ] Nickname or species name
- [ ] Level display "Lv.XX"
- [ ] Gender symbol (♂/♀)
- [ ] HP bar with color (green/yellow/red)
- [ ] HP numbers "XXX/XXX"
- [ ] Held item icon (if any)
- [ ] Status condition icon (if any)

### 5.3 HP Bar Component
- [ ] Create reusable `HPBar.tsx`
- [ ] Animated width transition
- [ ] Color based on HP %:
  - [ ] Green: > 50%
  - [ ] Yellow: 20-50%
  - [ ] Red: < 20%

### 5.4 Empty Slots
- [ ] Show empty slot placeholder
- [ ] Non-selectable

### 5.5 Slot Selection
- [ ] Grid navigation (2x3)
- [ ] Selection highlight/animation
- [ ] Click to select
- [ ] Enter to open Pokemon submenu

### 5.6 Pokemon Submenu
- [ ] SUMMARY option
- [ ] SWITCH option
- [ ] ITEM option (give/take)
- [ ] CANCEL option

### 5.7 Swap Mode
- [ ] Select first Pokemon
- [ ] Visual indicator "swap target"
- [ ] Select second to swap
- [ ] Cancel with B

---

## Phase 6: Pokemon Summary Screen

### 6.1 Component Structure
- [ ] Create `src/menu/components/PokemonSummary.tsx`
- [ ] Create `src/menu/styles/pokemon-summary.css`
- [ ] Page-based navigation

### 6.2 Page Tabs
- [ ] INFO page
- [ ] SKILLS page
- [ ] MOVES page
- [ ] Left/Right to switch pages
- [ ] Page indicator dots

### 6.3 INFO Page
- [ ] Pokemon sprite (large)
- [ ] Species name
- [ ] Nickname
- [ ] Level
- [ ] Nature
- [ ] Ability name
- [ ] OT (Original Trainer)
- [ ] ID No.
- [ ] Met location (optional)

### 6.4 SKILLS Page
- [ ] All 6 stats (HP, Atk, Def, SpA, SpD, Spe)
- [ ] Stat bars visualization
- [ ] Ability description
- [ ] Experience bar
- [ ] EXP to next level

### 6.5 MOVES Page
- [ ] 4 move slots
- [ ] Move name
- [ ] Move type icon
- [ ] PP display "XX/XX"
- [ ] PP color based on remaining
- [ ] Move selection for details
- [ ] Move power/accuracy/description

---

## Phase 7: Options Menu

### 7.1 Component Structure
- [ ] Create `src/menu/components/OptionsMenu.tsx`
- [ ] Create `src/menu/styles/options-menu.css`

### 7.2 Options List
- [ ] TEXT SPEED: Slow / Mid / Fast
- [ ] SOUND: Stereo / Mono
- [ ] BATTLE STYLE: Shift / Set
- [ ] BATTLE SCENE: On / Off
- [ ] BUTTON MODE: Normal / LR / L=A

### 7.3 Option Controls
- [ ] Left/Right to change value
- [ ] Visual indicator for current value
- [ ] Save to localStorage on change

---

## Phase 8: Save Menu

### 8.1 Component Structure
- [ ] Create `src/menu/components/SaveMenu.tsx`
- [ ] Integrate with existing SaveManager

### 8.2 Save Confirmation
- [ ] "Would you like to save?" prompt
- [ ] YES / NO selection
- [ ] Save progress indicator
- [ ] "Saving... Don't turn off power" message
- [ ] Success confirmation

### 8.3 Save Preview
- [ ] Show current save info before overwriting
- [ ] Player name, map, playtime, badges

---

## Phase 9: Polish & Integration

### 9.1 Responsive Testing
- [ ] Test at various viewport sizes
- [ ] Mobile-friendly touch targets
- [ ] Landscape/portrait handling

### 9.2 Accessibility
- [ ] Focus management
- [ ] ARIA labels for screen readers
- [ ] Keyboard-only navigation test
- [ ] Reduced motion support

### 9.3 Performance
- [ ] Lazy load menu components
- [ ] Optimize sprite sheets
- [ ] Minimize re-renders

### 9.4 Integration
- [ ] Pause game loop while menu open
- [ ] Prevent player movement
- [ ] Handle edge cases (menu during warp, etc.)

---

## Asset Extraction

### Sprites to Extract
- [ ] `graphics/party_menu/pokeball.png` → menu icon
- [ ] `graphics/bag/bag_male.png` → bag icon (crop)
- [ ] `graphics/bag/bag_female.png` → bag icon variant
- [ ] `graphics/trainer_card/badges.png` → 8 badges
- [ ] `graphics/trainer_card/tiles.png` → card background
- [ ] `graphics/interface/status_icons.png` → status conditions
- [ ] `graphics/items/icons/*.png` → all item icons

### Fonts
- [ ] Find/create GBA Pokemon font
- [ ] Convert to WOFF2 format
- [ ] Add to `/public/fonts/`
- [ ] CSS @font-face declaration

---

## Progress Summary

| Phase | Status | Items |
|-------|--------|-------|
| 1. Core Infrastructure | Partial | ~10/26 |
| 2. Start Menu | Complete | 24/24 |
| 3. Trainer Card | Not Started | 0/23 |
| 4. Bag Menu | Complete | 28/28 |
| 4.5 Pokemon Data | **Complete** | **17/20** |
| 5. Party Menu | Not Started | 0/22 |
| 6. Summary Screen | Not Started | 0/19 |
| 7. Options Menu | Not Started | 0/8 |
| 8. Save Menu | Not Started | 0/7 |
| 9. Polish | Not Started | 0/10 |
| Assets | Partial | ~5/10 |
| **Total** | **~45%** | **~84/197** |

---

## Quick Start

To begin implementation:
1. Start with Phase 1 (Core Infrastructure)
2. Add Menu button to GamePage header (next to Save/Load)
3. Create MenuStateManager
4. Build StartMenu component as 2x3 grid
5. Wire up keyboard/mouse input

The menu should be accessible via:
- Click "Menu" button in header (when in OVERWORLD)
- Press Enter/Start key (when in OVERWORLD)
- NOT accessible during: title, intro, battle, dialog, transitions
