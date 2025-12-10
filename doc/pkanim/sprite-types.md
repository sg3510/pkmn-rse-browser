# Pokemon Sprite Types

Comprehensive reference for all sprite files in `public/pokeemerald/graphics/pokemon/`.

## Icon Sprites

**File:** `icon.png`
**Dimensions:** 32×64 pixels
**Frames:** 2 (stacked vertically)
**Purpose:** Menu icons, party display, PC boxes

### Frame Layout

```
┌──────────┐
│  Frame 1 │  0-31px   (neutral)
│  32×32   │
├──────────┤
│  Frame 2 │  32-63px  (bounce up)
│  32×32   │
└──────────┘
```

### Animation Behavior

The icon uses a simple 2-frame bounce animation:
- Frame 1: Pokemon at rest
- Frame 2: Pokemon slightly raised (bounce effect)

### Current CSS Implementation

```css
/* From src/menu/styles/party-menu-content.css */
.party-slot-icon {
  width: 32px;
  height: 32px;
  background-size: 32px 64px;
  background-position: 0 0;
  animation: pokemon-icon-bounce 0.6s step-end infinite;
}

@keyframes pokemon-icon-bounce {
  0%, 85% { background-position-y: 0; }
  85.01%, 100% { background-position-y: -32px; }
}
```

---

## Front Battle Sprites

### Static Version

**File:** `front.png`
**Dimensions:** 64×64 pixels
**Frames:** 1
**Purpose:** Quick display, thumbnails, non-animated contexts

### Animated Version

**File:** `anim_front.png`
**Dimensions:** 64×128 pixels
**Frames:** 2 (stacked vertically)
**Purpose:** Battle animations, detailed Pokemon display

### Frame Layout (anim_front.png)

```
┌──────────┐
│  Frame 1 │  0-63px   (primary pose)
│  64×64   │
├──────────┤
│  Frame 2 │  64-127px (animation frame)
│  64×64   │
└──────────┘
```

### Animation Notes

- Frame 2 typically shows a slight movement or expression change
- In original GBA games, these animate on Pokemon cry or battle entry
- Animation timing varies by Pokemon (not stored in sprite data)

---

## Back Battle Sprites

**File:** `back.png`
**Dimensions:** 64×64 pixels
**Frames:** 1
**Purpose:** Player's Pokemon in battle (back view)

### Notes

- Always static in original games
- Shows Pokemon from behind as trainer would see it
- Some Pokemon have slightly different poses than front sprite

---

## Footprint Sprites

**File:** `footprint.png`
**Dimensions:** 16×16 pixels
**Frames:** 1
**Purpose:** Pokedex display, tracking features

### Notes

- Monochrome/1-bit style
- Represents Pokemon's footprint shape
- Used in Pokedex "Area" and detail screens

---

## Palette Files

### Normal Palette

**File:** `normal.pal`
**Size:** ~200-220 bytes
**Format:** GBA palette format

### Shiny Palette

**File:** `shiny.pal`
**Size:** ~200-220 bytes
**Format:** GBA palette format

### Palette Notes

- Original GBA uses indexed color (16 colors per sprite)
- PNG files in this repo are already rendered with normal colors
- Shiny variants would require palette swapping or separate pre-rendered PNGs
- Palette files are preserved for reference but not actively used in web version

---

## File Presence by Pokemon

All 385 Gen 3 Pokemon have the complete set:

| File | Present | Notes |
|------|---------|-------|
| `icon.png` | 385/385 | All Pokemon |
| `front.png` | 385/385 | All Pokemon |
| `anim_front.png` | 385/385 | All Pokemon |
| `back.png` | 385/385 | All Pokemon |
| `footprint.png` | 385/385 | All Pokemon |
| `normal.pal` | 385/385 | All Pokemon |
| `shiny.pal` | 385/385 | All Pokemon |

---

## Dimension Summary

| Sprite Type | Width | Height | Frame Size | Frame Count |
|-------------|-------|--------|------------|-------------|
| icon.png | 32 | 64 | 32×32 | 2 |
| front.png | 64 | 64 | 64×64 | 1 |
| anim_front.png | 64 | 128 | 64×64 | 2 |
| back.png | 64 | 64 | 64×64 | 1 |
| footprint.png | 16 | 16 | 16×16 | 1 |
