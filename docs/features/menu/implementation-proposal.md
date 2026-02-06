---
title: Menu System Implementation Proposal
status: planned
last_verified: 2026-01-13
---

# Menu System Implementation Proposal

A modern, keyboard and mouse controlled menu system with smooth animations for the Pokemon Emerald browser recreation.

## Design Goals

1. **Dual Input** - Full keyboard AND mouse support
2. **Smooth Animations** - CSS transitions and requestAnimationFrame
3. **GBA Authenticity** - Match original look/feel while enhancing UX
4. **Responsive** - Scales with viewport, works on all screen sizes
5. **Overlay Design** - Menu overlays the map, doesn't replace it
6. **Accessibility** - Keyboard navigation, focus management
7. **Mobile Ready** - Touch support for future

---

## Start Menu: 2x3 Grid Overlay

Instead of the original vertical list, we use a **2x3 icon grid** that overlays the map with a semi-transparent backdrop.

### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [MAP VISIBLE BEHIND, SLIGHTLY DIMMED]                     │
│                                                             │
│         ┌─────────────────────────────────────┐             │
│         │  ┌─────────┐    ┌─────────┐         │             │
│         │  │  📖     │    │  🐾     │         │             │
│         │  │ POKéDEX │    │ POKéMON │         │             │
│         │  └─────────┘    └─────────┘         │             │
│         │  ┌─────────┐    ┌─────────┐         │             │
│         │  │  🎒     │    │  💳     │         │             │
│         │  │   BAG   │    │ {NAME}  │         │             │
│         │  └─────────┘    └─────────┘         │             │
│         │  ┌─────────┐    ┌─────────┐         │             │
│         │  │  💾     │    │  ⚙️     │         │             │
│         │  │  SAVE   │    │ OPTION  │         │             │
│         │  └─────────┘    └─────────┘         │             │
│         └─────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Grid Navigation

```
┌───┬───┐
│ 0 │ 1 │  ← POKéDEX / POKéMON
├───┼───┤
│ 2 │ 3 │  ← BAG / TRAINER CARD
├───┼───┤
│ 4 │ 5 │  ← SAVE / OPTIONS
└───┴───┘

Navigation:
- Arrow keys move in grid (←→↑↓)
- Wraps horizontally within row
- Wraps vertically at top/bottom
- Enter/X = Select, Escape/Z = Close
- Click any tile to select
- Hover shows highlight
```

### Responsive Sizing

```css
.start-menu-overlay {
  /* Center in viewport */
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  /* Semi-transparent backdrop */
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.start-menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: clamp(8px, 2vw, 16px);
  padding: clamp(16px, 4vw, 32px);

  /* GBA-style window */
  background: var(--window-bg);
  border: 4px solid var(--window-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);

  /* Responsive max size */
  max-width: min(400px, 90vw);
}

.menu-tile {
  /* Square tiles */
  aspect-ratio: 1;
  width: clamp(64px, 15vw, 96px);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  /* GBA style */
  background: var(--tile-bg);
  border: 2px solid var(--tile-border);
  border-radius: 4px;
  cursor: pointer;

  /* Font */
  font-family: 'Pokemon Emerald', monospace;
  font-size: clamp(10px, 2vw, 14px);
  text-transform: uppercase;
}

.menu-tile-icon {
  width: clamp(24px, 6vw, 40px);
  height: clamp(24px, 6vw, 40px);
  image-rendering: pixelated;
}
```

### Tile States

```css
/* Hover state */
.menu-tile:hover {
  background: var(--tile-hover);
  transform: scale(1.02);
}

/* Selected/focused state */
.menu-tile.selected {
  background: var(--tile-selected);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color);
  animation: pulse 1s ease-in-out infinite;
}

/* Disabled state (e.g., no Pokedex yet) */
.menu-tile.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

/* Hidden (not unlocked) */
.menu-tile.hidden {
  display: none;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 2px var(--accent-color); }
  50% { box-shadow: 0 0 0 4px var(--accent-color-faded); }
}
```

### GBA Font Integration

