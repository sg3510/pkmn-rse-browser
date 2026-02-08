---
title: Birch Speech Intro Sequence
status: reference
last_verified: 2026-02-06
---

# Birch Speech Intro Sequence

The Professor Birch intro is the cutscene that plays when selecting "New Game", where Birch welcomes the player to the world of Pokemon.

## Source File
`src/main_menu.c` (BirchSpeech functions, lines ~1000+)

## Graphics Assets

Located in `graphics/birch_speech/`:

| File | Purpose |
|------|---------|
| `birch.png` | Professor Birch sprite (standing pose) |
| `shadow.png` | Shadow beneath character sprites |
| `map.bin` | Tilemap for background |
| `bg0.pal`, `bg1.pal`, `bg2.pal` | Background palettes |
| `unused_beauty.png` | Unused female trainer sprite |

## Sequence Flow

```
1. Fade in Birch background
       ↓
2. Birch sprite slides in
       ↓
3. "Hi! Sorry to keep you waiting!"
       ↓
4. Birch explains Pokemon world
       ↓
5. Shows Pokeball, releases Pokemon
       ↓
6. "This is a POKEMON..."
       ↓
7. "Are you a boy? Or are you a girl?"
       ↓
8. Player selects gender → Character sprite shown
       ↓
9. "What's your name?"
       ↓
10. Name entry screen
       ↓
11. "So it's [NAME]?"
       ↓
12. Confirm name or re-enter
       ↓
13. Shrink sprite animation
       ↓
14. "Your very own POKEMON legend..."
       ↓
15. Fade out → Warp to InsideOfTruck map
```

## Text Data

From `data/text/birch_speech.inc`:

```
gText_Birch_Welcome:
    "Hi! Sorry to keep you waiting!\p"
    "Welcome to the world of POKéMON!\p"
    "My name is BIRCH.\p"
    "But everyone calls me the POKéMON PROFESSOR.\p"

gText_Birch_Pokemon:
    "This is what we call a "POKéMON."\p"
    "This world is widely inhabited by\n"
    "creatures known as POKéMON.\p"
    "We humans live alongside POKéMON,\n"
    "at times as friendly playmates, and\l"
    "at times as Pokemon battlers.\p"

gText_Birch_Pokemon2:
    "But despite our Pokemon knowledge,\n"
    "there's still much we don't know.\p"
    "There are still Pokemon mysteries\n"
    "to be solved.\p"
    "That's why I study POKéMON every\n"
    "day.\p"

gText_Birch_MainSpeech:
    "Now...\p"
    "What about you?\p"
    "Are you a boy?\n"
    "Or are you a girl?\p"

gText_Birch_AndYouAre:
    "All right...\p"
    "What's your name?\p"

gText_Birch_BoyOrGirl:
    "Alright.\n"
    "Are you ready?\p"
    "Your very own POKéMON legend is\n"
    "about to unfold!\p"
    "A world of dreams and adventures\n"
    "with POKéMON awaits! Let's go!$"
```

## Player/Gender Selection

After selecting gender, the game shows the appropriate character sprite:

- **Male**: Brendan sprite (`gIntroBrendan_Gfx`)
- **Female**: May sprite (`gIntroMay_Gfx`)

## Name Entry

The name entry uses a standard keyboard interface:
- Max length: 7 characters (PLAYER_NAME_LENGTH)
- Preset names available for quick selection

Current TS implementation note:
- Birch naming currently uses the shared dialog component text-entry mode (framed dialog box + typed input) rather than a standalone naming-screen state.

## State Management

The Birch Speech uses internal callback states within `main_menu.c`:

```c
// Key task functions (approximate)
static void Task_NewGameBirchSpeech_Init(u8 taskId);
static void Task_NewGameBirchSpeech_WelcomeMsg(u8 taskId);
static void Task_NewGameBirchSpeech_WaitPressedA(u8 taskId);
static void Task_NewGameBirchSpeech_GenderQuery(u8 taskId);
static void Task_NewGameBirchSpeech_NameQuery(u8 taskId);
static void Task_NewGameBirchSpeech_ShrinkPlayer(u8 taskId);
static void Task_NewGameBirchSpeech_Finish(u8 taskId);
```

## Animations

1. **Birch Entry**: Slides in from right side of screen
2. **Pokeball Throw**: Birch tosses ball, Pokemon appears
3. **Gender Selection**: Shows boy/girl sprite choices
4. **Player Sprite Shrink**: After confirmation, player sprite shrinks down
5. **Fade to Black**: Transition to truck scene

## Transition to Truck

When the intro completes:
1. `ResetInitialPlayerAvatarState()` - Reset avatar
2. `SetWarpDestination()` - Set destination to `MAP_INSIDE_OF_TRUCK`
3. `DoWarp()` - Execute the warp
4. Player wakes up inside the moving truck

## Key Constants

```c
#define PLAYER_NAME_LENGTH 7
#define BIRCH_SPEECH_PLATFORM_GFX_TAG 0x1000
```

## Related Functions

| Function | Purpose |
|----------|---------|
| `CB2_NewGame()` | Entry point for new game |
| `Task_NewGameBirchSpeech_*()` | Birch speech state machine |
| `CreateBirchSprite()` | Create Prof. Birch sprite |
| `CreatePlayerSprite()` | Create selected gender sprite |
| `DoNamingScreen()` | Launch name entry |
