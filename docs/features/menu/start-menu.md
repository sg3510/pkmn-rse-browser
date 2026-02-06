---
title: Start Menu Technical Reference
status: reference
last_verified: 2026-01-13
---

# Start Menu Technical Reference

Technical analysis of pokeemerald's start menu implementation for browser recreation.

## Source Files

| File | Purpose |
|------|---------|
| `src/start_menu.c` | Main menu logic, item visibility, callbacks |
| `include/start_menu.h` | Header definitions |

## Menu Items

```c
enum {
    MENU_ACTION_POKEDEX,      // Requires FLAG_SYS_POKEDEX_GET
    MENU_ACTION_POKEMON,      // Requires FLAG_SYS_POKEMON_GET
    MENU_ACTION_BAG,          // Always visible
    MENU_ACTION_POKENAV,      // Requires FLAG_SYS_POKENAV_GET
    MENU_ACTION_PLAYER,       // Always visible (Trainer Card)
    MENU_ACTION_SAVE,         // Always visible
    MENU_ACTION_OPTION,       // Always visible
    MENU_ACTION_EXIT,         // Always visible
    MENU_ACTION_RETIRE_SAFARI,    // Safari Zone only
    MENU_ACTION_PLAYER_LINK,      // Link mode only
    MENU_ACTION_REST_FRONTIER,    // Battle Frontier only
    MENU_ACTION_RETIRE_FRONTIER,  // Battle Frontier only
    MENU_ACTION_PYRAMID_BAG       // Battle Pyramid only
};
```

## Menu Item Definitions

```c
static const struct MenuAction sStartMenuItems[] = {
    [MENU_ACTION_POKEDEX] = {gText_MenuPokedex, {.u8_void = StartMenuPokedexCallback}},
    [MENU_ACTION_POKEMON] = {gText_MenuPokemon, {.u8_void = StartMenuPokemonCallback}},
    [MENU_ACTION_BAG]     = {gText_MenuBag,     {.u8_void = StartMenuBagCallback}},
    [MENU_ACTION_POKENAV] = {gText_MenuPokenav, {.u8_void = StartMenuPokeNavCallback}},
    [MENU_ACTION_PLAYER]  = {gText_MenuPlayer,  {.u8_void = StartMenuPlayerNameCallback}},
    [MENU_ACTION_SAVE]    = {gText_MenuSave,    {.u8_void = StartMenuSaveCallback}},
    [MENU_ACTION_OPTION]  = {gText_MenuOption,  {.u8_void = StartMenuOptionCallback}},
    [MENU_ACTION_EXIT]    = {gText_MenuExit,    {.u8_void = StartMenuExitCallback}},
};
```

## Conditional Visibility Logic

The menu is built dynamically based on game state:

```c
static void BuildNormalStartMenu(void) {
    // Pokedex - only after receiving it
    if (FlagGet(FLAG_SYS_POKEDEX_GET) == TRUE)
        AddStartMenuAction(MENU_ACTION_POKEDEX);

    // Pokemon - only after receiving starter
    if (FlagGet(FLAG_SYS_POKEMON_GET) == TRUE)
        AddStartMenuAction(MENU_ACTION_POKEMON);

    // Bag - always available
    AddStartMenuAction(MENU_ACTION_BAG);

    // PokeNav - only after receiving it
    if (FlagGet(FLAG_SYS_POKENAV_GET) == TRUE)
        AddStartMenuAction(MENU_ACTION_POKENAV);

    // Always visible
    AddStartMenuAction(MENU_ACTION_PLAYER);
    AddStartMenuAction(MENU_ACTION_SAVE);
    AddStartMenuAction(MENU_ACTION_OPTION);
    AddStartMenuAction(MENU_ACTION_EXIT);
}
```

## Context-Specific Menus

Different menus for special game areas:

```c
static void BuildStartMenuActions(void) {
    if (IsOverworldLinkActive() == TRUE)
        BuildLinkModeStartMenu();
    else if (InUnionRoom() == TRUE)
        BuildUnionRoomStartMenu();
    else if (GetSafariZoneFlag() == TRUE)
        BuildSafariZoneStartMenu();      // Has "Retire" option
    else if (InBattlePike())
        BuildBattlePikeStartMenu();
    else if (CurrentBattlePyramidLocation() != PYRAMID_LOCATION_NONE)
        BuildBattlePyramidStartMenu();   // Has "Pyramid Bag"
    else if (InMultiPartnerRoom())
        BuildMultiPartnerRoomStartMenu();
    else
        BuildNormalStartMenu();
}
```

## Internal State

```c
static u8 sCurrentStartMenuActions[9];  // Max 9 menu items
static u8 sNumStartMenuActions;         // Current item count
static u8 sStartMenuCursorPos;          // Cursor position (0-indexed)
```

## Input Handling

```c
// Return values
#define MENU_NOTHING_CHOSEN -2   // Still navigating
#define MENU_B_PRESSED      -1   // Cancel (B button)
// >= 0: Selected item index

s8 Menu_ProcessInput(void) {
    if (JOY_NEW(A_BUTTON)) {
        PlaySE(SE_SELECT);
        return sMenu.cursorPos;      // Return selected index
    }
    else if (JOY_NEW(B_BUTTON)) {
        return MENU_B_PRESSED;       // Cancel
    }
    else if (JOY_NEW(DPAD_UP)) {
        PlaySE(SE_SELECT);
        Menu_MoveCursor(-1);         // Move up (with wrap)
        return MENU_NOTHING_CHOSEN;
    }
    else if (JOY_NEW(DPAD_DOWN)) {
        PlaySE(SE_SELECT);
        Menu_MoveCursor(1);          // Move down (with wrap)
        return MENU_NOTHING_CHOSEN;
    }
    return MENU_NOTHING_CHOSEN;
}
```

## Cursor Movement

```c
u8 Menu_MoveCursor(s8 cursorDelta) {
    u8 oldPos = sMenu.cursorPos;
    int newPos = sMenu.cursorPos + cursorDelta;

    // Wrap around
    if (newPos < sMenu.minCursorPos)
        sMenu.cursorPos = sMenu.maxCursorPos;  // Wrap to bottom
    else if (newPos > sMenu.maxCursorPos)
        sMenu.cursorPos = sMenu.minCursorPos;  // Wrap to top
    else
        sMenu.cursorPos += cursorDelta;

    RedrawMenuCursor(oldPos, sMenu.cursorPos);
    return sMenu.cursorPos;
}
```

## Browser Implementation Notes

For our browser version:
- Menu items stored in array with visibility flags
- Check `gameFlags.isSet()` for conditional items
- Cursor wraps at top/bottom
- Play `SE_SELECT` sound on navigation
- A = confirm, B = cancel
- Arrow keys / WASD for navigation
- Mouse click on items for selection
