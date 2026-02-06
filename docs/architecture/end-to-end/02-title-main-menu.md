---
title: Title Screen & Main Menu System
status: reference
last_verified: 2026-01-13
---

# Title Screen & Main Menu System

## Source Files
- `src/title_screen.c` - Title screen implementation
- `src/main_menu.c` - Main menu implementation
- `include/title_screen.h` / `include/main_menu.h` - Headers

## Title Screen (title_screen.c)

### Entry Point
```c
void CB2_InitTitleScreen(void);
```

### Graphics Assets
```c
// Tilemaps and graphics
sTitleScreenRayquazaGfx[]      // Rayquaza background (4bpp LZ compressed)
sTitleScreenRayquazaTilemap[]  // Rayquaza tilemap (LZ compressed)
sTitleScreenLogoShineGfx[]     // Logo shine effect sprite
sTitleScreenCloudsGfx[]        // Background clouds
```

### Sprite Tags
```c
TAG_VERSION = 1000             // "Emerald Version" banner
TAG_PRESS_START_COPYRIGHT = 1001  // Press Start / Copyright text
TAG_LOGO_SHINE = 2002          // Logo shine sweep effect
```

### State Machine Phases

```
Task_TitleScreenPhase1
    │ - Load graphics, start fade in
    │ - Create version banner sprites
    │ - Start BGM (MUS_TITLE3 or MUS_TITLE - randomly chosen)
    ▼
Task_TitleScreenPhase2
    │ - Version banner slides down
    │ - Alpha blend animation
    │ - Create "Press Start" banner
    │ - Animate legendary markings color cycle
    ▼
Task_TitleScreenPhase3
    │ - Wait for input
    │ - Handle button combos:
    │   - A/Start → Main Menu
    │   - B+Select+Up → Clear Save Data
    │   - B+Select+Left → Reset RTC
    │   - B+Select → Berry Fix
    │ - Logo shine sweep animation
    │ - If idle too long → restart intro
    ▼
CB2_GoToMainMenu() or other
```

### Key Animations

#### Version Banner Slide-in
```c
// Banner starts at y=2, slides to y=66
#define VERSION_BANNER_Y       2
#define VERSION_BANNER_Y_GOAL  66

static void SpriteCB_VersionBannerLeft(struct Sprite *sprite) {
    if (sprite->y != VERSION_BANNER_Y_GOAL)
        sprite->y++;
    // Also handles alpha blending
    SetGpuReg(REG_OFFSET_BLDALPHA, gTitleScreenAlphaBlend[sprite->sAlphaBlendIdx]);
}
```

#### Alpha Blend Table
```c
// 64-entry table for smooth fade transitions
const u16 gTitleScreenAlphaBlend[64] = {
    BLDALPHA_BLEND(16, 0),  // Full source, no target
    BLDALPHA_BLEND(16, 1),
    // ... gradual transition
    BLDALPHA_BLEND(0, 16),  // No source, full target
};
```

#### Press Start Blinking
```c
static void SpriteCB_PressStartCopyrightBanner(struct Sprite *sprite) {
    if (sprite->sAnimate == TRUE) {
        // Toggle visibility every 16 frames
        if (++sprite->sTimer & 16)
            sprite->invisible = FALSE;
        else
            sprite->invisible = TRUE;
    }
}
```

#### Logo Shine Effect
```c
#define SHINE_SPEED 4

static void SpriteCB_PokemonLogoShine(struct Sprite *sprite) {
    if (sprite->x < DISPLAY_WIDTH + 32) {
        sprite->x += SHINE_SPEED;
        // Also modifies background color for flash effect
        if (sprite->x < DISPLAY_WIDTH / 2)
            sprite->sBgColor += 2;  // Brighten
        else
            sprite->sBgColor -= 2;  // Darken
    }
}
```

### Browser Implementation Notes

#### React Component Structure
```typescript
interface TitleScreenState {
  phase: 'loading' | 'phase1' | 'phase2' | 'phase3' | 'transition';
  versionBannerY: number;
  alphaBlendIndex: number;
  pressStartVisible: boolean;
  logoShineX: number;
  frameCounter: number;
}
```

#### Key Considerations
1. **Background Layers**: Use CSS z-index or canvas layers for clouds, Rayquaza, UI
2. **Sprite Animation**: Use requestAnimationFrame for smooth 60fps
3. **Alpha Blending**: CSS opacity or canvas globalAlpha
4. **Input Detection**: Keyboard events for A/Start equivalent
5. **Audio**: Web Audio API for BGM playback

---

## Main Menu (main_menu.c)

### Entry Point
```c
void CB2_InitMainMenu(void);      // Fresh entry
void CB2_ReinitMainMenu(void);    // Return from options
```

### Menu Types
```c
enum {
    HAS_NO_SAVED_GAME,   // NEW GAME, OPTION
    HAS_SAVED_GAME,      // CONTINUE, NEW GAME, OPTION
    HAS_MYSTERY_GIFT,    // CONTINUE, NEW GAME, MYSTERY GIFT, OPTION
    HAS_MYSTERY_EVENTS,  // CONTINUE, NEW GAME, MYSTERY GIFT, MYSTERY EVENTS, OPTION
};
```

