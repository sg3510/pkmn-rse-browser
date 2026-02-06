---
title: Pokemon RSE Menu Assets Reference
status: reference
last_verified: 2026-01-13
---

# Pokemon RSE Menu Assets Reference

## Design System Fundamentals

### GBA Display Specifications

The GBA has a fixed resolution that all our menus must respect:

| Property | Value | Notes |
|----------|-------|-------|
| **Native Resolution** | 240 × 160 pixels | All GBA games render at this |
| **Tile Size** | 8 × 8 pixels | Base unit for all GBA graphics |
| **Common Sprite Sizes** | 8, 16, 32, 64 px | Always multiples of 8 |
| **Color Depth** | 15-bit (32,768 colors) | 5 bits per RGB channel |
| **Palette Size** | 16 colors per palette | Multiple palettes can be used |

### Pixel-Perfect Rendering Rules

**CRITICAL**: All dimensions must be tile-aligned (multiples of 8) to avoid subpixel rendering artifacts.

```
✓ GOOD: 240px, 160px, 64px, 32px, 16px, 8px
✗ BAD:  220px, 65px, 59px, 18px, 14px
```

When scaling sprites, always use **integer multiples** of the original size:

```css
/* CORRECT - Integer scaling */
.pokemon-icon {
  width: 32px;   /* 32 × 1 = 32 (1x) */
  width: 64px;   /* 32 × 2 = 64 (2x) */
  width: 96px;   /* 32 × 3 = 96 (3x) */
}

/* WRONG - Fractional scaling causes blur */
.pokemon-icon {
  width: 48px;   /* 32 × 1.5 = blurry */
  width: 40px;   /* 32 × 1.25 = blurry */
}
```

### Viewport & Zoom System

Our app supports zoom levels to accommodate different screen sizes:

| Zoom | Viewport Size | Use Case |
|------|---------------|----------|
| 1x | 240 × 160 | Small screens, embedded |
| 2x | 480 × 320 | Standard desktop |
| 3x | 720 × 480 | Large screens |
| 4x | 960 × 640 | Very large / presentations |

**Menu Container Size**: Currently 240 × 200 (slightly taller than GBA for UI chrome)

### Retina/HiDPI Display Handling

**Problem**: On retina displays (devicePixelRatio = 2 or 3), CSS pixels don't match device pixels. A 32px icon renders at 64 or 96 device pixels, making it appear smaller relative to screen real estate.

**Solutions**:

1. **Account for devicePixelRatio in zoom calculation**:
```typescript
const baseZoom = 2;
const effectiveZoom = baseZoom * Math.min(window.devicePixelRatio, 2);
```

2. **Use larger base sizes for icons**:
```css
/* Instead of 32px icons at 2x zoom = 64 CSS px */
/* On retina (2x DPR), that's only 64 device px - too small */
/* Consider 3x zoom on retina = 96 CSS px = 192 device px */
```

3. **CSS image-rendering must be set**:
```css
.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* Firefox fallback */
}
```

### Current Icon Size Issues

Pokemon party icons are currently too small. Here's the analysis:

| Element | Current Size | At 2x Zoom | On Retina (2x DPR) | Recommended |
|---------|-------------|------------|-------------------|-------------|
| Party icon | 20 × 20 | 40 × 40 CSS | 80 device px | 32 × 32 base |
| HP bar | 28 × 3 | 56 × 6 CSS | 112 × 12 device | 48 × 6 base |
| Item icon | 12 × 12 | 24 × 24 CSS | 48 device px | 16 × 16 base |
| Font size | 5-6px | 10-12 CSS | 20-24 device | 8px base |

**Recommendation**: Use GBA-native sizes (multiples of 8) and let zoom handle scaling:
- Pokemon icons: 32 × 32 (native GBA size)
- Item icons: 24 × 24 or 16 × 16
- HP bars: 48 × 8 or 64 × 8
- Fonts: 8px base (the GBA font tile size)

---

## Asset Inventory

### 1. Custom Assets (`/public/img/`) - DEFINITIVE REFERENCE

**IMPORTANT**: This is the authoritative reference for our custom sprite sheets. Do not guess - refer here.

---

#### bag-icon-pockets.png (472 × 61)
**Layout**: 8 frames HORIZONTAL, each 59 × 61 pixels

```
Frame:   0       1        2       3      4       5      6        7
      ┌───────┬────────┬───────┬──────┬───────┬──────┬────────┬────────┐
      │ Items │Medicine│Poké   │TM/HM │Berries│ Mail │Special │Key     │
      │       │        │Balls  │      │       │      │        │Items   │
      └───────┴────────┴───────┴──────┴───────┴──────┴────────┴────────┘
         0       59      118     177    236     295    354      413    (backgroundPositionX)
```

