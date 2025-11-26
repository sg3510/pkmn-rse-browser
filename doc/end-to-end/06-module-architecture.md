# Module Architecture for Browser Implementation

## Overview

This document outlines the recommended module architecture for implementing Pokemon Emerald's startup sequence in a browser-based TypeScript/React environment.

## Core Architecture Principles

### 1. State Machine Pattern

The original game uses a task-based state machine where each state calls the next. For React, use a reducer-based approach:

```typescript
// Generic state machine pattern
interface StateMachine<State, Action> {
  currentState: State;
  dispatch: (action: Action) => void;
}

// Usage in component
const [state, dispatch] = useReducer(reducer, initialState);
```

### 2. Game Loop Integration

The GBA runs at 60fps. Use `requestAnimationFrame` for consistent timing:

```typescript
const useGameLoop = (callback: (deltaTime: number) => void) => {
  const frameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const loop = (time: number) => {
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Target 60fps (16.67ms per frame)
      callback(delta / 16.67);

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current!);
  }, [callback]);
};
```

### 3. Callback2 Equivalent

Replace GBA's CB2 callbacks with React Router or context-based routing:

```typescript
type GameScreen =
  | { type: 'title_screen' }
  | { type: 'main_menu' }
  | { type: 'birch_speech' }
  | { type: 'naming_screen'; returnTo: GameScreen }
  | { type: 'overworld' }
  | { type: 'truck_sequence' };

const GameContainer: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>({ type: 'title_screen' });

  const renderScreen = () => {
    switch (currentScreen.type) {
      case 'title_screen':
        return <TitleScreen onStart={() => setCurrentScreen({ type: 'main_menu' })} />;
      case 'main_menu':
        return <MainMenu
          onNewGame={() => setCurrentScreen({ type: 'birch_speech' })}
          onContinue={() => setCurrentScreen({ type: 'overworld' })}
        />;
      // ...
    }
  };

  return <div className="game-container">{renderScreen()}</div>;
};
```

## Module Breakdown

### Module 1: GameStateManager

**Purpose**: Central game state and screen management

**Key Responsibilities**:
- Track current game screen (title, menu, overworld, etc.)
- Manage transitions between screens
- Handle global game events

**Files**:
```
src/core/
  GameStateManager.tsx
  GameContext.tsx
  types.ts
```

**Interface**:
```typescript
interface GameStateContext {
  currentScreen: GameScreen;
  transitionTo: (screen: GameScreen) => void;
  fadeState: 'none' | 'fade_out' | 'black' | 'fade_in';
  startFadeTransition: (toScreen: GameScreen, color?: 'black' | 'white') => void;
}
```

---

### Module 2: TitleScreenModule

**Purpose**: Title screen with Rayquaza animation and input handling

**C Source Reference**: `src/title_screen.c`

**Key Features**:
- Animated background (clouds, Rayquaza)
- Version banner slide-in animation
- "Press Start" blinking text
- Logo shine sweep effect
- Input detection (Start → Menu, combo keys → special screens)

**Files**:
```
src/screens/title/
  TitleScreen.tsx
  TitleScreenState.ts
  components/
    RayquazaBackground.tsx
    VersionBanner.tsx
    PressStartBanner.tsx
    LogoShine.tsx
```

---

### Module 3: MainMenuModule

**Purpose**: Main menu UI (New Game, Continue, Options)

**C Source Reference**: `src/main_menu.c` (lines 1-1250)

**Key Features**:
- Detect save file status
- Display menu options based on save state
- Show saved game info (player name, time, badges, Pokedex)
- Menu navigation with arrow keys
- Selection highlighting

**Files**:
```
src/screens/main-menu/
  MainMenu.tsx
  MainMenuState.ts
  components/
    MenuWindow.tsx
    SaveInfoPanel.tsx
    MenuHighlight.tsx
```

---

### Module 4: BirchSpeechModule

**Purpose**: Professor Birch intro sequence

**C Source Reference**: `src/main_menu.c` (lines 1265-2200)