```css
@font-face {
  font-family: 'Pokemon Emerald';
  src: url('/fonts/pokemon-emerald.woff2') format('woff2');
  font-display: swap;
}

:root {
  /* GBA color palette */
  --window-bg: #3890f8;
  --window-border: #f8f8f8;
  --tile-bg: #f8f8f8;
  --tile-border: #a8a8a8;
  --tile-hover: #e8e8e8;
  --tile-selected: #d0e8ff;
  --accent-color: #f83800;
  --accent-color-faded: rgba(248, 56, 0, 0.3);
  --text-color: #383838;
  --text-shadow: #d8d8d8;
}
```

### Animation Timing

```css
/* Menu open */
.start-menu-overlay {
  animation: fade-in 150ms ease-out;
}

.start-menu-grid {
  animation: scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Menu close */
.start-menu-overlay.closing {
  animation: fade-out 100ms ease-in forwards;
}

.start-menu-overlay.closing .start-menu-grid {
  animation: scale-out 100ms ease-in forwards;
}

/* Tile selection change */
.menu-tile {
  transition: transform 100ms ease-out,
              background 100ms ease-out,
              border-color 100ms ease-out,
              box-shadow 100ms ease-out;
}
```

### Menu Tile Icons

Custom pixel-art icons in GBA style (32x32 or 48x48):

| Tile | Icon | Source/Create |
|------|------|---------------|
| POKéDEX | Red Pokedex device | Extract from `graphics/pokedex/` |
| POKéMON | Poke Ball or party icon | Extract from `graphics/party_menu/pokeball.png` |
| BAG | Backpack | Extract from `graphics/bag/bag_male.png` |
| TRAINER CARD | ID card | Extract from trainer card tiles |
| SAVE | Floppy disk / save icon | Create new (GBA style) |
| OPTIONS | Gear / wrench | Create new (GBA style) |

### Icon Sprite Sheet

```typescript
// Menu icons as single sprite sheet for efficient loading
const MENU_ICONS = {
  pokedex: { x: 0, y: 0 },
  pokemon: { x: 32, y: 0 },
  bag: { x: 64, y: 0 },
  trainerCard: { x: 96, y: 0 },
  save: { x: 128, y: 0 },
  options: { x: 160, y: 0 },
};

// Render with CSS background-position
.menu-tile-icon {
  background-image: url('/sprites/menu-icons.png');
  background-size: 192px 32px;
  image-rendering: pixelated;
}

.menu-tile-icon.pokedex { background-position: 0 0; }
.menu-tile-icon.pokemon { background-position: -32px 0; }
.menu-tile-icon.bag { background-position: -64px 0; }
// etc.
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MenuStateManager                        │
│  (Central controller for all menu state and transitions)     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  StartMenu    │    │   BagMenu     │    │  PartyMenu    │
│  Component    │    │  Component    │    │  Component    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌───────────────────┐
                    │  MenuRenderer     │
                    │  (Canvas/React)   │
                    └───────────────────┘
```

## Core Types

```typescript
// Menu item definition
interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  visible: boolean | (() => boolean);
  enabled: boolean | (() => boolean);
  onSelect: () => void | Promise<void>;
  onHover?: () => void;
}

// Menu state
interface MenuState {
  isOpen: boolean;
  currentMenu: MenuType | null;
  cursorIndex: number;
  scrollOffset: number;
  history: MenuType[];  // For back navigation
}

// Menu types
type MenuType =
  | 'start'
  | 'bag'
  | 'party'
  | 'pokedex'
  | 'trainerCard'
  | 'save'
  | 'options';
```

---

## 1. Start Menu

### Visual Design

```
┌──────────────┐
│ ▶ POKéDEX    │  <- Visible if FLAG_SYS_POKEDEX_GET
│   POKéMON    │  <- Visible if FLAG_SYS_POKEMON_GET
│   BAG        │  <- Always visible
│   {PLAYER}   │  <- Player name, opens Trainer Card
│   SAVE       │
│   OPTION     │
│   EXIT       │
└──────────────┘
```

### Implementation