**CSS Usage**:
```css
.bag-image {
  width: 59px;
  height: 61px;
  background-image: url('/img/bag-icon-pockets.png');
  background-position-x: calc(-1 * var(--frame) * 59px);
}
```

---

#### bag-icons.png (208 × 52)
**Layout**: 2 rows × 8 columns, each icon 26 × 26 pixels
- **Row 0 (y=0)**: INACTIVE/Unselected state
- **Row 1 (y=26)**: ACTIVE/Selected state

```
Column:    0       1        2       3      4       5      6        7
        ┌──────┬────────┬───────┬──────┬───────┬──────┬────────┬────────┐
Row 0   │ Bag  │Medicine│Poké   │TM/HM │Berries│ Mail │Special │Key     │  INACTIVE
(y=0)   │      │        │Balls  │      │       │      │        │Items   │
        ├──────┼────────┼───────┼──────┼───────┼──────┼────────┼────────┤
Row 1   │ Bag  │Medicine│Poké   │TM/HM │Berries│ Mail │Special │Key     │  ACTIVE
(y=26)  │      │        │Balls  │      │       │      │        │Items   │
        └──────┴────────┴───────┴──────┴───────┴──────┴────────┴────────┘
           0      26       52      78     104     130    156      182   (backgroundPositionX)
```

**CSS Usage**:
```css
.pocket-tab-icon {
  width: 26px;
  height: 26px;
  background-image: url('/img/bag-icons.png');
  background-position-x: calc(-1 * var(--column) * 26px);
  background-position-y: 0;      /* inactive */
  background-position-y: -26px;  /* active */
}
```

---

#### menu-icons.png (50 × 250)
**Layout**: 10 rows × 2 columns, each icon 25 × 25 pixels
- **Column 0 (x=0)**: UNSELECTED state
- **Column 1 (x=25)**: SELECTED state

```
Row:       Col 0 (x=0)    Col 1 (x=25)
          UNSELECTED       SELECTED
        ┌─────────────┬─────────────┐
Row 0   │   Pokédex   │   Pokédex   │  y=0
        ├─────────────┼─────────────┤
Row 1   │   Pokémon   │   Pokémon   │  y=25
        ├─────────────┼─────────────┤
Row 2   │     Bag     │     Bag     │  y=50
        ├─────────────┼─────────────┤
Row 3   │Trainer Card │Trainer Card │  y=75
        ├─────────────┼─────────────┤
Row 4   │    Save     │    Save     │  y=100
        ├─────────────┼─────────────┤
Row 5   │ Nintendo DS │ Nintendo DS │  y=125  (or similar device icon)
        ├─────────────┼─────────────┤
Row 6   │  Back Icon  │  Back Icon  │  y=150
        ├─────────────┼─────────────┤
Row 7   │Options/Msg  │Options/Msg  │  y=175
        ├─────────────┼─────────────┤
Row 8   │    Flag     │    Flag     │  y=200
        ├─────────────┼─────────────┤
Row 9   │  White Bag  │  White Bag  │  y=225
        └─────────────┴─────────────┘
```

**CSS Usage**:
```css
.menu-icon {
  width: 25px;
  height: 25px;
  background-image: url('/img/menu-icons.png');
  background-position-x: 0;      /* unselected */
  background-position-x: -25px;  /* selected */
  background-position-y: calc(-1 * var(--row) * 25px);
}
```

---

### 2. Pokeemerald Bag Assets (`/public/pokeemerald/graphics/bag/`)

| File | Dimensions | Grid | Notes |
|------|-----------|------|-------|
| bag_male.png | 64 × 384 | 1 × 6 frames (64×64 each) | ✓ Tile-aligned |
| bag_female.png | 64 × 384 | 1 × 6 frames (64×64 each) | ✓ Tile-aligned |
| bag_pyramid.png | 64 × 64 | Single frame | ✓ Tile-aligned |
| menu.png | 128 × 32 | UI elements | ✓ Tile-aligned |
| select_button.png | 24 × 16 | Button graphic | ✓ Tile-aligned |
| hm.png | 16 × 16 | HM badge | ✓ Tile-aligned |
| rotating_ball.png | 16 × 16 | Loading indicator | ✓ Tile-aligned |

---

### 3. Party Menu Assets (`/public/pokeemerald/graphics/party_menu/`)

