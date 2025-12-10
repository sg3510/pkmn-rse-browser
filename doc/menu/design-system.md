# Menu Design System

## Core Principles

1. **One Container Size** - All menus use the same fixed container
2. **Pixel-Perfect** - All sizes are multiples of 8 (tile-aligned)
3. **Consistent Typography** - Only 3 font sizes
4. **Full Navigation** - Keyboard AND mouse for everything
5. **Map Visibility** - Overlay shows game world behind

---

## Container & Zoom - Two Separate Concerns

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   VIEWPORT (screen space)  →  Container SIZE (width × height)   │
│   ZOOM (user preference)   →  Content SCALE (text, icons)       │
│                                                                  │
│   These are INDEPENDENT. You can have:                          │
│   • Small viewport + high zoom = small box, large content       │
│   • Large viewport + low zoom = big box, small content          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Container Size (determined by VIEWPORT)

Container takes ~90% of viewport, leaving map visible at edges.
**Switching menus does NOT change container size.**

```
┌─────────────────────────────────────────────────────────┐
│                      VIEWPORT                            │
│                   (any size)                             │
│                                                          │
│   ┌───────────────────────────────────────────────┐     │
│   │              MENU CONTAINER                    │     │
│   │            ~90% of viewport                    │     │
│   │         (rounded to nearest 8px)              │     │
│   │                                                │     │
│   │   Party, Bag, Summary = SAME size             │     │
│   │                                                │     │
│   └───────────────────────────────────────────────┘     │
│                                                          │
│            ↑ Map visible at edges ↑                     │
└─────────────────────────────────────────────────────────┘
```

### Content Scale (determined by ZOOM)

Zoom affects the size of text, icons, and sprites WITHIN the container.

| Zoom | Base Font | Pokemon Icon | Item Icon | HP Bar |
|------|-----------|--------------|-----------|--------|
| 1x | 8px | 32×32 | 24×24 | 48×8 |
| 2x | 16px | 64×64 | 48×48 | 96×16 |
| 3x | 24px | 96×96 | 72×72 | 144×24 |

### Implementation

```typescript
// Container size from viewport (CSS handles this)
// Content scale from zoom (applied via CSS variable or transform)

interface MenuConfig {
  // From viewport - how much space we have
  containerWidth: number;   // ~90% of viewport.width, tile-aligned
  containerHeight: number;  // ~90% of viewport.height, tile-aligned

  // From user setting - how big content appears
  zoom: number;             // 1, 2, or 3
}
```

### CSS Variables

```css
:root {
  /* ===== CONTAINER (viewport-dependent) ===== */
  --menu-padding: 8px;
  --menu-border: 4px;
  --menu-radius: 8px;
  --overlay-bg: rgba(0, 0, 0, 0.5);
  --menu-bg: rgba(32, 96, 184, 0.95);
  --menu-border-color: #f8f8f8;

  /* ===== ZOOM (user preference, set via JS) ===== */
  --zoom: 1;  /* 1, 2, or 3 */

  /* ===== BASE SIZES (at 1x zoom) ===== */
  --font-sm-base: 8px;
  --font-md-base: 10px;
  --font-lg-base: 12px;

  --icon-pokemon-base: 32px;
  --icon-item-base: 24px;
  --icon-tab-base: 24px;
  --icon-small-base: 16px;

  --bar-width-base: 48px;
  --bar-height-base: 8px;

  /* ===== COMPUTED SIZES (base × zoom) ===== */
  --font-sm: calc(var(--font-sm-base) * var(--zoom));
  --font-md: calc(var(--font-md-base) * var(--zoom));
  --font-lg: calc(var(--font-lg-base) * var(--zoom));

  --icon-pokemon: calc(var(--icon-pokemon-base) * var(--zoom));
  --icon-item: calc(var(--icon-item-base) * var(--zoom));
  --icon-tab: calc(var(--icon-tab-base) * var(--zoom));

  --bar-width: calc(var(--bar-width-base) * var(--zoom));
  --bar-height: calc(var(--bar-height-base) * var(--zoom));
}

.menu-container {
  /* Size from viewport */
  width: min(90%, calc(100vw - 32px));
  height: min(90%, calc(100vh - 32px));

  /* Round to 8px grid (handled by JS setting max-width/height) */
}

/* Content uses zoom-scaled variables */
.pokemon-icon {
  width: var(--icon-pokemon);
  height: var(--icon-pokemon);
}

.item-name {
  font-size: var(--font-md);
}
```

### What Viewport Affects

| Larger Viewport | Result |
|-----------------|--------|
| More width | More items per row, wider descriptions |
| More height | More visible list items, less scrolling |

### What Zoom Affects

| Higher Zoom | Result |
|-------------|--------|
| Larger text | Easier to read |
| Larger icons | Clearer sprites |
| Fewer items fit | More scrolling needed |

---

## Typography

**Only 3 font sizes. Pick one and use it.**

| Name | Size | Line Height | Use Case |
|------|------|-------------|----------|
| `--font-sm` | 8px | 12px | Labels, hints, secondary info |
| `--font-md` | 10px | 14px | **Primary text**, names, values |
| `--font-lg` | 12px | 16px | Headers, titles, important |