```typescript
interface StartMenuConfig {
  items: StartMenuItem[];
  position: 'top-right' | 'center';
  width: number;
  maxVisibleItems: number;
}

const START_MENU_ITEMS: StartMenuItem[] = [
  {
    id: 'pokedex',
    label: 'POKéDEX',
    visible: () => gameFlags.isSet('FLAG_SYS_POKEDEX_GET'),
    onSelect: () => menuManager.open('pokedex'),
  },
  {
    id: 'pokemon',
    label: 'POKéMON',
    visible: () => gameFlags.isSet('FLAG_SYS_POKEMON_GET'),
    onSelect: () => menuManager.open('party'),
  },
  {
    id: 'bag',
    label: 'BAG',
    visible: true,
    onSelect: () => menuManager.open('bag'),
  },
  {
    id: 'player',
    label: () => saveManager.getPlayerName(),  // Dynamic
    visible: true,
    onSelect: () => menuManager.open('trainerCard'),
  },
  {
    id: 'save',
    label: 'SAVE',
    visible: true,
    onSelect: () => menuManager.open('save'),
  },
  {
    id: 'option',
    label: 'OPTION',
    visible: true,
    onSelect: () => menuManager.open('options'),
  },
  {
    id: 'exit',
    label: 'EXIT',
    visible: true,
    onSelect: () => menuManager.close(),
  },
];
```

### Animation

```css
/* Menu open animation */
.start-menu {
  transform-origin: top right;
  animation: menu-open 150ms ease-out;
}

@keyframes menu-open {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Cursor slide animation */
.menu-cursor {
  transition: top 100ms ease-out;
}

/* Item hover effect */
.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-item.selected {
  background: rgba(255, 255, 255, 0.2);
}
```

---

## 2. Input System

### Keyboard Controls

| Key | Action |
|-----|--------|
| `Enter` / `X` | Start menu / Confirm |
| `Escape` / `Z` | Back / Cancel |
| `↑` / `W` | Move cursor up |
| `↓` / `S` | Move cursor down |
| `←` / `A` | Previous tab/pocket |
| `→` / `D` | Next tab/pocket |
| `Q` | Quick L button action |
| `E` | Quick R button action |

### Mouse Controls

| Action | Behavior |
|--------|----------|
| Hover | Highlight item, show tooltip |
| Click | Select item |
| Right-click | Back / Cancel |
| Scroll | Scroll list |

### Implementation

```typescript
class MenuInputHandler {
  private keyMap = new Map<string, () => void>();

  constructor(private menu: MenuComponent) {
    this.setupKeyBindings();
    this.setupMouseHandlers();
  }

  private setupKeyBindings() {
    // Navigation
    this.keyMap.set('ArrowUp', () => this.menu.moveCursor(-1));
    this.keyMap.set('ArrowDown', () => this.menu.moveCursor(1));
    this.keyMap.set('KeyW', () => this.menu.moveCursor(-1));
    this.keyMap.set('KeyS', () => this.menu.moveCursor(1));

    // Selection
    this.keyMap.set('Enter', () => this.menu.confirmSelection());
    this.keyMap.set('KeyX', () => this.menu.confirmSelection());

    // Cancel
    this.keyMap.set('Escape', () => this.menu.cancel());
    this.keyMap.set('KeyZ', () => this.menu.cancel());

    // Tab switching (Bag pockets, Summary pages)
    this.keyMap.set('ArrowLeft', () => this.menu.previousTab());
    this.keyMap.set('ArrowRight', () => this.menu.nextTab());
    this.keyMap.set('KeyQ', () => this.menu.previousTab());
    this.keyMap.set('KeyE', () => this.menu.nextTab());
  }

  handleKeyDown(e: KeyboardEvent) {
    const handler = this.keyMap.get(e.code);
    if (handler) {
      e.preventDefault();
      playSound('SE_SELECT');
      handler();
    }
  }

  handleMouseMove(e: MouseEvent, items: MenuItem[]) {
    const hoveredIndex = this.getItemIndexFromPosition(e.clientY);
    if (hoveredIndex !== this.menu.cursorIndex) {
      this.menu.setCursor(hoveredIndex);
    }
  }

  handleClick(e: MouseEvent) {
    playSound('SE_SELECT');
    this.menu.confirmSelection();
  }

  handleRightClick(e: MouseEvent) {
    e.preventDefault();
    playSound('SE_SELECT');
    this.menu.cancel();
  }
}
```

