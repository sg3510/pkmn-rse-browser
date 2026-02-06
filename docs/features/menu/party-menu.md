---
title: Party Menu Technical Reference
status: reference
last_verified: 2026-01-13
---

# Party Menu Technical Reference

Technical analysis of pokeemerald's party menu and Pokemon summary screen.

## Source Files

| File | Purpose |
|------|---------|
| `src/party_menu.c` | Party menu (6 slots) |
| `src/pokemon_summary_screen.c` | Pokemon details/moves |
| `include/party_menu.h` | Header definitions |
| `include/constants/party_menu.h` | Constants and enums |
| `graphics/party_menu/` | Party menu graphics |

## Party Menu Layouts

Four different layouts depending on context:

| Layout | Description |
|--------|-------------|
| `PARTY_LAYOUT_SINGLE` | 1 large left slot + 5 small right slots |
| `PARTY_LAYOUT_DOUBLE` | 2 left slots + 4 right slots |
| `PARTY_LAYOUT_MULTI` | Multi-battle variant |
| `PARTY_LAYOUT_MULTI_SHOWCASE` | Showcase display |

## Party Box Structure

```c
struct PartyMenuBox {
    const struct PartyMenuBoxInfoRects *infoRects;  // Layout dimensions
    const u8 *spriteCoords;     // Sprite positions
    u8 windowId;
    u8 monSpriteId;             // Pokemon icon sprite
    u8 itemSpriteId;            // Held item sprite
    u8 pokeballSpriteId;        // Status pokeball
    u8 statusSpriteId;          // Status condition icon
};
```

## Slot Display Elements

Each of the 6 slots shows:

| Element | Size | Notes |
|---------|------|-------|
| Pokemon Icon | 32x32 | Species + form |
| Nickname | Variable | Or species name |
| Level | "Lv XX" | |
| Gender | ♂/♀ | If applicable |
| HP Bar | Variable width | Color-coded |
| Current HP | "XXX" | |
| Max HP | "/XXX" | |
| Held Item Icon | 8x8 | If holding item |
| Status Icon | 8x8 | If has condition |

## HP Bar Colors

```c
// Color thresholds
HP_BAR_GREEN   // HP >= 50%
HP_BAR_YELLOW  // HP 21-49%
HP_BAR_RED     // HP <= 20%

static void DisplayPartyPokemonHPBar(u16 hp, u16 maxhp, ...) {
    u8 hpFraction = GetScaledHPFraction(hp, maxhp, maxWidth);
    u8 color = GetHPBarLevel(hp, maxhp);

    switch (color) {
        case HP_BAR_GREEN:  palId = sHPBarGreenPalIds; break;
        case HP_BAR_YELLOW: palId = sHPBarYellowPalIds; break;
        case HP_BAR_RED:    palId = sHPBarRedPalIds; break;
    }
    FillWindowPixelRect(windowId, palId, x, y, hpFraction, 2);
}
```

## Status Condition Icons

```c
// Status icon frames (8x8 sprites)
AILMENT_PSN  = Frame 0   // Poison
AILMENT_PRZ  = Frame 4   // Paralysis
AILMENT_SLP  = Frame 8   // Sleep
AILMENT_FRZ  = Frame 12  // Frozen
AILMENT_BRN  = Frame 16  // Burn
AILMENT_PKRS = Frame 20  // Pokerus
AILMENT_FNT  = Frame 24  // Fainted
```

## Palette Flags (Selection State)

```c
#define PARTY_PAL_SELECTED     (1 << 0)  // Currently selected
#define PARTY_PAL_FAINTED      (1 << 1)  // HP = 0 (grayed out)
#define PARTY_PAL_TO_SWITCH    (1 << 2)  // Target for switch
#define PARTY_PAL_MULTI_ALT    (1 << 3)  // Multi-battle partner
#define PARTY_PAL_SWITCHING    (1 << 4)  // Mid-switch animation
#define PARTY_PAL_TO_SOFTBOIL  (1 << 5)  // Softboil HP target
#define PARTY_PAL_NO_MON       (1 << 6)  // Empty slot
```

## Cursor Movement

```c
#define MENU_DIR_DOWN     1
#define MENU_DIR_UP      -1
#define MENU_DIR_RIGHT    2
#define MENU_DIR_LEFT    -2

// Movement wraps within valid slots
// Layout affects which directions are valid
```

## Pokemon Summary Screen

### Pages

```c
enum {
    PSS_PAGE_INFO,          // Basic info (OT, ID, nature)
    PSS_PAGE_SKILLS,        // Stats, ability, EXP bar
    PSS_PAGE_BATTLE_MOVES,  // 4 battle moves
    PSS_PAGE_CONTEST_MOVES, // Contest moves (Emerald)
    PSS_PAGE_COUNT,
};
```

### Summary Data Structure

```c
struct PokeSummary {
    u16 species;
    u8 level;
    u8 ribbonCount;
    u8 ailment;
    u8 abilityNum;
    u8 metLocation;
    u8 metLevel;
    u32 pid;
    u32 exp;
    u16 moves[4];
    u8 pp[4];
    u16 currentHP;
    u16 maxHP;
    u16 atk, def, spatk, spdef, speed;
    u16 item;
    u16 friendship;
    u8 nature;
    u8 ppBonuses;
    u8 OTName[8];
    u32 OTID;
};
```

### Move Display

```c
static void PrintMoveNameAndPP(u8 moveIndex) {
    // Format: "MOVE_NAME     PP/MaxPP"
    // PP color changes based on remaining PP:
    // Full PP = black
    // Half PP = orange
    // Low PP = red
    // No PP = gray

    u8 maxPP = CalculatePPWithBonus(move, ppBonuses, moveIndex);
    u8 ppState = GetCurrentPpToMaxPpState(currentPP, maxPP);
    // ppState: 0=full, 1=half, 2=low, 3=empty
}
```

### Experience Bar

```c
static void DrawExperienceProgressBar(struct Pokemon *mon) {
    u32 currentExp = GetMonData(mon, MON_DATA_EXP);
    u32 expToNextLevel = GetExpToLevelUp(mon);
    u32 expAtCurrentLevel = GetExpAtLevel(species, level);

    // Bar is 64 pixels wide
    u8 pixels = (currentExp - expAtCurrentLevel) * 64 / expToNextLevel;
    // Draw filled portion
}
```

## Graphics Assets

```
graphics/party_menu/
├── bg.png              # 64x64 - Background tile
├── pokeball.png        # 32x64 - Status pokeball (2 frames)
├── pokeball_small.png  # 16x96 - Small variants (6 frames)
├── hold_icons.png      # 8x16  - Item/mail icons
├── slot_main.bin       # Main slot tilemap
├── slot_main_no_hp.bin # Egg slot (no HP bar)
├── slot_wide.bin       # Secondary slot tilemap
└── slot_wide_empty.bin # Empty slot tilemap
```

## Animation Functions

```c
// Slot selection animation
AnimatePartySlot(u8 slot, u8 animNum);

// Icon bounce when selected
SpriteCB_BouncePartyMonIcon(struct Sprite *sprite);

// Smooth cursor movement
AnimateSelectedPartyIcon();
```

## Browser Implementation Notes

For our browser version:
- 6-slot grid layout with CSS Grid
- Pokemon icons from sprite sheets
- Animated HP bar with CSS transitions
- Status icons overlay
- Click or keyboard to select slot
- Summary screen as overlay/modal
- Page tabs for summary sections
- Move selection with PP display
- EXP bar with smooth fill animation