| File | Dimensions | Grid | Notes |
|------|-----------|------|-------|
| pokeball.png | 32 × 64 | 1 × 2 frames (32×32 each) | ✓ Tile-aligned |
| pokeball_small.png | 16 × 96 | 1 × 6 frames (16×16 each) | ✓ Tile-aligned |
| hold_icons.png | 8 × 16 | 1 × 2 frames (8×8 each) | ✓ Tile-aligned |
| bg.png | 64 × 64 | Background tile | ✓ Tile-aligned |

---

### 4. Summary Screen Assets (`/public/pokeemerald/graphics/summary_screen/`)

| File | Dimensions | Grid | Notes |
|------|-----------|------|-------|
| tiles.png | 128 × 120 | UI tileset | ✓ Tile-aligned |
| move_select.png | 16 × 128 | 1 × 8 frames (16×16 each) | ✓ Tile-aligned |
| a_button.png | 16 × 16 | Button indicator | ✓ Tile-aligned |
| b_button.png | 16 × 16 | Button indicator | ✓ Tile-aligned |

---

### 5. Interface Elements (`/public/pokeemerald/graphics/interface/`)

| File | Dimensions | Grid | Notes |
|------|-----------|------|-------|
| arrow_cursor.png | 16 × 16 | Arrow cursor | ✓ Tile-aligned |
| outline_cursor.png | 24 × 24 | Box cursor | ✓ Tile-aligned |
| status_icons.png | 32 × 64 | Status badges | ✓ Tile-aligned |
| scroll_indicator.png | 16 × 32 | Up/down arrows | ✓ Tile-aligned |
| menu_info.png | 128 × 128 | Info panel tiles | ✓ Tile-aligned |

---

### 6. Text Window Frames (`/public/pokeemerald/graphics/text_window/`)

| File | Dimensions | Notes |
|------|-----------|-------|
| 1.png - 20.png | 24 × 24 each | 20 frame style variants, ✓ Tile-aligned |
| message_box.png | 56 × 16 | Continue arrow indicator |

**Frame Construction**: Combine corner and edge tiles to build text boxes:
```
┌─────────────────────┐
│ TL │   TOP    │ TR  │  TL = Top-Left corner
├────┼──────────┼─────┤  TR = Top-Right corner
│ L  │  CENTER  │  R  │  BL = Bottom-Left corner
├────┼──────────┼─────┤  BR = Bottom-Right corner
│ BL │  BOTTOM  │ BR  │
└─────────────────────┘
```

---

### 7. Pokemon Icons (`/public/pokeemerald/graphics/pokemon/*/icon.png`)

- **Dimensions**: 32 × 64 pixels per species
- **Grid**: 1 × 2 frames (32 × 32 each) for bounce animation
- **Total**: 400+ species icons
- **Animation**: Frame 0 (rest) ↔ Frame 1 (bounce)

```css
@keyframes pokemon-icon-bounce {
  0%, 85% { background-position-y: 0; }
  85.01%, 100% { background-position-y: -32px; }
}
```

---

### 8. Item Icons (`/public/pokeemerald/graphics/items/icons/`)

- **Standard Size**: 24 × 24 pixels (✓ Tile-aligned)
- **Total**: 300+ item icons
- **Format**: Individual PNG files per item

---

## Recommended Design System Updates

### 1. Standardize on Tile-Aligned Sizes

Replace current non-aligned sizes with GBA-standard sizes:

| Element | Current | Recommended | Reasoning |
|---------|---------|-------------|-----------|
| Party slot icon | 20 × 20 | 32 × 32 | Native GBA icon size |
| HP bar width | 28px | 48px or 64px | Multiple of 8 |
| HP bar height | 3px | 8px | Single tile height |
| Item icons | 12 × 12 | 16 × 16 or 24 × 24 | Tile-aligned |
| Pocket tab icon | 18 × 18 | 24 × 24 | Tile-aligned |
| Base font size | 5-6px | 8px | GBA font tile size |

### 2. Zoom-Aware Sizing

```typescript
// Base sizes (at 1x zoom)
const BASE_SIZES = {
  pokemonIcon: 32,      // 32 × 32
  itemIcon: 24,         // 24 × 24
  hpBarWidth: 48,       // 48 × 8
  hpBarHeight: 8,
  fontSize: 8,          // Base font size
  tileSize: 8,          // Fundamental unit
};

// Apply zoom
function getSize(base: number, zoom: number): number {
  return base * zoom;
}
```

### 3. Retina Detection

```typescript
function getEffectiveZoom(baseZoom: number): number {
  const dpr = window.devicePixelRatio || 1;
  // On retina, bump up zoom to compensate
  if (dpr >= 2 && baseZoom < 3) {
    return Math.max(baseZoom, 3);
  }
  return baseZoom;
}
```