---

## 3. Bag Menu

### Visual Design

```
┌──────────────────────────────────────────────────┐
│  ◀ ITEMS ▶        ┌─────────────────────────────┐│
│                   │ [ICON] POTION         x5    ││
│  ┌─────────┐      │ [ICON] SUPER POTION   x3    ││
│  │   BAG   │      │ [ICON] ANTIDOTE       x2    ││
│  │  IMAGE  │      │ [ICON] PARALYZE HEAL  x1    ││
│  │         │      │ [ICON] REPEL          x10   ││
│  └─────────┘      │ ▶[ICON] ESCAPE ROPE   x2    ││
│                   │ [ICON] REVIVE         x1    ││
│  ¥12,500          └─────────────────────────────┘│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │ A handy spray medicine. It restores the HP  ││
│  │ of one POKéMON by 20 points.                ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### Pocket Tabs

```typescript
const BAG_POCKETS = [
  { id: 'items', label: 'ITEMS', icon: 'pocket-items' },
  { id: 'keyItems', label: 'KEY ITEMS', icon: 'pocket-key' },
  { id: 'pokeBalls', label: 'POKé BALLS', icon: 'pocket-balls' },
  { id: 'tmHm', label: 'TMs & HMs', icon: 'pocket-tm' },
  { id: 'berries', label: 'BERRIES', icon: 'pocket-berry' },
];

interface BagMenuState {
  currentPocket: number;
  cursorPosition: number[];  // Per-pocket cursor
  scrollPosition: number[];  // Per-pocket scroll
  selectedItem: number | null;  // For context menu
}
```

### Context Menu

```typescript
const CONTEXT_ACTIONS = {
  items: ['USE', 'GIVE', 'TOSS', 'CANCEL'],
  keyItems: ['USE', 'REGISTER', '', 'CANCEL'],
  pokeBalls: ['GIVE', '', 'TOSS', 'CANCEL'],
  tmHm: ['USE', 'GIVE', '', 'CANCEL'],
  berries: ['CHECK', 'GIVE', 'TOSS', 'CANCEL'],
};
```

### Animations

```css
/* Pocket switch animation */
.bag-pocket-container {
  transition: transform 200ms ease-out;
}

.bag-pocket-container.switching-left {
  animation: slide-out-left 150ms ease-out,
             slide-in-right 150ms ease-out 150ms;
}

/* Item list scroll */
.item-list {
  scroll-behavior: smooth;
}

/* Item selection highlight */
.item-row.selected {
  background: linear-gradient(90deg,
    rgba(64, 128, 255, 0.3) 0%,
    rgba(64, 128, 255, 0.1) 100%
  );
  animation: pulse-highlight 1s ease-in-out infinite;
}