### Menu Actions
```c
enum {
    ACTION_NEW_GAME,
    ACTION_CONTINUE,
    ACTION_OPTION,
    ACTION_MYSTERY_GIFT,
    ACTION_MYSTERY_EVENTS,
    ACTION_EREADER,
    ACTION_INVALID
};
```

### State Machine Flow

```
CB2_InitMainMenu / CB2_ReinitMainMenu
    │ - InitMainMenu() does setup
    │ - Load palettes, reset sprites
    │ - Create main menu task
    ▼
Task_MainMenuCheckSaveFile
    │ - Check gSaveFileStatus:
    │   - SAVE_STATUS_OK → show continue
    │   - SAVE_STATUS_CORRUPT → show error
    │   - SAVE_STATUS_EMPTY → new game only
    │ - If error, show message window
    ▼
Task_MainMenuCheckBattery
    │ - Check RTC battery status
    │ - If dry, show warning
    ▼
Task_DisplayMainMenu
    │ - Create menu windows based on menu type
    │ - Load saved game info (player name, time, badges, Pokedex)
    │ - Draw menu item borders
    ▼
Task_HighlightSelectedMainMenuItem
    │ - Set window highlight for current selection
    │ - Uses hardware window feature (WIN0H/WIN0V registers)
    ▼
Task_HandleMainMenuInput
    │ - A button → Task_HandleMainMenuAPressed
    │ - B button → Return to title screen
    │ - Up/Down → Change selection
    ▼
Task_HandleMainMenuAPressed
    │ - NEW GAME → Task_NewGameBirchSpeech_Init
    │ - CONTINUE → CB2_ContinueSavedGame
    │ - OPTIONS → CB2_InitOptionMenu
    │ - MYSTERY GIFT → CB2_InitMysteryGift
```

### Window Templates
```c
// Menu window positions
#define MENU_LEFT 2
#define MENU_WIDTH 26

// Different y positions for each window
#define MENU_TOP_WIN0 1   // NEW GAME (no save)
#define MENU_TOP_WIN1 5   // OPTIONS (no save)
#define MENU_TOP_WIN2 1   // CONTINUE (has save)
#define MENU_TOP_WIN3 9   // NEW GAME (has save)
#define MENU_TOP_WIN4 13  // OPTION / MYSTERY GIFT
#define MENU_TOP_WIN5 17  // OPTION / MYSTERY EVENTS
#define MENU_TOP_WIN6 21  // OPTION (with mystery events)
```

### Save Game Info Display
```c
static void MainMenu_FormatSavegameText(void) {
    MainMenu_FormatSavegamePlayer();   // "PLAYER: name"
    MainMenu_FormatSavegamePokedex();  // "POKéDEX: ###"
    MainMenu_FormatSavegameTime();     // "TIME: HHH:MM"
    MainMenu_FormatSavegameBadges();   // "BADGES: #"
}

// Example: Time formatting
ptr = ConvertIntToDecimalStringN(str, gSaveBlock2Ptr->playTimeHours, STR_CONV_MODE_LEFT_ALIGN, 3);
*ptr = 0xF0;  // Colon character
ConvertIntToDecimalStringN(ptr + 1, gSaveBlock2Ptr->playTimeMinutes, STR_CONV_MODE_LEADING_ZEROS, 2);
```

### Palette Colors
```c
// Menu highlight colors based on player gender
if (gSaveBlock2Ptr->playerGender == MALE)
    palette = RGB(4, 16, 31);   // Blue
else
    palette = RGB(31, 3, 21);   // Pink
```

### Browser Implementation Notes

#### State Interface
```typescript
interface MainMenuState {
  menuType: 'no_save' | 'has_save' | 'mystery_gift' | 'mystery_events';
  selectedItem: number;
  itemCount: number;
  isScrolled: boolean;
  saveInfo?: {
    playerName: string;
    playerGender: 'male' | 'female';
    playTimeHours: number;
    playTimeMinutes: number;
    pokedexCount: number;
    badgeCount: number;
  };
  errorMessage?: string;
}
```

#### Menu Item Rendering
```typescript
interface MenuItem {
  label: string;
  action: MenuAction;
  enabled: boolean;
}

const getMenuItems = (menuType: MenuType): MenuItem[] => {
  switch (menuType) {
    case 'no_save':
      return [
        { label: 'NEW GAME', action: 'new_game', enabled: true },
        { label: 'OPTION', action: 'option', enabled: true },
      ];
    case 'has_save':
      return [
        { label: 'CONTINUE', action: 'continue', enabled: true },
        { label: 'NEW GAME', action: 'new_game', enabled: true },
        { label: 'OPTION', action: 'option', enabled: true },
      ];
    // ...
  }
};
```

#### Key Implementation Details
1. **Window System**: Use bordered divs with Pokemon-style frame graphics
2. **Selection Highlight**: CSS highlighting with gender-based colors
3. **Save Detection**: Check localStorage for save data
4. **Error Windows**: Modal overlay for error messages
5. **Input Handling**:
   - Arrow keys for navigation
   - Enter/Z for A button
   - Escape/X for B button
