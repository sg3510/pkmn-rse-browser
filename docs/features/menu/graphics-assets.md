---
title: Menu Graphics Assets Reference
status: reference
last_verified: 2026-01-13
---

# Menu Graphics Assets Reference

Complete inventory of menu-related graphics from pokeemerald.

## Directory Structure

```
public/pokeemerald/graphics/
├── interface/           # Core UI elements
├── text_window/         # Text box frames
├── battle_interface/    # Battle UI
├── bag/                 # Bag menu
├── party_menu/          # Party screen
├── trainer_card/        # Trainer card
├── pokedex/             # Pokedex screens
├── summary_screen/      # Pokemon summary
├── items/icons/         # Item icons (218 files)
├── pokemon/*/icon.png   # Pokemon icons
└── naming_screen/       # Name entry
```

## Core Interface Elements

### Cursors (`graphics/interface/`)

| File | Size | Description |
|------|------|-------------|
| `arrow_cursor.png` | 16x16 | Standard arrow pointer |
| `outline_cursor.png` | 24x24 | Square selection outline |
| `scroll_indicator.png` | 16x32 | Scroll arrows |
| `swap_line.png` | 16x32 | Item swap indicator |

### Status Icons

| File | Size | Description |
|------|------|-------------|
| `status_icons.png` | 32x64 | PSN/PRZ/SLP/FRZ/BRN/PKRS/FNT |
| `mon_markings.png` | 32x128 | Pokemon marking symbols |

### Menu Palettes

| File | Purpose |
|------|---------|
| `std_menu.pal` | Standard menu colors |
| `main_menu_bg.pal` | Main menu background |
| `main_menu_text.pal` | Main menu text |
| `option_menu_text.pal` | Options text |

## Text Window Frames (`graphics/text_window/`)

20 modular tiles for building text boxes:

| Tiles | Purpose |
|-------|---------|
| 1, 3, 5, 7 | Corners (TL, TR, BL, BR) |
| 2, 4, 6, 8 | Edges (T, B, L, R) |
| 9-12 | Additional edges |
| 13-20 | Fill patterns |
| `message_box.png` | Continue arrow (56x16) |

## Bag Menu (`graphics/bag/`)

| File | Size | Description |
|------|------|-------------|
| `bag_male.png` | 64x384 | Male bag (6 pocket frames) |
| `bag_female.png` | 64x384 | Female bag variant |
| `bag_pyramid.png` | 64x64 | Battle Pyramid bag |
| `menu.png` | 128x32 | Menu interface tiles |
| `hm.png` | 16x16 | HM indicator |
| `rotating_ball.png` | 16x16 | Animated pokeball |
| `select_button.png` | 24x16 | SELECT button |
| `check_berry.png` | 80x72 | Berry info panel |

## Party Menu (`graphics/party_menu/`)

| File | Size | Description |
|------|------|-------------|
| `bg.png` | 64x64 | Background tile |
| `pokeball.png` | 32x64 | Status ball (2 frames) |
| `pokeball_small.png` | 16x96 | Small balls (6 frames) |
| `hold_icons.png` | 8x16 | Item/mail held icons |

### Tilemaps (Binary)

| File | Purpose |
|------|---------|
| `slot_main.bin` | Main Pokemon slot |
| `slot_main_no_hp.bin` | Egg slot (no HP) |
| `slot_wide.bin` | Secondary slots |
| `slot_wide_empty.bin` | Empty slot |

## Trainer Card (`graphics/trainer_card/`)

| File | Size | Description |
|------|------|-------------|
| `tiles.png` | Variable | Card tile graphics |
| `badges.png` | Variable | 8 gym badges |
| `front.bin.lz` | - | Front tilemap |
| `back.bin.lz` | - | Back tilemap |

### Palettes (Star Colors)

| File | Stars | Color |
|------|-------|-------|
| `green.gbapal` | 0 | Green (default) |
| `bronze.gbapal` | 1 | Bronze |
| `copper.gbapal` | 2 | Copper |
| `silver.gbapal` | 3 | Silver |
| `gold.gbapal` | 4 | Gold |
| `female_bg.gbapal` | - | Female variant |

## Battle Interface (`graphics/battle_interface/`)

| File | Size | Description |
|------|------|-------------|
| `textbox.png` | 128x128 | Battle text box |
| `hpbar.png` | 96x8 | HP bar sprite |
| `hpbar_anim.png` | 144x8 | Animated HP frames |
| `expbar.png` | 72x8 | Experience bar |
| `status.png` | Variable | Status conditions |
| `ball_display.png` | 32x8 | Party ball display |

### Health Boxes

| File | Description |
|------|-------------|
| `healthbox_singles_player.png` | Single battle player |
| `healthbox_singles_opponent.png` | Single battle opponent |
| `healthbox_doubles_player.png` | Double battle player |
| `healthbox_doubles_opponent.png` | Double battle opponent |
| `healthbox_safari.png` | Safari zone |

## Pokedex (`graphics/pokedex/`)

| File | Size | Description |
|------|------|-------------|
| `menu.png` | 128x128 | Main interface |
| `interface.png` | 32x512 | Interface tiles |
| `search_menu.png` | 128x64 | Search screen |
| `region_map.png` | 128x120 | Hoenn map |
| `caught_ball.png` | 8x16 | Caught indicator |
| `arrows.png` | 8x96 | Navigation arrows |
| `cry_meter.png` | 80x64 | Cry waveform |

## Summary Screen (`graphics/summary_screen/`)

| File | Description |
|------|-------------|
| `tiles.png` | Screen tiles |
| `move_select.png` | Move selector |
| `a_button.png` | A button icon |
| `b_button.png` | B button icon |

## Item Icons (`graphics/items/icons/`)

218 individual item icons, all 32x32 pixels:

### Categories
- Poke Balls: `poke_ball.png`, `great_ball.png`, `ultra_ball.png`, etc.
- Medicine: `potion.png`, `super_potion.png`, `antidote.png`, etc.
- Key Items: `bicycle.png`, `old_rod.png`, `pokenav.png`, etc.
- TMs/HMs: `tm_normal.png`, `tm_fire.png`, `hm_surf.png`, etc.
- Berries: `cheri_berry.png`, `oran_berry.png`, etc.
- Hold Items: `leftovers.png`, `choice_band.png`, etc.

### Palettes
Located in `graphics/items/icon_palettes/`:
- One `.pal` file per item
- 16-color GBA palette format

## Pokemon Icons

Each Pokemon has an icon at:
```
graphics/pokemon/{species}/icon.png
```

- Size: 32x64 (2 frames for animation)
- 4-bit color depth
- ~400 species icons total

## Summary Statistics

| Category | Count |
|----------|-------|
| Interface graphics | 22 files |
| Text window tiles | 20 files |
| Bag assets | 9 files |
| Item icons | 218 files |
| Item palettes | 200+ files |
| Pokemon icons | ~400 files |
| Battle interface | 36+ files |
| Menu palettes | 50+ files |
| **Total** | **~950 files** |