/* Context menu pop */
.context-menu {
  animation: pop-in 100ms ease-out;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

---

## 4. Party Menu

### Visual Design

```
┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────┐  ┌──────────────────┐  │
│ │ [SPRITE]                │  │ [SPRITE]         │  │
│ │ BLAZIKEN     Lv.58  ♂   │  │ SWAMPERT  Lv.55  │  │
│ │ ████████████████░░ 178  │  │ ██████████░░ 156 │  │
│ │                   /178  │  │            /180  │  │
│ └─────────────────────────┘  └──────────────────┘  │
│ ┌──────────────────┐  ┌──────────────────┐         │
│ │ GARDEVOIR Lv.54  │  │ FLYGON    Lv.52  │         │
│ │ ██████████░░ 145 │  │ █████████░░░ 138 │         │
│ └──────────────────┘  └──────────────────┘         │
│ ┌──────────────────┐  ┌──────────────────┐         │
│ │ AGGRON    Lv.51  │  │ [Empty Slot]     │         │
│ │ ████████░░░░ 167 │  │                  │         │
│ └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### Slot Component

```typescript
interface PartySlot {
  pokemon: Pokemon | null;
  isSelected: boolean;
  isSwapTarget: boolean;
  isFainted: boolean;
}

const PartySlotComponent: React.FC<PartySlot> = ({
  pokemon, isSelected, isSwapTarget, isFainted
}) => {
  if (!pokemon) {
    return <div className="party-slot empty" />;
  }

  const hpPercent = (pokemon.currentHP / pokemon.maxHP) * 100;
  const hpColor = hpPercent > 50 ? 'green'
                : hpPercent > 20 ? 'yellow'
                : 'red';

  return (
    <div className={cn('party-slot', {
      selected: isSelected,
      'swap-target': isSwapTarget,
      fainted: isFainted,
    })}>
      <PokemonIcon species={pokemon.species} />
      <div className="info">
        <span className="name">{pokemon.nickname}</span>
        <span className="level">Lv.{pokemon.level}</span>
        <GenderIcon gender={pokemon.gender} />
        <HPBar current={pokemon.currentHP} max={pokemon.maxHP} />
        <StatusIcon status={pokemon.status} />
        {pokemon.heldItem && <ItemIcon item={pokemon.heldItem} />}
      </div>
    </div>
  );
};
```

### HP Bar Animation

```typescript
const HPBar: React.FC<{ current: number; max: number }> = ({
  current, max
}) => {
  const percent = (current / max) * 100;
  const color = percent > 50 ? '#00ff00'
              : percent > 20 ? '#ffff00'
              : '#ff0000';

  return (
    <div className="hp-bar-container">
      <div
        className="hp-bar-fill"
        style={{
          width: `${percent}%`,
          backgroundColor: color,
          transition: 'width 300ms ease-out, background-color 300ms',
        }}
      />
      <span className="hp-text">{current}/{max}</span>
    </div>
  );
};
```

### Grid Navigation

```typescript
// 2-column grid navigation
function handlePartyNavigation(direction: Direction, currentIndex: number): number {
  const COLS = 2;
  const ROWS = 3;

  switch (direction) {
    case 'up':
      return currentIndex >= COLS ? currentIndex - COLS : currentIndex;
    case 'down':
      return currentIndex + COLS < partySize ? currentIndex + COLS : currentIndex;
    case 'left':
      return currentIndex % COLS > 0 ? currentIndex - 1 : currentIndex;
    case 'right':
      return currentIndex % COLS < COLS - 1 && currentIndex + 1 < partySize
        ? currentIndex + 1 : currentIndex;
  }
}
```

---

## 5. Trainer Card

### Visual Design

```
FRONT:
┌─────────────────────────────────────────┐
│                                         │
│   ┌─────────┐     NAME: BRENDAN         │
│   │ TRAINER │     IDNo. 32267           │
│   │  SPRITE │                           │
│   │         │     MONEY    ¥3,068       │
│   └─────────┘     POKéDEX    120        │
│                   TIME   24:36          │
│                                         │
│   ★ ★ ★ ☆          [B1][B2][B3][B4]    │
│                    [B5][B6][B7][B8]     │
└─────────────────────────────────────────┘

BACK:
┌─────────────────────────────────────────┐
│                                         │
│         BRENDAN's TRAINER CARD          │
│                                         │
│   HOF DEBUT       12:34:56              │
│   LINK BATTLES    45 / 12               │
│   POKéMON TRADES  23                    │
│   BATTLE POINTS   128                   │
│                                         │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

### Card Flip Animation

```css
.trainer-card-container {
  perspective: 1000px;
}

.trainer-card {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 400ms ease-in-out;
}

.trainer-card.flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
}
```

### Star Colors (CSS Custom Properties)

```css
.trainer-card {
  --card-color: var(--card-green);
}

.trainer-card[data-stars="1"] { --card-color: var(--card-bronze); }
.trainer-card[data-stars="2"] { --card-color: var(--card-copper); }
.trainer-card[data-stars="3"] { --card-color: var(--card-silver); }
.trainer-card[data-stars="4"] { --card-color: var(--card-gold); }

:root {
  --card-green: linear-gradient(135deg, #2d5a27 0%, #4a8f3c 100%);
  --card-bronze: linear-gradient(135deg, #8b4513 0%, #cd853f 100%);
  --card-copper: linear-gradient(135deg, #b87333 0%, #da8a67 100%);
  --card-silver: linear-gradient(135deg, #708090 0%, #c0c0c0 100%);
  --card-gold: linear-gradient(135deg, #b8860b 0%, #ffd700 100%);
}
```

### Blinking Colon

```css
.time-colon {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

---

## 6. Sound Effects

```typescript
const MENU_SOUNDS = {
  SE_SELECT: 'select.mp3',      // Cursor move / confirm
  SE_CANCEL: 'cancel.mp3',      // Back / cancel
  SE_SAVE: 'save.mp3',          // Save complete
  SE_ERROR: 'error.mp3',        // Invalid action
  SE_POKEMON_CRY: (species: number) => `cries/${species}.mp3`,
};

function playSound(sound: keyof typeof MENU_SOUNDS) {
  const audio = new Audio(`/sounds/${MENU_SOUNDS[sound]}`);
  audio.volume = gameOptions.soundVolume;
  audio.play().catch(() => {}); // Ignore autoplay restrictions
}
```

---

## 7. File Structure

```
src/
├── menu/
│   ├── MenuStateManager.ts      # Central state management
│   ├── MenuInputHandler.ts      # Keyboard/mouse handling
│   ├── components/
│   │   ├── StartMenu.tsx
│   │   ├── BagMenu.tsx
│   │   ├── PartyMenu.tsx
│   │   ├── TrainerCard.tsx
│   │   ├── SaveMenu.tsx
│   │   ├── OptionsMenu.tsx
│   │   └── shared/
│   │       ├── MenuWindow.tsx    # Reusable window frame
│   │       ├── MenuCursor.tsx    # Animated cursor
│   │       ├── ItemSlot.tsx      # Item display
│   │       ├── HPBar.tsx         # HP bar component
│   │       └── PokemonIcon.tsx   # Species icon
│   ├── hooks/
│   │   ├── useMenuInput.ts
│   │   ├── useMenuAnimation.ts
│   │   └── useMenuNavigation.ts
│   ├── styles/
│   │   ├── menu-base.css
│   │   ├── start-menu.css
│   │   ├── bag-menu.css
│   │   ├── party-menu.css
│   │   └── trainer-card.css
│   └── types.ts
```

---

## 8. Implementation Order

### Phase 1: Core Infrastructure
1. MenuStateManager with open/close/back
2. MenuInputHandler for keyboard/mouse
3. MenuWindow reusable component
4. Basic StartMenu with cursor

### Phase 2: Start Menu Complete
1. All menu items with visibility logic
2. Cursor animations
3. Menu open/close animations
4. Sound effects integration

### Phase 3: Trainer Card
1. Front card display
2. Back card display
3. CSS 3D flip animation
4. Star color system
5. Badge display

### Phase 4: Bag Menu
1. Pocket tab system
2. Item list with scroll
3. Context menu (USE/GIVE/TOSS)
4. Per-pocket state persistence
5. Item descriptions

### Phase 5: Party Menu
1. 6-slot grid layout
2. Pokemon data display
3. HP bar with colors
4. Status icons
5. Swap functionality

### Phase 6: Summary Screen
1. Page navigation (INFO/SKILLS/MOVES)
2. Move display with PP
3. EXP bar
4. Stats display

---

## 9. Nice-to-Have Enhancements

- **Gamepad support** - Standard Gamepad API
- **Touch gestures** - Swipe for tabs, tap for select
- **Reduced motion** - Respect `prefers-reduced-motion`
- **Keyboard shortcuts** - Number keys for quick pocket switch
- **Search** - Filter items in bag by name
- **Sort** - Sort items by name/type/quantity
