# Professor Birch Intro Speech Sequence

## Source File
- `src/main_menu.c` (lines ~1265-2200)

## Overview

When the player selects "NEW GAME" from the main menu, they enter the Professor Birch intro sequence. This is a complex animated sequence with:

- Multiple sprite characters (Birch, Lotad, Brendan/May)
- Background platform sliding animations
- Alpha blending fade effects
- Text dialogue with user input
- Gender selection menu
- Name input screen integration
- Sprite shrink animation at the end

## Entry Point

```c
// Called when ACTION_NEW_GAME is selected
gTasks[taskId].func = Task_NewGameBirchSpeech_Init;
```

## Task Data Structure

```c
// Task data indices used throughout the sequence
#define tPlayerSpriteId   data[2]
#define tBG1HOFS          data[4]   // Background horizontal offset
#define tIsDoneFadingSprites data[5]
#define tPlayerGender     data[6]
#define tTimer            data[7]
#define tBirchSpriteId    data[8]
#define tLotadSpriteId    data[9]
#define tBrendanSpriteId  data[10]
#define tMaySpriteId      data[11]
```

## Complete State Machine

### Phase 1: Initialization

```c
Task_NewGameBirchSpeech_Init(u8 taskId)
{
    // 1. Reset GPU registers
    SetGpuReg(REG_OFFSET_DISPCNT, 0);
    SetGpuReg(REG_OFFSET_DISPCNT, DISPCNT_OBJ_ON | DISPCNT_OBJ_1D_MAP);

    // 2. Load background graphics
    LZ77UnCompVram(sBirchSpeechShadowGfx, (void *)VRAM);
    LZ77UnCompVram(sBirchSpeechBgMap, (void *)(BG_SCREEN_ADDR(7)));
    LoadPalette(sBirchSpeechBgPals, BG_PLTT_ID(0), 2 * PLTT_SIZE_4BPP);

    // 3. Create all sprites (invisible initially)
    AddBirchSpeechObjects(taskId);

    // 4. Start fade from black
    BeginNormalPaletteFade(PALETTES_ALL, 0, 16, 0, RGB_BLACK);

    // 5. Start background music
    PlayBGM(MUS_ROUTE122);

    // 6. Set initial timer (216 frames delay)
    gTasks[taskId].tTimer = 0xD8;
    gTasks[taskId].func = Task_NewGameBirchSpeech_WaitToShowBirch;
}
```

### Sprite Creation

```c
static void AddBirchSpeechObjects(u8 taskId)
{
    // Professor Birch sprite (using special object)
    birchSpriteId = AddNewGameBirchObject(0x88, 0x3C, 1);
    gSprites[birchSpriteId].invisible = TRUE;
    gTasks[taskId].tBirchSpriteId = birchSpriteId;

    // Lotad sprite (front sprite)
    lotadSpriteId = CreateMonPicSprite_Affine(SPECIES_LOTAD, ...);
    gSprites[lotadSpriteId].invisible = TRUE;
    gTasks[taskId].tLotadSpriteId = lotadSpriteId;

    // Brendan player sprite
    brendanSpriteId = CreateTrainerSprite(FacilityClassToPicIndex(FACILITY_CLASS_BRENDAN), ...);
    gSprites[brendanSpriteId].invisible = TRUE;
    gTasks[taskId].tBrendanSpriteId = brendanSpriteId;

    // May player sprite
    maySpriteId = CreateTrainerSprite(FacilityClassToPicIndex(FACILITY_CLASS_MAY), ...);
    gSprites[maySpriteId].invisible = TRUE;
    gTasks[taskId].tMaySpriteId = maySpriteId;
}
```

### Phase 2: Show Birch & Welcome

```c
Task_NewGameBirchSpeech_WaitToShowBirch
    │ - Wait for tTimer to reach 0
    │ - Make Birch sprite visible at (136, 60)
    │ - Set objMode to ST_OAM_OBJ_BLEND
    │ - Start fade-in animation (target1 out, target2 in)
    │ - Start platform fade out
    ▼
Task_NewGameBirchSpeech_WaitForSpriteFadeInWelcome
    │ - Wait for tIsDoneFadingSprites
    │ - Set Birch objMode back to normal
    │ - Initialize text windows
    │ - Print: "Hi! Sorry to keep you waiting!"
    │         "Welcome to the world of POKéMON!"
    ▼
Task_NewGameBirchSpeech_ThisIsAPokemon
    │ - Wait for text to finish
    │ - Print: "This is what we call a 'POKéMON.'"
    │ - Spawn sub-task for Pokeball animation
    ▼
```

