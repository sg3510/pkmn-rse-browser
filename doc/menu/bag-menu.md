# Bag Menu Technical Reference

Technical analysis of pokeemerald's bag/inventory menu implementation.

## Source Files

| File | Purpose |
|------|---------|
| `src/item_menu.c` | Bag menu logic, pocket switching, item display |
| `include/item_menu.h` | Header definitions |
| `graphics/bag/` | Bag graphics and palettes |

## Bag Position State

```c
struct BagPosition {
    MainCallback exitCallback;
    u8 location;                      // Where bag was opened from
    u8 pocket;                        // Current pocket (0-4)
    u16 pocketSwitchArrowPos;
    u16 cursorPosition[POCKETS_COUNT];   // Per-pocket cursor
    u16 scrollPosition[POCKETS_COUNT];   // Per-pocket scroll offset
};
```

## Five Pockets

| Index | Pocket | Max Items |
|-------|--------|-----------|
| 0 | Items | 30 |
| 1 | Key Items | 30 |
| 2 | Poke Balls | 16 |
| 3 | TMs & HMs | 64 |
| 4 | Berries | 46 |

## Menu Locations (Context)

```c
enum {
    ITEMMENULOCATION_FIELD,           // Overworld
    ITEMMENULOCATION_BATTLE,          // In battle
    ITEMMENULOCATION_PARTY,           // From party menu
    ITEMMENULOCATION_SHOP,            // At shop
    ITEMMENULOCATION_BERRY_TREE,      // Planting berries
    ITEMMENULOCATION_BERRY_BLENDER_CRUSH,
    ITEMMENULOCATION_ITEMPC,          // PC storage
    ITEMMENULOCATION_FAVOR_LADY,
    ITEMMENULOCATION_QUIZ_LADY,
    ITEMMENULOCATION_APPRENTICE,
    ITEMMENULOCATION_WALLY,
    ITEMMENULOCATION_PCBOX,
};
```

## List Menu Template

```c
static const struct ListMenuTemplate sItemListMenu = {
    .items = NULL,                    // Populated dynamically
    .moveCursorFunc = BagMenu_MoveCursorCallback,
    .itemPrintFunc = BagMenu_ItemPrintCallback,
    .totalItems = 0,
    .maxShowed = 0,                   // Visible items
    .windowId = WIN_ITEM_LIST,
    .item_X = 8,                      // Item text X offset
    .cursor_X = 0,                    // Cursor X offset
    .cursorPal = 1,
    .fontId = FONT_NARROW,
    .cursorKind = CURSOR_BLACK_ARROW
};
```

## Context Menu Actions

Different actions available per pocket:

### Items Pocket
```c
static const u8 sContextMenuItems_ItemsPocket[] = {
    ACTION_USE,      ACTION_GIVE,
    ACTION_TOSS,     ACTION_CANCEL
};
```

### Key Items Pocket
```c
static const u8 sContextMenuItems_KeyItemsPocket[] = {
    ACTION_USE,      ACTION_REGISTER,   // Register to Select button
    ACTION_DUMMY,    ACTION_CANCEL
};
```

### Balls Pocket
```c
static const u8 sContextMenuItems_BallsPocket[] = {
    ACTION_GIVE,     ACTION_DUMMY,
    ACTION_TOSS,     ACTION_CANCEL
};
```

### TM/HM Pocket
```c
static const u8 sContextMenuItems_TMHMPocket[] = {
    ACTION_USE,      ACTION_GIVE,
    ACTION_DUMMY,    ACTION_CANCEL      // Can't toss TMs
};
```

### Berries Pocket
```c
static const u8 sContextMenuItems_BerriesPocket[] = {
    ACTION_CHECK,    ACTION_GIVE,       // Check berry info
    ACTION_TOSS,     ACTION_CANCEL
};
```

## Action Enum