**Key Features**:
- Multi-phase state machine (25+ states)
- Sprite animations (fade in/out, slide, shrink)
- Background platform sliding
- Alpha blending effects
- Text dialogue system
- Gender selection menu
- Integration with naming screen

**Files**:
```
src/screens/birch-speech/
  BirchSpeech.tsx
  BirchSpeechState.ts
  BirchSpeechReducer.ts
  components/
    BirchSprite.tsx
    LotadSprite.tsx
    PlayerSprite.tsx
    PlatformBackground.tsx
    GenderMenu.tsx
  animations/
    AlphaBlend.ts
    SpriteSlide.ts
    SpriteShrink.ts
```

**State Machine Phases**:
```typescript
type BirchSpeechPhase =
  // Initialization
  | 'init'
  | 'wait_to_show_birch'

  // Welcome sequence
  | 'show_birch'
  | 'welcome_text'
  | 'this_is_pokemon'
  | 'pokeball_animation'
  | 'main_speech'
  | 'and_you_are'

  // Transition to player
  | 'fade_birch_out'
  | 'slide_platform'
  | 'show_player'

  // Gender selection
  | 'boy_or_girl'
  | 'gender_menu'
  | 'gender_change_animation'

  // Name selection
  | 'whats_your_name'
  | 'naming_screen'
  | 'confirm_name'

  // Finale
  | 'show_birch_again'
  | 'are_you_ready'
  | 'shrink_player'
  | 'fade_to_white'
  | 'cleanup';
```

---

### Module 5: NamingScreenModule

**Purpose**: Player name input screen

**C Source Reference**: `src/naming_screen.c`

**Key Features**:
- Character grid with keyboard layout
- Name preview display
- OK/Back buttons
- Character limit enforcement
- Return callback to Birch speech

**Files**:
```
src/screens/naming/
  NamingScreen.tsx
  NamingScreenState.ts
  components/
    CharacterGrid.tsx
    NamePreview.tsx
    KeyboardLayout.tsx
```

---

### Module 6: SaveLoadModule

**Purpose**: Browser-based save system using localStorage

**C Source Reference**: `src/save.c`, `src/load_save.c`, `src/new_game.c`

**Key Features**:
- SaveBlock1, SaveBlock2, PokemonStorage structures
- Checksum validation
- Save/Load to localStorage
- New game initialization
- Continue game info display

**Files**:
```
src/save/
  SaveManager.ts
  SaveTypes.ts
  NewGameInit.ts
  EventDataManager.ts
  constants/
    Flags.ts
    Vars.ts
    Items.ts
```

---

### Module 7: TruckSequenceModule

**Purpose**: Moving truck intro sequence

**C Source Reference**: `src/field_special_scene.c`

**Key Features**:
- Box bounce animations
- Camera shake/bob effects
- Phase-based state machine
- Door opening metatile change
- Sound effect triggers
- Player control lock/unlock

**Files**:
```
src/screens/truck/
  TruckSequence.tsx
  TruckSequenceState.ts
  TruckSequenceReducer.ts
  components/
    TruckInterior.tsx
    MovingBox.tsx
  animations/
    BoxBounce.ts
    CameraShake.ts
```

---

### Module 8: PaletteFadeSystem

**Purpose**: Screen fade effects

**Key Features**:
- Fade to/from black
- Fade to/from white
- Palette manipulation for objects vs backgrounds
- Async fade completion detection

**Files**:
```
src/graphics/
  PaletteFade.tsx
  usePaletteFade.ts
  FadeOverlay.tsx
```

**API**:
```typescript
interface PaletteFadeHook {
  fadeState: 'none' | 'fading' | 'complete';
  fadeToBlack: (frames?: number) => Promise<void>;
  fadeFromBlack: (frames?: number) => Promise<void>;
  fadeToWhite: (frames?: number) => Promise<void>;
  fadeFromWhite: (frames?: number) => Promise<void>;
}
```

---

### Module 9: AudioManager

**Purpose**: Sound effect and music playback

**Key Features**:
- BGM playback (title, route122, etc.)
- Sound effect playback (truck sounds, UI sounds)
- Fade in/out music
- Web Audio API integration