### Pokeball Sub-task (Parallel Animation)

```c
Task_NewGameBirchSpeechSub_InitPokeBall(u8 taskId)
{
    // Position Lotad sprite
    gSprites[spriteId].x = 100;
    gSprites[spriteId].y = 75;
    gSprites[spriteId].invisible = FALSE;

    // Create Pokeball release animation
    CreatePokeballSpriteToReleaseMon(spriteId, ...);
}

Task_NewGameBirchSpeechSub_WaitForLotad
    // Wait for Pokeball animation to complete
    // Self-destructs when done
```

### Phase 3: Transition to Player Selection

```c
Task_NewGameBirchSpeech_MainSpeech
    │ - Print main explanation text
    │   "We share this world with creatures..."
    ▼
Task_NewGameBirchSpeech_AndYouAre
    │ - Print: "And you are?"
    ▼
Task_NewGameBirchSpeech_StartBirchLotadPlatformFade
    │ - Set Birch and Lotad to blend mode
    │ - Start fading them out
    │ - Start platform fade in (reverse)
    ▼
Task_NewGameBirchSpeech_SlidePlatformAway
    │ - Slide BG1 horizontal offset from 0 to -60
    │   (2 pixels per frame)
    ▼
Task_NewGameBirchSpeech_StartPlayerFadeIn
    │ - Hide Birch and Lotad sprites
    │ - Show Brendan sprite at (180, 60)
    │ - Set to blend mode
    │ - Start fade in
    │ - Set tPlayerGender = MALE
    ▼
Task_NewGameBirchSpeech_WaitForPlayerFadeIn
    │ - Wait for fade complete
    ▼
```

### Phase 4: Gender Selection

```c
Task_NewGameBirchSpeech_BoyOrGirl
    │ - Clear window
    │ - Print: "Are you a boy? Or are you a girl?"
    ▼
Task_NewGameBirchSpeech_WaitToShowGenderMenu
    │ - Wait for text
    │ - Show gender menu (BOY / GIRL)
    ▼
Task_NewGameBirchSpeech_ChooseGender
    │ - Process menu input
    │ - If selection changes:
    │     → Task_NewGameBirchSpeech_SlideOutOldGenderSprite
    │ - If A pressed on BOY/GIRL:
    │     - Set gSaveBlock2Ptr->playerGender
    │     - Clear gender window
    │     → Task_NewGameBirchSpeech_WhatsYourName
```

### Gender Change Animation

```c
Task_NewGameBirchSpeech_SlideOutOldGenderSprite
    │ - Slide current sprite right (x += 4 per frame)
    │ - Start fade out
    │ - When done fading:
    │     - Hide old sprite
    │     - Show new sprite at x=DISPLAY_WIDTH
    ▼
Task_NewGameBirchSpeech_SlideInNewGenderSprite
    │ - Slide sprite left (x -= 4) until x=180
    │ - When at position and fade complete:
    │     → Return to Task_NewGameBirchSpeech_ChooseGender
```

### Phase 5: Name Selection

```c
Task_NewGameBirchSpeech_WhatsYourName
    │ - Print: "All right. What's your name?"
    ▼
Task_NewGameBirchSpeech_WaitForWhatsYourNameToPrint
    ▼
Task_NewGameBirchSpeech_WaitPressBeforeNameChoice
    │ - Wait for A or B press
    │ - Start fade to black
    ▼
Task_NewGameBirchSpeech_StartNamingScreen
    │ - Free resources
    │ - Set random default name
    │ - Call DoNamingScreen(NAMING_SCREEN_PLAYER, ...)
    │ - Callback: CB2_NewGameBirchSpeech_ReturnFromNamingScreen
```

### Phase 6: Name Confirmation

