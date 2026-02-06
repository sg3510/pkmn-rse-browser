---
title: Menu System Documentation
status: reference
last_verified: 2026-01-13
---

# Menu System Documentation

Technical reference and implementation proposal for the Pokemon Emerald browser recreation menu system.

## Implementation Checklist

**[TODO.md](./TODO.md)** - Full implementation checklist with 177 items across 9 phases.

## Documentation Files

| File | Description |
|------|-------------|
| [TODO.md](./TODO.md) | **Implementation checklist** - 177 items, track progress here |
| [implementation-proposal.md](./implementation-proposal.md) | **Design proposal** - Responsive 2x3 grid overlay, animations, keyboard/mouse input |
| [start-menu.md](./start-menu.md) | Start menu technical reference from pokeemerald C code |
| [trainer-card.md](./trainer-card.md) | Trainer card display, flip animation, star progression |
| [bag-menu.md](./bag-menu.md) | Bag/inventory system, pockets, context menus |
| [party-menu.md](./party-menu.md) | Party menu layout, HP bars, summary screen |
| [graphics-assets.md](./graphics-assets.md) | Complete inventory of menu graphics from pokeemerald |

## Quick Summary

### Design Decisions

1. **2x3 Grid Overlay** - Start menu as centered icon grid over the map
2. **Responsive** - Uses CSS clamp() for viewport-adaptive sizing
3. **Dual Input** - Full keyboard AND mouse support
4. **GBA Authentic** - Same fonts, colors, pixel-art style
5. **Smooth Animations** - CSS transitions, no jarring changes

### Key Features

- Semi-transparent backdrop with blur (map visible behind)
- Pulsing selection indicator
- Hover states for mouse users
- Keyboard navigation with wrapping
- Sound effects on all interactions
- Disabled states for locked features (no Pokedex yet, etc.)

### Implementation Order

1. Core infrastructure (MenuStateManager, input handling)
2. Start menu with 2x3 grid
3. Trainer Card with flip animation
4. Bag menu with pockets
5. Party menu with HP bars
6. Summary screen with pages

## Source Analysis

All technical details extracted from:
- `public/pokeemerald/src/start_menu.c`
- `public/pokeemerald/src/item_menu.c`
- `public/pokeemerald/src/party_menu.c`
- `public/pokeemerald/src/trainer_card.c`
- `public/pokeemerald/src/menu.c`
- `public/pokeemerald/graphics/` (800+ asset files)

## Graphics to Extract

Priority sprites to extract/convert for menu implementation:

```
graphics/party_menu/pokeball.png     -> Pokemon menu icon
graphics/bag/bag_male.png            -> Bag menu icon (crop frame)
graphics/pokedex/interface.png       -> Pokedex icon elements
graphics/trainer_card/tiles.png      -> Trainer card background
graphics/trainer_card/badges.png     -> 8 gym badges
graphics/items/icons/*.png           -> All item icons (218 files)
```
