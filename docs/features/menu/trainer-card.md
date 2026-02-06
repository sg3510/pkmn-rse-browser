---
title: Trainer Card Technical Reference
status: reference
last_verified: 2026-01-13
---

# Trainer Card Technical Reference

Technical analysis of pokeemerald's Trainer Card implementation.

## Source Files

| File | Purpose |
|------|---------|
| `src/trainer_card.c` | Card display, flip animation, rendering |
| `include/trainer_card.h` | Data structures |
| `graphics/trainer_card/` | Card graphics and palettes |

## Data Structure

```c
struct TrainerCard {  // 0x64 bytes total
    u8 gender;                      // 0=Male, 1=Female
    u8 stars;                       // 0-4 achievement stars
    bool8 hasPokedex;
    bool8 caughtAllHoenn;
    bool8 hasAllPaintings;          // Contest paintings
    u16 hofDebutHours;              // Hall of Fame time
    u16 hofDebutMinutes;
    u16 hofDebutSeconds;
    u16 caughtMonsCount;            // Pokedex caught count
    u16 trainerId;                  // Visible trainer ID
    u16 playTimeHours;
    u16 playTimeMinutes;
    u16 linkBattleWins;
    u16 linkBattleLosses;
    u16 battleTowerWins;
    u16 battleTowerStraightWins;
    u16 contestsWithFriends;
    u16 pokeblocksWithFriends;
    u16 pokemonTrades;
    u32 money;
    u16 easyChatProfile[4];         // 4 easy chat words
    u8 playerName[8];
    u8 version;                     // Game version
    bool16 hasAllFrontierSymbols;
    u16 frontierBP;                 // Battle Points
};
```

## Front of Card - Displayed Data

| Data | Position | Notes |
|------|----------|-------|
| Player Name | (16, 33) | Hoenn style |
| Trainer ID | Center-aligned | 5-digit with leading zeros |
| Money | Right-aligned | With ¥ symbol |
| Pokedex Count | Right-aligned | Only if has Pokedex |
| Play Time | (x, y) | Format: `HHH:MM` with blinking colon |

## Back of Card - Displayed Data

| Data | Condition |
|------|-----------|
| "{Name}'s Trainer Card" | Always |
| Hall of Fame Time | If entered HOF |
| Link Battle W/L | Always |
| Pokemon Trades | If trades > 0 |
| Pokeblocks Made | If count > 0 |
| Contests Won | If count > 0 |
| Battle Points | Emerald only |

## Star System (Progression)

Stars are awarded for achievements (0-4 total):

| Star | Achievement |
|------|-------------|
| 1st | Entered Hall of Fame |
| 2nd | Caught all Hoenn Pokemon |
| 3rd | Won all 5 Contest Categories (paintings) |
| 4th | Obtained all Frontier Symbols |

```c
static u8 CountPlayerTrainerStars(void) {
    u8 stars = 0;
    if (GetGameStat(GAME_STAT_ENTERED_HOF) != 0)
        stars++;
    if (HasAllHoennMons())
        stars++;
    if (HasAllFrontierSymbols())
        stars++;
    if (HasAllPaintings())
        stars++;
    return stars;
}
```

## Card Color Palettes (Based on Stars)

### Hoenn Card Colors
| Stars | Color |
|-------|-------|
| 0 | Green |
| 1 | Bronze |
| 2 | Copper |
| 3 | Silver |
| 4 | Gold |

### Palette Files
```
graphics/trainer_card/
├── green.gbapal      # 0 stars (default)
├── bronze.gbapal     # 1 star
├── copper.gbapal     # 2 stars
├── silver.gbapal     # 3 stars
├── gold.gbapal       # 4 stars
└── female_bg.gbapal  # Female variant
```

## Badge Display

- 8 gym badges displayed in grid (bottom right)
- 2x2 tiles per badge (32x32 pixels)
- Only shown on front, not link cards
- Visibility: `FLAG_BADGE01_GET` through `FLAG_BADGE08_GET`

```c
static void DrawBadgesOnCard(void) {
    // Tile numbers start at 192, +2 per badge
    // X spacing: 3 tiles between badges
    // Y position: Row 15-16
    for (i = 0; i < NUM_BADGES; i++) {
        if (FlagGet(FLAG_BADGE01_GET + i))
            DrawBadgeTiles(i);
    }
}
```

## Card Flip Animation

### State Machine

```c
static bool8 (*const sTrainerCardFlipTasks[])(struct Task *) = {
    Task_BeginCardFlip,          // State 0: Setup
    Task_AnimateCardFlipDown,    // State 1: Card moves to center
    Task_DrawFlippedCardSide,    // State 2: Draw opposite side
    Task_SetCardFlipped,         // State 3: Finalize
    Task_AnimateCardFlipUp,      // State 4: Card moves back
    Task_EndCardFlip,            // State 5: Cleanup
};
```

### Animation Details

**Flip Down (State 1):**
- Card moves down to center (Y = 75 pixels)
- Increment: +7 pixels per frame
- Uses per-scanline offset for 3D perspective effect

**Flip Up (State 4):**
- Card moves back up
- Decrement: -5 pixels per frame
- Mirror of flip down animation

### Scanline Effect (3D Perspective)
```c
// Uses HBlank callback for per-scanline Y offset
// Creates card "squish" effect during flip
gScanlineEffectRegBuffers[0][scanline] = offset;
```

## Input State Machine

```
FRONT -> A button -> Flip to BACK
FRONT -> B button -> Close card

BACK  -> A button -> Close card
BACK  -> B button -> Flip to FRONT
```

## Graphics Assets

```
graphics/trainer_card/
├── tiles.png           # Card tile graphics
├── tiles.4bpp.lz       # Compressed tiles
├── front.bin.lz        # Front tilemap
├── back.bin.lz         # Back tilemap
├── bg.bin.lz           # Background tilemap
├── badges.png          # Badge graphics
└── badges.4bpp.lz      # Compressed badges
```

## Browser Implementation Notes

For our browser version:
- Store card data in SaveManager
- Calculate stars from game flags/stats
- Implement CSS 3D flip animation with `transform: rotateY()`
- Badge icons from sprite sheet
- Blinking colon using CSS animation or timer
- Card color via CSS custom properties based on star count