```c
CB2_NewGameBirchSpeech_ReturnFromNamingScreen
    │ - Reinitialize Birch speech background
    │ - Recreate all sprites
    │ - Show player sprite based on gender
    ▼
Task_NewGameBirchSpeech_ReturnFromNamingScreenShowTextbox
    ▼
Task_NewGameBirchSpeech_SoItsPlayerName
    │ - Print: "So it's {PLAYER}?"
    ▼
Task_NewGameBirchSpeech_CreateNameYesNo
    │ - Show YES/NO menu
    ▼
Task_NewGameBirchSpeech_ProcessNameYesNoMenu
    │ - YES: → Task_NewGameBirchSpeech_SlidePlatformAway2
    │ - NO:  → Task_NewGameBirchSpeech_BoyOrGirl (restart)
```

### Phase 7: Finale

```c
Task_NewGameBirchSpeech_SlidePlatformAway2
    │ - Slide BG1HOFS back to 0
    ▼
Task_NewGameBirchSpeech_ReshowBirchLotad
    │ - Hide player sprites
    │ - Show Birch and Lotad again
    │ - Print: "{PLAYER}, are you ready?"
    ▼
Task_NewGameBirchSpeech_WaitForSpriteFadeInAndTextPrinter
    │ - Wait for both fade and text
    │ - Start fading Birch/Lotad out
    ▼
Task_NewGameBirchSpeech_AreYouReady
    │ - Hide Birch and Lotad
    │ - Show player sprite at center (120, 60)
    │ - Print: "Your very own adventure is about to unfold..."
    ▼
Task_NewGameBirchSpeech_ShrinkPlayer
    │ - Start affine shrink animation
    │ - Start BG fade to black
    │ - Fade out music
    ▼
Task_NewGameBirchSpeech_WaitForPlayerShrink
    │ - Wait for affine animation to end
    ▼
Task_NewGameBirchSpeech_FadePlayerToWhite
    │ - Start palette fade to white (objects only)
    ▼
Task_NewGameBirchSpeech_Cleanup
    │ - Free resources
    │ - SetMainCallback2(CB2_NewGame)
```

## Animation Details

### Alpha Blending System

```c
// Fade sprite out while platform fades in
static void NewGameBirchSpeech_StartFadeOutTarget1InTarget2(u8 taskId, u8 delay)
{
    SetGpuReg(REG_OFFSET_BLDCNT, BLDCNT_TGT2_BG1 | BLDCNT_EFFECT_BLEND | BLDCNT_TGT1_OBJ);
    SetGpuReg(REG_OFFSET_BLDALPHA, BLDALPHA_BLEND(16, 0));
    // Creates sub-task that gradually changes blend
}

// Sub-task decrements alpha coefficients
static void Task_NewGameBirchSpeech_FadeOutTarget1InTarget2(u8 taskId)
{
    if (gTasks[taskId].tAlphaCoeff1 == 0) {
        // Done fading
        gTasks[gTasks[taskId].tMainTask].tIsDoneFadingSprites = TRUE;
        DestroyTask(taskId);
    } else {
        gTasks[taskId].tAlphaCoeff1--;
        gTasks[taskId].tAlphaCoeff2++;
        SetGpuReg(REG_OFFSET_BLDALPHA, ...);
    }
}
```

### Platform Gradient Animation

```c
// 8-step gradient palette for platform background
static const u16 sBirchSpeechBgGradientPal[] = { ... };

// Fade platform in (index 0→8)
static void Task_NewGameBirchSpeech_FadePlatformIn(u8 taskId)
{
    gTasks[taskId].tPalIndex++;
    LoadPalette(&sBirchSpeechBgGradientPal[tPalIndex], BG_PLTT_ID(0) + 1, ...);
}
```

### Player Shrink Animation

```c
static const union AffineAnimCmd sSpriteAffineAnim_PlayerShrink[] = {
    AFFINEANIMCMD_FRAME(-2, -2, 0, 0x30),  // Shrink over 48 frames
    AFFINEANIMCMD_END
};

// Also moves sprite down while shrinking
static void SpriteCB_MovePlayerDownWhileShrinking(struct Sprite *sprite)
{
    u32 y = (sprite->y << 16) + sprite->data[0] + 0xC000;
    sprite->y = y >> 16;
    sprite->data[0] = y;
}
```

## Text Strings Used