```css
:root {
  --font-family: 'Pokemon GB', 'Pokemon Emerald', monospace;

  --font-sm: 8px;
  --font-md: 10px;
  --font-lg: 12px;

  --line-sm: 12px;
  --line-md: 14px;
  --line-lg: 16px;
}

/* Usage */
.label { font-size: var(--font-sm); }
.text { font-size: var(--font-md); }
.title { font-size: var(--font-lg); }
```

### Text Colors

```css
:root {
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-muted: rgba(255, 255, 255, 0.5);
  --text-highlight: #f8d030;    /* Yellow for money, quantities */
  --text-shadow: 1px 1px 0 #000;
}
```

---

## Spacing System

**All spacing is multiples of 4px (half-tile).**

```css
:root {
  --space-1: 4px;    /* Tight */
  --space-2: 8px;    /* Normal (1 tile) */
  --space-3: 12px;   /* Comfortable */
  --space-4: 16px;   /* Spacious (2 tiles) */
}
```

---

## Component Sizes

### Icons

| Type | Size | Notes |
|------|------|-------|
| Pokemon Icon | 32 × 32 | Party slots, boxes |
| Item Icon | 24 × 24 | Bag items |
| Tab Icon | 24 × 24 | Pocket tabs (scaled from 26px source) |
| Small Icon | 16 × 16 | Status, indicators |
| Tiny Icon | 8 × 8 | Held item dot, badges |

```css
:root {
  --icon-pokemon: 32px;
  --icon-item: 24px;
  --icon-tab: 24px;
  --icon-small: 16px;
  --icon-tiny: 8px;
}
```

### HP/EXP Bars

```css
:root {
  --bar-width: 48px;     /* 6 tiles */
  --bar-height: 8px;     /* 1 tile */
  --bar-height-sm: 4px;  /* Half tile for EXP */
}
```

### Buttons & Interactive Elements

```css
:root {
  --btn-height: 24px;    /* 3 tiles */
  --btn-padding: 8px;
  --cursor-size: 16px;
}
```

---

## Navigation System

### Keyboard Controls (ALL menus)

| Key | Action | Context |
|-----|--------|---------|
| **↑ / ↓** | Move cursor up/down | Lists, grids |
| **← / →** | Switch tab/page OR move cursor | Tabs, pages, 2D grids |
| **A / Enter / Space** | Confirm/Select | All |
| **B / Escape / Backspace** | Back/Cancel | All |
| **Start** | Close all menus | Return to game |
| **L / R** | Quick tab switch | Bag pockets |

### Mouse Controls (ALL menus)

| Action | Result |
|--------|--------|
| **Click item** | Select + Confirm (single click) |
| **Hover item** | Highlight/Preview |
| **Click overlay** | Back (same as B) |
| **Click back button** | Back (same as B) |
| **Scroll wheel** | Scroll list (if scrollable) |

### Focus & Selection States

```css
/* Hover - mouse over */
.item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Selected - keyboard cursor position */
.item.selected {
  background: rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}

/* Active - being pressed/activated */
.item:active,
.item.active {
  background: rgba(255, 255, 255, 0.3);
}
```

---

## Menu Layouts

All menus share the SAME container (responsive to viewport). Layouts below show minimum size.
As viewport grows, content gets more space but layout structure stays the same.

### Start Menu (Small Popup)

```
┌────────────────┐
│ POKéDEX        │  8 items max
│ POKéMON        │  Each row: 24px height
│ BAG            │  Total: ~192px height
│ TRAINER CARD   │  Width: 96px
│ SAVE           │
│ OPTION         │  Position: bottom-right
│ EXIT           │  of viewport
└────────────────┘
```

### Party Menu (6 Pokémon Grid)

```
┌─────────────────────────────────────┐
│ ← BACK                    POKéMON  │  Header: 24px
├─────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ │
│ │[32x32] NAME   │ │[32x32] NAME   │ │  Slot: 48px height
│ │ Lv.XX ════════│ │ Lv.XX ════════│ │  Icon: 32x32
│ └───────────────┘ └───────────────┘ │  HP bar: 48x8
│ ┌───────────────┐ ┌───────────────┐ │
│ │[32x32] NAME   │ │[32x32] NAME   │ │  Grid: 2 cols × 3 rows
│ │ Lv.XX ════════│ │ Lv.XX ════════│ │
│ └───────────────┘ └───────────────┘ │
│ ┌───────────────┐ ┌───────────────┐ │
│ │[32x32] NAME   │ │[32x32] NAME   │ │
│ │ Lv.XX ════════│ │ Lv.XX ════════│ │
│ └───────────────┘ └───────────────┘ │
├─────────────────────────────────────┤
│ ↑↓ Select  A: Summary  B: Back     │  Footer: 16px
└─────────────────────────────────────┘
  232px × 160px
```

### Bag Menu