**Files**:
```
src/audio/
  AudioManager.ts
  AudioContext.tsx
  hooks/
    useBGM.ts
    useSoundEffect.ts
  constants/
    MusicTracks.ts
    SoundEffects.ts
```

---

### Module 10: TextPrinterSystem

**Purpose**: Animated text display

**Key Features**:
- Character-by-character text reveal
- Variable text speed
- Text box window rendering
- Wait for player input
- String expansion (player name, etc.)

**Files**:
```
src/ui/text/
  TextPrinter.tsx
  useTextPrinter.ts
  TextBox.tsx
  StringExpander.ts
```

---

## Dependency Graph

```
                    GameStateManager
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
  TitleScreen      MainMenu        BirchSpeech
        │                │                │
        │                │                ├──► NamingScreen
        │                │                │
        │                │                ▼
        │                │         TruckSequence
        │                │                │
        │                ├────────────────┘
        │                │
        │                ▼
        └──────►   SaveLoadModule
                         │
                         ▼
                    Overworld
                    (existing)

Shared Dependencies:
├── PaletteFadeSystem (all screens)
├── AudioManager (all screens)
├── TextPrinterSystem (BirchSpeech, Overworld)
└── EventDataManager (SaveLoad, Overworld)
```

## Implementation Priority

### Phase 1: Core Infrastructure
1. GameStateManager
2. PaletteFadeSystem
3. SaveLoadModule (basic structure)

### Phase 2: Title & Menu
4. TitleScreenModule
5. MainMenuModule
6. AudioManager (basic)

### Phase 3: New Game Flow
7. BirchSpeechModule
8. NamingScreenModule
9. TextPrinterSystem

### Phase 4: Truck Scene
10. TruckSequenceModule
11. SaveLoadModule (NewGameInit)

### Phase 5: Integration
12. Connect to existing Overworld
13. Polish and testing

## File Structure Summary

```
src/
├── core/
│   ├── GameStateManager.tsx
│   ├── GameContext.tsx
│   └── types.ts
│
├── screens/
│   ├── title/
│   ├── main-menu/
│   ├── birch-speech/
│   ├── naming/
│   └── truck/
│
├── save/
│   ├── SaveManager.ts
│   ├── SaveTypes.ts
│   ├── NewGameInit.ts
│   └── EventDataManager.ts
│
├── graphics/
│   ├── PaletteFade.tsx
│   └── FadeOverlay.tsx
│
├── audio/
│   ├── AudioManager.ts
│   └── hooks/
│
├── ui/
│   ├── text/
│   │   ├── TextPrinter.tsx
│   │   └── TextBox.tsx
│   └── menus/
│       ├── YesNoMenu.tsx
│       └── SelectionMenu.tsx
│
└── constants/
    ├── Flags.ts
    ├── Vars.ts
    ├── Maps.ts
    └── Items.ts
```

## Testing Checklist

### Title Screen
- [ ] Background renders correctly
- [ ] Version banner animates in
- [ ] Press Start blinks
- [ ] Logo shine sweep works
- [ ] Press Start goes to menu
- [ ] B button returns to intro

### Main Menu
- [ ] Detects save file correctly
- [ ] Shows correct menu options
- [ ] Save info displays properly
- [ ] Navigation works
- [ ] New Game starts Birch speech
- [ ] Continue loads game

### Birch Speech
- [ ] All 25+ states transition correctly
- [ ] Sprites fade in/out properly
- [ ] Platform slides smoothly
- [ ] Gender selection works
- [ ] Naming screen integration
- [ ] Name confirmation works
- [ ] Player shrink animation
- [ ] Transitions to new game

### Truck Sequence
- [ ] Initial fade from black
- [ ] Box bounce animation
- [ ] Camera shake effects
- [ ] Stopping sequence
- [ ] Door opens
- [ ] Player can exit
- [ ] Intro flags set correctly

### Save System
- [ ] New game initializes correctly
- [ ] Starting money is $3000
- [ ] PC has 1 Potion
- [ ] Save to localStorage works
- [ ] Load from localStorage works
- [ ] Checksum validation works
- [ ] Continue info displays correctly