```c
gText_Birch_Welcome          // "Hi! Sorry to keep you waiting!"
gText_ThisIsAPokemon         // "This is what we call a 'POKéMON.'"
gText_Birch_MainSpeech       // "We share this world with creatures..."
gText_Birch_AndYouAre        // "And you are?"
gText_Birch_BoyOrGirl        // "Are you a boy? Or are you a girl?"
gText_Birch_WhatsYourName    // "All right. What's your name?"
gText_Birch_SoItsPlayer      // "So it's {PLAYER}?"
gText_Birch_YourePlayer      // "{PLAYER}, are you ready?"
gText_Birch_AreYouReady      // "Your very own adventure is about to unfold..."
```

## Browser Implementation

### State Interface

```typescript
interface BirchSpeechState {
  phase: BirchSpeechPhase;
  frameCounter: number;

  // Sprites
  birchSprite: SpriteState;
  lotadSprite: SpriteState;
  playerSprite: SpriteState;
  pokeballSprite?: SpriteState;

  // Animation state
  bgHorizontalOffset: number;
  alphaBlend: { coeff1: number; coeff2: number };
  platformPaletteIndex: number;
  isFadingSprites: boolean;

  // Player selection
  selectedGender: 'male' | 'female';
  playerName: string;

  // UI state
  currentText: string;
  textComplete: boolean;
  showGenderMenu: boolean;
  showNameConfirmMenu: boolean;
}

type BirchSpeechPhase =
  | 'init'
  | 'wait_to_show_birch'
  | 'welcome'
  | 'this_is_pokemon'
  | 'main_speech'
  | 'and_you_are'
  | 'slide_platform'
  | 'show_player'
  | 'boy_or_girl'
  | 'choose_gender'
  | 'whats_your_name'
  | 'naming_screen'
  | 'confirm_name'
  | 'finale_reshow'
  | 'shrink_player'
  | 'cleanup';
```

### Animation Helpers

```typescript
// Alpha blend interpolation
const updateAlphaBlend = (state: BirchSpeechState, delta: number): void => {
  if (state.alphaBlend.coeff1 > 0) {
    state.alphaBlend.coeff1 = Math.max(0, state.alphaBlend.coeff1 - delta);
    state.alphaBlend.coeff2 = Math.min(16, state.alphaBlend.coeff2 + delta);
  }
};

// Sprite slide animation
const slideSprite = (sprite: SpriteState, targetX: number, speed: number): boolean => {
  if (sprite.x > targetX) {
    sprite.x = Math.max(targetX, sprite.x - speed);
    return false;
  } else if (sprite.x < targetX) {
    sprite.x = Math.min(targetX, sprite.x + speed);
    return false;
  }
  return true; // At target
};

// Affine shrink (using CSS transform)
const getShrinkTransform = (progress: number): string => {
  const scale = 1 - (progress * 0.75); // 100% → 25%
  return `scale(${scale})`;
};
```

### Component Structure

```typescript
const BirchSpeechScreen: React.FC = () => {
  const [state, dispatch] = useReducer(birchSpeechReducer, initialState);

  useGameLoop((deltaTime) => {
    dispatch({ type: 'TICK', deltaTime });
  });

  return (
    <div className="birch-speech-screen">
      <BirchBackground offset={state.bgHorizontalOffset} />
      <Platform paletteIndex={state.platformPaletteIndex} />

      {state.birchSprite.visible && (
        <BirchSprite
          {...state.birchSprite}
          alpha={state.alphaBlend.coeff1 / 16}
        />
      )}

      {state.lotadSprite.visible && (
        <LotadSprite
          {...state.lotadSprite}
          alpha={state.alphaBlend.coeff1 / 16}
        />
      )}

      {state.playerSprite.visible && (
        <PlayerSprite
          {...state.playerSprite}
          gender={state.selectedGender}
          shrinkProgress={state.shrinkProgress}
        />
      )}

      <DialogueBox
        text={state.currentText}
        onComplete={() => dispatch({ type: 'TEXT_COMPLETE' })}
      />

      {state.showGenderMenu && (
        <GenderMenu
          selected={state.selectedGender}
          onSelect={(g) => dispatch({ type: 'SELECT_GENDER', gender: g })}
        />
      )}

      {state.showNameConfirmMenu && (
        <YesNoMenu
          onYes={() => dispatch({ type: 'CONFIRM_NAME' })}
          onNo={() => dispatch({ type: 'REJECT_NAME' })}
        />
      )}
    </div>
  );
};
```