```
┌─────────────────────────────────────┐
│ ← BACK                        BAG  │  Header: 24px
├──────────┬──────────────────────────┤
│          │ [24][24][24][24][24]     │  Tabs: 32px (24px icons)
│   BAG    ├──────────────────────────┤
│  IMAGE   │ [24] Item Name     ×99   │  Item row: 28px
│  64×64   │ [24] Item Name     ×99   │  Icon: 24x24
│          │ [24] Item Name     ×99   │  4-5 visible items
│          │ [24] Item Name     ×99   │
│  ITEMS   │                     ▼    │
├──────────┴──────────────────────────┤
│ Item description here...    ¥99,999 │  Footer: 24px
├─────────────────────────────────────┤
│ ←→ Pocket  ↑↓ Select  B: Back      │  Hints: 16px
└─────────────────────────────────────┘
  232px × 160px
```

### Pokemon Summary

```
┌─────────────────────────────────────┐
│ ← BACK     [INFO][STATS][MOVES]    │  Header + tabs: 24px
├─────────────────────────────────────┤
│ BULBASAUR ♂              Lv.15     │  Identity: 20px
│ GRASS  POISON                       │  Types: 16px
├──────────┬──────────────────────────┤
│          │ OT: RED                  │
│  SPRITE  │ ID No: 12345             │  Content area
│  64×64   │ Nature: HARDY            │  ~80px height
│          │ Ability: OVERGROW        │
│          │ Held: NONE               │
├──────────┴──────────────────────────┤
│     ●  ○  ○                         │  Page dots: 12px
├─────────────────────────────────────┤
│ ←→ Page  B: Back                   │  Hints: 16px
└─────────────────────────────────────┘
  232px × 160px
```

---

## Color Palette

```css
:root {
  /* Backgrounds */
  --bg-menu: linear-gradient(180deg, #3890f8 0%, #2060b8 100%);
  --bg-dark: rgba(0, 0, 0, 0.25);
  --bg-darker: rgba(0, 0, 0, 0.4);

  /* Interactive */
  --bg-hover: rgba(255, 255, 255, 0.1);
  --bg-selected: rgba(255, 255, 255, 0.2);
  --bg-active: rgba(255, 255, 255, 0.3);

  /* Borders */
  --border-light: rgba(255, 255, 255, 0.3);
  --border-solid: #f8f8f8;

  /* HP Bar Colors */
  --hp-green: #10d010;
  --hp-yellow: #f8c000;
  --hp-red: #f85888;

  /* Type Colors */
  --type-normal: #a8a878;
  --type-fire: #f08030;
  --type-water: #6890f0;
  --type-grass: #78c850;
  --type-electric: #f8d030;
  /* ... etc */

  /* Gender */
  --gender-male: #6890f0;
  --gender-female: #f85888;
}
```

---

## Implementation Checklist

### Phase 1: CSS Foundation
- [ ] Create `src/menu/styles/design-system.css` with all variables
- [ ] Import design system in all menu CSS files
- [ ] Remove all hardcoded px values, use variables

### Phase 2: Container Unification
- [ ] Update `menu-overlay.css` to use 232×160 container
- [ ] Update all menu content components to fit 216×144
- [ ] Ensure consistent header/footer across all menus

### Phase 3: Typography Cleanup
- [ ] Audit all font-size declarations
- [ ] Replace with `--font-sm`, `--font-md`, `--font-lg`
- [ ] Fix line heights

### Phase 4: Component Sizing
- [ ] Update PartySlot to use 32×32 icons, 48×8 HP bars
- [ ] Update BagMenu item rows to use 24×24 icons
- [ ] Update all icon sizes to match spec

### Phase 5: Navigation Polish
- [ ] Ensure keyboard nav works in all menus
- [ ] Add hover states to all interactive elements
- [ ] Add click handlers to all items
- [ ] Test tab/escape/enter behavior

### Phase 6: Testing
- [ ] Test at 1x, 2x, 3x zoom
- [ ] Test on retina display
- [ ] Test full keyboard navigation flow
- [ ] Test mouse-only navigation flow

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ MENU DESIGN SYSTEM - QUICK REFERENCE                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ TWO INDEPENDENT CONTROLS:                               │
│   VIEWPORT → Container size (screen space)             │
│   ZOOM     → Content scale (text, icons)               │
│                                                         │
│ CONTAINER: ~90% of viewport, tile-aligned (8px grid)   │
│            SAME SIZE for party/bag/summary/etc         │
│                                                         │
│ BASE SIZES (at 1x zoom):                               │
│   Fonts:   8px (sm)   10px (md)   12px (lg)            │
│   Icons:   32px (pokemon)  24px (items)  16px (small)  │
│   HP Bar:  48 × 8 px                                   │
│                                                         │
│ AT 2x ZOOM: All base sizes × 2                         │
│   Fonts:   16px / 20px / 24px                          │
│   Icons:   64px / 48px / 32px                          │
│                                                         │
│ NAVIGATION:                                             │
│   Keyboard: ↑↓←→ Move  A/Enter Select  B/Esc Back     │
│   Mouse:    Click Select  Hover Highlight              │
│                                                         │
│ ⚠️  SWITCHING MENUS MUST NOT CHANGE CONTAINER SIZE     │
│ ⚠️  ALL SIZES MUST BE MULTIPLES OF 8 (tile-aligned)   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