### 4. CSS Custom Properties for Consistency

```css
:root {
  /* Base sizes (1x zoom) */
  --tile-size: 8px;
  --pokemon-icon-size: 32px;
  --item-icon-size: 24px;
  --hp-bar-width: 48px;
  --hp-bar-height: 8px;
  --font-size-base: 8px;

  /* Zoom factor (set via JS) */
  --zoom: 2;

  /* Computed sizes */
  --pokemon-icon-scaled: calc(var(--pokemon-icon-size) * var(--zoom));
  --item-icon-scaled: calc(var(--item-icon-size) * var(--zoom));
}

.pokemon-icon {
  width: var(--pokemon-icon-scaled);
  height: var(--pokemon-icon-scaled);
  image-rendering: pixelated;
}
```

---

## Menu Layout Specifications

### Party Menu (6 slots)

GBA layout: 2 columns × 3 rows

```
┌─────────────────────────────────────┐
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ SLOT 0      │ │ SLOT 1          │ │
│ │ [icon] NAME │ │ [icon] NAME     │ │
│ │ Lv.XX ══════│ │ Lv.XX ══════════│ │
│ └─────────────┘ └─────────────────┘ │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ SLOT 2      │ │ SLOT 3          │ │
│ └─────────────┘ └─────────────────┘ │
│ ┌─────────────┐ ┌─────────────────┐ │
│ │ SLOT 4      │ │ SLOT 5          │ │
│ └─────────────┘ └─────────────────┘ │
└─────────────────────────────────────┘
     240px (at 1x zoom)
```

**Slot dimensions** (1x zoom):
- Width: 112px (slot 0) / 120px (slots 1-5)
- Height: 48px
- Icon: 32 × 32
- HP bar: 48 × 8

### Bag Menu

```
┌───────────────────────────────────────┐
│ ┌─────────┐  ┌────────────────────┐   │
│ │         │  │ [tab][tab][tab]... │   │
│ │  BAG    │  ├────────────────────┤   │
│ │  IMAGE  │  │ Item 1      ×99    │   │
│ │  64×64  │  │ Item 2      ×99    │   │
│ │         │  │ Item 3      ×99    │   │
│ └─────────┘  │ ...                │   │
│  POCKET NAME └────────────────────┘   │
├───────────────────────────────────────┤
│ Item description text          ¥99999 │
└───────────────────────────────────────┘
```

### Summary Screen

```
┌───────────────────────────────────────┐
│  [INFO] [STATS] [MOVES]               │
├───────────────────────────────────────┤
│  BULBASAUR ♂        Lv.15  GRASS PSN  │
├───────────────────────────────────────┤
│  ┌────────┐  Species: BULBASAUR       │
│  │ SPRITE │  OT: RED                  │
│  │ 64×64  │  ID: 12345                │
│  └────────┘  Nature: HARDY            │
│              Ability: OVERGROW        │
├───────────────────────────────────────┤
│  ◄ ► Page  |  B: Back                 │
└───────────────────────────────────────┘
```

---

## File Checklist for Consistency Update

### High Priority (Currently Used)

- [ ] `bag-menu.css` - Update to tile-aligned sizes
- [ ] `PartySlot.tsx` - Increase icon/bar sizes
- [ ] `HPBar.tsx` - Use 48×8 or 64×8 base size
- [ ] `party-menu-content.css` - Grid layout with proper sizes
- [ ] `pokemon-summary-content.css` - Tile-aligned spacing

### Assets to Consider Regenerating

The custom assets in `/public/img/` are not tile-aligned:
- `bag-icon-pockets.png` (59px frames)
- `bag-icons.png` (26px icons)
- `menu-icons.png` (50×25 icons)

Consider regenerating at tile-aligned sizes:
- Bag pockets: 64px frames (8 × 64 = 512px total)
- Bag icons: 24px or 32px icons
- Menu icons: 48×24 or 32×32

---

## Quick Reference: GBA-Standard Sizes

| Element Type | Size | Notes |
|--------------|------|-------|
| Small icon | 8 × 8 | Status badges, tiny indicators |
| Medium icon | 16 × 16 | Item icons, cursors |
| Standard icon | 24 × 24 | Larger item icons |
| Pokemon icon | 32 × 32 | Party/box icons |
| Large sprite | 64 × 64 | Bag, Pokemon front sprites |
| HP bar | 48 × 8 | Standard HP bar |
| Text tile | 8 × 8 | Font character cell |
| Menu width | 240 | Full GBA width |
| Menu height | 160 | Full GBA height |