```c
enum {
    ACTION_USE,           // Use item
    ACTION_TOSS,          // Discard item
    ACTION_REGISTER,      // Register key item
    ACTION_GIVE,          // Give to Pokemon
    ACTION_CANCEL,        // Close menu
    ACTION_BATTLE_USE,    // Use in battle
    ACTION_CHECK,         // Check item info
    ACTION_WALK,          // Use bike/running shoes
    ACTION_DESELECT,      // Deselect item
    ACTION_CHECK_TAG,     // Check berry tag
    ACTION_CONFIRM,       // Confirm selection
    ACTION_SHOW,          // Show item
    ACTION_DUMMY,         // Placeholder (grayed out)
};
```

## Pocket Switching

- L/R buttons switch pockets
- Visual arrows indicate available pockets
- Each pocket maintains its own cursor/scroll position

```c
static void SwitchBagPocket(u8 taskId, s16 direction, bool16 loopAround) {
    s16 newPocket = gBagPosition.pocket + direction;

    if (loopAround) {
        if (newPocket < 0)
            newPocket = POCKETS_COUNT - 1;
        else if (newPocket >= POCKETS_COUNT)
            newPocket = 0;
    }

    gBagPosition.pocket = newPocket;
    // Reload pocket contents...
}
```

## Scrolling List

```c
// Scroll behavior
#define LIST_NO_MULTIPLE_SCROLL    0   // Single item at a time
#define LIST_MULTIPLE_SCROLL_DPAD  1   // D-pad Left/Right = page
#define LIST_MULTIPLE_SCROLL_L_R   2   // L/R buttons = page

// List processes input
s32 ListMenu_ProcessInput(u8 listTaskId) {
    if (JOY_REPEAT(DPAD_UP))
        ListMenuChangeSelection(list, TRUE, 1, FALSE);  // Up
    else if (JOY_REPEAT(DPAD_DOWN))
        ListMenuChangeSelection(list, TRUE, 1, TRUE);   // Down
    // L/R for page scrolling if enabled
}
```

## Graphics Assets

```
graphics/bag/
├── bag_male.png       # 64x384 - Male bag visual (6 frames)
├── bag_female.png     # 64x384 - Female bag visual
├── bag_pyramid.png    # 64x64  - Battle Pyramid bag
├── menu.png           # 128x32 - Menu interface
├── hm.png             # 16x16  - HM indicator icon
├── rotating_ball.png  # 16x16  - Animated pokeball
├── select_button.png  # 24x16  - Select button graphic
├── check_berry.png    # 80x72  - Berry info display
└── check_berry_circle.png  # 64x64 - Berry circle
```

## Item Icon System

- Item icons: 32x32 pixels each
- Located in `graphics/items/icons/`
- 218 unique item icons
- Each has corresponding palette file

## Bag Pocket Icons Sprite Sheet

**Location:** `public/img/bag-icons.png`

26x26 pixel sprites, 8 columns × 2 rows:
- Top row: Unselected state
- Bottom row: Selected state

| Index | Icon | Description | Used For |
|-------|------|-------------|----------|
| 0 | Bag | Normal items | `items` pocket |
| 1 | Potion | Potions/medicine | (not used - merged with items) |
| 2 | Poké Ball | Poké Balls | `pokeBalls` pocket |
| 3 | Disc | TMs & HMs | `tmHm` pocket |
| 4 | Berry | Berries | `berries` pocket |
| 5 | Envelope | Letters/mail | (not used) |
| 6 | Star | Special items | (not used) |
| 7 | Key | Key items | `keyItems` pocket |

CSS background-position formula:
- X: `-(index * 26)px`
- Y: `0` for unselected, `-26px` for selected

## Browser Implementation Notes

For our browser version:
- 5 pocket tabs with L/R or click switching
- Scrollable item list per pocket
- Context menu on item select (2x2 grid)
- Item icon + name + quantity display
- "x99" quantity format
- Register key items to quick-use slot
- Berry info popup for berries pocket
- Maintain scroll/cursor position per pocket
